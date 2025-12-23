// FILE: supabase/functions/momentum-backtest/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST', 
};

type MonthlyPrice = { symbol: string, date: string, close: number };
type Metrics = { cagr: number; total_return: number; max_drawdown: number; sharpe_ratio: number; };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== BACKTEST STARTING ===');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!, 
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    
    const { tickers, lookback_months, top_n, start_year = 1900 } = body;

    console.log('Fetching monthly prices...');
    const { data: allMonthlyPrices, error: rpcError } = await supabaseClient
      .rpc('get_monthly_prices', { ticker_list: [...tickers, 'SPY'] });

    if (rpcError) {
      console.error('RPC Error:', rpcError);
      throw new Error(`RPC Error: ${rpcError.message}`);
    }
    
    console.log(`Fetched ${allMonthlyPrices?.length || 0} monthly price records`);
    
    if (!allMonthlyPrices || allMonthlyPrices.length === 0) {
      throw new Error("No monthly price data returned from database");
    }

    console.log('Building ticker map...');
    const monthlyDataByTicker = new Map<string, MonthlyPrice[]>();
    for (const row of allMonthlyPrices) {
      if (!monthlyDataByTicker.has(row.symbol)) {
        monthlyDataByTicker.set(row.symbol, []);
      }
      monthlyDataByTicker.get(row.symbol)!.push(row);
    }

    // Sort each ticker's data by date
    monthlyDataByTicker.forEach(prices => prices.sort((a, b) => a.date.localeCompare(b.date)));
    
    console.log(`Tickers in map: ${Array.from(monthlyDataByTicker.keys()).join(', ')}`);

    const allSpyDates = monthlyDataByTicker.get('SPY')?.map(p => p.date) || [];
    console.log(`Total SPY dates: ${allSpyDates.length}`);
    
    if (allSpyDates.length === 0) {
      throw new Error("No SPY data found");
    }
    
    const rebalanceDates = allSpyDates.filter(date => new Date(date).getFullYear() >= start_year);
    console.log(`Rebalance dates after ${start_year}: ${rebalanceDates.length}`);
    console.log(`First rebalance date: ${rebalanceDates[0]}, Last: ${rebalanceDates[rebalanceDates.length - 1]}`);
    
    if (rebalanceDates.length < 2) {
      throw new Error(`Only ${rebalanceDates.length} dates after ${start_year}. Need at least 2.`);
    }

    console.log('Starting backtest loop...');
    const monthlyReturns: number[] = [];
    const monthlyHoldings: {date: string, holdings: string[]}[] = [];
    const holdingsCounter = new Map<string, number>();

    const startIdx = allSpyDates.findIndex(d => d === rebalanceDates[0]);
    console.log(`Start index in full SPY data: ${startIdx}, lookback_months: ${lookback_months}`);
    
    if (startIdx < lookback_months) {
      throw new Error(`Need ${lookback_months} months of data before ${start_year}. Only have ${startIdx} months.`);
    }

    for (let i = 0; i < rebalanceDates.length - 1; i++) {
      const rebalanceDateStr = rebalanceDates[i];
      const rebalanceIdxInFull = allSpyDates.indexOf(rebalanceDateStr);
      const lookbackDateStr = allSpyDates[rebalanceIdxInFull - lookback_months];
      const nextRebalanceDateStr = rebalanceDates[i + 1];

      if (i === 0) {
        console.log(`First iteration: rebalance=${rebalanceDateStr}, lookback=${lookbackDateStr}, next=${nextRebalanceDateStr}`);
      }

      const momentumScores: { ticker: string, score: number }[] = [];

      for (const ticker of tickers) {
        const history = monthlyDataByTicker.get(ticker);
        if (!history) {
          console.warn(`No history for ticker: ${ticker}`);
          continue;
        }
        
        const endPriceData = history.find(p => p.date === rebalanceDateStr);
        const startPriceData = history.find(p => p.date === lookbackDateStr);
        
        if (endPriceData && startPriceData && startPriceData.close > 0) {
          const score = (endPriceData.close / startPriceData.close) - 1;
          momentumScores.push({ ticker, score });
        }
      }
      
      momentumScores.sort((a, b) => b.score - a.score);
      const holdings = momentumScores.slice(0, top_n).map(s => s.ticker);
      
      monthlyHoldings.push({ date: rebalanceDateStr.substring(0, 7), holdings });
      holdings.forEach(h => holdingsCounter.set(h, (holdingsCounter.get(h) || 0) + 1));
      
      let monthReturn = 0;
      if (holdings.length > 0) {
        for (const ticker of holdings) {
          const history = monthlyDataByTicker.get(ticker)!;
          const startPrice = history.find(p => p.date === rebalanceDateStr)?.close;
          const endPrice = history.find(p => p.date === nextRebalanceDateStr)?.close;
          if (startPrice && endPrice && startPrice > 0) {
            monthReturn += ((endPrice / startPrice) - 1) / holdings.length;
          }
        }
        monthReturn -= 0.0001;
      }
      monthlyReturns.push(monthReturn);
    }
    
    console.log(`Backtest complete. ${monthlyReturns.length} monthly returns calculated`);
    console.log('Calculating metrics...');
    
    const strategyMetrics = calculatePerformanceMetrics(monthlyReturns);
    const holdingsDistribution = Array.from(holdingsCounter.entries()).map(([ticker, count]) => ({
      ticker,
      percentage: count / (monthlyReturns.length || 1)
    }));

    console.log('Calculating SPY benchmark...');
    const spyMonthlyHistory = monthlyDataByTicker.get('SPY')!;
    const spyMonthlyReturns: number[] = [];
    
    for (let i = 0; i < rebalanceDates.length - 1; i++) {
      const startDate = rebalanceDates[i];
      const endDate = rebalanceDates[i + 1];
      const startPrice = spyMonthlyHistory.find(p => p.date === startDate)?.close;
      const endPrice = spyMonthlyHistory.find(p => p.date === endDate)?.close;
      if (startPrice && endPrice && startPrice > 0) {
        spyMonthlyReturns.push((endPrice / startPrice) - 1);
      }
    }
    
    const benchmarkMetrics = calculatePerformanceMetrics(spyMonthlyReturns);
    
    console.log('Fetching daily data for drawdown calc...');
    const startDateForDaily = rebalanceDates[0];
    
    const { data: spyDailyHistory, error: spyDailyError } = await supabaseClient
      .from('stock_data')
      .select('date, close')
      .eq('symbol', 'SPY')
      .gte('date', startDateForDaily)
      .order('date');
    
    if (spyDailyError) {
      console.error('SPY daily fetch error:', spyDailyError);
    } else if (spyDailyHistory && spyDailyHistory.length > 0) {
      console.log(`Fetched ${spyDailyHistory.length} SPY daily records`);
      benchmarkMetrics.max_drawdown = calculateDailyMaxDrawdown(spyDailyHistory);
    }
    
    const { data: allDailyData, error: dailyError } = await supabaseClient
      .from('stock_data')
      .select('symbol, date, close')
      .in('symbol', tickers)
      .gte('date', startDateForDaily)
      .order('symbol')
      .order('date');
    
    if (dailyError) {
      console.error('Strategy daily fetch error:', dailyError);
    } else if (allDailyData && allDailyData.length > 0) {
      console.log(`Fetched ${allDailyData.length} strategy daily records`);
      strategyMetrics.max_drawdown = calculateStrategyDailyDrawdown(
        allDailyData, 
        monthlyHoldings, 
        rebalanceDates
      );
    }
    
    console.log('Generating cumulative returns...');
    const cumulativeReturns = [];
    let stratValue = 1, benchValue = 1;
    for (let i = 0; i < monthlyReturns.length; i++) {
      stratValue *= (1 + monthlyReturns[i]);
      benchValue *= (1 + spyMonthlyReturns[i]);
      cumulativeReturns.push({ 
        date: rebalanceDates[i].substring(0, 7), 
        strategy: stratValue, 
        benchmark: benchValue 
      });
    }
    
    console.log('=== BACKTEST SUCCESS ===');
    
    const finalResult = { 
      strategy_metrics: strategyMetrics, 
      benchmark_metrics: benchmarkMetrics, 
      cumulative_returns: cumulativeReturns, 
      monthly_holdings: monthlyHoldings, 
      holdings_distribution: holdingsDistribution 
    };

    return new Response(JSON.stringify(finalResult), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('=== BACKTEST ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        name: error.name
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    );
  }
});

