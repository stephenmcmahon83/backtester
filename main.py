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

def extract_year_from_column(col_name):
    m = re.search(r'20\d{2}', str(col_name))
    return int(m.group(0)) if m else None

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

def cap_ratio(value, min_val=-500, max_val=500):
    """Cap extreme ratio values for display purposes"""
    if value is None or pd.isna(value):
        return 0.0
    if value > max_val:
        return max_val
    if value < min_val:
        return min_val
    return value

# ============== DATAFRAME-BASED EXTRACTION ==============

def find_value_in_df(df, search_terms, year_col):
    if df is None or df.empty:
        return 0.0
    
    for term in search_terms:
        term_lower = term.lower()
        for idx in df.index:
            idx_str = str(idx).lower()
            if term_lower == idx_str:
                try:
                    val = df.loc[idx, year_col]
                    if pd.notna(val) and val != 0:
                        return float(val)
                except:
                    pass
    
    for term in search_terms:
        term_lower = term.lower()
        for idx in df.index:
            idx_str = str(idx).lower()
            if term_lower in idx_str:
                try:
                    val = df.loc[idx, year_col]
                    if pd.notna(val) and val != 0:
                        return float(val)
                except:
                    pass
    
    return 0.0

def get_statement_df(statement):
    if statement is None:
        return None
    try:
        df = statement.to_dataframe()
        return df
    except Exception as e:
        print(f"Error converting statement to DataFrame: {e}")
        return None

def get_available_years(df):
    if df is None or df.empty:
        return []
    
    years = []
    for col in df.columns:
        yr = extract_year_from_column(col)
        if yr and yr >= 2011:
            years.append((yr, col))
    
    seen = set()
    unique_years = []
    for yr, col in sorted(years, key=lambda x: x[0], reverse=True):
        if yr not in seen:
            seen.add(yr)
            unique_years.append((yr, col))
    
    return unique_years

# ============== SEARCH TERMS ==============

REVENUE_TERMS = [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'Revenue', 
    'NetSales',
    'TotalRevenue',
    'TotalNetRevenue',
    'TotalNetSales',
    'SalesRevenueNet',
    'SalesRevenueGoodsNet',
    'SalesAndOtherOperatingRevenue',
    'OilAndGasSalesRevenue',
    'OperatingRevenue',
    'TotalRevenuesAndOtherIncome',
]

NET_INCOME_TERMS = [
    'NetIncomeLoss',
    'NetIncomeLossAvailableToCommonStockholdersBasic',
    'ProfitLoss',
    'NetIncome',
    'NetIncomeLossAttributableToParent',
    'ProfitLossAttributableToOwnersOfParent',
    'NetIncomeLossAttributableToReportingEntity',
]

EPS_TERMS = [
    'EarningsPerShareBasic',
    'EarningsPerShareDiluted',
    'EarningsPerShareBasicAndDiluted',
    'BasicEarningsPerShare',
]

SHARES_TERMS = [
    'WeightedAverageNumberOfSharesOutstandingBasic',
    'WeightedAverageNumberOfSharesOutstandingBasicAndDiluted',
    'CommonStockSharesOutstanding',
    'WeightedAverageSharesOutstanding',
    'WeightedAverageNumberOfDilutedSharesOutstanding',
]

EQUITY_TERMS = [
    'StockholdersEquity',
    'TotalStockholdersEquity',
    'TotalEquity',
    'Equity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    'CommonStockholdersEquity',
]

# Expanded debt terms
DEBT_TERMS = [
    'LongTermDebt',
    'LongTermDebtNoncurrent',
    'LongTermDebtAndCapitalLeaseObligations',
    'DebtNoncurrent',
    'LongTermDebtAndFinanceLeaseObligationsNoncurrent',
    'LongTermBorrowings',
    'FinanceLeaseLiabilityNoncurrent',
    'LongTermNotesPayable',
    'SeniorLongTermNotes',
    'ConvertibleDebtNoncurrent',
    'SecuredLongTermDebt',
    'UnsecuredLongTermDebt',
]

OPERATING_INCOME_TERMS = [
    'OperatingIncomeLoss',
    'OperatingIncome',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxes',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromOperations',
]

