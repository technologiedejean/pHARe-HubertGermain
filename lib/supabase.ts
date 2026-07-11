// lib/supabase.ts
// Point d'entrée unique pour toutes les connexions à Supabase.
// Importe { supabase } dans n'importe quel fichier pour interroger la base.

import { createBrowserClient } from "@supabase/ssr";

// Ces deux variables viennent de ton fichier .env.local
// Elles sont injectées automatiquement par Next.js au démarrage.
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client utilisable dans les composants React ("use client")
// et dans les Server Components Next.js.
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);