"use client";

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPage() {
    const [ticker, setTicker] = useState('');
    const [price, setPrice] = useState('');
    const [marketCap, setMarketCap] = useState('');
    const [pasteData, setPasteData] = useState('');
    const [status, setStatus] = useState('');
    const [debugLog, setDebugLog] = useState<string[]>([]);
    const [fetchingPrice, setFetchingPrice] = useState(false);

    // --- AUTO-FETCH PRICE ---
    const fetchLatestPrice = async () => {
        if (!ticker) { setStatus("Error: Please enter a ticker first."); return; }
        setFetchingPrice(true);
        try {
            const { data, error } = await supabase.from('stock_data').select('close, date').eq('symbol', ticker.toUpperCase()).order('date', { ascending: false }).limit(1).single();
            if (error) throw error;
            setPrice(data.close.toString());
            setStatus(`Fetched price ($${data.close}) from ${data.date}`);
        } catch (err: any) { setStatus(`Could not fetch price: ${err.message}`); } finally { setFetchingPrice(false); }
    };

    const handleParseAndUpload = async () => {
        setDebugLog([]);
        const log = (msg: string) => setDebugLog(prev => [...prev, msg]);

        try {
            setStatus("Parsing...");
            log("Starting parse...");

            // 1. SPLIT LINES
            let rawLines = pasteData.trim().split('\n');
            const rows = rawLines.map(line => {
                if (line.includes('\t')) return line.split('\t');
                return line.split(/\s{2,}/); 
            });

            // 2. FIND HEADER ROW
            const headerRowIndex = rows.findIndex(row => {
                const yearCount = row.filter(cell => /20[0-9][0-9]/.test(cell)).length;
                return yearCount >= 2;
            });

            if (headerRowIndex === -1) throw new Error("Could not find Year Header row");
            
            const yearsRow = rows[headerRowIndex];
            const historyMap: any = {};

            yearsRow.forEach((cell, index) => {
                const clean = cell.trim();
                if (/^\d{4}$/.test(clean)) {
                    historyMap[index] = { year: clean, date: `${clean}-12-31`, isTTM: false };
                } else if (clean.toUpperCase() === 'TTM') {
                    historyMap[index] = { year: "TTM", date: new Date().toISOString().split('T')[0], isTTM: true };
                }
            });

            const validIndices = Object.keys(historyMap).map(Number);
            
            // 3. UPDATED KEYMAP (Fixes missing rows)
            const keyMap: Record<string, string> = {
                // Per Share
                "revenue per share": "revenuePerShare",
                "revenue per": "revenuePerShare", // Catch fuzzy
                "basic eps": "eps",
                "free cash flow per": "fcfPerShare",
                "dividend per": "dividendShare",
                "tangible book": "tangibleBookValue", // Broader match
                "book value per": "bookValue",
                
                // Shares
                "weighted avg shares": "sharesOutstanding",
                "average shares": "sharesOutstanding",
                
                // Income Statement
                "sales/revenue": "revenue",
                "revenue": "revenue",
                "operating margin": "operatingMargin",
                "depreciation": "depreciation",
                "net income": "netIncome",
                "tax rate": "taxRate",
                "profit margin": "profitMargin",
                
                // Balance Sheet
                "working capital": "workingCapital",
                "lt debt": "longTermDebt",
                "total equity": "totalEquity",
                
                // Returns / Ratios
                "return on invested": "roic",
                "return on capital": "roc",
                "return on common": "roe"
            };

            // 4. PARSE ROWS
            let capturedCount = 0;

            for (let i = headerRowIndex + 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0]) continue;

                let label = row[0].trim().toLowerCase();
                let dbKey = null;
                
                for (const [searchKey, mapKey] of Object.entries(keyMap)) {
                    if (label.includes(searchKey)) {
                        dbKey = mapKey;
                        // log(`  -> MATCHED "${label}" to "${mapKey}"`);
                        break;
                    }
                }

                if (dbKey) {
                    capturedCount++;
                    validIndices.forEach(colIndex => {
                        if (colIndex < row.length) {
                            let cell = row[colIndex];
                            let clean = cell.replace(/[$,\s%]/g, ''); 
                            if (clean.includes('(') || clean.includes(')')) clean = '-' + clean.replace(/[()]/g, '');
                            if (clean === '-' || clean === '—' || clean === '') clean = '0';
                            
                            const val = parseFloat(clean);

                            if (!isNaN(val)) {
                                // CRITICAL FIX: NO MULTIPLIERS.
                                // We store "170910" exactly as "170910".
                                // The Valuation Page will handle the "Billions" formatting.
                                historyMap[colIndex][dbKey] = val;
                            }
                        }
                    });
                }
            }

            log(`Captured ${capturedCount} metrics total.`);
            
            const historyArray = Object.values(historyMap);
            const latest = historyArray[historyArray.length - 1] as any;
            
            let finalMarketCap = marketCap ? parseFloat(marketCap.replace(/,/g, '')) * 1000000 : 0;
            if (!finalMarketCap && latest.sharesOutstanding && price) {
                // Assume shares in table are in Millions (e.g. 14,000)
                finalMarketCap = latest.sharesOutstanding * 1000000 * parseFloat(price);
            }

            const payload = {
                price: parseFloat(price) || 0,
                overview: {
                    MarketCapitalization: finalMarketCap,
                    EPS: latest.eps || 0,
                    BookValue: latest.bookValue || 0,
                    Description: "Manual Upload"
                },
                history: historyArray.reverse() 
            };

            const { error } = await supabase.from('financial_cache').upsert({
                    symbol: ticker.toUpperCase(),
                    data: payload,
                    last_updated: new Date().toISOString()
                });

            if (error) throw error;
            setStatus(`SUCCESS! Uploaded ${ticker}.`);

        } catch (err: any) {
            console.error(err);
            setStatus(`Error: ${err.message}`);
            log(`CRITICAL ERROR: ${err.message}`);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto min-h-screen bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                        <h1 className="text-2xl font-bold mb-6 text-gray-800">Admin: Fix Data Upload</h1>
                        
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <input className="border p-2 rounded font-bold uppercase" value={ticker} onChange={e => setTicker(e.target.value)} onBlur={fetchLatestPrice} placeholder="Ticker" />
                            <div className="flex gap-1">
                                <input className="border p-2 w-full rounded" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" />
                                <button onClick={fetchLatestPrice} className="bg-gray-100 border px-2 rounded text-xs">Fetch</button>
                            </div>
                            <input className="border p-2 rounded" value={marketCap} onChange={e => setMarketCap(e.target.value)} placeholder="Mkt Cap" />
                        </div>

                        <textarea className="w-full h-96 border p-4 font-mono text-xs whitespace-pre rounded bg-gray-50" value={pasteData} onChange={e => setPasteData(e.target.value)} placeholder="Paste the full table here..." />
                        
                        <button onClick={handleParseAndUpload} className="bg-blue-600 text-white font-bold py-3 px-6 rounded hover:bg-blue-700 w-full mt-4">
                            {status === 'Parsing...' ? 'Processing...' : 'Upload Data'}
                        </button>
                        {status && <div className="mt-4 p-4 bg-yellow-100 rounded text-center font-bold">{status}</div>}
                    </div>
                </div>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg shadow font-mono text-xs h-[600px] overflow-auto">
                    {debugLog.map((line, i) => <div key={i} className="mb-1 border-b border-gray-800 pb-1">{line}</div>)}
                </div>
            </div>
        </div>
    );
}