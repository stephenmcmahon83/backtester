import React from 'react';

// --- TYPES ---
export type RsiRow = {
  ticker: string;
  years_of_data: number;
  current_avg_rsi: number;
  current_rsi_bucket: number;
  trades_1d: number;
  avg_ret_1d: number;
  win_pct_1d: number;
  trades_2d: number;
  avg_ret_2d: number;
  win_pct_2d: number;
  trades_3d: number;
  avg_ret_3d: number;
  win_pct_3d: number;
  trades_5d: number;
  avg_ret_5d: number;
  win_pct_5d: number;
  trades_10d: number;
  avg_ret_10d: number;
  win_pct_10d: number;
};

export type SortConfig = {
  key: keyof RsiRow;
  direction: 'ascending' | 'descending';
} | null;

interface RsiTableProps {
  data: RsiRow[];
  requestSort: (key: keyof RsiRow) => void;
  sortConfig: SortConfig;
}

// --- HELPERS ---
const formatPercent = (value: number | null) => {
  if (value === null || value === undefined) return '-';
  const color = value >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold';
  const sign = value > 0 ? '+' : '';
  return <span className={color}>{`${sign}${(value * 100).toFixed(2)}%`}</span>;
};

const formatWinRate = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    const color = value >= 50 ? 'text-green-600 font-bold' : 'text-red-600 font-bold';
    return <span className={color}>{`${value.toFixed(0)}%`}</span>;
}

// --- SUB-COMPONENTS ---
const SortableHeader = ({ 
  title, sortKey, sortConfig, requestSort, tooltipText, className = "" 
}: { 
  title: string; sortKey: keyof RsiRow; sortConfig: SortConfig; requestSort: any; tooltipText: string; className?: string; 
}) => {
  const isSorted = sortConfig?.key === sortKey;
  const directionIcon = isSorted ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : '';
  
  return (
    <th
      scope="col"
      className={`group relative px-2 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors border-b border-gray-200 ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center justify-center gap-1">
        {title}
        {isSorted && <span className="text-indigo-600">{directionIcon}</span>}
      </div>
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-32 text-center z-50 font-normal normal-case">
        {tooltipText}
      </div>
    </th>
  );
};

const ResultGroup = ({ trades, avg_ret, win_pct }: { trades: number, avg_ret: number, win_pct: number }) => (
    <>
        <td className="px-2 py-3 whitespace-nowrap text-xs text-center text-gray-400 border-l border-gray-100">{trades}</td>
        <td className="px-2 py-3 whitespace-nowrap text-sm text-center">{formatPercent(avg_ret)}</td>
        <td className="px-2 py-3 whitespace-nowrap text-sm text-center">{formatWinRate(win_pct)}</td>
    </>
);

// --- MAIN COMPONENT ---
export default function RsiTable({ data, requestSort, sortConfig }: RsiTableProps) {
  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {/* Row 1: Group Headers */}
            <tr className="bg-gray-50 shadow-sm">
              <th colSpan={4} className="px-4 py-2 text-center text-xs font-extrabold text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">Ticker Stats</th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-extrabold text-gray-800 uppercase tracking-wider border-l border-b border-gray-200 bg-blue-50">1 Day Hold</th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-extrabold text-gray-800 uppercase tracking-wider border-l border-b border-gray-200 bg-indigo-50">2 Day Hold</th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-extrabold text-gray-800 uppercase tracking-wider border-l border-b border-gray-200 bg-blue-50">3 Day Hold</th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-extrabold text-gray-800 uppercase tracking-wider border-l border-b border-gray-200 bg-indigo-50">5 Day Hold</th>
              <th colSpan={3} className="px-4 py-2 text-center text-xs font-extrabold text-gray-800 uppercase tracking-wider border-l border-b border-gray-200 bg-blue-50">10 Day Hold</th>
            </tr>

            {/* Row 2: Sortable Metrics Headers */}
            <tr className="bg-gray-50 shadow-sm">
              <SortableHeader 
                title="Ticker" 
                sortKey="ticker" 
                sortConfig={sortConfig} 
                requestSort={requestSort} 
                tooltipText="Stock Symbol"
                className="bg-gray-50 border-r border-gray-200 text-left pl-4"
              />
              <SortableHeader title="Yrs" sortKey="years_of_data" sortConfig={sortConfig} requestSort={requestSort} tooltipText="Years of historical data used" />
              <SortableHeader title="RSI" sortKey="current_avg_rsi" sortConfig={sortConfig} requestSort={requestSort} tooltipText="Current 10-day Avg RSI(2)" />
              <SortableHeader title="Bkt" sortKey="current_rsi_bucket" sortConfig={sortConfig} requestSort={requestSort} tooltipText="RSI Bucket" />
              
              {['1d', '2d', '3d', '5d', '10d'].map((period, index) => {
                  const bgClass = index % 2 === 0 ? 'bg-blue-50' : 'bg-indigo-50'; 
                  return (
                    <React.Fragment key={period}>
                        <th className={`px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider border-l border-gray-200 ${bgClass}`}>#</th>
                        <SortableHeader className={bgClass} title="Ret" sortKey={`avg_ret_${period}` as keyof RsiRow} sortConfig={sortConfig} requestSort={requestSort} tooltipText={`Avg Return`} />
                        <SortableHeader className={bgClass} title="Win%" sortKey={`win_pct_${period}` as keyof RsiRow} sortConfig={sortConfig} requestSort={requestSort} tooltipText={`Win Rate`} />
                    </React.Fragment>
                  );
              })}
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row) => (
              <tr key={row.ticker} className="hover:bg-blue-50 transition-colors duration-150 group">
                <td className="bg-white group-hover:bg-blue-50 px-3 py-3 whitespace-nowrap text-sm font-bold text-gray-900 border-r border-gray-100 pl-4">
                  {row.ticker}
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-sm text-center text-gray-700">{row.years_of_data}</td>
                <td className="px-2 py-3 whitespace-nowrap text-sm text-center text-gray-900 font-mono">{row.current_avg_rsi.toFixed(0)}</td>
                <td className="px-2 py-3 whitespace-nowrap text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    {row.current_rsi_bucket}
                  </span>
                </td>
                
                <ResultGroup trades={row.trades_1d} avg_ret={row.avg_ret_1d} win_pct={row.win_pct_1d} />
                <ResultGroup trades={row.trades_2d} avg_ret={row.avg_ret_2d} win_pct={row.win_pct_2d} />
                <ResultGroup trades={row.trades_3d} avg_ret={row.avg_ret_3d} win_pct={row.win_pct_3d} />
                <ResultGroup trades={row.trades_5d} avg_ret={row.avg_ret_5d} win_pct={row.win_pct_5d} />
                <ResultGroup trades={row.trades_10d} avg_ret={row.avg_ret_10d} win_pct={row.win_pct_10d} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}