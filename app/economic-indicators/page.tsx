"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ============ SUPABASE CLIENT ============
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============ CONSTANTS ============
const PAGE_SIZE = 25;

const AVAILABLE_TICKERS = [
  { value: "SPY", label: "SPY (S&P 500)", description: "U.S. Large Cap Stocks" },
  { value: "QQQ", label: "QQQ (Nasdaq 100)", description: "U.S. Tech/Growth Stocks" },
  { value: "GLD", label: "GLD (Gold)", description: "Gold Price" },
  { value: "TLT", label: "TLT (20+ Year Treasuries)", description: "Long-Term U.S. Bonds" },
  { value: "XHB", label: "XHB (Homebuilders)", description: "U.S. Homebuilder Stocks" },
];

// Only indicators with VERIFIED release dates from FRED's release calendar
// entry_timing: "open" = pre-market release, "close" = intraday release
const INDICATOR_CONFIG: Record<string, {
  name: string;
  description: string;
  releaseTime: string;
  entryTiming: "open" | "close";
  aboveMeaning: string;
  belowMeaning: string;
  interpretation: string;
  compareToZero?: boolean;
  valueLabel?: string;
  comparisonNote?: string;
  category: string;
}> = {
  // ========== GDP & GROWTH ==========
  GDP: {
    name: "GDP Growth (Quarterly)",
    description: "Real Gross Domestic Product measures the total value of goods and services produced. This is the annualized quarter-over-quarter percent change.",
    releaseTime: "8:30 AM ET (quarterly, ~28 days after quarter end)",
    entryTiming: "open",
    aboveMeaning: "GDP POSITIVE — economy expanding (growth > 0%)",
    belowMeaning: "GDP NEGATIVE — economy contracting (growth ≤ 0%)",
    interpretation: "Positive GDP indicates expansion, supportive for stocks. Negative GDP signals recession risk.",
    compareToZero: true,
    valueLabel: "GDP %",
    comparisonNote: "Comparing GDP growth to zero (positive vs negative)",
    category: "GDP & Growth",
  },

  // ========== EMPLOYMENT ==========
  PAYROLLS: {
    name: "Nonfarm Payrolls",
    description: "Total paid U.S. workers excluding farm employees. The most watched employment report and often the biggest market mover of the month.",
    releaseTime: "8:30 AM ET (first Friday of month)",
    entryTiming: "open",
    aboveMeaning: "Job growth ABOVE prior month — economy adding more jobs",
    belowMeaning: "Job growth BELOW prior month — hiring slowing",
    interpretation: "Strong payrolls suggest expansion but may lead to Fed tightening. Weak payrolls signal weakness but may prompt easing.",
    category: "Employment",
  },
  UNEMPLOYMENT: {
    name: "Unemployment Rate",
    description: "The percentage of the labor force that is unemployed but actively seeking employment.",
    releaseTime: "8:30 AM ET (first Friday of month)",
    entryTiming: "open",
    aboveMeaning: "Unemployment RISING — more people out of work",
    belowMeaning: "Unemployment FALLING — more people employed",
    interpretation: "Rising unemployment signals weakness but can lead to rate cuts. Falling unemployment is positive but may spark inflation concerns.",
    category: "Employment",
  },
  JOLTS: {
    name: "Job Openings (JOLTS)",
    description: "Total job openings across the economy. The Fed watches this closely for labor market tightness.",
    releaseTime: "10:00 AM ET (monthly, ~5th)",
    entryTiming: "close",
    aboveMeaning: "Job openings INCREASING — strong labor demand",
    belowMeaning: "Job openings DECREASING — weakening labor demand",
    interpretation: "High openings relative to unemployed suggests tight labor market and wage inflation risk.",
    category: "Employment",
  },

  // ========== INFLATION ==========
  CPI: {
    name: "CPI Inflation",
    description: "Consumer Price Index measures the average change in prices paid by consumers for goods and services.",
    releaseTime: "8:30 AM ET (monthly, ~13th)",
    entryTiming: "open",
    aboveMeaning: "Inflation RISING — prices increased more than prior month",
    belowMeaning: "Inflation FALLING — prices increased less than prior month",
    interpretation: "Rising CPI often leads to Fed rate hikes. Falling CPI signals potential for easier policy.",
    category: "Inflation",
  },
  CORE_PCE: {
    name: "Core PCE Inflation",
    description: "Personal Consumption Expenditures Price Index excluding food and energy. This is the Federal Reserve's PREFERRED inflation measure.",
    releaseTime: "8:30 AM ET (monthly, ~28th)",
    entryTiming: "open",
    aboveMeaning: "Fed's preferred inflation measure RISING",
    belowMeaning: "Fed's preferred inflation measure FALLING",
    interpretation: "The Fed targets 2% Core PCE. Above = hawkish. Below = dovish. THE most important inflation reading.",
    category: "Inflation",
  },
  PPI: {
    name: "Producer Price Index (PPI)",
    description: "Average change in selling prices received by domestic producers. A leading indicator for consumer inflation.",
    releaseTime: "8:30 AM ET (monthly, ~14th)",
    entryTiming: "open",
    aboveMeaning: "Producer/wholesale prices RISING",
    belowMeaning: "Producer/wholesale prices FALLING",
    interpretation: "Rising PPI often leads to rising CPI as producers pass costs to consumers.",
    category: "Inflation",
  },

  // ========== MANUFACTURING ==========
  INDPRO: {
    name: "Industrial Production Index",
    description: "Real output of manufacturing, mining, and utilities industries.",
    releaseTime: "9:15 AM ET (monthly, ~15th)",
    entryTiming: "open",
    aboveMeaning: "Industrial output INCREASING",
    belowMeaning: "Industrial output DECREASING",
    interpretation: "Rising production suggests expansion. Declining production may signal slowdown.",
    category: "Manufacturing",
  },
  DURABLE_GOODS: {
    name: "Durable Goods Orders",
    description: "New orders for goods lasting 3+ years (vehicles, appliances, machinery). A proxy for business investment.",
    releaseTime: "8:30 AM ET (monthly, ~26th)",
    entryTiming: "open",
    aboveMeaning: "Business investment INCREASING",
    belowMeaning: "Business investment DECREASING",
    interpretation: "Reflects business confidence and future manufacturing activity.",
    category: "Manufacturing",
  },
  ISM_MFG: {
    name: "ISM Manufacturing PMI",
    description: "Purchasing Managers Index for manufacturing. Above 50 = expansion, below 50 = contraction.",
    releaseTime: "10:00 AM ET (first business day of month)",
    entryTiming: "close",
    aboveMeaning: "Manufacturing activity INCREASING (above prior)",
    belowMeaning: "Manufacturing activity DECREASING (below prior)",
    interpretation: "50 is the key threshold. Above = expansion, below = contraction. Major market mover.",
    category: "Manufacturing",
  },

  // ========== CONSUMER ==========
  RETAIL: {
    name: "Retail Sales",
    description: "Total receipts of retail stores. Consumer spending accounts for ~2/3 of GDP.",
    releaseTime: "8:30 AM ET (monthly, ~15th)",
    entryTiming: "open",
    aboveMeaning: "Consumer spending INCREASING",
    belowMeaning: "Consumer spending DECREASING",
    interpretation: "Strong retail = healthy consumer. Weak sales = potential pullback.",
    category: "Consumer",
  },
  SENTIMENT: {
    name: "Consumer Sentiment (U of Michigan)",
    description: "University of Michigan Consumer Sentiment Index measuring consumer confidence.",
    releaseTime: "10:00 AM ET (mid-month preliminary, month-end final)",
    entryTiming: "close",
    aboveMeaning: "Consumer confidence IMPROVING",
    belowMeaning: "Consumer confidence DECLINING",
    interpretation: "Rising sentiment often precedes increased spending. Declining sentiment may signal weakness.",
    category: "Consumer",
  },
  PERSONAL_INCOME: {
    name: "Personal Income",
    description: "Total income received by individuals from all sources.",
    releaseTime: "8:30 AM ET (monthly, ~28th)",
    entryTiming: "open",
    aboveMeaning: "Income growth INCREASING",
    belowMeaning: "Income growth DECREASING",
    interpretation: "Rising income supports consumer spending and confidence.",
    category: "Consumer",
  },
  PCE: {
    name: "Personal Consumption Expenditures",
    description: "Total spending by consumers on goods and services. Consumer spending = ~2/3 of GDP.",
    releaseTime: "8:30 AM ET (monthly, ~28th)",
    entryTiming: "open",
    aboveMeaning: "Consumer spending INCREASING",
    belowMeaning: "Consumer spending DECREASING",
    interpretation: "Consumer spending is the engine of the economy. Strong PCE = growth.",
    category: "Consumer",
  },

  // ========== LEADING INDICATORS ==========
  LEI: {
    name: "Leading Economic Index (LEI)",
    description: "Conference Board composite of 10 leading indicators designed to predict turning points.",
    releaseTime: "10:00 AM ET (monthly, ~20th)",
    entryTiming: "close",
    aboveMeaning: "Leading indicators IMPROVING — expansion ahead",
    belowMeaning: "Leading indicators DECLINING — slowdown/recession risk",
    interpretation: "Consecutive monthly declines often precede recessions.",
    category: "Leading Indicators",
  },
};

