import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMMISSION = 0.001; // 0.10% round trip

// Calculate Simple Moving Average
const calculateSMA = (data: number[], period: number, index: number): number | null => {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[index - i];
  }
  return sum / period;
};

// Calculate rolling mean for ratio
const calculateRollingMean = (data: number[], period: number, index: number): number | null => {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[index - i];
  }
  return sum / period;
};

// Calculate rolling standard deviation
const calculateRollingStdDev = (data: number[], period: number, index: number, mean: number): number => {
  if (index < period - 1) return 0;
  let sumSqDiff = 0;
  for (let i = 0; i < period; i++) {
    const diff = data[index - i] - mean;
    sumSqDiff += diff * diff;
  }
  return Math.sqrt(sumSqDiff / period);
};

// Calculate Williams %R
const calculateWilliamsR = (
  highs: number[],
  lows: number[],
  closes: number[],
  period: number,
  index: number
): number | null => {
  if (index < period - 1) return null;
  
  let highestHigh = -Infinity;
  let lowestLow = Infinity;
  
  for (let i = 0; i < period; i++) {
    if (highs[index - i] > highestHigh) highestHigh = highs[index - i];
    if (lows[index - i] < lowestLow) lowestLow = lows[index - i];
  }
  
  if (highestHigh === lowestLow) return -50;
  
  const williamsR = ((highestHigh - closes[index]) / (highestHigh - lowestLow)) * -100;
  return williamsR;
};

