"""
Economic Indicators Data Updater with VERIFIED Release Dates
Uses FRED's release dates API to get actual historical release dates.
Only includes indicators where we can verify release dates.

Tickers: SPY, QQQ, GLD, TLT, XHB

Run: python update_economic_indicators.py
"""

import os
import requests
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from supabase import create_client, Client
from typing import Optional, Dict, List, Tuple
from dotenv import load_dotenv
from pathlib import Path
import time

# ============ LOAD ENVIRONMENT VARIABLES ============
script_dir = Path(__file__).parent.resolve()
env_path = script_dir / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
FRED_API_KEY = os.getenv("FRED_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY")
if not FRED_API_KEY:
    raise ValueError("Missing FRED_API_KEY")

# ============ CONSTANTS ============
COMMISSION_PCT = 0.10
TICKERS = ["SPY", "QQQ", "GLD", "TLT", "XHB"]

TRADING_DAYS = {
    "3d": 3,
    "1w": 5,
    "1m": 21,
    "2m": 42,
    "3m": 63,
}

# ============ INDICATOR CONFIGURATIONS ============
# Only indicators with reliable FRED release date tracking
# entry_timing: "open" = before market open, "close" = after market open
INDICATORS = {
    # ========== GDP & GROWTH ==========
    "GDP": {
        "series_id": "A191RL1Q225SBEA",
        "release_id": 53,  # Gross Domestic Product
        "name": "GDP Growth (Quarterly)",
        "frequency": "quarterly",
        "comparison_type": "zero",
        "entry_timing": "open",  # 8:30 AM release
    },
    
    # ========== EMPLOYMENT ==========
    "PAYROLLS": {
        "series_id": "PAYEMS",
        "release_id": 50,  # Employment Situation
        "name": "Nonfarm Payrolls",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 8:30 AM release
        "transform": "diff",  # Month-over-month change
    },
    "UNEMPLOYMENT": {
        "series_id": "UNRATE",
        "release_id": 50,  # Employment Situation
        "name": "Unemployment Rate",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 8:30 AM release
    },
    "JOBLESS_CLAIMS": {
        "series_id": "ICSA",
        "release_id": 176,  # Unemployment Insurance Weekly Claims
        "name": "Initial Jobless Claims",
        "frequency": "weekly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 8:30 AM release
    },
    "JOLTS": {
        "series_id": "JTSJOL",
        "release_id": 110,  # Job Openings and Labor Turnover Survey
        "name": "Job Openings (JOLTS)",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "close",  # 10:00 AM release
    },
    
    # ========== INFLATION ==========
    "CPI": {
        "series_id": "CPIAUCSL",
        "release_id": 10,  # Consumer Price Index
        "name": "CPI Inflation",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 8:30 AM release
        "transform": "pct_change",  # Year-over-year percent change
    },
    "CORE_PCE": {
        "series_id": "PCEPILFE",
        "release_id": 54,  # Personal Income and Outlays
        "name": "Core PCE Inflation",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 8:30 AM release
        "transform": "pct_change_yoy",
    },
    "PPI": {
        "series_id": "PPIACO",
        "release_id": 46,  # Producer Price Index
        "name": "Producer Price Index (PPI)",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 8:30 AM release
        "transform": "pct_change_yoy",
    },
    
    # ========== HOUSING ==========
    "HOUSING_STARTS": {
        "series_id": "HOUST",
        "release_id": 34,  # New Residential Construction
        "name": "Housing Starts",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 8:30 AM release
    },
    "BUILDING_PERMITS": {
        "series_id": "PERMIT",
        "release_id": 34,  # New Residential Construction
        "name": "Building Permits",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 8:30 AM release
    },
    "EXISTING_HOME_SALES": {
        "series_id": "EXHOSLUSM495S",
        "release_id": 83,  # Existing Home Sales
        "name": "Existing Home Sales",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "close",  # 10:00 AM release
    },
    "NEW_HOME_SALES": {
        "series_id": "HSN1F",
        "release_id": 32,  # New Residential Sales
        "name": "New Home Sales",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "close",  # 10:00 AM release
    },
    
    # ========== MANUFACTURING ==========
    "INDPRO": {
        "series_id": "INDPRO",
        "release_id": 13,  # Industrial Production and Capacity Utilization
        "name": "Industrial Production Index",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 9:15 AM release (before typical entry)
    },
    "DURABLE_GOODS": {
        "series_id": "DGORDER",
        "release_id": 86,  # Advance Report on Durable Goods
        "name": "Durable Goods Orders",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 8:30 AM release
    },
    "ISM_MFG": {
        "series_id": "MANEMP",  # Using manufacturing employment as proxy
        "release_id": 179,  # ISM Manufacturing
        "name": "ISM Manufacturing PMI",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "close",  # 10:00 AM release
        "use_ism_data": True,  # Special handling for ISM
    },
    
    # ========== CONSUMER ==========
    "RETAIL": {
        "series_id": "RSAFS",
        "release_id": 11,  # Advance Monthly Sales for Retail and Food Services
        "name": "Retail Sales",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 8:30 AM release
        "transform": "pct_change_mom",
    },
    "SENTIMENT": {
        "series_id": "UMCSENT",
        "release_id": 192,  # Surveys of Consumers
        "name": "Consumer Sentiment (U of Michigan)",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "close",  # 10:00 AM release
    },
    "PERSONAL_INCOME": {
        "series_id": "PI",
        "release_id": 54,  # Personal Income and Outlays
        "name": "Personal Income",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 8:30 AM release
        "transform": "pct_change_mom",
    },
    "PCE": {
        "series_id": "PCE",
        "release_id": 54,  # Personal Income and Outlays
        "name": "Personal Consumption Expenditures",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "open",  # 8:30 AM release
        "transform": "pct_change_mom",
    },
    
    # ========== LEADING INDICATORS ==========
    "LEI": {
        "series_id": "USALOLITONOSTSAM",
        "release_id": 190,  # Leading Indexes
        "name": "Leading Economic Index (LEI)",
        "frequency": "monthly",
        "comparison_type": "prior",
        "entry_timing": "close",  # 10:00 AM release
    },
}


