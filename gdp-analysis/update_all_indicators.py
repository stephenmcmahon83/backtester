"""
Unified Economic Indicators Data Updater
Fetches ALL economic indicators (including GDP) from FRED + SPY prices.
Uploads to single Supabase table: economic_indicators_analysis

Indicators:
- GDP (Quarterly) - compared to ZERO (positive vs negative)
- CPI, Unemployment, Industrial Production, Fed Funds, Retail Sales, Sentiment
  - All compared to PRIOR reading (above vs below)

Run: python update_all_indicators.py
"""

import os
import requests
import pandas as pd
import yfinance as yf
from datetime import datetime
from supabase import create_client, Client
from typing import Optional
from dotenv import load_dotenv
from pathlib import Path

# ============ LOAD ENVIRONMENT VARIABLES ============
script_dir = Path(__file__).parent.resolve()
env_path = script_dir / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
FRED_API_KEY = os.getenv("FRED_API_KEY")

# Validate env vars
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY in .env file")
if not FRED_API_KEY:
    raise ValueError("Missing FRED_API_KEY in .env file")

# ============ CONSTANTS ============
COMMISSION_PCT = 0.10  # 0.10% round-trip commission

TRADING_DAYS = {
    "3d": 3,
    "1w": 5,
    "1m": 21,
    "2m": 42,
    "3m": 63,
}

# ============ INDICATOR CONFIGURATIONS ============
# comparison_type: "prior" = compare to previous reading, "zero" = compare to 0
# frequency: "monthly" or "quarterly"

INDICATORS = {
    "GDP": {
        "series_id": "A191RL1Q225SBEA",
        "name": "GDP Growth (Quarterly)",
        "frequency": "quarterly",
        "comparison_type": "zero",  # Positive vs Negative GDP
        "release_day_estimate": 28,  # ~28 days after quarter end
        "description": "Real GDP % change (QoQ, annualized)",
    },
    "CPI": {
        "series_id": "CPIAUCSL",
        "name": "CPI Inflation (Consumer Price Index)",
        "frequency": "monthly",
        "comparison_type": "prior",
        "release_day_estimate": 13,
        "description": "Measures inflation - change in consumer prices",
    },
    "UNEMPLOYMENT": {
        "series_id": "UNRATE",
        "name": "Unemployment Rate",
        "frequency": "monthly",
        "comparison_type": "prior",
        "release_day_estimate": 5,
        "description": "Percentage of labor force unemployed",
    },
    "INDPRO": {
        "series_id": "INDPRO",
        "name": "Industrial Production Index",
        "frequency": "monthly",
        "comparison_type": "prior",
        "release_day_estimate": 15,
        "description": "Real output of manufacturing, mining, utilities",
    },
    "FEDFUNDS": {
        "series_id": "FEDFUNDS",
        "name": "Federal Funds Rate",
        "frequency": "monthly",
        "comparison_type": "prior",
        "release_day_estimate": 1,
        "description": "Overnight interbank lending rate",
    },
    "RETAIL": {
        "series_id": "RSAFS",
        "name": "Retail Sales",
        "frequency": "monthly",
        "comparison_type": "prior",
        "release_day_estimate": 15,
        "description": "Total retail and food services sales",
    },
    "SENTIMENT": {
        "series_id": "UMCSENT",
        "name": "Consumer Sentiment (U of Michigan)",
        "frequency": "monthly",
        "comparison_type": "prior",
        "release_day_estimate": 15,
        "description": "University of Michigan Consumer Sentiment Index",
    },
}


# ============ HELPER FUNCTIONS ============

def get_trading_day_price(df: pd.DataFrame, target_date: pd.Timestamp) -> tuple[Optional[float], Optional[pd.Timestamp]]:
    """Get SPY closing price on or after target date."""
    try:
        future_dates = df[df.index >= target_date]
        if not future_dates.empty:
            actual_date = future_dates.index[0]
            return float(future_dates.iloc[0]['Close']), actual_date
        return None, None
    except:
        return None, None


def get_price_n_days_forward(df: pd.DataFrame, start_date: pd.Timestamp, days: int) -> Optional[float]:
    """Get closing price N trading days after start_date."""
    try:
        future_dates = df[df.index >= start_date]
        if len(future_dates) > days:
            return float(future_dates.iloc[days]['Close'])
        return None
    except:
        return None


def calculate_return_with_commission(entry_price: float, exit_price: Optional[float]) -> Optional[float]:
    """Calculate return percentage with commission deducted."""
    if exit_price is None or entry_price is None or entry_price == 0:
        return None
    raw_return = (exit_price - entry_price) / entry_price * 100
    net_return = raw_return - COMMISSION_PCT
    return round(net_return, 2)


