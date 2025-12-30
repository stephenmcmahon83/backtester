"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function FinancialsPage() {
    const [symbolList, setSymbolList] = useState<string[]>([]);
    const [selectedTicker, setSelectedTicker] = useState<string>('');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'ratios' | 'income' | 'balance' | 'cashflow'>('ratios');

    useEffect(() => {
        const fetchSymbols = async () => {
            const { data } = await supabase
                .from('financial_cache')
                .select('symbol')
                .order('symbol', { ascending: true });

            if (data) {
                const uniqueSymbols = Array.from(new Set(data.map((r: any) => r.symbol)));
                setSymbolList(uniqueSymbols);
            }
        };
        fetchSymbols();
    }, []);

    const fetchFinancials = async (ticker: string) => {
        if (!ticker) return;
        setLoading(true);
        setError(null);
        setData(null);
        try {
            const res = await fetch(`/api/financials?ticker=${ticker}`);
            const result = await res.json();
            if (result.error) throw new Error(result.error);
            setData(result);
        } catch (err: any) {
            setError(err.message || "Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    // --- VALUATION MODELS ---
    const getValuations = () => {
        if (!data || !data.history || data.history.length < 5) return null;

        const eps = data.overview.EPS;
        const bvps = data.overview.BookValue;
        const currentPrice = data.price; 
        
        // Lynch: 5 Year Net Income CAGR
        // History is Newest -> Oldest in DB. 
        const niCurrent = data.history[0].netIncome;
        const niOld = data.history[4].netIncome;
        
        let growthRate = 0;
        if(niCurrent > 0 && niOld > 0) {
            growthRate = (Math.pow(niCurrent / niOld, 1/5) - 1) * 100;
        }

        let lynchValue = 0;
        if (eps > 0 && growthRate > 0) {
            lynchValue = growthRate * eps; 
        }

        // Graham: Sqrt(22.5 * EPS * BVPS)
        let grahamValue = 0;
        if (eps > 0 && bvps > 0) {
            grahamValue = Math.sqrt(22.5 * eps * bvps);
        }

        return {
            price: currentPrice,
            lynch: lynchValue,
            lynchDiff: lynchValue ? ((currentPrice - lynchValue) / lynchValue) * 100 : 0,
            graham: grahamValue,
            grahamDiff: grahamValue ? ((currentPrice - grahamValue) / grahamValue) * 100 : 0,
            growthRate
        };
    };

    const valuations = getValuations();

    // --- FORMATTERS ---
    const formatB = (num: number) => {
        if (!num && num !== 0) return "-";
        if (Math.abs(num) < 1000000000) return `$${(num / 1e6).toFixed(0)}M`;
        return `$${(num / 1e9).toFixed(2)}B`;
    };
    
    const formatPct = (num: number) => (num || num === 0) ? `${num.toFixed(1)}%` : "-";
    const formatX = (num: number) => (num || num === 0) ? `${num.toFixed(2)}x` : "-";
    const formatCurrency = (num: number) => (num || num === 0) ? `$${num.toFixed(2)}` : "-";
    
    // --- TABLE GENERATION (FIXED) ---
    const renderTable = (rows: any[]) => {
        if (!data || !data.history) return null;
        
        // Take 15 years, Reverse so Oldest is Left, Newest is Right
        const history = [...data.history].slice(0, 15).reverse(); 
        const years = history.map((h: any) => h.year);

        return (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto pb-2">
                    <table className="min-w-full text-sm whitespace-nowrap">
                        <thead>
                            <tr className="bg-gray-100 border-b">
                                <th className="sticky left-0 bg-gray-100 px-6 py-4 text-left font-bold text-gray-800 w-64 shadow-sm z-10 border-r border-gray-200">Metric</th>
                                {years.map(y => <th key={y} className="px-6 py-4 text-right font-bold text-gray-800">{y}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map((row, i) => (
                                <tr key={i} className={row.isHeader ? "bg-gray-50 font-bold" : "hover:bg-gray-50"}>
                                    <td className={`sticky left-0 bg-white px-6 py-3 shadow-sm border-r border-gray-200 ${row.isHeader ? 'text-gray-500 text-xs uppercase' : 'text-gray-700 font-medium'}`}>
                                        {row.label}
                                    </td>
                                    {years.map((yearStr, idx) => {
                                        if(row.isHeader) return <td key={idx} className="bg-gray-50"></td>;
                                        
                                        // THIS WAS THE FIX: Use index to get the data object
                                        const dataPoint = history[idx];
                                        const val = row.getValue(dataPoint) || 0;
                                        
                                        return <td key={idx} className={`px-6 text-right ${row.colorClass ? row.colorClass(val) : ''}`}>{row.format(val)}</td>
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // --- DEFINING ROWS FOR EACH TAB ---
    const getTabContent = () => {
        if (!data) return null;

        if (activeTab === 'ratios') {
            return renderTable([
                { isHeader: true, label: "Profitability Ratios" },
                { label: "Gross Margin %", format: formatPct, getValue: (h: any) => h.revenue ? (h.grossProfit / h.revenue) * 100 : 0 },
                { label: "Operating Margin %", format: formatPct, getValue: (h: any) => h.revenue ? (h.operatingIncome / h.revenue) * 100 : 0 },
                { label: "Net Profit Margin %", format: formatPct, getValue: (h: any) => h.revenue ? (h.netIncome / h.revenue) * 100 : 0 },
                { label: "ROE (Return on Equity)", format: formatPct, getValue: (h: any) => h.totalEquity ? (h.netIncome / h.totalEquity) * 100 : 0 },
                { label: "ROIC", format: formatPct, getValue: (h: any) => {
                    const investedCapital = (h.totalEquity || 0) + (h.shortTermDebt || 0) + (h.longTermDebt || 0) - (h.cashAndEquivalents || 0);
                    return investedCapital ? (h.operatingIncome * 0.79 / investedCapital) * 100 : 0;
                }},
                { isHeader: true, label: "Per Share Data" },
                { label: "EPS (Diluted)", format: formatCurrency, getValue: (h: any) => h.eps },
                { label: "Free Cash Flow / Share", format: formatCurrency, getValue: (h: any) => h.sharesOutstanding ? h.freeCashFlow / (h.sharesOutstanding/1000000) : 0 },
                { label: "Dividends / Share", format: formatCurrency, getValue: (h: any) => h.dividendShare || (h.sharesOutstanding ? Math.abs(h.dividendPayout || 0) / (h.sharesOutstanding/1000000) : 0) },
                
                { isHeader: true, label: "Liquidity & Health" },
                { label: "Current Ratio", format: formatX, getValue: (h: any) => h.currentLiabilities ? h.currentAssets / h.currentLiabilities : 0 },
                { label: "Debt to Equity", format: formatX, getValue: (h: any) => h.totalEquity ? (h.shortTermDebt + h.longTermDebt) / h.totalEquity : 0 },
            ]);
        }
        
        if (activeTab === 'income') {
            return renderTable([
                { label: "Total Revenue", format: formatB, getValue: (h: any) => h.revenue },
                { label: "Cost of Revenue", format: formatB, getValue: (h: any) => h.costOfRevenue },
                { label: "Gross Profit", format: formatB, getValue: (h: any) => h.grossProfit },
                { label: "R&D Expenses", format: formatB, getValue: (h: any) => h.rnd },
                { label: "SG&A Expenses", format: formatB, getValue: (h: any) => h.sga },
                { label: "Operating Income (EBIT)", format: formatB, getValue: (h: any) => h.operatingIncome },
                { label: "Interest Expense", format: formatB, getValue: (h: any) => h.interestExpense }, 
                { label: "Pre-Tax Income", format: formatB, getValue: (h: any) => h.preTaxIncome },
                { label: "Income Tax", format: formatB, getValue: (h: any) => h.tax },
                { label: "Net Income", format: formatB, getValue: (h: any) => h.netIncome },
                { isHeader: true, label: "Supplemental" },
                { label: "Shares Outstanding (Diluted)", format: formatB, getValue: (h: any) => h.sharesOutstanding },
                { label: "EPS (Diluted)", format: formatCurrency, getValue: (h: any) => h.eps },
            ]);
        }

        if (activeTab === 'balance') {
             return renderTable([
                { label: "Cash & Equivalents", format: formatB, getValue: (h: any) => h.cashAndEquivalents },
                { label: "Short-Term Investments", format: formatB, getValue: (h: any) => h.shortTermInvestments },
                { label: "Total Current Assets", format: formatB, getValue: (h: any) => h.currentAssets },
                { label: "Property, Plant & Equipment", format: formatB, getValue: (h: any) => h.ppe },
                { label: "Total Assets", format: formatB, getValue: (h: any) => h.totalAssets },
                { isHeader: true, label: "Liabilities" },
                { label: "Accounts Payable", format: formatB, getValue: (h: any) => h.accountsPayable },
                { label: "Short-Term Debt", format: formatB, getValue: (h: any) => h.shortTermDebt },
                { label: "Total Current Liabilities", format: formatB, getValue: (h: any) => h.currentLiabilities },
                { label: "Long-Term Debt", format: formatB, getValue: (h: any) => h.longTermDebt },
                { label: "Total Liabilities", format: formatB, getValue: (h: any) => h.totalLiabilities },
                { isHeader: true, label: "Equity" },
                { label: "Shareholder Equity", format: formatB, getValue: (h: any) => h.totalEquity },
            ]);
        }
         if (activeTab === 'cashflow') {
            return renderTable([
                { label: "Net Income", format: formatB, getValue: (h: any) => h.netIncome },
                { label: "Depreciation & Amort", format: formatB, getValue: (h: any) => h.depreciation },
                { label: "Stock Based Comp", format: formatB, getValue: (h: any) => h.stockBasedComp },
                { label: "Operating Cash Flow", format: formatB, getValue: (h: any) => h.operatingCashFlow },
                { label: "Capital Expenditures", format: formatB, getValue: (h: any) => h.capex },
                { label: "Free Cash Flow", format: formatB, getValue: (h: any) => h.freeCashFlow || (h.operatingCashFlow - Math.abs(h.capex || 0)) },
                { label: "Dividends Paid", format: formatB, getValue: (h: any) => h.dividendPayout },
            ]);
        }
    };

    return (
        <div className="p-8 max-w-[1800px] mx-auto min-h-screen bg-gray-50">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Corporate Valuation (20-Year)</h1>
            
            <div className="flex gap-4 mb-8">
                <select
                    value={selectedTicker}
                    onChange={(e) => setSelectedTicker(e.target.value)}
                    className="border p-3 rounded w-64 shadow-sm font-semibold"
                >
                    <option value="" disabled>Select Symbol</option>
                    {symbolList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button 
                    onClick={() => fetchFinancials(selectedTicker)}
                    disabled={loading || !selectedTicker}
                    className="bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? "Analyst Upgrade" : "Load Data"}
                </button>
            </div>

            {error && <div className="bg-red-100 text-red-700 p-4 mb-6 rounded">{error}</div>}

            {data && valuations && (
                <div className="space-y-8">
                    
                    {/* --- VALUATION MODELS --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Lynch Value */}
                        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Peter Lynch Fair Value</h3>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="text-sm text-gray-500">Fair Price (Growth * EPS)</p>
                                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(valuations.lynch)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500">Current Price</p>
                                    <p className="text-xl font-semibold text-gray-700">{formatCurrency(valuations.price)}</p>
                                </div>
                            </div>
                            <div className={`p-3 rounded text-center font-bold ${valuations.lynchDiff > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {valuations.lynch === 0 ? "N/A (Neg Earnings)" : 
                                    `${Math.abs(valuations.lynchDiff).toFixed(1)}% ${valuations.lynchDiff > 0 ? 'OVERVALUED' : 'UNDERVALUED'}`
                                }
                            </div>
                             <p className="text-xs text-gray-400 mt-2">Based on 5-Year Net Income CAGR: {formatPct(valuations.growthRate)}</p>
                        </div>

                        {/* Graham Number */}
                        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Benjamin Graham Value</h3>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="text-sm text-gray-500">Graham Number</p>
                                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(valuations.graham)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500">Current Price</p>
                                    <p className="text-xl font-semibold text-gray-700">{formatCurrency(valuations.price)}</p>
                                </div>
                            </div>
                            <div className={`p-3 rounded text-center font-bold ${valuations.grahamDiff > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {valuations.graham === 0 ? "N/A" : 
                                    `${Math.abs(valuations.grahamDiff).toFixed(1)}% ${valuations.grahamDiff > 0 ? 'OVERVALUED' : 'UNDERVALUED'}`
                                }
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Formula: √(22.5 * EPS * Book Value)</p>
                        </div>
                    </div>

                    {/* Tabs & Table */}
                    <div>
                        <div className="border-b border-gray-200 mb-4 overflow-x-auto">
                            <nav className="-mb-px flex space-x-8">
                                {['ratios', 'income', 'balance', 'cashflow'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab as any)}
                                        className={`pb-4 px-1 border-b-2 font-medium text-sm uppercase whitespace-nowrap ${
                                            activeTab === tab
                                                ? 'border-blue-500 text-blue-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        {getTabContent()}
                    </div>
                </div>
            )}
        </div>
    );
}