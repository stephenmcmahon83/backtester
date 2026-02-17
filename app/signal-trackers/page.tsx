"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ──────────────────────────────────────
// Types
// ──────────────────────────────────────

type SignalType = "composite" | "rsi" | "streak" | "seasonal";
type Timeframe = "7d" | "30d" | "90d" | "1y" | "all";

type Pick = {
  id: number;
  pick_date: string;
  symbol: string;
  signal_type: SignalType;
  pick_type: "best" | "worst";
  rank: number;
  signal_value: number;
  historical_avg_return: number;
  historical_win_rate: number;
  historical_trade_count: number;
  entry_price: number;
  exit_date: string | null;
  exit_price: number | null;
  actual_return: number | null;
  is_winner: boolean | null;
};

type PerformanceStats = {
  totalPicks: number;
  closedPicks: number;
  openPicks: number;
  winners: number;
  losers: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number;
  bestTrade: number | null;
  worstTrade: number | null;
};

// ──────────────────────────────────────
// Config
// ──────────────────────────────────────

const SIGNAL_CONFIG: Record<
  SignalType,
  {
    name: string;
    description: string;
    bestLabel: string;
    worstLabel: string;
    valueLabel: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
    icon: string;
    href: string;
  }
> = {
  composite: {
    name: "Composite",
    description:
      "Average of Streak + RSI-bucket + Seasonal expected 5-day returns",
    bestLabel: "Best 5-Day Outlook",
    worstLabel: "Worst 5-Day Outlook",
    valueLabel: "Exp. Return",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    textColor: "text-indigo-800",
    icon: "⭐",
    href: "/market-snapshot",
  },
  rsi: {
    name: "RSI Bucket",
    description:
      "10-day avg RSI(2) bucket — historical 5-day return at this level",
    bestLabel: "Best Expected Return",
    worstLabel: "Worst Expected Return",
    valueLabel: "Exp. Return",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    textColor: "text-orange-800",
    icon: "📉",
    href: "/rsi-dashboard",
  },
  streak: {
    name: "Streaks",
    description:
      "Consecutive up/down days — historical 5-day return at this streak",
    bestLabel: "Best Expected Return",
    worstLabel: "Worst Expected Return",
    valueLabel: "Exp. Return",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-800",
    icon: "🔥",
    href: "/streaks-scanner",
  },
  seasonal: {
    name: "Seasonality",
    description:
      "Calendar trading-day — historical 5-day return from this day of year",
    bestLabel: "Strongest Seasonal Window",
    worstLabel: "Weakest Seasonal Window",
    valueLabel: "Exp. Return",
    bgColor: "bg-pink-50",
    borderColor: "border-pink-200",
    textColor: "text-pink-800",
    icon: "📅",
    href: "/seasonal-dashboard",
  },
};

const SIGNAL_ORDER: SignalType[] = ["composite", "rsi", "streak", "seasonal"];

// ──────────────────────────────────────
// Helpers
// ──────────────────────────────────────

const formatPercent = (value: number | null, showPlus = true): string => {
  if (value === null || value === undefined) return "-";
  const pct = (value * 100).toFixed(2);
  if (showPlus && value > 0) return `+${pct}%`;
  return `${pct}%`;
};

const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const getTimeframeLabel = (tf: Timeframe): string => {
  switch (tf) {
    case "7d":
      return "Last 7 Days";
    case "30d":
      return "Last 30 Days";
    case "90d":
      return "Last 90 Days";
    case "1y":
      return "Last Year";
    case "all":
      return "All Time";
  }
};

const getDateCutoff = (tf: Timeframe): Date | null => {
  if (tf === "all") return null;
  const d = new Date();
  switch (tf) {
    case "7d":
      d.setDate(d.getDate() - 7);
      return d;
    case "30d":
      d.setDate(d.getDate() - 30);
      return d;
    case "90d":
      d.setDate(d.getDate() - 90);
      return d;
    case "1y":
      d.setFullYear(d.getFullYear() - 1);
      return d;
    default:
      return null;
  }
};