function calculatePerformanceMetrics(monthlyReturns: number[]): Metrics {
  if (monthlyReturns.length === 0) {
    return { cagr: 0, total_return: 0, max_drawdown: 0, sharpe_ratio: 0 };
  }
  
  const totalReturn = monthlyReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;
  const n_years = monthlyReturns.length / 12;
  const cagr = n_years > 0 ? (1 + totalReturn) ** (1 / n_years) - 1 : 0;
  
  let equity_curve_value = 1, peak_value = 1, max_drawdown = 0;
  for (const monthlyReturn of monthlyReturns) {
    equity_curve_value *= (1 + monthlyReturn);
    if (equity_curve_value > peak_value) peak_value = equity_curve_value;
    const current_drawdown = (peak_value - equity_curve_value) / peak_value;
    if (current_drawdown > max_drawdown) max_drawdown = current_drawdown;
  }
  
  const meanReturn = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
  const variance = monthlyReturns.map(r => (r - meanReturn) ** 2).reduce((a, b) => a + b, 0) / monthlyReturns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(12) : 0;
  
  return { cagr, total_return: totalReturn, max_drawdown: -max_drawdown, sharpe_ratio: sharpeRatio };
}

function calculateDailyMaxDrawdown(dailyPrices: {date: string, close: number}[]): number {
  let peak_price = dailyPrices[0]?.close || 1;
  let max_drawdown = 0;
  
  for (const day of dailyPrices) {
    if (day.close > peak_price) peak_price = day.close;
    const drawdown = (peak_price - day.close) / peak_price;
    if (drawdown > max_drawdown) max_drawdown = drawdown;
  }
  
  return -max_drawdown;
}

