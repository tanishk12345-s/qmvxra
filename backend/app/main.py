from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Any
import os
import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ELEXON_BASE = os.getenv("ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1")
UK = ZoneInfo("Europe/London")
app = FastAPI(title="Wind Forecast Intelligence API", version="1.0.0",
              description="January 2026 wind forecast accuracy analysis using Elexon BMRS data.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

class Summary(BaseModel):
    delivery_periods: int
    forecast_coverage_pct: float
    mae_mw: float | None
    rmse_mw: float | None
    mean_bias_mw: float | None
    mape_pct: float | None
    latest_publication: str | None
    methodology: str

def parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None

def get_rows(dataset: str, start: date, end: date) -> list[dict]:
    """Fetch historical actuals or forecast publications from Elexon."""

    url = f"{ELEXON_BASE}/datasets/{dataset}/stream"

    if dataset == "FUELHH":
        # Actual generation is filtered by settlement date.
        params = {
            "settlementDateFrom": start.isoformat(),
            "settlementDateTo": end.isoformat(),
        }

    elif dataset == "WINDFOR":
        # Fetch forecast versions published from the day before
        # the first delivery date through the end of January.
        # build_analysis() applies the decision-time cut-off later.
        publish_from = datetime.combine(
            start - timedelta(days=1),
            time.min,
            tzinfo=timezone.utc,
        )
        publish_to = datetime.combine(
            end + timedelta(days=1),
            time.min,
            tzinfo=timezone.utc,
        )

        params = {
            "publishDateTimeFrom": publish_from.isoformat().replace(
                "+00:00", "Z"
            ),
            "publishDateTimeTo": publish_to.isoformat().replace(
                "+00:00", "Z"
            ),
        }

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported Elexon dataset: {dataset}",
        )

    try:
        response = requests.get(
            url,
            params=params,
            timeout=45,
        )
        response.raise_for_status()
        payload = response.json()

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Elexon request failed for {dataset}: {exc}",
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Elexon returned invalid JSON for {dataset}",
        ) from exc

    if isinstance(payload, dict):
        payload = payload.get(
            "data",
            payload.get("results", []),
        )

    if not isinstance(payload, list):
        raise HTTPException(
            status_code=502,
            detail=f"Unexpected Elexon response shape for {dataset}",
        )

    return payload

def number(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (ValueError, TypeError):
        return None

def build_analysis(start: date, end: date, cutoff_hour: int = 12) -> dict:
    actual_rows = get_rows("FUELHH", start, end)
    forecast_rows = get_rows("WINDFOR", start, end)

    actuals: dict[str, float] = {}
    for row in actual_rows:
        if str(row.get("fuelType", "")).upper() != "WIND":
            continue
        stamp = parse_dt(row.get("startTime"))
        generation = number(row.get("generation"))
        if stamp and generation is not None:
            actuals[stamp.isoformat()] = generation

    # For each delivery period, choose the newest forecast published before
    # the selected day-ahead cutoff (12:00 UK by default). This is a stated
    # operational proxy, not a claim about the client's exact trading policy.
    candidates: dict[str, list[tuple[datetime, float]]] = {}
    latest_publication: datetime | None = None
    for row in forecast_rows:
        delivery = parse_dt(row.get("startTime"))
        published = parse_dt(row.get("publishTime"))
        generation = number(row.get("generation"))
        if not delivery or not published or generation is None:
            continue
        delivery_local = delivery.astimezone(UK)
        cutoff_local = datetime.combine(
            delivery_local.date() - timedelta(days=1), time(cutoff_hour, 0), tzinfo=UK
        )
        cutoff_utc = cutoff_local.astimezone(timezone.utc)
        if start <= delivery_local.date() <= end and published <= cutoff_utc:
            candidates.setdefault(delivery.isoformat(), []).append((published, generation))
        if latest_publication is None or published > latest_publication:
            latest_publication = published

    points = []
    for stamp, actual in actuals.items():
        versions = candidates.get(stamp, [])
        if not versions:
            continue
        published, forecast = max(versions, key=lambda item: item[0])
        delivery = parse_dt(stamp)
        if not delivery:
            continue
        error = forecast - actual
        points.append({
            "startTime": delivery.astimezone(UK).isoformat(),
            "forecast": round(forecast, 2),
            "actual": round(actual, 2),
            "error": round(error, 2),
            "absoluteError": round(abs(error), 2),
            "publishTime": published.isoformat(),
        })
    points.sort(key=lambda point: point["startTime"])
    if not points:
        return {
            "points": [], "summary": {
                "delivery_periods": 0, "forecast_coverage_pct": 0.0,
                "mae_mw": None, "rmse_mw": None, "mean_bias_mw": None,
                "mape_pct": None, "latest_publication": latest_publication.isoformat() if latest_publication else None,
                "methodology": f"Latest available forecast published by {cutoff_hour:02d}:00 UK time on the day before delivery."
            },
            "message": "No matched actual/forecast periods were returned. Check Elexon availability and date filters."
        }
    errors = [p["error"] for p in points]
    abs_errors = [abs(e) for e in errors]
    actual_values = [p["actual"] for p in points]
    mape_values = [abs(p["error"]) / abs(p["actual"]) * 100 for p in points if p["actual"] != 0]
    # Coverage is based on actual delivery periods that had an eligible forecast.
    coverage = len(points) / max(len(actuals), 1) * 100
    summary = {
        "delivery_periods": len(points),
        "forecast_coverage_pct": round(coverage, 1),
        "mae_mw": round(sum(abs_errors) / len(abs_errors), 2),
        "rmse_mw": round((sum(e * e for e in errors) / len(errors)) ** 0.5, 2),
        "mean_bias_mw": round(sum(errors) / len(errors), 2),
        "mape_pct": round(sum(mape_values) / len(mape_values), 2) if mape_values else None,
        "latest_publication": latest_publication.isoformat() if latest_publication else None,
        "methodology": f"Per delivery period, select the latest WINDFOR publishTime at or before {cutoff_hour:02d}:00 Europe/London on the previous calendar day. Error = forecast − actual. Positive bias means over-forecasting."
    }
    return {"points": points, "summary": summary, "message": None}

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "wind-forecast-intelligence-api"}

@app.get("/api/analysis")
def analysis(
    start: date = Query(default=date(2026, 1, 1)),
    end: date = Query(default=date(2026, 1, 31)),
    cutoff_hour: int = Query(default=12, ge=0, le=23),
):
    if start > end:
        raise HTTPException(status_code=400, detail="start must be on or before end")
    if start < date(2026, 1, 1) or end > date(2026, 1, 31):
        raise HTTPException(status_code=400, detail="This challenge build is scoped to January 2026.")
    if (end - start).days > 30:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 31 calendar days.")
    return build_analysis(start, end, cutoff_hour)
