"use client";

import React, { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/* ---------- Types ---------- */
interface PricePoint { date: string; close: number }
interface HistoryItem {
  year: string; revenue: number; netIncome: number; eps: number;
  revenuePerShare: number; dividendShare: number; bookValue: number;
  sharesOutstanding: number; longTermDebt: number; totalEquity: number;
  operatingMargin: number; profitMargin: number;
  roe: number; roic: number; currentRatio: number; 
  debtToEquity: number; evEbitda: number;
  yearHigh: number; yearLow: number; fairValue: number; 
}

interface ValuationData {
  symbol: string; price: number; price_history: PricePoint[];
  overview: { isFinancial: boolean; Description: string }; history: HistoryItem[];
}

/* ---------- CONFIG ---------- */
const BACKEND_URL = "https://valuation-backend-xvuh.onrender.com";

/* ---------- Component ---------- */
export default function StockAnalyzer() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ValuationData | null>(null);
  const [error, setError] = useState("");

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

  /* ------- Fetch ------- */
  const handleSearch = async () => {
    if (!ticker) return;
    setLoading(true); setError(""); setData(null);

    try {
      const r = await fetch(`${BACKEND_URL}/fetch-valuation-data/${ticker}`);
      
      if (!r.ok) {
        throw new Error(`Server Error: ${r.status}. The backend might be waking up (wait 1 min) or the ticker is invalid.`);
      }
      
      const j = await r.json();
      
      const sorted = [...j.data.history].sort((a: HistoryItem, b: HistoryItem) =>
        a.year === "TTM" ? 1 : b.year === "TTM" ? -1 : parseInt(a.year) - parseInt(b.year)
      );
      
      setData({ ...j.data, history: sorted });
    } catch (e: any) { 
      setError(e.message) 
    } finally { 
      setLoading(false); 
    }
  };

  /* ------- Chart Data Construction ------- */
  const chartPoints = useMemo(() => {
    if (!data) return [];

    const mergedData = new Map<string, any>();

    if (data.price_history && data.price_history.length > 0) {
        data.price_history.forEach(p => {
            mergedData.set(p.date, {
                date: p.date,
                price: p.close
            });
        });
    }

    const fiscalRows = data.history.filter(h => h.year !== "TTM" && h.fairValue > 0);
    fiscalRows.forEach(h => {
        const dateKey = `${h.year}-12-31`;
        const existing = mergedData.get(dateKey) || { date: dateKey };
        
        mergedData.set(dateKey, {
            ...existing,
            fairValue: h.fairValue
        });
    });

    const ttmItem = data.history.find(h => h.year === "TTM") || data.history[data.history.length - 1];
    if (ttmItem && ttmItem.fairValue > 0) {
        mergedData.set("Now", {
            date: "Now",
            price: data.price,
            fairValue: ttmItem.fairValue
        });
    }

    return Array.from(mergedData.values()).sort((a, b) => {
        if (a.date === "Now") return 1;
        if (b.date === "Now") return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [data]);

  /* ------- X-Axis Ticks Calculation ------- */
  const xAxisTicks = useMemo(() => {
    if (!chartPoints.length) return [];
    
    const ticks: string[] = [];
    const seenYears = new Set<string>();

    chartPoints.forEach(point => {
        if (point.date === "Now") {
            ticks.push("Now");
            return;
        }
        const year = point.date.substring(0, 4);
        if (!seenYears.has(year)) {
            seenYears.add(year);
            ticks.push(point.date); 
        }
    });
    return ticks;
  }, [chartPoints]);

  /* ------- UI ------- */
  return (
    <>
      {/* SEO Meta Tags */}
      <Head>
        <title>Stock Valuation Tool | 15x Earnings Fair Value Calculator</title>
        <meta 
          name="description" 
          content="Analyze stock valuations using the 15x earnings model. View historical EPS, revenue, margins, ROE, ROIC, and compare current price to fair value estimates." 
        />
        <meta name="keywords" content="stock valuation, fair value, 15x earnings, EPS, ROE, ROIC, fundamental analysis, stock analyzer, intrinsic value" />
        <meta name="robots" content="index, follow" />
      </Head>

      <div 
        className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' } as React.CSSProperties}
      >
        {/* header */}
        <Header
          ticker={ticker} setTicker={setTicker}
          loading={loading} currentPrice={data?.price}
          onSearch={handleSearch}
        />

        {loading && <Alert color="blue" msg={`Analyzing ${ticker}… (Note: If this is the first search in 15 mins, it may take 45 seconds to wake up the server)`} />}
        {error && <Alert color="red" msg={error} />}

        {data && !loading && (
          <div className="max-w-[95%] mx-auto space-y-6">
            {/* chart */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <Chart points={chartPoints} history={data.history} customTicks={xAxisTicks} />
            </div>

            {/* table */}
            <FinancialTable data={data} />

            {/* --- EDUCATIONAL CONTENT SECTION --- */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Understanding the Valuation Data</h2>
              
              <div className="prose prose-slate max-w-none text-slate-700 space-y-4">
                
                {/* Data Warning */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <p className="text-amber-800 text-sm">
                    <strong>Note:</strong> Some stocks—particularly ADRs (American Depositary Receipts), foreign companies, REITs, and certain smaller-cap names—may have incomplete or missing data for certain years or metrics. Financial sector companies (banks, insurance) may also show dashes for metrics that don't apply to their business models. This is a limitation of the underlying data sources and does not indicate an error. Always cross-reference with official SEC filings or the company's investor relations page for critical investment decisions.
                  </p>
                </div>

                <p>
                  This tool gives you a visual and numerical breakdown of a company's financial history, designed to help you quickly assess whether a stock is trading above or below a reasonable estimate of fair value. The chart plots the actual stock price against a simple valuation benchmark—15 times earnings per share—so you can see at a glance how the market's pricing has compared to the company's underlying profitability over time.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">The 15x Earnings Model</h3>

                <p>
                  The orange line on the chart represents 15 times the company's annual EPS. Why 15? It's a rough approximation of fair value for a stable, average-growth company. A P/E ratio of 15 implies that if you bought the entire company at that price, it would take 15 years of current earnings to recoup your investment—assuming no growth. Faster-growing companies often trade at higher multiples; slower growers or companies in decline often trade below. By comparing the actual stock price (black line) to the 15x EPS line, you can see whether the market has historically been willing to pay a premium or demanded a discount relative to this benchmark.
                </p>

                <p>
                  When the black price line is well above the orange 15x line, the stock is trading at a premium—investors are optimistic about future growth. When it's below, the stock may be undervalued, or investors may be concerned about the company's prospects. Neither is automatically a buy or sell signal; context matters. A stock trading at 25x earnings might be a bargain if it's growing 30% a year, while a stock at 10x might be a trap if earnings are collapsing.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Per Share Data Section</h3>

                <p>
                  <strong>EPS (Earnings Per Share)</strong> is the foundation of most valuation work—it tells you how much profit the company earned for each share outstanding. Rising EPS over time is a positive sign; declining or erratic EPS raises questions. <strong>Dividends</strong> show cash returned to shareholders; compare this to EPS to see the payout ratio. If dividends exceed EPS consistently, that's unsustainable. <strong>Revenue Per Share</strong> removes the effect of share count changes and shows whether the company is growing its top line on a per-share basis—important because some companies grow revenue but dilute shareholders so heavily that per-share value doesn't increase.
                </p>

                <p>
                  <strong>Book Value</strong> represents the net assets of the company (assets minus liabilities) divided by shares outstanding. It's a rough measure of what shareholders would receive if the company liquidated. Stocks trading below book value may be undervalued—or the assets may be impaired. <strong>Stock Price High</strong> and <strong>Low</strong> show the trading range for each year, giving you a sense of volatility and how the market's sentiment has swung over time.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Valuation Ratios Section</h3>

                <p>
                  <strong>ROE (Return on Equity)</strong> measures how efficiently the company turns shareholder capital into profit. A consistently high ROE—above 15%—often indicates a durable competitive advantage. <strong>ROIC (Return on Invested Capital)</strong> is broader, including debt in the capital base; it shows how well management allocates all capital, not just equity. High ROIC businesses can reinvest profits at attractive rates, compounding value over time.
                </p>

                <p>
                  <strong>Debt to Equity</strong> reveals leverage. A ratio of 1.0 means the company has equal debt and equity; above 2.0 starts to get risky for most industries. Rising debt-to-equity over time is a warning sign. <strong>Current Ratio</strong> (current assets divided by current liabilities) shows short-term liquidity—can the company pay its bills over the next year? Below 1.0 means current liabilities exceed current assets. <strong>EV/EBITDA</strong> is an enterprise value multiple that accounts for debt; lower numbers suggest cheaper valuations, but compare within industries since capital intensity varies.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Company Totals Section</h3>

                <p>
                  <strong>Revenue</strong> and <strong>Net Income</strong> show the absolute size and profitability of the business. Growing revenue with stable or expanding profit margins is the ideal pattern. Flat revenue with shrinking margins suggests a company losing pricing power or facing cost pressures. <strong>Equity</strong> is the book value of shareholder ownership in absolute terms; <strong>Long-Term Debt</strong> shows the company's leverage in dollar terms. <strong>Shares Outstanding</strong> tracks dilution—if shares are increasing faster than earnings, EPS growth will lag net income growth, hurting per-share value.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Margins Section</h3>

                <p>
                  <strong>Operating Margin</strong> shows what percentage of revenue remains after paying for the cost of goods and operating expenses—it reflects the efficiency of the core business. <strong>Profit Margin</strong> (net margin) is the bottom line: what percentage of revenue turns into actual profit after all expenses including interest and taxes. Expanding margins over time suggest improving efficiency or pricing power; contracting margins may indicate competitive pressure or rising costs. Comparing margins to industry peers helps you understand whether a company is best-in-class or struggling to keep up.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Using This Tool Effectively</h3>

                <p>
                  The best way to use this data is to look for patterns and changes over time. Is EPS growing consistently? Are margins stable or improving? Is the company taking on more debt, or paying it down? Is the share count increasing or decreasing? A single year's numbers mean little in isolation—it's the trajectory that matters. The 15x earnings benchmark gives you a quick visual reference, but you should adjust your expectations based on the company's growth rate, competitive position, and industry dynamics. A high-quality compounder might deserve 25x or more; a cyclical business at peak earnings might be worth only 8x.
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- Header ---------- */
function Header({ ticker, setTicker, loading, currentPrice, onSearch }: any) {
  return (
    <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4 max-w-[95%] mx-auto">
      <div className="flex items-center gap-4 w-full md:w-auto">
        <h1 className="text-2xl font-bold text-blue-700">Valuation Tool</h1>
        <div className="flex gap-2">
          <input
            className="border border-slate-300 p-2 rounded-lg font-bold text-slate-700 uppercase focus:ring-2 focus:ring-blue-500 outline-none w-32 md:w-48"
            placeholder="TICKER"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            style={{ userSelect: 'text', WebkitUserSelect: 'text' } as React.CSSProperties}
          />
          <button
            onClick={onSearch}
            disabled={loading}
            className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "…" : "Go"}
          </button>
        </div>
      </div>
      {currentPrice && (
        <div className="text-right">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Current Price
          </div>
          <div className="text-3xl font-mono font-bold text-slate-900">
            ${currentPrice.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Chart ---------- */
function Chart({ points, history, customTicks }: { points: any[], history: HistoryItem[], customTicks: string[] }) {
  return (
    <>
      <div className="flex justify-between mb-4">
        <h3 className="font-bold text-slate-700">Valuation Model</h3>
        <div className="flex gap-6 text-xs font-bold">
          <span className="text-orange-500">● 15x Earnings</span>
          <span className="text-slate-900">● Stock Price</span>
        </div>
      </div>
      {points.length ? (
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                ticks={customTicks} 
                tick={{ fontSize: 11 }} 
                tickFormatter={(val) => val === "Now" ? "Now" : val.substring(0, 4)} 
              />
              <YAxis tickFormatter={(v) => `$${v}`} width={60} tick={{ fontSize: 10 }} />
              
              <Tooltip content={<TooltipBox history={history} />} />
              <Legend />
              
              <Line 
                type="stepAfter" 
                dataKey="fairValue" 
                stroke="#f97316" 
                strokeWidth={2} 
                dot={false} 
                name="15x Earnings" 
                connectNulls 
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#0f172a" 
                strokeWidth={1.5} 
                dot={false} 
                name="Stock Price" 
                connectNulls 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-slate-400">
          No chart data available
        </div>
      )}
    </>
  );
}

/* ---------- Financial Table ---------- */
function FinancialTable({ data }: { data: ValuationData }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Financial Data (USD)</h3>
        <span className={`text-xs font-bold px-2 py-1 rounded ${data.overview.isFinancial ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
          {data.overview.isFinancial ? "FINANCIAL" : "CORPORATE"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 sticky left-0 bg-slate-50 border-r border-slate-200 z-10">Metric</th>
              {data.history.map((h, i) => (
                <th key={i} className="px-4 py-3 text-center min-w-[90px]">{h.year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <GroupHeader label="Per Share Data" />
            <Row label="EPS" data={data.history} field="eps" fmt={fmtNum} highlight />
            <Row label="Dividends" data={data.history} field="dividendShare" fmt={fmtNum} />
            <Row label="Rev / Share" data={data.history} field="revenuePerShare" fmt={fmtNum} />
            <Row label="Book Value" data={data.history} field="bookValue" fmt={fmtNum} />
            
            <Row label="Stock Price High" data={data.history} field="yearHigh" fmt={fmtNum} />
            <Row label="Stock Price Low" data={data.history} field="yearLow" fmt={fmtNum} />
            <Row label="15x EPS" data={data.history} field="fairValue" fmt={fmtNum} highlight />

            <GroupHeader label="Valuation Ratios" />
            <Row label="ROE %" data={data.history} field="roe" fmt={fmtPct} />
            <Row label="ROIC %" data={data.history} field="roic" fmt={fmtPct} />
            <Row label="Debt / Equity" data={data.history} field="debtToEquity" fmt={fmtNum} />
            <Row label="Current Ratio" data={data.history} field="currentRatio" fmt={fmtNum} />
            <Row label="EV / EBITDA" data={data.history} field="evEbitda" fmt={fmtNum} />

            <GroupHeader label="Company Totals" />
            <Row label="Revenue" data={data.history} field="revenue" fmt={fmtCompact} />
            <Row label="Net Income" data={data.history} field="netIncome" fmt={fmtCompact} />
            <Row label="Equity" data={data.history} field="totalEquity" fmt={fmtCompact} />
            <Row label="LT Debt" data={data.history} field="longTermDebt" fmt={fmtCompact} />
            <Row label="Shares" data={data.history} field="sharesOutstanding" fmt={fmtCompact} />

            <GroupHeader label="Margins" />
            <Row label="Op Margin" data={data.history} field="operatingMargin" fmt={fmtPct} />
            <Row label="Profit Margin" data={data.history} field="profitMargin" fmt={fmtPct} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Smart Tooltip ---------- */
const TooltipBox = ({ active, payload, label, history }: any) => {
  if (!(active && payload)) return null;

  const priceItem = payload.find((p: any) => p.dataKey === 'price');
  const price = priceItem ? priceItem.value : null;

  let fairItem = payload.find((p: any) => p.dataKey === 'fairValue');
  let fair = fairItem ? fairItem.value : null;

  if (fair === null && history && label) {
    const yearStr = label === "Now" ? "TTM" : label.substring(0, 4);
    const hItem = history.find((h: any) => h.year === yearStr || (yearStr === "TTM" && h.year === "TTM"));
    if (hItem) {
        fair = hItem.fairValue;
    } else if (label !== "Now") {
       const match = history.find((h:any) => h.year === yearStr);
       if(match) fair = match.fairValue;
    }
  }
  
  let diffPct = null;
  if (price && fair) {
      diffPct = ((price - fair) / fair) * 100;
  }

  const displayLabel = label === "Now" ? "Now" : label.substring(0, 10);

  return (
    <div className="bg-white p-3 border border-slate-200 rounded shadow-lg text-xs min-w-[170px]">
      <p className="font-bold text-slate-500 mb-2">{displayLabel}</p>
      
      {price !== null && (
          <div className="flex justify-between items-center mb-1 text-slate-900">
            <span className="font-bold">Price:</span>
            <span className="font-mono ml-1">${price.toFixed(2)}</span>
          </div>
      )}
      
      {fair !== null && (
          <div className="flex justify-between items-center mb-1 text-orange-500">
            <span className="font-bold">15x EPS:</span>
            <span className="font-mono ml-1">${fair.toFixed(2)}</span>
          </div>
      )}
      
      {diffPct !== null && (
          <div className={`mt-2 pt-2 border-t border-slate-100 flex justify-between items-center font-bold ${diffPct > 0 ? 'text-red-600' : 'text-green-600'}`}>
              <span>{diffPct > 0 ? 'Premium:' : 'Discount:'}</span>
              <span>{diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%</span>
          </div>
      )}
    </div>
  );
};

/* ---------- Small helpers ---------- */
const Alert = ({ color, msg }: { color: "blue" | "red"; msg: string }) => (
  <div className={`max-w-[95%] mx-auto bg-${color}-50 border-l-4 border-${color}-500 p-4 mb-8 rounded text-${color}-700 font-bold`}>
    {msg}
  </div>
);

const GroupHeader = ({ label }: { label: string }) => (
  <tr className="bg-slate-100 border-y border-slate-200">
    <td colSpan={100} className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-100 z-10">
      {label}
    </td>
  </tr>
);

const Row = ({ label, data, field, fmt, highlight = false }: any) => (
  <tr className="bg-white border-b border-slate-100 hover:bg-blue-50/30 transition-colors group">
    <td className="px-4 py-3 font-medium text-slate-700 sticky left-0 bg-white border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-blue-50/30 transition-colors z-10">
      {label}
    </td>
    {data.map((h: any, i: number) => (
      <td key={i} className={`px-2 py-3 text-center font-mono text-slate-600 ${highlight ? "font-bold text-blue-700" : ""}`}>
        {h[field] !== undefined && h[field] !== null && h[field] !== 0 ? fmt(h[field]) : "-"}
      </td>
    ))}
  </tr>
);

const fmtNum = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => v.toFixed(1) + "%";
const fmtCompact = (v: number) => {
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return v.toLocaleString();
};