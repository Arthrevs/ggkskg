import os
import json
import httpx
import asyncio
from pathlib import Path

# The 6 curated corridors
CURATED_PAIRS = [
    ("JP", "AII"),
    ("NDLS", "AGC"),
    ("BCT", "ST"),
    ("HWH", "KGP"),
    ("MAS", "BZA"),
    ("SBC", "MYS"),
]

DATA_DIR = Path(__file__).parent / "data"
CACHE_DIR = DATA_DIR / "osm_cache"

async def fetch_corridor_data():
    if not CACHE_DIR.exists():
        CACHE_DIR.mkdir(parents=True)
        
    # Load globals to find bounding boxes
    all_stations = json.loads((DATA_DIR / "all_stations.json").read_text(encoding="utf-8"))
    all_schedules = json.loads((DATA_DIR / "all_schedules.json").read_text(encoding="utf-8"))
    
    # 1. Clear old cache
    for f in CACHE_DIR.glob("*.json"):
        f.unlink()
        print(f"Deleted {f.name}")
        
    async with httpx.AsyncClient(timeout=120.0) as client:
        for src, dst in CURATED_PAIRS:
            print(f"Processing {src} -> {dst}...")
            
            # Find the train sequence to calculate bounding box
            corridor_trains = []
            for tnum, tdata in all_schedules.items():
                sched = tdata.get("schedule", [])
                codes = [s.get("station_code") for s in sched]
                if src in codes and dst in codes:
                    idx1 = codes.index(src)
                    idx2 = codes.index(dst)
                    corridor_trains.append(sched[min(idx1, idx2):max(idx1, idx2)+1])
            
            if not corridor_trains:
                print(f"  No trains found for {src}-{dst}!")
                continue
                
            direct_train = min(corridor_trains, key=len)
            lats = []
            lngs = []
            for s in direct_train:
                st_info = all_stations.get(s.get("station_code"))
                if st_info:
                    lats.append(st_info["lat"])
                    lngs.append(st_info["lng"])
                    
            if not lats:
                print(f"  No coordinates found for {src}-{dst}!")
                continue
            
            # Use generous 0.5 degree padding (~55km) to catch any curving tracks
            south = min(lats) - 0.5
            north = max(lats) + 0.5
            west = min(lngs) - 0.5
            east = max(lngs) + 0.5
            
            query = f"""
            [out:json][timeout:90];
            (
              way["railway"="rail"]({south},{west},{north},{east});
            );
            out body geom;
            """
            
            cache_file = CACHE_DIR / f"tracks_{south:.2f}_{west:.2f}_{north:.2f}_{east:.2f}.json"
            
            print(f"  Fetching Overpass API for bounds ({south:.2f}, {west:.2f}) to ({north:.2f}, {east:.2f})...")
            
            try:
                response = await client.post(
                    "https://overpass-api.de/api/interpreter", 
                    data={'data': query},
                    headers={
                        "User-Agent": "SIH_Railway_Command_App/1.0",
                        "Accept": "application/json"
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                with open(cache_file, "w") as f:
                    json.dump(data, f)
                print(f"  Success: Saved {len(data.get('elements', []))} elements to {cache_file.name}")
            except Exception as e:
                print(f"  FAILED to fetch {src}-{dst}: {e}")
                
            # Sleep briefly to avoid Overpass rate limiting
            await asyncio.sleep(5)
            
if __name__ == "__main__":
    asyncio.run(fetch_corridor_data())
