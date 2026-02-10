import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = new Date().toISOString().split('T')[0];

    // 1. Check if we already ran this function for today
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

    // 2. Call the calculation function
    // CRITICAL FIX: Added Authorization header and passed body as object
    const { data: streakResponse, error: streakError } = await supabase.functions.invoke('calculate-streak-buckets', {
      body: { streakPeriod: '5d' }, 
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      }
    });
    
    if (streakError) throw new Error(`Streak function error: ${streakError.message}`);
    if (!streakResponse) throw new Error('No Streak data returned');

    // 3. Filter for valid data (Minimum 3 occurrences to be safe)
    const validData = streakResponse.filter((row: any) => 
      row.occurrence_count >= 3 && 
      row.avg_ret_5 !== null
    );

    if (validData.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        picks_saved: 0, 
        message: "No stocks met Streak criteria" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Sort by Return Potential
    // Best = Highest positive return
    // Worst = Lowest (most negative) return
    validData.sort((a: any, b: any) => b.avg_ret_5 - a.avg_ret_5);

    // 5. Check open positions to avoid duplicates
    const { data: openPositions } = await supabase
      .from('signal_picks')
      .select('symbol')
      .is('exit_price', null);
    
    const openSymbols = new Set((openPositions || []).map((p: any) => p.symbol));
    const available = validData.filter((s: any) => !openSymbols.has(s.symbol));

    const best5 = available.slice(0, 5);
    const worst5 = available.slice(-5).reverse();
    
    const symbolsToPrice = [...best5, ...worst5].map((s:any) => s.symbol);

    if (symbolsToPrice.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        picks_saved: 0, 
        message: "No new candidates available (others already open)" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Get current prices for entry
    const { data: priceData } = await supabase
      .from('stock_data')
      .select('symbol, close')
      .in('symbol', symbolsToPrice)
      .eq('date', today);

    const priceMap: Record<string, number> = {};
    priceData?.forEach((p:any) => priceMap[p.symbol] = p.close);

    const picks: any[] = [];

    // Helper to format picks
    const formatPick = (stock: any, type: 'best' | 'worst', rank: number) => ({
      pick_date: today,
      symbol: stock.symbol,
      signal_type: 'streak',
      pick_type: type,
      rank: rank,
      signal_value: stock.current_streak, // Ensure this matches what calculate-streak-buckets returns
      historical_avg_return: stock.avg_ret_5,
      historical_win_rate: stock.win_pct_5,
      historical_trade_count: stock.occurrence_count,
      entry_price: priceMap[stock.symbol] || null,
    });

    best5.forEach((s: any, i: number) => picks.push(formatPick(s, 'best', i + 1)));
    worst5.forEach((s: any, i: number) => picks.push(formatPick(s, 'worst', i + 1)));

    // 7. Insert into Database
    if (picks.length > 0) {
      const { error: insertError } = await supabase.from('signal_picks').insert(picks);
      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ 
      success: true,
      picks_saved: picks.length,
      sample: picks.slice(0, 2)
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