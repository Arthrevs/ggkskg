"""Block window generation — creates BlockWindow rows for a given week.

Each section gets one nightly window per day (7 total), plus an optional
mega-block window on the configured day.
"""

import datetime as dt

from sqlalchemy.orm import Session

from app.models.section import Section
from app.models.block_window import BlockWindow

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def generate_block_windows(db: Session, week_start_date: dt.date) -> list[BlockWindow]:
    """
    Generate block windows for every section for the given week.

    If windows already exist for this week, returns the existing ones.
    """
    # Check if windows already exist for this week
    existing = (
        db.query(BlockWindow)
        .filter(BlockWindow.week_start_date == week_start_date)
        .first()
    )
    if existing:
        return (
            db.query(BlockWindow)
            .filter(BlockWindow.week_start_date == week_start_date)
            .all()
        )

    sections = db.query(Section).all()
    windows: list[BlockWindow] = []

    for section in sections:
        for day_index, day_name in enumerate(DAYS):
            # Normal nightly window
            window = BlockWindow(
                section_id=section.id,
                week_start_date=week_start_date,
                day_of_week=day_name,
                start_hour=section.window_start_hour,
                duration_hours=section.window_duration_hours,
                slot_capacity=section.slot_capacity,
            )
            db.add(window)
            windows.append(window)

            # Mega block on the configured day
            if (
                section.mega_day
                and section.mega_day == day_name
                and section.mega_duration_hours
            ):
                mega = BlockWindow(
                    section_id=section.id,
                    week_start_date=week_start_date,
                    day_of_week=day_name,
                    start_hour=section.window_start_hour,
                    duration_hours=section.mega_duration_hours,
                    slot_capacity=section.slot_capacity,
                )
                db.add(mega)
                windows.append(mega)

    db.commit()
    for w in windows:
        db.refresh(w)

    return windows
