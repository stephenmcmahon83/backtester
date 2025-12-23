import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Get all tickers
    const { data: symbolsData, error: symbolsError } = await supabaseClient
      .from('symbols')
      .select('symbol');
      
    if (symbolsError) throw symbolsError;
    
    const tickers: string[] = symbolsData.map((s: { symbol: string }) => s.symbol);

    // 2. Process each ticker individually (Fetch RSI + Metrics in parallel)
    const promises = tickers.map(async (ticker) => {
      
      // Fire both requests simultaneously for speed
      const [rsiResult, metricResult] = await Promise.all([
        supabaseClient.rpc('get_rsi_mean_reversion_stats', { p_ticker_symbol: ticker }).single(),
        supabaseClient.rpc('get_dashboard_metrics', { p_ticker_symbol: ticker }).single()
      ]);

      // Debugging: Log if RSI fails
      if (rsiResult.error) {
        console.error(`RSI fetch failed for ${ticker}:`, rsiResult.error.message);
      }

      // If Metrics fail, we can't show the row
      if (metricResult.error) {
        console.error(`Dashboard Metric fetch failed for ${ticker}:`, metricResult.error.message);
        return null;
      }

      const data = metricResult.data;
      
      // Safely extract RSI. If it errored or is null, default to null.
      // We check both .data and .data.current_avg_rsi to be safe.
      const rsiValue = (rsiResult.data && rsiResult.data.current_avg_rsi) 
        ? rsiResult.data.current_avg_rsi 
        : null;

      return {
        ticker: data.ticker,
        pctChange: data.pctChange,
        // Snake case to match Frontend Types
        trend_200: data.trend_200 ?? 'N/A', 
        trend_100: data.trend_100 ?? 'N/A',
        vs52wHigh: data.vs52wHigh,
        vs52wLow: data.vs52wLow,
        perf26w: data.perf26w,
        perf52w: data.perf52w,
        cumulativeRsi: rsiValue,
      };
    });

    const results = await Promise.all(promises);
    
    // Filter out any tickers that completely crashed (returned null)
    const validResults = results.filter(r => r !== null);

    return new Response(
      JSON.stringify(validResults),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});