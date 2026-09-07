from datetime import date
from sqlalchemy.orm import Session

from app.models.section import Section
from app.models.block_window import BlockWindow


def generate_weekly_windows(db: Session, week_start_date: date) -> dict:
    """
    Generate standard and mega block windows for a given week based on section configs.
    Ensures duplicate windows are not created.
    """
    sections = db.query(Section).all()
    if not sections:
        return {"windows_created": 0, "section_count": 0, "week": str(week_start_date)}
        
    days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    windows_created = 0
    
    for section in sections:
        for day in days_of_week:
            # Check if it's a mega day
            is_mega = section.mega_day == day
            
            start_minute = section.window_start_hour
            duration_minutes = (section.mega_duration_hours or section.window_duration_hours) if is_mega else section.window_duration_hours
            
            # Skip if invalid config (e.g. mega day but no mega duration)
            if duration_minutes is None or duration_minutes <= 0:
                continue
                
            # Check for duplicates
            existing = db.query(BlockWindow).filter(
                BlockWindow.section_id == section.id,
                BlockWindow.week_start_date == week_start_date,
                BlockWindow.day_of_week == day
            ).first()
            
            if not existing:
                bw = BlockWindow(
                    section_id=section.id,
                    week_start_date=week_start_date,
                    day_of_week=day,
                    start_minute=start_minute,
                    duration_minutes=duration_minutes,
                    slot_capacity=section.slot_capacity
                )
                db.add(bw)
                windows_created += 1
                
    db.commit()
    
    return {
        "windows_created": windows_created,
        "section_count": len(sections),
        "week": str(week_start_date)
    }
