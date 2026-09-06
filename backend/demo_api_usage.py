import json
from datetime import date, timedelta
from fastapi.testclient import TestClient

from app.main import app

def print_json(title, data):
    print(f"\n{'='*50}\n{title}\n{'='*50}")
    print(json.dumps(data, indent=2))

def main():
    client = TestClient(app)
    
    # Calculate next Monday (same logic as mock data)
    today = date.today()
    days_ahead = 0 - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    next_monday = today + timedelta(days=days_ahead)
    test_date = next_monday.isoformat()
    
    print(f"Testing schedule for week starting on: {test_date}")

    # 1. Generate fresh mock data
    print("\n1. Generating mock data...")
    res = client.post("/api/mock-data/generate?seed=42&clear=true")
    print(f"Status: {res.status_code}")
    
    # 2. Run Optimized Schedule
    print("\n2. Running OPTIMIZED Schedule...")
    res_opt = client.post("/api/schedule/run", json={
        "week_start_date": test_date,
        "mode": "optimized"
    })
    print(f"Status: {res_opt.status_code}")
    data_opt = res_opt.json()
    
    # Print a summary of the optimized run instead of the full massive JSON
    summary_opt = {k: v for k, v in data_opt.items() if k not in ("assignments", "explanations")}
    summary_opt["num_assignments"] = len(data_opt.get("assignments", []))
    summary_opt["num_explanations"] = len(data_opt.get("explanations", []))
    print_json("OPTIMIZED RUN SUMMARY", summary_opt)
    
    if data_opt.get("explanations"):
        # Show one scheduled and one unscheduled explanation
        scheduled = [e for e in data_opt["explanations"] if e["status"] == "scheduled"]
        unscheduled = [e for e in data_opt["explanations"] if e["status"] == "unscheduled"]
        
        sample_explanations = []
        if scheduled: sample_explanations.append(scheduled[0])
        if unscheduled: sample_explanations.append(unscheduled[0])
        print_json("SAMPLE EXPLANATIONS (Optimized)", sample_explanations)

    # 3. Run Manual Baseline Schedule
    print("\n3. Running MANUAL Schedule...")
    res_man = client.post("/api/schedule/run", json={
        "week_start_date": test_date,
        "mode": "manual"
    })
    print(f"Status: {res_man.status_code}")
    data_man = res_man.json()
    
    summary_man = {k: v for k, v in data_man.items() if k not in ("assignments", "explanations")}
    summary_man["num_assignments"] = len(data_man.get("assignments", []))
    print_json("MANUAL RUN SUMMARY", summary_man)
    
    # 4. Compare Endpoint
    print("\n4. Fetching Comparison...")
    res_comp = client.get(f"/api/schedule/compare?week_start_date={test_date}")
    print(f"Status: {res_comp.status_code}")
    
    comp_data = res_comp.json()
    comp_summary = {
        "manual_total_hours": comp_data["manual"]["total_hours"] if comp_data.get("manual") else None,
        "optimized_total_hours": comp_data["optimized"]["total_hours"] if comp_data.get("optimized") else None,
        "manual_unscheduled": comp_data["manual"]["unscheduled_count"] if comp_data.get("manual") else None,
        "optimized_unscheduled": comp_data["optimized"]["unscheduled_count"] if comp_data.get("optimized") else None,
    }
    print_json("COMPARISON HIGHLIGHTS", comp_summary)


if __name__ == "__main__":
    main()
