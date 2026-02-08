import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ==================== HELPER FUNCTIONS ====================

const calculateRSI = (data: { close: number }[], period: number, index: number): number | null => {
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

const calculateStreaks = (prices: { close: number }[]): number[] => {
  const streaks = new Array(prices.length).fill(0);
  let current = 0;
  
  for (let i = 1; i < prices.length; i++) {
    const close = prices[i].close;
    const prevClose = prices[i - 1].close;

    if (close > prevClose) {
      current = current >= 0 ? current + 1 : 1;
    } else if (close < prevClose) {
      current = current <= 0 ? current - 1 : -1;
    } else {
      current = 0;
    }
    streaks[i] = current;
  }
  return streaks;
};

const getRsiBucket = (rsiValue: number): number => {
  if (rsiValue >= 100) return 95;
  if (rsiValue < 0) return 0;
  return Math.floor(rsiValue / 5) * 5;
};

const calculateRollingAvgRsi = (dailyRsi: (number | null)[], avgWindow: number, endIndex: number): number | null => {
  const windowValues: number[] = [];
  for (let j = 0; j < avgWindow; j++) {
    const idx = endIndex - j;
    if (idx < 0) return null;
    const val = dailyRsi[idx];
    if (val !== null) windowValues.push(val);
  }
  if (windowValues.length < avgWindow) return null;
  return windowValues.reduce((a, b) => a + b, 0) / avgWindow;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // Use service role for RPC
    );

    // Get symbols
    const { data: symbolsData, error: symbolsError } = await supabase.from('symbols').select('symbol');
    if (symbolsError) throw symbolsError;
    const symbols = symbolsData.map(s => s.symbol);

    // ==================== GET SEASONALITY FROM YOUR EXISTING FUNCTION ====================
    // This calls your existing calculate-snapshot logic which we KNOW works
    
    // 1. Determine next trading day (same as your calculate-snapshot)
    const { data: latestDayData } = await supabase
      .from('stock_data')
      .select('trading_day_of_year')
      .eq('symbol', 'SPY')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    let targetTradingDay = (latestDayData?.trading_day_of_year || 1) + 1;
    if (targetTradingDay > 252) targetTradingDay = 1;

    console.log(`Target trading day: ${targetTradingDay}`);

    // Process each symbol
    const snapshotPromises = symbols.map(async (symbol) => {
      try {
        // Fetch FULL history - same as your calculate-snapshot
        const { data: history, error } = await supabase
          .from('stock_data')
          .select('date, open, close, trading_day_of_year')
          .eq('symbol', symbol)
          .order('date', { ascending: true });

        if (error || !history || history.length < 252) return null;
        
        const n = history.length;
        const latest = history[n - 1];
        const close = latest.close;

        // ==================== TREND METRICS ====================
        const close100d = n >= 100 ? history[n - 100]?.close : null;
        const close200d = n >= 200 ? history[n - 200]?.close : null;
        const recent200 = history.slice(Math.max(0, n - 200));
        
        const sma200 = recent200.reduce((sum, day) => sum + day.close, 0) / recent200.length;
        const high26w = Math.max(...history.slice(Math.max(0, n - 126)).map(d => d.close));
        const high52w = Math.max(...history.slice(Math.max(0, n - 252)).map(d => d.close));
        
        // ==================== RSI VALUES ====================
        const dailyRsi: (number | null)[] = [];
        for (let i = 0; i < n; i++) {
          dailyRsi.push(calculateRSI(history, 2, i));
        }
        
        const avg_rsi_2_5d = calculateRollingAvgRsi(dailyRsi, 5, n - 1);
        const avg_rsi_2_10d = calculateRollingAvgRsi(dailyRsi, 10, n - 1);

        // ==================== STREAK ====================
        const streaks = calculateStreaks(history);
        const current_streak = streaks[n - 1];

        let streak_5d_sum = 0, streak_5d_wins = 0, streak_trades = 0;
        
        if (current_streak !== 0) {
          for (let i = 0; i < n - 15; i++) {
            if (streaks[i] === current_streak) {
              const entryPrice = history[i + 1]?.open;
              if (!entryPrice) continue;
              
              const exitIdx = i + 1 + 5;
              if (exitIdx < n) {
                const exitPrice = history[exitIdx]?.close;
                if (exitPrice) {
                  const ret = ((exitPrice * 0.9995) - (entryPrice * 1.0005)) / (entryPrice * 1.0005);
                  streak_5d_sum += ret;
                  if (ret > 0) streak_5d_wins++;
                  streak_trades++;
                }
              }
            }
          }
        }

        // ==================== RSI BUCKET ====================
        const current_rsi_bucket = avg_rsi_2_10d !== null ? getRsiBucket(avg_rsi_2_10d) : null;
        
        let rsi_5d_sum = 0, rsi_5d_wins = 0, rsi_trades = 0;
        
        if (current_rsi_bucket !== null) {
          for (let i = 10; i < n - 15; i++) {
            const rsiAtI = calculateRollingAvgRsi(dailyRsi, 10, i);
            if (rsiAtI !== null) {
              const bucketAtI = getRsiBucket(rsiAtI);
              if (bucketAtI === current_rsi_bucket) {
                const entryPrice = history[i + 1]?.open;
                if (!entryPrice) continue;
                
                const exitIdx = i + 1 + 5;
                if (exitIdx < n) {
                  const exitPrice = history[exitIdx]?.close;
                  if (exitPrice) {
                    const ret = ((exitPrice * 0.9995) - (entryPrice * 1.0005)) / (entryPrice * 1.0005);
                    rsi_5d_sum += ret;
                    if (ret > 0) rsi_5d_wins++;
                    rsi_trades++;
                  }
                }
              }
            }
          }
        }

        // ==================== SEASONALITY (EXACT COPY OF YOUR calculate-snapshot) ====================
        // Find ALL instances of this trading day across ALL years
        const instances: number[] = [];
        for (let i = 10; i < n - 20; i++) {
          if (history[i].trading_day_of_year === targetTradingDay) {
            instances.push(i);
          }
        }

        // Debug log for first symbol
        if (symbol === 'SPY') {
          console.log(`SPY: Found ${instances.length} instances of trading day ${targetTradingDay}`);
          console.log(`SPY: Total history length: ${n}`);
          console.log(`SPY: Sample trading_day_of_year values:`, 
            history.slice(0, 5).map(h => h.trading_day_of_year),
            '...',
            history.slice(-5).map(h => h.trading_day_of_year)
          );
        }

        const seasonal_trades = instances.length;
        let seasonal_5d_sum = 0, seasonal_5d_wins = 0;

        // EXACT same logic as your calculate-snapshot
        instances.forEach((idx) => {
          const startPrice = history[idx].close;
          const endPrice = history[idx + 5]?.close;
          
          if (startPrice && endPrice) {
            const grossReturn = (endPrice - startPrice) / startPrice;
            const netReturn = grossReturn - 0.001; // Same 0.10% commission
            seasonal_5d_sum += netReturn;
            if (netReturn > 0) seasonal_5d_wins++;
          }
        });

        // Calculate years of data
        const firstYear = new Date(history[0].date).getFullYear();
        const lastYear = new Date(history[n - 1].date).getFullYear();
        const years_of_data = lastYear - firstYear;

        return {
          symbol,
          
          // Trend
          c_vs_c200: close200d !== null && close > close200d ? 'bull' : 'bear',
          c_vs_c100: close100d !== null && close > close100d ? 'bull' : 'bear',
          p_vs_sma200: close > sma200 ? 'bull' : 'bear',
          pct_off_26w_high: high26w ? (close - high26w) / high26w : 0,
          pct_off_52w_high: high52w ? (close - high52w) / high52w : 0,
          
          // RSI
          avg_rsi_2_5d,
          avg_rsi_2_10d,
          
          // Streak
          current_streak,
          streak_5d_avg_ret: streak_trades > 0 ? streak_5d_sum / streak_trades : null,
          streak_5d_win_pct: streak_trades > 0 ? streak_5d_wins / streak_trades : null,
          streak_trades,
          
          // RSI Bucket
          current_rsi_bucket,
          rsi_5d_avg_ret: rsi_trades > 0 ? rsi_5d_sum / rsi_trades : null,
          rsi_5d_win_pct: rsi_trades > 0 ? rsi_5d_wins / rsi_trades : null,
          rsi_trades,
          
          // Seasonality
          current_trading_day: targetTradingDay,
          seasonal_5d_avg_ret: seasonal_trades > 0 ? seasonal_5d_sum / seasonal_trades : null,
          seasonal_5d_win_pct: seasonal_trades > 0 ? seasonal_5d_wins / seasonal_trades : null,
          seasonal_trades,
          years_of_data,
        };
      } catch (innerError) {
        console.error(`Error processing symbol ${symbol}:`, innerError);
        return null;
      }
    });

    const results = await Promise.all(snapshotPromises);
    const snapshotData = results.filter(Boolean);

    // Log summary for debugging
    const spyData = snapshotData.find(s => s?.symbol === 'SPY');
    if (spyData) {
      console.log('SPY Seasonal Result:', {
        current_trading_day: spyData.current_trading_day,
        seasonal_trades: spyData.seasonal_trades,
        seasonal_5d_avg_ret: spyData.seasonal_5d_avg_ret,
        seasonal_5d_win_pct: spyData.seasonal_5d_win_pct,
        years_of_data: spyData.years_of_data,
      });
    }

    const { data: latestDateData } = await supabase
      .from('stock_data')
      .select('date')
      .eq('symbol', 'SPY')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestDate = latestDateData?.date || new Date().toISOString().split('T')[0];

    return new Response(JSON.stringify({ snapshotData, latestDate, targetTradingDay }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Main error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});