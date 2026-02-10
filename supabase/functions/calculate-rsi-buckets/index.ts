import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- HELPER FUNCTIONS ---

const calculateRSI = (
  data: { close: number }[], 
  period: number, 
  index: number
): number | null => {
  if (index < period) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = index - period + 1; i <= index; i++) {
    const current = data[i]?.close;
    const previous = data[i - 1]?.close;
    
    if (current === undefined || previous === undefined) return null;
    
    const change = current - previous;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  if (losses === 0) return gains > 0 ? 100 : 50;
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgGain / avgLoss;
  
  return 100 - (100 / (1 + rs));
};

const getBucket = (rsiValue: number): number => {
  if (rsiValue >= 100) return 95;
  if (rsiValue < 0) return 0;
  return Math.floor(rsiValue / 5) * 5;
};

const calculateRollingAvgRsi = (
  history: { close: number }[], 
  avgWindow: number
): (number | null)[] => {
  const n = history.length;
  const dailyRsi: (number | null)[] = [];
  
  // Calculate base RSI first
  for (let i = 0; i < n; i++) {
    dailyRsi.push(calculateRSI(history, 2, i));
  }

  // Calculate rolling average
  const avgRsi: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    if (i < avgWindow - 1) {
      avgRsi.push(null);
      continue;
    }
    
    const windowValues: number[] = [];
    for (let j = 0; j < avgWindow; j++) {
      const val = dailyRsi[i - j];
      if (val !== null) windowValues.push(val);
    }
    
    if (windowValues.length === avgWindow) {
      avgRsi.push(windowValues.reduce((a, b) => a + b, 0) / avgWindow);
    } else {
      avgRsi.push(null);
    }
  }
  return avgRsi;
};

// --- MAIN HANDLER ---

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
    try {
      parsedBody = await req.json();
    } catch {
      // If body is empty, keep empty object
    }
    
    const { ticker, rsiPeriod = '5d' } = parsedBody;
    const avgWindow = rsiPeriod === '10d' ? 10 : 5;
    const forwardDays = [1, 2, 3, 5, 10];

    // --- MODE A: SINGLE TICKER ---
    if (ticker) {
      const { data: history, error: historyError } = await supabaseClient
        .from('stock_data')
        .select('date, open, close')
        .eq('symbol', ticker.toUpperCase())
        .order('date', { ascending: true });

      if (historyError) throw historyError;
      if (!history || history.length < 50) throw new Error("Insufficient data");

      const n = history.length;
      const avgRsi = calculateRollingAvgRsi(history, avgWindow);
      const currentRsiValue = avgRsi[n - 1];
      const currentBucket = currentRsiValue !== null ? getBucket(currentRsiValue) : null;

      // Initialize buckets
      const buckets: Record<number, { sumRet: number[]; wins: number[]; count: number }> = {};
      for (let b = 0; b < 100; b += 5) {
        buckets[b] = { sumRet: [0,0,0,0,0], wins: [0,0,0,0,0], count: 0 };
      }

      // Backtest
      for (let i = avgWindow; i < n - 15; i++) {
        const rsiVal = avgRsi[i];
        if (rsiVal === null) continue;
        const bucket = getBucket(rsiVal);
        const entryPrice = history[i + 1]?.open;
        
        if (!entryPrice) continue;

        forwardDays.forEach((daysForward, idx) => {
          const exitIdx = i + 1 + daysForward;
          if (exitIdx < n) {
            const exitPrice = history[exitIdx]?.close;
            if (exitPrice) {
              const ret = ((exitPrice * 0.9995) - (entryPrice * 1.0005)) / (entryPrice * 1.0005);
              buckets[bucket].sumRet[idx] += ret;
              if (ret > 0) buckets[bucket].wins[idx]++;
            }
          }
        });
        buckets[bucket].count++;
      }

      const rows = Object.keys(buckets).map(k => {
        const bucketLow = Number(k);
        const b = buckets[bucketLow];
        if (b.count === 0) return null;
        
        const row: any = {
          bucket_label: `${bucketLow}-${bucketLow + 5}`,
          bucket_low: bucketLow,
          count: b.count
        };
        forwardDays.forEach((d, idx) => {
          row[`avg_ret_${d}`] = b.count > 0 ? b.sumRet[idx] / b.count : 0;
          row[`win_pct_${d}`] = b.count > 0 ? b.wins[idx] / b.count : 0;
        });
        return row;
      }).filter(Boolean).sort((a: any, b: any) => a.bucket_low - b.bucket_low);

      return new Response(JSON.stringify({ 
        ticker: ticker.toUpperCase(), rsiPeriod, currentBucket, currentRsiValue, rows 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- MODE B: ALL STOCKS SCANNER (BATCHED) ---
    else {
      const { data: symbolsData } = await supabaseClient.from('symbols').select('symbol');
      if (!symbolsData) throw new Error("No symbols found");
      
      const uniqueTickers = symbolsData.map(s => s.symbol);
      const results: any[] = [];
      
      // BATCH PROCESSING: Process 10 stocks at a time to prevent DB Timeout
      const BATCH_SIZE = 10;
      
      for (let i = 0; i < uniqueTickers.length; i += BATCH_SIZE) {
        const batch = uniqueTickers.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (sym) => {
          try {
            // Optimization: Limit to last 200 days for scanner speed
            const { data: history } = await supabaseClient
              .from('stock_data')
              .select('date, open, close')
              .eq('symbol', sym)
              .order('date', { ascending: false })
              .limit(200); 

            if (!history || history.length < 50) return null;
            
            // Re-sort to ascending for calculation
            const histAsc = history.reverse(); 
            const n = histAsc.length;
            
            const avgRsi = calculateRollingAvgRsi(histAsc, avgWindow);
            const currentRsi = avgRsi[n - 1];
            if (currentRsi === null) return null;
            
            const currentBucket = getBucket(currentRsi);

            let count = 0;
            const sumRets = [0, 0, 0, 0, 0];
            const wins = [0, 0, 0, 0, 0];

            for (let j = avgWindow; j < n - 15; j++) {
              const rsiVal = avgRsi[j];
              if (rsiVal === null) continue;
              if (getBucket(rsiVal) !== currentBucket) continue;

              const entryPrice = histAsc[j + 1]?.open;
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

            if (count < 3) return null; // Lowered threshold slightly

            const row: any = {
              symbol: sym,
              current_rsi: currentRsi,
              current_bucket: `${currentBucket}-${currentBucket + 5}`,
              bucket_low: currentBucket,
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

      // Sort by RSI ascending (most oversold first)
      results.sort((a, b) => a.current_rsi - b.current_rsi);

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    console.error("Global Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
});