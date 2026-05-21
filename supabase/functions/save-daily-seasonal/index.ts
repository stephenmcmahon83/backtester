import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log("Initializing Plural 10-Day Rolling Seasonal System...");

    // 1. Get Latest Market Date
    const { data: latestData } = await supabase
      .from('stock_data')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);
    
    const marketDate = latestData?.[0]?.date;
    if (!marketDate) throw new Error("Could not determine current market trading date");

    // 2. Fetch data from your working calculation engine
    const { data: snapshotData, error: snapError } = await supabase.functions.invoke('calculate-snapshot', {
      headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` }
    });

    if (snapError) throw new Error(`Snapshot fetch extraction failed: ${snapError.message}`);
    if (!snapshotData || !Array.isArray(snapshotData)) throw new Error("Invalid snapshot data formatting returned");

    // 3. Get Open Positions to check current allocation states
    const { data: openPositions } = await supabase
      .from('signal_picks')
      .select('symbol, pick_date')
      .eq('signal_type', 'seasonal')
      .is('exit_price', null);

    const heldSymbols = new Set((openPositions || []).map((p: any) => p.symbol));

    // 4. Calculate Scores based on 10-Day Horizon Target Parameters
    const scoredStocks = snapshotData
      .filter((s: any) => 
        !heldSymbols.has(s.ticker) && 
        s.avg_ret_10 !== undefined && 
        s.win_pct_10 !== undefined
      )
      .map((s: any) => ({
        symbol: s.ticker,
        // Score calculated on 10-day look-ahead consistency metrics
        score: (s.avg_ret_10 * s.win_pct_10) * 100, 
        avgRet: s.avg_ret_10,
        winRate: s.win_pct_10,
        years: s.years_of_data
      }));

    // Sort Descending - Best alpha options first
    scoredStocks.sort((a: any, b: any) => b.score - a.score);

    // Mandate: Top 2 alpha generators on a 10-Day Horizon
    const targetPicks = scoredStocks.slice(0, 2);

    if (targetPicks.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Portfolio allocation metrics are full. No open slots available." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Query execution pricing maps matching your data table structures
    const targetSymbols = targetPicks.map(t => t.symbol);
    const { data: currentPrices } = await supabase
      .from('stock_data')
      .select('symbol, close')
      .in('symbol', targetSymbols)
      .eq('date', marketDate);

    const priceMap: Record<string, number> = {};
    currentPrices?.forEach((p: any) => priceMap[p.symbol] = p.close);

    // 6. Build the structural payload
    const picks: any[] = [];
    targetPicks.forEach((stock: any, i: number) => {
      if (!priceMap[stock.symbol]) return;
      picks.push({
        pick_date: marketDate,
        symbol: stock.symbol,
        signal_type: 'seasonal',
        pick_type: 'best',
        rank: i + 1,
        signal_value: stock.score, 
        entry_price: priceMap[stock.symbol],
        historical_avg_return: stock.avgRet,
        historical_win_rate: stock.winRate,
        historical_trade_count: stock.years
      });
    });

    if (picks.length > 0) {
      const { error: insertError } = await supabase.from('signal_picks').insert(picks);
      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      picks_saved: picks.length, 
      allocated: targetSymbols 
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