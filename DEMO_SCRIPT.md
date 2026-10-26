# Demo video script (maximum 10 minutes)

Record the application in a clean browser window. Keep the two parts clearly separated. Use the real running app and actual API response; do not narrate sample numbers that are not visible in the dashboard.

## Part 1 — Customer overview (target: 4–5 minutes)

### 0:00–0:40 — Context
"Day-ahead buying decisions have to be made before delivery, while wind output remains weather-dependent. This pilot brings the available national wind forecast and actual generation into one place, so the team can quantify forecast uncertainty instead of reviewing the forecast in isolation."

### 0:40–1:30 — Data and scope
"This view is deliberately scoped to January 2026 and national wind generation, using the two Elexon datasets requested in the brief: FUELHH for actual output and WINDFOR for forecast publications. The dashboard matches records at the half-hourly delivery-period level."

### 1:30–2:30 — Headline metrics
"MAE shows the typical absolute error in MW. RMSE gives larger misses more weight. Mean bias shows direction: positive means the forecast was higher than actual generation; negative means it was lower. Coverage tells us how much of the actual dataset could be compared with an eligible forecast. These values should be interpreted together."

Read the numbers from the live dashboard. If data has not loaded, fix the integration before recording rather than inventing results.

### 2:30–3:30 — Forecast comparison
"The main chart overlays the selected forecast and actual generation. The date selector lets us inspect a single delivery day. The error chart makes over- and under-forecasting easier to spot. The table exposes each selected forecast's publication timestamp so an analyst can audit the comparison."

Demonstrate selecting a date and hovering over chart points.

### 3:30–4:30 — Procurement relevance and limits
"A persistent bias or large errors can inform how the team assesses uncertainty and flexible procurement needs. This is decision support, not an automated trading recommendation. This pilot uses a configurable noon UK-time previous-day cut-off because the brief does not define the utility's actual trading cut-off. The team's real policy should replace this assumption."

### 4:30–5:00 — Close
"The outcome is a repeatable view of forecast accuracy, publication timing and delivery-period detail. The CSV export supports further audit and analysis."

## Part 2 — Technical review / knowledge transfer (target: 4–5 minutes)

### 5:00–5:45 — Architecture
"The React and Vite frontend calls a small FastAPI service. The service retrieves Elexon records, normalises timestamps, applies the day-ahead publication cut-off, matches forecast and actual delivery periods, then returns metrics and time-series points. Docker Compose runs both services locally."

### 5:45–6:45 — Data pipeline
"FUELHH is filtered to WIND. WINDFOR retains its publishTime as well as startTime. For each delivery period, we choose the latest publication at or before the selected cut-off. That avoids look-ahead bias from a forecast published after the procurement decision."

Open `backend/app/main.py` and show `get_rows`, `build_analysis`, and the `error = forecast - actual` calculation.

### 6:45–7:30 — Metrics and assumptions
"MAE is the mean absolute forecast error; RMSE is the square root of mean squared error; bias is the mean signed error; MAPE excludes zero-actual periods. Forecast coverage is compared with the returned actual periods. The chosen cut-off is configurable and explicitly described as a proxy assumption."

### 7:30–8:15 — Frontend
"App.jsx owns the loading state, error display, cut-off selection, date filtering and CSV export. Recharts renders the generation and error series. The interface avoids fabricated fallback metrics: if the upstream API fails, it shows an error state."

### 8:15–9:00 — Operations and tests
"FastAPI exposes `/api/health` and `/api/analysis`. The backend has a Dockerfile; the frontend is built as static assets and served by Nginx. A smoke test covers the health route. The README documents local startup, environment variables and a two-service deployment."

### 9:00–10:00 — Honest limitations and next steps
"Before production use, I would validate the live response schemas and query boundaries, test the entire January data set, independently recalculate a sample of periods, confirm the team's actual decision cut-off, add caching and rate-limit handling, and expand tests for missing data and duplicate publications. I would then deploy the API and frontend, verify CORS and public access in an incognito window, and share the live URL."

## Recording checklist

- Record the customer overview first and technical review second.
- Keep the combined video at or under 10 minutes.
- Use the live deployed URL only after verifying it in an incognito window.
- Keep browser credentials, API keys and personal accounts out of the recording.
- Upload to YouTube as **Unlisted** and test the video URL while signed out.
