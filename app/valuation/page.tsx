"use client";

import React, { useState, useMemo, useEffect } from "react";
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

  // --- Enhanced Copy/Paste/Screenshot Protection ---
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) && 
        ['c', 'v', 'x', 'a', 'u', 's', 'p'].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
      if (e.key === 'F12') {
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        navigator.clipboard.writeText('');
      }
    };
    
    const handleSelectStart = (e: Event) => e.preventDefault();
    const handleDragStart = (e: Event) => e.preventDefault();
    const handleCopy = (e: Event) => e.preventDefault();
    const handleCut = (e: Event) => e.preventDefault();
    const handlePaste = (e: Event) => e.preventDefault();

    const handleVisibilityChange = () => {
      const content = document.getElementById('protected-content');
      if (content) {
        content.style.filter = document.hidden ? 'blur(10px)' : 'none';
      }
    };

    const handleBeforePrint = () => { document.body.style.display = 'none'; };
    const handleAfterPrint = () => { document.body.style.display = 'block'; };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
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
      {/* 
        JSON-LD SCHEMA
        Tells Google this is a "Valuation Calculator" Tool.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Intrinsic Value Calculator (15x Earnings)",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "description": "A fundamental analysis tool that calculates stock fair value using the Peter Lynch 15x Earnings model.",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "featureList": [
              "Historical Fair Value Chart",
              "EPS and Revenue Analysis",
              "Debt to Equity Ratios"
            ]
          })
        }}
      />

      <div 
        id="protected-content"
        className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800"
        style={{ 
          userSelect: 'none', 
          WebkitUserSelect: 'none', 
          MozUserSelect: 'none', 
          msUserSelect: 'none',
          WebkitTouchCallout: 'none',
        } as React.CSSProperties}
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

            {/* --- EDUCATIONAL CONTENT SECTION (SEO OPTIMIZED) --- */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">How to Calculate Intrinsic Value (15x Model)</h2>
              
              <div className="prose prose-slate max-w-none text-slate-700 space-y-4">
                
                {/* Data Warning */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <p className="text-amber-800 text-sm">
                    <strong>Note:</strong> Some stocks—particularly ADRs, foreign companies, and REITs—may have incomplete data. Financial sector companies may show dashes for inapplicable metrics. Always cross-reference with SEC filings.
                  </p>
                </div>

                <p>
                  This tool helps you quickly assess if a stock is trading above or below its &quot;Fair Value&quot;. The chart plots the actual stock price against a valuation benchmark derived from the company&apos;s earnings power.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">The Peter Lynch Valuation Method (15x PE)</h3>

                <p>
                  The orange line on the chart represents 15 times the company&apos;s annual EPS. This is often called the &quot;Peter Lynch Fair Value&quot; rule of thumb. A P/E ratio of 15 implies a company is fairly priced if it is growing at an average rate (historically about 15% for fast growers, or simply because the market average P/E is often around 15).
                </p>

                <p>
                  When the black price line is well above the orange 15x line, the stock is trading at a premium—investors are optimistic about future growth. When it&apos;s below, the stock may be undervalued. This serves as a quick &quot;Intrinsic Value&quot; check before doing deeper research.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Analyzing EPS & Revenue Per Share</h3>

                <p>
                  <strong>EPS (Earnings Per Share)</strong> is the foundation of most valuation work. Rising EPS over time is a positive sign. <strong>Revenue Per Share</strong> removes the effect of share count changes and shows whether the company is growing its top line on a per-share basis—important because some companies grow revenue but dilute shareholders so heavily that per-share value doesn&apos;t increase.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Debt and Valuation Ratios</h3>

                <p>
                  <strong>ROE (Return on Equity)</strong> measures how efficiently the company turns shareholder capital into profit. A consistently high ROE—above 15%—often indicates a durable competitive advantage. <strong>Debt to Equity</strong> reveals leverage. Rising debt-to-equity over time is a warning sign.
                </p>

                <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">How to Use This Calculator</h3>

                <p>
                  Use this tool to look for divergence. If the stock price has fallen significantly below the 15x Earnings line while earnings are still growing, it may represent a buying opportunity (Margin of Safety). Conversely, if the price has gone parabolic far above the 15x line, the stock may be overextended and due for a correction.
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
        <h1 className="text-2xl font-bold text-blue-700">Intrinsic Value Calculator</h1>
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