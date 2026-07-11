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

// Les navigateurs limitent les minuteurs des onglets inactifs ou en
// arrière-plan, ce qui peut empêcher le rafraîchissement automatique du
// jeton de session de se déclencher à temps (le jeton expire alors
// silencieusement pendant que l'onglet est resté ouvert sans interaction).
// On force donc un rafraîchissement explicite dès que l'onglet redevient
// visible, comme recommandé par la documentation Supabase pour les
// applications 100 % côté client.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}