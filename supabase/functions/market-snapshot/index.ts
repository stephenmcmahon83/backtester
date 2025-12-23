import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const calculateRSI = (data: {close: number}[], period: number, index: number): number | null => {
  if (index < period) return null;
  let gains = 0;
  let losses = 0;
  
  for (let i = index - period + 1; i <= index; i++) {
    if (!data[i] || !data[i - 1]) return null;
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = (gains / period) / avgLoss;
  return 100 - (100 / (1 + rs));
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { data: symbolsData, error: symbolsError } = await supabase.from('symbols').select('symbol');
    if (symbolsError) throw symbolsError;
    const symbols = symbolsData.map(s => s.symbol);

    const snapshotPromises = symbols.map(async (symbol) => {
      try {
        const { data: descHistory, error } = await supabase
          .from('stock_data')
          .select('date, close')
          .eq('symbol', symbol)
          .order('date', { ascending: false })
          .limit(252);

        if (error || !descHistory || descHistory.length < 252) return null;
        
        const history = [...descHistory].reverse();
        const n = history.length;
        const latest = history[n - 1];
        const close = latest.close;
        const close100d = history[n - 100]?.close;
        const close200d = history[n - 200]?.close;
        const recent200 = history.slice(n - 200);
        
        if (recent200.length === 0) return null;

        const sma200 = recent200.reduce((sum, day) => sum + day.close, 0) / recent200.length;
        const high26w = Math.max(...history.slice(n - 126).map(d => d.close));
        const high52w = Math.max(...history.slice(n - 252).map(d => d.close));
        
        // Calculate RSI for last 10 days
        const rsiValues: number[] = [];
        for (let i = 0; i < 10; i++) {
          const targetIndex = n - 1 - i;
          const rsi = calculateRSI(history, 2, targetIndex);
          if (rsi !== null) rsiValues.push(rsi);
        }
        
        // 10-Day Average
        const avg_rsi_2_10d = rsiValues.length > 0 
          ? rsiValues.reduce((a, b) => a + b, 0) / rsiValues.length 
          : null;

        // 5-Day Average (slice the first 5, as index 0 is the most recent)
        const recent5Rsi = rsiValues.slice(0, 5);
        const avg_rsi_2_5d = recent5Rsi.length > 0
          ? recent5Rsi.reduce((a, b) => a + b, 0) / recent5Rsi.length
          : null;

        return {
          symbol,
          c_vs_c200: close200d !== undefined && close > close200d ? 'bull' : 'bear',
          c_vs_c100: close100d !== undefined && close > close100d ? 'bull' : 'bear',
          p_vs_sma200: close > sma200 ? 'bull' : 'bear',
          pct_off_26w_high: high26w ? (close - high26w) / high26w : 0,
          pct_off_52w_high: high52w ? (close - high52w) / high52w : 0,
          avg_rsi_2_10d,
          avg_rsi_2_5d, // NEW FIELD
        };
      } catch (innerError) {
        console.error(`Error processing symbol ${symbol}:`, innerError);
        return null;
      }
    });

    const results = await Promise.all(snapshotPromises);
    const snapshotData = results.filter(Boolean);

    const { data: latestDateData, error: dateError } = await supabase
      .from('stock_data')
      .select('date')
      .eq('symbol', 'SPY')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestDate = latestDateData?.date || new Date().toISOString().split('T')[0];

    return new Response(JSON.stringify({ snapshotData, latestDate }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});