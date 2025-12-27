import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const reqBody = await req.text();
    const parsedBody = reqBody ? JSON.parse(reqBody) : {};
    const { ticker } = parsedBody;

    // --- HELPER: Calculate Streak Array for a dataset ---
    const calculateStreaks = (prices: any[]) => {
      const streaks = new Array(prices.length).fill(0);
      let current = 0;
      
      for (let i = 1; i < prices.length; i++) {
        const close = prices[i].close;
        const prevClose = prices[i-1].close;

        if (close > prevClose) {
          current = current >= 0 ? current + 1 : 1;
        } else if (close < prevClose) {
          current = current <= 0 ? current - 1 : -1;
        } else {
          current = 0; // Reset on unchanged
        }
        streaks[i] = current;
      }
      return streaks;
    };

    // --- MODE A: SINGLE TICKER DEEP DIVE ---
    if (ticker) {
      const { data: history } = await supabaseClient
        .from('stock_data')
        .select('date, open, close')
        .eq('symbol', ticker)
        .order('date', { ascending: true });

      if (!history || history.length < 100) throw new Error("Insufficient data");

      const streaks = calculateStreaks(history);
      
      // ✅ NEW: Capture the current streak (last day)
      const currentStreak = streaks[streaks.length - 1];

      const buckets: Record<number, { sumRet: number[], wins: number[], count: number }> = {};
      const forwardDays = [1, 2, 3, 5, 10]; 

      // Backtest Logic
      for (let i = 0; i < history.length - 15; i++) {
        const sVal = streaks[i];
        if (sVal === 0) continue; 

        if (!buckets[sVal]) {
          buckets[sVal] = { 
            sumRet: new Array(forwardDays.length).fill(0), 
            wins: new Array(forwardDays.length).fill(0), 
            count: 0 
          };
        }

        const entryPrice = history[i + 1].open; 
        if (!entryPrice) continue;

        forwardDays.forEach((daysForward, idx) => {
          const exitIdx = i + daysForward;
          if (exitIdx < history.length) {
            const exitPrice = history[exitIdx].close;
            // 0.10% Commission
            const ret = ((exitPrice * 0.9995) - (entryPrice * 1.0005)) / (entryPrice * 1.0005);
            
            buckets[sVal].sumRet[idx] += ret;
            if (ret > 0) buckets[sVal].wins[idx]++;
          }
        });
        buckets[sVal].count++;
      }

      const result = Object.keys(buckets).map(k => {
        const val = Number(k);
        const b = buckets[val];
        const row: any = { streak_val: val, count: b.count };
        
        forwardDays.forEach((d, idx) => {
            row[`avg_ret_${d}`] = b.sumRet[idx] / b.count;
            row[`win_pct_${d}`] = b.wins[idx] / b.count;
        });
        return row;
      });

      return new Response(JSON.stringify({ 
        ticker, 
        currentStreak, // ✅ Sending this to frontend
        rows: result.sort((a,b) => a.streak_val - b.streak_val) 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- MODE B: ALL STOCKS SCANNER ---
    else {
      const { data: symbolsData } = await supabaseClient.from('symbols').select('symbol');
      if (!symbolsData) throw new Error("No symbols found");
      const uniqueTickers = symbolsData.map(s => s.symbol);

      const scannerResults = await Promise.all(
        uniqueTickers.map(async (sym) => {
          const { data: history } = await supabaseClient
            .from('stock_data')
            .select('date, open, close')
            .eq('symbol', sym)
            .order('date', { ascending: true });

          if (!history || history.length < 50) return null;

          const streaks = calculateStreaks(history);
          const currentStreak = streaks[streaks.length - 1];
          if (currentStreak === 0) return null;

          const forwardDays = [1, 2, 3, 5, 10];
          let count = 0;
          const sumRets = new Array(forwardDays.length).fill(0);
          const wins = new Array(forwardDays.length).fill(0);

          for (let i = 0; i < history.length - 15; i++) {
             if (streaks[i] === currentStreak) {
                const entryPrice = history[i + 1].open; 
                if (!entryPrice) continue;

                forwardDays.forEach((daysForward, idx) => {
                    const exitIdx = i + daysForward; 
                    if (exitIdx < history.length) {
                        const exitPrice = history[exitIdx].close;
                        const ret = ((exitPrice * 0.9995) - (entryPrice * 1.0005)) / (entryPrice * 1.0005);
                        sumRets[idx] += ret;
                        if (ret > 0) wins[idx]++;
                    }
                });
                count++;
             }
          }

          if (count < 3) return null; 

          const row: any = {
            symbol: sym,
            current_streak: currentStreak,
            occurrence_count: count
          };

          forwardDays.forEach((d, idx) => {
            row[`avg_ret_${d}`] = sumRets[idx] / count;
            row[`win_pct_${d}`] = wins[idx] / count;
          });

          return row;
        })
      );

      const validResults = scannerResults.filter(r => r !== null);

      return new Response(JSON.stringify(validResults), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})