// Calculate correlation between two arrays
const calculateCorrelation = (x: number[], y: number[]): number => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  return numerator / denominator;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { 
      stockA, 
      stockB, 
      lookbackPeriod, 
      entryZScore, 
      exitZScore, 
      trendMAPeriod,
      maxHoldingDays,
      williamsRThreshold,
      startYear 
    } = await req.json();

    // Validate inputs
    if (!stockA || !stockB) {
      throw new Error('Both stockA and stockB are required');
    }
    if (stockA === stockB) {
      throw new Error('stockA and stockB must be different');
    }
    if (entryZScore >= exitZScore) {
      throw new Error('Entry Z-Score must be less than Exit Z-Score');
    }

    // Calculate required data length
    const maxPeriod = Math.max(lookbackPeriod, trendMAPeriod || 0, 14);
    const minDataLength = maxPeriod + 100;

    // Fetch data for Stock A
    let queryA = supabase
      .from('stock_data')
      .select('date, open, high, low, close')
      .eq('symbol', stockA)
      .order('date', { ascending: true });

    if (startYear && startYear !== 'all') {
      queryA = queryA.gte('date', `${startYear}-01-01`);
    }

    const { data: pricesA, error: errorA } = await queryA;
    if (errorA) throw errorA;
    if (!pricesA || pricesA.length < minDataLength) {
      throw new Error(`Not enough data for ${stockA}. Need at least ${minDataLength} days, found ${pricesA?.length || 0}.`);
    }

    // Fetch data for Stock B
    let queryB = supabase
      .from('stock_data')
      .select('date, open, high, low, close')
      .eq('symbol', stockB)
      .order('date', { ascending: true });

    if (startYear && startYear !== 'all') {
      queryB = queryB.gte('date', `${startYear}-01-01`);
    }

    const { data: pricesB, error: errorB } = await queryB;
    if (errorB) throw errorB;
    if (!pricesB || pricesB.length < minDataLength) {
      throw new Error(`Not enough data for ${stockB}. Need at least ${minDataLength} days, found ${pricesB?.length || 0}.`);
    }

    // Create date maps for alignment
    const mapA: Record<string, { open: number; high: number; low: number; close: number }> = {};
    pricesA.forEach((p: any) => {
      mapA[p.date] = { open: p.open, high: p.high, low: p.low, close: p.close };
    });

    const mapB: Record<string, { open: number; high: number; low: number; close: number }> = {};
    pricesB.forEach((p: any) => {
      mapB[p.date] = { open: p.open, high: p.high, low: p.low, close: p.close };
    });

    // Find common dates
    const allDatesA = pricesA.map((p: any) => p.date);
    const allDatesB = new Set(pricesB.map((p: any) => p.date));
    const commonDates = allDatesA.filter((d: string) => allDatesB.has(d));

    if (commonDates.length < minDataLength) {
      throw new Error(`Not enough overlapping data. Found ${commonDates.length} common dates.`);
    }

    // Build aligned price arrays
    const alignedData: {
      date: string;
      openA: number;
      highA: number;
      lowA: number;
      closeA: number;
      closeB: number;
    }[] = [];

    for (const date of commonDates) {
      alignedData.push({
        date,
        openA: mapA[date].open,
        highA: mapA[date].high,
        lowA: mapA[date].low,
        closeA: mapA[date].close,
        closeB: mapB[date].close,
      });
    }

    // Extract arrays for calculations
    const closesA = alignedData.map((d) => d.closeA);
    const closesB = alignedData.map((d) => d.closeB);
    const highsA = alignedData.map((d) => d.highA);
    const lowsA = alignedData.map((d) => d.lowA);

    // Calculate correlation
    const correlation = calculateCorrelation(closesA, closesB);

    // Calculate price ratio (Stock A / Stock B)
    const ratios: number[] = alignedData.map((d) => d.closeA / d.closeB);

    // Calculate z-scores
    const zScores: (number | null)[] = [];
    for (let i = 0; i < ratios.length; i++) {
      const mean = calculateRollingMean(ratios, lookbackPeriod, i);
      if (mean === null) {
        zScores.push(null);
        continue;
      }
      const stdDev = calculateRollingStdDev(ratios, lookbackPeriod, i, mean);
      if (stdDev === 0) {
        zScores.push(0);
        continue;
      }
      const zScore = (ratios[i] - mean) / stdDev;
      zScores.push(zScore);
    }

    // Calculate trend filter MA for Stock A
    const trendMA: (number | null)[] = [];
    for (let i = 0; i < closesA.length; i++) {
      if (trendMAPeriod > 0) {
        trendMA.push(calculateSMA(closesA, trendMAPeriod, i));
      } else {
        trendMA.push(null);
      }
    }

    // Calculate Williams %R for Stock A (14-period)
    const williamsR: (number | null)[] = [];
    for (let i = 0; i < closesA.length; i++) {
      williamsR.push(calculateWilliamsR(highsA, lowsA, closesA, 14, i));
    }

    // Backtesting
    const trades: any[] = [];
    let equity = 10000;
    const equityCurve: number[] = [];
    const equityDates: string[] = [];
    const zScoreSeries: { date: string; zScore: number }[] = [];

    let inPosition = false;
    let entryPrice = 0;
    let entryDate = '';
    let entryDateIndex = 0;
    let entryZScoreValue = 0;
    let shares = 0;
    let positionCostBasis = 0;
    let pendingAction: 'BUY' | 'SELL' | 'NONE' = 'NONE';
    let currentZScore: number | null = null;
    let currentAboveMA = false;

    let tradesExitedByZScore = 0;
    let tradesExitedByTime = 0;

    const startIndex = Math.max(lookbackPeriod, trendMAPeriod || 0, 14);

    for (let i = startIndex; i < alignedData.length; i++) {
      const today = alignedData[i];
      const yesterdayIdx = i - 1;
      const yesterdayZScore = zScores[yesterdayIdx];
      currentZScore = zScores[i];

      // Record z-score for chart
      if (currentZScore !== null) {
        zScoreSeries.push({ date: today.date, zScore: currentZScore });
      }

      // Check current MA status
      if (trendMAPeriod > 0 && trendMA[i] !== null) {
        currentAboveMA = closesA[i] > trendMA[i]!;
      } else {
        currentAboveMA = true;
      }

      if (yesterdayZScore === null) {
        equityCurve.push(equity);
        equityDates.push(today.date);
        continue;
      }

      // Entry conditions
      let entryConditionsMet = yesterdayZScore < entryZScore;

      // Trend filter
      if (trendMAPeriod > 0 && trendMA[yesterdayIdx] !== null) {
        entryConditionsMet = entryConditionsMet && (closesA[yesterdayIdx] > trendMA[yesterdayIdx]!);
      }

      // Williams %R filter
      if (williamsRThreshold < 0 && williamsR[yesterdayIdx] !== null) {
        entryConditionsMet = entryConditionsMet && (williamsR[yesterdayIdx]! < williamsRThreshold);
      }

      // Exit conditions
      const exitByZScore = yesterdayZScore > exitZScore;
      const daysHeld = inPosition ? (i - entryDateIndex) : 0;
      const exitByTime = maxHoldingDays > 0 && daysHeld >= maxHoldingDays;

      // Capture pending action for the last day
      if (i === alignedData.length - 1) {
        if (inPosition && (exitByZScore || exitByTime)) {
          pendingAction = 'SELL';
        } else if (!inPosition && entryConditionsMet) {
          pendingAction = 'BUY';
        } else {
          pendingAction = 'NONE';
        }
      }

      // Execute trades
      if (inPosition) {
        if (exitByZScore || exitByTime) {
          // Exit position
          const exitPrice = today.openA;
          const grossReturn = (exitPrice - entryPrice) / entryPrice;
          const netReturn = grossReturn - COMMISSION;
          equity = positionCostBasis * (1 + netReturn);

          const holdingDays = i - entryDateIndex;
          const exitReason = exitByZScore ? 'Z-Score' : 'Max Days';

          if (exitByZScore) {
            tradesExitedByZScore++;
          } else {
            tradesExitedByTime++;
          }

          trades.push({
            entryDate,
            exitDate: today.date,
            entryPrice,
            exitPrice,
            entryZScore: entryZScoreValue,
            exitZScore: yesterdayZScore,
            holdingDays,
            exitReason,
            return: netReturn,
          });

          inPosition = false;
          shares = 0;
          positionCostBasis = 0;
        } else {
          // Update equity based on current close
          equity = shares * today.closeA;
        }
      }

      // Enter new position (only if not already in position)
      if (!inPosition && entryConditionsMet) {
        entryPrice = today.openA;
        entryDate = today.date;
        entryDateIndex = i;
        entryZScoreValue = yesterdayZScore;
        inPosition = true;
        positionCostBasis = equity;
        shares = equity / entryPrice;
      }

      equityCurve.push(equity);
      equityDates.push(today.date);
    }

    // Calculate statistics
    const totalReturn = (equity - 10000) / 10000;

    // Max Drawdown
    let peak = -Infinity;
    let maxDrawdown = 0;
    equityCurve.forEach((val) => {
      if (val > peak) peak = val;
      const dd = (peak - val) / peak;
      if (dd > maxDrawdown) maxDrawdown = dd;
    });

    // Trade statistics
    const wins = trades.filter((t) => t.return > 0);
    const losses = trades.filter((t) => t.return <= 0);
    const winRate = trades.length > 0 ? wins.length / trades.length : 0;
    const avgTradeReturn = trades.length > 0
      ? trades.reduce((sum, t) => sum + t.return, 0) / trades.length
      : 0;
    const avgWin = wins.length > 0
      ? wins.reduce((sum, t) => sum + t.return, 0) / wins.length
      : 0;
    const avgLoss = losses.length > 0
      ? losses.reduce((sum, t) => sum + t.return, 0) / losses.length
      : 0;
    const avgHoldingDays = trades.length > 0
      ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length
      : 0;

    // Yearly statistics
    const yearlyMap: Record<string, { ret: number; count: number; wins: number }> = {};
    trades.forEach((t) => {
      const year = t.exitDate.substring(0, 4);
      if (!yearlyMap[year]) {
        yearlyMap[year] = { ret: 0, count: 0, wins: 0 };
      }
      yearlyMap[year].ret += t.return;
      yearlyMap[year].count++;
      if (t.return > 0) yearlyMap[year].wins++;
    });

    const yearlyStats = Object.keys(yearlyMap)
      .sort((a, b) => b.localeCompare(a))
      .map((year) => ({
        year,
        return: yearlyMap[year].ret,
        count: yearlyMap[year].count,
        winRate: yearlyMap[year].count > 0 ? yearlyMap[year].wins / yearlyMap[year].count : 0,
      }));

    const profitableYears = yearlyStats.filter((y) => y.return > 0).length;
    const profitableYearsPct = yearlyStats.length > 0 ? profitableYears / yearlyStats.length : 0;

    // Sample data for charts to avoid huge payload
    const maxPoints = 500;
    const step = Math.max(1, Math.floor(zScoreSeries.length / maxPoints));
    const sampledZScoreSeries = zScoreSeries.filter((_, i) => i % step === 0);

    const sampledEquityCurve: number[] = [];
    const sampledDates: string[] = [];
    for (let i = 0; i < equityCurve.length; i += step) {
      sampledEquityCurve.push(equityCurve[i]);
      sampledDates.push(equityDates[i]);
    }
    
    // Always include the last point
    if (equityCurve.length > 0) {
      const lastIdx = equityCurve.length - 1;
      if (sampledEquityCurve[sampledEquityCurve.length - 1] !== equityCurve[lastIdx]) {
        sampledEquityCurve.push(equityCurve[lastIdx]);
        sampledDates.push(equityDates[lastIdx]);
      }
    }

    const result = {
      dates: sampledDates,
      equityCurve: sampledEquityCurve,
      zScoreSeries: sampledZScoreSeries,
      totalReturn,
      maxDrawdown,
      profitableYearsPct,
      isHolding: inPosition,
      currentZScore,
      currentAboveMA,
      pendingAction,
      totalTrades: trades.length,
      winRate,
      avgTradeReturn,
      avgWin,
      avgLoss,
      avgHoldingDays,
      tradesExitedByZScore,
      tradesExitedByTime,
      trades,
      yearlyStats,
      correlation,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});