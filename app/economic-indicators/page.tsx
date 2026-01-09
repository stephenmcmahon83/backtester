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

// ALL indicator configurations in one place
const INDICATOR_CONFIG: Record<string, {
  name: string;
  description: string;
  releaseTime: string;
  aboveMeaning: string;
  belowMeaning: string;
  interpretation: string;
  compareToZero?: boolean;  // true = compare to 0, false/undefined = compare to prior
  valueLabel?: string;
  comparisonNote?: string;
}> = {
  GDP: {
    name: "GDP Growth (Quarterly)",
    description: "Real Gross Domestic Product measures the total value of goods and services produced in the United States. This is the annualized quarter-over-quarter percent change, seasonally adjusted.",
    releaseTime: "Released quarterly, approximately 28 days after the quarter ends at 8:30 AM ET. The BEA releases three estimates: Advance, Second, and Third (final).",
    aboveMeaning: "GDP POSITIVE — economy expanding (growth > 0%)",
    belowMeaning: "GDP NEGATIVE — economy contracting (growth ≤ 0%)",
    interpretation: "Positive GDP indicates economic expansion, generally supportive for stocks. Negative GDP (especially two consecutive quarters) signals recession and typically pressures equity markets.",
    compareToZero: true,
    valueLabel: "GDP %",
    comparisonNote: "Comparing GDP growth to zero (positive vs negative)",
  },
  CPI: {
    name: "CPI Inflation (Consumer Price Index)",
    description: "The Consumer Price Index measures the average change in prices paid by consumers for goods and services over time.",
    releaseTime: "Released monthly, typically around the 10th-13th of the month at 8:30 AM ET.",
    aboveMeaning: "Inflation RISING — prices increased more than prior month",
    belowMeaning: "Inflation FALLING — prices increased less than prior month",
    interpretation: "Rising inflation often leads to Fed rate hikes, pressuring stocks. Falling inflation may signal economic weakness but also potential for easier monetary policy.",
  },
  UNEMPLOYMENT: {
    name: "Unemployment Rate",
    description: "The percentage of the total labor force that is unemployed but actively seeking employment.",
    releaseTime: "Released monthly, typically the first Friday of the month at 8:30 AM ET.",
    aboveMeaning: "Unemployment RISING — more people out of work",
    belowMeaning: "Unemployment FALLING — more people employed",
    interpretation: "Rising unemployment signals economic weakness. However, it can lead to Fed rate cuts which markets sometimes view positively.",
  },
  INDPRO: {
    name: "Industrial Production Index",
    description: "Measures real output of manufacturing, mining, and electric and gas utilities industries.",
    releaseTime: "Released monthly, typically around the 15th at 9:15 AM ET.",
    aboveMeaning: "Industrial output INCREASING — manufacturing expanding",
    belowMeaning: "Industrial output DECREASING — manufacturing contracting",
    interpretation: "Rising industrial production suggests economic expansion. Declining production may signal economic slowdown.",
  },
  FEDFUNDS: {
    name: "Federal Funds Rate",
    description: "The interest rate at which banks lend reserve balances to other banks overnight.",
    releaseTime: "The Fed announces rate decisions 8 times per year after FOMC meetings.",
    aboveMeaning: "Fed RAISING rates — tightening monetary policy",
    belowMeaning: "Fed CUTTING rates — easing monetary policy",
    interpretation: "Rate hikes increase borrowing costs and can pressure stocks. Rate cuts are typically supportive for equities.",
  },
  RETAIL: {
    name: "Retail Sales",
    description: "Total receipts of retail stores, reflecting consumer spending (~2/3 of GDP).",
    releaseTime: "Released monthly, typically around the 15th at 8:30 AM ET.",
    aboveMeaning: "Consumer spending INCREASING",
    belowMeaning: "Consumer spending DECREASING",
    interpretation: "Strong retail sales indicate healthy consumer spending. Weak sales may signal consumer pullback.",
  },
  SENTIMENT: {
    name: "Consumer Sentiment (U of Michigan)",
    description: "University of Michigan Consumer Sentiment Index measuring consumer confidence.",
    releaseTime: "Released twice monthly: preliminary mid-month, final at month-end.",
    aboveMeaning: "Consumer confidence IMPROVING",
    belowMeaning: "Consumer confidence DECLINING",
    interpretation: "Rising sentiment often precedes increased spending. Declining sentiment may signal future weakness.",
  },
};

// ============ TYPES ============
type IndicatorRelease = {
  id: number;
  indicator_code: string;
  indicator_name: string;
  release_date: string;
  period_date: string;
  current_value: number;
  previous_value: number;
  change_direction: string;
  value_change: number;
  spy_on_release: number;
  spy_3d: number | null;
  spy_1w: number | null;
  spy_1m: number | null;
  spy_2m: number | null;
  spy_3m: number | null;
  return_3d: number | null;
  return_1w: number | null;
  return_1m: number | null;
  return_2m: number | null;
  return_3m: number | null;
};

