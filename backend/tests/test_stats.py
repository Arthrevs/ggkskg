import pytest

def test_stats_summary(client, session):
    # 1. Generate Mock Data
    client.post("/api/mock-data/generate?seed=42&clear=true")
    
    # 2. Generate Block Windows (so schedule can run)
    client.post("/api/block-windows/generate", json={"week_start_date": "2026-10-05"})

    # 3. Run Optimized Schedule (which produces stats)
    client.post("/api/schedule/run", json={"week_start_date": "2026-10-05", "mode": "optimized"})

    # 4. Fetch Stats
    response = client.get("/api/stats/summary?week_start_date=2026-10-05")
    assert response.status_code == 200
    
    data = response.json()
    assert "totalHoursScheduled" in data
    assert "windowsUsed" in data
    assert "colocatedBlocks" in data
    assert "solverTimeMs" in data
    
    # Should have some department data
    assert len(data["requestsByDepartment"]) > 0
    assert len(data["requestsBySeverity"]) > 0
    assert len(data["departmentWorkload"]) > 0
    assert data["departmentWorkload"][0]["hours"] > 0
