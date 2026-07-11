// >>> NOUVEAU FICHIER : app/situations/page.tsx <<<
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Types
   ============================================================ */
type StatutSituation = "ouverte" | "en_cours" | "cloturee";

type Situation = {
  id: string;
  reference: string | null;
  titre: string;
  description: string | null;
  statut: StatutSituation;
  gravite: number | null;
  date_signalement: string | null;
  created_at: string;
  cree_par: string;
  createur?: { nom: string; prenom: string };
  victimes: ActeurSituation[];
  intimidateurs: ActeurSituation[];
  temoins: ActeurSituation[];
  lanceurs: ActeurSituation[];
};

type ActeurSituation = {
  id: string;            // id de situation_eleves
  eleve_id: string | null;
  lanceur_libre: string | null;
  eleve?: { nom: string; prenom: string; classe: string };
};

type EleveSearch = {
  id: string;
  nom: string;
  prenom: string;
  classe: string;
};

type Profile = { id: string; role: "admin" | "referent" };

/* ============================================================
   Constantes UI
   ============================================================ */
const STATUT_CONFIG: Record<StatutSituation, { label: string; bg: string; text: string; dot: string }> = {
  ouverte:   { label: "Signalée",              bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400"   },
  en_cours:  { label: "En cours de traitement", bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500"    },
  cloturee:  { label: "Traitée",               bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
};

const GRAVITE_LABELS = ["", "1 – Mineur", "2 – Faible", "3 – Modéré", "4 – Grave", "5 – Très grave"];

/* ============================================================
   Badge statut
   ============================================================ */
function StatutBadge({ statut }: { statut: StatutSituation }) {
  const { label, bg, text, dot } = STATUT_CONFIG[statut];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${bg} ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/* ============================================================
   Nom affiché d'un acteur
   ============================================================ */
function nomActeur(a: ActeurSituation): string {
  if (a.eleve) return `${a.eleve.nom} ${a.eleve.prenom}`;
  if (a.lanceur_libre) return a.lanceur_libre;
  return "—";
}

/* ============================================================
   Champ d'autocomplétion élève (+ entrée libre optionnelle)
   ============================================================ */
function ChampEleve({
  placeholder,
  onSelect,
  allowFreeText = false,
  freeTextLabel = "",
}: {
  placeholder: string;
  onSelect: (eleve: EleveSearch | null, texteLibre?: string) => void;
  allowFreeText?: boolean;
  freeTextLabel?: string;
}) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<EleveSearch[]>([]);
  const [selected, setSelected] = useState<EleveSearch | null>(null);
  const [freeMode, setFreeMode] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [open, setOpen]         = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fermer au clic extérieur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("eleves")
        .select("id, nom, prenom, classe")
        .or(`nom.ilike.%${query}%,prenom.ilike.%${query}%`)
        .limit(8);
      setResults(data ?? []);
      setOpen(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function choisir(el: EleveSearch) {
    setSelected(el);
    setQuery(`${el.nom} ${el.prenom}`);
    setResults([]); setOpen(false);
    onSelect(el);
  }

  function effacer() {
    setSelected(null); setQuery(""); setFreeText("");
    setFreeMode(false); onSelect(null);
  }

  if (freeMode) {
    return (
      <div className="flex gap-2">
        <input
          type="text" placeholder={freeTextLabel || placeholder}
          value={freeText}
          onChange={(e) => { setFreeText(e.target.value); onSelect(null, e.target.value); }}
          className={inputCls}
        />
        <button type="button" onClick={effacer}
          className="shrink-0 rounded-xl border border-[#E7E6EF] px-3 text-[#9A97AD] hover:bg-[#F3F2FA]">
          ✕
        </button>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5">
        <span className="flex-1 text-sm text-[#1B1633]">
          {selected.nom} {selected.prenom}
          <span className="ml-2 text-xs text-[#9A97AD]">{selected.classe}</span>
        </span>
        <button type="button" onClick={effacer}
          className="text-[#9A97AD] hover:text-red-500 transition text-sm">✕</button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text" placeholder={placeholder}
        value={query} onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className={inputCls}
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-[#E7E6EF] bg-white shadow-lg overflow-hidden">
          {results.map((el) => (
            <button key={el.id} type="button"
              onMouseDown={() => choisir(el)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#F3F2FA] transition">
              <span className="font-medium text-[#1B1633]">{el.nom} {el.prenom}</span>
              <span className="ml-auto text-xs text-[#9A97AD]">{el.classe}</span>
            </button>
          ))}
          {allowFreeText && (
            <button type="button"
              onMouseDown={() => { setOpen(false); setFreeMode(true); }}
              className="flex w-full items-center gap-2 border-t border-[#F3F2FA] px-4 py-2.5
                         text-left text-sm text-[#6656B8] hover:bg-[#F5F3FF] transition">
              ✏️ Saisir un nom libre (non-élève)
            </button>
          )}
        </div>
      )}
      {allowFreeText && query.length === 0 && (
        <button type="button" onClick={() => setFreeMode(true)}
          className="mt-1 text-xs text-[#6656B8] hover:underline">
          + Saisir un nom libre (non-élève)
        </button>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm " +
  "text-[#1B1633] outline-none transition placeholder:text-[#B4B1C4] " +
  "focus:border-[#7C6BD6] focus:ring-4 focus:ring-[#7C6BD6]/15";

/* ============================================================
   Groupe multi-acteurs (victimes / intimidateurs / lanceurs)
   ============================================================ */
type EntreeActeur = { key: number; eleve: EleveSearch | null; texteLibre?: string };

function GroupeActeurs({
  label, icon, allowFreeText = false, onChange,
}: {
  label: string;
  icon: string;
  allowFreeText?: boolean;
  onChange: (acteurs: EntreeActeur[]) => void;
}) {
  const [entrees, setEntrees] = useState<EntreeActeur[]>([{ key: 0, eleve: null }]);
  const compteur = useRef(1);

  function update(key: number, eleve: EleveSearch | null, texteLibre?: string) {
    setEntrees((prev) => {
      const next = prev.map((e) => e.key === key ? { ...e, eleve, texteLibre } : e);
      onChange(next);
      return next;
    });
  }

  function ajouter() {
    const newKey = compteur.current++;
    setEntrees((prev) => {
      const next = [...prev, { key: newKey, eleve: null }];
      onChange(next);
      return next;
    });
  }

  function retirer(key: number) {
    setEntrees((prev) => {
      const next = prev.filter((e) => e.key !== key);
      onChange(next.length > 0 ? next : [{ key: compteur.current++, eleve: null }]);
      return next.length > 0 ? next : [{ key: compteur.current - 1, eleve: null }];
    });
  }

  const derniere = entrees[entrees.length - 1];
  const derniereRemplie = !!(derniere?.eleve || derniere?.texteLibre?.trim());

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#3A3556]">
        {icon} {label}
        <span className="ml-1 text-xs font-normal text-[#9A97AD]">(optionnel)</span>
      </label>
      {entrees.map((entree, i) => (
        <div key={entree.key} className="flex gap-2 items-start">
          <div className="flex-1">
            <ChampEleve
              placeholder={`Rechercher un élève…`}
              onSelect={(el, txt) => update(entree.key, el, txt)}
              allowFreeText={allowFreeText}
              freeTextLabel={`Nom libre (${label.toLowerCase()})`}
            />
          </div>
          {entrees.length > 1 && (
            <button type="button" onClick={() => retirer(entree.key)}
              className="mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
                         border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 transition">
              −
            </button>
          )}
        </div>
      ))}
      {/* Bouton + affiché seulement si le dernier champ est rempli */}
      {derniereRemplie && (
        <button type="button" onClick={ajouter}
          className="flex items-center gap-1.5 rounded-xl border border-[#E7E6EF] bg-white
                     px-3 py-1.5 text-xs font-medium text-[#6656B8] hover:bg-[#F5F3FF] transition">
          + Ajouter un(e) autre {label.toLowerCase()}
        </button>
      )}
    </div>
  );
}

/* ============================================================
   Modale — Création d'une situation
   ============================================================ */
function ModalCreerSituation({
  profileId,
  onClose,
  onSuccess,
}: {
  profileId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [titre, setTitre]               = useState("");
  const [description, setDescription]   = useState("");
  const [dateSignalement, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [gravite, setGravite]           = useState<number>(0);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const [victimes, setVictimes]         = useState<EntreeActeur[]>([]);
  const [intimidateurs, setIntimidateurs] = useState<EntreeActeur[]>([]);
  const [lanceurs, setLanceurs]         = useState<EntreeActeur[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim()) { setError("Le titre de la situation est obligatoire."); return; }
    setLoading(true); setError(null);

    // 1. Créer la situation
    const { data: sit, error: sitErr } = await supabase
      .from("situations")
      .insert({
        titre:            titre.trim(),
        description:      description.trim() || null,
        date_signalement: dateSignalement || null,
        gravite:          gravite || null,
        statut:           "ouverte",
        cree_par:         profileId,
      })
      .select("id")
      .single();

    if (sitErr || !sit) {
      setError(sitErr?.message ?? "Erreur lors de la création."); setLoading(false); return;
    }

    // 2. Insérer les acteurs dans situation_eleves
    const lignes: object[] = [];

    for (const v of victimes) {
      if (v.eleve) lignes.push({ situation_id: sit.id, eleve_id: v.eleve.id, role: "victime" });
    }
    for (const i of intimidateurs) {
      if (i.eleve) lignes.push({ situation_id: sit.id, eleve_id: i.eleve.id, role: "intimidateur" });
    }
    for (const l of lanceurs) {
      if (l.eleve) {
        lignes.push({ situation_id: sit.id, eleve_id: l.eleve.id, role: "lanceur_alerte" });
      } else if (l.texteLibre?.trim()) {
        lignes.push({ situation_id: sit.id, eleve_id: null, role: "lanceur_alerte", lanceur_libre: l.texteLibre.trim() });
      }
    }

    if (lignes.length > 0) {
      const { error: acteursErr } = await supabase.from("situation_eleves").insert(lignes);
      if (acteursErr) { setError(acteursErr.message); setLoading(false); return; }
    }

    // 3. Donner le droit "modification" au créateur
    await supabase.from("referent_situation_droits").insert({
      situation_id: sit.id,
      referent_id:  profileId,
      niveau:       "modification",
      accorde_par:  profileId,
    });

    setLoading(false); onSuccess(); onClose();
  }

  const labelCls = "block text-sm font-medium text-[#3A3556]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-[#EEEDF5] px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-[#1B1633]">Nouvelle situation</h2>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#9A97AD] hover:bg-[#F3F2FA] transition">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Titre */}
          <div>
            <label className={labelCls}>Titre / référence <span className="text-red-500">*</span></label>
            <input type="text" required placeholder="Ex. : Harcèlement récréation 6A"
              value={titre} onChange={(e) => setTitre(e.target.value)}
              className={`mt-1.5 ${inputCls}`} />
          </div>

          {/* Date + Gravité */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date du signalement</label>
              <input type="date" value={dateSignalement}
                onChange={(e) => setDate(e.target.value)}
                className={`mt-1.5 ${inputCls}`} />
            </div>
            <div>
              <label className={labelCls}>Niveau de gravité</label>
              <select value={gravite} onChange={(e) => setGravite(Number(e.target.value))}
                className={`mt-1.5 ${inputCls}`}>
                <option value={0}>-- Non évalué --</option>
                {[1,2,3,4,5].map((n) => (
                  <option key={n} value={n}>{GRAVITE_LABELS[n]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Séparateur */}
          <div className="border-t border-[#F3F2FA] pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-3">
              Personnes impliquées
            </p>
            <div className="space-y-5">
              <GroupeActeurs label="Victime(s)"         icon="🔴" onChange={setVictimes}       />
              <GroupeActeurs label="Intimidateur(s)"    icon="🟠" onChange={setIntimidateurs}  />
              <GroupeActeurs label="Lanceur(s) d'alerte" icon="🟣"
                allowFreeText onChange={setLanceurs} />
            </div>
          </div>

          {/* Description / notes */}
          <div>
            <label className={labelCls}>
              Description, contexte, notes
              <span className="ml-1 text-xs font-normal text-[#9A97AD]">(optionnel)</span>
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={5} placeholder="Décrivez la situation, les faits, le contexte…"
              className={`mt-1.5 ${inputCls} resize-none`} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5
                         text-sm font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm font-medium
                         text-white hover:bg-[#2A1E5C] transition disabled:opacity-50">
              {loading ? "Création en cours…" : "Créer la situation"}
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
export default function SituationsPage() {
  const router  = useRouter();
  const [situations, setSituations] = useState<Situation[]>([]);
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filterStatut, setFilterStatut] = useState<StatutSituation | "tous">("tous");
  const [showModal, setShowModal]   = useState(false);

  const loadSituations = useCallback(async () => {
    const { data } = await supabase
      .from("situations")
      .select(`
        id, reference, titre, description, statut, gravite,
        date_signalement, created_at, cree_par,
        createur:profiles!situations_cree_par_fkey ( nom, prenom ),
        situation_eleves (
          id, eleve_id, lanceur_libre, role,
          eleve:eleves ( nom, prenom, classe )
        )
      `)
      .order("created_at", { ascending: false });

    if (data) {
      setSituations(data.map((s: any) => ({
        ...s,
        createur: s.createur,
        victimes:      (s.situation_eleves ?? []).filter((x: any) => x.role === "victime"),
        intimidateurs: (s.situation_eleves ?? []).filter((x: any) => x.role === "intimidateur"),
        temoins:       (s.situation_eleves ?? []).filter((x: any) => x.role === "temoin"),
        lanceurs:      (s.situation_eleves ?? []).filter((x: any) => x.role === "lanceur_alerte"),
      })));
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: prof } = await supabase
        .from("profiles").select("id, role").eq("id", user.id).single();
      setProfile(prof);
      await loadSituations();
      setLoading(false);
    }
    init();
  }, [router, loadSituations]);

  /* Filtrage */
  const filtered = situations.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      s.titre.toLowerCase().includes(q) ||
      (s.reference ?? "").toLowerCase().includes(q) ||
      s.victimes.some((v) => nomActeur(v).toLowerCase().includes(q)) ||
      s.intimidateurs.some((i) => nomActeur(i).toLowerCase().includes(q));
    const matchStatut = filterStatut === "tous" || s.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const selectCls =
    "rounded-xl border border-[#E7E6EF] bg-white px-3 py-2 text-sm text-[#3A3556] " +
    "outline-none focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15 transition";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement des situations…</span>
      </div>
    );
  }

  /* ── Ligne de tableau (PC) ─────────────────────────────────── */
  const LigneTableau = ({ s }: { s: Situation }) => (
    <tr className="hover:bg-[#F8F7FC] transition-colors cursor-pointer"
      onClick={() => router.push(`/situations/${s.id}`)}>
      <td className="px-5 py-4">
        <div className="flex items-start gap-2">
          <div>
            {s.reference && (
              <p className="text-[10px] font-mono text-[#9A97AD] mb-0.5">{s.reference}</p>
            )}
            <p className="font-medium text-[#1B1633] leading-snug">{s.titre}</p>
            {s.date_signalement && (
              <p className="text-xs text-[#9A97AD] mt-0.5">
                Signalé le {new Date(s.date_signalement).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <StatutBadge statut={s.statut} />
      </td>
      <td className="px-5 py-4">
        {s.gravite ? (
          <span className={`text-xs font-medium ${
            s.gravite >= 4 ? "text-red-600" : s.gravite >= 3 ? "text-orange-600" : "text-[#6C6A80]"
          }`}>
            Niveau {s.gravite}
          </span>
        ) : <span className="text-[#B4B1C4] text-sm">—</span>}
      </td>
      <td className="px-5 py-4">
        {s.victimes.length > 0
          ? <div className="space-y-0.5">
              {s.victimes.map((v) => (
                <p key={v.id} className="text-sm text-[#1B1633]">{nomActeur(v)}</p>
              ))}
            </div>
          : <span className="text-[#B4B1C4] text-sm">—</span>}
      </td>
      <td className="px-5 py-4">
        {s.intimidateurs.length > 0
          ? <div className="space-y-0.5">
              {s.intimidateurs.map((i) => (
                <p key={i.id} className="text-sm text-[#1B1633]">{nomActeur(i)}</p>
              ))}
            </div>
          : <span className="text-[#B4B1C4] text-sm">—</span>}
      </td>
      <td className="px-5 py-4">
        <p className="text-sm text-[#6C6A80]">
          {s.createur ? `${s.createur.prenom} ${s.createur.nom}` : "—"}
        </p>
      </td>
    </tr>
  );

  /* ── Carte (mobile) ────────────────────────────────────────── */
  const CarteMobile = ({ s }: { s: Situation }) => (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-4 shadow-sm cursor-pointer"
      onClick={() => router.push(`/situations/${s.id}`)}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          {s.reference && <p className="text-[10px] font-mono text-[#9A97AD]">{s.reference}</p>}
          <p className="font-semibold text-[#1B1633] leading-snug">{s.titre}</p>
        </div>
        <StatutBadge statut={s.statut} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6C6A80]">
        {s.victimes.length > 0 && (
          <span>🔴 {s.victimes.map(nomActeur).join(", ")}</span>
        )}
        {s.intimidateurs.length > 0 && (
          <span>🟠 {s.intimidateurs.map(nomActeur).join(", ")}</span>
        )}
        {s.date_signalement && (
          <span>📅 {new Date(s.date_signalement).toLocaleDateString("fr-FR")}</span>
        )}
        {s.gravite && <span>⚠️ Niveau {s.gravite}</span>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1B1633]">
      {showModal && profile && (
        <ModalCreerSituation
          profileId={profile.id}
          onClose={() => setShowModal(false)}
          onSuccess={loadSituations}
        />
      )}

      {/* ════════════════════════════════════════════════════
          📱 MOBILE
          ════════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[#EEEDF5] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <button onClick={() => router.push("/dashboard")}
                className="mb-0.5 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
              <h1 className="text-lg font-semibold">Situations</h1>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A1440]
                         text-white hover:bg-[#2A1E5C] transition text-lg"
              title="Nouvelle situation">＋</button>
          </div>
          {/* Filtres inline */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B4B1C4] text-sm">🔍</span>
              <input type="text" placeholder="Rechercher…"
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[#E7E6EF] bg-white py-2 pl-9 pr-4
                           text-sm outline-none placeholder:text-[#B4B1C4]
                           focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15 transition" />
            </div>
            <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value as any)}
              className={selectCls}>
              <option value="tous">Tous</option>
              <option value="ouverte">Signalées</option>
              <option value="en_cours">En cours</option>
              <option value="cloturee">Traitées</option>
            </select>
          </div>
        </header>
        <main className="flex-1 px-5 py-5 space-y-3">
          {filtered.length === 0
            ? <p className="py-12 text-center text-sm text-[#9A97AD]">Aucune situation trouvée.</p>
            : filtered.map((s) => <CarteMobile key={s.id} s={s} />)
          }
          <p className="pt-2 text-center text-xs text-[#9A97AD]">
            {filtered.length} situation(s) sur {situations.length}
          </p>
        </main>
      </div>

      {/* ════════════════════════════════════════════════════
          💻 PC
          ════════════════════════════════════════════════════ */}
      <div className="hidden lg:block px-10 py-8 max-w-7xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <button onClick={() => router.push("/dashboard")}
              className="mb-1 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
            <h1 className="text-2xl font-semibold">Situations</h1>
            <p className="mt-0.5 text-sm text-[#6C6A80]">Suivi des situations de harcèlement.</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm
                       font-medium text-white hover:bg-[#2A1E5C] transition
                       focus:outline-none focus:ring-4 focus:ring-[#7C6BD6]/30">
            ＋ Nouvelle situation
          </button>
        </div>

        {/* Filtres inline */}
        <div className="mb-5 flex gap-3">
          <div className="relative min-w-[240px] flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B4B1C4] text-sm">🔍</span>
            <input type="text" placeholder="Rechercher par titre, élève…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#E7E6EF] bg-white py-2 pl-9 pr-4
                         text-sm outline-none placeholder:text-[#B4B1C4]
                         focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15 transition" />
          </div>
          {(["tous","ouverte","en_cours","cloturee"] as const).map((s) => (
            <button key={s} onClick={() => setFilterStatut(s)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                filterStatut === s
                  ? "bg-[#1A1440] text-white"
                  : "border border-[#E7E6EF] bg-white text-[#3A3556] hover:bg-[#F3F2FA]"
              }`}>
              {s === "tous" ? "Toutes" :
               s === "ouverte" ? `Signalées (${situations.filter(x=>x.statut==="ouverte").length})` :
               s === "en_cours" ? `En cours (${situations.filter(x=>x.statut==="en_cours").length})` :
               `Traitées (${situations.filter(x=>x.statut==="cloturee").length})`}
            </button>
          ))}
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto rounded-2xl border border-[#EEEDF5] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#EEEDF5] bg-[#F8F7FC]">
                {["Situation","Statut","Gravité","Victime(s)","Intimidateur(s)","Créée par"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F2FA]">
              {filtered.length === 0
                ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[#9A97AD]">
                    Aucune situation ne correspond à votre recherche.
                  </td></tr>
                : filtered.map((s) => <LigneTableau key={s.id} s={s} />)
              }
            </tbody>
          </table>
          <div className="border-t border-[#EEEDF5] px-5 py-3 text-xs text-[#9A97AD]">
            {filtered.length} situation(s) affichée(s) sur {situations.length}
          </div>
        </div>
      </div>
    </div>
  );
}