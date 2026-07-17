// >>> Ce fichier REMPLACE : app/situations/[id]/page.tsx <<<
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { EditeurRiche, ContenuRiche } from "@/components/EditeurRiche";

/* ============================================================
   Types
   ============================================================ */
type StatutSituation = "ouverte" | "en_cours" | "cloturee";
type NiveauDroit     = "lecture" | "completion" | "modification";
type RoleEleve       = "victime" | "intimidateur" | "temoin" | "lanceur_alerte";
type OngletType      = "infos" | "qualifications" | "entretiens" | "notes" | "droits" ;
type CatKey          = "motifs" | "manifestations" | "lieux";

type Situation = {
  id: string; reference: string | null; titre: string;
  description: string | null; statut: StatutSituation;
  gravite: number | null; date_signalement: string | null;
  cree_par: string; createur?: { nom: string; prenom: string };
};

type ActeurSituation = {
  id: string; eleve_id: string | null; lanceur_libre: string | null;
  role: RoleEleve;
  eleve?: { id: string; nom: string; prenom: string; classe: string };
};

type CompteRendu = {
  id: string; contenu: string; creneau_id: string | null;
  date_entretien: string | null; archive: boolean;
  created_at: string; updated_at: string; auteur_id: string;
  auteur?: { id: string; nom: string; prenom: string; couleur: string };
  modifie_par?: string | null;
  modificateur?: { id: string; nom: string; prenom: string; couleur: string } | null;
  lu?: boolean;
};

type CreneauAgenda = {
  id: string; date_creneau: string; heure_debut: string; heure_fin: string;
  statut: "disponible" | "prevu" | "realise";
  note: string | null; titre: string | null;
  referent_id: string; referent_charge_id: string | null; eleve_id: string | null;
  referent?: { id: string; nom: string; prenom: string; couleur: string };
  referent_charge?: { id: string; nom: string; prenom: string; couleur: string };
  eleve?: { id: string; nom: string; prenom: string } | null;
  cr?: CompteRendu | null;
};

type Note = {
  id: string; contenu: string; created_at: string; auteur_id: string;
  auteur?: { id: string; nom: string; prenom: string; couleur: string };
};

type Droit = {
  id: string; referent_id: string; niveau: NiveauDroit;
  referent?: { id: string; nom: string; prenom: string; couleur: string };
};

type RefItem    = { id: string; label: string };
type EleveSearch = { id: string; nom: string; prenom: string; classe: string };
type Referent   = { id: string; nom: string; prenom: string; couleur: string };
type Profile    = { id: string; role: "admin" | "referent" };

/* ============================================================
   Constantes
   ============================================================ */
const STATUT_CONFIG: Record<StatutSituation, { label: string; bg: string; text: string }> = {
  ouverte:  { label: "Signalée",               bg: "bg-amber-50",   text: "text-amber-700"   },
  en_cours: { label: "En cours de traitement", bg: "bg-blue-50",    text: "text-blue-700"    },
  cloturee: { label: "Traitée",                bg: "bg-emerald-50", text: "text-emerald-700" },
};

const ROLE_CONFIG: Record<RoleEleve, { label: string; icon: string }> = {
  victime:        { label: "Victime",          icon: "🔴" },
  intimidateur:   { label: "Intimidateur",     icon: "🟠" },
  temoin:         { label: "Témoin",           icon: "🔵" },
  lanceur_alerte: { label: "Lanceur d'alerte", icon: "🟣" },
};

const ROLE_LABEL: Record<RoleEleve, string> = {
  victime: "victime", intimidateur: "intimidateur",
  temoin: "témoin", lanceur_alerte: "lanceur d'alerte",
};

const PRIORITE_ROLES: RoleEleve[] = ["victime", "intimidateur", "temoin", "lanceur_alerte"];

const NIVEAU_CONFIG: Record<NiveauDroit, { label: string; desc: string; bg: string; text: string }> = {
  lecture:      { label: "Lecture",      desc: "Peut consulter",          bg: "bg-gray-100",   text: "text-gray-600"   },
  completion:   { label: "Complétion",   desc: "Peut ajouter du contenu", bg: "bg-blue-100",   text: "text-blue-700"   },
  modification: { label: "Modification", desc: "Contrôle complet",        bg: "bg-purple-100", text: "text-purple-700" },
};

const GRAVITE_LABELS = ["", "1 – Mineur", "2 – Faible", "3 – Modéré", "4 – Grave", "5 – Très grave"];

const CAT_CONFIG: Record<CatKey, { label: string; emoji: string; table: string; liaisonTable: string; liaisonCol: string; singulier: string }> = {
  motifs:         { label: "Motifs",          emoji: "🎯", table: "motifs",         liaisonTable: "situation_motifs",         liaisonCol: "motif_id",         singulier: "motif"                  },
  manifestations: { label: "Manifestations",  emoji: "⚡", table: "manifestations", liaisonTable: "situation_manifestations", liaisonCol: "manifestation_id", singulier: "type de manifestation"  },
  lieux:          { label: "Lieux",           emoji: "📍", table: "lieux",          liaisonTable: "situation_lieux",          liaisonCol: "lieu_id",          singulier: "lieu"                   },
};

const inputCls =
  "w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm " +
  "text-[#1B1633] outline-none transition placeholder:text-[#B4B1C4] " +
  "focus:border-[#7C6BD6] focus:ring-4 focus:ring-[#7C6BD6]/15";

const selectCardCls =
  "w-full rounded-lg border border-[#E7E6EF] bg-white px-2 py-1.5 text-sm " +
  "text-[#1B1633] outline-none focus:border-[#7C6BD6] focus:ring-2 " +
  "focus:ring-[#7C6BD6]/15 transition cursor-pointer";

/* ============================================================
   Helpers
   ============================================================ */
