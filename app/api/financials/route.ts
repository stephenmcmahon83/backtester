import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    // 1. SETUP SUPABASE WITH ADMIN KEY (Bypasses RLS Security)
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Must be Service Role Key

    if (!sbUrl || !sbKey) return NextResponse.json({ error: "Config missing" }, { status: 500 });

    const supabase = createClient(sbUrl, sbKey);
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker')?.toUpperCase();

    try {
        // 2. SCENARIO A: NO TICKER? RETURN SYMBOL LIST
        if (!ticker) {
            const { data, error } = await supabase
                .from('financial_cache')
                .select('symbol')
                .order('symbol', { ascending: true });
            
            if (error) throw error;

            // Remove duplicates and return list
            const uniqueSymbols = Array.from(new Set(data.map((r: any) => r.symbol)));
            return NextResponse.json(uniqueSymbols);
        }

        // 3. SCENARIO B: FETCH SPECIFIC DATA
        const { data: cachedData, error } = await supabase
            .from('financial_cache')
            .select('*')
            .eq('symbol', ticker)
            .single();

        if (error || !cachedData) {
            return NextResponse.json({ error: "Symbol not found in database. Please upload it via Admin." }, { status: 404 });
        }

        return NextResponse.json(cachedData.data);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}