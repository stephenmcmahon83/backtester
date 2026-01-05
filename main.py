from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from edgar import Company, set_identity
import uvicorn
import traceback
import re
import copy
from datetime import datetime
import yfinance as yf
import pandas as pd
import numpy as np

set_identity("ValuationApp/1.0 (admin@test.com)")

# --------------  Static Tables  --------------------------------
ADR_RATIOS = {
    'BABA': 8, 'BIDU': 8, 'JD': 2, 'PDD': 4, 'NIO': 1, 'TCEHY': 1,
    'TM': 10, 'ASML': 1, 'ADRNY': 1, 'ABEV': 1, 'VALE': 1, 'PBR': 2,
    'LYG': 4, 'BHP': 2, 'RIO': 1, 'NEM': 1, 'BYDDY': 2, 'BUD': 1,
    'HSBC': 5, 'SONY': 1, 'ERIC': 1, 'NOK': 1, 'SAN': 1, 'MUFG': 1,
    'HMC': 1, 'LIN': 1, 'SHEL': 2, 'NVO': 1, 'RY': 1, 'BBVA': 1,
    'CEPU': 10, 'UL': 1, 'TTE': 1, 'ETN': 1, 'SNY': 0.5, 'SPOT': 1, 'MDT': 1
}

TICKER_CURRENCY = {
    'TM': 'JPY', 'SONY': 'JPY', 'HMC': 'JPY', 'MUFG': 'JPY',
    'BABA': 'CNY', 'JD': 'CNY', 'PDD': 'CNY', 'BIDU': 'CNY', 'TCEHY': 'CNY',
    'ASML': 'EUR', 'ADRNY': 'EUR', 'SNY': 'EUR', 'BBVA': 'EUR', 'SAN': 'EUR',
    'TTE': 'EUR', 'NOK': 'EUR', 'ERIC': 'SEK',
    'HSBC': 'GBP', 'LYG': 'GBP', 'SHEL': 'GBP', 'RIO': 'GBP', 'UL': 'GBP',
    'PBR': 'BRL', 'VALE': 'BRL', 'ABEV': 'BRL',
    'RY': 'CAD', 'NVO': 'DKK'
}

STATIC_FX_RATES = {
    'JPY': {2011: 79.8, 2012: 79.8, 2013: 97.6, 2014: 105.9, 2015: 121.0, 2016: 108.8,
            2017: 112.1, 2018: 110.4, 2019: 109.0, 2020: 106.8, 2021: 109.8,
            2022: 131.5, 2023: 140.5, 2024: 153.0, 2025: 155.0},
    'CNY': {2011: 6.46, 2012: 6.31, 2013: 6.20, 2014: 6.14, 2015: 6.22, 2016: 6.64,
            2017: 6.75, 2018: 6.61, 2019: 6.90, 2020: 6.90, 2021: 6.45,
            2022: 6.72, 2023: 7.08, 2024: 7.22, 2025: 7.25},
    'EUR': {2011: 0.72, 2012: 0.78, 2013: 0.75, 2014: 0.75, 2015: 0.90, 2016: 0.90,
            2017: 0.88, 2018: 0.85, 2019: 0.89, 2020: 0.87, 2021: 0.84,
            2022: 0.95, 2023: 0.92, 2024: 0.92, 2025: 0.92},
    'GBP': {2011: 0.62, 2012: 0.63, 2013: 0.64, 2014: 0.61, 2015: 0.65, 2016: 0.74,
            2017: 0.78, 2018: 0.75, 2019: 0.78, 2020: 0.78, 2021: 0.73,
            2022: 0.81, 2023: 0.80, 2024: 0.79, 2025: 0.79},
    'BRL': {2011: 1.67, 2012: 1.95, 2013: 2.16, 2014: 2.35, 2015: 3.34, 2016: 3.49,
            2017: 3.19, 2018: 3.66, 2019: 3.95, 2020: 5.16, 2021: 5.39,
            2022: 5.16, 2023: 4.99, 2024: 5.00, 2025: 5.00},
    'CAD': {2011: 0.99, 2012: 1.00, 2013: 1.03, 2014: 1.10, 2015: 1.28, 2016: 1.32,
            2017: 1.30, 2018: 1.30, 2019: 1.33, 2020: 1.34, 2021: 1.25,
            2022: 1.30, 2023: 1.35, 2024: 1.37, 2025: 1.38},
    'DKK': {2011: 5.4, 2012: 5.8, 2013: 5.6, 2014: 5.6, 2015: 6.7, 2016: 6.7,
            2017: 6.6, 2018: 6.3, 2019: 6.7, 2020: 6.5, 2021: 6.3,
            2022: 7.0, 2023: 6.8, 2024: 6.9, 2025: 6.9},
    'SEK': {2011: 6.5, 2012: 6.8, 2013: 6.5, 2014: 6.9, 2015: 8.4, 2016: 8.6,
            2017: 8.5, 2018: 8.7, 2019: 9.5, 2020: 9.2, 2021: 8.6,
            2022: 10.1, 2023: 10.6, 2024: 10.7, 2025: 10.7}
}

