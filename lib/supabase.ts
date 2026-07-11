// lib/supabase.ts
// Point d'entrée unique pour toutes les connexions à Supabase (app 100 % côté client).

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession:     true,   // garde la session (localStorage)
    autoRefreshToken:   true,   // renouvelle le jeton avant expiration
    detectSessionInUrl: true,
    storageKey:         "phare-auth",
  },
});