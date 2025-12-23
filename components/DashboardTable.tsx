import React from 'react';

// Matches the Edge Function return exactly
export type DashboardRow = {
  ticker: string;
  pctChange: number | null;
  cumulativeRsi: number | null;
  trend_200: string; 
  trend_100: string;
  vs52wHigh: number | null;
  vs52wLow: number | null;
  perf52w: number | null;
  perf26w: number | null;
};

type SortConfig = {
  key: keyof DashboardRow;
  direction: 'ascending' | 'descending';
} | null;

interface DashboardTableProps {
  data: DashboardRow[];
  requestSort: (key: keyof DashboardRow) => void;
  sortConfig: SortConfig;
}

// Formats percentages. Daily % gets 2 decimals, others get 0.
const formatPercent = (value: number | null, decimalPlaces: number = 0) => {
  if (value === null || value === undefined) return '-';
  const color = value >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold';
  return <span className={color}>{`${(value * 100).toFixed(decimalPlaces)}%`}</span>;
};

const getTrendDisplay = (trend: string | null) => {
  if (!trend || trend === 'N/A') return <span className="text-gray-400 text-xs">N/A</span>;
  if (trend === 'BULL') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
        BULL
      </span>
    );
  }
  if (trend === 'BEAR') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
        BEAR
      </span>
    );
  }
  return <span className="text-gray-500">{trend}</span>;
};

const SortableHeader = ({ 
  title, sortKey, sortConfig, requestSort, tooltipText, className = "" 
}: { 
  title: string; sortKey: keyof DashboardRow; sortConfig: SortConfig; requestSort: any; tooltipText: string; className?: string; 
}) => {
  const isSorted = sortConfig?.key === sortKey;
  const directionIcon = isSorted ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : '';
  
  return (
    <th
      className={`group relative px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center justify-end gap-1">
        {title}
        {isSorted && <span className="text-indigo-600">{directionIcon}</span>}
      </div>
      {/* Tooltip positioned below header */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-40 text-center z-50">
        {tooltipText}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
      </div>
    </th>
  );
};

export default function DashboardTable({ data, requestSort, sortConfig }: DashboardTableProps) {
  return (
    <div className="w-full max-w-full bg-white p-4 sm:p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">Market Health Dashboard</h2>
        <span className="text-xs text-gray-400 italic">Hover headers for details</span>
      </div>
      <div className="overflow-auto h-[80vh] border border-gray-200 rounded-lg scrollbar-thin scrollbar-thumb-gray-300">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
            <tr>
              <SortableHeader title="Ticker" sortKey="ticker" sortConfig={sortConfig} requestSort={requestSort} tooltipText="Stock Symbol" className="sticky left-0 bg-gray-50 z-30" />
              <SortableHeader title="Daily %" sortKey="pctChange" sortConfig={sortConfig} requestSort={requestSort} tooltipText="Change from previous close" className="text-right" />
              <SortableHeader title="RSI" sortKey="cumulativeRsi" sortConfig={sortConfig} requestSort={requestSort} tooltipText="Relative Strength Index" className="text-right" />
              <SortableHeader title="vs 200 Days" sortKey="trend_200" sortConfig={sortConfig} requestSort={requestSort} tooltipText="Trend vs 200 Day Price" className="text-center" />
              <SortableHeader title="vs 100 Days" sortKey="trend_100" sortConfig={sortConfig} requestSort={requestSort} tooltipText="Trend vs 100 Day Price" className="text-center" />
              <SortableHeader title="vs 52W High" sortKey="vs52wHigh" sortConfig={sortConfig} requestSort={requestSort} tooltipText="Distance to 52W High" className="text-right" />
              <SortableHeader title="vs 52W Low" sortKey="vs52wLow" sortConfig={sortConfig} requestSort={requestSort} tooltipText="Distance to 52W Low" className="text-right" />
              <SortableHeader title="26W Perf" sortKey="perf26w" sortConfig={sortConfig} requestSort={requestSort} tooltipText="26 Week Performance" className="text-right" />
              <SortableHeader title="52W Perf" sortKey="perf52w" sortConfig={sortConfig} requestSort={requestSort} tooltipText="52 Week Performance" className="text-right" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row) => (
              <tr key={row.ticker} className="hover:bg-blue-50 transition-colors duration-150">
                <th scope="row" className="sticky left-0 bg-white hover:bg-blue-50 z-10 px-3 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-left border-r border-gray-100">
                  {row.ticker}
                </th>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-right">{formatPercent(row.pctChange, 2)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right font-mono">{row.cumulativeRsi !== null ? Math.round(row.cumulativeRsi) : '-'}</td>
                <td className="px-3 py-3 whitespace-nowrap text-center">{getTrendDisplay(row.trend_200)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-center">{getTrendDisplay(row.trend_100)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-right">{formatPercent(row.vs52wHigh, 0)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-right">{formatPercent(row.vs52wLow, 0)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-right">{formatPercent(row.perf26w, 0)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-right">{formatPercent(row.perf52w, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}