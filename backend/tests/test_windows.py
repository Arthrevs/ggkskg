import pytest
from app.models.section import Section
from app.models.block_window import BlockWindow


def test_generate_block_windows_normal_and_mega(client, session):
    # Setup sections
    sec1 = Section(code="BW-SEC-1", name="Normal Section", window_start_hour=60, window_duration_hours=180, slot_capacity=3)
    sec2 = Section(code="BW-SEC-2", name="Mega Section", window_start_hour=60, window_duration_hours=180, slot_capacity=3, mega_day="Wednesday", mega_duration_hours=360)
    # Invalid section config for mega block (has mega_day but no mega_duration_hours)
    sec3 = Section(code="BW-SEC-3", name="Invalid Mega Section", window_start_hour=60, window_duration_hours=180, slot_capacity=3, mega_day="Friday", mega_duration_hours=None)
    
    session.add_all([sec1, sec2, sec3])
    session.commit()
    
    response = client.post("/api/block-windows/generate", json={"week_start_date": "2026-10-05"})
    assert response.status_code == 201
    
    data = response.json()
    assert data["week"] == "2026-10-05"
    assert data["section_count"] >= 3
    
    # Check generated windows
    windows = session.query(BlockWindow).filter(BlockWindow.week_start_date == "2026-10-05").all()
    
    # Normal section should have 7 windows of 180 min
    sec1_windows = [w for w in windows if w.section_id == sec1.id]
    assert len(sec1_windows) == 7
    assert all(w.duration_minutes == 180 for w in sec1_windows)
    
    # Mega section should have 6 windows of 180 min, and 1 window of 360 min on Wednesday
    sec2_windows = [w for w in windows if w.section_id == sec2.id]
    assert len(sec2_windows) == 7
    mega_windows = [w for w in sec2_windows if w.day_of_week == "Wednesday"]
    assert len(mega_windows) == 1
    assert mega_windows[0].duration_minutes == 360
    
    # Invalid mega section should have 7 normal windows, falling back to window_duration_hours on Friday
    sec3_windows = [w for w in windows if w.section_id == sec3.id]
    assert len(sec3_windows) == 7
    friday_windows = [w for w in sec3_windows if w.day_of_week == "Friday"]
    assert len(friday_windows) == 1
    assert friday_windows[0].duration_minutes == 180


def test_generate_block_windows_no_duplicates(client, session):
    # Call generate twice for the same week
    res1 = client.post("/api/block-windows/generate", json={"week_start_date": "2026-10-12"})
    assert res1.status_code == 201
    count1 = res1.json()["windows_created"]
    assert count1 > 0
    
    res2 = client.post("/api/block-windows/generate", json={"week_start_date": "2026-10-12"})
    assert res2.status_code == 201
    count2 = res2.json()["windows_created"]
    
    # The second call should create 0 new windows because they already exist
    assert count2 == 0
