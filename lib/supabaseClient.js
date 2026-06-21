import { createClient } from "@supabase/supabase-js";

// Browser singleton. The anon (publishable) key is safe to expose client-side —
// RLS is the gate. Env vars take precedence; the committed fallbacks keep the
// build/prerender from throwing when env isn't configured (e.g. Vercel before
// NEXT_PUBLIC_* are set). See .env.local / .env.local.example.
const FALLBACK_URL = "https://kzzlfubehktzsuxutwmd.supabase.co";
const FALLBACK_ANON_KEY = "sb_publishable__QTxyuyRIZkQBtz_FCyUjw_5dUOeE2b";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

if (!url || !anonKey) {
  // Surfaced in the browser console rather than crashing render.
  console.error(
    "Missing Supabase config: NEXT_PUBLIC_SUPABASE_URL / " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY are unset and no fallback is available."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
