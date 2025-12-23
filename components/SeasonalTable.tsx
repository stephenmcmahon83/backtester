"use client";

import React, { useState, useMemo } from 'react';

type ColumnDef = {
    header: string;
    accessorKey: string;
    isNumeric?: boolean;
};

type TableProps = {
    data: any[];
    columns: ColumnDef[];
    colorScaleType: 'return' | 'profitable';
    highlightDay?: number; // <--- NEW PROP
};

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc';
} | null;

export const SeasonalTable = ({ data, columns, colorScaleType, highlightDay }: TableProps) => {
    
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    // Sorting Logic
    const sortedData = useMemo(() => {
        if (!sortConfig) return data;
        return [...data].sort((a, b) => {
            const keyA = sortConfig.key;
            let aValue = a[keyA];
            let bValue = b[keyA];
            if (aValue === null) return 1;
            if (bValue === null) return -1;
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

    // Style Logic
    const getCellStyle = (rawValue: any, type: 'return' | 'profitable') => {
        const value = Number(rawValue);
        if (isNaN(value) || rawValue === null || rawValue === undefined) return {};
        
        let backgroundColor = '';
        if (type === 'return') {
            if (value > 0) backgroundColor = `rgba(34, 197, 94, ${Math.min(value * 20, 0.7)})`; 
            else if (value < 0) backgroundColor = `rgba(239, 68, 68, ${Math.min(Math.abs(value) * 20, 0.7)})`;
        }
        if (type === 'profitable') {
            if (value >= 0.6) {
                const intensity = (value - 0.5) * 2;
                backgroundColor = `rgba(34, 197, 94, ${Math.min(intensity, 0.7)})`;
            } else if (value <= 0.4) {
                const intensity = (0.5 - value) * 2;
                backgroundColor = `rgba(239, 68, 68, ${Math.min(intensity, 0.7)})`;
            }
        }
        return { backgroundColor };
    };

    const formatValue = (rawValue: any, isNumeric: boolean) => {
        if (!isNumeric) return rawValue;
        const value = Number(rawValue);
        if (isNaN(value)) return rawValue;
        if (colorScaleType === 'profitable') return Math.round(value * 100);
        return (value * 100).toFixed(2);
    };

    return (
        <div className="overflow-auto border border-gray-200 rounded-lg max-h-[800px] shadow-sm bg-white">
            <table className="min-w-full text-sm text-left text-gray-900 border-collapse">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                        {columns.map((col, index) => {
                            const isStickyLeft = index === 0; 
                            const isSorted = sortConfig?.key === col.accessorKey;
                            return (
                                <th 
                                    key={col.accessorKey} 
                                    onClick={() => requestSort(col.accessorKey)}
                                    className={`
                                        px-3 py-4 border-b border-gray-200 whitespace-nowrap 
                                        sticky top-0 z-20 bg-gray-100 font-bold shadow-sm cursor-pointer hover:bg-gray-200 transition-colors select-none
                                        ${isStickyLeft ? 'left-0 z-30 border-r border-gray-200' : ''} 
                                    `}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.header}
                                        {isSorted && <span className="text-blue-600">{sortConfig?.direction === 'asc' ? ' ↑' : ' ↓'}</span>}
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((row, rowIndex) => {
                        // --- HIGHLIGHT LOGIC ---
                        // Check if this row matches the prop passed in
                        const isTargetDay = highlightDay && row.trading_day_of_year === highlightDay;

                        return (
                            <tr 
                                key={rowIndex} 
                                className={`
                                    border-b border-gray-100 hover:bg-gray-50 transition-colors
                                    ${isTargetDay ? 'outline outline-2 outline-blue-600 bg-blue-50 z-10 relative' : ''}
                                `}
                            >
                                {columns.map((col, index) => {
                                    const val = row[col.accessorKey];
                                    const style = col.isNumeric ? getCellStyle(val, colorScaleType) : {};
                                    const isStickyLeft = index === 0;
                                    return (
                                        <td 
                                            key={col.accessorKey} 
                                            className={`
                                                px-3 py-3 whitespace-nowrap 
                                                ${isStickyLeft ? 'sticky left-0 z-10 bg-white border-r border-gray-200 font-medium' : ''}
                                                ${isStickyLeft && isTargetDay ? '!bg-blue-50' : ''}
                                            `}
                                            style={!isStickyLeft ? style : {}} 
                                        >
                                            {formatValue(val, col.isNumeric || false)}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};