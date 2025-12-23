// supabase/functions/rsi-analyzer/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: symbolsData, error: symbolsError } = await supabaseClient
      .from('symbols')
      .select('symbol');

    if (symbolsError) throw symbolsError;
    const tickers = symbolsData.map(s => s.symbol);

    const promises = tickers.map(async (ticker) => {
      // This part is working correctly now
      const { data: stats, error } = await supabaseClient
        .rpc('get_rsi_mean_reversion_stats', { p_ticker_symbol: ticker })
        .single();
      
      if (error) {
        console.error(`Error processing RSI for ${ticker}:`, error.message);
        return null; 
      }
      
      // Calculate years of data (This is the block we are fixing)
      const { count, error: countError } = await supabaseClient
        .from('stock_data')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', ticker); // <<< THE FIX IS HERE. Changed 'ticker' to 'symbol'
      
      if(countError) {
        console.error(`Error counting data for ${ticker}:`, countError.message);
      }

      const yearsOfData = count ? Math.round(count / 252) : 0;

      return {
        ticker: ticker,
        years_of_data: yearsOfData,
        ...stats
      };
    });

    const results = await Promise.all(promises);
    // Filter out any tickers that failed or had no valid RSI stats
    const validResults = results.filter(r => r !== null && r.current_avg_rsi !== null);

    return new Response(
      JSON.stringify(validResults),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
});