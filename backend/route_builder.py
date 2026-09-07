import json
import os
import networkx as nx
from pathlib import Path
import math

DATA_DIR = Path(__file__).parent / "data"
CACHE_DIR = DATA_DIR / "osm_cache"

# Haversine formula to calculate distance between two coordinates
def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def build_graph_from_osm_json(osm_data: dict) -> nx.MultiGraph:
    """Builds a NetworkX graph from raw Overpass JSON data."""
    G = nx.MultiGraph()
    
    # Track node coordinates
    nodes = {}
    for element in osm_data.get("elements", []):
        if element["type"] == "node":
            nodes[element["id"]] = (element["lat"], element["lon"])
            
    for element in osm_data.get("elements", []):
        if element["type"] == "way" and "nodes" in element:
            way_nodes = element["nodes"]
            
            # If the way has full geometry embedded (from 'out geom')
            if "geometry" in element:
                geom = element["geometry"]
                for i in range(len(way_nodes) - 1):
                    n1 = way_nodes[i]
                    n2 = way_nodes[i+1]
                    if i < len(geom) and (i+1) < len(geom):
                        p1 = (geom[i]["lat"], geom[i]["lon"])
                        p2 = (geom[i+1]["lat"], geom[i+1]["lon"])
                        dist = haversine(p1[0], p1[1], p2[0], p2[1])
                        G.add_node(n1, y=p1[0], x=p1[1])
                        G.add_node(n2, y=p2[0], x=p2[1])
                        G.add_edge(n1, n2, length=dist)
            else:
                # Classic way nodes
                for i in range(len(way_nodes) - 1):
                    n1 = way_nodes[i]
                    n2 = way_nodes[i+1]
                    if n1 in nodes and n2 in nodes:
                        p1 = nodes[n1]
                        p2 = nodes[n2]
                        dist = haversine(p1[0], p1[1], p2[0], p2[1])
                        G.add_node(n1, y=p1[0], x=p1[1])
                        G.add_node(n2, y=p2[0], x=p2[1])
                        G.add_edge(n1, n2, length=dist)
    return G

def get_nearest_node(G: nx.MultiGraph, lat: float, lng: float) -> int:
    """Finds the nearest graph node to a given lat/lng."""
    min_dist = float('inf')
    nearest = None
    for n, data in G.nodes(data=True):
        if 'y' in data and 'x' in data:
            dist = haversine(lat, lng, data['y'], data['x'])
            if dist < min_dist:
                min_dist = dist
                nearest = n
    return nearest

def process_corridor():
    """Builds routes for all cached OSM files."""
    print("Building routed paths from OSM cache...")
    
    if not CACHE_DIR.exists():
        print("No cache directory found.")
        return
        
    all_stations = json.loads((DATA_DIR / "all_stations.json").read_text(encoding="utf-8"))
    all_schedules = json.loads((DATA_DIR / "all_schedules.json").read_text(encoding="utf-8"))
    
    # Find all adjacent station pairs in all schedules to figure out what paths we need to route
    needed_pairs = set()
    for tnum, tdata in all_schedules.items():
        sched = tdata.get("schedule", [])
        for i in range(len(sched) - 1):
            s1 = sched[i].get("station_code")
            s2 = sched[i+1].get("station_code")
            if s1 and s2 and s1 != s2:
                # Store as sorted tuple so A->B and B->A use the same geometry query
                needed_pairs.add(tuple(sorted((s1, s2))))
                
    routed_edges = {}
    
    # Process each cached OSM file and build a MASTER graph
    MasterG = nx.MultiGraph()
    
    for osm_file in CACHE_DIR.glob("*.json"):
        if osm_file.name == "routed_corridors.json":
            continue
            
        print(f"Loading {osm_file.name} into Master Graph...")
        try:
            with open(osm_file, "r") as f:
                osm_data = json.load(f)
            
            # Build partial graph
            G = build_graph_from_osm_json(osm_data)
            MasterG = nx.compose(MasterG, G)
        except Exception as e:
            print(f"  Error processing {osm_file.name}: {e}")
            
    print(f"Master Graph built with {len(MasterG.nodes)} nodes and {len(MasterG.edges)} edges.")
    
    # Now route all needed pairs on the unified graph
    for s1, s2 in needed_pairs:
        edge_id = f"{s1}-{s2}"
        if edge_id in routed_edges:
            continue
            
        if s1 in all_stations and s2 in all_stations:
            st1 = all_stations[s1]
            st2 = all_stations[s2]
            
            n1 = get_nearest_node(MasterG, st1["lat"], st1["lng"])
            n2 = get_nearest_node(MasterG, st2["lat"], st2["lng"])
            
            if n1 and n2:
                try:
                    path = nx.shortest_path(MasterG, n1, n2, weight="length")
                    # Convert node path back to coordinates
                    coords = []
                    for n in path:
                        coords.append([MasterG.nodes[n]['x'], MasterG.nodes[n]['y']])
                        
                    # Calculate exact length
                    total_km = sum(MasterG[path[i]][path[i+1]][0]['length'] for i in range(len(path)-1))
                    
                    routed_edges[edge_id] = {
                        "source": s1,
                        "target": s2,
                        "distance_km": round(total_km, 2),
                        "geometry": {
                            "type": "LineString",
                            "coordinates": coords
                        }
                    }
                    print(f"Successfully routed {s1} <-> {s2} ({total_km:.2f} km)")
                except nx.NetworkXNoPath:
                    print(f"Warning: No valid path found for {s1} <-> {s2} in Master Graph.")
            
    # Save the master routing database
    out_file = CACHE_DIR / "routed_corridors.json"
    with open(out_file, "w") as f:
        json.dump(routed_edges, f)
    print(f"Saved {len(routed_edges)} routed edges to {out_file}")

if __name__ == "__main__":
    process_corridor()
