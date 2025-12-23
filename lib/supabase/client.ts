// FILE: lib/supabase/client.ts
"use client";

import { createBrowserClient } from '@supabase/ssr';

// This function creates a new Supabase client for use in Client Components.
// It's a function so that a new instance is created for each request context if needed,
// ensuring cookie management is handled correctly.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}