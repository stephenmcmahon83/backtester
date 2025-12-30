"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ValuationPage() {
    const [symbolList, setSymbolList] = useState<string[]>([]);
    const [ticker, setTicker] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState<any[]>([]);
    const [financialHistory, setFinancialHistory] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        const fetchSymbols = async () => {
            const { data } = await supabase.from('financial_cache').select('symbol').order('symbol');
            if (data) setSymbolList(Array.from(new Set(data.map((r: any) => r.symbol))));
        };
        fetchSymbols();
    }, []);

    useEffect(() => {
        if (!ticker) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: finData } = await supabase.from('financial_cache').select('data').eq('symbol', ticker).single();
                const { data: priceData } = await supabase.from('stock_data').select('date, close').eq('symbol', ticker).order('date', { ascending: true });
                
                if (finData && priceData) {
                    const sortedHistory = [...finData.data.history].sort((a: any, b: any) => {
                        if (a.year === 'TTM') return 1;
                        if (b.year === 'TTM') return -1;
                        return parseInt(a.year) - parseInt(b.year);
                    });
                    setFinancialHistory(sortedHistory);
                    processData(finData.data.history, priceData);
                }
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        fetchData();
    }, [ticker]);

    const processData = (history: any[], priceHistory: any[]) => {
        const finMap: Record<string, any> = {};
        const latestFin = history.find((h:any) => h.year === "TTM") || history[0]; 
        history.forEach((h: any) => { if (h.year && h.year !== "TTM") finMap[h.year] = h; });

        let totalPE = 0, countPE = 0;
        history.forEach((h: any) => {
            if(h.year === "TTM") return;
            const yearPrices = priceHistory.filter((p: any) => p.date.startsWith(h.year));
            if (yearPrices.length > 0 && h.eps > 0) {
                const avgPrice = yearPrices.reduce((sum: number, p: any) => sum + p.close, 0) / yearPrices.length;
                const pe = avgPrice / h.eps;
                if (pe > 5 && pe < 60) { totalPE += pe; countPE++; }
            }
        });
        const normalPE = countPE > 0 ? totalPE / countPE : 15;

        const granularData = priceHistory.filter((_, index) => index % 5 === 0).map((pricePoint: any) => {
            const dateObj = new Date(pricePoint.date);
            const currentYear = dateObj.getFullYear();
            const startOfYear = new Date(currentYear, 0, 1).getTime();
            const endOfYear = new Date(currentYear + 1, 0, 1).getTime();
            const progress = (dateObj.getTime() - startOfYear) / (endOfYear - startOfYear);
            const thisYearData = finMap[currentYear.toString()];
            const nextYearData = finMap[(currentYear + 1).toString()];
            let interpolatedEPS = thisYearData?.eps || 0;
            if (thisYearData && nextYearData) {
                interpolatedEPS = thisYearData.eps + ((nextYearData.eps - thisYearData.eps) * progress);
            }
            if (interpolatedEPS !== 0) {
                return {
                    date: pricePoint.date,
                    price: pricePoint.close,
                    fairValue: interpolatedEPS * 15,
                    normalValue: interpolatedEPS * normalPE,
                    earningsArea: interpolatedEPS * 15
                };
            }
            return null;
        }).filter(item => item !== null);
        setChartData(granularData);

        if (granularData.length > 0 && latestFin) {
            const currentPrice = granularData[granularData.length - 1].price;
            const fcfYield = latestFin.fcfPerShare ? (latestFin.fcfPerShare / currentPrice) * 100 : 0;
            const roic = latestFin.roic || 0;
            const ltDebt = latestFin.longTermDebt || 0;
            const equity = latestFin.totalEquity || 0;
            const debtToCap = (ltDebt + equity) > 0 ? (ltDebt / (ltDebt + equity)) * 100 : 0;
            
            const validHistory = history.filter((h:any) => h.year !== "TTM").sort((a:any, b:any) => parseInt(b.year) - parseInt(a.year));
            const startEps = validHistory[validHistory.length - 1]?.eps || 0;
            const endEps = validHistory[0]?.eps || 0;
            const cagr = (startEps > 0) ? ((Math.pow(endEps / startEps, 1 / (validHistory.length - 1)) - 1) * 100).toFixed(1) : "N/A";
            const pe = currentPrice / latestFin.eps;

            setStats({
                price: currentPrice,
                pe: pe,
                normalPE: normalPE,
                growth: cagr,
                yield: latestFin.dividendShare ? (latestFin.dividendShare / currentPrice) * 100 : 0,
                fcfYield: fcfYield,
                roic: roic,
                debtToCap: debtToCap
            });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800 select-none" onContextMenu={(e) => e.preventDefault()}>
            
            {/* HEADER */}
            <div className="bg-white border border-slate-200 p-4 rounded-lg mb-4 flex items-center justify-between shadow-sm w-full max-w-[95%] mx-auto">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Valuation Graphs</h1>
                    <select value={ticker} onChange={(e) => setTicker(e.target.value)} className="border border-slate-300 rounded p-2 font-bold text-slate-700 bg-white">
                        <option value="" disabled>Select Ticker</option>
                        {symbolList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                {ticker && stats && (
                    <div className="text-right">
                        <span className="text-3xl font-bold text-slate-900">${stats.price.toFixed(2)}</span>
                        <div className="text-xs text-slate-500 font-bold uppercase">Current Price</div>
                    </div>
                )}
            </div>

            {loading && <div className="text-center py-20 text-slate-500">Loading Data...</div>}

            {!loading && chartData.length > 0 && (
                <div className="w-full max-w-[95%] mx-auto space-y-4">
                    
                    {/* DASHBOARD STATS */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        <DashboardCard label="Current P/E (TTM)" value={`${stats?.pe.toFixed(2)}x`} highlight />
                        <DashboardCard label="Normal P/E" value={`${stats?.normalPE.toFixed(2)}x`} color="text-blue-600" />
                        <DashboardCard label="EPS Growth" value={`${stats?.growth}%`} color="text-green-600" />
                        <DashboardCard label="Div Yield" value={`${stats?.yield.toFixed(2)}%`} />
                        <DashboardCard label="FCF Yield" value={`${stats?.fcfYield.toFixed(2)}%`} color={stats?.fcfYield > 4 ? 'text-green-600' : 'text-slate-900'} />
                        <DashboardCard label="ROIC" value={`${stats?.roic.toFixed(1)}%`} color={stats?.roic > 15 ? 'text-green-600' : 'text-slate-900'} />
                        <DashboardCard label="Debt / Cap" value={`${stats?.debtToCap.toFixed(0)}%`} color={stats?.debtToCap > 60 ? 'text-red-600' : 'text-slate-900'} />
                    </div>

                    {/* DEFINITION BAR */}
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex flex-col md:flex-row gap-6 text-xs text-blue-800">
                        <div>
                            <span className="font-bold">Current P/E (TTM):</span> Current Price divided by Trailing 12-Month Earnings. Shows what you pay today for the last year of actual earnings.
                        </div>
                        <div>
                            <span className="font-bold">Normal P/E:</span> The historical average P/E ratio for this specific stock over the timeframe shown. Used to identify mean reversion.
                        </div>
                    </div>

                    {/* CHART */}
                    <div className="bg-white p-4 border border-slate-200 shadow-sm rounded-lg">
                        <div className="h-[550px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                                    <defs>
                                        <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tickFormatter={(date) => date.substring(0, 4)} ticks={getYearTicks(chartData)} tick={{fill: '#94a3b8', fontSize: 12}} axisLine={{stroke: '#e2e8f0'}} tickLine={false} minTickGap={30} height={40} />
                                    <YAxis tick={{fill: '#94a3b8', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} domain={['auto', 'auto']} />
                                    
                                    {/* CUSTOM TOOLTIP */}
                                    <Tooltip content={<CustomTooltip />} />
                                    
                                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                    
                                    {/* LEGENDTYPE=NONE HIDES "Earnings Area" from the bottom legend */}
                                    <Area 
                                        type="monotone" 
                                        dataKey="earningsArea" 
                                        fill="url(#colorEarnings)" 
                                        stroke="none" 
                                        name="Earnings Area"
                                        tooltipType="none"
                                        legendType="none"
                                    />
                                    
                                    <Line type="monotone" dataKey="fairValue" stroke="#f97316" strokeWidth={3} dot={false} name="15x P/E (Fair Value)" />
                                    <Line type="monotone" dataKey="normalValue" stroke="#2563eb" strokeWidth={3} dot={false} name={`Normal P/E (${stats?.normalPE.toFixed(1)}x)`} />
                                    <Line type="monotone" dataKey="price" stroke="#0f172a" strokeWidth={2} dot={false} name="Stock Price" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* FINANCIAL TABLE */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-sm">Financial Data</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-3 py-2 whitespace-nowrap sticky left-0 bg-slate-50 border-r border-slate-200">Metric</th>
                                        {financialHistory.map((h:any, i:number) => (
                                            <th key={i} className="px-2 py-2 text-right whitespace-nowrap min-w-[70px]">{h.year}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <GroupHeader label="Per Share Data" />
                                    <TableRow label="Revenue / Share" data={financialHistory} field="revenuePerShare" format={fmtNum} />
                                    <TableRow label="Basic EPS (GAAP)" data={financialHistory} field="eps" format={fmtNum} highlight />
                                    <TableRow label="FCF / Share" data={financialHistory} field="fcfPerShare" format={fmtNum} />
                                    <TableRow label="Dividends" data={financialHistory} field="dividendShare" format={fmtNum} />
                                    <TableRow label="Book Value" data={financialHistory} field="bookValue" format={fmtNum} />
                                    <TableRow label="Tangible BV" data={financialHistory} field="tangibleBookValue" format={fmtNum} />
                                    
                                    <GroupHeader label="Income Statement" />
                                    <TableRow label="Revenue" data={financialHistory} field="revenue" format={fmtCompact} />
                                    <TableRow label="Operating Margin" data={financialHistory} field="operatingMargin" format={fmtPct} />
                                    <TableRow label="Depreciation" data={financialHistory} field="depreciation" format={fmtCompact} />
                                    <TableRow label="Net Income" data={financialHistory} field="netIncome" format={fmtCompact} />
                                    <TableRow label="Tax Rate" data={financialHistory} field="taxRate" format={fmtPct} />
                                    <TableRow label="Profit Margin" data={financialHistory} field="profitMargin" format={fmtPct} />

                                    <GroupHeader label="Balance Sheet" />
                                    <TableRow label="Working Capital" data={financialHistory} field="workingCapital" format={fmtCompact} />
                                    <TableRow label="Long Term Debt" data={financialHistory} field="longTermDebt" format={fmtCompact} />
                                    <TableRow label="Total Equity" data={financialHistory} field="totalEquity" format={fmtCompact} />
                                    <TableRow label="Shares Out" data={financialHistory} field="sharesOutstanding" format={fmtCompact} />

                                    <GroupHeader label="Returns" />
                                    <TableRow label="ROIC" data={financialHistory} field="roic" format={fmtPct} highlight />
                                    <TableRow label="Return on Capital" data={financialHistory} field="roc" format={fmtPct} />
                                    <TableRow label="ROE" data={financialHistory} field="roe" format={fmtPct} />
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- NEW CUSTOM TOOLTIP COMPONENT ---
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // Need to find specific lines by dataKey because order varies
        const pricePoint = payload.find((p: any) => p.dataKey === 'price');
        const fairPoint = payload.find((p: any) => p.dataKey === 'fairValue');
        const normalPoint = payload.find((p: any) => p.dataKey === 'normalValue');

        const price = pricePoint ? pricePoint.value : 0;
        const fair = fairPoint ? fairPoint.value : 0;
        const normal = normalPoint ? normalPoint.value : 0;

        // Calculate % Diff (Upside/Downside)
        const fairDiff = price > 0 ? ((fair - price) / price) * 100 : 0;
        const normalDiff = price > 0 ? ((normal - price) / price) * 100 : 0;

        return (
            <div className="bg-white p-3 border border-slate-200 rounded shadow-lg text-xs min-w-[200px]">
                <p className="font-bold text-slate-500 mb-2">{new Date(label).toLocaleDateString()}</p>
                
                <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900">Stock Price:</span>
                    <span>${price.toFixed(2)}</span>
                </div>
                
                <div className="h-px bg-slate-100 my-2"></div>

                <div className="flex justify-between items-center mb-1">
                    <span className="text-orange-500 font-bold">15x P/E:</span>
                    <span className="font-mono">
                        ${fair.toFixed(2)} 
                        <span className={`ml-2 ${fairDiff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                           ({fairDiff > 0 ? '+' : ''}{fairDiff.toFixed(1)}%)
                        </span>
                    </span>
                </div>

                <div className="flex justify-between items-center">
                    <span className="text-blue-600 font-bold">Normal P/E:</span>
                    <span className="font-mono">
                        ${normal.toFixed(2)}
                        <span className={`ml-2 ${normalDiff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                           ({normalDiff > 0 ? '+' : ''}{normalDiff.toFixed(1)}%)
                        </span>
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

// --- HELPERS ---
const fmtNum = (v:number) => v ? v.toFixed(2) : '-';
const fmtPct = (v:number) => v ? v.toFixed(2) + '%' : '-';
const fmtCompact = (v: number) => {
    if (!v && v !== 0) return '-';
    const val = Math.abs(v);
    if (val >= 1000) return (v / 1000).toFixed(1) + 'B';
    return v.toFixed(0) + 'M';
};

const GroupHeader = ({label}:any) => (
    <tr className="bg-slate-100 border-y border-slate-200">
        <td colSpan={100} className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-100">{label}</td>
    </tr>
);

const TableRow = ({ label, data, field, format, highlight }: any) => (
    <tr className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors">
        <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap sticky left-0 bg-white border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{label}</td>
        {data.map((h: any, i: number) => (
            <td key={i} className={`px-2 py-2 text-right font-mono text-slate-600 ${highlight ? 'font-bold text-blue-700' : ''}`}>
                {h[field] !== undefined ? format(h[field]) : '-'}
            </td>
        ))}
    </tr>
);

const DashboardCard = ({ label, value, highlight, color }: any) => (
    <div className={`p-3 rounded border ${highlight ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-100'}`}>
        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 truncate">{label}</div>
        <div className={`text-base font-mono font-bold ${color || 'text-slate-900'}`}>{value}</div>
    </div>
);

const getYearTicks = (data: any[]) => {
    const ticks: string[] = [];
    let currentYear = "";
    data.forEach(d => { const year = d.date.substring(0, 4); if (year !== currentYear) { ticks.push(d.date); currentYear = year; } });
    return ticks;
};