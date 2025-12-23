// FILE: supabase/functions/backtest-sma/index.ts (FINAL, HIGH-PERFORMANCE VERSION)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateMaxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length < 2) return 0;
  let maxDrawdown = 0;
  let peak = equityCurve[0];
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      peak = equityCurve[i];
    } else {
      const drawdown = (equityCurve[i] - peak) / peak;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }
  return maxDrawdown;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();
    if (!ticker || typeof ticker !== 'string') throw new Error("Ticker symbol is required.");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Call our new SQL function to get the pre-calculated signals
    const { data: signalData, error } = await supabaseClient
      .rpc('get_sma_backtest_signals', { p_ticker_symbol: ticker.toUpperCase() });

    if (error) throw error;
    if (!signalData || signalData.length < 50) {
      throw new Error("Not enough historical data for an SMA backtest.");
    }

    // 2. Run the simple, fast backtest loop
    const dates: string[] = [], bnhEquityCurve = [1], strategyEquityCurve = [1], trades: any[] = [];
    let bnhEquity = 1, strategyEquity = 1, inTrade = false, entryPrice = 0, entryDate = '';

    for (let i = 1; i < signalData.length; i++) {
      const currentDate = signalData[i].date;
      const currentPrice = signalData[i].close;
      const prevPrice = signalData[i - 1].close;
      const dailyReturn = (currentPrice / prevPrice) - 1;

      // Update Buy & Hold
      bnhEquity *= (1 + dailyReturn);
      dates.push(currentDate);
      bnhEquityCurve.push(bnhEquity);

      // Get the signal for the previous day to determine today's position
      const signal = signalData[i-1].signal;
      
      if (signal === 'BULL') {
        strategyEquity *= (1 + dailyReturn);
      }
      
      if (signal === 'BULL' && !inTrade) {
        inTrade = true;
        entryPrice = prevPrice;
        entryDate = currentDate;
      } else if (signal === 'BEAR' && inTrade) {
        inTrade = false;
        const exitPrice = prevPrice;
        trades.push({ entryDate, exitDate: currentDate, entryPrice: entryPrice.toFixed(2), exitPrice: exitPrice.toFixed(2), return: (exitPrice / entryPrice) - 1 });
      }
      strategyEquityCurve.push(strategyEquity);
    }
    
    // 3. Handle any open trade at the end
    if (inTrade) {
      const lastPrice = signalData[signalData.length - 1].close;
      trades.push({ entryDate, exitDate: 'OPEN', entryPrice: entryPrice.toFixed(2), exitPrice: lastPrice.toFixed(2), return: (lastPrice / entryPrice) - 1 });
    }
    
    const results = {
      dates, bnhEquityCurve, strategyEquityCurve, trades,
      bnhTotalReturn: bnhEquity - 1,
      bnhMaxDrawdown: calculateMaxDrawdown(bnhEquityCurve),
      strategyTotalReturn: strategyEquity - 1,
      strategyMaxDrawdown: calculateMaxDrawdown(strategyEquityCurve),
    };

    return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});