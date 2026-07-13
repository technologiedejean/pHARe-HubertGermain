// >>> Ce fichier REMPLACE : app/login/page.tsx <<<
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Emblème provisoire.
   → Pour le logo OFFICIEL : dépose le fichier dans /public
     (ex. /public/logo-phare.svg) et remplace <BeaconMark /> par :
        <img src="/logo-phare.svg" alt="pHARe" className="h-12 w-auto" />
   ============================================================ */
function BeaconMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="6" fill="#F3C77B" />
      <path d="M20 20 L40 11 L40 29 Z" fill="#F3C77B" fillOpacity="0.35" />
      <path d="M20 20 L0 11 L0 29 Z" fill="#F3C77B" fillOpacity="0.15" />
    </svg>
  );
}

/* ============================================================
   Formulaire partagé — Mobile + PC
   ============================================================ */
function LoginForm({
  idPrefix,
  onDark = false,
}: {
  idPrefix: string;
  onDark?: boolean;
}) {
  const router = useRouter();

  // ── Connexion ────────────────────────────────────────────
  const [mode, setMode]         = useState<"login" | "forgot">("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // ── Mot de passe oublié ─────────────────────────────────
  const [forgotEmail, setForgotEmail]     = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError]     = useState<string | null>(null);
  const [cooldown, setCooldown]           = useState(0);

  // Décompte du délai avant nouvel envoi possible
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // ── 1. Connexion via Supabase Auth ──────────────────────
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError("Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe.");
      setLoading(false);
      return;
    }

    // ── 2. Vérifier le drapeau must_change_password ─────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", data.user.id)
      .single();

    setLoading(false);

    if (profile?.must_change_password) {
      // Première connexion → écran de changement de mot de passe
      router.push("/change-password");
    } else {
      // Connexion normale → tableau de bord
      router.push("/dashboard");
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldown > 0 || forgotLoading || !forgotEmail.trim()) return;

    setForgotLoading(true);
    setForgotError(null);
    setForgotMessage(null);

    try {
      const res  = await fetch("/api/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setForgotError(data.error ?? "Une erreur est survenue.");
        if (typeof data.retryAfter === "number") setCooldown(data.retryAfter);
      } else {
        setForgotMessage(data.message ?? "Si un compte existe avec cette adresse, un e-mail vient d'être envoyé.");
        setCooldown(typeof data.retryAfter === "number" ? data.retryAfter : 60);
      }
    } catch {
      setForgotError("Impossible de contacter le serveur. Réessayez plus tard.");
    }

    setForgotLoading(false);
  }

  function retourConnexion() {
    setMode("login");
    setForgotError(null);
    setForgotMessage(null);
  }

  const inputBase =
    "mt-1.5 w-full rounded-xl border px-4 py-3 outline-none transition " +
    "focus:ring-4 placeholder:text-[#B4B1C4] ";

  const inputStyle = onDark
    ? inputBase +
      "border-white/20 bg-white/10 text-white placeholder:text-white/40 " +
      "focus:border-[#F3C77B] focus:ring-[#F3C77B]/20 focus:bg-white/15"
    : inputBase +
      "border-[#E7E6EF] bg-white text-[#1B1633] " +
      "focus:border-[#7C6BD6] focus:ring-[#7C6BD6]/15";

  const labelStyle = onDark
    ? "block text-sm font-medium text-white/80"
    : "block text-sm font-medium text-[#3A3556]";

  const linkStyle = onDark
    ? "text-sm text-[#F3C77B] transition hover:text-[#FFE0A0]"
    : "text-sm text-[#5A47B8] transition hover:text-[#43349A]";

  const buttonStyle = `w-full rounded-xl px-4 py-3 font-medium transition
                    focus:outline-none focus:ring-4 active:scale-[0.99]
                    disabled:opacity-60 disabled:cursor-not-allowed ${
    onDark
      ? "bg-[#F3C77B] text-[#1A1440] hover:bg-[#FFD98A] focus:ring-[#F3C77B]/30"
      : "bg-[#1A1440] text-white hover:bg-[#2A1E5C] focus:ring-[#7C6BD6]/30"
  }`;

  /* ── Panneau "mot de passe oublié" ───────────────────────── */
  if (mode === "forgot") {
    return (
      <form onSubmit={handleForgotSubmit} className="space-y-5">
        <div>
          <button type="button" onClick={retourConnexion} className={linkStyle}>
            ← Retour à la connexion
          </button>
        </div>

        <p className={onDark ? "text-sm text-white/70" : "text-sm text-[#6C6A80]"}>
          Saisissez votre adresse e-mail : si elle correspond à un compte, vous recevrez
          un lien pour définir un nouveau mot de passe.
        </p>

        {forgotMessage && (
          <div className={`rounded-xl px-4 py-3 text-sm ${
            onDark
              ? "bg-emerald-500/20 text-emerald-100"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}>
            {forgotMessage}
          </div>
        )}

        {forgotError && (
          <div className={`rounded-xl px-4 py-3 text-sm ${
            onDark
              ? "bg-red-500/20 text-red-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {forgotError}
          </div>
        )}

        <div>
          <label htmlFor={`${idPrefix}-forgot-email`} className={labelStyle}>
            Adresse e-mail
          </label>
          <input
            id={`${idPrefix}-forgot-email`}
            name="forgot-email"
            type="email"
            autoComplete="email"
            required
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            placeholder="prenom.nom@college.fr"
            className={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={forgotLoading || cooldown > 0 || !forgotEmail.trim()}
          className={buttonStyle}
        >
          {forgotLoading
            ? "Envoi en cours…"
            : cooldown > 0
              ? `Réessayez dans ${cooldown}s`
              : "Envoyer le lien de réinitialisation"}
        </button>
      </form>
    );
  }

  /* ── Formulaire de connexion ─────────────────────────────── */
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Message d'erreur */}
      {error && (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          onDark
            ? "bg-red-500/20 text-red-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {error}
        </div>
      )}

      <div>
        <label htmlFor={`${idPrefix}-email`} className={labelStyle}>
          Adresse e-mail
        </label>
        <input
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom.nom@college.fr"
          className={inputStyle}
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor={`${idPrefix}-password`} className={labelStyle}>
            Mot de passe
          </label>
          <button
            type="button"
            onClick={() => { setMode("forgot"); setForgotEmail(email); }}
            className={linkStyle}
          >
            Mot de passe oublié ?
          </button>
        </div>
        <input
          id={`${idPrefix}-password`}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
          className={inputStyle}
        />
      </div>

      <button type="submit" disabled={loading} className={buttonStyle}>
        {loading ? "Connexion en cours…" : "Se connecter"}
      </button>
    </form>
  );
}

/* ============================================================
   Page principale
   ============================================================ */
export default function LoginPage() {
  return (
    <main className="min-h-screen w-full">

      {/* ══════════════════════════════════════════════════════
          📱 MOBILE — nuit plein écran, carte formulaire posée dessus
          (affiché par défaut, masqué à partir de lg)
          ══════════════════════════════════════════════════════ */}
      <div
        className="lg:hidden relative flex min-h-screen w-full flex-col
                   items-center justify-center overflow-hidden px-5 py-10 text-white
                   [background-image:linear-gradient(160deg,#1A1440_0%,#2A1E5C_100%)]"
      >
        <div aria-hidden className="beam pointer-events-none absolute -top-[8%] left-1/2 h-[70%] w-[170%] -translate-x-1/2" />
        <div aria-hidden className="glow pointer-events-none absolute left-1/2 top-[15%] h-52 w-52 -translate-x-1/2 rounded-full" />

        <div className="relative z-10 w-full max-w-sm">
          {/* Marque */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2.5">
              <BeaconMark />
              <span className="text-2xl font-semibold tracking-tight">
                p<span className="text-[#F3C77B]">HAR</span>e
              </span>
            </div>
            <p className="mt-2 max-w-[16rem] text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
              Programme de lutte contre le harcèlement à l'École
            </p>
          </div>

          {/* Carte formulaire */}
          <div className="mt-8 rounded-2xl bg-white p-6 text-[#1B1633] shadow-2xl shadow-black/40">
            <h1 className="text-xl font-semibold tracking-tight">Connexion</h1>
            <p className="mt-1 text-sm text-[#6C6A80]">
              Accédez à votre espace sécurisé.
            </p>
            <div className="mt-6">
              <LoginForm idPrefix="m" onDark={false} />
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-white/45">
            Accès réservé aux personnels habilités.
            <br />
            Informations strictement confidentielles.
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          💻 PC — split-screen (nuit à gauche, formulaire à droite)
          (masqué par défaut, affiché à partir de lg)
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
              Veiller, accompagner,
              <br />
              protéger.
            </h2>
            <p className="mt-6 max-w-sm text-lg leading-relaxed text-white/70">
              L'espace sécurisé des référents du dispositif, pour suivre chaque
              situation avec soin et discrétion.
            </p>
          </div>
        </section>

        {/* Panneau formulaire */}
        <section className="flex w-[45%] items-center justify-center px-14">
          <div className="w-full max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6656B8]">
              Espace référent
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Connexion</h1>
            <p className="mt-1.5 text-[#6C6A80]">Accédez à votre espace sécurisé.</p>
            <div className="mt-8">
              <LoginForm idPrefix="d" onDark={false} />
            </div>
            <p className="mt-8 text-xs leading-relaxed text-[#9A97AD]">
              Accès réservé aux personnels habilités du dispositif. Les informations
              consultées ici sont strictement confidentielles.
            </p>
          </div>
        </section>
      </div>

      {/* Styles du faisceau */}
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