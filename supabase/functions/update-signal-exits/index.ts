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

    // Get all picks that need exit prices
    // Look for picks that are at least 7 calendar days old (to ensure 5 trading days have passed)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: openPicks, error: pickError } = await supabase
      .from('signal_picks')
      .select('*')
      .is('exit_price', null)
      .lt('pick_date', sevenDaysAgo.toISOString().split('T')[0]);

    if (pickError) throw pickError;
    
    if (!openPicks || openPicks.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No picks to update',
        checked: 0,
        updated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updates: any[] = [];
    const errors: any[] = [];

    for (const pick of openPicks) {
      try {
        // Get prices after pick_date
        const { data: futurePrices, error: priceError } = await supabase
          .from('stock_data')
          .select('date, close')
          .eq('symbol', pick.symbol)
          .gt('date', pick.pick_date)
          .order('date', { ascending: true })
          .limit(10); // Get more than 5 just in case

        if (priceError) {
          errors.push({ pick_id: pick.id, symbol: pick.symbol, error: priceError.message });
          continue;
        }

        if (!futurePrices || futurePrices.length < 5) {
          // Not enough trading days yet
          continue;
        }

        // Get the 5th trading day's close (index 4 since 0-indexed)
        const exitData = futurePrices[4];
        const exitPrice = exitData.close;
        const exitDate = exitData.date;

        // Calculate return
        const actualReturn = (exitPrice - pick.entry_price) / pick.entry_price;
        const isWinner = actualReturn > 0;

        updates.push({
          id: pick.id,
          symbol: pick.symbol,
          signal_type: pick.signal_type,
          pick_type: pick.pick_type,
          exit_date: exitDate,
          exit_price: exitPrice,
          actual_return: actualReturn,
          is_winner: isWinner,
        });

      } catch (e: any) {
        errors.push({ pick_id: pick.id, symbol: pick.symbol, error: e.message });
      }
    }

    // Apply updates
    let successCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('signal_picks')
        .update({
          exit_date: update.exit_date,
          exit_price: update.exit_price,
          actual_return: update.actual_return,
          is_winner: update.is_winner,
        })
        .eq('id', update.id);

      if (updateError) {
        errors.push({ pick_id: update.id, symbol: update.symbol, error: updateError.message });
      } else {
        successCount++;
      }
    }

    // Summary by signal type
    const updatesByType = updates.reduce((acc, u) => {
      const key = u.signal_type;
      if (!acc[key]) acc[key] = { total: 0, winners: 0 };
      acc[key].total++;
      if (u.is_winner) acc[key].winners++;
      return acc;
    }, {} as Record<string, { total: number; winners: number }>);

    return new Response(JSON.stringify({ 
      success: true,
      picks_checked: openPicks.length,
      picks_updated: successCount,
      updates_by_type: updatesByType,
      sample_updates: updates.slice(0, 5).map(u => ({
        symbol: u.symbol,
        signal_type: u.signal_type,
        pick_type: u.pick_type,
        return: (u.actual_return * 100).toFixed(2) + '%',
        is_winner: u.is_winner
      })),
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-signal-exits:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});