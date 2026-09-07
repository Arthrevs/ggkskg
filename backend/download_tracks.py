import requests
import json
import time
import os

def download_india_railways():
    # Bounding box for India roughly: South 8.0, West 68.0, North 37.0, East 97.0
    query = """
    [out:json][timeout:300];
    (
      way["railway"="rail"](8.0, 68.0, 37.0, 97.0);
    );
    out body geom;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    print("Fetching Indian Railways from Overpass API (this may take a minute)...")
    
    start_time = time.time()
    try:
        response = requests.post(url, data={'data': query})
        response.raise_for_status()
        
        data = response.json()
        print(f"Downloaded {len(data.get('elements', []))} railway elements in {time.time() - start_time:.2f} seconds.")
        
        os.makedirs("data", exist_ok=True)
        with open("data/india_railways.json", "w", encoding="utf-8") as f:
            json.dump(data, f)
            
        print("Saved raw data to data/india_railways.json")
        
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    download_india_railways()