FINANCIAL_TICKERS = {
    'GS', 'JPM', 'BAC', 'C', 'WFC', 'MS', 'USB', 'PNC', 'AXP', 'BLK', 'SCHW', 'COF',
    'HSBC', 'LYG'
}

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# -------------- Helper Functions  -------------------------------
def year_int_from_period(p):
    m = re.search(r'20\d{2}', str(p))
    return int(m.group(0)) if m else None

def get_val(stmt, tags, yr):
    if stmt is None:
        return 0.0
    ystr = str(yr)
    for tag in tags:
        try:
            item = stmt.find_item(tag)
            if not item:
                continue
            if yr in item.values and item.values[yr] is not None:
                return float(item.values[yr])
            for dk, v in item.values.items():
                if v is not None and ystr in str(dk):
                    return float(v)
        except:
            continue
    return 0.0

def fx_rate(tkr, yr):
    cur = TICKER_CURRENCY.get(tkr, 'USD')
    if cur == 'USD':
        return 1.0
    return float(STATIC_FX_RATES.get(cur, {}).get(yr, 1.0))

def adr_ratio(tkr, yr):
    if tkr == 'TM':
        return 2 if yr < 2021 else 10
    return float(ADR_RATIOS.get(tkr, 1))

def split_factor_after_year(splits, yr):
    if splits is None or getattr(splits, "empty", True):
        return 1.0
    f = 1.0
    for dt, r in splits.items():
        if dt.year > yr:
            f *= float(r)
    return f

def resolve_shares(net_native, eps_native, shares_native, yf_shares):
    if shares_native:
        return float(shares_native), "xbrl"
    if eps_native and net_native:
        try:
            calc = abs(net_native / eps_native)
            if calc:
                return calc, "derived"
        except:
            pass
    if yf_shares:
        return float(yf_shares), "yfinance"
    return 0.0, "missing"

def bank_revenue(inc, yr):
    net_int = get_val(inc, ['NetInterestIncome', 'InterestIncomeExpenseNet'], yr)
    non_int = get_val(inc, ['NoninterestIncome', 'TotalNonInterestRevenues', 'TotalNonInterestRevenue'], yr)
    return net_int + non_int if (net_int or non_int) else get_val(
        inc, ['Revenues', 'RevenuesNetOfInterestExpense', 'TotalNetRevenues'], yr
)