CURRENT_ASSETS_TERMS = ['AssetsCurrent', 'CurrentAssets', 'TotalCurrentAssets']
CURRENT_LIAB_TERMS = ['LiabilitiesCurrent', 'CurrentLiabilities', 'TotalCurrentLiabilities']
CASH_TERMS = [
    'CashAndCashEquivalentsAtCarryingValue', 
    'CashAndCashEquivalents', 
    'Cash', 
    'CashCashEquivalentsAndShortTermInvestments',
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
]
DEPRECIATION_TERMS = [
    'DepreciationDepletionAndAmortization', 
    'DepreciationAndAmortization', 
    'Depreciation', 
    'DepreciationAmortizationAndAccretionNet',
]

# FIXED: Dividends per share - prioritize per-share values, check for reasonable values
DIVIDENDS_PS_TERMS = [
    'CommonStockDividendsPerShareDeclared',
    'CommonStockDividendsPerShareCashPaid',
    'DividendsPerShareDeclared',
    'DividendsCommonStockCashPaidPerShare',
]

DIVIDENDS_PAID_TERMS = [
    'PaymentsOfDividends',
    'PaymentsOfDividendsCommonStock',
    'DividendsPaid',
    'DividendsPaidCommonStock',
    'PaymentsOfOrdinaryDividends',
]

PRE_TAX_INCOME_TERMS = [
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxes',
    'IncomeLossBeforeIncomeTaxes',
]

# ============================================================

def get_yfinance_financials(ticker):
    """Get historical financial data from yfinance as a fallback."""
    try:
        y = yf.Ticker(ticker)
        income_stmt = y.income_stmt
        balance_sheet = y.balance_sheet
        
        if income_stmt is None or income_stmt.empty:
            return {}
        
        result = {}
        
        for col in income_stmt.columns:
            year = col.year
            revenue = 0
            net_income = 0
            
            for tag in ['Total Revenue', 'Revenue', 'Operating Revenue']:
                if tag in income_stmt.index:
                    val = income_stmt.loc[tag, col]
                    if pd.notna(val):
                        revenue = float(val)
                        break
            
            for tag in ['Net Income', 'Net Income Common Stockholders', 'Net Income From Continuing Operations']:
                if tag in income_stmt.index:
                    val = income_stmt.loc[tag, col]
                    if pd.notna(val):
                        net_income = float(val)
                        break
            
            # Also try to get equity and debt from balance sheet
            equity = 0
            lt_debt = 0
            
            if balance_sheet is not None and not balance_sheet.empty and col in balance_sheet.columns:
                for tag in ['Total Stockholders Equity', 'Stockholders Equity', 'Total Equity']:
                    if tag in balance_sheet.index:
                        val = balance_sheet.loc[tag, col]
                        if pd.notna(val):
                            equity = float(val)
                            break
                
                for tag in ['Long Term Debt', 'Long Term Debt And Capital Lease Obligation']:
                    if tag in balance_sheet.index:
                        val = balance_sheet.loc[tag, col]
                        if pd.notna(val):
                            lt_debt = float(val)
                            break
            
            if revenue > 0 or net_income > 0:
                result[year] = {
                    'revenue': revenue,
                    'netIncome': net_income,
                    'equity': equity,
                    'ltDebt': lt_debt,
                }
        
        return result
        
    except Exception as e:
        print(f"yfinance financials error for {ticker}: {e}")
        return {}

def get_bank_revenue(inc_df, col, ticker, year, yf_financials):
    """
    Special handler for bank/financial company revenue.
    Uses yfinance as primary source for banks without Revenues tag.
    """
    # First check if they have a straight "Revenues" line (like BAC/JPM)
    rev = find_value_in_df(inc_df, ['Revenues', 'TotalNetRevenues', 'RevenuesNetOfInterestExpense'], col)
    if rev > 0:
        print(f"  [{ticker}] {year} Found direct Revenues: {rev/1e9:.1f}B")
        return rev
    
    # For banks without Revenues (like GS), use yfinance
    if year in yf_financials and yf_financials[year].get('revenue', 0) > 0:
        yf_rev = yf_financials[year]['revenue']
        print(f"  [{ticker}] {year} Using yfinance Revenue: {yf_rev/1e9:.1f}B")
        return yf_rev
    
    # Last fallback: estimate from pre-tax (but this is inaccurate)
    pre_tax = find_value_in_df(inc_df, PRE_TAX_INCOME_TERMS, col)
    if pre_tax > 0:
        # Use a more conservative estimate - banks typically have 20-30% pre-tax margin
        estimated_rev = pre_tax / 0.30
        print(f"  [{ticker}] {year} Estimated Rev from PreTax({pre_tax/1e9:.1f}B): {estimated_rev/1e9:.1f}B")
        return estimated_rev
    
    return 0.0

