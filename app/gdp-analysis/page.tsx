"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ============ SUPABASE CLIENT (using env variables) ============
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============ TYPES ============
type GdpRelease = {
  id: number;
  quarter: string;
  period_date: string;
  release_date: string;
  gdp_growth: number;
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
  total_releases: number;
  positive_gdp_count: number;
  negative_gdp_count: number;
  pos_avg_return_3d: number | null;
  pos_avg_return_1w: number | null;
  pos_avg_return_1m: number | null;
  pos_avg_return_2m: number | null;
  pos_avg_return_3m: number | null;
  pos_pct_positive_3d: number | null;
  pos_pct_positive_1w: number | null;
  pos_pct_positive_1m: number | null;
  pos_pct_positive_2m: number | null;
  pos_pct_positive_3m: number | null;
  neg_avg_return_3d: number | null;
  neg_avg_return_1w: number | null;
  neg_avg_return_1m: number | null;
  neg_avg_return_2m: number | null;
  neg_avg_return_3m: number | null;
  neg_pct_positive_3d: number | null;
  neg_pct_positive_1w: number | null;
  neg_pct_positive_1m: number | null;
  neg_pct_positive_2m: number | null;
  neg_pct_positive_3m: number | null;
};

export default function GdpAnalysisPage() {
  const [releases, setReleases] = useState<GdpRelease[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============ COPY/PASTE PROTECTION ============
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "v", "x", "a", "u", "s"].includes(e.key.toLowerCase())
      ) {
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

  // ============ FETCH DATA FROM SUPABASE ============
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch releases
        const { data: releasesData, error: releasesError } = await supabase
          .from("gdp_spy_analysis")
          .select("*")
          .order("release_date", { ascending: false });

        if (releasesError) throw releasesError;

        // Fetch summary stats from view
        const { data: summaryData, error: summaryError } = await supabase
          .from("gdp_summary_stats")
          .select("*")
          .single();

        if (summaryError) throw summaryError;

        setReleases(releasesData || []);
        setSummary(summaryData);
      } catch (err: unknown) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  const getReturnColor = (val: number | null): string => {
    if (val === null || val === undefined) return "text-gray-400";
    return val >= 0 ? "text-emerald-600" : "text-red-600";
  };

  const getGdpBadgeStyle = (val: number): string => {
    return val >= 0
      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
      : "bg-red-100 text-red-800 border border-red-200";
  };

  // Get year range from data
  const getYearRange = (): string => {
    if (!releases || releases.length === 0) return "";
    const years = releases.map((r) => parseInt(r.quarter.split(" ")[1]));
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    return `${minYear} - ${maxYear}`;
  };

  // ============ RENDER ============
  return (
    <div
      className="min-h-screen bg-gray-50 p-6 md:p-10"
      style={{ userSelect: "none" }}
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          GDP & Stock Market Analysis
        </h1>
        <p className="text-gray-500">
          Analyzing how US GDP releases correlate with S&P 500 (SPY) performance
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent mb-4"></div>
            <p className="text-gray-600 font-medium">Loading GDP data...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="text-red-800 font-semibold mb-2">Error Loading Data</h3>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && summary && (
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Data Source Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-sm text-blue-800">
              <span className="font-semibold">Source:</span> FRED (Federal Reserve) |{" "}
              <span className="font-semibold">Series:</span> Real GDP % Change (QoQ, Annualized) |{" "}
              <span className="font-semibold">Period:</span> {getYearRange()}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Positive GDP Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100">
                <h2 className="text-lg font-bold text-emerald-800">
                  After Positive GDP
                </h2>
                <p className="text-emerald-600 text-sm">
                  {summary.positive_gdp_count} releases with GDP &gt; 0%
                </p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-5 gap-3 text-center">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      +3 Days
                    </div>
                    <div className={`text-lg font-bold ${getReturnColor(summary.pos_avg_return_3d)}`}>
                      {formatPct(summary.pos_avg_return_3d)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {summary.pos_pct_positive_3d}% win
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      +1 Week
                    </div>
                    <div className={`text-lg font-bold ${getReturnColor(summary.pos_avg_return_1w)}`}>
                      {formatPct(summary.pos_avg_return_1w)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {summary.pos_pct_positive_1w}% win
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      +1 Month
                    </div>
                    <div className={`text-lg font-bold ${getReturnColor(summary.pos_avg_return_1m)}`}>
                      {formatPct(summary.pos_avg_return_1m)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {summary.pos_pct_positive_1m}% win
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      +2 Months
                    </div>
                    <div className={`text-lg font-bold ${getReturnColor(summary.pos_avg_return_2m)}`}>
                      {formatPct(summary.pos_avg_return_2m)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {summary.pos_pct_positive_2m}% win
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      +3 Months
                    </div>
                    <div className={`text-lg font-bold ${getReturnColor(summary.pos_avg_return_3m)}`}>
                      {formatPct(summary.pos_avg_return_3m)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {summary.pos_pct_positive_3m}% win
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Negative GDP Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-red-50 px-6 py-4 border-b border-red-100">
                <h2 className="text-lg font-bold text-red-800">
                  After Negative GDP
                </h2>
                <p className="text-red-600 text-sm">
                  {summary.negative_gdp_count} releases with GDP ≤ 0%
                </p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-5 gap-3 text-center">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      +3 Days
                    </div>
                    <div className={`text-lg font-bold ${getReturnColor(summary.neg_avg_return_3d)}`}>
                      {formatPct(summary.neg_avg_return_3d)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {summary.neg_pct_positive_3d}% win
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      +1 Week
                    </div>
                    <div className={`text-lg font-bold ${getReturnColor(summary.neg_avg_return_1w)}`}>
                      {formatPct(summary.neg_avg_return_1w)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {summary.neg_pct_positive_1w}% win
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      +1 Month
                    </div>
                    <div className={`text-lg font-bold ${getReturnColor(summary.neg_avg_return_1m)}`}>
                      {formatPct(summary.neg_avg_return_1m)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {summary.neg_pct_positive_1m}% win
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      +2 Months
                    </div>
                    <div className={`text-lg font-bold ${getReturnColor(summary.neg_avg_return_2m)}`}>
                      {formatPct(summary.neg_avg_return_2m)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {summary.neg_pct_positive_2m}% win
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      +3 Months
                    </div>
                    <div className={`text-lg font-bold ${getReturnColor(summary.neg_avg_return_3m)}`}>
                      {formatPct(summary.neg_avg_return_3m)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {summary.neg_pct_positive_3m}% win
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Methodology Explanation */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How Results Are Calculated
            </h3>
            <div className="text-sm text-amber-900 space-y-3">
              <p>
                <strong>GDP Release Timing:</strong> The Bureau of Economic Analysis (BEA) releases GDP data at <strong>8:30 AM Eastern Time</strong> on the scheduled release date. This occurs before the stock market opens at 9:30 AM ET, giving traders time to react to the news.
              </p>
              <p>
                <strong>Trade Entry:</strong> Results are calculated assuming you buy SPY at the <strong>closing price on the GDP release date</strong> (or the next trading day if released on a weekend/holiday). This represents entering a position after the market has had a full day to digest the GDP news.
              </p>
              <p>
                <strong>Trade Exit & Holding Periods:</strong> Returns are calculated for five holding periods: <strong>+3 Days</strong> (3 trading days), <strong>+1 Week</strong> (5 trading days), <strong>+1 Month</strong> (21 trading days), <strong>+2 Months</strong> (42 trading days), and <strong>+3 Months</strong> (63 trading days) after entry.
              </p>
              <p>
                <strong>Commission Adjustment:</strong> All returns shown include a <strong>0.10% deduction</strong> to account for round-trip trading costs (commissions, bid-ask spread, and slippage). This provides a more realistic view of actual trading performance.
              </p>
              <p>
                <strong>Win Rate:</strong> The percentage of trades that were profitable after commissions. A win rate above 50% combined with a positive average return suggests a potentially exploitable pattern.
              </p>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">
                Historical GDP Releases & SPY Returns
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {summary.total_releases} quarterly releases ({getYearRange()}) • Returns include 0.10% commission
              </p>
            </div>

            <div className="overflow-x-auto" style={{ maxHeight: "600px" }}>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Quarter
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Release
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                      GDP
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                      SPY
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                      +3D
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                      +1W
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                      +1M
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                      +2M
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                      +3M
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {releases.map((release) => (
                    <tr
                      key={release.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-semibold text-gray-900 text-sm">
                          {release.quarter}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-gray-600 text-sm">
                        {release.release_date}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${getGdpBadgeStyle(release.gdp_growth)}`}
                        >
                          {formatPct(release.gdp_growth, 1)}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right font-mono text-gray-700 text-sm">
                        {formatPrice(release.spy_on_release)}
                      </td>
                      <td className={`px-3 py-3 whitespace-nowrap text-right font-mono text-sm font-semibold ${getReturnColor(release.return_3d)}`}>
                        {formatPct(release.return_3d)}
                      </td>
                      <td className={`px-3 py-3 whitespace-nowrap text-right font-mono text-sm font-semibold ${getReturnColor(release.return_1w)}`}>
                        {formatPct(release.return_1w)}
                      </td>
                      <td className={`px-3 py-3 whitespace-nowrap text-right font-mono text-sm font-semibold ${getReturnColor(release.return_1m)}`}>
                        {formatPct(release.return_1m)}
                      </td>
                      <td className={`px-3 py-3 whitespace-nowrap text-right font-mono text-sm font-semibold ${getReturnColor(release.return_2m)}`}>
                        {formatPct(release.return_2m)}
                      </td>
                      <td className={`px-3 py-3 whitespace-nowrap text-right font-mono text-sm font-semibold ${getReturnColor(release.return_3m)}`}>
                        {formatPct(release.return_3m)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Methodology Note */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
            <h3 className="font-bold text-gray-800 mb-3">Data Sources & Methodology</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>
                <strong>GDP Data:</strong> Real GDP % Change (Quarter-over-Quarter, Seasonally Adjusted Annual Rate) from FRED, Federal Reserve Bank of St. Louis. Series ID: A191RL1Q225SBEA
              </li>
              <li>
                <strong>Release Dates:</strong> Actual initial release dates ("Advance Estimate") from FRED vintage data where available (2014-present). For earlier quarters (1993-2013), release dates are estimated based on the standard BEA schedule (~28 days after quarter end).
              </li>
              <li>
                <strong>SPY Prices:</strong> Daily closing prices from Yahoo Finance. SPY (SPDR S&P 500 ETF Trust) has been trading since January 1993.
              </li>
              <li>
                <strong>Trading Costs:</strong> A 0.10% round-trip commission is deducted from all returns to reflect realistic trading costs including commissions, bid-ask spread, and slippage.
              </li>
              <li>
                <strong>Holding Periods:</strong> +3 Days = 3 trading days, +1 Week = 5 trading days, +1 Month = 21 trading days, +2 Months = 42 trading days, +3 Months = 63 trading days.
              </li>
              <li>
                <strong>Important Note:</strong> Past performance does not guarantee future results. This analysis does not account for GDP consensus expectations—markets often react to the "surprise" (actual vs. expected) rather than the absolute number.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}