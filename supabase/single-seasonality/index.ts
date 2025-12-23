import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map 0-11 to Month Names
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { ticker } = await req.json();

    // 1. Fetch Data (Need all history for seasonality)
    const { data: prices, error } = await supabase
      .from('stock_data')
      .select('date, close')
      .eq('symbol', ticker)
      .order('date', { ascending: true });

    if (error) throw error;
    if (!prices || prices.length < 500) throw new Error("Not enough data for seasonal analysis.");

    // 2. Initialize Buckets
    // Day of Year bucket (0 to 365)
    // We will sum the % change for each day of year across all years
    const dailySums = new Array(366).fill(0);
    const dailyCounts = new Array(366).fill(0);

    // Monthly Buckets
    const monthlyReturns: Record<number, number[]> = {}; // Month Index -> Array of total returns for that month in specific years
    
    // We need to track where a month starts/ends to calculate monthly return
    let currentMonth = -1;
    let monthStartPrice = 0;
    
    // 3. Loop through history
    // We calculate daily % change
    for (let i = 1; i < prices.length; i++) {
        const today = new Date(prices[i].date);
        const yesterday = new Date(prices[i-1].date);
        
        // --- Daily Seasonality Logic ---
        // Get Day of Year (0 - 365)
        // Simple approximation: 
        const startOfYear = new Date(today.getFullYear(), 0, 0);
        const diff = today.getTime() - startOfYear.getTime();
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay); // 1-366

        const pctChange = (prices[i].close - prices[i-1].close) / prices[i-1].close;
        
        if (dayOfYear >= 0 && dayOfYear <= 366) {
            dailySums[dayOfYear] += pctChange;
            dailyCounts[dayOfYear]++;
        }

        // --- Monthly Stats Logic ---
        const m = today.getMonth(); // 0-11
        const y = today.getFullYear();

        // Check if month changed from yesterday (or new year)
        if (m !== yesterday.getMonth()) {
            // New month started today
            monthStartPrice = prices[i].close; // Approximate start price
        }
        
        // Check if month changes tomorrow (or end of data)
        const isLastDay = i === prices.length - 1;
        let isMonthEnd = isLastDay;
        if (!isLastDay) {
            const tomorrow = new Date(prices[i+1].date);
            if (tomorrow.getMonth() !== m) isMonthEnd = true;
        }

        if (isMonthEnd && monthStartPrice > 0) {
            const monthReturn = (prices[i].close - monthStartPrice) / monthStartPrice;
            if (!monthlyReturns[m]) monthlyReturns[m] = [];
            monthlyReturns[m].push(monthReturn);
        }
    }

    // 4. Construct Chart Data (Cumulative Average)
    const chartData: number[] = [];
    const chartLabels: string[] = [];
    let cumulative = 0;

    // We iterate roughly 365 days
    let currentDate = new Date(2024, 0, 1); // Use a leap year to cover 366
    for (let d = 1; d <= 366; d++) {
        const count = dailyCounts[d];
        const sum = dailySums[d];
        
        // Average return for this specific day of year
        const avgDailyRet = count > 0 ? sum / count : 0;
        
        // Add to cumulative
        cumulative += avgDailyRet; // Summing ln returns approx, or simplified % addition
        
        chartData.push(cumulative * 100); // Convert to %
        chartLabels.push(currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        // Increment date
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // 5. Construct Monthly Stats
    const monthlyStats = MONTH_NAMES.map((name, index) => {
        const returns = monthlyReturns[index] || [];
        const count = returns.length;
        const avgReturn = count > 0 ? returns.reduce((a,b)=>a+b, 0) / count : 0;
        const wins = returns.filter(r => r > 0).length;
        const winRate = count > 0 ? wins / count : 0;

        return {
            month: name,
            avgReturn, // Decimal
            winRate
        };
    });

    const yearsAnalyzed = (new Date(prices[prices.length-1].date).getFullYear()) - (new Date(prices[0].date).getFullYear());

    return new Response(JSON.stringify({
        ticker,
        yearsAnalyzed,
        chartLabels,
        chartData,
        monthlyStats
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});