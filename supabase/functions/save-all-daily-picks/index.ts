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

    const authHeader = {
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    };

    const results: any = {};
    const today = new Date().toISOString().split('T')[0];

    // 1. Run RSI
    try {
      console.log("Triggering RSI...");
      const { data, error } = await supabase.functions.invoke('save-rsi-picks', {
        headers: authHeader, // <--- THIS WAS MISSING
        method: 'POST',
      });
      if (error) throw new Error(error.message);
      results.rsi = data || { success: true };
    } catch (e: any) {
      console.error("RSI Failed:", e);
      results.rsi = { error: e.message };
    }

    // 2. Run Streak
    try {
      console.log("Triggering Streak...");
      const { data, error } = await supabase.functions.invoke('save-streak-picks', {
        headers: authHeader, // <--- THIS WAS MISSING
        method: 'POST',
      });
      if (error) throw new Error(error.message);
      results.streak = data || { success: true };
    } catch (e: any) {
      console.error("Streak Failed:", e);
      results.streak = { error: e.message };
    }

    // 3. Run Seasonal (Skip if you haven't created this function yet)
    try {
      console.log("Triggering Seasonal...");
      const { data, error } = await supabase.functions.invoke('save-seasonal-picks', {
        headers: authHeader,
        method: 'POST',
      });
      // Don't fail the whole batch if this one doesn't exist yet
      if (error) {
        console.warn("Seasonal error (ignoring):", error);
        results.seasonal = { skipped: true, reason: error.message };
      } else {
        results.seasonal = data;
      }
    } catch (e: any) {
      results.seasonal = { error: e.message };
    }

    // 4. Run Composite (Depends on the others being finished)
    try {
      console.log("Triggering Composite...");
      const { data, error } = await supabase.functions.invoke('save-composite-picks', {
        headers: authHeader,
        method: 'POST',
      });
      if (error) {
         console.warn("Composite error (ignoring):", error);
         results.composite = { skipped: true, reason: error.message };
      } else {
         results.composite = data;
      }
    } catch (e: any) {
      results.composite = { error: e.message };
    }

    // 5. Update Exits (for old picks)
    try {
      const { data, error } = await supabase.functions.invoke('update-signal-exits', {
        headers: authHeader,
        method: 'POST',
      });
      results.exits = error ? { error: error.message } : data;
    } catch (e: any) {
      results.exits = { error: e.message };
    }

    return new Response(JSON.stringify({ 
      success: true, 
      date: today,
      results 
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