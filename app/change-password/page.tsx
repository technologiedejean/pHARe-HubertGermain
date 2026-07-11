// >>> NOUVEAU FICHIER : app/change-password/page.tsx <<<
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Règles du mot de passe (identiques à la politique Supabase)
   ============================================================ */
const RULES = [
  { label: "12 caractères minimum",       test: (p: string) => p.length >= 12 },
  { label: "Une majuscule",                test: (p: string) => /[A-Z]/.test(p) },
  { label: "Une minuscule",                test: (p: string) => /[a-z]/.test(p) },
  { label: "Un chiffre",                   test: (p: string) => /[0-9]/.test(p) },
  { label: "Un caractère spécial",         test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function isValid(p: string) {
  return RULES.every((r) => r.test(p));
}

/* ============================================================
   Emblème
   ============================================================ */
function BeaconMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="6" fill="#F3C77B" />
      <path d="M20 20 L40 11 L40 29 Z" fill="#F3C77B" fillOpacity="0.35" />
      <path d="M20 20 L0 11 L0 29 Z" fill="#F3C77B" fillOpacity="0.15" />
    </svg>
  );
}

/* ============================================================
   Indicateur de règles (partagé mobile + PC)
   ============================================================ */
function RulesChecklist({ password, onDark = false }: { password: string; onDark?: boolean }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.label} className="flex items-center gap-2 text-sm">
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
              ok
                ? "bg-emerald-500 text-white"
                : onDark
                  ? "bg-white/20 text-white/50"
                  : "bg-[#E7E6EF] text-[#9A97AD]"
            }`}>
              {ok ? "✓" : "·"}
            </span>
            <span className={`transition-colors ${
              ok
                ? onDark ? "text-emerald-300" : "text-emerald-700"
                : onDark ? "text-white/60" : "text-[#6C6A80]"
            }`}>
              {rule.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ============================================================
   Formulaire partagé
   ============================================================ */
function ChangePasswordForm({ idPrefix, onDark = false }: { idPrefix: string; onDark?: boolean }) {
  const router = useRouter();
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  const passwordsMatch = password === confirm && confirm.length > 0;
  const canSubmit = isValid(password) && passwordsMatch && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    // ── 1. Mettre à jour le mot de passe via Supabase Auth ──
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Impossible de mettre à jour le mot de passe. Réessayez.");
      setLoading(false);
      return;
    }

    // ── 2. Passer must_change_password à false dans profiles ──
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.id);
    }

    setSuccess(true);
    setLoading(false);

    // Redirection vers le tableau de bord après 1,5 s
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  const inputBase =
    "mt-1.5 w-full rounded-xl border px-4 py-3 outline-none transition " +
    "focus:ring-4 placeholder:text-[#B4B1C4] ";

  const inputStyle = onDark
    ? inputBase + "border-white/20 bg-white/10 text-white placeholder:text-white/40 " +
      "focus:border-[#F3C77B] focus:ring-[#F3C77B]/20 focus:bg-white/15"
    : inputBase + "border-[#E7E6EF] bg-white text-[#1B1633] " +
      "focus:border-[#7C6BD6] focus:ring-[#7C6BD6]/15";

  const labelStyle = onDark
    ? "block text-sm font-medium text-white/80"
    : "block text-sm font-medium text-[#3A3556]";

  if (success) {
    return (
      <div className={`rounded-xl px-4 py-5 text-center text-sm font-medium ${
        onDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
      }`}>
        ✓ Mot de passe mis à jour. Redirection en cours…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          onDark ? "bg-red-500/20 text-red-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {error}
        </div>
      )}

      <div>
        <label htmlFor={`${idPrefix}-pw`} className={labelStyle}>
          Nouveau mot de passe
        </label>
        <input
          id={`${idPrefix}-pw`}
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
          className={inputStyle}
        />
        {/* Indicateur des règles */}
        {password.length > 0 && (
          <RulesChecklist password={password} onDark={onDark} />
        )}
      </div>

      <div>
        <label htmlFor={`${idPrefix}-confirm`} className={labelStyle}>
          Confirmer le mot de passe
        </label>
        <input
          id={`${idPrefix}-confirm`}
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••••••"
          className={`${inputStyle} ${
            confirm.length > 0
              ? passwordsMatch
                ? onDark ? "border-emerald-400" : "border-emerald-500"
                : onDark ? "border-red-400" : "border-red-400"
              : ""
          }`}
        />
        {confirm.length > 0 && !passwordsMatch && (
          <p className={`mt-1.5 text-sm ${onDark ? "text-red-300" : "text-red-600"}`}>
            Les mots de passe ne correspondent pas.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className={`w-full rounded-xl px-4 py-3 font-medium transition
                    focus:outline-none focus:ring-4 active:scale-[0.99]
                    disabled:opacity-40 disabled:cursor-not-allowed ${
          onDark
            ? "bg-[#F3C77B] text-[#1A1440] hover:bg-[#FFD98A] focus:ring-[#F3C77B]/30"
            : "bg-[#1A1440] text-white hover:bg-[#2A1E5C] focus:ring-[#7C6BD6]/30"
        }`}
      >
        {loading ? "Enregistrement…" : "Valider le nouveau mot de passe"}
      </button>
    </form>
  );
}

/* ============================================================
   Page principale
   ============================================================ */
export default function ChangePasswordPage() {
  return (
    <main className="min-h-screen w-full">

      {/* ══════════════════════════════════════════════════════
          📱 MOBILE — nuit plein écran, carte posée dessus
          ══════════════════════════════════════════════════════ */}
      <div
        className="lg:hidden relative flex min-h-screen w-full flex-col
                   items-center justify-center overflow-hidden px-5 py-10 text-white
                   [background-image:linear-gradient(160deg,#1A1440_0%,#2A1E5C_100%)]"
      >
        <div aria-hidden className="beam pointer-events-none absolute -top-[8%] left-1/2 h-[70%] w-[170%] -translate-x-1/2" />
        <div aria-hidden className="glow pointer-events-none absolute left-1/2 top-[15%] h-52 w-52 -translate-x-1/2 rounded-full" />

        <div className="relative z-10 w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2.5">
              <BeaconMark />
              <span className="text-2xl font-semibold tracking-tight">
                p<span className="text-[#F3C77B]">HAR</span>e
              </span>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-white p-6 text-[#1B1633] shadow-2xl shadow-black/40">
            <h1 className="text-xl font-semibold tracking-tight">Choisissez votre mot de passe</h1>
            <p className="mt-1 text-sm text-[#6C6A80]">
              Première connexion — définissez un mot de passe personnel et sécurisé.
            </p>
            <div className="mt-6">
              <ChangePasswordForm idPrefix="m" onDark={false} />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          💻 PC — split-screen
          ══════════════════════════════════════════════════════ */}
      <div className="hidden min-h-screen w-full bg-[#FBFBFD] text-[#1B1633] lg:flex">

        {/* Panneau nuit */}
        <section
          className="relative flex w-[55%] items-center overflow-hidden px-16 text-white
                     [background-image:linear-gradient(160deg,#1A1440_0%,#2A1E5C_100%)]"
        >
          <div aria-hidden className="beam pointer-events-none absolute -top-1/4 left-0 h-[150%] w-[150%]" />
          <div aria-hidden className="glow pointer-events-none absolute left-[6%] top-[26%] h-72 w-72 rounded-full" />

          <div className="relative z-10 max-w-md">
            <div className="flex items-center gap-3">
              <BeaconMark />
              <span className="text-3xl font-semibold tracking-tight">
                p<span className="text-[#F3C77B]">HAR</span>e
              </span>
            </div>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
              Programme de lutte contre le harcèlement à l'École
            </p>
            <h2
              className="mt-12 text-5xl leading-[1.1]"
              style={{ fontFamily: "var(--font-fraunces)" }}
            >
              Bienvenue dans
              <br />
              votre espace.
            </h2>
            <p className="mt-6 max-w-sm text-lg leading-relaxed text-white/70">
              Avant de commencer, choisissez un mot de passe personnel.
              Il protège l'accès aux situations confidentielles que vous suivez.
            </p>
          </div>
        </section>

        {/* Panneau formulaire */}
        <section className="flex w-[45%] items-center justify-center px-14">
          <div className="w-full max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6656B8]">
              Première connexion
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Choisissez votre mot de passe
            </h1>
            <p className="mt-1.5 text-[#6C6A80]">
              Définissez un mot de passe personnel et sécurisé.
            </p>
            <div className="mt-8">
              <ChangePasswordForm idPrefix="d" onDark={false} />
            </div>
            <p className="mt-8 text-xs leading-relaxed text-[#9A97AD]">
              Ce mot de passe vous sera demandé à chaque connexion. Ne le communiquez à personne.
            </p>
          </div>
        </section>
      </div>

      <style>{`
        .glow {
          background: radial-gradient(circle, rgba(243,199,123,0.45) 0%, rgba(243,199,123,0) 70%);
          filter: blur(6px);
          animation: phare-pulse 6s ease-in-out infinite;
        }
        .beam {
          background: conic-gradient(from 205deg at 12% 34%,
            rgba(243,199,123,0) 0deg,
            rgba(243,199,123,0.12) 16deg,
            rgba(243,199,123,0) 34deg);
        }
        @keyframes phare-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 0.9;  transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          .glow { animation: none; }
        }
      `}</style>
    </main>
  );
}