def estimate_monthly_release_date(period_date: str, release_day: int) -> str:
    """
    Estimate release date for MONTHLY indicators.
    Data for month M is typically released in month M+1.
    """
    period_dt = pd.Timestamp(period_date)
    
    if period_dt.month == 12:
        release_month = 1
        release_year = period_dt.year + 1
    else:
        release_month = period_dt.month + 1
        release_year = period_dt.year
    
    try:
        release = pd.Timestamp(year=release_year, month=release_month, day=release_day)
    except:
        release = pd.Timestamp(year=release_year, month=release_month, day=28)
    
    return release.strftime("%Y-%m-%d")


def estimate_quarterly_release_date(period_date: pd.Timestamp) -> str:
    """
    Estimate release date for QUARTERLY (GDP) data.
    GDP for quarter ending month M is released ~28 days after quarter end.
    """
    quarter_end_month = ((period_date.month - 1) // 3 + 1) * 3
    
    if quarter_end_month == 12:
        release_year = period_date.year + 1
        release_month = 1
    else:
        release_year = period_date.year
        release_month = quarter_end_month + 1
    
    try:
        return pd.Timestamp(year=release_year, month=release_month, day=28).strftime("%Y-%m-%d")
    except:
        return pd.Timestamp(year=release_year, month=release_month, day=25).strftime("%Y-%m-%d")


def fetch_fred_data(series_id: str) -> list[dict]:
    """Fetch data from FRED API."""
    url = "https://api.stlouisfed.org/fred/series/observations"
    
    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": "1993-01-01",
        "sort_order": "asc",
    }
    
    response = requests.get(url, params=params)
    
    if response.status_code != 200:
        print(f"      ⚠ FRED API error for {series_id}: {response.status_code}")
        raise Exception(f"FRED API error: {response.status_code}")
    
    data = response.json()
    observations = data.get("observations", [])
    
    results = []
    for obs in observations:
        period_date = obs.get("date")
        value = obs.get("value")
        
        if value == "." or value is None:
            continue
            
        try:
            results.append({
                "period_date": period_date,
                "value": float(value)
            })
        except ValueError:
            continue
    
    return results


def process_indicator(indicator_code: str, config: dict, spy_hist: pd.DataFrame) -> list[dict]:
    """Process a single indicator and generate records."""
    print(f"\n   Processing {indicator_code} ({config['name']})...")
    
    # Fetch data from FRED
    try:
        raw_data = fetch_fred_data(config["series_id"])
    except Exception as e:
        print(f"      ⚠ Failed to fetch {indicator_code}: {e}")
        return []
    
    print(f"      ✓ Got {len(raw_data)} observations from FRED")
    
    if len(raw_data) < 2:
        print(f"      ⚠ Not enough data points")
        return []
    
    records = []
    skipped = 0
    
    is_quarterly = config["frequency"] == "quarterly"
    compare_to_zero = config["comparison_type"] == "zero"
    
    # Start from index 1 for "prior" comparison, index 0 for "zero" comparison
    start_index = 0 if compare_to_zero else 1
    
    for i in range(start_index, len(raw_data)):
        try:
            current = raw_data[i]
            period_date = current["period_date"]
            current_value = current["value"]
            
            # Determine previous_value and direction based on comparison type
            if compare_to_zero:
                # Compare to zero (e.g., GDP: positive vs negative)
                previous_value = 0.0
                if current_value > 0:
                    direction = "ABOVE"
                elif current_value < 0:
                    direction = "BELOW"
                else:
                    direction = "UNCHANGED"
            else:
                # Compare to prior reading
                prior = raw_data[i - 1]
                previous_value = prior["value"]
                if current_value > previous_value:
                    direction = "ABOVE"
                elif current_value < previous_value:
                    direction = "BELOW"
                else:
                    direction = "UNCHANGED"
            
            value_change = current_value - previous_value
            
            # Estimate release date
            period_dt = pd.Timestamp(period_date)
            if is_quarterly:
                release_date_str = estimate_quarterly_release_date(period_dt)
            else:
                release_date_str = estimate_monthly_release_date(period_date, config["release_day_estimate"])
            
            release_dt = pd.Timestamp(release_date_str)
            
            # Get SPY prices
            spy_on_release, actual_trade_date = get_trading_day_price(spy_hist, release_dt)
            
            if spy_on_release is None or actual_trade_date is None:
                skipped += 1
                continue
            
            # Get forward prices
            spy_3d = get_price_n_days_forward(spy_hist, actual_trade_date, TRADING_DAYS["3d"])
            spy_1w = get_price_n_days_forward(spy_hist, actual_trade_date, TRADING_DAYS["1w"])
            spy_1m = get_price_n_days_forward(spy_hist, actual_trade_date, TRADING_DAYS["1m"])
            spy_2m = get_price_n_days_forward(spy_hist, actual_trade_date, TRADING_DAYS["2m"])
            spy_3m = get_price_n_days_forward(spy_hist, actual_trade_date, TRADING_DAYS["3m"])
            
            # Calculate returns
            ret_3d = calculate_return_with_commission(spy_on_release, spy_3d)
            ret_1w = calculate_return_with_commission(spy_on_release, spy_1w)
            ret_1m = calculate_return_with_commission(spy_on_release, spy_1m)
            ret_2m = calculate_return_with_commission(spy_on_release, spy_2m)
            ret_3m = calculate_return_with_commission(spy_on_release, spy_3m)
            
            records.append({
                "indicator_code": indicator_code,
                "indicator_name": config["name"],
                "release_date": actual_trade_date.strftime("%Y-%m-%d"),
                "period_date": period_date,
                "current_value": round(current_value, 3),
                "previous_value": round(previous_value, 3),
                "change_direction": direction,
                "value_change": round(value_change, 3),
                "spy_on_release": round(spy_on_release, 2),
                "spy_3d": round(spy_3d, 2) if spy_3d else None,
                "spy_1w": round(spy_1w, 2) if spy_1w else None,
                "spy_1m": round(spy_1m, 2) if spy_1m else None,
                "spy_2m": round(spy_2m, 2) if spy_2m else None,
                "spy_3m": round(spy_3m, 2) if spy_3m else None,
                "return_3d": ret_3d,
                "return_1w": ret_1w,
                "return_1m": ret_1m,
                "return_2m": ret_2m,
                "return_3m": ret_3m,
                "updated_at": datetime.now().isoformat(),
            })
            
        except Exception as e:
            skipped += 1
            continue
    
    print(f"      ✓ Processed {len(records)} records, skipped {skipped}")
    
    # Show breakdown
    above_count = sum(1 for r in records if r["change_direction"] == "ABOVE")
    below_count = sum(1 for r in records if r["change_direction"] == "BELOW")
    unchanged_count = sum(1 for r in records if r["change_direction"] == "UNCHANGED")
    
    if compare_to_zero:
        print(f"      ✓ Positive: {above_count}, Negative: {below_count}, Zero: {unchanged_count}")
    else:
        print(f"      ✓ Above prior: {above_count}, Below prior: {below_count}, Unchanged: {unchanged_count}")
    
    return records


