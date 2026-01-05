"use client";

import React, { useState, useMemo } from "react";
import Script from "next/script";
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
  // New Metrics
  roe: number; roic: number; currentRatio: number; 
  debtToEquity: number; evEbitda: number;
  // Specific requested fields
  yearHigh: number; yearLow: number; fairValue: number; 
}

interface ValuationData {
  symbol: string; price: number; price_history: PricePoint[];
  overview: { isFinancial: boolean; Description: string }; history: HistoryItem[];
}

/* ---------- Component ---------- */
export default function StockAnalyzer() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ValuationData | null>(null);
  const [error, setError] = useState("");

  /* ------- Fetch ------- */
  const handleSearch = async () => {
    if (!ticker) return;
    setLoading(true); setError(""); setData(null);

    try {
      const r = await fetch(`http://localhost:8000/fetch-valuation-data/${ticker}`);
      if (!r.ok) throw new Error(`Server ${r.status}`);
      const j = await r.json();
      
      const sorted = [...j.data.history].sort((a: HistoryItem, b: HistoryItem) =>
        a.year === "TTM" ? 1 : b.year === "TTM" ? -1 : parseInt(a.year) - parseInt(b.year)
      );
      
      setData({ ...j.data, history: sorted });
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false); }
  };

  /* ------- Chart Data Construction ------- */
  const chartPoints = useMemo(() => {
    if (!data) return [];

    const mergedData = new Map<string, any>();

    // 1. Stock Price History
    if (data.price_history && data.price_history.length > 0) {
        data.price_history.forEach(p => {
            mergedData.set(p.date, {
                date: p.date,
                price: p.close
            });
        });
    }

    // 2. 15x EPS Points (Fair Value)
    const fiscalRows = data.history.filter(h => h.year !== "TTM" && h.fairValue > 0);
    fiscalRows.forEach(h => {
        const dateKey = `${h.year}-12-31`;
        const existing = mergedData.get(dateKey) || { date: dateKey };
        
        mergedData.set(dateKey, {
            ...existing,
            fairValue: h.fairValue
        });
    });

    // 3. Now point
    const ttmItem = data.history.find(h => h.year === "TTM") || data.history[data.history.length - 1];
    if (ttmItem && ttmItem.fairValue > 0) {
        mergedData.set("Now", {
            date: "Now",
            price: data.price,
            fairValue: ttmItem.fairValue
        });
    }

    // Sort by date
    return Array.from(mergedData.values()).sort((a, b) => {
        if (a.date === "Now") return 1;
        if (b.date === "Now") return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [data]);

  /* ------- X-Axis Ticks Calculation (Fixes repeating years) ------- */
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
            ticks.push(point.date); // Add the specific date string (e.g. "2020-01-30") as the tick
        }
    });
    return ticks;
  }, [chartPoints]);

  /* ------- UI ------- */
  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">

      {/* header */}
      <Header
        ticker={ticker} setTicker={setTicker}
        loading={loading} currentPrice={data?.price}
        onSearch={handleSearch}
      />

      {loading && <Alert color="blue" msg={`Analyzing ${ticker}…`} />}
      {error && <Alert color="red" msg={error} />}

      {data && !loading && (
        <div className="max-w-[95%] mx-auto space-y-6">
          {/* chart */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <Chart points={chartPoints} history={data.history} customTicks={xAxisTicks} />
          </div>

          {/* table */}
          <FinancialTable data={data} />
        </div>
      )}
    </div>
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
                ticks={customTicks} // Uses our calculated unique ticks
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

/* ---------- Financial Table (UPDATED ORDER) ---------- */
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
            
            {/* Moved to the bottom of Per Share Data section */}
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

  // Smart Lookup for Fair Value
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