const INDICATOR_CATEGORIES = [
  "GDP & Growth",
  "Employment",
  "Inflation",
  "Manufacturing",
  "Consumer",
  "Leading Indicators",
];

// ============ TYPES ============
type IndicatorRelease = {
  id: number;
  ticker: string;
  indicator_code: string;
  indicator_name: string;
  release_date: string;
  period_date: string;
  current_value: number;
  previous_value: number;
  change_direction: string;
  value_change: number;
  entry_price: number;
  entry_type: string;
  price_3d: number | null;
  price_1w: number | null;
  price_1m: number | null;
  price_2m: number | null;
  price_3m: number | null;
  return_3d: number | null;
  return_1w: number | null;
  return_1m: number | null;
  return_2m: number | null;
  return_3m: number | null;
};

type SummaryStats = {
  ticker: string;
  indicator_code: string;
  indicator_name: string;
  total_releases: number;
  above_prior_count: number;
  below_prior_count: number;
  above_avg_return_3d: number | null;
  above_avg_return_1w: number | null;
  above_avg_return_1m: number | null;
  above_avg_return_2m: number | null;
  above_avg_return_3m: number | null;
  above_pct_positive_3d: number | null;
  above_pct_positive_1w: number | null;
  above_pct_positive_1m: number | null;
  above_pct_positive_2m: number | null;
  above_pct_positive_3m: number | null;
  below_avg_return_3d: number | null;
  below_avg_return_1w: number | null;
  below_avg_return_1m: number | null;
  below_avg_return_2m: number | null;
  below_avg_return_3m: number | null;
  below_pct_positive_3d: number | null;
  below_pct_positive_1w: number | null;
  below_pct_positive_1m: number | null;
  below_pct_positive_2m: number | null;
  below_pct_positive_3m: number | null;
};

