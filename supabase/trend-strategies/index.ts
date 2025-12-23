import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMMISSION = 0.001;

const INTERVALS = [
  { entry: 25, exit: 10 }, { entry: 25, exit: 25 }, { entry: 50, exit: 25 }, { entry: 50, exit: 50 },
  { entry: 75, exit: 25 }, { entry: 75, exit: 50 }, { entry: 75, exit: 75 },
  { entry: 100, exit: 25 }, { entry: 100, exit: 50 }, { entry: 100, exit: 100 },
  { entry: 150, exit: 50 }, { entry: 150, exit: 75 }, { entry: 150, exit: 100 }, { entry: 150, exit: 150 },
  { entry: 200, exit: 25 }, { entry: 200, exit: 50 }, { entry: 200, exit: 100 }, { entry: 200, exit: 200 },
].sort((a, b) => a.entry - b.entry || a.exit - b.exit);

const STRATEGIES: Record<string, { entry: number; exit: number; mode: 'standard' | 'time' | 'momentum' }> = {};
INTERVALS.forEach(({ entry, exit }) => {
  STRATEGIES[`mom_${entry}_${exit}`]   = { entry, exit, mode: 'momentum' };
  STRATEGIES[`donch_${entry}_${exit}`] = { entry, exit, mode: 'standard' };
  STRATEGIES[`time_${entry}_${exit}`]  = { entry, exit, mode: 'time' };
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    
    const { tickers, strategyType, startYear } = await req.json();
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0 || tickers.length > 8) throw new Error("Invalid tickers array.");
    const config = STRATEGIES[strategyType];
    if (!config) throw new Error(`Invalid strategy type`);
    
    // 1. Fetch Data
    const { data: allPriceData, error: priceError } = await supabase
      .from('stock_data')
      .select('symbol, date, open, close')
      .in('symbol', tickers)
      .order('date', { ascending: true });

    if (priceError) throw new Error(`Failed to fetch data: ${priceError.message}`);
    if (!allPriceData || allPriceData.length === 0) throw new Error('No price data found for the selected tickers.');
    
    // 2. Group Data
    const priceDataByTicker = allPriceData.reduce((acc, row) => {
        if (!acc[row.symbol]) acc[row.symbol] = [];
        acc[row.symbol].push(row);
        return acc;
    }, {} as Record<string, any[]>);

    // 3. Create Master Date List
    const unifiedDates = new Set<string>();
    allPriceData.forEach(p => unifiedDates.add(p.date));
    let sortedDates = Array.from(unifiedDates).sort();

    // --- FIX: "Common Era" Synchronization ---
    // Instead of starting when the *first* stock existed (1980), we find the date 
    // where the *last* stock in the portfolio began trading (e.g., 1993 for SPY).
    // This prevents "dead cash" and saves massive CPU resources.

    let latestStartGlobalIndex = 0;

    for (const ticker of tickers) {
        const tickerData = priceDataByTicker[ticker];
        // Defensive check: ensure data exists
        if (!tickerData || tickerData.length === 0) {
            throw new Error(`No data found for ticker: ${ticker}`);
        }
        
        // Find the first date this ticker has data
        const firstDate = tickerData[0].date;
        const globalIndex = sortedDates.indexOf(firstDate);
        
        // We want the MAXIMUM of these start indices (the latest starting stock)
        if (globalIndex > latestStartGlobalIndex) {
            latestStartGlobalIndex = globalIndex;
        }
    }

    // Add buffer for the strategy lookback (e.g. 200 days)
    // We start the loop ONLY after all stocks exist AND we have enough lookback data
    const startIndex = latestStartGlobalIndex + Math.max(config.entry, config.exit) + 2;

    if (startYear && startYear !== 'all') {
        const userYearIndex = sortedDates.findIndex(d => new Date(d).getFullYear() >= parseInt(startYear));
        // If user selected 2000, but data starts 2010, we use 2010. 
        // If user selected 2000, and data starts 1990, we use 2000.
        if (userYearIndex > startIndex) {
             // We don't change startIndex directly to keep array indexing logic simple,
             // but we could just skip the loop. For simplicity, we just check bounds.
        }
    }

    if (sortedDates.length <= startIndex) {
         throw new Error(`Not enough common history. The most recent stock in your portfolio starts too late to build the required lookback period.`);
    }

    // --- END FIX ---

    const INITIAL_CAPITAL_PER_TICKER = 10000;
    const INITIAL_PORTFOLIO_CAPITAL = tickers.length * INITIAL_CAPITAL_PER_TICKER;
    
    const portfolio = tickers.reduce((acc, ticker) => {
        acc[ticker] = { 
            inPosition: false, shares: 0, entryPrice: 0, entryDate: '', 
            cash: INITIAL_CAPITAL_PER_TICKER, lastNewHighIndex: 0 
        };
        return acc;
    }, {} as Record<string, { 
        inPosition: boolean; shares: number; entryPrice: number; entryDate: string; 
        cash: number; lastNewHighIndex: number 
    }>);
    
    const trades: any[] = [];
    const equityCurve: number[] = [];
    const equityDates: string[] = [];

    // Push initial state (day before simulation starts)
    equityCurve.push(INITIAL_PORTFOLIO_CAPITAL);
    equityDates.push(sortedDates[startIndex - 1]);
    
    // Main Loop - Now optimized to run only when all tickers are alive
    for (let i = startIndex; i < sortedDates.length; i++) {
      const currentDate = sortedDates[i];
      
      // Filter by user start year if applicable
      if (startYear && startYear !== 'all') {
         if (new Date(currentDate).getFullYear() < parseInt(startYear)) continue;
      }
      
      for (const ticker of tickers) {
        const position = portfolio[ticker];
        const tickerHistory = priceDataByTicker[ticker];
        
        // Find index in ticker's specific history
        // Optimization: Since we synced start dates, this search is safer, 
        // but we keep .findIndex for correctness with gaps.
        const idx = tickerHistory.findIndex(p => p.date === currentDate);
        
        // Standard Defensive Checks
        if (idx === -1) continue;
        const todayPrice = tickerHistory[idx];
        if (todayPrice.open == null || todayPrice.close == null) continue;
        if (idx < (Math.max(config.entry, config.exit) + 1)) continue;

        const yesterday = tickerHistory[idx - 1]; 
        const dayBefore = tickerHistory[idx - 2];
        if (!yesterday || !dayBefore || yesterday.close == null || dayBefore.close == null) continue;

        let signalEntry = false, signalExit = false;
        
        try {
            if (config.mode === 'momentum') {
                const p1 = tickerHistory[idx - 1 - config.entry];
                const p2 = tickerHistory[idx - 2 - config.entry];
                const p3 = tickerHistory[idx - 1 - config.exit];
                const p4 = tickerHistory[idx - 2 - config.exit];
                
                if (p1 && p2 && p3 && p4) {
                    signalEntry = yesterday.close > p1.close && dayBefore.close > p2.close;
                    signalExit = yesterday.close < p3.close && dayBefore.close < p4.close;
                }
            } else {
                // Optimized Loop Calculation
                let maxCloseInEntryPeriod = -Infinity;
                const entryPeriodStart = idx - 1 - config.entry;
                const entryPeriodEnd = idx - 1;

                if (entryPeriodStart >= 0) {
                    for (let k = entryPeriodStart; k < entryPeriodEnd; k++) {
                        const p = tickerHistory[k];
                        if (p && p.close != null && p.close > maxCloseInEntryPeriod) {
                            maxCloseInEntryPeriod = p.close;
                        }
                    }
                }
                signalEntry = yesterday.close > maxCloseInEntryPeriod;

                if (config.mode === 'standard') {
                    let minCloseInExitPeriod = Infinity;
                    const exitPeriodStart = idx - 1 - config.exit;
                    const exitPeriodEnd = idx - 1;

                    if (exitPeriodStart >= 0) {
                        for (let k = exitPeriodStart; k < exitPeriodEnd; k++) {
                            const p = tickerHistory[k];
                            if (p && p.close != null && p.close < minCloseInExitPeriod) {
                                minCloseInExitPeriod = p.close;
                            }
                        }
                    }
                    signalExit = yesterday.close < minCloseInExitPeriod;
                } else { // time mode
                    if (signalEntry) position.lastNewHighIndex = idx - 1;
                    signalExit = (idx - 1) - position.lastNewHighIndex >= config.exit;
                }
            }
        } catch (e) {
            continue;
        }
        
        if (position.inPosition && signalExit) {
          const exitPrice = todayPrice.open;
          const exitValue = position.shares * exitPrice * (1 - COMMISSION);
          const netReturn = (exitValue / (position.shares * position.entryPrice)) - 1;
          position.cash += exitValue;
          trades.push({ ticker, entryDate: position.entryDate, exitDate: currentDate, entryPrice: position.entryPrice, exitPrice, return: netReturn, status: 'CLOSED' });
          position.inPosition = false;
          position.shares = 0;
        }
        if (!position.inPosition && signalEntry && position.cash > 1) {
          const entryPrice = todayPrice.open;
          const capitalToDeploy = position.cash;
          position.shares = (capitalToDeploy * (1 - COMMISSION)) / entryPrice;
          position.inPosition = true;
          position.entryPrice = entryPrice;
          position.entryDate = currentDate;
          position.cash = 0;
          if (config.mode === 'time') position.lastNewHighIndex = idx - 1;
        }
      }

      let dailyTotalEquity = 0;
      for (const ticker of tickers) {
        const position = portfolio[ticker];
        let tickerEquity = position.cash;
        if (position.inPosition) {
          const todayPrice = priceDataByTicker[ticker].find(p => p.date === currentDate);
          if (todayPrice && todayPrice.close != null) {
            tickerEquity += position.shares * todayPrice.close;
          } else {
            tickerEquity += position.shares * position.entryPrice;
          }
        }
        dailyTotalEquity += tickerEquity;
      }
      equityCurve.push(dailyTotalEquity);
      equityDates.push(currentDate);
    }
    
    // Final Stats Block
    let finalEquity = 0;
    tickers.forEach(ticker => {
        const pos = portfolio[ticker];
        let tickerEquity = pos.cash;
        if(pos.inPosition) {
            const lastPriceData = priceDataByTicker[ticker].slice(-1)[0];
            if (lastPriceData) {
              const lastPrice = lastPriceData.close;
              const openTradeReturn = (lastPrice - pos.entryPrice) / pos.entryPrice;
              trades.push({ ticker, entryDate: pos.entryDate, exitDate: 'OPEN', entryPrice: pos.entryPrice, exitPrice: lastPrice, return: openTradeReturn, status: 'OPEN' });
              tickerEquity += pos.shares * lastPrice;
            } else {
              tickerEquity += pos.shares * pos.entryPrice;
            }
        }
        finalEquity += tickerEquity;
    });

    // Ensure equity curve aligns with calculation
    if (equityCurve.length > 0) equityCurve[equityCurve.length - 1] = finalEquity;
    
    const totalReturn = (finalEquity - INITIAL_PORTFOLIO_CAPITAL) / INITIAL_PORTFOLIO_CAPITAL;
    
    let peak = -Infinity, maxDrawdown = 0;
    for (const equity of equityCurve) {
      if (equity > peak) peak = equity;
      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    const closedTrades = trades.filter(t => t.status === 'CLOSED');
    
    const yearlyStatsMap: Record<string, { year: string, count: number, wins: number, totalReturn: number }> = {};
    for (const trade of closedTrades) {
      const year = new Date(trade.exitDate).getFullYear().toString();
      if (!yearlyStatsMap[year]) yearlyStatsMap[year] = { year, count: 0, wins: 0, totalReturn: 0 };
      yearlyStatsMap[year].count++;
      yearlyStatsMap[year].totalReturn += trade.return;
      if (trade.return > 0) yearlyStatsMap[year].wins++;
    }
    
    const yearlyStats = Object.values(yearlyStatsMap).map(y => ({
      year: y.year,
      return: y.count > 0 ? y.totalReturn / y.count : 0,
      count: y.count,
      winRate: y.count > 0 ? y.wins / y.count : 0,
    })).sort((a, b) => parseInt(b.year) - parseInt(a.year));
    
    const profitableYearsPct = yearlyStats.length > 0 ? yearlyStats.filter(y => y.return > 0).length / yearlyStats.length : 0;
    const winRate = closedTrades.length > 0 ? closedTrades.filter(t => t.return > 0).length / closedTrades.length : 0;
    let avgReturnAfterWin = 0, winRateAfterWin = 0, countAfterWin = 0;
    let avgReturnAfterLoss = 0, winRateAfterLoss = 0, countAfterLoss = 0;
    
    for (let i = 1; i < closedTrades.length; i++) {
      const prevTrade = closedTrades[i - 1]; const currentTrade = closedTrades[i];
      if (prevTrade.return > 0) {
        countAfterWin++; avgReturnAfterWin += currentTrade.return; if (currentTrade.return > 0) winRateAfterWin++;
      } else {
        countAfterLoss++; avgReturnAfterLoss += currentTrade.return; if (currentTrade.return > 0) winRateAfterLoss++;
      }
    }

    avgReturnAfterWin = countAfterWin > 0 ? avgReturnAfterWin / countAfterWin : 0;
    winRateAfterWin = countAfterWin > 0 ? winRateAfterWin / countAfterWin : 0;
    avgReturnAfterLoss = countAfterLoss > 0 ? avgReturnAfterLoss / countAfterLoss : 0;
    winRateAfterLoss = countAfterLoss > 0 ? winRateAfterLoss / countAfterLoss : 0;
    const isHolding = tickers.some(ticker => portfolio[ticker].inPosition);

    return new Response(JSON.stringify({
      dates: equityDates,
      strategyEquityCurve: equityCurve,
      trades: trades,
      yearlyStats: yearlyStats,
      strategyTotalReturn: totalReturn,
      strategyMaxDrawdown: maxDrawdown,
      profitableYearsPct: profitableYearsPct,
      isHolding: isHolding,
      totalTrades: trades.length,
      winRate: winRate,
      avgReturnAfterWin: avgReturnAfterWin,
      winRateAfterWin: winRateAfterWin,
      avgReturnAfterLoss: avgReturnAfterLoss,
      winRateAfterLoss: winRateAfterLoss,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
    });
  }
});