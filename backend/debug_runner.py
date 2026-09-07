from app.db.database import SessionLocal
from app.services.scheduling.runner import run_schedule
from datetime import date, timedelta
import traceback

def main():
    today = date.today()
    days_ahead = 0 - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    next_monday = today + timedelta(days=days_ahead)
    
    db = SessionLocal()
    try:
        run_schedule(db, next_monday, "optimized")
        print("Success")
    except Exception as e:
        traceback.print_exc()

if __name__ == "__main__":
    main()
