import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log("Starting Seasonal Saver...");

    // 1. Get Latest Market Date (for the record)
    const { data: latestData } = await supabase
      .from('stock_data')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);
    
    const marketDate = latestData?.[0]?.date;
    if (!marketDate) throw new Error("Could not determine market date");

    // 2. Check for Duplicates
    const { data: existing } = await supabase
      .from('signal_picks')
      .select('id')
      .eq('pick_date', marketDate)
      .eq('signal_type', 'seasonal')
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ success: true, message: "Already ran today" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Call your EXISTING calculation function
    // We use the Service Key to authorize the internal call
    console.log("Calling calculate-snapshot...");
    const { data: snapshotData, error: snapError } = await supabase.functions.invoke('calculate-snapshot', {
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      }
    });

    if (snapError) throw new Error(`Snapshot calc failed: ${snapError.message}`);
    if (!snapshotData || !Array.isArray(snapshotData)) throw new Error("Invalid snapshot data returned");

    console.log(`Received ${snapshotData.length} rows from snapshot.`);

    // 4. Get Open Positions (to exclude from buying again)
    const { data: openPositions } = await supabase
      .from('signal_picks')
      .select('symbol')
      .is('exit_price', null);
    
    const heldSymbols = new Set((openPositions || []).map((p: any) => p.symbol));

    // 5. Filter & Score
    // We focus on the 5-Day Outlook (avg_ret_5) since the tracker holds for 5 days
    const scoredStocks = snapshotData
      .filter((s: any) => 
        !heldSymbols.has(s.ticker) && // Don't buy if we hold it
        s.avg_ret_5 !== undefined && 
        s.win_pct_5 !== undefined
      )
      .map((s: any) => ({
        symbol: s.ticker,
        // SCORE = Avg Return * Win Rate (Higher is better)
        // Multiplied by 100 for readability (e.g., 1.5 score)
        score: (s.avg_ret_5 * s.win_pct_5) * 100, 
        avgRet: s.avg_ret_5,
        winRate: s.win_pct_5,
        years: s.years_of_data
      }));

    // Sort High to Low
    scoredStocks.sort((a: any, b: any) => b.score - a.score);

    const best5 = scoredStocks.slice(0, 5);
    const worst5 = scoredStocks.slice(-5).reverse();

    // 6. Fetch CURRENT PRICES for these 10 stocks
    // The snapshot might not have the exact latest 'close' price ready for entry
    const targets = [...best5, ...worst5];
    const targetSymbols = targets.map(t => t.symbol);

    const { data: currentPrices } = await supabase
      .from('stock_data')
      .select('symbol, close')
      .in('symbol', targetSymbols)
      .eq('date', marketDate); // Ensure we get the price for the specific date

    const priceMap: Record<string, number> = {};
    currentPrices?.forEach((p: any) => priceMap[p.symbol] = p.close);

    // 7. Prepare & Save
    const picks: any[] = [];

    const formatPick = (stock: any, type: 'best' | 'worst', rank: number) => {
      // If we couldn't find a price (e.g., data delay), skip it to be safe
      if (!priceMap[stock.symbol]) return null;

      return {
        pick_date: marketDate,
        symbol: stock.symbol,
        signal_type: 'seasonal',
        pick_type: type,
        rank: rank,
        signal_value: stock.score, // This will show as the % in the tracker
        entry_price: priceMap[stock.symbol],
        historical_avg_return: stock.avgRet,
        historical_win_rate: stock.winRate,
        historical_trade_count: stock.years // Using years as "count" proxy
      };
    };

    best5.forEach((s: any, i: number) => {
      const p = formatPick(s, 'best', i + 1);
      if (p) picks.push(p);
    });

    worst5.forEach((s: any, i: number) => {
      const p = formatPick(s, 'worst', i + 1);
      if (p) picks.push(p);
    });

    if (picks.length > 0) {
      const { error } = await supabase.from('signal_picks').insert(picks);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      picks_saved: picks.length,
      top: best5.map(s => s.symbol)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Seasonal Save Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});