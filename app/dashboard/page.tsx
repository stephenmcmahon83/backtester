"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from "@supabase/supabase-js";
import DashboardTable, { DashboardRow } from '@/components/DashboardTable'; 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type SortConfig = {
  key: keyof DashboardRow;
  direction: 'ascending' | 'descending';
} | null;

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ticker', direction: 'ascending' });

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke('dashboard-metrics');
        if (error) throw new Error(error.message);
        if (!data) throw new Error('No data returned.');
        setDashboardData(data);
      } catch (e: any) {
        console.error("Failed to fetch dashboard data:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const sortedData = useMemo(() => {
    let sortableItems = [...dashboardData];
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
  }, [dashboardData, sortConfig]);

  const requestSort = (key: keyof DashboardRow) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <main className="container mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col items-center">
          {loading && <p className="text-center text-gray-600 mt-10 text-xl animate-pulse">Loading Market Pulse...</p>}
          
          {error && (
            <div className="mt-10 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              <p className="font-bold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          {!loading && !error && sortedData.length > 0 && (
            <DashboardTable
              data={sortedData}
              requestSort={requestSort}
              sortConfig={sortConfig}
            />
          )}
        </div>
      </main>
    </div>
  );
}