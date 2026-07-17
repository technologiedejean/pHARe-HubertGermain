// >>> Ce fichier REMPLACE : app/eleves/page.tsx <<<
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Types
   ============================================================ */
type Genre  = "masculin" | "feminin" | "autre";
type RoleEleve = "victime" | "intimidateur" | "temoin" | "lanceur_alerte";

type SituationLien = {
  id: string;
  titre: string;
  reference: string | null;
  role: RoleEleve;
};

type Eleve = {
  id: string;
  nom: string;
  prenom: string;
  classe: string;
  genre: Genre | null;
  situations: SituationLien[];
};

type Profile = { id: string; role: "admin" | "referent" };

/* ============================================================
   Constantes
   ============================================================ */
const ROLE_COULEUR: Record<RoleEleve, string> = {
  victime:        "#059669",
  intimidateur:   "#dc2626",
  temoin:         "#2563eb",
  lanceur_alerte: "#7c3aed",
};

const ROLE_LABEL: Record<RoleEleve, string> = {
  victime:        "Victime",
  intimidateur:   "Intimidateur",
  temoin:         "Témoin",
  lanceur_alerte: "Lanceur",
};

const GENRE_LABELS: Record<Genre, string> = {
  masculin: "Masculin",
  feminin:  "Féminin",
  autre:    "Autre",
};

const inputCls =
  "mt-1.5 w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm " +
  "text-[#1B1633] outline-none focus:border-[#7C6BD6] focus:ring-4 focus:ring-[#7C6BD6]/15 transition";

/* ============================================================
   Helpers
   ============================================================ */
function parseCSV(text: string): Record<string, string>[] {
  const sep   = text.includes(";") ? ";" : ",";
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals: Record<string, string> = {};
    line.split(sep).forEach((v, i) => { if (headers[i]) vals[headers[i]] = v.trim(); });
    return vals;
  });
}

// Normalise une valeur de genre saisie librement dans un CSV ("Féminin",
// "féminin", "F"…) vers l'une des valeurs acceptées par la colonne "genre"
// (NOT NULL en base). Les accents sont retirés avant comparaison — sans ça,
// "Féminin".toLowerCase() === "féminin" ne matche jamais "feminin" et on
// finit par vouloir écrire null sur une colonne qui l'interdit.
function normaliserGenre(raw: string): Genre | null {
  const s = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (s === "masculin" || s === "m" || s === "garcon") return "masculin";
  if (s === "feminin"  || s === "f" || s === "fille")  return "feminin";
  if (s === "autre")   return "autre";
  return null;
}

// Clé de rapprochement nom+prénom, insensible aux accents et à la casse —
// sert à détecter qu'une ligne du CSV correspond potentiellement à un élève
// déjà connu (même nom+prénom), qu'il faudra distinguer entre "homonyme"
// (deux élèves différents) et "changement de classe" (même élève) si la
// classe diffère.
function cleNomPrenom(nom: string, prenom: string): string {
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return `${norm(nom)}|${norm(prenom)}`;
}

/* ============================================================
   Icônes
   ============================================================ */
