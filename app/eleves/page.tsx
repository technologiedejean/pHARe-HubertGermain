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

/* ============================================================
   Modale — Ajout manuel
   ============================================================ */
function ModalAjout({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ nom: "", prenom: "", classe: "", genre: "" as Genre | "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const inputCls =
    "mt-1.5 w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm " +
    "text-[#1B1633] outline-none focus:border-[#7C6BD6] focus:ring-4 focus:ring-[#7C6BD6]/15 transition";

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
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg]       = useState<string | null>(null);
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

  /* ── Import CSV ── */
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true); setImportMsg(null);
    const text    = await file.text();
    const rows    = parseCSV(text);
    let imported  = 0; let errors = 0;
    for (const row of rows) {
      const nom    = (row["nom"]    ?? row["name"] ?? "").toUpperCase().trim();
      const prenom = (row["prenom"] ?? row["firstname"] ?? row["prénom"] ?? "").trim();
      const classe = (row["classe"] ?? row["class"] ?? "").toUpperCase().trim();
      const genre  = (row["genre"]  ?? row["gender"] ?? "").toLowerCase().trim() as Genre | "";
      if (!nom || !prenom || !classe) { errors++; continue; }
      const { error } = await supabase.from("eleves").upsert(
        { nom, prenom, classe, genre: ["masculin","feminin","autre"].includes(genre) ? genre : null },
        { onConflict: "nom,prenom,classe", ignoreDuplicates: true }
      );
      if (error) errors++; else imported++;
    }
    setImportLoading(false);
    setImportMsg(`${imported} élève(s) importé(s)${errors > 0 ? `, ${errors} ignoré(s)` : ""}.`);
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
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{importMsg}</div>
          )}
          <p className="text-xs text-[#9A97AD] mb-2">{filtered.length} élève(s)</p>
          {filtered.map((e) => (
            <div key={e.id} className="rounded-2xl border border-[#EEEDF5] bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => router.push(`/eleves/${e.id}`)}
                  className="text-sm font-semibold text-[#1B1633] hover:text-[#6656B8] hover:underline text-left">
                  {e.nom} {e.prenom}
                </button>
                <span className="shrink-0 rounded-full bg-[#F3F2FA] px-2 py-0.5 text-xs text-[#6C6A80]">{e.classe}</span>
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
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{importMsg}</div>
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
                      <button onClick={() => handleSupprimer(e.id)}
                        className="text-[#C4C2D4] hover:text-red-500 transition">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
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