function calculateStrategyDailyDrawdown(
  dailyData: {symbol: string, date: string, close: number}[], 
  monthlyHoldings: {date: string, holdings: string[]}[],
  rebalanceDates: string[]
): number {
  const dailyByTicker = new Map<string, Map<string, number>>();
  for (const row of dailyData) {
    if (!dailyByTicker.has(row.symbol)) {
      dailyByTicker.set(row.symbol, new Map());
    }
    dailyByTicker.get(row.symbol)!.set(row.date, row.close);
  }
  
  const allDates = [...new Set(dailyData.map(d => d.date))].sort();
  
  let portfolioValue = 1;
  let peakValue = 1;
  let maxDrawdown = 0;
  let currentHoldingsIdx = 0;
  let currentHoldings = monthlyHoldings[0]?.holdings || [];
  let holdingsValue = new Map<string, number>();
  
  for (const ticker of currentHoldings) {
    const price = dailyByTicker.get(ticker)?.get(allDates[0]);
    if (price) holdingsValue.set(ticker, 1 / currentHoldings.length);
  }
  
  for (let i = 1; i < allDates.length; i++) {
    const date = allDates[i];
    
    if (currentHoldingsIdx < monthlyHoldings.length - 1 && 
        date >= rebalanceDates[currentHoldingsIdx + 1]) {
      currentHoldingsIdx++;
      currentHoldings = monthlyHoldings[currentHoldingsIdx].holdings;
      
      holdingsValue.clear();
      for (const ticker of currentHoldings) {
        holdingsValue.set(ticker, portfolioValue / currentHoldings.length);
      }
    }
    
    const prevDate = allDates[i - 1];
    portfolioValue = 0;
    
    for (const [ticker, prevValue] of holdingsValue.entries()) {
      const prevPrice = dailyByTicker.get(ticker)?.get(prevDate);
      const currPrice = dailyByTicker.get(ticker)?.get(date);
      
      if (prevPrice && currPrice && prevPrice > 0) {
        const newValue = prevValue * (currPrice / prevPrice);
        holdingsValue.set(ticker, newValue);
        portfolioValue += newValue;
      } else {
        portfolioValue += prevValue;
      }
    }
    
    if (portfolioValue > peakValue) peakValue = portfolioValue;
    const drawdown = (peakValue - portfolioValue) / peakValue;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  return -maxDrawdown;
}