function IconCrayon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function IconCorbeille({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}

/* ============================================================
   Modale — Ajout manuel
   ============================================================ */
function ModalAjout({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ nom: "", prenom: "", classe: "", genre: "" as Genre | "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim() || !form.prenom.trim() || !form.classe.trim()) {
      setError("Nom, prénom et classe sont obligatoires."); return;
    }
    setLoading(true); setError(null);
    const { error: err } = await supabase.from("eleves").insert({
      nom:    form.nom.trim().toUpperCase(),
      prenom: form.prenom.trim(),
      classe: form.classe.trim().toUpperCase(),
      genre:  form.genre || null,
    });
    if (err) { setError(err.message); setLoading(false); return; }
    setLoading(false); onSuccess(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EEEDF5] px-6 py-4">
          <h2 className="text-base font-semibold text-[#1B1633]">Ajouter un élève</h2>
          <button onClick={onClose}
            className="h-8 w-8 rounded-full text-[#9A97AD] hover:bg-[#F3F2FA] transition flex items-center justify-center">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3A3556]">Nom <span className="text-red-500">*</span></label>
              <input type="text" placeholder="DUPONT" value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3A3556]">Prénom <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Marie" value={form.prenom}
                onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3A3556]">Classe <span className="text-red-500">*</span></label>
              <input type="text" placeholder="6A" value={form.classe}
                onChange={(e) => setForm((f) => ({ ...f, classe: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3A3556]">Genre</label>
              <select value={form.genre} onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value as Genre | "" }))}
                className={inputCls}>
                <option value="">-- Non précisé --</option>
                <option value="masculin">Masculin</option>
                <option value="feminin">Féminin</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-[#E7E6EF] px-4 py-2.5 text-sm font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2A1E5C] transition disabled:opacity-50">
              {loading ? "Ajout…" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Modale — Édition d'une fiche élève existante
   ============================================================ */
function ModalEdition({ eleve, onClose, onSuccess }: {
  eleve: Eleve; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    nom: eleve.nom, prenom: eleve.prenom, classe: eleve.classe, genre: (eleve.genre ?? "") as Genre | "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim() || !form.prenom.trim() || !form.classe.trim()) {
      setError("Nom, prénom et classe sont obligatoires."); return;
    }
    setLoading(true); setError(null);
    const { error: err } = await supabase.from("eleves").update({
      nom:    form.nom.trim().toUpperCase(),
      prenom: form.prenom.trim(),
      classe: form.classe.trim().toUpperCase(),
      genre:  form.genre || null,
    }).eq("id", eleve.id);
    if (err) { setError(err.message); setLoading(false); return; }
    setLoading(false); onSuccess(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EEEDF5] px-6 py-4">
          <h2 className="text-base font-semibold text-[#1B1633]">Modifier la fiche élève</h2>
          <button onClick={onClose}
            className="h-8 w-8 rounded-full text-[#9A97AD] hover:bg-[#F3F2FA] transition flex items-center justify-center">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3A3556]">Nom <span className="text-red-500">*</span></label>
              <input type="text" placeholder="DUPONT" value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3A3556]">Prénom <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Marie" value={form.prenom}
                onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3A3556]">Classe <span className="text-red-500">*</span></label>
              <input type="text" placeholder="6A" value={form.classe}
                onChange={(e) => setForm((f) => ({ ...f, classe: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3A3556]">Genre</label>
              <select value={form.genre} onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value as Genre | "" }))}
                className={inputCls}>
                <option value="">-- Non précisé --</option>
                <option value="masculin">Masculin</option>
                <option value="feminin">Féminin</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-[#E7E6EF] px-4 py-2.5 text-sm font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2A1E5C] transition disabled:opacity-50">
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Modale — Résolution homonyme / changement de classe
   Affichée pendant l'import CSV quand une ligne correspond à un nom+prénom
   déjà connu, mais avec une classe différente. Deux étapes :
   1. Homonyme (deux élèves distincts) ou changement de classe (même élève) ?
   2. Si changement de classe : laquelle des deux classes garder ?
   ============================================================ */
function ModalConflitHomonyme({ nouveau, existant, onResolve }: {
  nouveau: { nom: string; prenom: string; classe: string };
  existant: Eleve;
  onResolve: (decision: "homonyme" | "classe_nouvelle" | "classe_existante") => void;
}) {
  const [etape, setEtape] = useState<"type" | "classe">("type");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
        {etape === "type" ? (
          <>
            <h2 className="text-base font-semibold text-[#1B1633]">Homonymes ou changement de classe ?</h2>
            <p className="text-sm text-[#3A3556] leading-relaxed">
              <strong>{nouveau.prenom} {nouveau.nom}</strong> existe déjà en classe <strong>{existant.classe}</strong>,
              et le fichier importé indique la classe <strong>{nouveau.classe}</strong> pour un élève du même nom.
            </p>
            <p className="text-sm text-[#6C6A80]">
              {existant.prenom} {existant.nom} ({existant.classe}) et {nouveau.prenom} {nouveau.nom} ({nouveau.classe})
              sont-ils deux élèves différents, ou s'agit-il de la même personne ayant changé de classe&nbsp;?
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button onClick={() => onResolve("homonyme")}
                className="rounded-xl border border-[#E7E6EF] px-4 py-2.5 text-sm font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition text-left">
                Ce sont deux élèves différents (homonymes) — garder les deux
              </button>
              <button onClick={() => setEtape("classe")}
                className="rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2A1E5C] transition text-left">
                C'est un changement de classe
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-[#1B1633]">Quelle classe conserver ?</h2>
            <p className="text-sm text-[#6C6A80] leading-relaxed">
              {nouveau.prenom} {nouveau.nom} passe de <strong>{existant.classe}</strong> à <strong>{nouveau.classe}</strong> —
              laquelle des deux classes doit être conservée pour cet élève&nbsp;?
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button onClick={() => onResolve("classe_nouvelle")}
                className="rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2A1E5C] transition text-left">
                Garder {nouveau.classe} (nouvelle classe du fichier importé)
              </button>
              <button onClick={() => onResolve("classe_existante")}
                className="rounded-xl border border-[#E7E6EF] px-4 py-2.5 text-sm font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition text-left">
                Garder {existant.classe} (classe actuelle, inchangée)
              </button>
              <button onClick={() => setEtape("type")}
                className="mt-1 text-xs text-[#9A97AD] hover:underline self-start">← Ce sont en fait des homonymes</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Page principale
   ============================================================ */
export default function ElevesPage() {
  const router = useRouter();
  const [eleves, setEleves]     = useState<Eleve[]>([]);
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterClasse, setFilterClasse] = useState("");
  const [filterGenre, setFilterGenre]   = useState("");
  const [filterSit, setFilterSit]       = useState<"tous" | "avec" | "sans">("tous");
  const [modalAjout, setModalAjout]     = useState(false);
  const [elevesEnEdition, setElevesEnEdition] = useState<Eleve | null>(null);
  const [conflit, setConflit] = useState<{
    nouveau: { nom: string; prenom: string; classe: string };
    existant: Eleve;
    resolve: (decision: "homonyme" | "classe_nouvelle" | "classe_existante") => void;
  } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg]       = useState<string | null>(null);
  const [importOk, setImportOk]         = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadEleves = useCallback(async () => {
    const { data } = await supabase
      .from("eleves")
      .select(`id, nom, prenom, classe, genre,
               situation_eleves(role, situation:situations(id, titre, reference))`)
      .order("nom").order("prenom");

    if (data) {
      setEleves(data.map((e: any) => ({
        ...e,
        situations: (e.situation_eleves ?? []).map((se: any) => ({
          id:        se.situation?.id,
          titre:     se.situation?.titre,
          reference: se.situation?.reference,
          role:      se.role,
        })).filter((s: any) => s.id),
      })));
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: prof } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
      setProfile(prof);
      await loadEleves();
      setLoading(false);
    }
    init();
  }, [router, loadEleves]);

  // Affiche la modale de résolution et suspend l'import jusqu'à la réponse
  // de l'utilisateur — indispensable puisqu'on ne peut pas deviner tout seul
  // s'il s'agit d'un homonyme ou d'un changement de classe.
  function demanderResolutionConflit(
    nouveau: { nom: string; prenom: string; classe: string },
    existant: Eleve
  ): Promise<"homonyme" | "classe_nouvelle" | "classe_existante"> {
    return new Promise((resolve) => {
      setConflit({ nouveau, existant, resolve: (d) => { setConflit(null); resolve(d); } });
    });
  }

  /* ── Import CSV ──
     Deux points d'attention historiques ici :
     1. .upsert(..., { onConflict: "nom,prenom,classe" }) exige une contrainte
        UNIQUE sur ces 3 colonnes côté base. Si elle n'existe pas, Postgres
        rejette CHAQUE ligne avec la même erreur ("no unique or exclusion
        constraint matching the ON CONFLICT specification").
        → Exécuter une fois dans Supabase :
          ALTER TABLE public.eleves
          ADD CONSTRAINT eleves_nom_prenom_classe_key UNIQUE (nom, prenom, classe);
     2. La colonne "genre" est NOT NULL en base : il ne faut jamais lui
        envoyer null. Si la valeur du CSV ne peut pas être reconnue, on omet
        simplement la clé pour laisser la valeur par défaut de la base
        s'appliquer, au lieu de forcer null.

     Traitement des homonymes / changements de classe :
     Les lignes sont traitées une par une (pas en parallèle) car dès qu'un
     nom+prénom déjà connu apparaît avec une classe différente, on doit
     suspendre l'import et demander à l'utilisateur s'il s'agit de deux
     élèves distincts (homonymes → on garde les deux) ou du même élève ayant
     changé de classe (→ on demande alors quelle classe conserver, et on met
     à jour l'élève existant au lieu d'en créer un doublon). */
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true); setImportMsg(null);
    const text = await file.text();
    const rows = parseCSV(text);

    // Registre local nom+prénom → élèves déjà connus (base + ajouts de cet
    // import), pour repérer les conflits au fil de l'eau sans re-requêter.
    const registre = new Map<string, Eleve[]>();
    for (const ex of eleves) {
      const cle = cleNomPrenom(ex.nom, ex.prenom);
      registre.set(cle, [...(registre.get(cle) ?? []), ex]);
    }

    let imported     = 0; // nouveaux élèves créés
    let misAJour      = 0; // classe mise à jour sur un élève existant
    let dejaPresents  = 0; // ligne strictement identique à un élève existant
    let conserves     = 0; // conflit résolu en gardant l'existant tel quel
    let ignores       = 0; // champs manquants ou erreur base
    let premiereErreur: string | null = null;

    for (const row of rows) {
      const nom    = (row["nom"]    ?? row["name"] ?? "").toUpperCase().trim();
      const prenom = (row["prenom"] ?? row["firstname"] ?? row["prénom"] ?? "").trim();
      const classe = (row["classe"] ?? row["class"] ?? "").toUpperCase().trim();
      const genre  = normaliserGenre(row["genre"] ?? row["gender"] ?? "");
      if (!nom || !prenom || !classe) { ignores++; continue; }

      const cle = cleNomPrenom(nom, prenom);
      const existants  = registre.get(cle) ?? [];
      const memeClasse = existants.find((ex) => ex.classe.toUpperCase().trim() === classe);

      if (memeClasse) { dejaPresents++; continue; }

      if (existants.length > 0) {
        const existant = existants[0];
        const decision = await demanderResolutionConflit({ nom, prenom, classe }, existant);

        if (decision === "classe_existante") { conserves++; continue; }

        if (decision === "classe_nouvelle") {
          const { error } = await supabase.from("eleves").update({ classe }).eq("id", existant.id);
          if (error) { ignores++; if (!premiereErreur) premiereErreur = error.message; continue; }
          existant.classe = classe;
          misAJour++;
          continue;
        }
        // decision === "homonyme" → on tombe dans l'insertion normale ci-dessous
      }

      const payload: Record<string, string> = { nom, prenom, classe };
      if (genre) payload.genre = genre;
      const { data: cree, error } = await supabase.from("eleves")
        .insert(payload).select("id, nom, prenom, classe, genre").single();

      if (error) {
        ignores++;
        if (!premiereErreur) premiereErreur = error.message;
        console.error("Import CSV — échec d'une ligne :", nom, prenom, classe, error);
        continue;
      }

      imported++;
      registre.set(cle, [...(registre.get(cle) ?? []), { ...(cree as any), situations: [] }]);
    }

    setImportLoading(false);
    setImportOk(imported > 0 || misAJour > 0 || (ignores === 0 && dejaPresents + conserves === rows.length));
    const parts = [
      `${imported} élève(s) importé(s)`,
      misAJour     > 0 ? `${misAJour} classe(s) mise(s) à jour`      : null,
      dejaPresents > 0 ? `${dejaPresents} déjà présent(s)`           : null,
      conserves    > 0 ? `${conserves} conservé(s) sans changement`  : null,
      ignores      > 0 ? `${ignores} ignoré(s)`                      : null,
    ].filter(Boolean);
    setImportMsg(parts.join(", ") + "." + (premiereErreur ? ` Détail de l'erreur : ${premiereErreur}` : ""));
    await loadEleves();
    if (fileRef.current) fileRef.current.value = "";
  }

  /* ── Export CSV ── */
  function handleExport() {
    const header = "Nom,Prénom,Classe,Genre";
    const rows   = eleves.map((e) =>
      `${e.nom},${e.prenom},${e.classe},${e.genre ? GENRE_LABELS[e.genre] : ""}`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "eleves-phare.csv" });
    a.click(); URL.revokeObjectURL(url);
  }

  /* ── Suppression ── */
  async function handleSupprimer(id: string) {
    if (!confirm("Supprimer cet élève ? Cette action est irréversible.")) return;
    await supabase.from("eleves").delete().eq("id", id);
    await loadEleves();
  }

  /* ── Filtrage ── */
  const classes = [...new Set(eleves.map((e) => e.classe))].sort();

  const filtered = eleves.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.nom.toLowerCase().includes(q) || e.prenom.toLowerCase().includes(q) || e.classe.toLowerCase().includes(q);
    const matchClasse = !filterClasse || e.classe === filterClasse;
    const matchGenre  = !filterGenre  || e.genre  === filterGenre;
    const matchSit    = filterSit === "tous" ||
      (filterSit === "avec" && e.situations.length > 0) ||
      (filterSit === "sans" && e.situations.length === 0);
    return matchSearch && matchClasse && matchGenre && matchSit;
  });

  const isAdmin = profile?.role === "admin";

  const selectCls =
    "rounded-xl border border-[#E7E6EF] bg-white px-3 py-2 text-sm text-[#3A3556] " +
    "outline-none focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15 transition";

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
      <span className="text-[#6C6A80]">Chargement des élèves…</span>
    </div>
  );

  /* ── Colonne Situations ── */
  const ColonneSituations = ({ eleve }: { eleve: Eleve }) => {
    if (eleve.situations.length === 0) return <span className="text-[#B4B1C4] text-xs">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {eleve.situations.map((s) => (
          <button key={s.id}
            onClick={(e) => { e.stopPropagation(); router.push(`/situations/${s.id}`); }}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium
                       hover:opacity-80 transition truncate max-w-[140px]"
            style={{ borderColor: ROLE_COULEUR[s.role] + "40", color: ROLE_COULEUR[s.role], backgroundColor: ROLE_COULEUR[s.role] + "10" }}
            title={`${s.titre} — ${ROLE_LABEL[s.role]}`}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ROLE_COULEUR[s.role] }} />
            <span className="truncate">{s.reference ? `[${s.reference}]` : s.titre.slice(0, 20)}{s.titre.length > 20 && !s.reference ? "…" : ""}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1B1633]">
      {modalAjout && <ModalAjout onClose={() => setModalAjout(false)} onSuccess={loadEleves} />}
      {elevesEnEdition && (
        <ModalEdition eleve={elevesEnEdition} onClose={() => setElevesEnEdition(null)} onSuccess={loadEleves} />
      )}
      {conflit && (
        <ModalConflitHomonyme nouveau={conflit.nouveau} existant={conflit.existant} onResolve={conflit.resolve} />
      )}

      {/* 📱 MOBILE */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[#EEEDF5] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <button onClick={() => router.push("/dashboard")} className="mb-0.5 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
              <h1 className="text-lg font-semibold">Élèves</h1>
            </div>
            {isAdmin && (
              <button onClick={() => setModalAjout(true)}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-[#1A1440] text-white hover:bg-[#2A1E5C] transition text-lg">＋</button>
            )}
          </div>
          <input type="text" placeholder="Rechercher un élève…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-2 text-sm outline-none
                       placeholder:text-[#B4B1C4] focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15 transition" />
        </header>
        <main className="flex-1 px-5 py-4 space-y-2">
          {importMsg && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${
              importOk ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
            }`}>{importMsg}</div>
          )}
          <p className="text-xs text-[#9A97AD] mb-2">{filtered.length} élève(s)</p>
          {filtered.map((e) => (
            <div key={e.id} className="rounded-2xl border border-[#EEEDF5] bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => router.push(`/eleves/${e.id}`)}
                  className="text-sm font-semibold text-[#1B1633] hover:text-[#6656B8] hover:underline text-left">
                  {e.nom} {e.prenom}
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full bg-[#F3F2FA] px-2 py-0.5 text-xs text-[#6C6A80]">{e.classe}</span>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setElevesEnEdition(e)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E7E6EF] bg-white text-[#6C6A80] hover:text-[#6656B8] hover:border-[#7C6BD6] transition"
                        title="Modifier la fiche">
                        <IconCrayon />
                      </button>
                      <button onClick={() => handleSupprimer(e.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E7E6EF] bg-white text-[#C4C2D4] hover:text-red-500 hover:border-red-200 transition"
                        title="Supprimer">
                        <IconCorbeille />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {e.genre && <p className="text-xs text-[#9A97AD] mt-0.5">{GENRE_LABELS[e.genre]}</p>}
              {e.situations.length > 0 && (
                <div className="mt-2">
                  <ColonneSituations eleve={e} />
                </div>
              )}
            </div>
          ))}
        </main>
      </div>

      {/* 💻 PC */}
      <div className="hidden lg:block px-8 py-8 max-w-7xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <button onClick={() => router.push("/dashboard")} className="mb-1 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
            <h1 className="text-2xl font-semibold">Élèves</h1>
            <p className="mt-0.5 text-sm text-[#6C6A80]">{eleves.length} élève(s) enregistré(s)</p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            {isAdmin && (
              <>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
                <button onClick={() => fileRef.current?.click()} disabled={importLoading}
                  className="rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm font-medium
                             text-[#3A3556] hover:bg-[#F3F2FA] transition disabled:opacity-50">
                  {importLoading ? "Import…" : "⬆ Importer CSV"}
                </button>
                <button onClick={handleExport}
                  className="rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition">
                  ⬇ Exporter CSV
                </button>
                <button onClick={() => setModalAjout(true)}
                  className="rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2A1E5C] transition">
                  ＋ Ajouter
                </button>
              </>
            )}
          </div>
        </div>

        {importMsg && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            importOk ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}>{importMsg}</div>
        )}

        {/* Filtres */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B4B1C4] text-sm">🔍</span>
            <input type="text" placeholder="Rechercher un élève…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#E7E6EF] bg-white py-2 pl-9 pr-4 text-sm outline-none
                         placeholder:text-[#B4B1C4] focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15 transition" />
          </div>
          <select value={filterClasse} onChange={(e) => setFilterClasse(e.target.value)} className={selectCls}>
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)} className={selectCls}>
            <option value="">Tous les genres</option>
            <option value="masculin">Masculin</option>
            <option value="feminin">Féminin</option>
            <option value="autre">Autre</option>
          </select>
          <select value={filterSit} onChange={(e) => setFilterSit(e.target.value as any)} className={selectCls}>
            <option value="tous">Toutes</option>
            <option value="avec">Avec situation(s)</option>
            <option value="sans">Sans situation</option>
          </select>
        </div>

        {/* Tableau */}
        <div className="rounded-2xl border border-[#EEEDF5] bg-white overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#EEEDF5] bg-[#F8F7FC]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">Élève</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">Classe</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">Genre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">Situations</th>
                {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F2FA]">
              {filtered.length === 0 ? (
                <tr><td colSpan={isAdmin ? 5 : 4} className="px-4 py-12 text-center text-sm text-[#9A97AD]">
                  Aucun élève ne correspond aux filtres.
                </td></tr>
              ) : filtered.map((e) => (
                <tr key={e.id} className="hover:bg-[#FAFAFE] transition-colors">
                  {/* Nom cliquable → profil */}
                  <td className="px-4 py-3">
                    <button onClick={() => router.push(`/eleves/${e.id}`)}
                      className="text-sm font-semibold text-[#1B1633] hover:text-[#6656B8] hover:underline text-left">
                      {e.nom} {e.prenom}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#F3F2FA] px-2.5 py-0.5 text-xs font-medium text-[#6C6A80]">{e.classe}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6C6A80]">
                    {e.genre ? GENRE_LABELS[e.genre] : <span className="text-[#B4B1C4]">—</span>}
                  </td>
                  {/* Colonne situations — liens colorés */}
                  <td className="px-4 py-3">
                    <ColonneSituations eleve={e} />
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setElevesEnEdition(e)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E7E6EF] bg-white text-[#6C6A80] hover:text-[#6656B8] hover:border-[#7C6BD6] transition"
                          title="Modifier la fiche">
                          <IconCrayon />
                        </button>
                        <button onClick={() => handleSupprimer(e.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E7E6EF] bg-white text-[#C4C2D4] hover:text-red-500 hover:border-red-200 transition"
                          title="Supprimer">
                          <IconCorbeille />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[#9A97AD]">{filtered.length} élève(s) sur {eleves.length}</p>
      </div>
    </div>
  );
}