const calculateStats = (picks: Pick[]): PerformanceStats => {
  const closed = picks.filter((p) => p.actual_return !== null);
  const open = picks.filter((p) => p.actual_return === null);
  const wins = closed.filter((p) => p.is_winner === true);
  const losses = closed.filter((p) => p.is_winner === false);
  const rets = closed.map((p) => p.actual_return ?? 0);
  const total = rets.reduce((s, r) => s + r, 0);
  return {
    totalPicks: picks.length,
    closedPicks: closed.length,
    openPicks: open.length,
    winners: wins.length,
    losers: losses.length,
    winRate: closed.length ? wins.length / closed.length : 0,
    avgReturn: closed.length ? total / closed.length : 0,
    totalReturn: total,
    bestTrade: rets.length ? Math.max(...rets) : null,
    worstTrade: rets.length ? Math.min(...rets) : null,
  };
};

// ──────────────────────────────────────
// Component
// ──────────────────────────────────────

export default function SignalTrackersPage() {
  const [allPicks, setAllPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("90d");
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);

  // ── Fetch all picks ───────────────────────
  const fetchPicks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from("signal_picks")
        .select("*")
        .order("pick_date", { ascending: false });
      if (e) throw e;
      setAllPicks(data || []);
    } catch (e: any) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPicks();
  }, [fetchPicks]);

  // ── Generate picks ────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateMsg(null);
    setError(null);
    try {
      const { data, error: e } = await supabase.functions.invoke(
        "generate-signal-picks"
      );
      if (e) throw e;
      setGenerateMsg(
        `✅ ${data.new_picks ?? 0} new picks saved, ${data.closed_positions ?? 0} positions closed.`
      );
      await fetchPicks();
    } catch (e: any) {
      console.error(e);
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Computed stats by signal type ─────────
  const statsBySignal = useMemo(() => {
    const cutoff = getDateCutoff(timeframe);
    const inRange = cutoff
      ? allPicks.filter((p) => new Date(p.pick_date) >= cutoff)
      : allPicks;

    const result: Record<
      string,
      { best: PerformanceStats; worst: PerformanceStats; spread: number }
    > = {};

    SIGNAL_ORDER.forEach((type) => {
      const tp = inRange.filter((p) => p.signal_type === type);
      const bestStats = calculateStats(
        tp.filter((p) => p.pick_type === "best")
      );
      const worstStats = calculateStats(
        tp.filter((p) => p.pick_type === "worst")
      );
      result[type] = {
        best: bestStats,
        worst: worstStats,
        spread: bestStats.avgReturn - worstStats.avgReturn,
      };
    });

    return result;
  }, [allPicks, timeframe]);

  // ── Format signal value ───────────────────
  const formatSignalValue = (pick: Pick): string => {
    if (pick.signal_value === null || pick.signal_value === undefined)
      return "-";
    const pct = (pick.signal_value * 100).toFixed(2);
    return pick.signal_value > 0 ? `+${pct}%` : `${pct}%`;
  };

  // ── Counters ──────────────────────────────
  const totalClosed = allPicks.filter((p) => p.exit_price !== null).length;
  const totalOpen = allPicks.filter((p) => p.exit_price === null).length;
  const recentPicks = allPicks.slice(0, 30);

  // ──────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Header ──────────────────────── */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Signal Performance Trackers
          </h1>
          <p className="mt-2 text-gray-600 max-w-3xl">
            Every trading day we pick the <strong>top 3</strong> and{" "}
            <strong>bottom 3</strong> stocks for each signal — ranked by the
            same scores shown on the{" "}
            <Link href="/market-snapshot" className="text-indigo-600 underline">
              Market Snapshot
            </Link>{" "}
            page — then track their 5-day forward returns.
          </p>

          {!loading && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full font-medium">
                {allPicks.length.toLocaleString()} Total Picks
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                {totalClosed.toLocaleString()} Closed
              </span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                {totalOpen.toLocaleString()} Open
              </span>
            </div>
          )}
        </div>

        {/* ── Generate Button ─────────────── */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className={`px-5 py-2.5 rounded-lg font-semibold text-white shadow transition-all ${
              generating
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {generating ? "Generating…" : "Generate Today's Picks"}
          </button>

          {generateMsg && (
            <span className="text-sm text-green-700 font-medium">
              {generateMsg}
            </span>
          )}
        </div>

        {/* ── Timeframe Selector ──────────── */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Performance Timeframe
          </label>
          <div className="flex flex-wrap gap-2">
            {(["7d", "30d", "90d", "1y", "all"] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  timeframe === tf
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {getTimeframeLabel(tf)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading / Error ─────────────── */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading signal data…</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Error loading data</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* ── Signal Cards ────────────────── */}
        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {SIGNAL_ORDER.map((type) => {
                const cfg = SIGNAL_CONFIG[type];
                const stats = statsBySignal[type];
                if (!stats) return null;

                const hasData =
                  stats.best.closedPicks > 0 || stats.worst.closedPicks > 0;

                return (
                  <Link
                    key={type}
                    href={cfg.href}
                    className={`block p-6 rounded-xl border-2 transition-all hover:shadow-lg hover:-translate-y-1 ${cfg.bgColor} ${cfg.borderColor}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{cfg.icon}</span>
                        <h3
                          className={`text-lg font-bold ${cfg.textColor}`}
                        >
                          {cfg.name}
                        </h3>
                      </div>
                      <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                        {stats.best.closedPicks + stats.worst.closedPicks}{" "}
                        trades
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">
                      {cfg.description}
                    </p>

                    {hasData ? (
                      <div className="space-y-3">
                        {/* Best */}
                        <div className="bg-white/60 rounded-lg p-3">
                          <div className="text-xs font-medium text-green-700 mb-1">
                            ▲ {cfg.bestLabel}
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>
                              Win Rate:{" "}
                              <strong
                                className={
                                  stats.best.winRate >= 0.5
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {(stats.best.winRate * 100).toFixed(0)}%
                              </strong>
                            </span>
                            <span>
                              Avg:{" "}
                              <strong
                                className={
                                  stats.best.avgReturn >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {formatPercent(stats.best.avgReturn)}
                              </strong>
                            </span>
                          </div>
                        </div>

                        {/* Worst */}
                        <div className="bg-white/60 rounded-lg p-3">
                          <div className="text-xs font-medium text-red-700 mb-1">
                            ▼ {cfg.worstLabel}
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>
                              Loss Rate:{" "}
                              <strong
                                className={
                                  stats.worst.winRate <= 0.5
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {((1 - stats.worst.winRate) * 100).toFixed(
                                  0
                                )}
                                %
                              </strong>
                            </span>
                            <span>
                              Avg:{" "}
                              <strong
                                className={
                                  stats.worst.avgReturn <= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {formatPercent(stats.worst.avgReturn)}
                              </strong>
                            </span>
                          </div>
                        </div>

                        {/* Spread */}
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">
                              Long-Short Spread:
                            </span>
                            <span
                              className={`font-bold ${
                                stats.spread > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatPercent(stats.spread)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No closed trades yet
                      </div>
                    )}

                    <div className="mt-4 text-center">
                      <span
                        className={`text-sm font-semibold ${cfg.textColor}`}
                      >
                        View Details →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* ── Recent Picks Table ──────── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Recent Picks</h3>
                <span className="text-xs text-gray-500">
                  Last 30 picks across all signals
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Signal</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Symbol</th>
                      <th className="px-4 py-3 text-right">Exp. 5D Rtn</th>
                      <th className="px-4 py-3 text-right">Hist Win%</th>
                      <th className="px-4 py-3 text-right">Entry</th>
                      <th className="px-4 py-3 text-right">Exit</th>
                      <th className="px-4 py-3 text-right">Actual Rtn</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentPicks.map((pick) => {
                      const cfg = SIGNAL_CONFIG[pick.signal_type];
                      return (
                        <tr key={pick.id} className="hover:bg-gray-50">
                          {/* Date */}
                          <td className="px-4 py-3 text-gray-600">
                            {formatDate(pick.pick_date)}
                          </td>

                          {/* Signal icon + name */}
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1">
                              <span
                                className="text-lg"
                                title={cfg?.name}
                              >
                                {cfg?.icon || "📊"}
                              </span>
                              <span className="text-xs text-gray-500 hidden sm:inline">
                                {cfg?.name}
                              </span>
                            </span>
                          </td>

                          {/* Best / Worst badge */}
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-xs font-bold rounded-full ${
                                pick.pick_type === "best"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {pick.pick_type.toUpperCase()}
                            </span>
                          </td>

                          {/* Symbol */}
                          <td className="px-4 py-3 font-bold text-indigo-600">
                            {pick.symbol}
                          </td>

                          {/* Expected return (signal_value) */}
                          <td
                            className={`px-4 py-3 text-right font-mono ${
                              pick.signal_value > 0
                                ? "text-green-600"
                                : pick.signal_value < 0
                                ? "text-red-600"
                                : "text-gray-600"
                            }`}
                          >
                            {formatSignalValue(pick)}
                          </td>

                          {/* Historical win rate */}
                          <td className="px-4 py-3 text-right font-mono text-gray-600">
                            {pick.historical_win_rate
                              ? `${(pick.historical_win_rate * 100).toFixed(0)}%`
                              : "-"}
                          </td>

                          {/* Entry price */}
                          <td className="px-4 py-3 text-right font-mono">
                            ${pick.entry_price?.toFixed(2)}
                          </td>

                          {/* Exit price */}
                          <td className="px-4 py-3 text-right font-mono">
                            {pick.exit_price !== null
                              ? `$${pick.exit_price.toFixed(2)}`
                              : "-"}
                          </td>

                          {/* Actual return */}
                          <td
                            className={`px-4 py-3 text-right font-mono font-bold ${
                              pick.actual_return === null
                                ? "text-gray-400"
                                : pick.actual_return >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatPercent(pick.actual_return)}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 text-center">
                            {pick.exit_price === null ? (
                              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                OPEN
                              </span>
                            ) : pick.is_winner ? (
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                WIN
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                                LOSS
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {recentPicks.length === 0 && (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-8 text-center text-gray-400"
                        >
                          No picks yet. Click &quot;Generate Today&apos;s
                          Picks&quot; to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── How It Works ────────────── */}
            <section className="mt-12 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                How Signal Tracking Works
              </h2>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-indigo-600">
                      1
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Daily Selection
                  </h3>
                  <p className="text-sm text-gray-600">
                    Each trading day we identify the{" "}
                    <strong>top 3 &quot;best&quot;</strong> and{" "}
                    <strong>bottom 3 &quot;worst&quot;</strong> stocks for
                    each signal type, ranked by the same scores on the Market
                    Snapshot page.
                  </p>
                </div>

                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-indigo-600">
                      2
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">
                    5-Day Hold
                  </h3>
                  <p className="text-sm text-gray-600">
                    We track each pick for exactly{" "}
                    <strong>5 trading days</strong>, then automatically
                    record the exit price and return.
                  </p>
                </div>

                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-indigo-600">
                      3
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Performance Analysis
                  </h3>
                  <p className="text-sm text-gray-600">
                    We calculate win rates, average returns, and the{" "}
                    <strong>&quot;spread&quot;</strong> between best and
                    worst picks to measure predictive power.
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
                <h4 className="font-semibold text-indigo-800 mb-2">
                  Understanding the Spread
                </h4>
                <p className="text-sm text-indigo-700">
                  A positive spread means &quot;best&quot; picks outperform
                  &quot;worst&quot; picks — exactly what we want! This
                  indicates the signal has predictive power. The larger the
                  spread, the stronger the signal.
                </p>
              </div>

              <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-semibold text-amber-800 mb-2">
                  ⭐ About the Composite Signal
                </h4>
                <p className="text-sm text-amber-700">
                  The Composite signal averages the Streak, RSI-bucket, and
                  Seasonal expected 5-day returns into a single score. It
                  represents the average historical 5-day return across all
                  three signals at the stock&apos;s current condition —
                  giving you a more robust measure of near-term outlook.
                </p>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">
                  📊 How &quot;Best&quot; and &quot;Worst&quot; Wins Work
                </h4>
                <p className="text-sm text-blue-700">
                  A <strong>&quot;best&quot;</strong> pick wins if the stock
                  goes <strong>up</strong> over 5 days (we expect it to
                  rise). A <strong>&quot;worst&quot;</strong> pick wins if
                  the stock goes <strong>down</strong> over 5 days (we
                  expect it to fall). This lets us measure whether the
                  signal correctly separates winners from losers.
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}