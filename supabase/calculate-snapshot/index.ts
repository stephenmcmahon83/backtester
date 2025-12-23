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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. DETERMINE NEXT TRADING DAY
    const { data: latestDayData, error: dayError } = await supabaseClient
      .from('stock_data')
      .select('trading_day_of_year')
      .eq('symbol', 'SPY')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (dayError) throw new Error("Could not determine current trading day")
    
    let targetDay = (latestDayData.trading_day_of_year || 1) + 1;
    if (targetDay > 252) targetDay = 1;

    // 2. GET SYMBOLS
    const { data: symbolsData } = await supabaseClient
      .from('symbols')
      .select('symbol')
    
    if (!symbolsData) throw new Error("No symbols found");
    const uniqueTickers = symbolsData.map(s => s.symbol);

    // 3. CALCULATE STATS FOR ALL TICKERS
    const snapshotResults = await Promise.all(
      uniqueTickers.map(async (ticker) => {
        // Fetch simplified history (we only need close price and day index)
        const { data: history } = await supabaseClient
            .from('stock_data')
            .select('close, trading_day_of_year')
            .eq('symbol', ticker)
            .order('date', { ascending: true })

        // Need at least 30 days of history for -10 trailing and +20 forward looks
        if (!history || history.length < 30) return null;

        // Find every time 'targetDay' happened in history
        const instances = []
        // Start loop at 10 to ensure we have trailing data available for any instance we find
        for(let i = 10; i < history.length - 20; i++) {
            if(history[i].trading_day_of_year === targetDay) {
                instances.push(i);
            }
        }

        if (instances.length === 0) return null;

        const result: any = {
            ticker: ticker,
            target_day: targetDay,
            years_of_data: instances.length,
        };

        // --- NEW: Calculate Trailing Returns ---
        let sumTrailingRet1 = 0;
        let sumTrailingRet5 = 0;
        let sumTrailingRet10 = 0;
        
        instances.forEach((idx) => {
            sumTrailingRet1 += (history[idx].close - history[idx - 1].close) / history[idx - 1].close;
            sumTrailingRet5 += (history[idx].close - history[idx - 5].close) / history[idx - 5].close;
            sumTrailingRet10 += (history[idx].close - history[idx - 10].close) / history[idx - 10].close;
        });
        
        result.avg_trailing_ret_1 = sumTrailingRet1 / instances.length;
        result.avg_trailing_ret_5 = sumTrailingRet5 / instances.length;
        result.avg_trailing_ret_10 = sumTrailingRet10 / instances.length;

        // --- Calculate Forward Returns ---
        for (let day = 1; day <= 20; day++) {
            let sumRet = 0;
            let wins = 0;
            
            instances.forEach((idx) => {
                const start = history[idx].close;
                const end = history[idx + day].close;
                
                // FIXED: 0.10% round-trip commission (0.05% on buy, 0.05% on sell)
                const ret = ((end * 0.9995) - (start * 1.0005)) / (start * 1.0005);
                
                sumRet += ret;
                if (ret > 0) wins++;
            });

            result[`avg_ret_${day}`] = sumRet / instances.length;
            result[`win_pct_${day}`] = wins / instances.length;
        }

        return result;
      })
    );

    const validResults = snapshotResults.filter(r => r !== null);

    return new Response(JSON.stringify(validResults), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})