"""
Migrates local JSON data (stations, tracks, trains) into the Supabase PostGIS database.
Run this once after db_init.py has created the tables.

Uses sys.stdout.flush() after every print to ensure real-time log output.
Skips the massive all_schedules.json for now - migrates stations and tracks first.
"""
import os
import sys
import json
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def log(msg):
    print(msg)
    sys.stdout.flush()

def get_connection():
    database_url = os.getenv("DATABASE_URL")
    without_scheme = database_url.replace("postgresql://", "")
    creds_part, host_part = without_scheme.rsplit("@", 1)
    db_user, db_password = creds_part.split(":", 1)
    host_and_port, db_name = host_part.split("/", 1)
    db_host, db_port = host_and_port.rsplit(":", 1)
    return psycopg2.connect(
        host=db_host, port=int(db_port), dbname=db_name,
        user=db_user, password=db_password
    )

def migrate_stations(cursor):
    log("--- Migrating stations ---")
    with open("data/all_stations.json", "r", encoding="utf-8") as f:
        stations = json.load(f)
    log(f"  Loaded {len(stations)} stations from JSON.")
    
    count = 0
    for code, station in stations.items():
        lat = station.get("lat")
        lng = station.get("lng")
        name = station.get("name", code)
        if lat is None or lng is None:
            continue
        cursor.execute("""
            INSERT INTO stations (id, name, code, geom, lat, lng)
            VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                geom = EXCLUDED.geom,
                lat = EXCLUDED.lat,
                lng = EXCLUDED.lng;
        """, (code, name, code, lng, lat, lat, lng))
        count += 1
        if count % 500 == 0:
            log(f"  ... {count} stations uploaded")
    
    log(f"  DONE: {count} stations migrated.")

def migrate_tracks(cursor):
    log("--- Migrating tracks ---")
    with open("data/osm_cache/routed_corridors.json", "r", encoding="utf-8") as f:
        corridors = json.load(f)
    log(f"  Loaded {len(corridors)} track segments from JSON.")
    
    count = 0
    skipped = 0
    for key, route in corridors.items():
        source = route.get("source")
        target = route.get("target")
        distance = route.get("distance_km", 0)
        geom = route.get("geometry")
        
        if not geom or not geom.get("coordinates"):
            skipped += 1
            continue
        
        coords = geom["coordinates"]
        if len(coords) < 2:
            skipped += 1
            continue
        
        geojson_str = json.dumps(geom)
        cursor.execute("""
            INSERT INTO tracks (source_code, target_code, geom, km_distance)
            VALUES (%s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), %s);
        """, (source, target, geojson_str, distance))
        count += 1
        if count % 500 == 0:
            log(f"  ... {count} tracks uploaded")
    
    log(f"  DONE: {count} tracks migrated, {skipped} skipped (invalid geometry).")

def main():
    log("Connecting to Supabase...")
    conn = get_connection()
    conn.autocommit = True
    cursor = conn.cursor()
    log("Connected!")
    
    migrate_stations(cursor)
    migrate_tracks(cursor)
    
    # Train schedules are 73MB - skip for now, can be migrated separately
    log("--- Skipping train schedules (73MB file - will migrate separately) ---")
    
    cursor.close()
    conn.close()
    log("\nMigration complete!")

if __name__ == "__main__":
    main()
