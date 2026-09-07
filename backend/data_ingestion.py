import json
import csv
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = Path(__file__).parent / "data"

STATIONS_JSON = REPO_ROOT / "railways-master" / "railways-master" / "stations.json"
TRAINS_JSON = REPO_ROOT / "railways-master" / "railways-master" / "trains.json"
SCHEDULES_JSON = REPO_ROOT / "railways-master" / "railways-master" / "schedules.json"
ARCHIVE_CSV = REPO_ROOT / "archive" / "india_railway_stations.csv"

def time_to_minutes(time_str: str) -> int:
    if not time_str or time_str in ("None", ""):
        return None
    try:
        parts = time_str.split(":")
        h = int(parts[0])
        m = int(parts[1])
        return h * 60 + m
    except Exception:
        return None

def ingest_all():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    print("1. Ingesting all stations...")
    all_stations = {}
    
    # Base stations from JSON
    with open(STATIONS_JSON, "r", encoding="utf-8") as f:
        stat_data = json.load(f)
        for st in stat_data.get("features", []):
            props = st.get("properties", {})
            geom = st.get("geometry", {})
            code = props.get("code")
            if code and geom and geom.get("coordinates"):
                all_stations[code] = {
                    "code": code,
                    "name": props.get("name", code),
                    "lng": geom["coordinates"][0],
                    "lat": geom["coordinates"][1],
                    "zone": props.get("zone", ""),
                    "state": props.get("state", "")
                }
                
    # Supplement with CSV
    with open(ARCHIVE_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row.get("station code")
            if code and code not in all_stations:
                try:
                    lat = float(row.get("latitude", 0))
                    lng = float(row.get("longitude", 0))
                    if lat and lng:
                        all_stations[code] = {
                            "code": code,
                            "name": row.get("station name", code),
                            "lat": lat,
                            "lng": lng,
                            "zone": row.get("zone", ""),
                            "state": row.get("state", "")
                        }
                except ValueError:
                    continue

    with open(DATA_DIR / "all_stations.json", "w", encoding="utf-8") as f:
        json.dump(all_stations, f)
    print(f"  -> Extracted {len(all_stations)} stations.")

    print("2. Ingesting all tracks (LineStrings)...")
    all_tracks = {"type": "FeatureCollection", "features": []}
    with open(TRAINS_JSON, "r", encoding="utf-8") as f:
        trains_data = json.load(f)
        for feat in trains_data.get("features", []):
            geom = feat.get("geometry")
            if geom and geom.get("type") == "LineString":
                all_tracks["features"].append(feat)

    with open(DATA_DIR / "all_tracks.geojson", "w", encoding="utf-8") as f:
        json.dump(all_tracks, f)
    print(f"  -> Extracted {len(all_tracks['features'])} track segments.")

    print("3. Ingesting all schedules & applying Midnight Math globally...")
    with open(SCHEDULES_JSON, "r", encoding="utf-8") as f:
        sched_data = json.load(f)
    
    # Group by train
    raw_trains = {}
    for s in sched_data:
        tnum = s.get("train_number")
        if tnum:
            raw_trains.setdefault(tnum, []).append(s)

    all_schedules = {}
    for tnum, stops in raw_trains.items():
        # Sort by sequence or id
        stops.sort(key=lambda x: int(x.get("day") or 1) * 10000 + int(x.get("id") or 0))
        
        processed_stops = []
        current_offset = 0
        last_time = -1
        
        for stop in stops:
            arr_m = time_to_minutes(stop.get("arrival"))
            dep_m = time_to_minutes(stop.get("departure"))
            
            # If both are None, skip or just keep offset?
            if arr_m is not None:
                # Did we cross midnight?
                if arr_m < last_time:
                    current_offset += 1440
                arr_m += current_offset
                last_time = arr_m
                
            if dep_m is not None:
                # Did we cross midnight while at station?
                if dep_m < last_time:
                    current_offset += 1440
                dep_m += current_offset
                last_time = dep_m
                
            processed_stops.append({
                "station_code": stop.get("station_code"),
                "station_name": stop.get("station_name"),
                "arrival_time": stop.get("arrival"),
                "departure_time": stop.get("departure"),
                "arrival_minutes": arr_m,
                "departure_minutes": dep_m,
                "day": stop.get("day", 1)
            })
            
        all_schedules[tnum] = {
            "train_number": tnum,
            "train_name": stops[0].get("train_name", f"Train {tnum}") if stops else f"Train {tnum}",
            "schedule": processed_stops
        }

    with open(DATA_DIR / "all_schedules.json", "w", encoding="utf-8") as f:
        json.dump(all_schedules, f)
    print(f"  -> Extracted schedules for {len(all_schedules)} trains.")

if __name__ == "__main__":
    ingest_all()
