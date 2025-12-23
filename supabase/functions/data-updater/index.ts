import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const TICKERS_TO_TRACK = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA'];

const getTimestampDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

Deno.serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    for (const ticker of TICKERS_TO_TRACK) {
      console.log(`Processing ticker: ${ticker}`);
      const period1 = getTimestampDaysAgo(100); 
      const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${period1}&period2=${Math.floor(Date.now() / 1000)}&interval=1d&events=history`;
      
      const response = await fetch(yahooUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }});
      if (!response.ok) {
        console.error(`Failed to fetch data for ${ticker}`);
        continue;
      }

      const csvText = await response.text();
      const rows = csvText.split('\n').slice(1);
      
      const dataToInsert = [];
      for (const row of rows) {
        if (!row) continue;
        const [dateStr, open, high, low, close] = row.split(',');
        if (!dateStr || !close || close.toLowerCase() === 'null') continue;

        const date = new Date(dateStr);
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const dayOfYear = Math.ceil((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));

        dataToInsert.push({
          ticker: ticker,
          date: dateStr,
          close: parseFloat(close),
          trading_day_of_year: dayOfYear,
        });
      }

      if (dataToInsert.length > 0) {
        const { error } = await supabaseAdmin
          .from('historical_prices')
          .upsert(dataToInsert, { onConflict: 'ticker,date' }); 
        if (error) console.error(error);
      }
    }

    return new Response(JSON.stringify({ message: "Done" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
});