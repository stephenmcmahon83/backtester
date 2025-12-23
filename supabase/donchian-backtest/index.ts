import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- HELPER: CALCULATE MAX DRAWDOWN ---
function calculateMaxDrawdown(equityCurve: number[]): number {
    if (equityCurve.length < 2) return 0;
    let maxDrawdown = 0;
    let peak = equityCurve[0];
    for (let i = 1; i < equityCurve.length; i++) {
        if (equityCurve[i] > peak) {
            peak = equityCurve[i];
        } else {
            const drawdown = (peak - equityCurve[i]) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
    }
    return -maxDrawdown;
}

// --- HELPER: CALCULATE ADVANCED METRICS ---
function calculateAdvancedMetrics(trades: any[]) {
    if (trades.length === 0) {
        return { maxTrade: 0, minTrade: 0, profitableYearsPct: 0 };
    }
    
    // Calculate Max and Min Trade Return
    const returns = trades.map(t => t.return);
    const maxTrade = Math.max(...returns);
    const minTrade = Math.min(...returns);

    // Calculate % of Profitable Years
    const yearlyProfits: { [year: string]: number } = {};
    trades.forEach(trade => {
        // Extract year from exitDate (format YYYY-MM-DD)
        const year = trade.exitDate.substring(0, 4);
        // Skip open trades which might not have a valid year yet
        if (!/^\d{4}$/.test(year)) return; 
        
        if (!yearlyProfits[year]) yearlyProfits[year] = 0;
        yearlyProfits[year] += trade.return;
    });

    const years = Object.keys(yearlyProfits);
    const profitableYears = years.filter(year => yearlyProfits[year] > 0).length;
    const profitableYearsPct = years.length > 0 ? (profitableYears / years.length) : 0;
    
    return { maxTrade, minTrade, profitableYearsPct };
}

// --- MAIN FUNCTION ---
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ticker, entryPeriod, exitPeriod } = await req.json();
    
    // Input Validation
    if (!ticker || typeof ticker !== 'string') {
        throw new Error("Ticker symbol is required.");
    }
    if (!entryPeriod || typeof entryPeriod !== 'number' || entryPeriod <= 0) {
        throw new Error("A valid entry period is required.");
    }
    if (!exitPeriod || typeof exitPeriod !== 'number' || exitPeriod <= 0) {
        throw new Error("A valid exit period is required.");
    }

    // Supabase Client Setup
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Fetch Data
    const { data: priceData, error } = await supabaseClient
      .from('stock_data')
      .select('date, close') 
      .eq('symbol', ticker.toUpperCase())
      .order('date', { ascending: true });

    if (error) throw error;
    
    const requiredDataLength = Math.max(entryPeriod, exitPeriod);
    if (!priceData || priceData.length < requiredDataLength + 1) {
      throw new Error(`Not enough historical data. Need at least ${requiredDataLength + 1} days.`);
    }

    // Backtest Initialization
    const dates: string[] = [], bnhEquityCurve = [1], strategyEquityCurve = [1], trades: any[] = [];
    let bnhEquity = 1, strategyEquity = 1, inTrade = false, entryPrice = 0, entryDate = '';

    // Backtest Loop
    for (let i = 1; i < priceData.length; i++) {
      const currentDate = priceData[i].date;
      const currentPrice = priceData[i].close;
      const prevPrice = priceData[i - 1].close;
      
      // Handle potential nulls
      if (currentPrice === null || prevPrice === null) {
        strategyEquityCurve.push(strategyEquity);
        bnhEquityCurve.push(bnhEquity);
        dates.push(currentDate);
        continue;
      }
      
      const dailyReturn = (currentPrice / prevPrice) - 1;

      bnhEquity *= (1 + dailyReturn);
      dates.push(currentDate);
      bnhEquityCurve.push(bnhEquity);

      // Strategy Logic
      if (i >= requiredDataLength + 1) {
        // Channels are calculated based on the period ending at the previous day (i-1)
        const upperChannel = Math.max(...priceData.slice(i - 1 - entryPeriod, i - 1).map(p => p.close).filter(p => p !== null));
        const lowerChannel = Math.min(...priceData.slice(i - 1 - exitPeriod, i - 1).map(p => p.close).filter(p => p !== null));

        // Entry Signal
        if (prevPrice > upperChannel && !inTrade) {
          inTrade = true;
          entryPrice = prevPrice;
          entryDate = currentDate;
        } 
        // Exit Signal
        else if (prevPrice < lowerChannel && inTrade) {
          inTrade = false;
          const exitPrice = prevPrice;
          
          // Add commission (0.05% = 0.0005)
          const tradeReturn = (exitPrice / entryPrice) - 1 - 0.0005;

          trades.push({ 
            entryDate, 
            exitDate: currentDate, 
            entryPrice: entryPrice.toFixed(2), 
            exitPrice: exitPrice.toFixed(2), 
            return: tradeReturn
          });
        }
      }
      
      if (inTrade) {
        strategyEquity *= (1 + dailyReturn);
      }
      strategyEquityCurve.push(strategyEquity);
    }

    // Handle Open Trade
    if (inTrade) {
      const lastPrice = priceData[priceData.length - 1].close;
      if (lastPrice !== null) {
          trades.push({
            entryDate,
            exitDate: 'OPEN',
            entryPrice: entryPrice.toFixed(2),
            exitPrice: lastPrice.toFixed(2),
            return: (lastPrice / entryPrice) - 1,
          });
      }
    }
    
    // Calculate Final Metrics
    const strategyTotalReturn = strategyEquity - 1;
    const strategyMaxDrawdown = calculateMaxDrawdown(strategyEquityCurve);
    const { maxTrade, minTrade, profitableYearsPct } = calculateAdvancedMetrics(trades);

    // Determine Next Day Signal
    // We look at the most recent completed day (end of array) to set signal for tomorrow
    const i = priceData.length;
    const prevPrice = priceData[i - 1].close;
    const upperChannel = Math.max(...priceData.slice(i - 1 - entryPeriod, i - 1).map(p => p.close).filter(p => p !== null));
    const lowerChannel = Math.min(...priceData.slice(i - 1 - exitPeriod, i - 1).map(p => p.close).filter(p => p !== null));
    
    let nextDaySignal = "HOLD";
    if (!inTrade && prevPrice > upperChannel) {
        nextDaySignal = "BUY";
    } else if (inTrade && prevPrice < lowerChannel) {
        nextDaySignal = "SELL";
    }

    const results = {
      dates,
      bnhEquityCurve,
      strategyEquityCurve,
      bnhTotalReturn: bnhEquity - 1,
      bnhMaxDrawdown: calculateMaxDrawdown(bnhEquityCurve),
      strategyTotalReturn: strategyTotalReturn,
      strategyMaxDrawdown: strategyMaxDrawdown,
      // Bull/Bear fields kept for compatibility, mapped to main strategy results
      bullPeriodReturn: strategyTotalReturn,
      bullPeriodMaxDrawdown: strategyMaxDrawdown,
      bearPeriodReturn: 0,
      bearPeriodMaxDrawdown: 0,
      trades,
      maxTrade,
      minTrade,
      profitableYearsPct,
      nextDaySignal
    };

    return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error caught in donchian-backtest function:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});