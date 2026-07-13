// >>> NOUVEAU FICHIER : app/api/forgot-password/route.ts <<<

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── Paramètres de débit ─────────────────────────────────────
const DELAI_MIN_SECONDES = 60;   // délai minimum entre deux demandes pour un même email
const MAX_PAR_24H        = 5;    // nombre maximal de demandes par email sur 24h

// Message volontairement identique que l'email corresponde ou non à un
// compte existant, pour ne jamais laisser deviner quels emails sont
// enregistrés dans la base (évite l'énumération de comptes).
const MESSAGE_GENERIQUE =
  "Si un compte existe avec cette adresse, un e-mail de réinitialisation vient d'être envoyé.";

export async function POST(req: NextRequest) {
  let email: string | undefined;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  const emailNormalise = email.trim().toLowerCase();
  const admin           = supabaseAdmin();
  const maintenant      = new Date();

  // 1. Vérifier le débit à partir des tentatives déjà enregistrées pour cet email
  const { data: tentatives } = await admin
    .from("password_reset_log")
    .select("created_at")
    .eq("email", emailNormalise)
    .order("created_at", { ascending: false })
    .limit(MAX_PAR_24H);

  if (tentatives && tentatives.length > 0) {
    const derniere = new Date(tentatives[0].created_at);
    const ecouleMs = maintenant.getTime() - derniere.getTime();

    // 1a. Anti-spam rapproché : pas plus d'une demande par minute
    if (ecouleMs < DELAI_MIN_SECONDES * 1000) {
      const retryAfter = Math.ceil((DELAI_MIN_SECONDES * 1000 - ecouleMs) / 1000);
      return NextResponse.json(
        { error: "Veuillez patienter avant de renvoyer une demande.", retryAfter },
        { status: 429 }
      );
    }

    // 1b. Plafond journalier
    const dansLes24h = tentatives.filter(
      (t) => maintenant.getTime() - new Date(t.created_at).getTime() < 24 * 60 * 60 * 1000
    );
    if (dansLes24h.length >= MAX_PAR_24H) {
      return NextResponse.json(
        {
          error: "Nombre maximal de demandes atteint pour aujourd'hui. Réessayez demain, ou contactez un administrateur.",
          retryAfter: null,
        },
        { status: 429 }
      );
    }
  }

  // 2. Enregistrer la tentative AVANT l'envoi, pour que le débit soit
  //    respecté même si l'envoi échoue ou si le compte n'existe pas.
  await admin.from("password_reset_log").insert({ email: emailNormalise });

  // 3. Déclencher l'envoi via Supabase. Cet appel ne révèle jamais si le
  //    compte existe : il "réussit" silencieusement dans les deux cas.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  await admin.auth.resetPasswordForEmail(emailNormalise, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  return NextResponse.json({ success: true, message: MESSAGE_GENERIQUE, retryAfter: DELAI_MIN_SECONDES });
}