# ============ SUPABASE CLIENT ============
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ============ FRED API FUNCTIONS ============
def get_fred_release_dates(release_id: int, start_date: str = "2000-01-01") -> pd.DataFrame:
    """
    Get actual release dates from FRED's release calendar.
    This ensures we use verified release dates, not estimated ones.
    """
    url = "https://api.stlouisfed.org/fred/release/dates"
    params = {
        "release_id": release_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "realtime_start": start_date,
        "include_release_dates_with_no_data": "false",
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if "release_dates" not in data:
            print(f"  No release dates found for release_id {release_id}")
            return pd.DataFrame()
        
        dates = [rd["date"] for rd in data["release_dates"]]
        df = pd.DataFrame({"release_date": pd.to_datetime(dates)})
        return df
        
    except Exception as e:
        print(f"  Error fetching release dates: {e}")
        return pd.DataFrame()


def get_fred_series(series_id: str, start_date: str = "2000-01-01") -> pd.DataFrame:
    """
    Get historical data for a FRED series.
    """
    url = "https://api.stlouisfed.org/fred/series/observations"
    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "observation_start": start_date,
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if "observations" not in data:
            return pd.DataFrame()
        
        df = pd.DataFrame(data["observations"])
        df["date"] = pd.to_datetime(df["date"])
        df["value"] = pd.to_numeric(df["value"], errors="coerce")
        df = df.dropna(subset=["value"])
        
        return df[["date", "value"]].sort_values("date").reset_index(drop=True)
        
    except Exception as e:
        print(f"  Error fetching series {series_id}: {e}")
        return pd.DataFrame()


def match_releases_to_data(
    release_dates: pd.DataFrame,
    series_data: pd.DataFrame,
    config: dict
) -> pd.DataFrame:
    """
    Match release dates to the data that was released on each date.
    The release date announces data for the PREVIOUS period.
    """
    if release_dates.empty or series_data.empty:
        return pd.DataFrame()
    
    results = []
    
    for _, row in release_dates.iterrows():
        release_date = row["release_date"]
        
        # Find the most recent data point BEFORE or ON the release date
        # (The data being released is for a prior period)
        available_data = series_data[series_data["date"] <= release_date]
        
        if len(available_data) < 2:
            continue
        
        # Current = most recent data available at release
        current = available_data.iloc[-1]
        # Previous = prior period's data
        previous = available_data.iloc[-2]
        
        current_value = current["value"]
        previous_value = previous["value"]
        
        # Apply transformations if needed
        transform = config.get("transform")
        if transform == "diff":
            # Month-over-month difference (e.g., payrolls)
            display_current = current_value - previous_value
            display_previous = previous_value - available_data.iloc[-3]["value"] if len(available_data) >= 3 else 0
        elif transform == "pct_change":
            # Period-over-period percent change
            display_current = ((current_value / previous_value) - 1) * 100 if previous_value != 0 else 0
            display_previous = ((previous_value / available_data.iloc[-3]["value"]) - 1) * 100 if len(available_data) >= 3 and available_data.iloc[-3]["value"] != 0 else 0
        elif transform == "pct_change_yoy":
            # Year-over-year percent change
            yoy_data = available_data[available_data["date"] <= release_date - timedelta(days=365)]
            if len(yoy_data) >= 1:
                yoy_prev = yoy_data.iloc[-1]["value"]
                display_current = ((current_value / yoy_prev) - 1) * 100 if yoy_prev != 0 else 0
            else:
                display_current = 0
            display_previous = previous_value  # Keep raw for comparison
        elif transform == "pct_change_mom":
            display_current = ((current_value / previous_value) - 1) * 100 if previous_value != 0 else 0
            display_previous = 0
        else:
            display_current = current_value
            display_previous = previous_value
        
        # Determine direction
        comparison_type = config.get("comparison_type", "prior")
        if comparison_type == "zero":
            direction = "ABOVE" if display_current > 0 else "BELOW"
        else:
            direction = "ABOVE" if display_current > display_previous else "BELOW"
        
        results.append({
            "release_date": release_date.strftime("%Y-%m-%d"),
            "period_date": current["date"].strftime("%Y-%m-%d"),
            "current_value": round(display_current, 4),
            "previous_value": round(display_previous, 4),
            "change_direction": direction,
            "value_change": round(display_current - display_previous, 4),
        })
    
    return pd.DataFrame(results)


# ============ PRICE DATA FUNCTIONS ============
def get_price_data(ticker: str, start_date: str = "2000-01-01") -> pd.DataFrame:
    """
    Get historical OHLC data from Yahoo Finance.
    """
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(start=start_date, auto_adjust=True)
        
        if df.empty:
            print(f"  No price data for {ticker}")
            return pd.DataFrame()
        
        df = df.reset_index()
        df["Date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None)
        
        return df[["Date", "Open", "Close"]].rename(columns={
            "Date": "date",
            "Open": "open",
            "Close": "close"
        })
        
    except Exception as e:
        print(f"  Error fetching {ticker}: {e}")
        return pd.DataFrame()


def get_future_price(
    prices_df: pd.DataFrame,
    from_date: str,
    trading_days_ahead: int
) -> Optional[float]:
    """
    Get the closing price N trading days after from_date.
    """
    from_dt = pd.to_datetime(from_date)
    future_prices = prices_df[prices_df["date"] > from_dt]
    
    if len(future_prices) >= trading_days_ahead:
        return future_prices.iloc[trading_days_ahead - 1]["close"]
    return None


def get_entry_price(
    prices_df: pd.DataFrame,
    release_date: str,
    entry_timing: str
) -> Tuple[Optional[float], str]:
    """
    Get the entry price based on release timing.
    - "open": Use opening price on release date (pre-market data)
    - "close": Use closing price on release date (intraday data)
    
    Returns (price, entry_type)
    """
    release_dt = pd.to_datetime(release_date)
    
    # Find the release date or next trading day
    day_data = prices_df[prices_df["date"] >= release_dt]
    
    if day_data.empty:
        return None, entry_timing
    
    # Get first trading day >= release date
    trade_date = day_data.iloc[0]
    
    if entry_timing == "open":
        return trade_date["open"], "open"
    else:
        return trade_date["close"], "close"


def calculate_return(
    entry_price: float,
    exit_price: float,
    commission_pct: float = COMMISSION_PCT
) -> float:
    """
    Calculate return with commission.
    """
    if entry_price <= 0:
        return 0.0
    raw_return = ((exit_price / entry_price) - 1) * 100
    return round(raw_return - commission_pct, 4)


# ============ DATABASE FUNCTIONS ============
def upsert_analysis(records: List[dict], ticker: str, indicator_code: str):
    """
    Upsert analysis records to Supabase.
    Deletes existing records for ticker/indicator combo first.
    """
    if not records:
        return
    
    # Delete existing records
    supabase.table("economic_indicators_analysis").delete().eq(
        "ticker", ticker
    ).eq(
        "indicator_code", indicator_code
    ).execute()
    
    # Insert new records in batches
    batch_size = 100
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        supabase.table("economic_indicators_analysis").insert(batch).execute()
    
    print(f"    Inserted {len(records)} records for {ticker}/{indicator_code}")


def update_summary(ticker: str, indicator_code: str, indicator_name: str):
    """
    Calculate and upsert summary statistics.
    """
    # Fetch all analysis records
    response = supabase.table("economic_indicators_analysis").select("*").eq(
        "ticker", ticker
    ).eq(
        "indicator_code", indicator_code
    ).execute()
    
    if not response.data:
        return
    
    df = pd.DataFrame(response.data)
    
    above_df = df[df["change_direction"] == "ABOVE"]
    below_df = df[df["change_direction"] == "BELOW"]
    
    def calc_stats(subset: pd.DataFrame, prefix: str) -> dict:
        stats = {}
        stats[f"{prefix}_count"] = len(subset)
        
        for period in ["3d", "1w", "1m", "2m", "3m"]:
            col = f"return_{period}"
            valid = subset[subset[col].notna()][col]
            
            if len(valid) > 0:
                stats[f"{prefix}_avg_return_{period}"] = round(valid.mean(), 4)
                stats[f"{prefix}_pct_positive_{period}"] = round((valid > 0).mean() * 100, 1)
            else:
                stats[f"{prefix}_avg_return_{period}"] = None
                stats[f"{prefix}_pct_positive_{period}"] = None
        
        return stats
    
    summary = {
        "ticker": ticker,
        "indicator_code": indicator_code,
        "indicator_name": indicator_name,
        "total_releases": len(df),
        **calc_stats(above_df, "above_prior"),
        **calc_stats(below_df, "below_prior"),
        "last_updated": datetime.utcnow().isoformat(),
    }
    
    # Rename keys to match schema
    summary["above_prior_count"] = summary.pop("above_prior_count")
    summary["below_prior_count"] = summary.pop("below_prior_count")
    
    for period in ["3d", "1w", "1m", "2m", "3m"]:
        summary[f"above_avg_return_{period}"] = summary.pop(f"above_prior_avg_return_{period}")
        summary[f"above_pct_positive_{period}"] = summary.pop(f"above_prior_pct_positive_{period}")
        summary[f"below_avg_return_{period}"] = summary.pop(f"below_prior_avg_return_{period}")
        summary[f"below_pct_positive_{period}"] = summary.pop(f"below_prior_pct_positive_{period}")
    
    # Upsert summary
    supabase.table("economic_indicators_summary").upsert(
        summary,
        on_conflict="ticker,indicator_code"
    ).execute()
    
    print(f"    Updated summary for {ticker}/{indicator_code}")


# ============ MAIN PROCESSING ============
def process_indicator(indicator_code: str, config: dict):
    """
    Process a single indicator for all tickers.
    """
    print(f"\n{'='*60}")
    print(f"Processing: {config['name']} ({indicator_code})")
    print(f"{'='*60}")
    
    # Step 1: Get verified release dates from FRED
    print(f"  Fetching release dates (release_id: {config['release_id']})...")
    release_dates = get_fred_release_dates(config["release_id"])
    
    if release_dates.empty:
        print(f"  ❌ No release dates found, skipping")
        return
    
    print(f"  Found {len(release_dates)} release dates")
    
    # Step 2: Get economic data series
    print(f"  Fetching series data ({config['series_id']})...")
    series_data = get_fred_series(config["series_id"])
    
    if series_data.empty:
        print(f"  ❌ No series data found, skipping")
        return
    
    print(f"  Found {len(series_data)} data points")
    
    # Step 3: Match releases to data
    print(f"  Matching releases to data...")
    matched_releases = match_releases_to_data(release_dates, series_data, config)
    
    if matched_releases.empty:
        print(f"  ❌ No matched releases, skipping")
        return
    
    print(f"  Matched {len(matched_releases)} releases")
    
    # Step 4: Process each ticker
    for ticker in TICKERS:
        print(f"\n  Processing {ticker}...")
        
        # Get price data
        prices_df = get_price_data(ticker)
        if prices_df.empty:
            print(f"    ❌ No price data for {ticker}, skipping")
            continue
        
        # Calculate returns for each release
        records = []
        entry_timing = config.get("entry_timing", "open")
        
        for _, release in matched_releases.iterrows():
            release_date = release["release_date"]
            
            # Get entry price
            entry_price, entry_type = get_entry_price(prices_df, release_date, entry_timing)
            
            if entry_price is None:
                continue
            
            # Get future prices and calculate returns
            record = {
                "ticker": ticker,
                "indicator_code": indicator_code,
                "indicator_name": config["name"],
                "release_date": release_date,
                "period_date": release["period_date"],
                "current_value": release["current_value"],
                "previous_value": release["previous_value"],
                "change_direction": release["change_direction"],
                "value_change": release["value_change"],
                "entry_price": round(entry_price, 4),
                "entry_type": entry_type,
            }
            
            # Calculate returns for each holding period
            for period_name, days in TRADING_DAYS.items():
                exit_price = get_future_price(prices_df, release_date, days)
                
                if exit_price is not None:
                    record[f"price_{period_name}"] = round(exit_price, 4)
                    record[f"return_{period_name}"] = calculate_return(entry_price, exit_price)
                else:
                    record[f"price_{period_name}"] = None
                    record[f"return_{period_name}"] = None
            
            records.append(record)
        
        # Upsert to database
        if records:
            upsert_analysis(records, ticker, indicator_code)
            update_summary(ticker, indicator_code, config["name"])
            print(f"    ✅ {ticker}: {len(records)} records processed")
        else:
            print(f"    ⚠️ {ticker}: No valid records")
        
        time.sleep(0.5)  # Rate limiting


def main():
    """
    Main entry point - process all indicators.
    """
    print("="*60)
    print("ECONOMIC INDICATORS DATA UPDATER")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Tickers: {', '.join(TICKERS)}")
    print(f"Indicators: {len(INDICATORS)}")
    print("="*60)
    
    for indicator_code, config in INDICATORS.items():
        try:
            process_indicator(indicator_code, config)
        except Exception as e:
            print(f"  ❌ Error processing {indicator_code}: {e}")
            continue
        
        time.sleep(1)  # Rate limiting between indicators
    
    print("\n" + "="*60)
    print(f"COMPLETED: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)


if __name__ == "__main__":
    main()