// >>> Ce fichier REMPLACE : app/parametres/page.tsx <<<
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Types
   ============================================================ */
type Profile = { id: string; role: "admin" | "referent"; email: string };

/* ============================================================
   Éléments réinitialisables
   ============================================================ */
const ELEMENTS = [
  {
    id:          "situations",
    label:       "Situations",
    description: "Toutes les fiches situations, les rôles des élèves (victimes, intimidateurs…), les comptes rendus, les notes, les droits d'accès et les qualifications (motifs / manifestations / lieux rattachés). Les listes de motifs, manifestations et lieux elles-mêmes sont conservées.",
    icon:        "📋",
    danger:      true,
    tables:      ["comptes_rendus", "referent_situation_droits", "situation_eleves", "situation_motifs", "situation_manifestations", "situation_lieux", "situations"],
  },
  {
    id:          "agenda",
    label:       "Agenda",
    description: "Tous les créneaux de tous les référents (entretiens prévus, réalisés, disponibilités), ainsi que les autres référents participants associés à ces créneaux.",
    icon:        "📅",
    danger:      false,
    tables:      ["creneau_participants", "creneaux"],
  },
  {
    id:          "eleves",
    label:       "Élèves",
    description: "Toute la liste des élèves importés ou saisis. Attention : si des situations existent encore, les élèves liés ne pourront pas être supprimés.",
    icon:        "👤",
    danger:      true,
    tables:      ["eleves"],
  },
  {
    id:          "comptes_rendus",
    label:       "Comptes rendus & notes uniquement",
    description: "Efface tous les CR et notes sans toucher aux situations ni à l'agenda.",
    icon:        "📝",
    danger:      false,
    tables:      ["comptes_rendus"],
  },
] as const;

type ElementId = typeof ELEMENTS[number]["id"];

/* ============================================================
   Ordre de suppression respectant les clés étrangères
   (les tables "enfants" sont supprimées avant les "parents")
   ============================================================ */
const ORDRE_GLOBAL = [
  "comptes_rendus",           // → situations, creneaux, profiles
  "referent_situation_droits",// → situations, profiles
  "situation_motifs",         // → situations, motifs (conservés)
  "situation_manifestations", // → situations, manifestations (conservés)
  "situation_lieux",          // → situations, lieux (conservés)
  "situation_eleves",         // → situations, eleves
  "creneau_participants",     // → creneaux, profiles
  "creneaux",                 // → situations, eleves, profiles
  "situations",               // → profiles
  "eleves",
];

/* ============================================================
   Colonne servant à cibler "toutes les lignes" lors du delete.
   La plupart des tables ont "id" ; les tables de jonction de
   qualification ont une clé composite SANS colonne "id".
   ============================================================ */
const COLONNE_FILTRE: Record<string, string> = {
  situation_motifs:         "situation_id",
  situation_manifestations: "situation_id",
  situation_lieux:          "situation_id",
};
const UUID_ZERO = "00000000-0000-0000-0000-000000000000";

/* ============================================================
   Modale de confirmation
   (Composant HORS du render de la page pour garder une identité
   stable entre les rendus — sinon le champ mot de passe perd le
   focus à chaque frappe, React recréant le composant à chaque fois.)
   ============================================================ */
