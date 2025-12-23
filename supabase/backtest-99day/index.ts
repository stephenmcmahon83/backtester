import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- HELPER: ADVANCED METRICS & DRAWDOWN ---
function calculateAdvancedMetrics(trades: any[]) { /* ... copy from RSI function ... */ }
function calculateMaxDrawdown(equityCurve: number[]): number { /* ... copy from RSI function ... */ }


Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { ticker, period } = await req.json();
    if (!ticker || !period) throw new Error("Ticker and period required.");

    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });

    const { data: priceData, error } = await supabaseClient.from('stock_data').select('date, close').eq('symbol', ticker.toUpperCase()).order('date', { ascending: true });
    if (error) throw error;
    const requiredDataLength = period * 2;
    if (!priceData || priceData.length < requiredDataLength) throw new Error(`Not enough data. Need ${requiredDataLength} days.`);

    // --- Backtest Logic ---
    const dates: string[] = [], bnhEquityCurve = [1], strategyEquityCurve = [1], trades: any[] = [];
    let bnhEquity = 1, strategyEquity = 1, inTrade = false, entryPrice = 0, entryDate = '';

    for (let i = 1; i < priceData.length; i++) {
        const currentDate = priceData[i].date;
        const currentPrice = priceData[i].close;
        const prevPrice = priceData[i - 1].close;
        const dailyReturn = (currentPrice / prevPrice) - 1;

        bnhEquity *= (1 + dailyReturn);
        dates.push(currentDate);
        bnhEquityCurve.push(bnhEquity);

        if (i >= requiredDataLength -1) {
            const highCurrent = Math.max(...priceData.slice(i - period + 1, i + 1).map(p => p.close));
            const highPrior = Math.max(...priceData.slice(i - requiredDataLength + 1, i - period + 1).map(p => p.close));
            const signal = highCurrent > highPrior ? 'BULL' : 'BEAR';

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
                trades.push({ entryDate, exitDate: currentDate, entryPrice, exitPrice, return: (exitPrice / entryPrice) - 1 - 0.0005 });
            }
        }
        strategyEquityCurve.push(strategyEquity);
    }
    
    const { maxTrade, minTrade, profitableYearsPct } = calculateAdvancedMetrics(trades);

    const i = priceData.length - 1;
    const highCurrent = Math.max(...priceData.slice(i - period + 1, i + 1).map(p => p.close));
    const highPrior = Math.max(...priceData.slice(i - requiredDataLength + 1, i - period + 1).map(p => p.close));
    let nextDaySignal = "HOLD";
    const isInBullSignal = highCurrent > highPrior;
    if (!inTrade && isInBullSignal) nextDaySignal = "BUY";
    else if (inTrade && !isInBullSignal) nextDaySignal = "SELL";

    const results = {
      dates, bnhEquityCurve, strategyEquityCurve,
      bnhTotalReturn: bnhEquity - 1, bnhMaxDrawdown: calculateMaxDrawdown(bnhEquityCurve),
      strategyTotalReturn: strategyEquity - 1, strategyMaxDrawdown: calculateMaxDrawdown(strategyEquityCurve),
      trades, maxTrade, minTrade, profitableYearsPct, nextDaySignal
    };

    return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) { /* ... error handling ... */ }
});