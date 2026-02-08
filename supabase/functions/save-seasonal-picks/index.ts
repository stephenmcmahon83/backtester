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

    // Check if we already have seasonal picks for today
    const { data: existingPicks } = await supabase
      .from('signal_picks')
      .select('id')
      .eq('pick_date', today)
      .eq('signal_type', 'seasonal')
      .limit(1);

    if (existingPicks && existingPicks.length > 0) {
      return new Response(JSON.stringify({ 
        message: 'Seasonal picks already exist for today',
        date: today 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call the existing seasonal snapshot function
    const { data: seasonalResponse, error: seasonalError } = await supabase.functions.invoke('calculate-snapshot');
    
    if (seasonalError) {
      throw new Error(`Seasonal function error: ${seasonalError.message}`);
    }
    
    if (!seasonalResponse || seasonalResponse.length === 0) {
      throw new Error('No seasonal data returned');
    }

    // Calculate seasonal score = avg_ret_5 * win_pct_5
    // This combines both magnitude and consistency
    // Note: seasonal uses 'ticker' not 'symbol'
    const dataWithScores = seasonalResponse.map((row: any) => {
      const avgRet = row.avg_ret_5 || 0;
      const winPct = row.win_pct_5 || 0.5;
      const yearsOfData = row.years_of_data || 0;
      
      // Seasonal score: average return weighted by win rate
      // Also factor in data quality (more years = more reliable)
      const dataQualityFactor = Math.min(yearsOfData / 20, 1); // Cap at 20 years
      const seasonalScore = avgRet * winPct * dataQualityFactor;
      
      return {
        ...row,
        symbol: row.ticker, // Normalize field name (snapshot uses 'ticker')
        seasonal_score: seasonalScore,
      };
    }).filter((row: any) => 
      row.years_of_data >= 5 && 
      row.avg_ret_5 !== null && 
      row.win_pct_5 !== null
    );

    if (dataWithScores.length === 0) {
      throw new Error('No valid seasonal data after filtering');
    }

    // Sort by seasonal score descending (best first)
    const sortedByScore = [...dataWithScores].sort((a: any, b: any) => b.seasonal_score - a.seasonal_score);

    // Get current open positions for seasonal signals
    const { data: openPositions } = await supabase
      .from('signal_picks')
      .select('symbol')
      .eq('signal_type', 'seasonal')
      .is('exit_price', null);

    const openSymbols = new Set((openPositions || []).map((p: any) => p.symbol));

    // Get top 5 highest seasonal scores (bullish)
    const bullishCandidates = sortedByScore.filter((s: any) => !openSymbols.has(s.symbol));
    const best5 = bullishCandidates.slice(0, 5);

    // Get bottom 5 lowest seasonal scores (bearish)
    const bearishCandidates = sortedByScore.filter((s: any) => !openSymbols.has(s.symbol));
    const worst5 = bearishCandidates.slice(-5).reverse();

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
        signal_type: 'seasonal',
        pick_type: 'best',
        rank: idx + 1,
        signal_value: stock.seasonal_score,
        historical_avg_return: stock.avg_ret_5,
        historical_win_rate: stock.win_pct_5,
        historical_trade_count: stock.years_of_data, // Years of data for seasonal
        entry_price: latestPrices[stock.symbol] || null,
      });
    });

    worst5.forEach((stock: any, idx: number) => {
      picks.push({
        pick_date: today,
        symbol: stock.symbol,
        signal_type: 'seasonal',
        pick_type: 'worst',
        rank: idx + 1,
        signal_value: stock.seasonal_score,
        historical_avg_return: stock.avg_ret_5,
        historical_win_rate: stock.win_pct_5,
        historical_trade_count: stock.years_of_data,
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
      signal_type: 'seasonal',
      date: today,
      target_trading_day: seasonalResponse[0]?.target_day,
      best_picks: best5.map((s: any) => ({ 
        symbol: s.symbol, 
        score: (s.seasonal_score * 100).toFixed(4),
        avg_ret: (s.avg_ret_5 * 100).toFixed(2) + '%',
        win_pct: (s.win_pct_5 * 100).toFixed(0) + '%'
      })),
      worst_picks: worst5.map((s: any) => ({ 
        symbol: s.symbol, 
        score: (s.seasonal_score * 100).toFixed(4),
        avg_ret: (s.avg_ret_5 * 100).toFixed(2) + '%',
        win_pct: (s.win_pct_5 * 100).toFixed(0) + '%'
      })),
      skipped_symbols: Array.from(openSymbols),
      total_inserted: picks.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in save-seasonal-picks:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});