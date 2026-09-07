import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import math
import os
import httpx
from solver import solve
from shapely.geometry import LineString, Point

app = FastAPI(title="Railway Block Solver API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent / "data"

# Global Memory Caches
ALL_STATIONS = {}
ALL_TRACKS = {}
ROUTED_CORRIDORS = {}
ALL_SCHEDULES = {}

def load_globals():
    global ALL_STATIONS, ALL_TRACKS, ALL_SCHEDULES, ROUTED_CORRIDORS
    if not ALL_STATIONS:
        p = DATA_DIR / "all_stations.json"
        if p.exists():
            ALL_STATIONS = json.loads(p.read_text(encoding="utf-8"))
    
    if not ALL_TRACKS:
        p = DATA_DIR / "all_tracks.geojson"
        if p.exists():
            ALL_TRACKS = json.loads(p.read_text(encoding="utf-8"))
            
    if not ALL_SCHEDULES:
        p = DATA_DIR / "all_schedules.json"
        if p.exists():
            ALL_SCHEDULES = json.loads(p.read_text(encoding="utf-8"))
            
    if not ROUTED_CORRIDORS:
        p = DATA_DIR / "osm_cache" / "routed_corridors.json"
        if p.exists():
            ROUTED_CORRIDORS = json.loads(p.read_text(encoding="utf-8"))

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

@app.on_event("startup")
async def startup_event():
    load_globals()

@app.get("/api/stations")
def get_stations():
    load_globals()
    # Sort alphabetically by station code
    station_list = [{"code": k, "name": v["name"]} for k, v in ALL_STATIONS.items()]
    station_list.sort(key=lambda x: x["code"])
    return station_list

@app.get("/api/corridors")
def get_corridors():
    """Returns a curated list of manageable corridor pairs for the demo."""
    load_globals()
    
    # A curated list of valid, manageable corridors (to avoid massive Overpass timeouts)
    # A curated list of valid, manageable corridors (to avoid massive Overpass timeouts)
    # Limited to routes that successfully bypassed the Overpass 429 rate limit and cached fully.
    curated_pairs = [
        ("JP", "AII"),    # Jaipur to Ajmer
        ("NDLS", "AGC"),  # New Delhi to Agra
        ("HWH", "KGP"),   # Howrah to Kharagpur
        ("MAS", "BZA"),   # Chennai to Vijayawada
        ("SBC", "MYS"),   # Bangalore to Mysore
    ]
    
    corridors = []
    for src, dst in curated_pairs:
        src_info = ALL_STATIONS.get(src)
        dst_info = ALL_STATIONS.get(dst)
        if src_info and dst_info:
            corridors.append({
                "source": src,
                "destination": dst,
                "source_name": src_info["name"],
                "destination_name": dst_info["name"],
                "train_count": 10, # Mock train count for the curated list
                "label": f"{src_info['name']} ({src}) → {dst_info['name']} ({dst})"
            })
            
    return corridors

@app.get("/api/corridor/{source}/{destination}")
def get_corridor(source: str, destination: str):
    """
    Dynamically filters the national dataset for a specific route.
    Finds all trains passing through both source and destination,
    infers the station sequence, and returns a bounded dataset.
    """
    load_globals()
    
    if source not in ALL_STATIONS or destination not in ALL_STATIONS:
        raise HTTPException(status_code=404, detail="Source or destination station not found in national dataset.")
        
    # 1. Find all trains that stop at both source and destination
    corridor_trains = []
    for tnum, tdata in ALL_SCHEDULES.items():
        sched = tdata.get("schedule", [])
        codes = [s.get("station_code") for s in sched]
        if source in codes and destination in codes:
            # Extract just the segment between source and destination
            idx1 = codes.index(source)
            idx2 = codes.index(destination)
            start_idx = min(idx1, idx2)
            end_idx = max(idx1, idx2)
            
            sliced_sched = sched[start_idx:end_idx+1]
            corridor_trains.append({
                "train_id": tnum,
                "train_name": tdata.get("train_name"),
                "priority": "high" if "Shatabdi" in tdata.get("train_name", "") or "Rajdhani" in tdata.get("train_name", "") else "medium",
                "category": "Express",
                "schedule": sliced_sched
            })
            
    if not corridor_trains:
        raise HTTPException(status_code=404, detail="No direct trains found between these stations.")
        
    # 2. Infer the station order by finding the most common sequence
    station_freq = {}
    for t in corridor_trains:
        codes = [s.get("station_code") for s in t["schedule"]]
        if codes[0] != source:
            codes = list(reversed(codes)) # align to source -> dest
        for i, c in enumerate(codes):
            station_freq[c] = station_freq.get(c, 0) + 1
            
    # Take the sequence of the train that makes the FEWEST stops (most direct route)
    # to avoid anomalies where a train takes a massive detour across the country.
    direct_train = min(corridor_trains, key=lambda t: len(t["schedule"]))
    corridor_order = [s.get("station_code") for s in direct_train["schedule"]]
    if corridor_order[0] != source:
        corridor_order = list(reversed(corridor_order))
        
    # Build nodes with Haversine KM
    nodes = []
    current_km = 0.0
    for i, code in enumerate(corridor_order):
        stat = ALL_STATIONS.get(code)
        if not stat: continue
        
        if i > 0:
            prev_stat = ALL_STATIONS.get(corridor_order[i-1])
            if prev_stat:
                dist = haversine(prev_stat["lat"], prev_stat["lng"], stat["lat"], stat["lng"])
                current_km += dist
            
        # Simulate topology data for the Mimic Panel
        name_upper = stat.get("name", "").upper()
        is_major = code in ["JP", "AII", "KOTA", "NDLS", "BCT", "HWH", "MAS", "SWM", "BKN"]
        is_junction = "JN" in name_upper or "JUNCTION" in name_upper or "CITY" in name_upper
        
        if is_major:
            loops = 10  # Massive yards for major hubs
        elif is_junction:
            loops = 6   # 6 loops for junctions
        else:
            loops = 4   # Standard station: UP Loop, UP Main, DN Main, DN Loop
        
        nodes.append({
            "id": code,
            "name": stat.get("name"),
            "code": code,
            "km": round(current_km, 2),
            "lat": stat.get("lat"),
            "lng": stat.get("lng"),
            "type": "station",
            "platforms": 2,
            "loops": loops
        })
        
    # Build edges (UP and DN) and subdivide into ~4km sectors
    final_nodes = []
    edges = []
    
    for i in range(len(nodes)):
        final_nodes.append(nodes[i])
        
        if i < len(nodes) - 1:
            s1 = nodes[i]
            s2 = nodes[i+1]
            dist = round(s2["km"] - s1["km"], 2)
            
            MAX_SECTOR_KM = 4.0
            num_sectors = max(1, math.ceil(dist / MAX_SECTOR_KM))
            
            current_source = s1
            
            for sector in range(1, num_sectors):
                fraction = sector / num_sectors
                ib_node = {
                    "id": f"IB_{s1['id']}_{s2['id']}_{sector}",
                    "name": f"Sector {chr(64+sector)} ({s1['code']}-{s2['code']})",
                    "code": f"IB{sector}",
                    "km": round(s1['km'] + (dist * fraction), 2),
                    "lat": s1["lat"] + (s2["lat"] - s1["lat"]) * fraction,
                    "lng": s1["lng"] + (s2["lng"] - s1["lng"]) * fraction,
                    "type": "ib_signal",
                    "platforms": 0,
                    "loops": 2
                }
                final_nodes.append(ib_node)
                
                # Create UP and DN edges for this sector
                sec_dist = round(ib_node["km"] - current_source["km"], 2)
                edges.append({
                    "id": f"UP_{current_source['id']}_{ib_node['id']}",
                    "source": current_source["id"], "target": ib_node["id"],
                    "direction": "UP", "distance_km": sec_dist, "capacity": 1,
                    "line_type": "mainline", "km_start": current_source["km"], "km_end": ib_node["km"], "tracks": 2
                })
                edges.append({
                    "id": f"DN_{ib_node['id']}_{current_source['id']}",
                    "source": ib_node["id"], "target": current_source["id"],
                    "direction": "DN", "distance_km": sec_dist, "capacity": 1,
                    "line_type": "mainline", "km_start": ib_node["km"], "km_end": current_source["km"]
                })
                
                current_source = ib_node
                
            # Final edge to s2
            final_dist = round(s2["km"] - current_source["km"], 2)
            edges.append({
                "id": f"UP_{current_source['id']}_{s2['id']}",
                "source": current_source["id"], "target": s2["id"],
                "direction": "UP", "distance_km": final_dist, "capacity": 1,
                "line_type": "mainline", "km_start": current_source["km"], "km_end": s2["km"], "tracks": 2
            })
            edges.append({
                "id": f"DN_{s2['id']}_{current_source['id']}",
                "source": s2["id"], "target": current_source["id"],
                "direction": "DN", "distance_km": final_dist, "capacity": 1,
                "line_type": "mainline", "km_start": s2["km"], "km_end": current_source["km"]
            })
    # Attach route geometries from local cached JSON (fast, no network)
    route_geometries = []
    
    for i in range(len(nodes) - 1):
        s1 = nodes[i]["code"]
        s2 = nodes[i+1]["code"]
        
        edge_id = f"{s1}-{s2}"
        edge_id_rev = f"{s2}-{s1}"
        
        # Use local cached JSON
        geom_data = ROUTED_CORRIDORS.get(edge_id) or ROUTED_CORRIDORS.get(edge_id_rev)
        if geom_data and len(geom_data.get("geometry", {}).get("coordinates", [])) >= 2:
            coords = geom_data["geometry"]["coordinates"]
            if geom_data["source"] != s1:
                coords = list(reversed(coords))
            route_geometries.append({
                "source": s1, "target": s2,
                "distance_km": geom_data["distance_km"],
                "geometry": {"type": "LineString", "coordinates": coords}
            })
            
    return {
        "source": source,
        "destination": destination,
        "nodes": final_nodes,
        "edges": edges,
        "trains": corridor_trains,
        "route_geometries": route_geometries
    }

class SolveRequest(BaseModel):
    nodes: list
    edges: list
    trains: list
    defects: list

@app.post("/api/solve")
def run_solver(req: SolveRequest):
    """
    Executes CP-SAT on the dynamically provided subset.
    """
    tracks = {"nodes": req.nodes, "edges": req.edges}
    timetable = {"trains": req.trains}
    defects_data = {"defects": req.defects}
    
    result = solve(tracks, timetable, defects_data)
    result["tracks"] = tracks
    return result

@app.get("/api/osm/tracks")
async def get_osm_tracks(south: float, west: float, north: float, east: float):
    # Ensure cache directory exists
    os.makedirs("data/osm_cache", exist_ok=True)
    
    # Create a unique filename for this bounding box
    bounds_str = f"{south:.2f}_{west:.2f}_{north:.2f}_{east:.2f}"
    cache_file = f"data/osm_cache/tracks_{bounds_str}.json"
    
    # If we already have it saved locally, return it instantly! (OFFLINE MODE)
    if os.path.exists(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)
            
    # Otherwise, we fetch it once from Overpass API
    query = f"""
    [out:json][timeout:30];
    (
      way["railway"="rail"]({south},{west},{north},{east});
    );
    out body geom;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    
    try:
        # Use httpx for async HTTP requests with proper User-Agent
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url, 
                data={'data': query},
                headers={
                    "User-Agent": "SIH_Railway_Command_App/1.0",
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            data = response.json()
            
            # Save it permanently to the local cache
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(data, f)
                
            return data
    except Exception as e:
        print(f"OSM Fetch Error: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to fetch track geometry")
