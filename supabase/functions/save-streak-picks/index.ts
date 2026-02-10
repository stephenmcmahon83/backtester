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

    const { data: existingPicks } = await supabase
      .from('signal_picks')
      .select('id')
      .eq('pick_date', today)
      .eq('signal_type', 'streak')
      .limit(1);

    if (existingPicks && existingPicks.length > 0) {
      return new Response(JSON.stringify({ 
        message: 'Streak picks already exist for today',
        date: today,
        skipped: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- THE FIX IS HERE ---
    const { data: streakResponse, error: streakError } = await supabase.functions.invoke('calculate-streak-buckets', {
      body: { streakPeriod: '5d' }, 
    });
    
    if (streakError) throw new Error(`Streak function error: ${streakError.message}`);
    if (!streakResponse) throw new Error('No Streak data returned');

    // Filter valid
    const validData = streakResponse.filter((row: any) => 
      row.occurrence_count >= 5 && 
      row.avg_ret_5 !== null
    );

    // Sort by return potential
    validData.sort((a: any, b: any) => b.avg_ret_5 - a.avg_ret_5);

    // Check open positions to avoid duplicates
    const { data: openPositions } = await supabase
      .from('signal_picks')
      .select('symbol')
      .is('exit_price', null);
    
    const openSymbols = new Set((openPositions || []).map((p: any) => p.symbol));
    const available = validData.filter((s: any) => !openSymbols.has(s.symbol));

    const best5 = available.slice(0, 5);
    const worst5 = available.slice(-5).reverse();
    
    const symbolsToPrice = [...best5, ...worst5].map((s:any) => s.symbol);

    // Get prices
    const { data: priceData } = await supabase
      .from('stock_data')
      .select('symbol, close')
      .in('symbol', symbolsToPrice)
      .eq('date', today);

    const priceMap: Record<string, number> = {};
    priceData?.forEach((p:any) => priceMap[p.symbol] = p.close);

    const picks: any[] = [];

    const formatPick = (stock: any, type: 'best' | 'worst', rank: number) => ({
      pick_date: today,
      symbol: stock.symbol,
      signal_type: 'streak',
      pick_type: type,
      rank: rank,
      signal_value: stock.current_streak,
      historical_avg_return: stock.avg_ret_5,
      historical_win_rate: stock.win_pct_5,
      historical_trade_count: stock.occurrence_count,
      entry_price: priceMap[stock.symbol] || null,
    });

    best5.forEach((s: any, i: number) => picks.push(formatPick(s, 'best', i + 1)));
    worst5.forEach((s: any, i: number) => picks.push(formatPick(s, 'worst', i + 1)));

    if (picks.length > 0) {
      const { error: insertError } = await supabase.from('signal_picks').insert(picks);
      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ 
      success: true,
      picks_saved: picks.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in save-streak-picks:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});