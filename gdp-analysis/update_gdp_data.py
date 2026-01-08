"""
GDP Data Updater
Fetches GDP data from FRED + SPY prices, uploads to Supabase.
Uses actual release dates where available, estimates for older data.
Includes 0.10% commission deduction per round-trip trade.

Setup:
1. Create a .env file in the same folder as this script
2. pip install supabase requests pandas yfinance python-dotenv
3. Run: python update_gdp_data.py
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

# Commission per round-trip trade (0.10%)
COMMISSION_PCT = 0.10

# Trading days for each holding period
TRADING_DAYS = {
    "3d": 3,
    "1w": 5,
    "1m": 21,
    "2m": 42,
    "3m": 63,
}

# Validate env vars
if not SUPABASE_URL or not SUPABASE_KEY:
    print(f"Looking for .env file at: {env_path}")
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY in .env file")
if not FRED_API_KEY:
    raise ValueError("Missing FRED_API_KEY in .env file")

# ============ HELPERS ============

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


def estimate_release_date(period_date: str) -> str:
    """
    Estimate GDP release date based on standard BEA schedule.
    GDP Advance Estimate is typically released:
    - Q1 (Jan-Mar) → Released late April (~April 25-30)
    - Q2 (Apr-Jun) → Released late July (~July 25-30)
    - Q3 (Jul-Sep) → Released late October (~Oct 25-30)
    - Q4 (Oct-Dec) → Released late January next year (~Jan 25-30)
    """
    period_dt = pd.Timestamp(period_date)
    year = period_dt.year
    month = period_dt.month
    
    if month == 1:  # Q1 data (period starts Jan 1)
        release = pd.Timestamp(year=year, month=4, day=28)
    elif month == 4:  # Q2 data (period starts Apr 1)
        release = pd.Timestamp(year=year, month=7, day=28)
    elif month == 7:  # Q3 data (period starts Jul 1)
        release = pd.Timestamp(year=year, month=10, day=28)
    else:  # Q4 data (period starts Oct 1)
        release = pd.Timestamp(year=year + 1, month=1, day=28)
    
    return release.strftime("%Y-%m-%d")


def fetch_gdp_with_actual_release_dates() -> dict:
    """
    Fetch GDP data with actual release dates from FRED vintage database.
    Returns a dict mapping period_date -> (gdp_value, release_date)
    """
    url = "https://api.stlouisfed.org/fred/series/observations"
    
    params = {
        "series_id": "A191RL1Q225SBEA",
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": "1990-01-01",
        "output_type": "4",  # Initial release only
        "realtime_start": "1990-01-01",
        "realtime_end": datetime.now().strftime("%Y-%m-%d"),
        "sort_order": "desc",
    }
    
    response = requests.get(url, params=params)
    
    if response.status_code != 200:
        print(f"   ⚠ FRED vintage API error: {response.status_code}")
        return {}
    
    data = response.json()
    observations = data.get("observations", [])
    
    result = {}
    for obs in observations:
        period_date = obs.get("date")
        gdp_value = obs.get("value")
        release_date = obs.get("realtime_start")
        
        if gdp_value == "." or gdp_value is None:
            continue
        
        result[period_date] = {
            "gdp_value": float(gdp_value),
            "release_date": release_date,
            "is_actual_date": True
        }
    
    return result


def fetch_all_gdp_data() -> list[dict]:
    """
    Fetch all GDP data from FRED (current values).
    Used to get the full history, then we'll add release dates.
    """
    url = "https://api.stlouisfed.org/fred/series/observations"
    
    params = {
        "series_id": "A191RL1Q225SBEA",
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": "1990-01-01",
        "sort_order": "desc",
    }
    
    response = requests.get(url, params=params)
    
    if response.status_code != 200:
        raise Exception(f"FRED API error: {response.status_code}")
    
    data = response.json()
    observations = data.get("observations", [])
    
    results = []
    for obs in observations:
        period_date = obs.get("date")
        gdp_value = obs.get("value")
        
        if gdp_value == "." or gdp_value is None:
            continue
            
        results.append({
            "period_date": period_date,
            "gdp_value": float(gdp_value)
        })
    
    return results


def main():
    print("=" * 60)
    print("GDP Data Updater (Extended History)")
    print(f"Commission per trade: {COMMISSION_PCT}%")
    print(f"Holding periods: 3D, 1W, 1M, 2M, 3M")
    print("=" * 60)
    
    # Initialize Supabase client
    print("\n1. Connecting to Supabase...")
    print(f"   URL: {SUPABASE_URL[:35]}...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("   ✓ Connected")
    
    # Fetch GDP data with actual release dates (where available)
    print("\n2. Fetching GDP data from FRED...")
    print("   a) Getting actual release dates (vintage database)...")
    actual_release_data = fetch_gdp_with_actual_release_dates()
    print(f"      ✓ Got {len(actual_release_data)} records with actual release dates")
    
    print("   b) Getting full GDP history...")
    all_gdp_data = fetch_all_gdp_data()
    print(f"      ✓ Got {len(all_gdp_data)} total GDP observations")
    
    # Merge: use actual release dates where available, estimate for older data
    print("   c) Merging data (actual dates + estimated dates)...")
    merged_data = []
    actual_count = 0
    estimated_count = 0
    
    for item in all_gdp_data:
        period_date = item["period_date"]
        
        if period_date in actual_release_data:
            merged_data.append({
                "period_date": period_date,
                "release_date": actual_release_data[period_date]["release_date"],
                "gdp_value": actual_release_data[period_date]["gdp_value"],
                "is_actual_date": True
            })
            actual_count += 1
        else:
            merged_data.append({
                "period_date": period_date,
                "release_date": estimate_release_date(period_date),
                "gdp_value": item["gdp_value"],
                "is_actual_date": False
            })
            estimated_count += 1
    
    print(f"      ✓ {actual_count} with actual dates, {estimated_count} with estimated dates")
    
    # Fetch SPY data
    print("\n3. Fetching SPY price history...")
    spy = yf.Ticker("SPY")
    spy_hist = spy.history(start="1993-01-01", end=datetime.now().strftime("%Y-%m-%d"))
    
    if spy_hist.index.tz is not None:
        spy_hist.index = spy_hist.index.tz_localize(None)
    
    print(f"   ✓ Got SPY data: {spy_hist.index[0].date()} to {spy_hist.index[-1].date()}")
    
    # Filter GDP data to only include periods where SPY data exists
    spy_start_date = spy_hist.index[0]
    
    # Process and prepare records
    print("\n4. Processing data...")
    records = []
    skipped_no_spy = 0
    
    for item in merged_data:
        try:
            period_date = item["period_date"]
            release_date_str = item["release_date"]
            gdp_pct = item["gdp_value"]
            
            period_dt = pd.Timestamp(period_date)
            release_dt = pd.Timestamp(release_date_str)
            
            # Skip if release date is before SPY started trading
            if release_dt < spy_start_date:
                skipped_no_spy += 1
                continue
            
            # Get SPY prices
            spy_on_release, actual_trade_date = get_trading_day_price(spy_hist, release_dt)
            
            if spy_on_release is None or actual_trade_date is None:
                skipped_no_spy += 1
                continue
            
            # Get forward prices for all holding periods
            spy_3d = get_price_n_days_forward(spy_hist, actual_trade_date, TRADING_DAYS["3d"])
            spy_1w = get_price_n_days_forward(spy_hist, actual_trade_date, TRADING_DAYS["1w"])
            spy_1m = get_price_n_days_forward(spy_hist, actual_trade_date, TRADING_DAYS["1m"])
            spy_2m = get_price_n_days_forward(spy_hist, actual_trade_date, TRADING_DAYS["2m"])
            spy_3m = get_price_n_days_forward(spy_hist, actual_trade_date, TRADING_DAYS["3m"])
            
            # Calculate returns WITH commission deducted
            ret_3d = calculate_return_with_commission(spy_on_release, spy_3d)
            ret_1w = calculate_return_with_commission(spy_on_release, spy_1w)
            ret_1m = calculate_return_with_commission(spy_on_release, spy_1m)
            ret_2m = calculate_return_with_commission(spy_on_release, spy_2m)
            ret_3m = calculate_return_with_commission(spy_on_release, spy_3m)
            
            # Quarter label
            quarter_num = (period_dt.month - 1) // 3 + 1
            quarter_label = f"Q{quarter_num} {period_dt.year}"
            
            records.append({
                "quarter": quarter_label,
                "period_date": period_date,
                "release_date": actual_trade_date.strftime("%Y-%m-%d"),
                "gdp_growth": round(gdp_pct, 2),
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
            print(f"   ⚠ Error processing {item.get('period_date')}: {e}")
            continue
    
    print(f"   ✓ Processed {len(records)} records")
    print(f"   ⚠ Skipped {skipped_no_spy} (no SPY data available)")
    
    # Show date range
    if records:
        years = [r["quarter"].split()[-1] for r in records]
        print(f"   ✓ Date range: {min(years)} to {max(years)}")
    
    # Upload to Supabase
    print("\n5. Uploading to Supabase...")
    
    success_count = 0
    error_count = 0
    
    for record in records:
        try:
            supabase.table("gdp_spy_analysis").upsert(
                record, 
                on_conflict="quarter"
            ).execute()
            success_count += 1
        except Exception as e:
            print(f"   ⚠ Error upserting {record['quarter']}: {e}")
            error_count += 1
    
    print(f"   ✓ Uploaded {success_count} records")
    if error_count > 0:
        print(f"   ⚠ {error_count} errors")
    
    # Verify
    print("\n6. Verifying...")
    result = supabase.table("gdp_spy_analysis").select("*", count="exact").execute()
    print(f"   ✓ Total records in database: {len(result.data)}")
    
    # Show breakdown by decade
    if result.data:
        years = [int(r["quarter"].split()[-1]) for r in result.data]
        decades = {}
        for y in years:
            decade = f"{(y // 10) * 10}s"
            decades[decade] = decades.get(decade, 0) + 1
        print("   ✓ Records by decade:")
        for decade in sorted(decades.keys()):
            print(f"      {decade}: {decades[decade]} quarters")
    
    print("\n" + "=" * 60)
    print("Update complete!")
    print(f"Note: All returns include {COMMISSION_PCT}% commission deduction")
    print(f"Note: Holding periods - 3D:{TRADING_DAYS['3d']}, 1W:{TRADING_DAYS['1w']}, 1M:{TRADING_DAYS['1m']}, 2M:{TRADING_DAYS['2m']}, 3M:{TRADING_DAYS['3m']} trading days")
    print("=" * 60)


if __name__ == "__main__":
    main()