def get_dividend_per_share(inc_df, cf_df, col, shares_final):
    """
    Get dividend per share, prioritizing actual per-share values.
    Falls back to calculating from total dividends paid.
    """
    # First try to get per-share value directly from income statement
    dps = find_value_in_df(inc_df, DIVIDENDS_PS_TERMS, col)
    
    # Sanity check: per-share dividend should typically be < $50
    if dps > 0 and dps < 100:
        return dps
    
    # If that failed or returned unreasonable value, calculate from total paid
    if cf_df is not None:
        div_paid = abs(find_value_in_df(cf_df, DIVIDENDS_PAID_TERMS, col))
        if div_paid > 0 and shares_final > 0:
            calculated_dps = div_paid / shares_final
            # Sanity check
            if calculated_dps < 100:
                return calculated_dps
    
    return 0.0

# -------------- Endpoint  ---------------------------------------
@app.get("/fetch-valuation-data/{ticker}")
async def fetch_valuation_data(ticker: str):
    tkr = ticker.upper()
    try:
        # -------- Market data (yfinance) --------
        current_price, price_history, yf_shares, splits = 0.0, [], 0.0, None
        price_df_for_calc = pd.DataFrame()
        yf_financials = {}
        
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
            
            hist = y.history(period="max", interval="1mo")
            now = pd.Timestamp.now()
            cutoff = now - pd.DateOffset(years=15)
            
            if not hist.empty:
                if hist.index.tz is not None:
                    hist.index = hist.index.tz_localize(None)
                price_df_for_calc = hist.copy()
                hist = hist[hist.index >= cutoff].reset_index()
                for _, r in hist.iterrows():
                    price_history.append({"date": r['Date'].strftime('%Y-%m-%d'), "close": float(r['Close'])})
            
            today = datetime.now().strftime('%Y-%m-%d')
            if current_price > 0 and (not price_history or price_history[-1]["date"] != today):
                price_history.append({"date": today, "close": current_price})
            
            # Get yfinance financials as fallback
            yf_financials = get_yfinance_financials(tkr)
                
        except Exception as e:
            print(f"yfinance error for {tkr}: {e}")

        # -------- XBRL via edgar --------
        is_fin = tkr in FINANCIAL_TICKERS
        inc_df = None
        bal_df = None
        cf_df = None
        available_years = []
        
        try:
            co = Company(tkr)
            inc_stmt = co.income_statement(periods=15, annual=True)
            bal_stmt = co.balance_sheet(periods=15, annual=True)
            cf_stmt = co.cash_flow(periods=15, annual=True)
            
            inc_df = get_statement_df(inc_stmt)
            bal_df = get_statement_df(bal_stmt)
            cf_df = get_statement_df(cf_stmt)
            
            if inc_df is not None:
                available_years = get_available_years(inc_df)
        except Exception as e:
            print(f"Edgar error for {tkr}: {e}")
        
        # Debug output
        print(f"\n{'='*60}")
        print(f"Processing {tkr} {'(FINANCIAL)' if is_fin else ''}")
        print(f"{'='*60}")
        
        if inc_df is not None and not inc_df.empty:
            print(f"Income Statement shape: {inc_df.shape}")
            if is_fin:
                print("All Income Statement items:")
                for idx in inc_df.index:
                    print(f"  - {idx}")
            else:
                for idx in inc_df.index:
                    idx_lower = str(idx).lower()
                    if 'revenue' in idx_lower or 'sales' in idx_lower or 'netsale' in idx_lower:
                        print(f"  Found: {idx}")
            print(f"Available years from XBRL: {[y[0] for y in available_years]}")
        else:
            print(f"No XBRL data available - will use yfinance fallback")
            print(f"yfinance years available: {list(yf_financials.keys())}")

        history = []
        
        # If we have XBRL data, use it
        if available_years:
            for yr, col in available_years:
                if yr < 2011:
                    continue
                
                # Revenue
                if is_fin:
                    rev_native = get_bank_revenue(inc_df, col, tkr, yr, yf_financials)
                else:
                    rev_native = find_value_in_df(inc_df, REVENUE_TERMS, col)
                
                ni_native = find_value_in_df(inc_df, NET_INCOME_TERMS, col)
                eps_native = find_value_in_df(inc_df, EPS_TERMS, col)
                shares_native = find_value_in_df(inc_df, SHARES_TERMS, col)
                
                if shares_native == 0 and bal_df is not None:
                    shares_native = find_value_in_df(bal_df, SHARES_TERMS, col)
                
                # Balance sheet items
                equity_native = find_value_in_df(bal_df, EQUITY_TERMS, col) if bal_df is not None else 0
                ltd_native = find_value_in_df(bal_df, DEBT_TERMS, col) if bal_df is not None else 0
                
                # Current assets/liabilities - skip for financials
                if is_fin:
                    curr_assets_native = 0
                    curr_liab_native = 0
                else:
                    curr_assets_native = find_value_in_df(bal_df, CURRENT_ASSETS_TERMS, col) if bal_df is not None else 0
                    curr_liab_native = find_value_in_df(bal_df, CURRENT_LIAB_TERMS, col) if bal_df is not None else 0
                
                cash_native = find_value_in_df(bal_df, CASH_TERMS, col) if bal_df is not None else 0
                
                op_inc_native = find_value_in_df(inc_df, OPERATING_INCOME_TERMS, col)
                
                depreciation_native = find_value_in_df(cf_df, DEPRECIATION_TERMS, col) if cf_df is not None else 0
                div_paid_native = abs(find_value_in_df(cf_df, DIVIDENDS_PAID_TERMS, col)) if cf_df is not None else 0

                # Fallback to yfinance if XBRL values are missing
                if rev_native == 0 and yr in yf_financials:
                    rev_native = yf_financials[yr].get('revenue', 0)
                    if rev_native > 0:
                        print(f"  [{tkr}] {yr} Using yfinance revenue: {rev_native/1e9:.1f}B")
                
                if ni_native == 0 and yr in yf_financials:
                    ni_native = yf_financials[yr].get('netIncome', 0)
                    if ni_native != 0:
                        print(f"  [{tkr}] {yr} Using yfinance net income: {ni_native/1e9:.1f}B")
                
                if equity_native == 0 and yr in yf_financials:
                    equity_native = yf_financials[yr].get('equity', 0)
                
                if ltd_native == 0 and yr in yf_financials:
                    ltd_native = yf_financials[yr].get('ltDebt', 0)

                if yr >= 2022:
                    print(f"[{tkr}] {yr}: Rev={rev_native/1e9:.1f}B, NI={ni_native/1e9:.1f}B, EPS={eps_native:.2f}")

                if rev_native == 0 and ni_native == 0 and equity_native == 0:
                    continue

                shares_native_resolved, _src = resolve_shares(ni_native, eps_native, shares_native, yf_shares)

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

                split_adj = shares_native_resolved * split_factor_after_year(splits, yr)
                shares_final = split_adj / adr_ratio(tkr, yr) if _src != "yfinance" else split_adj

                eps = ni_usd / shares_final if shares_final else 0.0
                rev_ps = rev_usd / shares_final if shares_final else 0.0
                bv_ps = equity_usd / shares_final if shares_final else 0.0
                
                # FIXED: Get dividend per share properly
                div_ps = get_dividend_per_share(inc_df, cf_df, col, shares_final)
                div_ps = div_ps / fx if div_ps else 0.0

                # Calculate ratios with capping for extreme values
                roe = cap_ratio((ni_usd / equity_usd * 100) if equity_usd and equity_usd != 0 else 0.0)
                invested_capital = equity_usd + ltd_usd
                roic = cap_ratio((ni_usd / invested_capital * 100) if invested_capital and invested_capital != 0 else 0.0)
                
                # Current ratio - only for non-financials
                if is_fin:
                    current_ratio = 0.0
                else:
                    current_ratio = (curr_assets_usd / curr_liab_usd) if curr_liab_usd and curr_liab_usd != 0 else 0.0
                
                debt_to_equity = (ltd_usd / abs(equity_usd)) if equity_usd and equity_usd != 0 else 0.0

                # EV/EBITDA & Price Data
                ev_ebitda = 0.0
                year_high = 0.0
                year_low = 0.0

                try:
                    if not price_df_for_calc.empty:
                        df_yr = price_df_for_calc[price_df_for_calc.index.year == yr]
                        if not df_yr.empty:
                            year_high = float(df_yr['High'].max())
                            year_low = float(df_yr['Low'].min())
                            avg_price = df_yr['Close'].mean()
                            market_cap = shares_final * avg_price
                            ebitda = op_inc_usd + depreciation_usd
                            ev = market_cap + ltd_usd - cash_usd
                            if ebitda > 0:
                                ev_ebitda = ev / ebitda
                except Exception as e:
                    pass

                # Operating margin - use pre-tax for banks if no operating income
                op_margin = 0.0
                if rev_usd > 0:
                    if op_inc_usd != 0:
                        op_margin = op_inc_usd / rev_usd * 100
                    elif is_fin:
                        # For banks, use pre-tax income as proxy
                        pre_tax = find_value_in_df(inc_df, PRE_TAX_INCOME_TERMS, col) / fx
                        if pre_tax > 0:
                            op_margin = pre_tax / rev_usd * 100

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
                    "operatingMargin": op_margin,
                    "profitMargin": ni_usd / rev_usd * 100 if rev_usd else 0.0,
                    "roe": roe,
                    "roic": roic,
                    "currentRatio": current_ratio,
                    "debtToEquity": debt_to_equity,
                    "evEbitda": ev_ebitda,
                    "yearHigh": year_high,
                    "yearLow": year_low,
                    "fairValue": eps * 15
                })
        
        # If no XBRL data, use yfinance as primary source
        elif yf_financials:
            print(f"Using yfinance as primary data source for {tkr}")
            for yr, data in sorted(yf_financials.items(), reverse=True):
                if yr < 2011:
                    continue
                
                rev_native = data.get('revenue', 0)
                ni_native = data.get('netIncome', 0)
                equity_native = data.get('equity', 0)
                ltd_native = data.get('ltDebt', 0)
                
                if rev_native == 0 and ni_native == 0:
                    continue
                
                fx = fx_rate(tkr, yr)
                rev_usd = rev_native / fx
                ni_usd = ni_native / fx
                equity_usd = equity_native / fx
                ltd_usd = ltd_native / fx
                
                shares_final = yf_shares if yf_shares else 1
                eps = ni_usd / shares_final if shares_final else 0.0
                
                year_high = 0.0
                year_low = 0.0
                try:
                    if not price_df_for_calc.empty:
                        df_yr = price_df_for_calc[price_df_for_calc.index.year == yr]
                        if not df_yr.empty:
                            year_high = float(df_yr['High'].max())
                            year_low = float(df_yr['Low'].min())
                except:
                    pass
                
                print(f"[{tkr}] {yr} (yfinance): Rev={rev_usd/1e9:.1f}B, NI={ni_usd/1e9:.1f}B")
                
                roe = cap_ratio((ni_usd / equity_usd * 100) if equity_usd and equity_usd != 0 else 0.0)
                invested_capital = equity_usd + ltd_usd
                roic = cap_ratio((ni_usd / invested_capital * 100) if invested_capital and invested_capital != 0 else 0.0)
                
                history.append({
                    "year": str(yr),
                    "revenue": rev_usd,
                    "netIncome": ni_usd,
                    "eps": eps,
                    "revenuePerShare": rev_usd / shares_final if shares_final else 0,
                    "dividendShare": 0,
                    "bookValue": equity_usd / shares_final if shares_final else 0,
                    "sharesOutstanding": shares_final,
                    "longTermDebt": ltd_usd,
                    "totalEquity": equity_usd,
                    "operatingMargin": 0,
                    "profitMargin": ni_usd / rev_usd * 100 if rev_usd else 0.0,
                    "roe": roe,
                    "roic": roic,
                    "currentRatio": 0,
                    "debtToEquity": (ltd_usd / abs(equity_usd)) if equity_usd != 0 else 0,
                    "evEbitda": 0,
                    "yearHigh": year_high,
                    "yearLow": year_low,
                    "fairValue": eps * 15
                })

        # Sort and add TTM
        history.sort(key=lambda x: int(x["year"]), reverse=True)
        
        if history:
            ttm = copy.deepcopy(history[0])
            ttm["year"] = "TTM"
            history.insert(0, ttm)

        print(f"Returning {len(history)} years of data for {tkr}")
        print(f"{'='*60}\n")

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