# -------------- Endpoint  ---------------------------------------
@app.get("/fetch-valuation-data/{ticker}")
async def fetch_valuation_data(ticker: str):
    tkr = ticker.upper()
    try:
        # -------- Market data (yfinance) --------
        current_price, price_history, yf_shares, splits = 0.0, [], 0.0, None
        price_df_for_calc = pd.DataFrame() # To help calculate EV/EBITDA later
        
        try:
            y = yf.Ticker(tkr)
            try:
                if y.fast_info and y.fast_info.last_price:
                    current_price = float(y.fast_info.last_price)
            except:
                pass
            if current_price == 0:
                d = y.history(period="1d")
                if not d.empty:
                    current_price = float(d['Close'].iloc[-1])
            try:
                if y.info.get('sharesOutstanding'):
                    yf_shares = float(y.info['sharesOutstanding'])
            except:
                pass
            splits = y.splits
            
            # Fetch History
            hist = y.history(period="max", interval="1mo")
            now = pd.Timestamp.now()
            cutoff = now - pd.DateOffset(years=15)
            
            if not hist.empty:
                if hist.index.tz is not None:
                    hist.index = hist.index.tz_localize(None)
                
                # Save full df for backend calculations
                price_df_for_calc = hist.copy()
                
                hist = hist[hist.index >= cutoff].reset_index()
                for _, r in hist.iterrows():
                    price_history.append({"date": r['Date'].strftime('%Y-%m-%d'), "close": float(r['Close'])})
            
            today = datetime.now().strftime('%Y-%m-%d')
            if current_price > 0 and (not price_history or price_history[-1]["date"] != today):
                price_history.append({"date": today, "close": current_price})
                
        except Exception as e:
            print("yfinance error:", e)

        # -------- XBRL --------
        co = Company(tkr)
        is_fin = tkr in FINANCIAL_TICKERS
        inc = co.income_statement(periods=15, annual=True)
        bal = co.balance_sheet(periods=15, annual=True)
        cf = co.cash_flow(periods=15, annual=True)
        if not inc:
            raise HTTPException(404, "Financial data empty")

        history = []
        for p in inc.periods:
            yr = year_int_from_period(p)
            if not yr or yr < 2011:
                continue

            # --- Base Metrics ---
            rev_native = bank_revenue(inc, p) if is_fin else get_val(inc, ['Revenues', 'Revenue', 'NetSales', 'TotalNetSales', 'SalesRevenueNet'], p)
            ni_native = get_val(inc, ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss'], p)
            eps_native = get_val(inc, ['EarningsPerShareBasic', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareDiluted'], p)
            
            shares_native = get_val(inc, ['WeightedAverageNumberOfSharesOutstandingBasic', 'WeightedAverageNumberOfSharesOutstandingBasicAndDiluted'], p)
            if shares_native == 0:
                shares_native = get_val(bal, ['CommonStockSharesOutstanding', 'OrdinarySharesNumberOutstanding'], p)

            dps_native = get_val(inc, ['CommonStockDividendsPerShareDeclared', 'DividendsPerShareDeclared'], p)
            div_paid_native = abs(get_val(cf, ['PaymentsOfDividends', 'DividendsPaid'], p))
            
            equity_native = get_val(bal, ['StockholdersEquity', 'TotalStockholdersEquity', 'TotalEquity', 'Equity'], p)
            ltd_native = get_val(bal, ['LongTermDebt', 'LongTermDebtNoncurrent'], p)
            op_inc_native = get_val(inc, ['OperatingIncomeLoss', 'OperatingIncome'], p)

            # --- New Metrics Data ---
            curr_assets_native = get_val(bal, ['AssetsCurrent', 'CurrentAssets'], p)
            curr_liab_native = get_val(bal, ['LiabilitiesCurrent', 'CurrentLiabilities'], p)
            cash_native = get_val(bal, ['CashAndCashEquivalentsAtCarryingValue', 'CashAndCashEquivalents'], p)
            depreciation_native = get_val(cf, ['DepreciationDepletionAndAmortization', 'Depreciation', 'DepreciationAmortizationAndAccretionNet'], p)

            if rev_native == 0 and ni_native == 0 and equity_native == 0:
                continue

            shares_native_resolved, _src = resolve_shares(ni_native, eps_native, shares_native, yf_shares)

            # --- Conversion ---
            fx = fx_rate(tkr, yr)
            rev_usd = rev_native / fx
            ni_usd = ni_native / fx
            equity_usd = equity_native / fx
            ltd_usd = ltd_native / fx
            op_inc_usd = op_inc_native / fx
            div_paid_usd = div_paid_native / fx
            curr_assets_usd = curr_assets_native / fx
            curr_liab_usd = curr_liab_native / fx
            cash_usd = cash_native / fx
            depreciation_usd = depreciation_native / fx
            dps_usd = dps_native / fx if dps_native else 0.0

            split_adj = shares_native_resolved * split_factor_after_year(splits, yr)
            shares_final = split_adj / adr_ratio(tkr, yr) if _src != "yfinance" else split_adj

            # --- Per Share ---
            eps = ni_usd / shares_final if shares_final else 0.0
            rev_ps = rev_usd / shares_final if shares_final else 0.0
            bv_ps = equity_usd / shares_final if shares_final else 0.0
            div_ps = dps_usd if dps_usd else (div_paid_usd / shares_final if shares_final else 0.0)

            # --- Ratios Calculation ---
            # 1. ROE (Net Income / Equity)
            roe = (ni_usd / equity_usd * 100) if equity_usd and equity_usd != 0 else 0.0
            
            # 2. ROIC (Net Income / (Equity + Debt))
            invested_capital = equity_usd + ltd_usd
            roic = (ni_usd / invested_capital * 100) if invested_capital and invested_capital != 0 else 0.0
            
            # 3. Current Ratio
            current_ratio = (curr_assets_usd / curr_liab_usd) if curr_liab_usd and curr_liab_usd != 0 else 0.0
            
            # 4. Debt to Equity
            debt_to_equity = (ltd_usd / equity_usd) if equity_usd and equity_usd != 0 else 0.0

            # 5. EV / EBITDA & High/Low Data
            ev_ebitda = 0.0
            year_high = 0.0
            year_low = 0.0

            try:
                # Filter price df for this year
                if not price_df_for_calc.empty:
                    df_yr = price_df_for_calc[price_df_for_calc.index.year == yr]
                    if not df_yr.empty:
                        # Grab High/Low stats
                        year_high = float(df_yr['High'].max())
                        year_low = float(df_yr['Low'].min())
                        
                        # EV Calc
                        avg_price = df_yr['Close'].mean()
                        market_cap = shares_final * avg_price
                        ebitda = op_inc_usd + depreciation_usd
                        ev = market_cap + ltd_usd - cash_usd
                        if ebitda > 0:
                            ev_ebitda = ev / ebitda
            except:
                pass

            history.append({
                "year": str(yr),
                "revenue": rev_usd,
                "netIncome": ni_usd,
                "eps": eps,
                "revenuePerShare": rev_ps,
                "dividendShare": div_ps,
                "bookValue": bv_ps,
                "sharesOutstanding": shares_final,
                "longTermDebt": ltd_usd,
                "totalEquity": equity_usd,
                "operatingMargin": op_inc_usd / rev_usd * 100 if rev_usd else 0.0,
                "profitMargin": ni_usd / rev_usd * 100 if rev_usd else 0.0,
                "roe": roe,
                "roic": roic,
                "currentRatio": current_ratio,
                "debtToEquity": debt_to_equity,
                "evEbitda": ev_ebitda,
                # -- NEW FIELDS --
                "yearHigh": year_high,
                "yearLow": year_low,
                "fairValue": eps * 15  # 15x EPS
            })

        history.sort(key=lambda x: int(x["year"]), reverse=True)
        if history:
            ttm = copy.deepcopy(history[0]); ttm["year"] = "TTM"; history.insert(0, ttm)

        return {
            "symbol": tkr,
            "data": {
                "price": current_price,
                "price_history": price_history,
                "overview": {"isFinancial": is_fin, "Description": f"Imported {tkr}"},
                "history": history
            }
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)