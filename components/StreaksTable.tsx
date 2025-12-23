"use client";
import React from 'react';

// --- TYPES ---
type StreakRow = {
  ticker: string;
  years_of_data: number;
  current_streak: number;
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

type SortConfig = {
  key: keyof StreakRow;
  direction: 'ascending' | 'descending';
} | null;

type StreaksTableProps = {
  data: StreakRow[];
  requestSort: (key: keyof StreakRow) => void;
  sortConfig: SortConfig;
};

// --- HELPER FUNCTIONS ---
const formatPercent = (value: number | null) => {
  if (value === null || value === undefined) return '-';
  const color = value >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold';
  const sign = value > 0 ? '+' : '';
  return <span className={color}>{`${sign}${(value).toFixed(2)}%`}</span>;
};

const formatWinRate = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    const color = value >= 50 ? 'text-green-600 font-bold' : 'text-red-600 font-bold';
    return <span className={color}>{`${value.toFixed(0)}%`}</span>;
};

const formatStreak = (value: number) => {
    if (value === 0) return <span className="text-gray-400">-</span>;
    const isPositive = value > 0;
    const bgClass = isPositive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200';
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${bgClass}`}>
            {isPositive ? `+${value}` : value}
        </span>
    );
};

// --- SUB-COMPONENTS ---

// 1. Sortable Header with Tooltip
const SortableHeader = ({ 
  title, sortKey, sortConfig, requestSort, tooltipText, className = "" 
}: { 
  title: string; sortKey: keyof StreakRow; sortConfig: SortConfig; requestSort: any; tooltipText: string; className?: string; 
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

      {/* Tooltip */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-32 text-center z-50 font-normal normal-case">
        {tooltipText}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
      </div>
    </th>
  );
};

// 2. Result Group (Data Cells for a specific period)
const ResultGroup = ({ trades, avg_ret, win_pct }: { trades: number, avg_ret: number, win_pct: number }) => (
    <>
        <td className="px-2 py-3 whitespace-nowrap text-sm text-center text-gray-500 border-l border-gray-100">{trades.toLocaleString()}</td>
        <td className="px-2 py-3 whitespace-nowrap text-sm text-center">{formatPercent(avg_ret)}</td>
        <td className="px-2 py-3 whitespace-nowrap text-sm text-center">{formatWinRate(win_pct)}</td>
    </>
);


// --- MAIN COMPONENT ---
const StreaksTable: React.FC<StreaksTableProps> = ({ data, requestSort, sortConfig }) => {
  
  const periods = [1, 2, 3, 5, 10];

  return (
    <div className="w-full max-w-full bg-white p-4 sm:p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">Streak Performance Analysis</h2>
        <span className="text-xs text-gray-400 italic">Historical returns following current streak</span>
      </div>

      <div className="overflow-auto h-[80vh] border border-gray-200 rounded-lg scrollbar-thin scrollbar-thumb-gray-300">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            
            {/* Row 1: Group Headers */}
            <tr className="sticky top-0 z-30 bg-gray-50 shadow-sm">
              <th colSpan={3} className="px-6 py-2 text-center text-xs font-extrabold text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">Ticker Stats</th>
              <th colSpan={3} className="px-6 py-2 text-center text-xs font-extrabold text-gray-800 uppercase tracking-wider border-l border-b border-gray-200 bg-blue-50">1 Day Hold</th>
              <th colSpan={3} className="px-6 py-2 text-center text-xs font-extrabold text-gray-800 uppercase tracking-wider border-l border-b border-gray-200 bg-indigo-50">2 Day Hold</th>
              <th colSpan={3} className="px-6 py-2 text-center text-xs font-extrabold text-gray-800 uppercase tracking-wider border-l border-b border-gray-200 bg-blue-50">3 Day Hold</th>
              <th colSpan={3} className="px-6 py-2 text-center text-xs font-extrabold text-gray-800 uppercase tracking-wider border-l border-b border-gray-200 bg-indigo-50">5 Day Hold</th>
              <th colSpan={3} className="px-6 py-2 text-center text-xs font-extrabold text-gray-800 uppercase tracking-wider border-l border-b border-gray-200 bg-blue-50">10 Day Hold</th>
            </tr>

            {/* Row 2: Metrics Headers */}
            <tr className="sticky top-8 z-20 bg-gray-50 shadow-sm">
              <SortableHeader 
                title="Ticker" 
                sortKey="ticker" 
                sortConfig={sortConfig} 
                requestSort={requestSort} 
                tooltipText="Symbol" 
                className="sticky left-0 bg-gray-50 z-30 border-r border-gray-200 text-left pl-4"
              />
              <SortableHeader title="Yrs" sortKey="years_of_data" sortConfig={sortConfig} requestSort={requestSort} tooltipText="Years of Data" />
              <SortableHeader title="Streak" sortKey="current_streak" sortConfig={sortConfig} requestSort={requestSort} tooltipText="Current Green/Red Streak" />
              
              {periods.map((p, index) => {
                // Alternating Colors logic
                const bgClass = index % 2 === 0 ? 'bg-blue-50' : 'bg-indigo-50';
                return (
                  <React.Fragment key={p}>
                    <th className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200 ${bgClass}`}>Trades</th>
                    <SortableHeader className={bgClass} title="Ret" sortKey={`avg_ret_${p}d` as keyof StreakRow} sortConfig={sortConfig} requestSort={requestSort} tooltipText={`Avg Return ${p} Days Later`} />
                    <SortableHeader className={bgClass} title="Win%" sortKey={`win_pct_${p}d` as keyof StreakRow} sortConfig={sortConfig} requestSort={requestSort} tooltipText={`Win Rate ${p} Days Later`} />
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row) => (
              <tr key={row.ticker} className="hover:bg-blue-50 transition-colors duration-150">
                {/* Sticky Ticker Column */}
                <td className="sticky left-0 bg-white hover:bg-blue-50 z-10 px-3 py-3 whitespace-nowrap text-sm font-bold text-gray-900 border-r border-gray-100 pl-4">
                  {row.ticker}
                </td>
                
                <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-500">{row.years_of_data}</td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-center">
                    {formatStreak(row.current_streak)}
                </td>

                {/* Loop through periods to generate columns */}
                {periods.map(p => {
                  const tradesKey = `trades_${p}d` as keyof StreakRow;
                  const avgRetKey = `avg_ret_${p}d` as keyof StreakRow;
                  const winPctKey = `win_pct_${p}d` as keyof StreakRow;
                  
                  return (
                    <ResultGroup 
                        key={p}
                        trades={row[tradesKey]} 
                        avg_ret={row[avgRetKey]} 
                        win_pct={row[winPctKey]} 
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StreaksTable;