function nomActeur(a: ActeurSituation): string {
  if (a.eleve) return `${a.eleve.nom} ${a.eleve.prenom}`;
  if (a.lanceur_libre) return a.lanceur_libre;
  return "—";
}

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateLong(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatDateHeure(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buildInfosEleve(creneau: CreneauAgenda, acteurs: ActeurSituation[]): string {
  if (creneau.eleve) {
    const nom = `${creneau.eleve.prenom} ${creneau.eleve.nom}`;
    const a   = acteurs.find((a) => a.eleve_id === creneau.eleve_id);
    return a ? ` avec ${nom} en qualité de ${ROLE_LABEL[a.role]}` : ` avec ${nom}`;
  }
  const premier = PRIORITE_ROLES.flatMap((r) => acteurs.filter((a) => a.role === r && a.eleve)).find(Boolean);
  if (premier?.eleve)
    return ` avec ${premier.eleve.prenom} ${premier.eleve.nom} en qualité de ${ROLE_LABEL[premier.role]}`;
  return "";
}

// Le contenu des CR est désormais du HTML (éditeur riche). Un simple ".trim()"
// ne suffit pas à détecter un contenu réellement vide (un div contentEditable
// vide peut renvoyer "", "<br>" ou "<p></p>" selon le navigateur) : on retire
// les balises avant de vérifier.
function estVide(html: string): boolean {
  return !html || html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;
}

/* ============================================================
   Composants de base
   ============================================================ */
function Avatar({ nom, prenom, couleur, size = "sm" }: {
  nom: string; prenom: string; couleur: string; size?: "sm" | "md";
}) {
  const sz = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  return (
    <div className={`${sz} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: couleur }}>
      {prenom[0]}{nom[0]}
    </div>
  );
}

function IconCrayon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function CheckBox({ checked, onChange, loading = false, disabled = false }: {
  checked: boolean; onChange: () => void; loading?: boolean; disabled?: boolean;
}) {
  return (
    <div className={`h-[18px] w-[18px] shrink-0 rounded border-2 flex items-center justify-center transition ${
      disabled  ? "cursor-not-allowed opacity-60" : "cursor-pointer"
    } ${
      loading   ? "border-[#B4B1C4] bg-[#F3F2FA]" :
      checked   ? "border-[#6656B8] bg-[#6656B8]"  : "border-[#D1CFE2] bg-white"
    }`} onClick={() => !loading && !disabled && onChange()}>
      {loading ? (
        <div className="h-2 w-2 rounded-full border border-[#9A97AD] border-t-transparent animate-spin" />
      ) : checked ? (
        <svg viewBox="0 0 10 10" width="8" height="8" fill="none">
          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : null}
    </div>
  );
}

/* ============================================================
   Champ autocomplétion élève
   ============================================================ */
function ChampEleve({ placeholder, onSelect, allowFreeText = false }: {
  placeholder: string;
  onSelect: (eleve: EleveSearch | null, texteLibre?: string) => void;
  allowFreeText?: boolean;
}) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<EleveSearch[]>([]);
  const [selected, setSelected] = useState<EleveSearch | null>(null);
  const [freeMode, setFreeMode] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [open, setOpen]         = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("eleves").select("id, nom, prenom, classe")
        .or(`nom.ilike.%${query}%,prenom.ilike.%${query}%`).limit(6);
      setResults(data ?? []); setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  if (freeMode) return (
    <div className="flex gap-2">
      <input type="text" placeholder="Nom libre" value={freeText}
        onChange={(e) => { setFreeText(e.target.value); onSelect(null, e.target.value); }}
        className={inputCls} />
      <button type="button" onClick={() => { setFreeMode(false); setFreeText(""); onSelect(null); }}
        className="shrink-0 rounded-xl border border-[#E7E6EF] px-3 text-[#9A97AD] hover:bg-[#F3F2FA]">✕</button>
    </div>
  );

  if (selected) return (
    <div className="flex items-center gap-2 rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5">
      <span className="flex-1 text-sm">{selected.nom} {selected.prenom}
        <span className="ml-2 text-xs text-[#9A97AD]">{selected.classe}</span></span>
      <button type="button" onClick={() => { setSelected(null); setQuery(""); onSelect(null); }}
        className="text-[#9A97AD] hover:text-red-500 text-sm">✕</button>
    </div>
  );

  return (
    <div ref={ref} className="relative">
      <input type="text" placeholder={placeholder} value={query}
        onChange={(e) => setQuery(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)}
        className={inputCls} />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-[#E7E6EF] bg-white shadow-lg overflow-hidden">
          {results.map((el) => (
            <button key={el.id} type="button"
              onMouseDown={() => { setSelected(el); setQuery(`${el.nom} ${el.prenom}`); setOpen(false); onSelect(el); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-[#F3F2FA] text-sm">
              <span className="font-medium">{el.nom} {el.prenom}</span>
              <span className="ml-auto text-xs text-[#9A97AD]">{el.classe}</span>
            </button>
          ))}
          {allowFreeText && (
            <button type="button" onMouseDown={() => { setOpen(false); setFreeMode(true); }}
              className="flex w-full items-center gap-2 border-t border-[#F3F2FA] px-4 py-2.5 text-sm text-[#6656B8] hover:bg-[#F5F3FF]">
              ✏️ Nom libre (non-élève)
            </button>
          )}
        </div>
      )}
      {allowFreeText && query.length === 0 && (
        <button type="button" onClick={() => setFreeMode(true)}
          className="mt-1 text-xs text-[#6656B8] hover:underline">+ Saisir un nom libre</button>
      )}
    </div>
  );
}

/* ============================================================
   ONGLET INFOS
   ============================================================ */
function OngletInfos({ situation, acteurs, profile, situationId, onRefresh, peutCompleter, peutModifier }: {
  situation: Situation; acteurs: ActeurSituation[];
  profile: Profile; situationId: string; onRefresh: () => void;
  peutCompleter: boolean; peutModifier: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({
    titre: situation.titre, description: situation.description ?? "",
    statut: situation.statut, gravite: situation.gravite ?? 0,
    date_signalement: situation.date_signalement ?? "", reference: situation.reference ?? "",
  });
  const [ajoutRole, setAjoutRole]       = useState<RoleEleve | "">("");
  const [ajoutEleve, setAjoutEleve]     = useState<EleveSearch | null>(null);
  const [ajoutLibre, setAjoutLibre]     = useState("");
  const [ajoutLoading, setAjoutLoading] = useState(false);

  useEffect(() => {
    setForm({
      titre: situation.titre, description: situation.description ?? "",
      statut: situation.statut, gravite: situation.gravite ?? 0,
      date_signalement: situation.date_signalement ?? "", reference: situation.reference ?? "",
    });
  }, [situation]);

  async function handleSaveStatut(val: StatutSituation) {
    if (!peutModifier) return;
    setForm((f) => ({ ...f, statut: val }));
    await supabase.from("situations").update({ statut: val }).eq("id", situationId);
    onRefresh();
  }

  async function handleSaveGravite(val: number) {
    if (!peutModifier) return;
    setForm((f) => ({ ...f, gravite: val }));
    await supabase.from("situations").update({ gravite: val || null }).eq("id", situationId);
    onRefresh();
  }

  async function handleSave() {
    if (!peutModifier) return;
    setSaving(true);
    await supabase.from("situations").update({
      titre: form.titre.trim(), description: form.description.trim() || null,
      statut: form.statut, gravite: form.gravite || null,
      date_signalement: form.date_signalement || null, reference: form.reference.trim() || null,
    }).eq("id", situationId);
    setSaving(false); setEditing(false); onRefresh();
  }

  async function handleSupprimerActeur(id: string) {
    if (!peutModifier) return;
    await supabase.from("situation_eleves").delete().eq("id", id);
    onRefresh();
  }

  async function handleAjouterActeur() {
    if (!ajoutRole || !peutCompleter) return;
    setAjoutLoading(true);
    if (ajoutEleve) {
      await supabase.from("situation_eleves").insert({ situation_id: situationId, eleve_id: ajoutEleve.id, role: ajoutRole });
    } else if (ajoutLibre.trim()) {
      await supabase.from("situation_eleves").insert({ situation_id: situationId, eleve_id: null, role: ajoutRole, lanceur_libre: ajoutLibre.trim() });
    }
    setAjoutLoading(false); setAjoutRole(""); setAjoutEleve(null); setAjoutLibre("");
    onRefresh();
  }

  const roleGroups = (["victime","intimidateur","temoin","lanceur_alerte"] as RoleEleve[]).map((role) => ({
    role, acteurs: acteurs.filter((a) => a.role === role),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {editing ? (
            <input value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
              className={inputCls + " text-lg font-semibold"} />
          ) : (
            <>
              {situation.reference && <p className="text-xs font-mono text-[#9A97AD] mb-0.5">{situation.reference}</p>}
              <h2 className="text-xl font-semibold text-[#1B1633]">{situation.titre}</h2>
            </>
          )}
        </div>
        {peutModifier && (
          <div className="flex gap-2 shrink-0">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)}
                  className="rounded-xl border border-[#E7E6EF] px-3 py-1.5 text-sm text-[#3A3556] hover:bg-[#F3F2FA] transition">Annuler</button>
                <button onClick={handleSave} disabled={saving}
                  className="rounded-xl bg-[#1A1440] px-3 py-1.5 text-sm text-white hover:bg-[#2A1E5C] transition disabled:opacity-50">
                  {saving ? "…" : "Enregistrer"}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="rounded-xl border border-[#E7E6EF] px-3 py-1.5 text-sm text-[#3A3556] hover:bg-[#F3F2FA] transition">
                ✏️ Modifier
              </button>
            )}
          </div>
        )}
      </div>

      {editing && peutModifier ? (
        <div className="space-y-4 rounded-2xl border border-[#EEEDF5] bg-white p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3A3556] mb-1.5">Référence</label>
              <input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="Ref. optionnelle" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3A3556] mb-1.5">Date signalement</label>
              <input type="date" value={form.date_signalement} onChange={(e) => setForm((f) => ({ ...f, date_signalement: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3A3556] mb-1.5">Statut</label>
              <select value={form.statut} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value as StatutSituation }))} className={inputCls}>
                <option value="ouverte">Signalée</option>
                <option value="en_cours">En cours de traitement</option>
                <option value="cloturee">Traitée</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3A3556] mb-1.5">Gravité</label>
              <select value={form.gravite} onChange={(e) => setForm((f) => ({ ...f, gravite: Number(e.target.value) }))} className={inputCls}>
                <option value={0}>-- Non évalué --</option>
                {[1,2,3,4,5].map((n) => <option key={n} value={n}>{GRAVITE_LABELS[n]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3A3556] mb-1.5">Description / contexte</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} className={inputCls + " resize-none"} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#EEEDF5] bg-white p-4">
            <p className="text-xs text-[#9A97AD] mb-1.5">Statut</p>
            {peutModifier ? (
              <select value={form.statut} onChange={(e) => handleSaveStatut(e.target.value as StatutSituation)} className={selectCardCls}>
                <option value="ouverte">Signalée</option>
                <option value="en_cours">En cours de traitement</option>
                <option value="cloturee">Traitée</option>
              </select>
            ) : (
              <p className="text-sm font-medium text-[#1B1633]">{STATUT_CONFIG[form.statut].label}</p>
            )}
          </div>
          <div className="rounded-2xl border border-[#EEEDF5] bg-white p-4">
            <p className="text-xs text-[#9A97AD] mb-1.5">Gravité</p>
            {peutModifier ? (
              <select value={form.gravite} onChange={(e) => handleSaveGravite(Number(e.target.value))} className={selectCardCls}>
                <option value={0}>— Non évalué</option>
                {[1,2,3,4,5].map((n) => <option key={n} value={n}>{GRAVITE_LABELS[n]}</option>)}
              </select>
            ) : (
              <p className="text-sm font-medium text-[#1B1633]">{form.gravite ? GRAVITE_LABELS[form.gravite] : "— Non évalué"}</p>
            )}
          </div>
          <div className="rounded-2xl border border-[#EEEDF5] bg-white p-4">
            <p className="text-xs text-[#9A97AD] mb-1">Signalé le</p>
            <p className="text-sm font-medium text-[#1B1633]">{situation.date_signalement ? formatDate(situation.date_signalement) : "—"}</p>
          </div>
          <div className="rounded-2xl border border-[#EEEDF5] bg-white p-4">
            <p className="text-xs text-[#9A97AD] mb-1">Créé par</p>
            <p className="text-sm font-medium text-[#1B1633]">
              {situation.createur ? `${situation.createur.prenom} ${situation.createur.nom}` : "—"}
            </p>
          </div>
        </div>
      )}

      {!editing && situation.description && (
        <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-2">Description</p>
          <p className="text-sm text-[#3A3556] whitespace-pre-wrap leading-relaxed">{situation.description}</p>
        </div>
      )}

      <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-4">Personnes impliquées</p>
        <div className="space-y-4">
          {roleGroups.map(({ role, acteurs: ra }) => {
            const cfg = ROLE_CONFIG[role];
            return (
              <div key={role}>
                <p className="text-sm font-medium text-[#3A3556] mb-2">{cfg.icon} {cfg.label}</p>
                {ra.length === 0 ? <p className="text-sm text-[#B4B1C4] italic">Aucun</p> : (
                  <div className="flex flex-wrap gap-2">
                    {ra.map((a) => (
                      <div key={a.id} className="flex items-center gap-1.5 rounded-full border border-[#E7E6EF] bg-[#F8F7FC] px-3 py-1">
                        <span className="text-sm text-[#1B1633]">{nomActeur(a)}</span>
                        {a.eleve && <span className="text-xs text-[#9A97AD]">{a.eleve.classe}</span>}
                        {peutModifier && (
                          <button onClick={() => handleSupprimerActeur(a.id)} className="ml-1 text-[#C4C2D4] hover:text-red-500 transition text-xs">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {peutCompleter && (
          <div className="mt-5 border-t border-[#F3F2FA] pt-4">
            <p className="text-sm font-medium text-[#3A3556] mb-3">➕ Ajouter une personne</p>
            <div className="flex flex-wrap gap-3">
              <select value={ajoutRole} onChange={(e) => setAjoutRole(e.target.value as RoleEleve | "")}
                className="rounded-xl border border-[#E7E6EF] bg-white px-3 py-2 text-sm text-[#3A3556] outline-none focus:border-[#7C6BD6]">
                <option value="">-- Rôle --</option>
                {(["victime","intimidateur","temoin","lanceur_alerte"] as RoleEleve[]).map((r) => (
                  <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                ))}
              </select>
              <div className="flex-1 min-w-[200px]">
                <ChampEleve placeholder="Rechercher un élève…"
                  onSelect={(el, txt) => { setAjoutEleve(el); setAjoutLibre(txt ?? ""); }}
                  allowFreeText={ajoutRole === "lanceur_alerte"} />
              </div>
              <button onClick={handleAjouterActeur}
                disabled={!ajoutRole || ajoutLoading || (!ajoutEleve && !ajoutLibre.trim())}
                className="rounded-xl bg-[#1A1440] px-4 py-2 text-sm font-medium text-white hover:bg-[#2A1E5C] transition disabled:opacity-40">
                {ajoutLoading ? "…" : "Ajouter"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Carte créneau dépliable
   Une pastille rouge signale, sur l'en-tête replié, un compte rendu
   existant que l'utilisateur connecté n'a pas encore ouvert. Elle
   disparaît (pour lui uniquement) dès qu'il déplie la carte.

   La rédaction du CR utilise désormais l'éditeur riche (titres,
   gras, souligné, alignement, couleur, @mentions et #références).

   L'horodatage "Dernière modification" et son auteur sont mis à jour
   explicitement par l'application à chaque enregistrement (updated_at
   + modifie_par), plutôt que de dépendre d'un éventuel trigger côté
   base — ce qui garantit que CHAQUE modification est bien tracée,
   pas seulement la première.
   ============================================================ */
function CarteCreneauDepliable({ creneau, situationId, acteurs, profile, onRefresh, onLectureCR, peutCompleter, peutModifier }: {
  creneau: CreneauAgenda; situationId: string;
  acteurs: ActeurSituation[]; profile: Profile; onRefresh: () => void;
  onLectureCR: () => void;
  peutCompleter: boolean; peutModifier: boolean;
}) {
  const [ouvert, setOuvert]       = useState(false);
  const [editingCR, setEditingCR] = useState(false);
  const [contenu, setContenu]     = useState(creneau.cr?.contenu ?? "");
  const [saving, setSaving]       = useState(false);
  const [luLocal, setLuLocal]     = useState<boolean>(creneau.cr?.lu ?? true);

  useEffect(() => {
    setLuLocal(creneau.cr?.lu ?? true);
  }, [creneau.cr?.id, creneau.cr?.lu]);

  const refRef     = creneau.referent_charge ?? creneau.referent;
  const couleurRef = refRef?.couleur ?? "#9A97AD";
  const hasCR      = !!creneau.cr;
  const nonLu      = hasCR && !luLocal;
  // Un référent en Complétion ne peut rédiger que le CR des entretiens dont il
  // est lui-même le référent assigné (planifié ou pris en charge). La
  // Modification (et l'admin) donne accès à tous les CR de la situation.
  const canEdit    = peutModifier || (peutCompleter && (creneau.referent_id === profile.id || creneau.referent_charge_id === profile.id));
  const infosEleve = buildInfosEleve(creneau, acteurs);
  const dateStr    = formatDateLong(creneau.date_creneau);

  async function marquerCommeLu() {
    if (!creneau.cr) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("cr_lectures").upsert(
      { compte_rendu_id: creneau.cr.id, referent_id: user.id },
      { onConflict: "compte_rendu_id,referent_id", ignoreDuplicates: true }
    );
    if (error) {
      // On ne met PAS à jour l'état local si l'écriture a échoué : sinon la
      // pastille disparaît visuellement sans que rien n'ait été enregistré,
      // et elle réapparaît au rechargement — exactement le bug signalé.
      console.error("Impossible d'enregistrer la lecture du compte rendu :", error);
      return;
    }
    setLuLocal(true);
    onLectureCR(); // rafraîchit la pastille de l'onglet "Entretiens" au niveau de la page
  }

  function toggleOuvert() {
    const enTrainDouvrir = !ouvert;
    setOuvert(enTrainDouvrir);
    if (enTrainDouvrir && nonLu) marquerCommeLu();
  }

  function getBandeauInfo() {
    const aujourd_hui = new Date().toISOString().slice(0, 10);
    const estPasse    = creneau.date_creneau <= aujourd_hui;
    if (creneau.statut === "disponible") return {
      ligne1: `Disponibilité le ${dateStr}`, ligne2: "",
      couleurTexte: "#6C6A80", bg: "#F8F7FC", bandeColor: "#D1CFE2", icone: "🕐",
    };
    if (!estPasse) return {
      ligne1: `Entretien prévu le ${dateStr}${infosEleve}`, ligne2: "",
      couleurTexte: "#1d4ed8", bg: "#eff6ff", bandeColor: "#93c5fd", icone: "📅",
    };
    if (hasCR) return {
      ligne1: `Entretien réalisé le ${dateStr}${infosEleve}`,
      ligne2: "Compte rendu disponible",
      couleurTexte: "#065f46", bg: "#f0fdf4", bandeColor: "#6ee7b7", icone: "✅",
    };
    return {
      ligne1: `Entretien réalisé le ${dateStr}${infosEleve}`,
      ligne2: "Pensez à rédiger le compte rendu dès que possible",
      couleurTexte: "#991b1b", bg: "#fef2f2", bandeColor: "#fca5a5", icone: "🔴",
    };
  }

  const { ligne1, ligne2, couleurTexte, bg, bandeColor, icone } = getBandeauInfo();

  async function handleSaveCR() {
    if (estVide(contenu) || !canEdit) return;
    setSaving(true);
    if (hasCR && creneau.cr) {
      // Identité récupérée en direct au moment de l'enregistrement (pas
      // capturée à l'ouverture du formulaire) pour éviter tout décalage
      // si la session a changé entre-temps.
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("comptes_rendus").update({
        contenu,
        updated_at: new Date().toISOString(),
        modifie_par: user?.id ?? profile.id,
      }).eq("id", creneau.cr.id);
    } else {
      await supabase.from("comptes_rendus").insert({
        situation_id: situationId, creneau_id: creneau.id,
        auteur_id: profile.id, contenu,
        date_entretien: creneau.date_creneau, archive: false,
      });
    }
    setSaving(false); setEditingCR(false); onRefresh();
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-[#EEEDF5] shadow-sm">
      <div className="flex">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: bandeColor }} />
        <div className="flex-1 cursor-pointer select-none" style={{ backgroundColor: bg }}
          onClick={toggleOuvert}>
          <div className="flex items-start justify-between gap-3 px-4 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug" style={{ color: couleurTexte }}>
                {icone} {ligne1}
                {nonLu && (
                  <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-red-500 align-middle"
                    title="Compte rendu non lu" />
                )}
              </p>
              {ligne2 && <p className="mt-0.5 text-xs font-medium" style={{ color: couleurTexte, opacity: 0.8 }}>{ligne2}</p>}
              <p className="mt-1 text-xs text-[#6C6A80]">{creneau.heure_debut.slice(0, 5)} – {creneau.heure_fin.slice(0, 5)}</p>
              {creneau.note && <p className="mt-0.5 text-xs text-[#9A97AD] italic">{creneau.note}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {refRef && (
                <div className="flex items-center gap-1.5">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-white shadow-sm"
                    style={{ backgroundColor: couleurRef }}>
                    {refRef.prenom[0]}{refRef.nom[0]}
                  </div>
                  <span className="text-xs text-[#9A97AD] hidden sm:block">{refRef.prenom} {refRef.nom}</span>
                </div>
              )}
              {canEdit && (
                <button onClick={(e) => { e.stopPropagation(); setOuvert(true); setEditingCR(true); setContenu(creneau.cr?.contenu ?? ""); if (nonLu) marquerCommeLu(); }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E7E6EF]
                             bg-white text-[#6C6A80] hover:text-[#6656B8] hover:border-[#7C6BD6] transition"
                  title={hasCR ? "Modifier le compte rendu" : "Rédiger le compte rendu"}>
                  <IconCrayon />
                </button>
              )}
              <div className={`text-[#9A97AD] transition-transform duration-200 ${ouvert ? "rotate-180" : ""}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {ouvert && (
        <div className="border-t border-[#EEEDF5] bg-white px-5 py-5">
          {editingCR && canEdit ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#1B1633]">{hasCR ? "Modifier le compte rendu" : "Rédiger le compte rendu"}</p>
              <EditeurRiche
                value={contenu}
                onChange={setContenu}
                placeholder="Rédigez le compte rendu de cet entretien…"
                minHeightClass="min-h-[180px]"
                autoFocus
              />
              <div className="flex gap-3">
                <button onClick={() => { setEditingCR(false); setContenu(creneau.cr?.contenu ?? ""); }}
                  className="flex-1 rounded-xl border border-[#E7E6EF] px-4 py-2 text-sm text-[#3A3556] hover:bg-[#F3F2FA]">Annuler</button>
                <button onClick={handleSaveCR} disabled={saving || estVide(contenu)}
                  className="flex-1 rounded-xl bg-[#1A1440] px-4 py-2 text-sm text-white hover:bg-[#2A1E5C] disabled:opacity-50 transition">
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          ) : hasCR ? (
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  {creneau.cr!.auteur && (
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: creneau.cr!.auteur.couleur ?? "#9A97AD" }}>
                      {creneau.cr!.auteur.prenom[0]}{creneau.cr!.auteur.nom[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-[#1B1633]">{creneau.cr!.auteur?.prenom} {creneau.cr!.auteur?.nom}</p>
                    <p className="text-xs text-[#9A97AD]">
                      Rédigé le {formatDateHeure(creneau.cr!.created_at)}
                      {creneau.cr!.updated_at !== creneau.cr!.created_at && (
                        <>
                          {" · "}Dernière modification le {formatDateHeure(creneau.cr!.updated_at)}
                          {creneau.cr!.modificateur && ` par ${creneau.cr!.modificateur.prenom} ${creneau.cr!.modificateur.nom}`}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => { setEditingCR(true); setContenu(creneau.cr!.contenu); }}
                    className="flex items-center gap-1.5 rounded-xl border border-[#E7E6EF] px-3 py-1.5
                               text-xs text-[#3A3556] hover:bg-[#F3F2FA] hover:text-[#6656B8] hover:border-[#7C6BD6] transition">
                    <IconCrayon /> Modifier
                  </button>
                )}
              </div>
              <ContenuRiche html={creneau.cr!.contenu} />
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-[#9A97AD] mb-3">Aucun compte rendu rédigé pour cet entretien.</p>
              {canEdit && (
                <button onClick={() => { setEditingCR(true); setContenu(""); }}
                  className="flex items-center gap-2 rounded-xl bg-[#1A1440] px-4 py-2 text-sm font-medium text-white hover:bg-[#2A1E5C] transition mx-auto">
                  <IconCrayon size={14} /> Rédiger le compte rendu
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ONGLET ENTRETIENS
   ============================================================ */
function OngletEntretiens({ situationId, acteurs, profile, onRefresh, onLectureCR, peutCompleter, peutModifier }: {
  situationId: string; acteurs: ActeurSituation[]; profile: Profile; onRefresh: () => void;
  onLectureCR: () => void;
  peutCompleter: boolean; peutModifier: boolean;
}) {
  const [creneaux, setCreneaux]               = useState<CreneauAgenda[]>([]);
  const [loadingCreneaux, setLoadingCreneaux] = useState(true);
  const [nouveau, setNouveau]                 = useState(false);
  const [newContenu, setNewContenu]           = useState("");
  const [newDate, setNewDate]                 = useState(new Date().toISOString().slice(0, 10));
  const [newHeureDebut, setNewHeureDebut]     = useState("08:00");
  const [newHeureFin, setNewHeureFin]         = useState("09:00");
  const [creating, setCreating]               = useState(false);
  const [createError, setCreateError]         = useState<string | null>(null);
  const [newEleveId, setNewEleveId]           = useState("");

  const loadCreneaux = useCallback(async () => {
    const { data: creneauxData } = await supabase
      .from("creneaux")
      .select(`id, date_creneau, heure_debut, heure_fin, statut, note, titre,
               referent_id, referent_charge_id, eleve_id,
               referent:profiles!creneaux_referent_id_fkey(id, nom, prenom, couleur),
               referent_charge:profiles!creneaux_referent_charge_id_fkey(id, nom, prenom, couleur),
               eleve:eleves(id, nom, prenom)`)
      .eq("situation_id", situationId)
      .order("date_creneau", { ascending: false })
      .order("heure_debut", { ascending: false });

    if (!creneauxData || creneauxData.length === 0) {
      setCreneaux([]); setLoadingCreneaux(false); return;
    }

    const { data: crsData } = await supabase
      .from("comptes_rendus")
      .select(`id, contenu, creneau_id, date_entretien, archive, created_at, updated_at, auteur_id, modifie_par,
               auteur:profiles!comptes_rendus_auteur_id_fkey(id, nom, prenom, couleur),
               modificateur:profiles!comptes_rendus_modifie_par_fkey(id, nom, prenom, couleur)`)
      .eq("situation_id", situationId)
      .not("contenu", "like", "[NOTE]%");

    const crParCreneauId = new Map<string, any>();
    const crParDate      = new Map<string, any>();
    for (const cr of (crsData ?? [])) {
      if (cr.creneau_id) crParCreneauId.set(cr.creneau_id, cr);
      if (cr.date_entretien && !cr.creneau_id) crParDate.set(cr.date_entretien, cr);
    }

    // Statut de lecture (par utilisateur connecté) de chaque compte rendu existant.
    const { data: { user } } = await supabase.auth.getUser();
    const crIds = (crsData ?? []).map((cr: any) => cr.id);
    let luSet = new Set<string>();
    if (user && crIds.length > 0) {
      const { data: lectures } = await supabase
        .from("cr_lectures")
        .select("compte_rendu_id")
        .eq("referent_id", user.id)
        .in("compte_rendu_id", crIds);
      luSet = new Set((lectures ?? []).map((l: any) => l.compte_rendu_id));
    }

    setCreneaux(creneauxData.map((c: any) => {
      const cr = crParCreneauId.get(c.id) ?? crParDate.get(c.date_creneau) ?? null;
      return {
        ...c,
        cr: cr ? { ...cr, lu: luSet.has(cr.id) } : null,
      };
    }));
    setLoadingCreneaux(false);
  }, [situationId]);

  useEffect(() => { loadCreneaux(); }, [loadCreneaux]);

  async function handleCreate() {
    if (estVide(newContenu) || !peutCompleter) return;
    if (newHeureFin <= newHeureDebut) { setCreateError("L'heure de fin doit être après l'heure de début."); return; }
    setCreating(true); setCreateError(null);

    const { data: nouveauCreneau } = await supabase
      .from("creneaux").insert({
        situation_id: situationId, referent_id: profile.id, referent_charge_id: profile.id,
        date_creneau: newDate, heure_debut: newHeureDebut, heure_fin: newHeureFin, statut: "realise", eleve_id: newEleveId || null,
      }).select("id").single();

    if (nouveauCreneau) {
      await supabase.from("comptes_rendus").insert({
        situation_id: situationId, creneau_id: nouveauCreneau.id,
        auteur_id: profile.id, contenu: newContenu,
        date_entretien: newDate, archive: false,
      });
    }

    setCreating(false); setNouveau(false);
    setNewContenu(""); setNewDate(new Date().toISOString().slice(0, 10));
    setNewHeureDebut("08:00"); setNewHeureFin("09:00");
    setNewEleveId("");
    await loadCreneaux(); onRefresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-2">Entretiens liés à cette situation</p>
        <p className="text-xs text-[#B4B1C4] mb-4">Cliquez sur un entretien pour le déplier et lire ou rédiger le compte rendu.</p>
        {loadingCreneaux ? <p className="text-sm text-[#9A97AD]">Chargement…</p>
        : creneaux.length === 0 ? (
          <div className="rounded-2xl border border-[#EEEDF5] bg-white p-6 text-center">
            <p className="text-sm text-[#9A97AD]">Aucun entretien lié à cette situation.</p>
            <p className="mt-1 text-xs text-[#B4B1C4]">Créez un créneau depuis l'agenda ou utilisez le bouton ci-dessous.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {creneaux.map((c) => (
              <CarteCreneauDepliable key={c.id} creneau={c} situationId={situationId}
                acteurs={acteurs} profile={profile} onRefresh={loadCreneaux} onLectureCR={onLectureCR}
                peutCompleter={peutCompleter} peutModifier={peutModifier} />
            ))}
          </div>
        )}
      </div>

      {peutCompleter && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-3">Ajouter un entretien non planifié</p>
          {!nouveau && (
            <button onClick={() => setNouveau(true)}
              className="flex items-center gap-2 rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5
                         text-sm font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition">
              ＋ Saisir un entretien qui n'était pas dans l'agenda
            </button>
          )}
          {nouveau && (
            <div className="rounded-2xl border-2 border-[#7C6BD6] bg-white p-5 space-y-4">
              <p className="text-sm font-semibold text-[#1B1633]">Entretien non planifié</p>
              {createError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{createError}</div>}
              <div>
                <label className="block text-xs font-medium text-[#9A97AD] mb-1">Date de l'entretien</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#9A97AD] mb-1">Heure de début</label>
                  <input type="time" value={newHeureDebut} onChange={(e) => setNewHeureDebut(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9A97AD] mb-1">Heure de fin</label>
                  <input type="time" value={newHeureFin} onChange={(e) => setNewHeureFin(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Élève interviewé */}
              <div>
                <label className="block text-xs font-medium text-[#9A97AD] mb-1">
                  Élève interviewé
                </label>
                <select
                  value={newEleveId}
                  onChange={(e) => setNewEleveId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Nom de l'élève concerné</option>
                  {(["victime","intimidateur","temoin","lanceur_alerte"] as RoleEleve[]).flatMap((role) =>
                    acteurs
                      .filter((a) => a.eleve)
                      .filter((a) => a.role === role)
                      .map((a) => (
                        <option key={a.id} value={a.eleve!.id}>
                          {ROLE_CONFIG[role].icon} {a.eleve!.prenom} {a.eleve!.nom}
                          {a.eleve!.classe ? ` (${a.eleve!.classe})` : ""}
                          {" — "}{ROLE_CONFIG[role].label}
                        </option>
                      ))
                  )}
                </select>
                <p className="mt-1 text-xs text-[#9A97AD]">
                  Cette information enrichit le bandeau de l'entretien et le profil de l'élève.
                </p>
              </div>

              <p className="text-xs text-[#9A97AD] -mt-2">ℹ️ Le créneau sera automatiquement ajouté à l'agenda.</p>
              <div>
                <label className="block text-xs font-medium text-[#9A97AD] mb-1">Compte rendu</label>
                <EditeurRiche
                  value={newContenu}
                  onChange={setNewContenu}
                  placeholder="Rédigez le compte rendu de l'entretien…"
                  minHeightClass="min-h-[160px]"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setNouveau(false); setNewContenu(""); setNewEleveId(""); setCreateError(null); }}
                  className="flex-1 rounded-xl border border-[#E7E6EF] px-4 py-2 text-sm text-[#3A3556] hover:bg-[#F3F2FA]">Annuler</button>
                <button onClick={handleCreate} disabled={creating || estVide(newContenu)}
                  className="flex-1 rounded-xl bg-[#1A1440] px-4 py-2 text-sm text-white hover:bg-[#2A1E5C] disabled:opacity-50 transition">
                  {creating ? "Enregistrement…" : "Enregistrer + ajouter à l'agenda"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ONGLET TCHAT (anciennement "Notes")
   Reste en texte brut — pas concerné par l'éditeur riche.
   Accessible en écriture dès le niveau Complétion.
   ============================================================ */
function OngletNotes({ situationId, profile, peutCompleter }: {
  situationId: string; profile: Profile; peutCompleter: boolean;
}) {
  const [notes, setNotes]       = useState<Note[]>([]);
  const [loading, setLoading]   = useState(true);
  const [contenu, setContenu]   = useState("");
  const [creating, setCreating] = useState(false);

  const loadNotes = useCallback(async () => {
    const { data } = await supabase
      .from("comptes_rendus")
      .select(`id, contenu, created_at, auteur_id, auteur:profiles!comptes_rendus_auteur_id_fkey(id, nom, prenom, couleur)`)
      .eq("situation_id", situationId).like("contenu", "[NOTE]%").order("created_at", { ascending: false });
    setNotes((data ?? []).map((n: any) => ({ ...n, contenu: n.contenu.replace(/^\[NOTE\]\s*/, "") })));
    setLoading(false);
  }, [situationId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  async function handleCreate() {
    if (!contenu.trim() || !peutCompleter) return;
    setCreating(true);
    await supabase.from("comptes_rendus").insert({ situation_id: situationId, auteur_id: profile.id, contenu: `[NOTE] ${contenu.trim()}`, archive: false });
    setCreating(false); setContenu(""); await loadNotes();
  }

  async function handleSupprimer(id: string) {
    if (!peutCompleter) return;
    await supabase.from("comptes_rendus").delete().eq("id", id); await loadNotes();
  }

  if (loading) return <p className="py-8 text-center text-sm text-[#9A97AD]">Chargement…</p>;

  return (
    <div className="space-y-4">
      {peutCompleter && (
        <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5 space-y-3">
          <p className="text-sm font-semibold text-[#1B1633]">Envoyer un message</p>
          <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={4}
            placeholder="Écrivez votre message, observation, information utile…" className={inputCls + " resize-none"} />
          <button onClick={handleCreate} disabled={creating || !contenu.trim()}
            className="rounded-xl bg-[#1A1440] px-4 py-2 text-sm text-white hover:bg-[#2A1E5C] disabled:opacity-50 transition">
            {creating ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      )}
      {notes.length === 0 ? <p className="py-8 text-center text-sm text-[#9A97AD]">Aucun message pour cette situation.</p> : (
        <div className="relative">
          <div className="absolute left-[17px] top-0 bottom-0 w-0.5 bg-[#EEEDF5]" />
          <div className="space-y-3 pl-10">
            {notes.map((note) => {
              const couleur  = note.auteur?.couleur ?? "#9A97AD";
              const isAuteur = note.auteur_id === profile.id;
              return (
                <div key={note.id} className="relative">
                  <div className="absolute -left-10 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow" style={{ backgroundColor: couleur }}>
                    <span className="text-[9px] font-bold text-white">{note.auteur?.prenom?.[0]}{note.auteur?.nom?.[0]}</span>
                  </div>
                  <div className="rounded-2xl border border-[#EEEDF5] bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-[#3A3556] whitespace-pre-wrap leading-relaxed">{note.contenu}</p>
                        <p className="mt-2 text-xs text-[#B4B1C4]">{note.auteur?.prenom} {note.auteur?.nom} · {formatDateHeure(note.created_at)}</p>
                      </div>
                      {isAuteur && peutCompleter && (
                        <button onClick={() => handleSupprimer(note.id)} className="shrink-0 text-[#C4C2D4] hover:text-red-500 transition">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ONGLET DROITS
   ============================================================ */
function OngletDroits({ situationId, profile, allReferents }: {
  situationId: string; profile: Profile; allReferents: Referent[];
}) {
  const [droits, setDroits]             = useState<Droit[]>([]);
  const [loading, setLoading]           = useState(true);
  const [ajoutRef, setAjoutRef]         = useState("");
  const [ajoutNiveau, setAjoutNiveau]   = useState<NiveauDroit>("lecture");
  const [ajoutLoading, setAjoutLoading] = useState(false);

  const loadDroits = useCallback(async () => {
    const { data } = await supabase
      .from("referent_situation_droits")
      .select(`id, referent_id, niveau, referent:profiles!referent_situation_droits_referent_id_fkey(id, nom, prenom, couleur)`)
      .eq("situation_id", situationId);
    setDroits((data as any) ?? []); setLoading(false);
  }, [situationId]);

  useEffect(() => { loadDroits(); }, [loadDroits]);

  async function handleAjouter() {
    if (!ajoutRef) return;
    setAjoutLoading(true);
    await supabase.from("referent_situation_droits").upsert({
      situation_id: situationId, referent_id: ajoutRef, niveau: ajoutNiveau, accorde_par: profile.id,
    }, { onConflict: "situation_id,referent_id" });
    setAjoutRef(""); setAjoutLoading(false); await loadDroits();
  }

  async function handleModifier(id: string, niveau: NiveauDroit) {
    await supabase.from("referent_situation_droits").update({ niveau }).eq("id", id); await loadDroits();
  }

  async function handleSupprimer(id: string) {
    await supabase.from("referent_situation_droits").delete().eq("id", id); await loadDroits();
  }

  const refsSansDroit = allReferents.filter((r) => !droits.some((d) => d.referent_id === r.id));
  const isAdmin       = profile.role === "admin";
  if (loading) return <p className="py-8 text-center text-sm text-[#9A97AD]">Chargement…</p>;

  return (
    <div className="space-y-5">
      <p className="text-sm text-[#6C6A80]">Liste des référents ayant accès à cette situation et leur niveau de permission.</p>
      <div className="rounded-2xl border border-[#EEEDF5] bg-white overflow-hidden">
        {droits.length === 0 ? <p className="px-5 py-8 text-center text-sm text-[#9A97AD]">Aucun accès accordé.</p> : (
          <div className="divide-y divide-[#F3F2FA]">
            {droits.map((d) => {
              const cfg = NIVEAU_CONFIG[d.niveau];
              return (
                <div key={d.id} className="flex items-center gap-4 px-5 py-4">
                  {d.referent && <Avatar nom={d.referent.nom} prenom={d.referent.prenom} couleur={d.referent.couleur} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1B1633]">{d.referent?.prenom} {d.referent?.nom}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      <select value={d.niveau} onChange={(e) => handleModifier(d.id, e.target.value as NiveauDroit)}
                        className="rounded-xl border border-[#E7E6EF] bg-white px-3 py-1.5 text-xs text-[#3A3556] outline-none focus:border-[#7C6BD6]">
                        {(["lecture","completion","modification"] as NiveauDroit[]).map((n) => (
                          <option key={n} value={n}>{NIVEAU_CONFIG[n].label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleSupprimer(d.id)} className="text-[#C4C2D4] hover:text-red-500 transition">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {isAdmin && refsSansDroit.length > 0 && (
        <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5">
          <p className="text-sm font-semibold text-[#1B1633] mb-3">Accorder un accès</p>
          <div className="flex flex-wrap gap-3">
            <select value={ajoutRef} onChange={(e) => setAjoutRef(e.target.value)}
              className="flex-1 min-w-[160px] rounded-xl border border-[#E7E6EF] bg-white px-3 py-2 text-sm text-[#3A3556] outline-none focus:border-[#7C6BD6]">
              <option value="">-- Choisir un référent --</option>
              {refsSansDroit.map((r) => <option key={r.id} value={r.id}>{r.prenom} {r.nom}</option>)}
            </select>
            <select value={ajoutNiveau} onChange={(e) => setAjoutNiveau(e.target.value as NiveauDroit)}
              className="rounded-xl border border-[#E7E6EF] bg-white px-3 py-2 text-sm text-[#3A3556] outline-none focus:border-[#7C6BD6]">
              {(["lecture","completion","modification"] as NiveauDroit[]).map((n) => (
                <option key={n} value={n}>{NIVEAU_CONFIG[n].label} — {NIVEAU_CONFIG[n].desc}</option>
              ))}
            </select>
            <button onClick={handleAjouter} disabled={!ajoutRef || ajoutLoading}
              className="rounded-xl bg-[#1A1440] px-4 py-2 text-sm text-white hover:bg-[#2A1E5C] transition disabled:opacity-40">
              {ajoutLoading ? "…" : "Accorder"}
            </button>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-[#EEEDF5] bg-[#F8F7FC] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-3">Niveaux d'accès</p>
        <div className="space-y-2">
          {(["lecture","completion","modification"] as NiveauDroit[]).map((n) => {
            const cfg = NIVEAU_CONFIG[n];
            return (
              <div key={n} className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                <span className="text-xs text-[#6C6A80]">{cfg.desc}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ONGLET QUALIFICATIONS — Modale ajout
   ============================================================ */
function ModalAjoutItem({ categorie, onClose, onSuccess }: {
  categorie: CatKey; onClose: () => void; onSuccess: () => void;
}) {
  const cfg = CAT_CONFIG[categorie];
  const [label, setLabel]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setLoading(true); setError(null);
    const { error: err } = await supabase.from(cfg.table).insert({ label: label.trim() });
    if (err) { setError(err.code === "23505" ? "Cet élément existe déjà." : err.message); setLoading(false); return; }
    setLoading(false); onSuccess(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EEEDF5] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#1B1633]">Ajouter un {cfg.singulier}</h2>
          <button onClick={onClose} className="h-7 w-7 rounded-full text-[#9A97AD] hover:bg-[#F3F2FA] transition flex items-center justify-center">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input type="text" autoFocus placeholder={`Nouveau ${cfg.singulier}…`}
            value={label} onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm text-[#1B1633] outline-none focus:border-[#7C6BD6] focus:ring-4 focus:ring-[#7C6BD6]/15" />
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-[#E7E6EF] px-3 py-2 text-sm text-[#3A3556] hover:bg-[#F3F2FA]">Annuler</button>
            <button type="submit" disabled={!label.trim() || loading}
              className="flex-1 rounded-xl bg-[#1A1440] px-3 py-2 text-sm text-white hover:bg-[#2A1E5C] disabled:opacity-40 transition">
              {loading ? "…" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   ONGLET QUALIFICATIONS — Modale fusion (admin)
   ============================================================ */
function ModalFusion({ categorie, items, onClose, onSuccess }: {
  categorie: CatKey; items: RefItem[]; onClose: () => void; onSuccess: () => void;
}) {
  const cfg = CAT_CONFIG[categorie];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function handleFusion() {
    if (selected.size < 2 || !newLabel.trim()) return;
    setLoading(true); setError(null);
    const ids = Array.from(selected);

    // 1. Récupérer toutes les situations liées aux éléments sélectionnés
    const { data: liaisons } = await supabase
      .from(cfg.liaisonTable)
      .select("situation_id")
      .in(cfg.liaisonCol, ids);

    const sitIds = liaisons ? [...new Set(liaisons.map((l: any) => l.situation_id))] : [];

    // 2. Supprimer les anciennes liaisons
    await supabase.from(cfg.liaisonTable).delete().in(cfg.liaisonCol, ids);

    // 3. Supprimer les anciens éléments
    //    (on le fait AVANT d'insérer le nouveau pour éviter le conflit unique si on réutilise un nom)
    await supabase.from(cfg.table).delete().in("id", ids);

    // 4. Insérer le nouvel élément fusionné
    const { data: nouvel, error: errInsert } = await supabase
      .from(cfg.table)
      .insert({ label: newLabel.trim() })
      .select("id")
      .single();

    if (errInsert || !nouvel) {
      setError(errInsert?.message ?? "Erreur lors de la création de l'élément fusionné.");
      setLoading(false); return;
    }

    // 5. Recréer les liaisons avec le nouvel élément
    if (sitIds.length > 0) {
      await supabase.from(cfg.liaisonTable).upsert(
        sitIds.map((sid) => ({ situation_id: sid, [cfg.liaisonCol]: nouvel.id })),
        { onConflict: `situation_id,${cfg.liaisonCol}` }
      );
    }

    setLoading(false); onSuccess(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[#EEEDF5] px-5 py-4 shrink-0">
          <h2 className="text-sm font-semibold text-[#1B1633]">Fusionner des {cfg.label.toLowerCase()}</h2>
          <button onClick={onClose} className="h-7 w-7 rounded-full text-[#9A97AD] hover:bg-[#F3F2FA] transition flex items-center justify-center">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-[#6C6A80]">
            Cochez au moins 2 éléments à fusionner, puis donnez un nom au résultat.
            Toutes les situations concernées seront mises à jour automatiquement.
          </p>
          <div className="space-y-2 rounded-xl border border-[#EEEDF5] p-3">
            {items.map((item) => (
              <label key={item.id} className="flex items-center gap-2.5 cursor-pointer">
                <CheckBox checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                <span className="text-sm text-[#1B1633]">{item.label}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3A3556] mb-1.5">Nom de l'élément fusionné</label>
            <input type="text" placeholder="Nouveau nom…" value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              className="w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm text-[#1B1633] outline-none focus:border-[#7C6BD6] focus:ring-4 focus:ring-[#7C6BD6]/15" />
          </div>
        </div>
        <div className="flex gap-2 border-t border-[#EEEDF5] px-5 py-4 shrink-0">
          <button onClick={onClose} className="flex-1 rounded-xl border border-[#E7E6EF] px-3 py-2 text-sm text-[#3A3556] hover:bg-[#F3F2FA]">Annuler</button>
          <button onClick={handleFusion} disabled={selected.size < 2 || !newLabel.trim() || loading}
            className="flex-1 rounded-xl bg-[#1A1440] px-3 py-2 text-sm text-white hover:bg-[#2A1E5C] disabled:opacity-40 transition">
            {loading ? "Fusion…" : `Fusionner (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ONGLET QUALIFICATIONS — Colonne catégorie
   La qualification (cocher/décocher, ajouter un élément) est
   désormais réservée au niveau Modification.
   ============================================================ */
function ColonneCategorie({ categorie, situationId, profile, peutModifier }: {
  categorie: CatKey; situationId: string; profile: Profile; peutModifier: boolean;
}) {
  const cfg = CAT_CONFIG[categorie];
  const [items, setItems]       = useState<RefItem[]>([]);
  const [cochees, setCochees]   = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [modalAjout, setModalAjout]   = useState(false);
  const [modalFusion, setModalFusion] = useState(false);

  const load = useCallback(async () => {
    const [itemsRes, liaisonsRes] = await Promise.all([
      supabase.from(cfg.table).select("id, label").order("label"),
      supabase.from(cfg.liaisonTable).select(cfg.liaisonCol).eq("situation_id", situationId),
    ]);
    setItems(itemsRes.data ?? []);
    setCochees(new Set((liaisonsRes.data ?? []).map((l: any) => l[cfg.liaisonCol])));
    setLoading(false);
  }, [cfg, situationId]);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(itemId: string) {
    if (!peutModifier) return;
    setSaving(itemId);
    if (cochees.has(itemId)) {
      await supabase.from(cfg.liaisonTable).delete().eq("situation_id", situationId).eq(cfg.liaisonCol, itemId);
      setCochees((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    } else {
      await supabase.from(cfg.liaisonTable).insert({ situation_id: situationId, [cfg.liaisonCol]: itemId });
      setCochees((prev) => new Set([...prev, itemId]));
    }
    setSaving(null);
  }

  return (
    <>
      {modalAjout  && <ModalAjoutItem categorie={categorie} onClose={() => setModalAjout(false)}  onSuccess={load} />}
      {modalFusion && <ModalFusion    categorie={categorie} items={items} onClose={() => setModalFusion(false)} onSuccess={load} />}

      <div className="rounded-2xl border border-[#EEEDF5] bg-white flex flex-col" style={{ minHeight: 320 }}>
        {/* En-tête */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#EEEDF5]">
          <p className="text-sm font-semibold text-[#1B1633]">{cfg.emoji} {cfg.label}</p>
          <div className="flex items-center gap-1.5">
            {cochees.size > 0 && (
              <span className="rounded-full bg-[#F5F3FF] px-2 py-0.5 text-[10px] font-semibold text-[#6656B8]">
                {cochees.size}
              </span>
            )}
            {profile.role === "admin" && items.length >= 2 && (
              <button onClick={() => setModalFusion(true)}
                className="rounded-lg border border-[#E7E6EF] px-2 py-1 text-[10px] text-[#6C6A80] hover:bg-[#F3F2FA] hover:text-[#1B1633] transition"
                title="Fusionner des éléments">
                ⇌ Fusionner
              </button>
            )}
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {loading ? <p className="text-xs text-[#B4B1C4]">Chargement…</p>
          : items.length === 0 ? <p className="text-xs text-[#B4B1C4] italic">Aucun élément. Ajoutez-en ci-dessous.</p>
          : items.map((item) => {
            const estCoche = cochees.has(item.id);
            const enCours  = saving === item.id;
            return (
              <label key={item.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition
                           ${peutModifier ? "cursor-pointer" : "cursor-default"}
                           ${estCoche ? "bg-[#F5F3FF]" : peutModifier ? "hover:bg-[#F8F7FC]" : ""}`}>
                <CheckBox checked={estCoche} onChange={() => handleToggle(item.id)} loading={enCours} disabled={!peutModifier} />
                <input type="checkbox" className="sr-only" checked={estCoche} onChange={() => !enCours && handleToggle(item.id)} disabled={!peutModifier} />
                <span className={`text-sm transition ${estCoche ? "font-medium text-[#1B1633]" : "text-[#3A3556]"}`}>{item.label}</span>
              </label>
            );
          })}
        </div>

        {/* Bouton + */}
        {peutModifier && (
          <div className="border-t border-[#F3F2FA] px-4 py-3">
            <button onClick={() => setModalAjout(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-[#D1CFE2]
                         px-3 py-2 text-xs font-medium text-[#6C6A80] hover:border-[#7C6BD6]
                         hover:text-[#6656B8] transition">
              <span className="text-base leading-none">＋</span>
              Ajouter un {cfg.singulier}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ============================================================
   ONGLET QUALIFICATIONS
   Réservé au niveau Modification (admin, créateur, ou référent
   avec droit "modification" sur la situation).
   ============================================================ */
function OngletQualifications({ situationId, profile, peutModifier }: {
  situationId: string; profile: Profile; peutModifier: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6C6A80]">
        Qualifiez la situation en cochant les éléments pertinents dans chaque catégorie.
        Ces informations alimenteront les statistiques de fin d'année.
      </p>
      {!peutModifier && (
        <p className="text-xs text-[#9A97AD]">🔒 Seul un droit de Modification permet de qualifier cette situation.</p>
      )}
      {/* 💻 PC — 3 colonnes */}
      <div className="hidden lg:grid grid-cols-3 gap-4">
        <ColonneCategorie categorie="motifs"         situationId={situationId} profile={profile} peutModifier={peutModifier} />
        <ColonneCategorie categorie="manifestations" situationId={situationId} profile={profile} peutModifier={peutModifier} />
        <ColonneCategorie categorie="lieux"          situationId={situationId} profile={profile} peutModifier={peutModifier} />
      </div>
      {/* 📱 Mobile — 3 blocs empilés */}
      <div className="lg:hidden space-y-4">
        <ColonneCategorie categorie="motifs"         situationId={situationId} profile={profile} peutModifier={peutModifier} />
        <ColonneCategorie categorie="manifestations" situationId={situationId} profile={profile} peutModifier={peutModifier} />
        <ColonneCategorie categorie="lieux"          situationId={situationId} profile={profile} peutModifier={peutModifier} />
      </div>
    </div>
  );
}

/* ============================================================
   Page principale
   ============================================================ */
export default function FicheSituationPage() {
  const router      = useRouter();
  const params      = useParams();
  const situationId = params.id as string;

  const [situation, setSituation] = useState<Situation | null>(null);
  const [acteurs, setActeurs]     = useState<ActeurSituation[]>([]);
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [referents, setReferents] = useState<Referent[]>([]);
  const [monNiveau, setMonNiveau] = useState<NiveauDroit>("lecture");
  const [loading, setLoading]     = useState(true);
  const [onglet, setOnglet]       = useState<OngletType>("infos");
  // Pastille sur l'onglet "Entretiens" : vrai si au moins un CR d'entretien de
  // cette situation n'a pas encore été ouvert par l'utilisateur connecté.
  const [entretiensNonLus, setEntretiensNonLus] = useState(false);

  // "modification" couvre le contrôle complet : gravité, statut, infos générales
  // et qualification de la situation (les admins et le créateur ont toujours ce niveau).
  // "completion" (ou plus) permet d'ajouter du contenu (planifier un entretien,
  // rédiger un CR, écrire dans le tchat, ajouter un protagoniste).
  const peutModifier  = monNiveau === "modification";
  const peutCompleter = monNiveau === "completion" || monNiveau === "modification";

  const loadSituation = useCallback(async () => {
    const [sitRes, acteursRes] = await Promise.all([
      supabase.from("situations")
        .select(`id, reference, titre, description, statut, gravite, date_signalement, cree_par,
                 createur:profiles!situations_cree_par_fkey(nom, prenom)`)
        .eq("id", situationId).single(),
      supabase.from("situation_eleves")
        .select(`id, eleve_id, lanceur_libre, role, eleve:eleves(id, nom, prenom, classe)`)
        .eq("situation_id", situationId),
    ]);
    if (sitRes.data)     setSituation(sitRes.data as any);
    if (acteursRes.data) setActeurs(acteursRes.data as any);
  }, [situationId]);

  // Recalcule indépendamment de l'onglet actif, pour que la pastille soit
  // toujours à jour même si l'onglet Entretiens n'a jamais été ouvert.
  const checkEntretiensNonLus = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setEntretiensNonLus(false); return; }

    const { data: crs } = await supabase
      .from("comptes_rendus")
      .select("id")
      .eq("situation_id", situationId)
      .not("contenu", "like", "[NOTE]%");

    if (!crs || crs.length === 0) { setEntretiensNonLus(false); return; }

    const crIds = crs.map((c: any) => c.id);
    const { data: lectures } = await supabase
      .from("cr_lectures")
      .select("compte_rendu_id")
      .eq("referent_id", user.id)
      .in("compte_rendu_id", crIds);
    const luSet = new Set((lectures ?? []).map((l: any) => l.compte_rendu_id));

    setEntretiensNonLus(crIds.some((id) => !luSet.has(id)));
  }, [situationId]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: prof } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
      setProfile(prof);

      // Détermine le niveau d'accès réel de l'utilisateur sur cette situation.
      // Les admins ont toujours un contrôle complet. Le créateur de la situation
      // a lui aussi toujours un droit de "modification" sur sa propre situation,
      // même sans ligne explicite dans referent_situation_droits. Les autres
      // référents dépendent de referent_situation_droits ; en l'absence de ligne
      // on reste en lecture seule par précaution (RLS devrait de toute façon
      // déjà bloquer l'accès sinon).
      const { data: sitCreateur } = await supabase
        .from("situations")
        .select("cree_par")
        .eq("id", situationId)
        .maybeSingle();

      if (prof?.role === "admin" || sitCreateur?.cree_par === user.id) {
        setMonNiveau("modification");
      } else {
        const { data: droit } = await supabase
          .from("referent_situation_droits")
          .select("niveau")
          .eq("situation_id", situationId)
          .eq("referent_id", user.id)
          .maybeSingle();
        setMonNiveau((droit?.niveau as NiveauDroit) ?? "lecture");
      }

      const { data: refs } = await supabase.from("profiles").select("id, nom, prenom, couleur")
        .eq("role", "referent").eq("actif", true).order("nom");
      setReferents(refs ?? []);
      await loadSituation();
      await checkEntretiensNonLus();
      setLoading(false);
    }
    init();
  }, [router, loadSituation, checkEntretiensNonLus, situationId]);

  const ONGLETS: { key: OngletType; label: string }[] = [
    { key: "infos",           label: "Infos"          },
    { key: "qualifications",  label: "Qualification"  },
    { key: "entretiens",      label: "Entretiens"     },
    { key: "notes",           label: "Tchat"          },
    { key: "droits",          label: "Droits"         },
  ];

  if (loading || !situation || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement…</span>
      </div>
    );
  }

  const renderOnglet = () => {
    if (onglet === "infos")
      return <OngletInfos situation={situation} acteurs={acteurs} profile={profile} situationId={situationId}
        onRefresh={loadSituation} peutCompleter={peutCompleter} peutModifier={peutModifier} />;
    if (onglet === "entretiens")
      return <OngletEntretiens situationId={situationId} acteurs={acteurs} profile={profile}
        onRefresh={loadSituation} onLectureCR={checkEntretiensNonLus}
        peutCompleter={peutCompleter} peutModifier={peutModifier} />;
    if (onglet === "notes")
      return <OngletNotes situationId={situationId} profile={profile} peutCompleter={peutCompleter} />;
    if (onglet === "droits")
      return <OngletDroits situationId={situationId} profile={profile} allReferents={referents} />;
    if (onglet === "qualifications")
      return <OngletQualifications situationId={situationId} profile={profile} peutModifier={peutModifier} />;
    return null;
  };

  const renderTabBar = (mobile = false) => {
    return (
      <div className={`flex ${mobile ? "border-t border-[#EEEDF5] overflow-x-auto" : "border-b border-[#EEEDF5] mb-6 gap-1"}`}>
        {ONGLETS.map((o) => (
          <button key={o.key} onClick={() => setOnglet(o.key)}
            className={`${mobile ? "flex-1 min-w-fit px-3 py-3" : "px-4 py-3 -mb-px"} text-sm font-medium transition border-b-2 flex items-center justify-center gap-1.5 ${
              onglet === o.key ? "border-[#6656B8] text-[#6656B8]" : "border-transparent text-[#6C6A80] hover:text-[#1B1633]"
            }`}>
            {o.label}
            {o.key === "entretiens" && entretiensNonLus && (
              <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" title="Compte rendu non lu" />
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1B1633]">

      {/* 📱 MOBILE */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[#EEEDF5] bg-white shadow-sm">
          <div className="px-5 py-4">
            <button onClick={() => router.push("/situations")}
              className="mb-1 text-xs text-[#6656B8] hover:underline">← Situations</button>
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-base font-semibold text-[#1B1633] leading-snug">{situation.titre}</h1>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium
                               ${STATUT_CONFIG[situation.statut].bg} ${STATUT_CONFIG[situation.statut].text}`}>
                {STATUT_CONFIG[situation.statut].label}
              </span>
            </div>
            {monNiveau === "lecture" && profile.role !== "admin" && (
              <p className="mt-1.5 text-[11px] text-[#9A97AD]">🔒 Accès en lecture seule</p>
            )}
          </div>
          {renderTabBar(true)}
        </header>
        <main className="flex-1 px-5 py-5">{renderOnglet()}</main>
      </div>

      {/* 💻 PC */}
      <div className="hidden lg:block max-w-5xl mx-auto px-8 py-8">
        <div className="mb-6">
          <button onClick={() => router.push("/situations")}
            className="mb-2 text-xs text-[#6656B8] hover:underline">← Retour aux situations</button>
          <div className="flex items-start justify-between gap-4">
            <div>
              {situation.reference && <p className="text-xs font-mono text-[#9A97AD] mb-0.5">{situation.reference}</p>}
              <h1 className="text-2xl font-semibold text-[#1B1633]">{situation.titre}</h1>
              {monNiveau === "lecture" && profile.role !== "admin" && (
                <p className="mt-1 text-xs text-[#9A97AD]">🔒 Accès en lecture seule</p>
              )}
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium
                             ${STATUT_CONFIG[situation.statut].bg} ${STATUT_CONFIG[situation.statut].text}`}>
              {STATUT_CONFIG[situation.statut].label}
            </span>
          </div>
        </div>
        {renderTabBar()}
        {renderOnglet()}
      </div>
    </div>
  );
}