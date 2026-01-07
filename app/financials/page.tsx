"use client";

import { useState, useEffect } from 'react';
import Head from 'next/head';
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

    // --- Copy/Paste Protection ---
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => e.preventDefault();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                (e.ctrlKey || e.metaKey) && 
                ['c', 'v', 'x', 'a', 'u', 's'].includes(e.key.toLowerCase())
            ) {
                e.preventDefault();
            }
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
                e.preventDefault();
            }
        };
        const handleSelectStart = (e: Event) => e.preventDefault();
        const handleDragStart = (e: Event) => e.preventDefault();
        const handleCopy = (e: Event) => e.preventDefault();

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('selectstart', handleSelectStart);
        document.addEventListener('dragstart', handleDragStart);
        document.addEventListener('copy', handleCopy);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('selectstart', handleSelectStart);
            document.removeEventListener('dragstart', handleDragStart);
            document.removeEventListener('copy', handleCopy);
        };
    }, []);

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
    
    // --- TABLE GENERATION ---
    const renderTable = (rows: any[]) => {
        if (!data || !data.history) return null;
        
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
        <>
            {/* SEO Meta Tags */}
            <Head>
                <title>Stock Valuation Tool | Financial Statement Analysis & Fair Value Calculator</title>
                <meta 
                    name="description" 
                    content="Analyze stocks using classic valuation methods. View 20 years of financial data including income statements, balance sheets, cash flow, and key profitability ratios." 
                />
                <meta name="keywords" content="stock valuation, fair value, fundamental analysis, financial ratios, EPS, book value, ROE, ROIC, income statement, balance sheet" />
                <meta name="robots" content="index, follow" />
            </Head>

            <div 
                className="p-8 max-w-[1800px] mx-auto min-h-screen bg-gray-50"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' } as React.CSSProperties}
            >
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
                        {loading ? "Loading..." : "Load Data"}
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

                        {/* --- EDUCATIONAL CONTENT SECTION --- */}
                        <section className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Understanding the Financial Data</h2>
                            
                            <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                                
                                {/* Data Warning */}
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                                    <p className="text-amber-800 text-sm">
                                        <strong>Note:</strong> Some stocks—particularly ADRs (American Depositary Receipts), foreign companies, and certain smaller-cap names—may have incomplete or missing data for certain years or metrics. This is a limitation of the underlying data sources and does not indicate an error. If you see dashes or zeros where you expect numbers, the data simply wasn't available. Always cross-reference with official SEC filings or the company's investor relations page for critical decisions.
                                    </p>
                                </div>

                                <p>
                                    This tool gives you up to 20 years of financial history in one place, organized into four tabs that cover the most important aspects of a company's financial health. The real value isn't in any single number—it's in seeing how these metrics evolve over time. A company with improving margins and growing free cash flow tells a very different story than one where profitability is eroding and debt is piling up. Scan left to right across the years to spot trends, inflection points, and red flags.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Ratios Tab: The Quality Indicators</h3>

                                <p>
                                    The Ratios tab distills the raw financial statements into metrics that reveal business quality. <strong>Gross Margin</strong> tells you how much profit the company keeps after paying for the direct cost of its products or services—higher is generally better and indicates pricing power or operational efficiency. <strong>Operating Margin</strong> goes a step further by subtracting overhead costs like R&D and administrative expenses. <strong>Net Profit Margin</strong> is the bottom line: what percentage of each revenue dollar turns into actual profit after everything is paid, including taxes and interest.
                                </p>

                                <p>
                                    <strong>ROE (Return on Equity)</strong> measures how efficiently the company uses shareholder capital to generate profits. A consistently high ROE—say, above 15%—often indicates a competitive advantage. <strong>ROIC (Return on Invested Capital)</strong> is similar but includes debt in the calculation, making it a more complete picture of how well management deploys all the capital at its disposal. The <strong>Current Ratio</strong> (current assets divided by current liabilities) shows whether the company can cover its short-term obligations—below 1.0 can be a warning sign. <strong>Debt to Equity</strong> reveals how leveraged the company is; a ratio climbing over time suggests increasing financial risk.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Income Tab: The Profit Story</h3>

                                <p>
                                    The Income Statement shows how the company makes money and where it goes. Start at the top with <strong>Total Revenue</strong>—is it growing consistently, or is growth slowing down? <strong>Cost of Revenue</strong> and <strong>Gross Profit</strong> show the fundamental economics of the business. A company where cost of revenue grows faster than revenue is losing its margin advantage. Further down, <strong>R&D</strong> and <strong>SG&A</strong> expenses reveal how much the company spends on innovation versus sales and administration. Heavy R&D can be a positive sign for tech and pharma companies; bloated SG&A might indicate inefficiency.
                                </p>

                                <p>
                                    <strong>Operating Income (EBIT)</strong> strips out interest and taxes to show the core profitability of the business operations. <strong>Interest Expense</strong> matters for companies with significant debt—if it's eating into profits, that's capital not available for growth or dividends. <strong>Net Income</strong> is the final profit number after everything, and <strong>EPS (Diluted)</strong> divides that by the share count to show what each share earned. Watch for share count changes over time—companies that consistently buy back stock concentrate earnings into fewer shares, boosting EPS even if net income is flat.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Balance Sheet Tab: The Foundation</h3>

                                <p>
                                    The Balance Sheet is a snapshot of what the company owns and owes at a given moment. <strong>Cash & Equivalents</strong> and <strong>Short-Term Investments</strong> represent the company's liquidity cushion—money available to weather downturns, fund acquisitions, or return to shareholders. <strong>Total Current Assets</strong> includes inventory and receivables, while <strong>Property, Plant & Equipment</strong> shows investment in physical infrastructure. Asset-light businesses (like software companies) will have minimal PP&E; manufacturers and retailers will have much more.
                                </p>

                                <p>
                                    On the liability side, <strong>Short-Term Debt</strong> and <strong>Long-Term Debt</strong> are critical to monitor. Debt isn't inherently bad—it can be used productively to fund growth—but excessive debt creates risk, especially when interest rates rise or business slows. <strong>Total Liabilities</strong> versus <strong>Shareholder Equity</strong> gives you the big picture. A company where liabilities dwarf equity is highly leveraged; one with more equity than liabilities has a stronger foundation.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Cash Flow Tab: The Truth Check</h3>

                                <p>
                                    Cash flow is often called the most honest financial statement because it's harder to manipulate than earnings. <strong>Operating Cash Flow</strong> shows the actual cash generated by business operations—this should ideally exceed net income over time. If net income is high but operating cash flow is weak, earnings quality might be poor (possibly due to aggressive accounting or uncollected receivables). <strong>Depreciation & Amortization</strong> and <strong>Stock-Based Compensation</strong> are non-cash charges that get added back to reconcile net income with cash flow.
                                </p>

                                <p>
                                    <strong>Capital Expenditures (CapEx)</strong> represents money spent on maintaining or expanding the business—factories, equipment, technology infrastructure. Subtracting CapEx from operating cash flow gives you <strong>Free Cash Flow</strong>, arguably the most important number for investors. Free cash flow is what's actually available to pay dividends, buy back shares, pay down debt, or make acquisitions. A company can have great earnings but terrible free cash flow if it's constantly reinvesting just to stay in place. Finally, <strong>Dividends Paid</strong> shows how much cash went back to shareholders—compare this to free cash flow to see if the dividend is sustainable or stretching the company's resources.
                                </p>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </>
    );
}