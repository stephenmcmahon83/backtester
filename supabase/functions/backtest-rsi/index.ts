import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- HELPER: ADVANCED METRICS & DRAWDOWN ---
function calculateAdvancedMetrics(trades: any[]) {
    if (trades.length === 0) {
        return { maxTrade: 0, minTrade: 0, profitableYearsPct: 0 };
    }
    const returns = trades.map(t => t.return);
    const maxTrade = Math.max(...returns);
    const minTrade = Math.min(...returns);

    const yearlyProfits: { [year: string]: number } = {};
    trades.forEach(trade => {
        const yearStr = trade.exitDate.substring(0, 4);
        if (!/^\d{4}$/.test(yearStr)) return; // Skip 'OPEN' trades
        if (!yearlyProfits[yearStr]) yearlyProfits[yearStr] = 0;
        // Calculate profit based on return to account for compounding
        yearlyProfits[yearStr] += trade.return;
    });
    
    const years = Object.keys(yearlyProfits);
    const profitableYears = years.filter(year => yearlyProfits[year] > 0).length;
    const profitableYearsPct = years.length > 0 ? (profitableYears / years.length) : 0;
    
    return { maxTrade, minTrade, profitableYearsPct };
}

function calculateMaxDrawdown(equityCurve: number[]): number {
    if (equityCurve.length < 2) return 0;
    let maxDrawdown = 0;
    let peak = equityCurve[0];
    for (let i = 1; i < equityCurve.length; i++) {
        if (equityCurve[i] > peak) {
            peak = equityCurve[i];
        } else {
            const drawdown = (peak - equityCurve[i]) / peak;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
    }
    return -maxDrawdown;
}

// --- HELPER: INDICATOR CALCULATIONS ---
function calculateRSI(prices: number[], period: number = 2): (number | null)[] {
  const rsi: (number | null)[] = Array(prices.length).fill(null);
  let gains = 0, losses = 0;

  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (i <= period) {
      if (change > 0) gains += change; else losses -= change;
    } else {
      if (change > 0) {
        gains = (gains * (period - 1) + change) / period;
        losses = (losses * (period - 1)) / period;
      } else {
        gains = (gains * (period - 1)) / period;
        losses = (losses * (period - 1) - change) / period;
      }
    }
    if (i >= period) {
      const rs = losses === 0 ? 100 : gains / losses; // Use 100 as a proxy for infinite RS
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }
  return rsi;
}

function calculateSMA(data: (number | null)[], period: number): (number | null)[] {
    const sma: (number | null)[] = Array(data.length).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        const window = data.slice(i - period + 1, i + 1);
        if (window.some(v => v === null)) continue;
        const sum = window.reduce((a, b) => a! + b!, 0);
        sma[i] = sum! / period;
    }
    return sma;
}

// --- MAIN FUNCTION ---
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { ticker, entryRsi, exitRsi } = await req.json();
    if (!ticker) throw new Error("Ticker required");
    if (entryRsi === undefined || exitRsi === undefined) throw new Error("RSI thresholds required");

    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });

    const { data: priceData, error } = await supabaseClient.from('stock_data').select('date, close').eq('symbol', ticker.toUpperCase()).order('date', { ascending: true });
    if (error) throw error;
    if (!priceData || priceData.length < 20) throw new Error("Not enough data for RSI backtest.");

    const closePrices = priceData.map(p => p.close);
    const rsi2 = calculateRSI(closePrices, 2);
    const avgRsi10 = calculateSMA(rsi2, 10);

    const dates: string[] = [], bnhEquityCurve = [1], strategyEquityCurve = [1], trades: any[] = [];
    let bnhEquity = 1, strategyEquity = 1, inTrade = false, entryPrice = 0, entryDate = '';

    for (let i = 11; i < priceData.length; i++) { // Start after RSI warmup
        const dailyReturn = (priceData[i].close / priceData[i - 1].close) - 1;
        bnhEquity *= (1 + dailyReturn);
        dates.push(priceData[i].date);
        bnhEquityCurve.push(bnhEquity);

        const compositeRsi = avgRsi10[i - 1]; // Signal from yesterday's close

        if (compositeRsi !== null) {
            if (!inTrade && compositeRsi < entryRsi) {
                inTrade = true;
                entryPrice = priceData[i].close; // Enter on today's open (proxied by close)
                entryDate = priceData[i].date;
            } else if (inTrade && compositeRsi > exitRsi) {
                inTrade = false;
                const exitPrice = priceData[i].close;
                trades.push({
                    entryDate,
                    exitDate: priceData[i].date,
                    entryPrice,
                    exitPrice,
                    return: (exitPrice / entryPrice) - 1 - 0.0005, // 0.05% round-trip commission
                });
            }
        }

        if (inTrade) strategyEquity *= (1 + dailyReturn);
        strategyEquityCurve.push(strategyEquity);
    }
    
    const { maxTrade, minTrade, profitableYearsPct } = calculateAdvancedMetrics(trades);
    
    const lastCompositeRsi = avgRsi10[avgRsi10.length - 1];
    let nextDaySignal = "HOLD";
    if (lastCompositeRsi !== null) {
      if (!inTrade && lastCompositeRsi < entryRsi) nextDaySignal = "BUY";
      else if (inTrade && lastCompositeRsi > exitRsi) nextDaySignal = "SELL";
    }

    const results = {
      dates, bnhEquityCurve, strategyEquityCurve,
      bnhTotalReturn: bnhEquity - 1, bnhMaxDrawdown: calculateMaxDrawdown(bnhEquityCurve),
      strategyTotalReturn: strategyEquity - 1, strategyMaxDrawdown: calculateMaxDrawdown(strategyEquityCurve),
      trades, maxTrade, minTrade, profitableYearsPct, nextDaySignal,
    };

    return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in RSI backtest function:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});