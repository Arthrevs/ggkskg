import os
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

load_dotenv()

def init_db():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL not found in .env")
        return

    # Parse connection details manually to handle special chars in password
    # Format: postgresql://user:password@host:port/dbname
    # Password may contain '@', ':', etc. so we split carefully
    without_scheme = database_url.replace("postgresql://", "")
    # Split from the RIGHT on '@' to separate credentials from host (password may contain '@')
    creds_part, host_part = without_scheme.rsplit("@", 1)
    # Split credentials on first ':' to separate user from password
    db_user, db_password = creds_part.split(":", 1)
    # Split host part
    host_and_port, db_name = host_part.split("/", 1)
    db_host, db_port = host_and_port.rsplit(":", 1)
    
    print(f"Connecting to Supabase PostgreSQL at {db_host}:{db_port} as {db_user}...")
    try:
        conn = psycopg2.connect(
            host=db_host,
            port=int(db_port),
            dbname=db_name,
            user=db_user,
            password=db_password
        )
        conn.autocommit = True
        cursor = conn.cursor()

        print("Enabling PostGIS extension...")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

        print("Creating 'stations' table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stations (
                id VARCHAR PRIMARY KEY,
                name VARCHAR NOT NULL,
                code VARCHAR NOT NULL,
                geom geometry(Point, 4326),
                lat FLOAT,
                lng FLOAT,
                km FLOAT
            );
        """)

        print("Creating 'tracks' table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tracks (
                id SERIAL PRIMARY KEY,
                source_code VARCHAR NOT NULL,
                target_code VARCHAR NOT NULL,
                geom geometry(LineString, 4326),
                km_distance FLOAT
            );
            
            CREATE INDEX IF NOT EXISTS tracks_source_idx ON tracks (source_code);
            CREATE INDEX IF NOT EXISTS tracks_target_idx ON tracks (target_code);
        """)

        print("Creating 'trains' table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trains (
                train_id VARCHAR PRIMARY KEY,
                train_name VARCHAR NOT NULL,
                schedule JSONB NOT NULL
            );
        """)

        print("Database initialization complete!")
        cursor.close()
        conn.close()

    except Exception as e:
        print(f"Failed to initialize database: {e}")

if __name__ == "__main__":
    init_db()
