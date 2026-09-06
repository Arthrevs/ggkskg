"""End-to-end flow test to verify all pieces work together correctly."""

import httpx
import sys

BASE_URL = "http://localhost:8000/api"

def run_e2e():
    print("=== GGKSGS Backend End-to-End Test ===")
    
    with httpx.Client(base_url=BASE_URL) as client:
        # 1. Login as Admin
        print("\n1. Logging in as Admin...")
        res = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
        if res.status_code != 200:
            print("Login failed:", res.text)
            sys.exit(1)
        
        token = res.json()["access_token"]
        client.headers.update({"Authorization": f"Bearer {token}"})
        print("Logged in successfully.")
        
        # 2. Generate Mock Data
        print("\n2. Generating mock data (Seed: 26027)...")
        res = client.post("/mock-data/generate?seed=26027&clear=true")
        if res.status_code != 201:
            print("Failed to generate mock data:", res.text)
            sys.exit(1)
        print("Mock data generated:", res.json())
        
        # 3. Generate Block Windows
        week = "2026-10-05"
        print(f"\n3. Generating block windows for week {week}...")
        res = client.post("/block-windows/generate", json={"week_start_date": week})
        if res.status_code != 201:
            print("Failed to generate block windows:", res.text)
            sys.exit(1)
        print("Block windows generated:", res.json())
        
        # 4. Run Manual Schedule
        print("\n4. Running Manual Schedule...")
        res = client.post("/schedule/run", json={"week_start_date": week, "mode": "manual"})
        if res.status_code != 201:
            print("Failed to run manual schedule:", res.text)
            sys.exit(1)
        print("Manual schedule completed.")
        
        # 5. Run Optimized Schedule
        print("\n5. Running Optimized Schedule...")
        res = client.post("/schedule/run", json={"week_start_date": week, "mode": "optimized"})
        if res.status_code != 201:
            print("Failed to run optimized schedule:", res.text)
            sys.exit(1)
        print("Optimized schedule completed.")
        
        # 6. Compare Schedules
        print("\n6. Comparing Schedules...")
        res = client.get(f"/schedule/compare?week_start_date={week}")
        if res.status_code != 200:
            print("Failed to fetch comparison:", res.text)
            sys.exit(1)
        comp = res.json()
        opt_hours = comp.get("optimized", {}).get("total_hours_scheduled", 0)
        man_hours = comp.get("manual", {}).get("total_hours_scheduled", 0)
        print(f"Comparison: Optimized ({opt_hours} hrs) vs Manual ({man_hours} hrs)")
        
        # 7. Fetch Statistics
        print("\n7. Fetching Statistics...")
        res = client.get(f"/stats/summary?week_start_date={week}")
        if res.status_code != 200:
            print("Failed to fetch stats:", res.text)
            sys.exit(1)
        stats = res.json()
        print(f"Stats - Total Hours: {stats.get('totalHoursScheduled')}, Colocated Blocks: {stats.get('colocatedBlocks')}")
        
        # 8. Fetch Schedule Details
        print("\n8. Fetching Optimized Schedule Details...")
        res = client.get(f"/schedule/{week}?mode=optimized")
        if res.status_code != 200:
            print("Failed to fetch schedule:", res.text)
            sys.exit(1)
        sched = res.json()
        print(f"Schedule API returned mode: {sched.get('mode')} with {len(sched.get('assignments', []))} assignments.")
        
        print("\n=== E2E Test Completed Successfully! ===")


if __name__ == "__main__":
    run_e2e()