def main():
    print("=" * 70)
    print("UNIFIED Economic Indicators Data Updater")
    print(f"Commission per trade: {COMMISSION_PCT}%")
    print(f"Indicators: {', '.join(INDICATORS.keys())}")
    print("=" * 70)
    
    # Initialize Supabase
    print("\n1. Connecting to Supabase...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("   ✓ Connected")
    
    # Fetch SPY data
    print("\n2. Fetching SPY price history...")
    spy = yf.Ticker("SPY")
    spy_hist = spy.history(start="1993-01-01", end=datetime.now().strftime("%Y-%m-%d"))
    
    if spy_hist.index.tz is not None:
        spy_hist.index = spy_hist.index.tz_localize(None)
    
    print(f"   ✓ Got SPY data: {spy_hist.index[0].date()} to {spy_hist.index[-1].date()}")
    
    # Process ALL indicators
    print("\n3. Processing all indicators...")
    all_records = []
    
    for indicator_code, config in INDICATORS.items():
        records = process_indicator(indicator_code, config, spy_hist)
        all_records.extend(records)
    
    print(f"\n   ═══════════════════════════════════")
    print(f"   Total records to upload: {len(all_records)}")
    print(f"   ═══════════════════════════════════")
    
    # Upload to Supabase
    print("\n4. Uploading to Supabase...")
    
    success_count = 0
    error_count = 0
    
    batch_size = 100
    for i in range(0, len(all_records), batch_size):
        batch = all_records[i:i + batch_size]
        try:
            supabase.table("economic_indicators_analysis").upsert(
                batch,
                on_conflict="indicator_code,period_date"
            ).execute()
            success_count += len(batch)
            print(f"   ✓ Uploaded batch {i//batch_size + 1} ({len(batch)} records)")
        except Exception as e:
            print(f"   ⚠ Error uploading batch: {e}")
            for record in batch:
                try:
                    supabase.table("economic_indicators_analysis").upsert(
                        record,
                        on_conflict="indicator_code,period_date"
                    ).execute()
                    success_count += 1
                except Exception as e2:
                    error_count += 1
    
    print(f"\n   ✓ Uploaded {success_count} records total")
    if error_count > 0:
        print(f"   ⚠ {error_count} errors")
    
    # Verify all indicators
    print("\n5. Verification Summary:")
    print("   ┌────────────────┬──────────┐")
    print("   │ Indicator      │ Records  │")
    print("   ├────────────────┼──────────┤")
    
    total_in_db = 0
    for indicator_code in INDICATORS.keys():
        result = supabase.table("economic_indicators_analysis").select("*", count="exact").eq("indicator_code", indicator_code).execute()
        count = len(result.data)
        total_in_db += count
        print(f"   │ {indicator_code:<14} │ {count:>8} │")
    
    print("   ├────────────────┼──────────┤")
    print(f"   │ {'TOTAL':<14} │ {total_in_db:>8} │")
    print("   └────────────────┴──────────┘")
    
    print("\n" + "=" * 70)
    print("✓ Update complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()