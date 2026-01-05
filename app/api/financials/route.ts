import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const FMP_KEY = process.env.NEXT_PUBLIC_FMP_KEY;

// *** FIXED: Reverted to v3 (Standard), but we will use the modern Query Param syntax below ***
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

export async function POST(request: Request) {
    console.log("API Route Hit: Starting FMP Fetch..."); 

    if (!FMP_KEY) {
        return NextResponse.json({ error: "Missing API Key in .env.local" }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { ticker } = body;
        
        if (!ticker) {
            return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
        }

        console.log(`Fetching data for ${ticker}...`);

        // Helper function to handle non-JSON responses safely
        const fetchSafe = async (url: string) => {
            const res = await fetch(url);
            const text = await res.text(); // Get raw text first
            try {
                const json = JSON.parse(text); // Try to parse JSON
                // Check if FMP returned a JSON error object
                if (json['Error Message']) throw new Error(json['Error Message']);
                return json;
            } catch (e: any) {
                // If parsing fails, it's likely a text error from FMP (e.g. "Premium Query...")
                // Or if we manually threw an error above
                if (text.includes("Error Message")) throw new Error(text); // Already handled above usually
                throw new Error(`FMP API Error (Non-JSON): ${text.substring(0, 100)}...`);
            }
        };

        // 1. Fetch Data from FMP
        // URL Format: v3 endpoint + query parameters (The "Hybrid" fix)
        const [income, balance, cash, metrics] = await Promise.all([
            fetchSafe(`${BASE_URL}/income-statement?symbol=${ticker}&limit=20&period=annual&apikey=${FMP_KEY}`),
            fetchSafe(`${BASE_URL}/balance-sheet-statement?symbol=${ticker}&limit=20&period=annual&apikey=${FMP_KEY}`),
            fetchSafe(`${BASE_URL}/cash-flow-statement?symbol=${ticker}&limit=20&period=annual&apikey=${FMP_KEY}`),
            fetchSafe(`${BASE_URL}/key-metrics?symbol=${ticker}&limit=20&period=annual&apikey=${FMP_KEY}`)
        ]);

        // Check if data is empty (valid JSON but empty array)
        if (!income || !Array.isArray(income) || income.length === 0) {
            console.error("FMP Data Empty:", income);
            throw new Error(`Ticker ${ticker} not found or no data returned.`);
        }

        // 2. Stitch Data Together
        const historyMap: any = {};

        const mergeData = (dataSet: any[]) => {
            if (!dataSet || !Array.isArray(dataSet)) return;
            dataSet.forEach((item: any) => {
                if (!item.date) return; 
                const year = item.date.substring(0, 4);
                if (!historyMap[year]) historyMap[year] = { year, date: item.date };
                historyMap[year] = { ...historyMap[year], ...item };
            });
        };

        mergeData(income);
        mergeData(balance);
        mergeData(cash);
        mergeData(metrics);

        // 3. Transform Data
        const historyArray = Object.values(historyMap).map((d: any) => {
            return {
                year: d.year,
                date: d.date,
                
                // Per Share
                revenuePerShare: d.revenuePerShare || 0,
                eps: d.eps || 0,
                fcfPerShare: d.freeCashFlowPerShare || 0,
                dividendShare: d.dividendPerShare || 0, 
                bookValue: d.bookValuePerShare || 0,
                tangibleBookValue: d.tangibleBookValuePerShare || 0,
                
                // Shares
                sharesOutstanding: d.weightedAverageShsOut || 0,

                // Income Statement
                revenue: d.revenue || 0,
                operatingMargin: d.operatingExpenses && d.revenue ? (d.operatingIncome / d.revenue) * 100 : 0,
                depreciation: d.depreciationAndAmortization || 0,
                netIncome: d.netIncome || 0,
                taxRate: d.incomeBeforeTax ? (d.incomeTaxExpense / d.incomeBeforeTax) * 100 : 0,
                profitMargin: d.revenue ? (d.netIncome / d.revenue) * 100 : 0,

                // Balance Sheet
                workingCapital: d.workingCapital || 0,
                longTermDebt: d.longTermDebt || 0,
                totalEquity: d.totalStockholdersEquity || 0,

                // Returns / Ratios
                roic: d.roic ? d.roic * 100 : 0,
                roc: d.returnOnCapital ? d.returnOnCapital * 100 : 0,
                roe: d.returnOnEquity ? d.returnOnEquity * 100 : 0,
                debtToEquity: d.debtToEquity || 0,
                evEbit: d.enterpriseValueOverEBIT || 0,
                evEbitda: d.enterpriseValueOverEBITDA || 0
            };
        }).sort((a: any, b: any) => parseInt(b.year) - parseInt(a.year));

        if (historyArray.length === 0) {
            throw new Error("Data was fetched but resulted in an empty history array.");
        }

        const latest = historyArray[0];

        // 4. Save to Supabase
        const payload = {
            price: 0, 
            overview: {
                MarketCapitalization: (latest.sharesOutstanding || 0) * ((latest as any).stockPrice || 0),
                EPS: latest.eps,
                BookValue: latest.bookValue,
                Description: "Auto-Imported via FMP"
            },
            history: historyArray
        };

        const { error } = await supabase
            .from('financial_cache')
            .upsert({
                symbol: ticker.toUpperCase(),
                data: payload,
                last_updated: new Date().toISOString()
            });

        if (error) throw error;

        console.log(`Success! Saved ${historyArray.length} years for ${ticker}`);
        return NextResponse.json({ success: true, count: historyArray.length });

    } catch (err: any) {
        console.error("API Route Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}