# GGK/SKG Maintenance Request API Backend

This is the backend implementation for the Indian Railways Maintenance Scheduling Optimizer (GGK/SKG).

## Mock Data Generation

To quickly set up testing or demonstration scenarios, a deterministic mock data generator is included.

### Endpoint
`POST /api/mock-data/generate`

**Query Parameters:**
- `seed` (int, default=26027): Controls the deterministic random generation sequence. Passing the same seed guarantees the exact same logical dataset is produced.
- `clear` (bool, default=true): Safely clears out existing mock data (Maintenance Requests and Block Windows) before generating new ones.

**Distributions:**
The generator produces synthetic scenarios that match standard operational distributions:
- **Severity**: ~50% Low, 30% Medium, 15% High, 5% Critical.
- **Overdue**: Most low/medium tasks are not overdue. Higher severity requests vary in overdue days.
- **Durations**: Standardized to multiples of 30 minutes (30m to 3hr max).
- **Block Windows**: Generates 2-4 generic block windows per section for the upcoming week, naturally factoring in section-specific Mega Block constraints.

*Disclaimer: All distributions and capacities are synthetic demo assumptions and do not represent real-world Indian Railway statistics.*

### Usage Example
```bash
# Generate deterministic data
curl -X POST "http://localhost:8000/api/mock-data/generate?seed=26027&clear=true"
```