type SummaryStats = {
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

  // ============ COPY/PASTE PROTECTION ============
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a", "u", "s"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    const handleSelectStart = (e: Event) => e.preventDefault();
    const handleCopy = (e: Event) => e.preventDefault();

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("selectstart", handleSelectStart);
    document.addEventListener("copy", handleCopy);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("selectstart", handleSelectStart);
      document.removeEventListener("copy", handleCopy);
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
  }, [selectedIndicator]);

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
  }, [selectedIndicator]);

  // ============ LOAD MORE / LOAD ALL ============
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("economic_indicators_analysis")
        .select("*")
        .eq("indicator_code", selectedIndicator)
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

  const loadAll = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data, error } = await supabase
        .from("economic_indicators_analysis")
        .select("*")
        .eq("indicator_code", selectedIndicator)
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

  // Dynamic styling based on indicator type
  const getDirectionBadgeStyle = (direction: string): string => {
    if (isCompareToZero) {
      // GDP-style: Green for positive, Red for negative
      if (direction === "ABOVE") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      if (direction === "BELOW") return "bg-red-100 text-red-800 border border-red-200";
    } else {
      // Standard: Blue for above prior, Orange for below prior
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
    <div className="min-h-screen bg-gray-50 p-6 md:p-10" style={{ userSelect: "none" }}>
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Economic Indicators & Stock Market Analysis
        </h1>
        <p className="text-gray-500">
          Testing how economic data releases correlate with S&P 500 (SPY) performance
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
        {/* Indicator Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Select Economic Indicator
          </label>
          <select
            value={selectedIndicator}
            onChange={(e) => setSelectedIndicator(e.target.value)}
            className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500"
          >
            {Object.entries(INDICATOR_CONFIG).map(([code, cfg]) => (
              <option key={code} value={code}>{cfg.name}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
          <h3 className="font-bold text-indigo-900 mb-3">{config.name}</h3>
          <p className="text-sm text-indigo-800 mb-3">{config.description}</p>
          <p className="text-sm text-indigo-700">
            <strong>Release Schedule:</strong> {config.releaseTime}
          </p>
          {config.comparisonNote && (
            <p className="text-sm text-indigo-600 mt-2 italic">Note: {config.comparisonNote}</p>
          )}
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
            {/* Card 1: Above/Positive */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className={`${isCompareToZero ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'} px-6 py-4 border-b`}>
                <h2 className={`text-lg font-bold ${isCompareToZero ? 'text-emerald-800' : 'text-blue-800'}`}>
                  {isCompareToZero ? 'After Positive GDP' : 'Reading Above Prior'}
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
                    const labels = { '3d': '+3 Days', '1w': '+1 Week', '1m': '+1 Month', '2m': '+2 Months', '3m': '+3 Months' };
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

            {/* Card 2: Below/Negative */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className={`${isCompareToZero ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'} px-6 py-4 border-b`}>
                <h2 className={`text-lg font-bold ${isCompareToZero ? 'text-red-800' : 'text-orange-800'}`}>
                  {isCompareToZero ? 'After Negative GDP' : 'Reading Below Prior'}
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
                    const labels = { '3d': '+3 Days', '1w': '+1 Week', '1m': '+1 Month', '2m': '+2 Months', '3m': '+3 Months' };
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to Interpret These Results
          </h3>
          <div className="text-sm text-amber-900 space-y-3">
            <p>{config.interpretation}</p>
            <p>
              <strong>Methodology:</strong> {isCompareToZero
                ? 'We classify each release as "Positive" (> 0) or "Negative" (≤ 0).'
                : 'We compare each release to the prior reading.'
              } Returns are calculated from the closing price on release date, with 0.10% commission deducted.
            </p>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800">Historical Releases & SPY Returns</h2>
            <p className="text-gray-500 text-sm mt-1">
              {summary ? `${summary.total_releases} total` : "Loading..."} 
              {releases.length > 0 && ` • Showing ${releases.length}`} • 0.10% commission
            </p>
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
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase">Date</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 uppercase">
                        {config.valueLabel || 'Value'}
                      </th>
                      {!isCompareToZero && (
                        <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 uppercase">Prior</th>
                      )}
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 uppercase">
                        {isCompareToZero ? 'Type' : 'Direction'}
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">SPY</th>
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
                        <td className="px-3 py-3 text-right font-mono text-gray-700 text-sm">{formatPrice(release.spy_on_release)}</td>
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

        {/* Footer */}
        <div className="bg-gray-50 border rounded-xl p-6">
          <h3 className="font-bold text-gray-800 mb-3">Data Sources & Methodology</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li><strong>Source:</strong> FRED (Federal Reserve Economic Data)</li>
            <li><strong>SPY:</strong> Daily closing prices from Yahoo Finance (since 1993)</li>
            <li><strong>Commission:</strong> 0.10% deducted from all returns</li>
            <li><strong>Holding Periods:</strong> +3D, +1W, +1M, +2M, +3M</li>
            <li><strong>Disclaimer:</strong> Past performance ≠ future results. Educational purposes only.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}