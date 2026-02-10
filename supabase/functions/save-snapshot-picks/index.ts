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

    // 1. Get the Market Snapshot Data
    // We use the Service Key to ensure we have permission to call it
    console.log("Fetching market snapshot...");
    const { data: snapshotData, error: snapshotError } = await supabase.functions.invoke('market-snapshot', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      }
    });

    if (snapshotError) throw new Error(`Snapshot function failed: ${snapshotError.message}`);
    
    // Handle different response structures (sometimes it's { data: [...] } or just [...])
    const stocks = Array.isArray(snapshotData) ? snapshotData : (snapshotData.data || []);
    
    if (stocks.length === 0) throw new Error("Snapshot returned no stocks");

    console.log(`Received ${stocks.length} stocks from snapshot.`);

    // 2. Identify the "Score" column
    // We look for 'composite_score', 'score_5d', or similar. 
    // Adjust this if your column is named differently!
    const validStocks = stocks.filter((s: any) => 
      s.composite_score !== undefined && 
      s.composite_score !== null &&
      s.close !== undefined // We need price for entry
    );

    if (validStocks.length === 0) throw new Error("No stocks found with a valid composite_score");

    // 3. Sort by Score (High to Low)
    validStocks.sort((a: any, b: any) => b.composite_score - a.composite_score);

    // 4. Pick Top 5 and Bottom 5
    const best5 = validStocks.slice(0, 5);
    const worst5 = validStocks.slice(-5).reverse(); // Reverse so worst is #1 rank

    // 5. Check for duplicates (if we already ran today)
    const { data: existing } = await supabase
      .from('signal_picks')
      .select('id')
      .eq('pick_date', today)
      .eq('signal_type', 'composite');

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ message: "Picks already saved for today", success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Prepare Data for Insert
    const picks: any[] = [];

    const formatPick = (stock: any, type: 'best' | 'worst', rank: number) => ({
      pick_date: today,
      symbol: stock.symbol,
      signal_type: 'composite', // We call this 'composite' for your frontend
      pick_type: type,
      rank: rank,
      signal_value: stock.composite_score,
      entry_price: stock.close, // Uses the price from the snapshot
      
      // Optional: Save other stats if available in snapshot, else 0
      historical_avg_return: stock.avg_return || 0,
      historical_win_rate: stock.win_rate || 0,
      historical_trade_count: stock.trades || 0,
    });

    best5.forEach((s: any, i: number) => picks.push(formatPick(s, 'best', i + 1)));
    worst5.forEach((s: any, i: number) => picks.push(formatPick(s, 'worst', i + 1)));

    // 7. Insert
    const { error: insertError } = await supabase.from('signal_picks').insert(picks);
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ 
      success: true, 
      picks_saved: picks.length,
      top_pick: best5[0].symbol,
      bottom_pick: worst5[0].symbol
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error in save-snapshot-picks:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});