function ModalConfirmation({
  elementsSelectionnes, password, setPassword, pwError, setPwError,
  resetting, onConfirm, onCancel,
}: {
  elementsSelectionnes: typeof ELEMENTS[number][];
  password: string;
  setPassword: (v: string) => void;
  pwError: string | null;
  setPwError: (v: string | null) => void;
  resetting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* En-tête */}
        <div className="border-b border-[#EEEDF5] px-6 py-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl mb-3">
            ⚠️
          </div>
          <h2 className="text-base font-semibold text-[#1B1633]">
            Confirmer la réinitialisation
          </h2>
          <p className="mt-1 text-sm text-[#6C6A80]">
            Les éléments suivants seront <span className="font-semibold text-red-600">définitivement effacés</span> :
          </p>
          <ul className="mt-2 space-y-1">
            {elementsSelectionnes.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-sm text-[#3A3556]">
                <span>{e.icon}</span> {e.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[#9A97AD]">
            Cette action est irréversible. Les comptes référents, l'authentification et les
            listes de motifs / manifestations / lieux ne seront pas affectés.
          </p>
        </div>

        {/* Confirmation mot de passe */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm font-medium text-[#3A3556]">
            Saisissez votre mot de passe pour confirmer :
          </p>
          <input
            type="password"
            placeholder="Votre mot de passe administrateur"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPwError(null); }}
            className="w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm
                       text-[#1B1633] outline-none transition placeholder:text-[#B4B1C4]
                       focus:border-red-400 focus:ring-4 focus:ring-red-100"
            onKeyDown={(e) => { if (e.key === "Enter" && password.trim()) onConfirm(); }}
            autoFocus
          />
          {pwError && (
            <p className="text-sm text-red-600 whitespace-pre-wrap">{pwError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-[#EEEDF5] px-6 py-4">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5
                       text-sm font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={!password.trim() || resetting}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium
                       text-white hover:bg-red-700 transition disabled:opacity-40"
          >
            {resetting ? "Réinitialisation…" : "Confirmer et effacer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Contenu principal
   (Idem : composant hors du render de la page pour éviter tout
   remount inutile de ses enfants.)
   ============================================================ */
function Content({
  selected, toggleElement, toggleAll,
  resetDone, setResetDone,
  canReset, onOuvrirConfirmation,
  router,
}: {
  selected: Set<ElementId>;
  toggleElement: (id: ElementId) => void;
  toggleAll: () => void;
  resetDone: string[] | null;
  setResetDone: (v: string[] | null) => void;
  canReset: boolean;
  onOuvrirConfirmation: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="max-w-2xl space-y-8">

      {/* Confirmation succès */}
      {resetDone && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="text-sm font-semibold text-emerald-700">✓ Réinitialisation effectuée</p>
          <p className="mt-1 text-sm text-emerald-600">
            Les éléments suivants ont été effacés : {resetDone.join(", ")}.
          </p>
          <button onClick={() => setResetDone(null)}
            className="mt-2 text-xs text-emerald-600 hover:underline">
            Fermer ce message
          </button>
        </div>
      )}

      {/* Section réinitialisation */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[#1B1633]">Réinitialisation des données</h2>
          <p className="mt-1 text-sm text-[#6C6A80]">
            Sélectionnez les éléments à effacer. Les comptes référents, l'authentification et
            les listes de motifs / manifestations / lieux ne peuvent pas être supprimés depuis
            cette page.
          </p>
        </div>

        {/* Cases à cocher */}
        <div className="rounded-2xl border border-[#EEEDF5] bg-white overflow-hidden">

          {/* Tout sélectionner */}
          <label className="flex cursor-pointer items-center gap-4 border-b border-[#EEEDF5] px-5 py-4
                            hover:bg-[#F8F7FC] transition">
            <div className={`h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition ${
              selected.size === ELEMENTS.length
                ? "border-[#dc2626] bg-[#dc2626]"
                : selected.size > 0
                  ? "border-[#dc2626] bg-red-100"
                  : "border-[#D1CFE2] bg-white"
            }`}
              onClick={toggleAll}>
              {selected.size === ELEMENTS.length && (
                <svg viewBox="0 0 10 10" width="10" height="10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {selected.size > 0 && selected.size < ELEMENTS.length && (
                <div className="h-2 w-2 rounded-sm bg-[#dc2626]" />
              )}
            </div>
            <input type="checkbox" className="sr-only"
              checked={selected.size === ELEMENTS.length}
              onChange={toggleAll} />
            <span className="text-sm font-semibold text-[#1B1633]">
              Tout sélectionner
            </span>
            {selected.size > 0 && (
              <span className="ml-auto text-xs text-[#9A97AD]">
                {selected.size} / {ELEMENTS.length} sélectionné(s)
              </span>
            )}
          </label>

          {/* Éléments */}
          {ELEMENTS.map((element, i) => {
            const isSelected = selected.has(element.id);
            return (
              <label
                key={element.id}
                className={`flex cursor-pointer items-start gap-4 px-5 py-4 transition
                            hover:bg-[#F8F7FC]
                            ${i < ELEMENTS.length - 1 ? "border-b border-[#F3F2FA]" : ""}
                            ${isSelected ? "bg-red-50/50" : ""}`}
              >
                {/* Checkbox */}
                <div className={`mt-0.5 h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition ${
                  isSelected ? "border-[#dc2626] bg-[#dc2626]" : "border-[#D1CFE2] bg-white"
                }`}
                  onClick={() => toggleElement(element.id)}>
                  {isSelected && (
                    <svg viewBox="0 0 10 10" width="10" height="10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <input type="checkbox" className="sr-only"
                  checked={isSelected}
                  onChange={() => toggleElement(element.id)} />

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span>{element.icon}</span>
                    <span className={`text-sm font-semibold ${isSelected ? "text-red-700" : "text-[#1B1633]"}`}>
                      {element.label}
                    </span>
                    {element.danger && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        Données sensibles
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[#6C6A80] leading-relaxed">
                    {element.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Note sur les dépendances */}
        <div className="mt-4 rounded-xl border border-[#E7E6EF] bg-[#F8F7FC] px-4 py-3">
          <p className="text-xs text-[#6C6A80] leading-relaxed">
            💡 Ces données sont liées entre elles. Pour une remise à zéro complète et fiable,
            utilisez <span className="font-medium text-[#3A3556]">« Tout sélectionner »</span>.
            Une sélection partielle peut échouer si des éléments non cochés dépendent des
            éléments cochés (par ex. supprimer les élèves alors que des situations les
            référencent encore).
          </p>
        </div>

        {/* Avertissement */}
        {selected.size > 0 && (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-sm text-orange-700">
              ⚠️ <span className="font-semibold">{selected.size} élément(s) sélectionné(s).</span>{" "}
              Cette action est irréversible. Les données effacées ne pourront pas être récupérées.
            </p>
          </div>
        )}

        {/* Bouton réinitialiser */}
        <div className="mt-5">
          <button
            onClick={onOuvrirConfirmation}
            disabled={!canReset}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm
                       font-medium text-white hover:bg-red-700 transition
                       disabled:opacity-40 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-4 focus:ring-red-200"
          >
            🗑️ Réinitialiser les éléments sélectionnés
          </button>
          {!canReset && (
            <p className="mt-2 text-xs text-[#9A97AD]">
              Sélectionnez au moins un élément pour activer la réinitialisation.
            </p>
          )}
        </div>
      </div>

      {/* Section info référents */}
      <div className="rounded-2xl border border-[#EEEDF5] bg-[#F8F7FC] p-5">
        <p className="text-sm font-semibold text-[#1B1633] mb-1">👥 Référents</p>
        <p className="text-sm text-[#6C6A80]">
          Les comptes référents ne peuvent pas être supprimés depuis cette page.
          Pour gérer les référents (créer, modifier, désactiver ou supprimer un compte),
          rendez-vous dans la page{" "}
          <button onClick={() => router.push("/referents")}
            className="text-[#6656B8] hover:underline font-medium">
            Référents
          </button>.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   Page principale
   ============================================================ */
export default function ParametresPage() {
  const router = useRouter();
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [loading, setLoading]         = useState(true);

  // Réinitialisation
  const [selected, setSelected]       = useState<Set<ElementId>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword]       = useState("");
  const [pwError, setPwError]         = useState<string | null>(null);
  const [resetting, setResetting]     = useState(false);
  const [resetDone, setResetDone]     = useState<string[] | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role, email")
        .eq("id", user.id)
        .single();
      if (!prof || prof.role !== "admin") { router.push("/dashboard"); return; }
      setProfile(prof);
      setLoading(false);
    }
    init();
  }, [router]);

  function toggleElement(id: ElementId) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === ELEMENTS.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ELEMENTS.map((e) => e.id)));
    }
  }

  function fermerConfirmation() {
    setShowConfirm(false);
    setPwError(null);
    setPassword("");
  }

  async function handleReset() {
    if (!profile) return;
    setPwError(null);
    setResetting(true);

    // 1. Vérifier le mot de passe via une tentative de connexion
    const { error: authError } = await supabase.auth.signInWithPassword({
      email:    profile.email,
      password: password.trim(),
    });

    if (authError) {
      setPwError("Mot de passe incorrect. Réessayez.");
      setResetting(false);
      return;
    }

    // 2. Collecter les tables à vider (dédupliqué)
    const tablesToClear = new Set<string>();
    for (const id of selected) {
      const element = ELEMENTS.find((e) => e.id === id);
      if (element) element.tables.forEach((t) => tablesToClear.add(t));
    }

    // 3. Trier dans l'ordre de suppression sûr (FK)
    const tablesOrdered = ORDRE_GLOBAL.filter((t) => tablesToClear.has(t));

    // 4. Supprimer dans chaque table (filtre adapté aux tables sans "id")
    const errors: string[] = [];
    for (const table of tablesOrdered) {
      const col = COLONNE_FILTRE[table] ?? "id";
      const { error } = await supabase.from(table).delete().neq(col, UUID_ZERO);
      if (error) errors.push(`${table} : ${error.message}`);
    }

    setResetting(false);
    setPassword("");

    if (errors.length > 0) {
      setPwError(`Erreurs lors de la réinitialisation :\n${errors.join("\n")}`);
    } else {
      setResetDone(ELEMENTS.filter((e) => selected.has(e.id)).map((e) => e.label));
      setSelected(new Set());
      setShowConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement…</span>
      </div>
    );
  }

  const canReset = selected.size > 0;
  const elementsSelectionnes = ELEMENTS.filter((e) => selected.has(e.id));

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1B1633]">
      {showConfirm && (
        <ModalConfirmation
          elementsSelectionnes={elementsSelectionnes}
          password={password}
          setPassword={setPassword}
          pwError={pwError}
          setPwError={setPwError}
          resetting={resetting}
          onConfirm={handleReset}
          onCancel={fermerConfirmation}
        />
      )}

      {/* ════════════════════════════════════════════════════
          📱 MOBILE
          ════════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[#EEEDF5] bg-white px-5 py-4 shadow-sm">
          <button onClick={() => router.push("/dashboard")}
            className="mb-1 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
          <h1 className="text-lg font-semibold">Paramètres</h1>
          <p className="text-xs text-[#9A97AD] mt-0.5">Accès administrateur</p>
        </header>
        <main className="flex-1 px-5 py-6">
          <Content
            selected={selected} toggleElement={toggleElement} toggleAll={toggleAll}
            resetDone={resetDone} setResetDone={setResetDone}
            canReset={canReset} onOuvrirConfirmation={() => setShowConfirm(true)}
            router={router}
          />
        </main>
      </div>

      {/* ════════════════════════════════════════════════════
          💻 PC
          ════════════════════════════════════════════════════ */}
      <div className="hidden lg:block px-10 py-8">
        <button onClick={() => router.push("/dashboard")}
          className="mb-2 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#1B1633]">Paramètres</h1>
          <p className="mt-0.5 text-sm text-[#6C6A80]">
            Accès réservé à l'administrateur.
          </p>
        </div>
        <Content
          selected={selected} toggleElement={toggleElement} toggleAll={toggleAll}
          resetDone={resetDone} setResetDone={setResetDone}
          canReset={canReset} onOuvrirConfirmation={() => setShowConfirm(true)}
          router={router}
        />
      </div>
    </div>
  );
}