import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const COMMISSION = 0.001; // 0.10% round trip

// --- HELPER FUNCTIONS (FULLY IMPLEMENTED) ---

const calculateSMA = (data: any[], period: number, index: number) => {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[index - i].close;
  return sum / period;
};

const calculateStdDev = (data: any[], period: number, index: number, sma: number) => {
  if (index < period - 1) return 0;
  let sumSqDiff = 0;
  for (let i = 0; i < period; i++) {
    const diff = data[index - i].close - sma;
    sumSqDiff += diff * diff;
  }
  return Math.sqrt(sumSqDiff / period);
};

const calculateRSI = (data: any[], period: number, index: number) => {
  if (index < period) return 50;
  let avgGain = 0, avgLoss = 0;

  // Use a simpler, more common RSI calculation method
  let gains = 0;
  let losses = 0;
  for (let i = index - period + 1; i <= index; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) {
          gains += change;
      } else {
          losses += Math.abs(change);
      }
  }
  
  avgGain = gains / period;
  avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { ticker, strategyType, startYear } = await req.json();

    // 1. Fetch Data
    let query = supabase
      .from('stock_data')
      .select('date, open, close')
      .eq('symbol', ticker)
      .order('date', { ascending: true });

    if (startYear && startYear !== 'all') {
      const startDate = `${startYear}-01-01`;
      query = query.gte('date', startDate);
    }

    const { data: prices, error } = await query;

    if (error) throw error;
    if (!prices || prices.length < 300) {
      throw new Error(`Not enough data (need 300+ days, found ${prices?.length || 0}). Try an earlier start year or a different ticker.`);
    }

    // --- Backtesting Logic & Execution ---
    const trades: any[] = [];
    let equity = 10000;
    const equityCurve = [10000];
    const equityDates = prices.length > 0 ? [prices[0].date] : [];

    let inPosition = false;
    let entryPrice = 0;
    let entryDate = '';
    let shares = 0;
    let positionCostBasis = 0;
    let pendingAction = 'NONE';

    for (let i = 201; i < prices.length; i++) {
      const today = prices[i];
      const yesterday = prices[i - 1];
      
      const sma200 = calculateSMA(prices, 200, i - 1);
      const sma5 = calculateSMA(prices, 5, i - 1);
      const rsi2 = calculateRSI(prices, 2, i - 1);
      const rsi4 = calculateRSI(prices, 4, i - 1);

      let signalEntry = false;
      let signalExit = false;

      // --- STRATEGY LOGIC ---
      switch (strategyType) {
        case 'rsi-4':
          signalEntry = rsi4 < 25;
          signalExit = rsi4 > 55;
          break;
        case 'r3':
          const rsi2_prev = calculateRSI(prices, 2, i - 2);
          const rsi2_prev2 = calculateRSI(prices, 2, i - 3);
          const rsi2_prev3 = calculateRSI(prices, 2, i - 4);
          signalEntry = (rsi2 < 10 && rsi2 < rsi2_prev && rsi2_prev < rsi2_prev2 && rsi2_prev2 < rsi2_prev3);
          signalExit = rsi2 > 70;
          break;
        case 'pct-b':
          const sma20 = calculateSMA(prices, 20, i - 1);
          if (sma20 !== null) {
             const stdDev = calculateStdDev(prices, 20, i - 1, sma20);
             const upper = sma20 + (2 * stdDev);
             const lower = sma20 - (2 * stdDev);
             if (upper !== lower) {
                 const pctB = (yesterday.close - lower) / (upper - lower);
                 signalEntry = pctB < 0.2;
                 signalExit = pctB > 0.8;
             }
          }
          break;
        case 'multi-day':
          let downDays = 0;
          for(let k=1; k<=5; k++) {
             if(prices[i-k].close < prices[i-k-1].close) downDays++;
          }
          signalEntry = downDays >= 4;
          signalExit = sma5 ? yesterday.close > sma5 : false; 
          break;
        case 'rsi-10-6':
           const rsi2_day_before = calculateRSI(prices, 2, i - 2);
           signalEntry = (rsi2_day_before < 10 && rsi2 < 6);
           signalExit = sma5 ? yesterday.close > sma5 : false;
           break;
        case '3-low-high':
           if (sma200 && yesterday.close > sma200) {
              const min3 = Math.min(prices[i-2].close, prices[i-3].close, prices[i-4].close);
              signalEntry = yesterday.close < min3; 
              const max3 = Math.max(prices[i-2].close, prices[i-3].close, prices[i-4].close);
              signalExit = yesterday.close > max3;
           }
           break;
        case '5-low-high':
            if (sma200 && yesterday.close > sma200) {
                const min5 = Math.min(...prices.slice(i-6, i-1).map((p:any)=>p.close));
                signalEntry = yesterday.close < min5; 
                const max5 = Math.max(...prices.slice(i-6, i-1).map((p:any)=>p.close));
                signalExit = yesterday.close > max5;
            }
            break;
        case '10-low-high':
            if (sma200 && yesterday.close > sma200) {
                const min10 = Math.min(...prices.slice(i-11, i-1).map((p:any)=>p.close));
                signalEntry = yesterday.close < min10; 
                const max10 = Math.max(...prices.slice(i-11, i-1).map((p:any)=>p.close));
                signalExit = yesterday.close > max10;
            }
            break;
      }

      // --- CAPTURE PENDING ACTION ---
      if (i === prices.length - 1) {
        if (inPosition && signalExit) pendingAction = 'SELL';
        else if (!inPosition && signalEntry) pendingAction = 'BUY';
        else pendingAction = 'NONE';
      }

      // --- EXECUTION ---
      if (inPosition) {
        if (signalExit) {
          const exitPrice = today.open;
          const grossReturn = (exitPrice - entryPrice) / entryPrice;
          const netReturn = grossReturn - COMMISSION;
          equity = positionCostBasis * (1 + netReturn);
          trades.push({
            entryDate, exitDate: today.date, entryPrice,
            exitPrice, return: netReturn
          });
          inPosition = false; shares = 0; positionCostBasis = 0;
        } else {
            equity = shares * today.close; 
        }
      } 
      if (!inPosition && signalEntry) {
          entryPrice = today.open; entryDate = today.date;
          inPosition = true; positionCostBasis = equity;
          shares = equity / entryPrice;
      }
      equityCurve.push(equity);
      equityDates.push(today.date);
    }
    
    // --- Stats Calculation ---
    const totalReturn = (equity - 10000) / 10000;
    let peak = -Infinity;
    let maxDrawdown = 0;
    equityCurve.forEach(val => {
      if (val > peak) peak = val;
      const dd = (peak - val) / peak;
      if (dd > maxDrawdown) maxDrawdown = dd;
    });
    const wins = trades.filter(t => t.return > 0);
    const winRate = trades.length > 0 ? wins.length / trades.length : 0;
    let winsAfterWin = 0, countAfterWin = 0, retAfterWin = 0;
    let winsAfterLoss = 0, countAfterLoss = 0, retAfterLoss = 0;
    for (let j = 1; j < trades.length; j++) {
      const prevTrade = trades[j - 1]; const currTrade = trades[j];
      if (prevTrade.return > 0) {
        countAfterWin++; retAfterWin += currTrade.return;
        if (currTrade.return > 0) winsAfterWin++;
      } else {
        countAfterLoss++; retAfterLoss += currTrade.return;
        if (currTrade.return > 0) winsAfterLoss++;
      }
    }
    const yearlyMap: Record<string, { ret: number; count: number; wins: number }> = {};
    trades.forEach(t => {
      const year = t.exitDate.substring(0, 4);
      if (!yearlyMap[year]) yearlyMap[year] = { ret: 0, count: 0, wins: 0 };
      yearlyMap[year].ret += t.return;
      yearlyMap[year].count++;
      if (t.return > 0) yearlyMap[year].wins++;
    });
    const yearlyStats = Object.keys(yearlyMap).sort((a, b) => b.localeCompare(a)).map(year => ({
        year, return: yearlyMap[year].ret, count: yearlyMap[year].count,
        winRate: yearlyMap[year].count > 0 ? yearlyMap[year].wins / yearlyMap[year].count : 0
    }));
    const profitableYears = yearlyStats.filter(y => y.return > 0).length;

    const result = {
      dates: equityDates, strategyEquityCurve: equityCurve,
      strategyTotalReturn: totalReturn, strategyMaxDrawdown: maxDrawdown,
      profitableYearsPct: yearlyStats.length > 0 ? profitableYears / yearlyStats.length : 0,
      isHolding: inPosition, pendingAction: pendingAction, totalTrades: trades.length,
      winRate, avgReturnAfterWin: countAfterWin > 0 ? retAfterWin / countAfterWin : 0,
      winRateAfterWin: countAfterWin > 0 ? winsAfterWin / countAfterWin : 0,
      avgReturnAfterLoss: countAfterLoss > 0 ? retAfterLoss / countAfterLoss : 0,
      winRateAfterLoss: countAfterLoss > 0 ? winsAfterLoss / countAfterLoss : 0,
      trades, yearlyStats
    };

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});