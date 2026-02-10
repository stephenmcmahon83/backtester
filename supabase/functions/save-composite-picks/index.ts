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

    // Get the market snapshot data
    const { data: snapshotResponse, error: snapshotError } = await supabase.functions.invoke('market-snapshot');
    
    if (snapshotError) throw snapshotError;
    if (snapshotResponse.error) throw new Error(snapshotResponse.error);

    const snapshotData = snapshotResponse.snapshotData;
    const latestDate = snapshotResponse.latestDate;

    // Check if we already have composite picks for today
    const { data: existingPicks } = await supabase
      .from('signal_picks')
      .select('id')
      .eq('pick_date', latestDate)
      .eq('signal_type', 'composite')
      .limit(1);

    if (existingPicks && existingPicks.length > 0) {
      return new Response(JSON.stringify({ 
        message: 'Composite picks already exist for today',
        date: latestDate,
        skipped: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate composite scores (same logic as frontend)
    const dataWithScores = snapshotData.map((row: any) => {
      const signals: number[] = [];
      
      if (row.streak_5d_avg_ret !== null && row.streak_trades >= 5) {
        signals.push(row.streak_5d_avg_ret);
      }
      if (row.rsi_5d_avg_ret !== null && row.rsi_trades >= 5) {
        signals.push(row.rsi_5d_avg_ret);
      }
      if (row.seasonal_5d_avg_ret !== null && row.seasonal_trades >= 5) {
        signals.push(row.seasonal_5d_avg_ret);
      }
      
      const composite_5d_score = signals.length >= 2 
        ? signals.reduce((a, b) => a + b, 0) / signals.length 
        : null;

      // Calculate average win rate if we have the data
      const winRates: number[] = [];
      if (row.streak_5d_win_pct !== null && row.streak_trades >= 5) {
        winRates.push(row.streak_5d_win_pct);
      }
      if (row.rsi_5d_win_pct !== null && row.rsi_trades >= 5) {
        winRates.push(row.rsi_5d_win_pct);
      }
      if (row.seasonal_5d_win_pct !== null && row.seasonal_trades >= 5) {
        winRates.push(row.seasonal_5d_win_pct);
      }
      const avg_win_rate = winRates.length >= 2
        ? winRates.reduce((a, b) => a + b, 0) / winRates.length
        : null;

      // Sum trade counts
      const trade_count = (row.streak_trades || 0) + (row.rsi_trades || 0) + (row.seasonal_trades || 0);
      
      return { ...row, composite_5d_score, avg_win_rate, trade_count };
    });

    // Filter to only stocks with valid composite scores
    const validStocks = dataWithScores.filter((r: any) => r.composite_5d_score !== null);

    if (validStocks.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No stocks with valid composite scores',
        date: latestDate,
        skipped: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sort by composite score (descending - best first)
    const sorted = [...validStocks].sort((a: any, b: any) => b.composite_5d_score - a.composite_5d_score);

    // Get top 5 (best outlook) and bottom 5 (worst outlook)
    const bestPicks = sorted.slice(0, 5);
    const worstPicks = sorted.slice(-5).reverse();

    // Get entry prices from stock_data
    const symbols = [...bestPicks, ...worstPicks].map((p: any) => p.symbol);
    const { data: priceData, error: priceError } = await supabase
      .from('stock_data')
      .select('symbol, close')
      .in('symbol', symbols)
      .eq('date', latestDate);

    if (priceError) throw priceError;

    const priceMap: Record<string, number> = {};
    priceData?.forEach((p: any) => {
      priceMap[p.symbol] = p.close;
    });

    // Prepare picks for insertion
    const picks: any[] = [];

    bestPicks.forEach((stock: any, index: number) => {
      if (priceMap[stock.symbol]) {
        picks.push({
          pick_date: latestDate,
          symbol: stock.symbol,
          signal_type: 'composite',
          pick_type: 'best',
          rank: index + 1,
          signal_value: stock.composite_5d_score,
          historical_avg_return: stock.composite_5d_score,
          historical_win_rate: stock.avg_win_rate,
          historical_trade_count: stock.trade_count,
          entry_price: priceMap[stock.symbol],
        });
      }
    });

    worstPicks.forEach((stock: any, index: number) => {
      if (priceMap[stock.symbol]) {
        picks.push({
          pick_date: latestDate,
          symbol: stock.symbol,
          signal_type: 'composite',
          pick_type: 'worst',
          rank: index + 1,
          signal_value: stock.composite_5d_score,
          historical_avg_return: stock.composite_5d_score,
          historical_win_rate: stock.avg_win_rate,
          historical_trade_count: stock.trade_count,
          entry_price: priceMap[stock.symbol],
        });
      }
    });

    // Insert picks
    const { error: insertError } = await supabase
      .from('signal_picks')
      .insert(picks);

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ 
      success: true,
      date: latestDate,
      picks_saved: picks.length,
      best_picks: bestPicks.map((p: any) => ({ 
        symbol: p.symbol, 
        score: (p.composite_5d_score * 100).toFixed(2) + '%' 
      })),
      worst_picks: worstPicks.map((p: any) => ({ 
        symbol: p.symbol, 
        score: (p.composite_5d_score * 100).toFixed(2) + '%' 
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in save-composite-picks:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});