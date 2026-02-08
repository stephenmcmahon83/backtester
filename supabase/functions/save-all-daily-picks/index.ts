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

    const results: Record<string, any> = {};

    // 1. Save RSI Picks
    try {
      const { data: rsiResult, error: rsiError } = await supabase.functions.invoke('save-rsi-picks');
      results.rsi = rsiError ? { error: rsiError.message } : rsiResult;
    } catch (e: any) {
      results.rsi = { error: e.message };
    }

    // 2. Save Streak Picks
    try {
      const { data: streakResult, error: streakError } = await supabase.functions.invoke('save-streak-picks');
      results.streak = streakError ? { error: streakError.message } : streakResult;
    } catch (e: any) {
      results.streak = { error: e.message };
    }

    // 3. Save Seasonal Picks
    try {
      const { data: seasonalResult, error: seasonalError } = await supabase.functions.invoke('save-seasonal-picks');
      results.seasonal = seasonalError ? { error: seasonalError.message } : seasonalResult;
    } catch (e: any) {
      results.seasonal = { error: e.message };
    }

    // 4. Save Composite Picks (Market Snapshot top/bottom 5)
    try {
      const { data: compositeResult, error: compositeError } = await supabase.functions.invoke('save-composite-picks');
      results.composite = compositeError ? { error: compositeError.message } : compositeResult;
    } catch (e: any) {
      results.composite = { error: e.message };
    }

    // 5. Update exits for any ready positions
    try {
      const { data: exitResult, error: exitError } = await supabase.functions.invoke('update-signal-exits');
      results.exits = exitError ? { error: exitError.message } : exitResult;
    } catch (e: any) {
      results.exits = { error: e.message };
    }

    const today = new Date().toISOString().split('T')[0];
    const allSuccessful = !results.rsi?.error && 
                          !results.streak?.error && 
                          !results.seasonal?.error && 
                          !results.composite?.error;

    return new Response(JSON.stringify({ 
      success: allSuccessful,
      date: today,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in save-all-daily-picks:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});