export default function EconomicIndicatorsPage() {
  const [selectedIndicator, setSelectedIndicator] = useState<string>("GDP");
  const [selectedTicker, setSelectedTicker] = useState<string>("SPY");
  const [releases, setReleases] = useState<IndicatorRelease[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const config = INDICATOR_CONFIG[selectedIndicator];
  const isCompareToZero = config?.compareToZero === true;

  // ============ COPY/PASTE/SCREENSHOT PROTECTION ============
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

  // ============ FETCH SUMMARY ============
  useEffect(() => {
    const fetchSummary = async () => {
      setLoadingSummary(true);
      setError(null);
      
      try {
        const { data, error: summaryError } = await supabase
          .from("economic_indicators_summary")
          .select("*")
          .eq("indicator_code", selectedIndicator)
          .eq("ticker", selectedTicker)
          .single();

        if (summaryError) throw summaryError;
        setSummary(data);
      } catch (err: unknown) {
        console.error("Error fetching summary:", err);
        setError(err instanceof Error ? err.message : "Failed to load summary");
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [selectedIndicator, selectedTicker]);

  // ============ FETCH TABLE DATA ============
  useEffect(() => {
    const fetchReleases = async () => {
      setLoadingTable(true);
      setReleases([]);
      setPage(0);
      setHasMore(true);
      
      try {
        const { data, error: releasesError } = await supabase
          .from("economic_indicators_analysis")
          .select("*")
          .eq("indicator_code", selectedIndicator)
          .eq("ticker", selectedTicker)
          .order("release_date", { ascending: false })
          .range(0, PAGE_SIZE - 1);

        if (releasesError) throw releasesError;

        setReleases(data || []);
        setHasMore((data?.length || 0) === PAGE_SIZE);
        setPage(1);
      } catch (err: unknown) {
        console.error("Error fetching releases:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoadingTable(false);
      }
    };

    fetchReleases();
  }, [selectedIndicator, selectedTicker]);

  // ============ LOAD MORE ============
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("economic_indicators_analysis")
        .select("*")
        .eq("indicator_code", selectedIndicator)
        .eq("ticker", selectedTicker)
        .order("release_date", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (data) {
        setReleases((prev) => [...prev, ...data]);
        setHasMore(data.length === PAGE_SIZE);
        setPage((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Error loading more:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // ============ LOAD ALL ============
  const loadAll = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data, error } = await supabase
        .from("economic_indicators_analysis")
        .select("*")
        .eq("indicator_code", selectedIndicator)
        .eq("ticker", selectedTicker)
        .order("release_date", { ascending: false });

      if (error) throw error;
      if (data) {
        setReleases(data);
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading all:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // ============ FORMATTERS ============
  const formatPct = (val: number | null, decimals: number = 2): string => {
    if (val === null || val === undefined) return "—";
    const sign = val >= 0 ? "+" : "";
    return `${sign}${val.toFixed(decimals)}%`;
  };

  const formatPrice = (val: number | null): string => {
    if (val === null || val === undefined) return "—";
    return `$${val.toFixed(2)}`;
  };

  const formatValue = (val: number | null): string => {
    if (val === null || val === undefined) return "—";
    return val.toFixed(2);
  };

  const getReturnColor = (val: number | null): string => {
    if (val === null || val === undefined) return "text-gray-400";
    return val >= 0 ? "text-emerald-600" : "text-red-600";
  };

  const getDirectionBadgeStyle = (direction: string): string => {
    if (isCompareToZero) {
      if (direction === "ABOVE") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      if (direction === "BELOW") return "bg-red-100 text-red-800 border border-red-200";
    } else {
      if (direction === "ABOVE") return "bg-blue-100 text-blue-800 border border-blue-200";
      if (direction === "BELOW") return "bg-orange-100 text-orange-800 border border-orange-200";
    }
    return "bg-gray-100 text-gray-800 border border-gray-200";
  };

  const getDirectionLabel = (direction: string): string => {
    if (isCompareToZero) {
      if (direction === "ABOVE") return "POSITIVE";
      if (direction === "BELOW") return "NEGATIVE";
    }
    return direction;
  };

  // ============ RENDER ============
  return (
    <>
      {/* 
        JSON-LD SCHEMA
        Explicitly tells Google this is a Software Application
        and lists the assets available for analysis.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Economic Calendar Backtester",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "description": "A quantitative tool to backtest historical returns of SPY, QQQ, Gold, and Bonds following major economic releases like CPI, NFP, and GDP.",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "featureList": [
              "Backtest SPY reaction to CPI",
              "Analyze Gold price after Inflation data",
              "Track Bond yields after NFP",
              "Verify economic data with FRED releases"
            ]
          })
        }}
      />

      <div 
        id="protected-content"
        className="min-h-screen bg-gray-50 p-4 md:p-8" 
        style={{ 
          userSelect: 'none', 
          WebkitUserSelect: 'none', 
          MozUserSelect: 'none', 
          msUserSelect: 'none',
          WebkitTouchCallout: 'none',
        } as React.CSSProperties}
      >
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Economic Indicators & Market Analysis
          </h1>
          <p className="text-gray-500">
            Analyze how 15 economic releases correlate with {selectedTicker} performance using verified FRED release dates
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-7xl mx-auto mb-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <h3 className="text-red-800 font-semibold mb-2">Error Loading Data</h3>
              <p className="text-red-700 text-sm">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Selectors */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Select Economic Indicator
                </label>
                <select
                  value={selectedIndicator}
                  onChange={(e) => setSelectedIndicator(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
                >
                  {INDICATOR_CATEGORIES.map(category => (
                    <optgroup key={category} label={category}>
                      {Object.entries(INDICATOR_CONFIG)
                        .filter(([, cfg]) => cfg.category === category)
                        .map(([code, cfg]) => (
                          <option key={code} value={code}>{cfg.name}</option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Select Asset to Analyze
                </label>
                <select
                  value={selectedTicker}
                  onChange={(e) => setSelectedTicker(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
                >
                  {AVAILABLE_TICKERS.map((ticker) => (
                    <option key={ticker.value} value={ticker.value}>
                      {ticker.label} — {ticker.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Indicator Description */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-[300px]">
                <h3 className="font-bold text-indigo-900 mb-2">{config.name}</h3>
                <p className="text-sm text-indigo-800 mb-3">{config.description}</p>
                <p className="text-sm text-indigo-700">
                  <strong>Release:</strong> {config.releaseTime}
                </p>
                {config.comparisonNote && (
                  <p className="text-sm text-indigo-600 mt-2 italic">Note: {config.comparisonNote}</p>
                )}
              </div>
              
              {/* Entry Timing Badge */}
              <div className={`px-4 py-3 rounded-lg border ${config.entryTiming === 'open' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${config.entryTiming === 'open' ? 'text-green-600' : 'text-amber-600'}`}>
                  Entry Price
                </div>
                <div className={`text-lg font-bold ${config.entryTiming === 'open' ? 'text-green-800' : 'text-amber-800'}`}>
                  {config.entryTiming === 'open' ? '📈 Market Open' : '📉 Market Close'}
                </div>
                <div className={`text-xs mt-1 ${config.entryTiming === 'open' ? 'text-green-600' : 'text-amber-600'}`}>
                  {config.entryTiming === 'open' ? 'Pre-market release' : 'Intraday release'}
                </div>
              </div>
            </div>
          </div>

          {/* Entry Timing Explanation */}
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-slate-500 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-sm text-slate-700">
                <strong>Entry Timing:</strong> For indicators released <strong>before market open</strong> (e.g., 8:30 AM ET), 
                we enter at that day&apos;s <span className="text-green-700 font-semibold">opening price</span>. 
                For indicators released <strong>after market open</strong> (e.g., 10:00 AM ET), 
                we enter at that day&apos;s <span className="text-amber-700 font-semibold">closing price</span> since 
                you couldn&apos;t react at the open. All returns include 0.10% commission. Release dates are verified from FRED&apos;s official release calendar.
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {loadingSummary ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border p-8 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="grid grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="text-center">
                        <div className="h-4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-8 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : summary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Above/Positive Card */}
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className={`${isCompareToZero ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'} px-6 py-4 border-b`}>
                  <h2 className={`text-lg font-bold ${isCompareToZero ? 'text-emerald-800' : 'text-blue-800'}`}>
                    {selectedTicker} After {isCompareToZero ? 'Positive Reading' : 'Reading Above Prior'}
                  </h2>
                  <p className={`text-sm ${isCompareToZero ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {summary.above_prior_count} releases | {config.aboveMeaning}
                  </p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-5 gap-3 text-center">
                    {(['3d', '1w', '1m', '2m', '3m'] as const).map((period) => {
                      const avgKey = `above_avg_return_${period}` as keyof SummaryStats;
                      const winKey = `above_pct_positive_${period}` as keyof SummaryStats;
                      const labels = { '3d': '+3 Days', '1w': '+1 Week', '1m': '+1 Month', '2m': '+2 Mo', '3m': '+3 Mo' };
                      return (
                        <div key={period}>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{labels[period]}</div>
                          <div className={`text-lg font-bold ${getReturnColor(summary[avgKey] as number)}`}>
                            {formatPct(summary[avgKey] as number)}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{summary[winKey]}% win</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Below/Negative Card */}
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className={`${isCompareToZero ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'} px-6 py-4 border-b`}>
                  <h2 className={`text-lg font-bold ${isCompareToZero ? 'text-red-800' : 'text-orange-800'}`}>
                    {selectedTicker} After {isCompareToZero ? 'Negative Reading' : 'Reading Below Prior'}
                  </h2>
                  <p className={`text-sm ${isCompareToZero ? 'text-red-600' : 'text-orange-600'}`}>
                    {summary.below_prior_count} releases | {config.belowMeaning}
                  </p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-5 gap-3 text-center">
                    {(['3d', '1w', '1m', '2m', '3m'] as const).map((period) => {
                      const avgKey = `below_avg_return_${period}` as keyof SummaryStats;
                      const winKey = `below_pct_positive_${period}` as keyof SummaryStats;
                      const labels = { '3d': '+3 Days', '1w': '+1 Week', '1m': '+1 Month', '2m': '+2 Mo', '3m': '+3 Mo' };
                      return (
                        <div key={period}>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{labels[period]}</div>
                          <div className={`text-lg font-bold ${getReturnColor(summary[avgKey] as number)}`}>
                            {formatPct(summary[avgKey] as number)}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{summary[winKey]}% win</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interpretation */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              How to Interpret
            </h3>
            <div className="text-sm text-amber-900 space-y-2">
              <p>{config.interpretation}</p>
              <p>
                <strong>Methodology:</strong> {isCompareToZero
                  ? 'We classify each release as "Positive" (> 0) or "Negative" (≤ 0).'
                  : 'We compare each release to the prior reading.'
                } Returns for <strong>{selectedTicker}</strong> are calculated from the {config.entryTiming === 'open' ? 'opening' : 'closing'} price on release date, with 0.10% commission deducted.
              </p>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Historical Releases & {selectedTicker} Returns</h2>
                <p className="text-gray-500 text-sm mt-1">
                  {summary ? `${summary.total_releases} total` : "Loading..."} 
                  {releases.length > 0 && ` • Showing ${releases.length}`} • 0.10% commission • Verified release dates
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${config.entryTiming === 'open' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                Entry: {config.entryTiming === 'open' ? 'Open Price' : 'Close Price'}
              </div>
            </div>

            {loadingTable ? (
              <div className="p-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent mb-4"></div>
                <p className="text-gray-600">Loading...</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto" style={{ maxHeight: "600px" }}>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase">Release Date</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 uppercase">
                          {config.valueLabel || 'Value'}
                        </th>
                        {!isCompareToZero && (
                          <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 uppercase">Prior</th>
                        )}
                        <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 uppercase">
                          {isCompareToZero ? 'Type' : 'Direction'}
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">Entry</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">+3D</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">+1W</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">+1M</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">+2M</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">+3M</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {releases.map((release) => (
                        <tr key={release.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3 text-sm font-medium text-gray-900">{release.release_date}</td>
                          <td className="px-3 py-3 text-center text-sm font-mono text-gray-700">
                            {isCompareToZero ? formatPct(release.current_value, 1) : formatValue(release.current_value)}
                          </td>
                          {!isCompareToZero && (
                            <td className="px-3 py-3 text-center text-sm font-mono text-gray-500">
                              {formatValue(release.previous_value)}
                            </td>
                          )}
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${getDirectionBadgeStyle(release.change_direction)}`}>
                              {getDirectionLabel(release.change_direction)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-gray-700 text-sm">
                            {formatPrice(release.entry_price)}
                            <span className={`ml-1 text-xs ${release.entry_type === 'open' ? 'text-green-600' : 'text-amber-600'}`}>
                              ({release.entry_type === 'open' ? 'O' : 'C'})
                            </span>
                          </td>
                          <td className={`px-3 py-3 text-right font-mono text-sm font-semibold ${getReturnColor(release.return_3d)}`}>{formatPct(release.return_3d)}</td>
                          <td className={`px-3 py-3 text-right font-mono text-sm font-semibold ${getReturnColor(release.return_1w)}`}>{formatPct(release.return_1w)}</td>
                          <td className={`px-3 py-3 text-right font-mono text-sm font-semibold ${getReturnColor(release.return_1m)}`}>{formatPct(release.return_1m)}</td>
                          <td className={`px-3 py-3 text-right font-mono text-sm font-semibold ${getReturnColor(release.return_2m)}`}>{formatPct(release.return_2m)}</td>
                          <td className={`px-3 py-3 text-right font-mono text-sm font-semibold ${getReturnColor(release.return_3m)}`}>{formatPct(release.return_3m)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {hasMore && (
                  <div className="p-4 text-center border-t bg-gray-50 flex justify-center gap-3">
                    <button onClick={loadMore} disabled={loadingMore} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 text-sm font-medium">
                      {loadingMore ? "Loading..." : `Load More (${PAGE_SIZE})`}
                    </button>
                    <button onClick={loadAll} disabled={loadingMore} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 text-sm font-medium">
                      Load All
                    </button>
                  </div>
                )}

                {!hasMore && releases.length > 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm border-t bg-gray-50">
                    ✓ All {releases.length} records loaded
                  </div>
                )}
              </>
            )}
          </div>

          {/* Educational Content (OPTIMIZED FOR NEWS TRADING KEYWORDS) */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">How to Trade the Economic Calendar</h2>
            
            <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
              <p>
                Economic indicators are statistics released by government agencies that provide insight into the economy&apos;s health and direction. This tool uses <strong>verified release dates</strong> from FRED&apos;s official release calendar—not estimated dates—to ensure accuracy.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Assets to Trade on Economic News (SPY, QQQ, Gold)</h3>

              <p>
                <strong>SPY (S&amp;P 500)</strong> represents U.S. large-cap stocks. Stocks generally benefit from economic expansion—strong GDP, rising employment, and healthy consumer spending.
              </p>

              <p>
                <strong>QQQ (Nasdaq 100)</strong> tracks large-cap tech and growth stocks. Tech is particularly sensitive to interest rate expectations since growth stocks derive more value from future earnings, which are discounted more heavily when rates rise.
              </p>

              <p>
                <strong>GLD (Gold)</strong> is often a safe haven and inflation hedge. Gold rises when investors worry about inflation or uncertainty, but struggles when real interest rates increase (since gold pays no yield).
              </p>

              <p>
                <strong>TLT (Long-Term Treasuries)</strong> holds 20+ year U.S. government bonds. Bond prices move inversely to rates—economic weakness (prompting Fed cuts) is bullish for TLT, while strong data is bearish.
              </p>

              <p>
                <strong>XHB (Homebuilders)</strong> tracks homebuilder stocks. Sensitive to interest rates and economic conditions that affect housing demand.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Pre-Market vs Intraday Trading Rules</h3>

              <p>
                We use realistic entry timing based on when you could actually trade:
              </p>

              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Pre-market releases (before 9:30 AM ET):</strong> Most major data (NFP, CPI, GDP, PPI, retail sales) is released at 8:30 AM. You can analyze before the open, so we enter at the <span className="text-green-700 font-semibold">opening price</span>.
                </li>
                <li>
                  <strong>Intraday releases (after 9:30 AM ET):</strong> Data released at 10:00 AM (ISM, JOLTS, sentiment, LEI) means you missed the open reaction. We enter at the <span className="text-amber-700 font-semibold">closing price</span>.
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Data Accuracy</h3>

              <p>
                All release dates in this tool come from FRED&apos;s official release calendar API, not from estimates or assumptions. We only include indicators where we can verify the exact historical release dates. This ensures the backtest results reflect what was actually possible to trade in real-time.
              </p>

              <p>
                <strong>Note:</strong> Past performance does not guarantee future results. Economic relationships change over time. Use this tool to understand historical patterns, not as a standalone trading system.
              </p>
            </div>
          </section>

          {/* Data Sources */}
          <div className="bg-gray-50 border rounded-xl p-6">
            <h3 className="font-bold text-gray-800 mb-3">Data Sources & Methodology</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li><strong>Economic Data:</strong> FRED (Federal Reserve Economic Data) with verified release dates only</li>
              <li><strong>Price Data:</strong> Yahoo Finance (SPY, QQQ, GLD, TLT, XHB)</li>
              <li><strong>Entry Timing:</strong> Open price for pre-market releases, Close price for intraday releases</li>
              <li><strong>Commission:</strong> 0.10% deducted from all returns</li>
              <li><strong>Holding Periods:</strong> +3 Days, +1 Week, +1 Month, +2 Months, +3 Months</li>
              <li><strong>Indicators:</strong> 15 economic indicators with verified FRED release dates</li>
              <li><strong>Disclaimer:</strong> Past performance ≠ future results. Educational purposes only.</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}