# Wind Forecast Intelligence

A small full-stack pilot dashboard for UK day-ahead electricity procurement teams. It compares national wind generation forecasts with actual generation using Elexon BMRS data, scoped to January 2026.

## What it does

- Fetches `FUELHH` actual generation and filters to `fuelType == "WIND"`.
- Fetches `WINDFOR` forecast publications.
- For each delivery period, selects the latest forecast published by a configurable day-ahead cut-off (default 12:00 UK time on the previous calendar day).
- Matches forecasts and actuals by `startTime`.
- Calculates MAE, RMSE, mean bias, MAPE and forecast coverage.
- Displays the matched time series, forecast error profile and delivery-period table.
- Exports the currently selected data as CSV.

## Important methodology note

The brief does not specify the team's exact trading cut-off. The dashboard uses **12:00 Europe/London on the preceding calendar day** as an explicit, adjustable proxy, not as a claim about the utility's actual trading policy. The forecast chosen for a delivery period is the most recent `publishTime` at or before that cut-off. This is essential to avoid using a forecast that was published after the purchase decision.

`error = forecast - actual`; positive mean bias means over-forecasting. MAE and RMSE are in MW. MAPE excludes periods where actual generation is zero. Coverage is the share of actual periods that have a qualifying forecast.

The API uses Elexon's documented stream endpoints:
- [FUELHH actuals](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream)
- [WINDFOR forecasts](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream)

API response shape and historical data availability can change. The backend handles common array/envelope responses and reports upstream errors rather than filling the dashboard with made-up values. Before presenting results, verify January 2026 record coverage and the endpoint's timezone/filter semantics against the live API.

## Stack

- Frontend: React, Vite, Recharts, Lucide
- Backend: Python 3.12, FastAPI, Requests
- Containers: Docker and Docker Compose
- Data source: Elexon BMRS only

## Run locally

### Option A — Docker Compose

Requires Docker Desktop / Docker Engine.

```bash
docker compose up --build
```

Open:
- Frontend: http://localhost:8080
- API health: http://localhost:8000/api/health
- Interactive API docs: http://localhost:8000/docs

Stop with `Ctrl+C`, then run `docker compose down`.

### Option B — Run services separately

Backend:

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend, in another terminal:

```bash
cd frontend
npm install
# Windows PowerShell:
$env:VITE_API_URL="http://localhost:8000"
# macOS/Linux:
export VITE_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:5173.

## Environment variables

| Variable | Service | Default | Purpose |
|---|---|---|---|
| `ELEXON_BASE_URL` | API | `https://data.elexon.co.uk/bmrs/api/v1` | Override upstream base URL |
| `CORS_ORIGINS` | API | `*` | Comma-separated allowed origins |
| `VITE_API_URL` | Frontend build | `http://localhost:8000` | Public URL of deployed API |

The frontend's API URL is embedded at build time. Set `VITE_API_URL` to the deployed backend's HTTPS URL before building the frontend image.

## Deployment

This is a two-service application. Deploy the Python API and React static site separately, then set the frontend's `VITE_API_URL` to the public API URL.

### Suggested low-friction setup
1. Deploy `backend/` as a Python web service on Render or another Docker-capable host, using `backend/Dockerfile` (start command is already defined).
2. Deploy `frontend/` to Vercel as a Vite project with root directory `frontend` and build command `npm run build`. Add `VITE_API_URL=https://YOUR-API-HOST` in project environment variables.
3. Set backend `CORS_ORIGINS` to the exact deployed frontend origin.
4. Redeploy frontend after setting the environment variable.
5. Open the public frontend URL in a private/incognito browser and verify the chart, metrics, table, API health endpoint and CSV export.

The assignment asks for a live Vercel or Heroku link. This repository is deployment-ready, but a public deployment still requires your hosting account and must be verified after deployment. Do not submit a placeholder URL.

## Repository layout

```text
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py             # Elexon ingestion, matching and metrics API
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Dashboard and user interactions
│   │   ├── main.jsx            # React entry point
│   │   └── styles.css          # Responsive visual system
│   ├── index.html
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .gitignore
└── README.md
```

## API

`GET /api/analysis?start=2026-01-01&end=2026-01-31&cutoff_hour=12`

Returns `points` (matched periods), `summary` (metrics) and an optional `message`. Dates outside January 2026 are rejected to keep the challenge scope explicit.

`GET /api/health`

## AI assistance disclosure

AI tools were used as a development aid for scaffolding, code drafting and documentation. The data-selection methodology, API behaviour, results and deployment should be reviewed and tested by the developer before submission. Do not claim that unverified data or a deployment has been validated.

## Before submitting

- [ ] Run the backend and verify `/api/health`.
- [ ] Run the analysis endpoint and inspect returned row counts and timestamps.
- [ ] Confirm the selected forecast publication is never later than the configured decision cut-off.
- [ ] Check metrics independently on a small sample.
- [ ] Run the frontend and test day filtering and CSV export.
- [ ] Build with Docker Compose.
- [ ] Deploy and test the public app in an incognito window.
- [ ] Create a public GitHub repository with a non-identifying repository name.
- [ ] Record the requested demo video (customer overview + technical review, maximum 10 minutes).
- [ ] Replace all deployment instructions with the actual live URL in the submission details.
