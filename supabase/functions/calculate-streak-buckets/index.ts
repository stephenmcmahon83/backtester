import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper: Calculate streak for a specific day index
// Returns positive int for winning streak, negative for losing streak
const getStreakAt = (data: { close: number }[], index: number): number => {
  if (index < 1) return 0;
  
  let currentIdx = index;
  let streak = 0;
  
  // Determine direction of the first day
  const today = data[currentIdx].close;
  const yesterday = data[currentIdx - 1].close;
  
  if (today > yesterday) {
    streak = 1;
    // Count backwards how many days were up
    while (currentIdx > 1) {
      currentIdx--;
      if (data[currentIdx].close > data[currentIdx - 1].close) {
        streak++;
      } else {
        break;
      }
    }
  } else if (today < yesterday) {
    streak = -1;
    // Count backwards how many days were down
    while (currentIdx > 1) {
      currentIdx--;
      if (data[currentIdx].close < data[currentIdx - 1].close) {
        streak--;
      } else {
        break;
      }
    }
  }
  
  return streak;
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

    // Robust body parsing
    let parsedBody: any = {};
    try { parsedBody = await req.json(); } catch {}
    
    // We only need ticker if doing single lookups, but mostly we do scanning
    const { ticker } = parsedBody; 
    const forwardDays = [1, 2, 3, 5, 10];

    // --- MODE: SCANNER (Run on all stocks) ---
    const { data: symbolsData } = await supabaseClient.from('symbols').select('symbol');
    if (!symbolsData) throw new Error("No symbols found");
    
    const uniqueTickers = ticker ? [ticker] : symbolsData.map(s => s.symbol);
    const results: any[] = [];
    
    // BATCH PROCESSING: Process 10 stocks at a time to prevent DB Timeout
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < uniqueTickers.length; i += BATCH_SIZE) {
      const batch = uniqueTickers.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (sym) => {
        try {
          // Limit to last 200 days for speed
          const { data: history } = await supabaseClient
            .from('stock_data')
            .select('date, open, close')
            .eq('symbol', sym)
            .order('date', { ascending: false })
            .limit(200);

          if (!history || history.length < 50) return null;
          
          // Re-sort to ascending (Oldest -> Newest)
          const histAsc = history.reverse(); 
          const n = histAsc.length;
          
          // 1. Identify CURRENT Streak
          const currentStreak = getStreakAt(histAsc, n - 1);
          
          // Filter: We only care about significant streaks (>=3 or <=-3)
          if (Math.abs(currentStreak) < 3) return null;

          // 2. Backtest this specific streak value
          let count = 0;
          const sumRets = [0, 0, 0, 0, 0]; // for 1, 2, 3, 5, 10 days
          const wins = [0, 0, 0, 0, 0];

          // Loop through history (excluding today)
          for (let j = 5; j < n - 15; j++) {
             const streakAtJ = getStreakAt(histAsc, j);
             
             // If historical day had SAME streak as today
             if (streakAtJ === currentStreak) {
                const entryPrice = histAsc[j + 1]?.open; // Enter next open
                if (!entryPrice) continue;

                forwardDays.forEach((daysForward, idx) => {
                  const exitIdx = j + 1 + daysForward;
                  if (exitIdx < n) {
                    const exitPrice = histAsc[exitIdx]?.close;
                    if (exitPrice) {
                      const ret = ((exitPrice * 0.9995) - (entryPrice * 1.0005)) / (entryPrice * 1.0005);
                      sumRets[idx] += ret;
                      if (ret > 0) wins[idx]++;
                    }
                  }
                });
                count++;
             }
          }

          if (count < 3) return null; // Need minimum samples

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
        } catch (e) {
          console.error(`Error processing ${sym}:`, e);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(Boolean));
    }

    // Sort: Positive streaks by highest return, Negative streaks by highest return (reversal candidates)
    results.sort((a, b) => b.avg_ret_5 - a.avg_ret_5);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Global Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
});