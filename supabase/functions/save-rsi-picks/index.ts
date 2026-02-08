import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];

    // Check if we already have RSI picks for today
    const { data: existingPicks } = await supabase
      .from('signal_picks')
      .select('id')
      .eq('pick_date', today)
      .eq('signal_type', 'rsi')
      .limit(1);

    if (existingPicks && existingPicks.length > 0) {
      return new Response(JSON.stringify({ 
        message: 'RSI picks already exist for today',
        date: today 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call the existing RSI scanner function
    const { data: rsiResponse, error: rsiError } = await supabase.functions.invoke('calculate-rsi-buckets', {
      body: JSON.stringify({ rsiPeriod: '5d' }),
    });
    
    if (rsiError) {
      throw new Error(`RSI function error: ${rsiError.message}`);
    }
    
    if (!rsiResponse || rsiResponse.length === 0) {
      throw new Error('No RSI data returned');
    }

    // Filter to stocks with sufficient data (occurrence_count >= 5)
    const validData = rsiResponse.filter((row: any) => 
      row.occurrence_count >= 5 && 
      row.current_rsi !== null &&
      row.avg_ret_5 !== null
    );

    if (validData.length === 0) {
      throw new Error('No valid RSI data after filtering');
    }

    // Data is already sorted by RSI ascending (most oversold first)
    // Get current open positions for RSI signals
    const { data: openPositions } = await supabase
      .from('signal_picks')
      .select('symbol')
      .eq('signal_type', 'rsi')
      .is('exit_price', null);

    const openSymbols = new Set((openPositions || []).map((p: any) => p.symbol));

    // Get top 5 lowest RSI (oversold = bullish, expecting bounce UP)
    const oversoldCandidates = validData.filter((s: any) => !openSymbols.has(s.symbol));
    const best5 = oversoldCandidates.slice(0, 5);

    // Get top 5 highest RSI (overbought = bearish, expecting drop)
    // Need to get from the end of the sorted array
    const overboughtCandidates = validData.filter((s: any) => !openSymbols.has(s.symbol));
    const worst5 = overboughtCandidates.slice(-5).reverse();

    // Get entry prices (most recent close)
    const symbols = [...best5, ...worst5].map((s: any) => s.symbol);
    
    if (symbols.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No new picks available (all candidates already have open positions)',
        date: today,
        skipped_symbols: Array.from(openSymbols),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: priceData } = await supabase
      .from('stock_data')
      .select('symbol, close, date')
      .in('symbol', symbols)
      .order('date', { ascending: false });

    const latestPrices: Record<string, number> = {};
    for (const row of priceData || []) {
      if (!latestPrices[row.symbol]) {
        latestPrices[row.symbol] = row.close;
      }
    }

    // Prepare picks for insertion
    const picks: any[] = [];

    best5.forEach((stock: any, idx: number) => {
      picks.push({
        pick_date: today,
        symbol: stock.symbol,
        signal_type: 'rsi',
        pick_type: 'best',
        rank: idx + 1,
        signal_value: stock.current_rsi,
        historical_avg_return: stock.avg_ret_5,
        historical_win_rate: stock.win_pct_5,
        historical_trade_count: stock.occurrence_count,
        entry_price: latestPrices[stock.symbol] || null,
      });
    });

    worst5.forEach((stock: any, idx: number) => {
      picks.push({
        pick_date: today,
        symbol: stock.symbol,
        signal_type: 'rsi',
        pick_type: 'worst',
        rank: idx + 1,
        signal_value: stock.current_rsi,
        historical_avg_return: stock.avg_ret_5,
        historical_win_rate: stock.win_pct_5,
        historical_trade_count: stock.occurrence_count,
        entry_price: latestPrices[stock.symbol] || null,
      });
    });

    // Insert picks
    const { error: insertError } = await supabase
      .from('signal_picks')
      .insert(picks);

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ 
      success: true,
      signal_type: 'rsi',
      date: today,
      best_picks: best5.map((s: any) => ({ symbol: s.symbol, rsi: s.current_rsi.toFixed(1) })),
      worst_picks: worst5.map((s: any) => ({ symbol: s.symbol, rsi: s.current_rsi.toFixed(1) })),
      skipped_symbols: Array.from(openSymbols),
      total_inserted: picks.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in save-rsi-picks:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});