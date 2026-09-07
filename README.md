# AI-Powered Automatic Block Planning for Indian Railways 🚆

**Smart India Hackathon 2026**
*   **Problem Statement ID:** 26027
*   **Team Name:** Hatsoff
*   **Theme:** Transportation and Logistics

---

## 📖 Overview
Railway maintenance for Engineering, Traction Distribution (TRD), and Signal & Telecommunication (S&T) departments is currently planned independently and manually via the Block Demand Management System (BDMS). This leads to inefficient block utilization, overlapping requests, and suboptimal scheduling, reducing overall asset availability.

This project introduces a **Centralized AI-Powered Scheduling System** that automates maintenance block allocation. By leveraging Google OR-Tools (Constraint Programming), the system mathematically schedules requested maintenance tasks into available block windows, resolving cross-departmental conflicts and maximizing asset availability for train operations.

---

## ✨ Key Features
*   **🤖 AI Constraint Optimization:** Utilizes Google OR-Tools CP-SAT solver to automatically pack tasks into block windows without overlaps or constraint violations.
*   **📊 FCFS vs Optimized Comparison:** Visually proves the effectiveness of the AI by displaying side-by-side KPIs comparing legacy First-Come-First-Serve (FCFS) manual scheduling against the AI-optimized schedule.
*   **🛡️ Conflict Resolution:** Automatically prevents scheduling incompatible tasks (e.g., Track Renewal and Signal Overhaul) in the same block window.
*   **⚡ Priority & Overdue Awareness:** The algorithm prioritizes critical and high-severity tasks, giving extra weight to tasks with high overdue days to ensure safety compliance.
*   **📈 Real-Time KPI Dashboard:** Tracks block utilization percentage, department workload distribution, and scheduled vs unscheduled tasks.

---

## 🛠️ Technology Stack
### Frontend
*   **Framework:** React (Vite)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **Charts:** Recharts
*   **Icons:** Lucide React

### Backend
*   **Framework:** FastAPI
*   **Language:** Python 3.10+
*   **Database:** SQLite (Development) / PostgreSQL (Production)
*   **ORM:** SQLAlchemy with Alembic (Migrations)
*   **AI Engine:** Google OR-Tools (CP-SAT Solver)

---

## 🚀 Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Arthrevs/SIH_2026.git
cd SIH_2026
```

### 2. Backend Setup
```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start the FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*The backend API will be running at `http://localhost:8000`*
*Interactive API Docs: `http://localhost:8000/docs`*

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```
*The React app will be running at `http://localhost:5173`*

---

## 🧠 How the AI Scheduler Works
The core logic resides in `backend/app/services/scheduling/solver.py`. 
1. **Inputs:** The solver ingests all `pending` maintenance requests across all departments, alongside the available `block_windows` for the selected week.
2. **Constraints:** 
   * A task must fit entirely within a single block window.
   * Total duration of assigned tasks in a window cannot exceed the window's capacity.
   * Explicit compatibility rules (e.g., Department A and Department B cannot work simultaneously on the same section) are enforced.
3. **Objective Function:** The solver's goal is to maximize the mathematical score of assigned tasks. Critical tasks and long-overdue tasks carry significantly higher weights, ensuring they are placed into blocks first.
4. **Output:** The solver returns the optimal combination of tasks-to-windows within a predefined time limit (e.g., 5 seconds).

---

## 📜 References
*   [Google OR-Tools: CP-SAT Solver](https://developers.google.com/optimization/cp)
*   [FastAPI Documentation](https://fastapi.tiangolo.com/)
*   [Indian Railways Track Management System (TMS)](https://cris.org.in/crisweb/design1/Civil_Engineering.jsp)
