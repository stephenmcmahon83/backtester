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

    // Check if we already have streak picks for today
    const { data: existingPicks } = await supabase
      .from('signal_picks')
      .select('id')
      .eq('pick_date', today)
      .eq('signal_type', 'streak')
      .limit(1);

    if (existingPicks && existingPicks.length > 0) {
      return new Response(JSON.stringify({ 
        message: 'Streak picks already exist for today',
        date: today 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call the existing streak scanner function (MODE B - all stocks)
    const { data: streakResponse, error: streakError } = await supabase.functions.invoke('calculate-streaks', {
      method: 'POST',
      body: JSON.stringify({}), // Empty body triggers scanner mode
    });
    
    if (streakError) {
      throw new Error(`Streak function error: ${streakError.message}`);
    }
    
    if (!streakResponse || streakResponse.length === 0) {
      throw new Error('No streak data returned');
    }

    // Filter to stocks with sufficient data
    const validData = streakResponse.filter((row: any) => 
      row.occurrence_count >= 3 && 
      row.current_streak !== null &&
      row.current_streak !== 0 &&
      row.avg_ret_5 !== null
    );

    if (validData.length === 0) {
      throw new Error('No valid streak data after filtering');
    }

    // Sort by current_streak ascending (most negative = biggest losing streak first)
    const sortedByStreak = [...validData].sort((a: any, b: any) => a.current_streak - b.current_streak);

    // Get current open positions for streak signals
    const { data: openPositions } = await supabase
      .from('signal_picks')
      .select('symbol')
      .eq('signal_type', 'streak')
      .is('exit_price', null);

    const openSymbols = new Set((openPositions || []).map((p: any) => p.symbol));

    // Get top 5 most NEGATIVE streaks (big losing streak = bullish, expecting bounce UP)
    const losingStreakCandidates = sortedByStreak.filter((s: any) => 
      !openSymbols.has(s.symbol) && s.current_streak < 0
    );
    const best5 = losingStreakCandidates.slice(0, 5);

    // Get top 5 most POSITIVE streaks (big winning streak = bearish, expecting pullback)
    const winningStreakCandidates = sortedByStreak.filter((s: any) => 
      !openSymbols.has(s.symbol) && s.current_streak > 0
    );
    // Take from the END (highest positive streaks)
    const worst5 = winningStreakCandidates.slice(-5).reverse();

    // Get entry prices
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

    // Prepare picks
    const picks: any[] = [];

    best5.forEach((stock: any, idx: number) => {
      picks.push({
        pick_date: today,
        symbol: stock.symbol,
        signal_type: 'streak',
        pick_type: 'best',
        rank: idx + 1,
        signal_value: stock.current_streak,
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
        signal_type: 'streak',
        pick_type: 'worst',
        rank: idx + 1,
        signal_value: stock.current_streak,
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
      signal_type: 'streak',
      date: today,
      best_picks: best5.map((s: any) => ({ symbol: s.symbol, streak: s.current_streak })),
      worst_picks: worst5.map((s: any) => ({ symbol: s.symbol, streak: s.current_streak })),
      skipped_symbols: Array.from(openSymbols),
      total_inserted: picks.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in save-streak-picks:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});