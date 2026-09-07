import httpx
import asyncio
import json

async def run():
    # Bounding box around Isarda to Sureli (roughly 26.0, 75.8, 26.3, 76.2)
    query = """
    [out:json][timeout:30];
    (
      way["railway"="rail"](26.0, 75.8, 26.3, 76.2);
    );
    out body geom;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url, 
            data={'data': query},
            headers={
                "User-Agent": "SIH_Railway_Command_App/1.0",
                "Accept": "application/json"
            }
        )
        print(f"Status: {response.status_code}")
        
        try:
            data = response.json()
            print(f"Elements: {len(data.get('elements', []))}")
            
            with open("test_osm.json", "w") as f:
                json.dump(data, f)
        except Exception as e:
            print(f"Error parsing JSON: {e}")
            print(response.text[:500])

if __name__ == "__main__":
    asyncio.run(run())
