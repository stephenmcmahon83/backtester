import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- HELPERS ---
const calculateRSI = (prices: number[], period: number = 14): number | null => {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change; else losses += Math.abs(change);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + (avgGain / avgLoss)));
}

const calculateStreak = (prices: number[]): number => {
  if (prices.length < 2) return 0;
  let streak = 0;
  const lastIdx = prices.length - 1;
  const today = prices[lastIdx];
  const yest = prices[lastIdx - 1];
  
  if (today > yest) {
    streak = 1;
    let i = lastIdx - 1;
    while (i > 0 && prices[i] > prices[i-1]) { streak++; i--; }
  } else if (today < yest) {
    streak = -1;
    let i = lastIdx - 1;
    while (i > 0 && prices[i] < prices[i-1]) { streak--; i--; }
  }
  return streak;
}

// --- MAIN FUNCTION ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Get the LATEST DATE from stock_data (Actual Market Date)
    const { data: latestData } = await supabase
      .from('stock_data')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    if (!latestData || latestData.length === 0) throw new Error("No stock data found");
    const marketDate = latestData[0].date;
    console.log(`Latest Market Date: ${marketDate}`);

    // 2. Check if we already have picks for THIS date
    const { data: existing } = await supabase
      .from('signal_picks')
      .select('id')
      .eq('pick_date', marketDate)
      .eq('signal_type', 'composite')
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ 
        message: `Picks already exist for ${marketDate}`, 
        success: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Get Open Positions (Holdings)
    const { data: openPositions } = await supabase
      .from('signal_picks')
      .select('symbol')
      .is('exit_price', null); 
    
    const heldSymbols = new Set((openPositions || []).map((p: any) => p.symbol));

    // 4. Fetch Symbols (Top 100)
    const { data: symbols } = await supabase.from('symbols').select('symbol').limit(100);
    if (!symbols) throw new Error("No symbols found");

    // 5. Process Stocks
    const processStock = async (symbol: string) => {
      if (heldSymbols.has(symbol)) return null;

      // Get NEWEST data first
      const { data: history } = await supabase
        .from('stock_data')
        .select('close')
        .eq('symbol', symbol)
        .order('date', { ascending: false }) 
        .limit(50); 

      if (!history || history.length < 20) return null;

      // Reverse for calculation (Old -> New)
      const prices = history.map((h: any) => h.close).reverse();
      const currentPrice = prices[prices.length - 1]; 
      
      const rsi = calculateRSI(prices, 14);
      const streak = calculateStreak(prices);
      
      if (rsi === null) return null;

      const rsiScore = (100 - rsi); 
      const streakScore = (streak < 0 ? Math.abs(streak) * 10 : 0); 
      const compositeScore = rsiScore + streakScore;

      return {
        symbol,
        close: currentPrice,
        compositeScore
      };
    };

    const results = await Promise.all(symbols.map(s => processStock(s.symbol)));
    const validStocks = results.filter(r => r !== null);

    // 6. Sort and Pick
    validStocks.sort((a: any, b: any) => b.compositeScore - a.compositeScore);

    // --- CHANGED FROM 5 TO 3 HERE ---
    const best3 = validStocks.slice(0, 3);
    const worst3 = validStocks.slice(-3).reverse();

    // 7. Save to DB
    const picks: any[] = [];

    const formatPick = (stock: any, type: 'best' | 'worst', rank: number) => ({
      pick_date: marketDate, 
      symbol: stock.symbol,
      signal_type: 'composite',
      pick_type: type,
      rank: rank,
      signal_value: stock.compositeScore,
      entry_price: stock.close,
      historical_avg_return: 0,
      historical_win_rate: 0,
      historical_trade_count: 0
    });

    best3.forEach((s: any, i: number) => picks.push(formatPick(s, 'best', i + 1)));
    worst3.forEach((s: any, i: number) => picks.push(formatPick(s, 'worst', i + 1)));

    if (picks.length > 0) {
      const { error } = await supabase.from('signal_picks').insert(picks);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      date: marketDate,
      picks_saved: picks.length,
      best: best3.map(s => s.symbol),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});