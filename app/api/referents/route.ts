// >>> Ce fichier REMPLACE : app/api/referents/route.ts <<<

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/* ── POST — Créer un référent ──────────────────────────────── */
export async function POST(req: NextRequest) {
  const { nom, prenom, email, password, couleur } = await req.json();

  if (!nom || !prenom || !email || !password) {
    return NextResponse.json({ error: "Champs obligatoires manquants." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Erreur lors de la création du compte." },
      { status: 400 }
    );
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id:                   authData.user.id,
    nom,
    prenom,
    email,
    role:                 "referent",
    couleur:              couleur ?? "#3b82f6",
    actif:                true,
    must_change_password: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: authData.user.id });
}

/* ── PATCH — Modifier un référent ─────────────────────────── */
export async function PATCH(req: NextRequest) {
  const { id, nom, prenom, email, password, couleur, actif } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID manquant." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // 1. Mettre à jour le profil dans notre table
  const profileUpdate: Record<string, any> = {};
  if (nom    !== undefined) profileUpdate.nom    = nom;
  if (prenom !== undefined) profileUpdate.prenom = prenom;
  if (email  !== undefined) profileUpdate.email  = email;
  if (couleur !== undefined) profileUpdate.couleur = couleur;
  if (actif  !== undefined) profileUpdate.actif  = actif;

  if (Object.keys(profileUpdate).length > 0) {
    const { error: profileError } = await admin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  // 2. Mettre à jour le compte Auth (email et/ou mot de passe)
  const authUpdate: Record<string, any> = {};
  if (email    && email.trim())    authUpdate.email    = email.trim();
  if (password && password.trim()) {
    authUpdate.password           = password.trim();
    // Forcer le changement de mot de passe à la prochaine connexion
    profileUpdate.must_change_password = true;
    await admin.from("profiles").update({ must_change_password: true }).eq("id", id);
  }

  if (Object.keys(authUpdate).length > 0) {
    const { error: authError } = await admin.auth.admin.updateUserById(id, authUpdate);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

/* ── DELETE — Supprimer un référent ───────────────────────── */
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID manquant." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  await admin.from("profiles").delete().eq("id", id);

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}