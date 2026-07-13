// >>> NOUVEAU FICHIER : app/reset-password/page.tsx <<<
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Emblème (identique à la page de connexion)
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
   Règles mot de passe (mêmes règles que app/referents/page.tsx)
   ============================================================ */
const REGLES_MDP = [
  { label: "12 caractères minimum",   test: (p: string) => p.length >= 12          },
  { label: "Une majuscule",           test: (p: string) => /[A-Z]/.test(p)         },
  { label: "Une minuscule",           test: (p: string) => /[a-z]/.test(p)         },
  { label: "Un chiffre",              test: (p: string) => /[0-9]/.test(p)         },
  { label: "Un caractère spécial",    test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function mdpValide(p: string) {
  return REGLES_MDP.every((r) => r.test(p));
}

function ChecklistMdp({ password }: { password: string }) {
  return (
    <ul className="mt-2 space-y-1">
      {REGLES_MDP.map((regle) => {
        const ok = regle.test(password);
        return (
          <li key={regle.label} className="flex items-center gap-2 text-xs">
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full
                             text-[10px] font-bold transition-colors ${
              ok ? "bg-emerald-500 text-white" : "bg-[#E7E6EF] text-[#9A97AD]"
            }`}>
              {ok ? "✓" : "·"}
            </span>
            <span className={`transition-colors ${ok ? "text-emerald-700" : "text-[#6C6A80]"}`}>
              {regle.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ============================================================
   Formulaire partagé — Mobile + PC
   ============================================================ */
function ResetForm({ idPrefix }: { idPrefix: string }) {
  const router = useRouter();
  const [password, setPassword]         = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showRules, setShowRules]       = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState(false);

  const mdpSaisi  = password.length > 0;
  const mdpOk     = mdpValide(password);
  const matchOk   = confirmation.length > 0 && confirmation === password;
  const canSubmit = mdpOk && matchOk && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true); setError(null);

    const { data, error: updErr } = await supabase.auth.updateUser({ password });

    if (updErr) {
      setError(updErr.message === "Auth session missing!"
        ? "Le lien a expiré ou a déjà été utilisé. Refaites une demande de réinitialisation."
        : updErr.message);
      setLoading(false);
      return;
    }

    // On profite de la session active pour lever le drapeau de première
    // connexion, au cas où ce lien servait aussi de première connexion.
    if (data.user) {
      try {
        await supabase.from("profiles").update({ must_change_password: false }).eq("id", data.user.id);
      } catch {
        // Non bloquant : le mot de passe est déjà mis à jour avec succès.
      }
    }

    setLoading(false);
    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 1800);
  }

  const inputCls =
    "mt-1.5 w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-3 text-[#1B1633] " +
    "outline-none transition placeholder:text-[#B4B1C4] " +
    "focus:border-[#7C6BD6] focus:ring-4 focus:ring-[#7C6BD6]/15";
  const labelCls = "block text-sm font-medium text-[#3A3556]";

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
        ✓ Mot de passe mis à jour. Redirection vers votre tableau de bord…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor={`${idPrefix}-password`} className={labelCls}>Nouveau mot de passe</label>
        <input
          id={`${idPrefix}-password`}
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => { setPassword(e.target.value); setShowRules(e.target.value.length > 0); }}
          placeholder="12 caractères minimum"
          className={`${inputCls} ${
            mdpSaisi
              ? mdpOk
                ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200"
                : "border-red-300 focus:border-red-400 focus:ring-red-100"
              : ""
          }`}
        />
        {showRules && (
          <div className={`mt-2 rounded-xl border px-4 py-3 ${
            mdpOk ? "border-emerald-200 bg-emerald-50" : "border-[#E7E6EF] bg-[#F8F7FC]"
          }`}>
            {mdpOk ? (
              <p className="text-xs font-medium text-emerald-700">✓ Mot de passe valide</p>
            ) : (
              <>
                <p className="text-xs font-medium text-[#3A3556] mb-1">Conditions requises :</p>
                <ChecklistMdp password={password} />
              </>
            )}
          </div>
        )}
      </div>

      <div>
        <label htmlFor={`${idPrefix}-confirmation`} className={labelCls}>Confirmer le mot de passe</label>
        <input
          id={`${idPrefix}-confirmation`}
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="Ressaisissez le mot de passe"
          className={`${inputCls} ${
            confirmation.length > 0
              ? matchOk
                ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200"
                : "border-red-300 focus:border-red-400 focus:ring-red-100"
              : ""
          }`}
        />
        {confirmation.length > 0 && !matchOk && (
          <p className="mt-1.5 text-xs text-red-600">Les deux mots de passe ne correspondent pas.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-xl bg-[#1A1440] px-4 py-3 font-medium text-white transition
                   hover:bg-[#2A1E5C] focus:outline-none focus:ring-4 focus:ring-[#7C6BD6]/30
                   active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? "Mise à jour…" : "Définir ce mot de passe"}
      </button>
    </form>
  );
}

/* ============================================================
   Page principale
   ============================================================ */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady]           = useState(false);
  const [lienInvalide, setLienInvalide] = useState(false);

  useEffect(() => {
    // Supabase traite automatiquement le lien de récupération au chargement
    // (jeton dans l'URL) et déclenche cet événement une fois la session établie.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Filet de sécurité : si une session existe déjà (lien déjà traité au
    // moment du montage), on ne bloque pas l'utilisateur en attente infinie.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      } else {
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (!d2.session) setLienInvalide(true);
          });
        }, 2000);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const Content = () => {
    if (lienInvalide) {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Ce lien de réinitialisation est invalide, a expiré, ou a déjà été utilisé.
          </div>
          <button onClick={() => router.push("/login")}
            className="w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-3 text-sm font-medium
                       text-[#3A3556] hover:bg-[#F3F2FA] transition">
            Retour à la connexion
          </button>
        </div>
      );
    }
    if (!ready) {
      return <p className="text-sm text-[#6C6A80]">Vérification du lien en cours…</p>;
    }
    return <ResetForm idPrefix="r" />;
  };

  return (
    <main className="min-h-screen w-full">

      {/* 📱 MOBILE */}
      <div
        className="lg:hidden relative flex min-h-screen w-full flex-col
                   items-center justify-center overflow-hidden px-5 py-10 text-white
                   [background-image:linear-gradient(160deg,#1A1440_0%,#2A1E5C_100%)]"
      >
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
            <h1 className="text-xl font-semibold tracking-tight">Nouveau mot de passe</h1>
            <p className="mt-1 text-sm text-[#6C6A80]">
              Choisissez un mot de passe sécurisé pour votre compte.
            </p>
            <div className="mt-6">
              <Content />
            </div>
          </div>
        </div>
      </div>

      {/* 💻 PC */}
      <div className="hidden min-h-screen w-full items-center justify-center bg-[#FBFBFD] text-[#1B1633] lg:flex">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-3">
            <BeaconMark />
            <span className="text-2xl font-semibold tracking-tight">
              p<span className="text-[#7C6BD6]">HAR</span>e
            </span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6656B8]">
            Espace référent
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nouveau mot de passe</h1>
          <p className="mt-1.5 text-[#6C6A80]">Choisissez un mot de passe sécurisé pour votre compte.</p>
          <div className="mt-8">
            <Content />
          </div>
        </div>
      </div>
    </main>
  );
}