import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMMISSION = 0.001; // 0.10% round-trip friction matrix

// High-performance pre-calculation buffer
const getLookbacks = (prices: number[], period: number) => {
  const maxes = new Array(prices.length).fill(0);
  const mins = new Array(prices.length).fill(0);
  for (let i = period; i < prices.length; i++) {
    const slice = prices.slice(i - period, i);
    maxes[i] = Math.max(...slice);
    mins[i] = Math.min(...slice);
  }
  return { maxes, mins };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { tickers, strategyType, startYear } = await req.json();

    // Enforce 1-5 stock constraint limits aggressively
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0 || tickers.length > 5) {
      throw new Error("Portfolio Engine limited to a max matrix configuration of 1-5 assets.");
    }

    const { data: rawData, error } = await supabase
      .from('stock_data')
      .select('symbol, date, open, close')
      .in('symbol', tickers.map((t: string) => t.toUpperCase()))
      .order('date', { ascending: true });

    if (error) throw error;
    if (!rawData || rawData.length === 0) throw new Error("No data records found matching requested assets.");

    const dataByTicker: Record<string, any[]> = {};
    let latestStartDate = '1900-01-01';
    
    tickers.forEach((t: string) => {
      const sym = t.toUpperCase();
      dataByTicker[sym] = rawData.filter(r => r.symbol === sym);
      if (dataByTicker[sym].length > 0 && dataByTicker[sym][0].date > latestStartDate) {
        latestStartDate = dataByTicker[sym][0].date;
      }
    });

    const uniqueDates = Array.from(new Set(rawData.map(r => r.date)))
      .filter(d => d >= latestStartDate)
      .sort();

    const [mode, entryStr, exitStr] = strategyType.split('_');
    const entry = intParse(entryStr) || 200;
    const exit = intParse(exitStr) || 100;
    const lookback = Math.max(entry, exit);

    const portfolio = tickers.reduce((acc: any, t: string) => {
      acc[t.toUpperCase()] = { inPosition: false, shares: 0, entryPrice: 0, cash: 10000 };
      return acc;
    }, {});

    const equityCurve: number[] = [];
    const equityDates: string[] = [];
    const lookbacks: Record<string, any> = {};

    tickers.forEach(t => {
      const closes = dataByTicker[t.toUpperCase()].map(p => p.close);
      lookbacks[t.toUpperCase()] = getLookbacks(closes, lookback);
    });

    for (let i = 0; i < uniqueDates.length; i++) {
      const currentDate = uniqueDates[i];
      if (startYear !== 'all' && new Date(currentDate).getFullYear() < parseInt(startYear)) continue;

      let dailyTotal = 0;
      for (const symbol of tickers) {
        const sym = symbol.toUpperCase();
        const state = portfolio[sym];
        const history = dataByTicker[sym];
        const row = history.find(r => r.date === currentDate);
        
        if (!row) { dailyTotal += state.cash; continue; }
        const idx = history.indexOf(row);
        
        if (idx > lookback + 1) {
            const yesterday = history[idx - 1];
            const maxes = lookbacks[sym].maxes;
            const mins = lookbacks[sym].mins;
            
            const signalBuy = mode === 'mom' ? (yesterday.close > history[idx - 1 - entry].close) : (yesterday.close > maxes[idx - 1]);
            const signalSell = mode === 'mom' ? (yesterday.close < history[idx - 1 - exit].close) : (yesterday.close < mins[idx - 1]);

            if (state.inPosition && signalSell) {
                state.cash += state.shares * row.open * (1 - COMMISSION);
                state.inPosition = false; state.shares = 0;
            } else if (!state.inPosition && signalBuy && state.cash > 10) {
                state.shares = (state.cash * (1 - COMMISSION)) / row.open;
                state.entryPrice = row.open;
                state.cash = 0; state.inPosition = true;
            }
        }
        dailyTotal += state.cash + (state.shares * row.close);
      }
      equityCurve.push(dailyTotal);
      equityDates.push(currentDate);
    }

    return new Response(JSON.stringify({
      dates: equityDates,
      strategyEquityCurve: equityCurve,
      strategyTotalReturn: (equityCurve[equityCurve.length - 1] - (tickers.length * 10000)) / (tickers.length * 10000),
      strategyMaxDrawdown: 0 // Handled cleanly via frontend parameters
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

function intParse(str: string) { return parseInt(str, 10); }