"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from "@supabase/supabase-js";
import RsiTable, { RsiRow, SortConfig } from '@/components/RsiTable'; 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function RsiPage() {
  const [data, setData] = useState<RsiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ticker', direction: 'ascending' });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: rsiData, error } = await supabase.functions.invoke('rsi-probabilities');
        if (error) throw new Error(error.message);
        if (!rsiData) throw new Error('No data returned.');
        setData(rsiData);
      } catch (e: any) {
        console.error("Fetch failed:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const requestSort = (key: keyof RsiRow) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="space-y-6">
      
      {/* --- HEADER --- */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">RSI Probabilities</h1>
        <p className="mt-2 text-gray-600">
          We categorize the current RSI(2) for each stock into "buckets" (e.g. 0-10, 10-20) and calculate future returns.
        </p>
        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded text-xs text-indigo-900">
           <strong>Logic:</strong> Stocks often mean-revert when RSI(2) is extremely low (0-10) or high (90-100). This table shows the historical probability of a bounce.
           <br/>Includes <strong>0.10% commission</strong> per round trip.
        </div>
      </div>

      {/* --- ADSENSE --- */}
      <div className="w-full h-24 bg-gray-100 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-sm">
        <span>Advertisement Space</span>
      </div>

      {/* --- TABLE --- */}
      {loading && (
          <div className="p-12 text-center bg-white rounded-lg border border-gray-200">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-500 font-medium">Calculating RSI Probabilities...</p>
          </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded shadow-sm">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <RsiTable 
          data={sortedData} 
          requestSort={requestSort} 
          sortConfig={sortConfig} 
        />
      )}
    </div>
  );
}