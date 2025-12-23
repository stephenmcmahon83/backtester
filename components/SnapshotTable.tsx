"use client";

import React, { useState, useMemo } from 'react';

type ColumnDef = {
    header: string;
    accessorKey: string;
    isNumeric?: boolean;
    isTrailing?: boolean;
};

type TableProps = {
    data: any[];
    columns: ColumnDef[];
    colorScaleType: 'return' | 'profitable';
};

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc';
} | null;

export default function SnapshotTable({ data, columns, colorScaleType }: TableProps) {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ticker', direction: 'asc' });

    const sortedData = useMemo(() => {
        if (!sortConfig) return data;
        return [...data].sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getCellStyle = (rawValue: any, type: 'return' | 'profitable') => {
        const value = Number(rawValue);
        if (isNaN(value) || rawValue === null || rawValue === undefined) return {};
        let backgroundColor = '';
        if (type === 'return') {
            if (value > 0) backgroundColor = `rgba(34, 197, 94, ${Math.min(value * 20, 0.7)})`;
            else if (value < 0) backgroundColor = `rgba(239, 68, 68, ${Math.min(Math.abs(value) * 20, 0.7)})`;
        }
        if (type === 'profitable') {
            if (value >= 0.6) backgroundColor = `rgba(34, 197, 94, ${Math.min((value - 0.5) * 2, 0.7)})`;
            else if (value <= 0.4) backgroundColor = `rgba(239, 68, 68, ${Math.min((0.5 - value) * 2, 0.7)})`;
        }
        return { backgroundColor };
    };

    const formatValue = (rawValue: any, isNumeric: boolean) => {
        if (!isNumeric) return rawValue;
        const value = Number(rawValue);
        if (isNaN(value) || rawValue === null) return '-';
        if (colorScaleType === 'profitable') return `${Math.round(value * 100)}`;
        return `${(value * 100).toFixed(2)}`;
    };

    return (
        <div className="overflow-auto border border-gray-200 rounded-lg max-h-[800px] shadow-sm bg-white">
            <table className="min-w-full text-sm text-left text-gray-900 border-collapse">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                        {columns.map((col, index) => {
                            // --- FIXED: Only the first column (index 0) is sticky ---
                            const isSticky = index === 0;
                            const isLastTrailingColumn = col.accessorKey === 'avg_trailing_ret_1';
                            const isSorted = sortConfig?.key === col.accessorKey;

                            return (
                                <th
                                    key={col.accessorKey}
                                    onClick={() => requestSort(col.accessorKey)}
                                    className={`
                                        px-3 py-4 border-b border-gray-200 whitespace-nowrap
                                        sticky top-0 z-20 bg-gray-100 font-bold shadow-sm select-none
                                        cursor-pointer hover:bg-gray-200 transition-colors
                                        ${isSticky ? 'left-0 z-30' : ''}
                                        ${isLastTrailingColumn ? 'border-r-2 border-gray-300' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-1 justify-center">
                                        {col.header}
                                        {isSorted && <span className="text-indigo-600">{sortConfig?.direction === 'asc' ? '▲' : '▼'}</span>}
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            {columns.map((col, index) => {
                                const val = row[col.accessorKey];
                                const style = col.isNumeric && col.accessorKey !== 'years_of_data'
                                    ? getCellStyle(val, colorScaleType)
                                    : {};
                                // --- FIXED: Only the first column (index 0) is sticky ---
                                const isSticky = index === 0;
                                const isLastTrailingColumn = col.accessorKey === 'avg_trailing_ret_1';

                                return (
                                    <td
                                        key={col.accessorKey}
                                        className={`
                                            px-3 py-2 whitespace-nowrap
                                            ${col.isNumeric ? 'text-center font-mono' : 'font-medium'}
                                            ${isSticky ? 'sticky left-0 z-10 bg-white hover:bg-gray-50 font-bold' : ''}
                                            ${isLastTrailingColumn ? 'border-r-2 border-gray-300' : ''}
                                        `}
                                        style={style}
                                    >
                                        {formatValue(val, col.isNumeric || false)}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}