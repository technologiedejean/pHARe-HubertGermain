// >>> Ce fichier REMPLACE : app/agenda/page.tsx <<<
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Types
   ============================================================ */
type Referent = { id: string; nom: string; prenom: string; couleur: string; role?: "admin" | "referent" };
type Situation = { id: string; titre: string; reference: string | null };
type Eleve = { id: string; nom: string; prenom: string; classe: string };

type Creneau = {
  id: string;
  date_creneau: string | null;
  heure_debut: string;
  heure_fin: string;
  statut: "disponible" | "prevu" | "realise";
  note: string | null;
  titre: string | null;
  referent_id: string | null;
  referent_charge_id: string | null;
  situation_id: string | null;
  eleve_id: string | null;
  a_cr?: boolean;
  referent?: Referent;
  referent_charge?: Referent;
  situation?: Situation;
  eleve?: Eleve;
  participants?: Referent[];
};

type Profile = {
  id: string;
  role: "admin" | "referent";
  couleur: string;
  nom: string;
  prenom: string;
};

type VueMode = "semaine" | "mois";

/* ============================================================
   Constantes calendrier
   ============================================================ */
const HEURE_DEBUT  = 7;
const HEURE_FIN    = 20;
const PX_PAR_HEURE = 72;
const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS_LONGS   = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

// Valeur sentinelle utilisée dans le sélecteur "Type d'événement" pour
// représenter le choix "Réunion / formation (sans situation)". Ce n'est
// jamais stocké tel quel en base : quand elle est sélectionnée, situation_id
// est enregistré à null.
const REUNION_VALUE = "__reunion__";

/* ============================================================
   Helpers dates — heure LOCALE pour éviter le décalage UTC
   ============================================================ */
function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${j}`;
}

function startOfWeek(d: Date): Date {
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  r.setHours(12, 0, 0, 0);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function formatHeure(h: string): string { return h.slice(0, 5); }

function heureEnMinutes(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + (mm || 0);
}

function dureeEnMinutes(debut: string, fin: string): number {
  return Math.max(heureEnMinutes(fin) - heureEnMinutes(debut), 10);
}

// Couleurs des référents réellement "responsables" du créneau : le référent
// en charge et les participants additionnels. Le créateur (referent_id) n'a
// aucune incidence sur la couleur s'il n'est pas lui-même en charge ou participant.
function couleursParticipants(creneau: Creneau, referents: Referent[]): string[] {
  const ids = new Set<string>();
  if (creneau.referent_charge_id) ids.add(creneau.referent_charge_id);
  for (const p of creneau.participants ?? []) ids.add(p.id);
  return Array.from(ids)
    .map((id) => referents.find((r) => r.id === id)?.couleur)
    .filter(Boolean) as string[];
}

function nomsParticipants(creneau: Creneau, referents: Referent[]): string {
  const ids = new Set<string>();
  if (creneau.referent_charge_id) ids.add(creneau.referent_charge_id);
  for (const p of creneau.participants ?? []) ids.add(p.id);
  const noms = Array.from(ids)
    .map((id) => referents.find((r) => r.id === id))
    .filter(Boolean)
    .map((r) => `${r!.prenom} ${r!.nom}`);
  return noms.join(", ");
}

function styleMulticolore(couleurs: string[]): React.CSSProperties {
  if (couleurs.length === 0) return { backgroundColor: "#E5E4EF" };
  if (couleurs.length === 1) return { backgroundColor: couleurs[0] };
  const step  = 100 / couleurs.length;
  const stops = couleurs.flatMap((c, i) => [
    `${c} ${i * step}%`, `${c} ${(i + 1) * step}%`,
  ]);
  return { background: `linear-gradient(to right, ${stops.join(", ")})` };
}

/* ============================================================
   Trait heure actuelle
   ============================================================ */
function TraitHeureActuelle() {
  const [topPx, setTopPx] = useState<number | null>(null);

  useEffect(() => {
    function calc() {
      const now     = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      const debut   = HEURE_DEBUT * 60;
      const fin     = HEURE_FIN * 60;
      if (minutes < debut || minutes > fin) { setTopPx(null); return; }
      setTopPx(((minutes - debut) / 60) * PX_PAR_HEURE);
    }
    calc();
    const t = setInterval(calc, 60_000);
    return () => clearInterval(t);
  }, []);

  if (topPx === null) return null;

  return (
    <div className="absolute z-20 flex items-center pointer-events-none" style={{ top: topPx, left: 0, right: 0 }}>
      <div className="h-3 w-3 rounded-full bg-red-500 shrink-0 -ml-1.5 shadow-sm" />
      <div className="flex-1 h-0.5 bg-red-500 opacity-80" />
    </div>
  );
}

/* ============================================================
   CreneauBlock
   ============================================================ */
function CreneauBlock({
  creneau, referents, profile, onClick, onRejoindre, style, compact = false,
}: {
  creneau: Creneau; referents: Referent[]; profile: Profile;
  onClick: () => void; onRejoindre: () => void;
  style?: React.CSSProperties; compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const couleurs = couleursParticipants(creneau, referents);

  const estParticipant =
    creneau.referent_id === profile.id ||
    creneau.referent_charge_id === profile.id ||
    (creneau.participants ?? []).some((p) => p.id === profile.id);

  let blockStyle: React.CSSProperties = { ...style };

  if (creneau.statut === "disponible") {
    blockStyle = { ...blockStyle, backgroundColor: "#F3F2FA", border: "1px solid #E7E6EF" };
  } else if (creneau.statut === "realise") {
    // Réalisé → case PLEINE, remplie avec la ou les couleur(s) du/des référent(s) concerné(s)
    blockStyle = { ...blockStyle, ...styleMulticolore(couleurs), border: "none" };
  } else {
    // Prévu → case ENCADRÉE (fond blanc, bordure colorée ; plusieurs liserés empilés si multicolore)
    blockStyle = {
      ...blockStyle,
      backgroundColor: "white",
      borderWidth: 2,
      borderStyle: "solid",
      borderColor: couleurs[0] ?? "#9A97AD",
      boxShadow: couleurs.length > 1
        ? couleurs.map((c, i) => `inset ${4 + i * 4}px 0 0 ${c}`).join(", ")
        : `inset 4px 0 0 ${couleurs[0] ?? "#9A97AD"}`,
    };
  }

  const textColor   = creneau.statut === "realise" ? "white" : "#1B1633";
  const label       = creneau.situation?.titre ?? creneau.titre ?? "Disponibilité";
  const titleAttr   = nomsParticipants(creneau, referents);
  // Petit repère discret : entretien réalisé mais dont le compte rendu n'a pas encore été rédigé.
  const crManquant  = creneau.statut === "realise" && !creneau.a_cr;

  return (
    <div
      className="relative rounded-lg overflow-hidden cursor-pointer select-none w-full h-full"
      style={{ ...blockStyle, transition: "filter 0.1s" }}
      title={titleAttr || undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div className="px-1.5 py-0.5 h-full overflow-hidden"
        style={{ color: textColor, fontSize: 11, lineHeight: "1.3" }}>
        <span className="font-semibold">{formatHeure(creneau.heure_debut)}</span>
        {!compact && <span className="ml-1 opacity-85 truncate block">{label}</span>}
      </div>
      {crManquant && (
        <div className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white"
          title="Compte rendu non rédigé" />
      )}
      {hovered && (
        <div className="absolute top-0.5 right-0.5 flex gap-0.5 z-20" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClick}
            className="flex h-5 w-5 items-center justify-center rounded bg-white/90 shadow-sm hover:bg-white transition"
            title="Modifier">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1B1633" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          {!estParticipant && (
            <button onClick={(e) => { e.stopPropagation(); onRejoindre(); }}
              className="flex h-5 w-5 items-center justify-center rounded bg-white/90 shadow-sm hover:bg-white transition text-[#6656B8] font-bold text-xs"
              title="Me proposer">+</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   VueSemaine
   ============================================================ */
function VueSemaine({ semaineDeb, creneaux, referents, profile, onClickCreneau, onClickCase, onRejoindre }: {
  semaineDeb: Date; creneaux: Creneau[]; referents: Referent[]; profile: Profile;
  onClickCreneau: (c: Creneau) => void;
  onClickCase: (date: string, heure: string) => void;
  onRejoindre: (c: Creneau) => void;
}) {
  const jours      = Array.from({ length: 7 }, (_, i) => addDays(semaineDeb, i));
  const nbHeures   = HEURE_FIN - HEURE_DEBUT;
  const totalPx    = nbHeures * PX_PAR_HEURE;
  const todayISO   = dateToISO(new Date());

  const creneauxDates = creneaux.filter((c) => c.date_creneau !== null);

  /* ── Calcul des blocs avec clusters de chevauchement ────── */
  function getBlocs(iso: string) {
    const jour = creneauxDates
      .filter((c) => c.date_creneau === iso)
      .sort((a, b) => heureEnMinutes(a.heure_debut) - heureEnMinutes(b.heure_debut));

    type Bloc = { creneau: Creneau; col: number; nbCols: number; cluster: number };
    const blocs: Bloc[] = [];
    const colFins: number[] = [];
    let clusterEnd = 0;
    let clusterIdx = 0;

    for (const c of jour) {
      const debut = heureEnMinutes(c.heure_debut);
      const fin   = heureEnMinutes(c.heure_fin);

      // Si ce créneau commence après la fin de tout le cluster précédent,
      // on démarre un nouveau cluster et on réinitialise les colonnes
      if (debut >= clusterEnd) {
        clusterIdx++;
        colFins.length = 0;
      }

      let col = colFins.findIndex((f) => f <= debut);
      if (col === -1) col = colFins.length;
      colFins[col] = fin;
      clusterEnd = Math.max(clusterEnd, fin);
      blocs.push({ creneau: c, col, nbCols: 1, cluster: clusterIdx });
    }

    // Calculer nbCols par cluster (= nb max de colonnes simultanées dans ce groupe)
    const clusterMaxCols = new Map<number, number>();
    for (const b of blocs) {
      const cur = clusterMaxCols.get(b.cluster) ?? 0;
      clusterMaxCols.set(b.cluster, Math.max(cur, b.col + 1));
    }
    return blocs.map((b) => ({ ...b, nbCols: clusterMaxCols.get(b.cluster) ?? 1 }));
  }

  function handleClickZone(e: React.MouseEvent<HTMLDivElement>, iso: string) {
    const rect     = e.currentTarget.getBoundingClientRect();
    const y        = e.clientY - rect.top;
    const totalMin = (y / PX_PAR_HEURE) * 60;
    const h        = HEURE_DEBUT + Math.floor(totalMin / 60);
    const m        = Math.round((totalMin % 60) / 15) * 15;
    const hh       = String(Math.min(h, HEURE_FIN - 1)).padStart(2, "0");
    const mm       = String(m >= 60 ? 0 : m).padStart(2, "0");
    onClickCase(iso, `${hh}:${mm}`);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#EEEDF5] bg-white shadow-sm">
      <div className="min-w-[560px]" style={{ display: "grid", gridTemplateColumns: `48px repeat(7, 1fr)` }}>
        {/* En-tête */}
        <div className="border-b border-[#EEEDF5] sticky top-0 bg-white z-10" />
        {jours.map((j, i) => {
          const iso     = dateToISO(j);
          const isToday = iso === todayISO;
          return (
            <div key={i} className={`border-b border-l border-[#EEEDF5] px-1 py-2 text-center sticky top-0 z-10 ${isToday ? "bg-[#F5F3FF]" : "bg-white"}`}>
              <p className="text-[10px] text-[#9A97AD] uppercase">{JOURS_COURTS[i]}</p>
              <p className={`text-sm font-semibold ${isToday ? "text-[#6656B8]" : "text-[#1B1633]"}`}>{j.getDate()}</p>
            </div>
          );
        })}
        {/* Colonne heures */}
        <div className="relative border-r border-[#EEEDF5]" style={{ height: totalPx, gridRow: 2 }}>
          {Array.from({ length: nbHeures + 1 }, (_, h) => (
            <div key={h} className="absolute w-full flex items-start justify-end pr-1" style={{ top: h * PX_PAR_HEURE - 7 }}>
              <span className="text-[10px] text-[#B4B1C4]">{String(HEURE_DEBUT + h).padStart(2, "0")}h</span>
            </div>
          ))}
        </div>
        {/* Colonnes jours */}
        {jours.map((j, i) => {
          const iso     = dateToISO(j);
          const isToday = iso === todayISO;
          const blocs   = getBlocs(iso);
          return (
            <div key={i}
              className={`relative border-l border-[#EEEDF5] ${isToday ? "bg-[#FDFCFF]" : ""}`}
              style={{ height: totalPx, gridRow: 2 }}
              onClick={(e) => handleClickZone(e, iso)}
            >
              {Array.from({ length: nbHeures + 1 }, (_, h) => (
                <div key={h} className="absolute w-full border-t border-[#F3F2FA]" style={{ top: h * PX_PAR_HEURE }} />
              ))}
              {Array.from({ length: nbHeures }, (_, h) => (
                <div key={`d${h}`} className="absolute w-full border-t border-dashed border-[#F8F7FA]" style={{ top: h * PX_PAR_HEURE + PX_PAR_HEURE / 2 }} />
              ))}
              {isToday && <TraitHeureActuelle />}
              {blocs.map(({ creneau: c, col, nbCols }) => {
                const debutMin = heureEnMinutes(c.heure_debut);
                const dureeMin = dureeEnMinutes(c.heure_debut, c.heure_fin);
                const topPx    = ((debutMin - HEURE_DEBUT * 60) / 60) * PX_PAR_HEURE;
                const heightPx = Math.max((dureeMin / 60) * PX_PAR_HEURE, 18);
                const wPct     = 100 / nbCols;
                const lPct     = col * wPct;
                return (
                  <div key={c.id} className="absolute"
                    style={{ top: topPx + 1, height: heightPx - 2, left: `calc(${lPct}% + 1px)`, width: `calc(${wPct}% - 2px)`, zIndex: 10 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CreneauBlock creneau={c} referents={referents} profile={profile}
                      onClick={() => onClickCreneau(c)} onRejoindre={() => onRejoindre(c)}
                      compact={heightPx < 28} style={{ height: "100%" }} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   VueMois
   ============================================================ */
function VueMois({ moisRef, creneaux, referents, profile, onClickCreneau, onClickCase, onRejoindre }: {
  moisRef: Date; creneaux: Creneau[]; referents: Referent[]; profile: Profile;
  onClickCreneau: (c: Creneau) => void;
  onClickCase: (date: string, heure: string) => void;
  onRejoindre: (c: Creneau) => void;
}) {
  const premier    = startOfMonth(moisRef);
  const nbJours    = daysInMonth(moisRef);
  const debutCol   = (premier.getDay() + 6) % 7;
  const totalCells = Math.ceil((debutCol + nbJours) / 7) * 7;
  const todayISO   = dateToISO(new Date());
  const creneauxDates = creneaux.filter((c) => c.date_creneau !== null);

  return (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[#EEEDF5]">
        {JOURS_COURTS.map((j) => (
          <div key={j} className="py-2.5 text-center text-xs font-semibold text-[#9A97AD]">{j}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: totalCells }, (_, idx) => {
          const dayNum      = idx - debutCol + 1;
          const isValid     = dayNum >= 1 && dayNum <= nbJours;
          const date        = isValid ? new Date(moisRef.getFullYear(), moisRef.getMonth(), dayNum) : null;
          const iso         = date ? dateToISO(date) : "";
          const isToday     = iso === todayISO;
          const dayCreneaux = creneauxDates.filter((c) => c.date_creneau === iso);

          return (
            <div key={idx}
              className={`min-h-[88px] border-b border-r border-[#F3F2FA] p-1 ${!isValid ? "bg-[#FAFAFA]" : ""} ${isToday ? "bg-[#F5F3FF]" : ""}`}
              onClick={() => isValid && dayCreneaux.length === 0 && onClickCase(iso, "08:00")}
            >
              {isValid && (
                <>
                  <p className={`text-xs font-medium mb-1 px-0.5 ${isToday ? "text-[#6656B8]" : "text-[#6C6A80]"}`}>{dayNum}</p>
                  <div className="space-y-0.5">
                    {dayCreneaux.slice(0, 4).map((c) => (
                      <div key={c.id} style={{ height: 22 }} onClick={(e) => e.stopPropagation()}>
                        <CreneauBlock creneau={c} referents={referents} profile={profile}
                          onClick={() => onClickCreneau(c)} onRejoindre={() => onRejoindre(c)}
                          compact style={{ height: "100%" }} />
                      </div>
                    ))}
                    {dayCreneaux.length > 4 && (
                      <p className="text-[10px] text-[#9A97AD] pl-1">+{dayCreneaux.length - 4} autres</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Panneau compte rendu (créneau "réunion", sans situation)
   Lecture ouverte à tous ; écriture réservée aux participants.
   ============================================================ */
function PanneauCRReunion({ creneau, profile, canWrite, onGlobalRefresh }: {
  creneau: Creneau; profile: Profile; canWrite: boolean; onGlobalRefresh: () => void;
}) {
  const [cr, setCr]           = useState<{
    id: string; contenu: string; created_at: string; updated_at: string;
    auteur?: { prenom: string; nom: string; couleur: string };
  } | null>(null);
  const [loadingCr, setLoadingCr] = useState(true);
  const [editing, setEditing]     = useState(false);
  const [contenu, setContenu]     = useState("");
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoadingCr(true);
    const { data } = await supabase
      .from("comptes_rendus")
      .select("id, contenu, created_at, updated_at, auteur:profiles!comptes_rendus_auteur_id_fkey(prenom, nom, couleur)")
      .eq("creneau_id", creneau.id)
      .not("contenu", "like", "[NOTE]%")
      .maybeSingle();
    setCr(data as any);
    setLoadingCr(false);
  }, [creneau.id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!contenu.trim() || !canWrite) return;
    setSaving(true);
    if (cr) {
      await supabase.from("comptes_rendus").update({ contenu: contenu.trim() }).eq("id", cr.id);
    } else {
      // Le cast "as any" contourne un typage Supabase généré AVANT la migration
      // (situation_id y est encore déclaré non-nullable). À retirer une fois
      // les types régénérés via `supabase gen types typescript`.
      await supabase.from("comptes_rendus").insert({
        creneau_id:     creneau.id,
        situation_id:   null,
        auteur_id:      profile.id,
        contenu:        contenu.trim(),
        date_entretien: creneau.date_creneau,
        archive:        false,
      } as any);
    }
    setSaving(false);
    setEditing(false);
    await load();
    onGlobalRefresh();
  }

  const inputCls2 =
    "w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm text-[#1B1633] " +
    "outline-none transition placeholder:text-[#B4B1C4] focus:border-[#7C6BD6] focus:ring-4 focus:ring-[#7C6BD6]/15";

  return (
    <div className="rounded-xl border border-[#E7E6EF] bg-[#F8F7FC] p-4 space-y-3">
      <p className="text-sm font-semibold text-[#1B1633]">📝 Compte rendu de la réunion</p>

      {loadingCr ? (
        <p className="text-xs text-[#9A97AD]">Chargement…</p>
      ) : editing && canWrite ? (
        <div className="space-y-2">
          <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={6}
            placeholder="Rédigez le compte rendu de cette réunion…"
            className={inputCls2 + " resize-none"} autoFocus />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setEditing(false); setContenu(cr?.contenu ?? ""); }}
              className="flex-1 rounded-xl border border-[#E7E6EF] bg-white px-3 py-2 text-xs text-[#3A3556] hover:bg-[#F3F2FA]">
              Annuler
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !contenu.trim()}
              className="flex-1 rounded-xl bg-[#1A1440] px-3 py-2 text-xs text-white hover:bg-[#2A1E5C] disabled:opacity-50 transition">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      ) : cr ? (
        <div className="space-y-2">
          <p className="text-sm text-[#3A3556] whitespace-pre-wrap leading-relaxed">{cr.contenu}</p>
          <p className="text-[11px] text-[#9A97AD]">
            {cr.auteur?.prenom} {cr.auteur?.nom} · rédigé le {new Date(cr.created_at).toLocaleDateString("fr-FR")}
            {cr.updated_at !== cr.created_at && " (modifié)"}
          </p>
          {canWrite && (
            <button type="button" onClick={() => { setEditing(true); setContenu(cr.contenu); }}
              className="rounded-xl border border-[#E7E6EF] bg-white px-3 py-1.5 text-xs text-[#3A3556] hover:bg-[#F3F2FA] transition">
              ✏️ Modifier le compte rendu
            </button>
          )}
        </div>
      ) : (
        <div>
          <p className="text-xs text-[#9A97AD] mb-2">Aucun compte rendu rédigé pour cette réunion.</p>
          {canWrite ? (
            <button type="button" onClick={() => { setEditing(true); setContenu(""); }}
              className="rounded-xl bg-[#1A1440] px-3 py-2 text-xs font-medium text-white hover:bg-[#2A1E5C] transition">
              ✏️ Rédiger le compte rendu
            </button>
          ) : (
            <p className="text-xs text-[#B4B1C4] italic">Seuls les participants de cette réunion peuvent rédiger ce compte rendu.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Modale — Créer / modifier un créneau (daté ou non)
   ============================================================ */
function ModalCreneau({
  creneau, dateInit, heureInit, profile, situations, referents, elevesMap,
  onClose, onSuccess,
}: {
  creneau: Creneau | null; dateInit: string; heureInit: string;
  profile: Profile; situations: Situation[]; referents: Referent[];
  elevesMap: Map<string, Eleve[]>;
  onClose: () => void; onSuccess: () => void;
}) {
  const isEdit  = !!creneau;
  const isTache = isEdit && !creneau.date_creneau;

  const heureFinDefaut = () => {
    const [hh, mm] = heureInit.split(":").map(Number);
    const total    = hh * 60 + mm + 60;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  const [form, setForm] = useState({
    date_creneau:       creneau?.date_creneau             ?? dateInit,
    heure_debut:        creneau?.heure_debut?.slice(0, 5) ?? heureInit,
    heure_fin:          creneau?.heure_fin?.slice(0, 5)   ?? heureFinDefaut(),
    statut:             creneau?.statut                   ?? ("prevu" as Creneau["statut"]),
    situation_id:       creneau?.situation_id             ?? "",
    eleve_id:           creneau?.eleve_id                 ?? "",
    note:               creneau?.note                     ?? "",
    titre:              (creneau as any)?.titre           ?? "",
    // Par défaut, le référent en charge est la personne connectée qui crée le créneau.
    referent_charge_id: creneau ? (creneau.referent_charge_id ?? "") : profile.id,
  });
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Autres participants (au-delà du référent en charge) ──────────────
  const [participants, setParticipants]         = useState<string[]>(
    creneau?.participants?.map((p) => p.id) ?? []
  );
  const [showParticipants, setShowParticipants] = useState(false);
  // La liste des "autres participants" proposés exclut toujours le référent
  // actuellement désigné comme "en charge" — il n'a pas à apparaître deux fois.
  const autresReferents = referents.filter((r) => r.id !== form.referent_charge_id);

  function toggleParticipant(id: string) {
    setParticipants((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  // Si le référent en charge change et qu'il était précédemment coché comme
  // participant, on le décoche automatiquement : il ne peut pas être les deux à la fois.
  useEffect(() => {
    if (form.referent_charge_id) {
      setParticipants((prev) => prev.filter((id) => id !== form.referent_charge_id));
    }
  }, [form.referent_charge_id]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const hasSituation      = !!form.situation_id;
  const elevesDisponibles = hasSituation ? (elevesMap.get(form.situation_id) ?? []) : [];

  // Qui a le droit de lire/rédiger le compte rendu de cette réunion :
  // référent en charge, participants additionnels, ou admin. Basé sur l'état
  // déjà enregistré du créneau (pas sur des modifications non sauvegardées).
  const canWriteCR = !!creneau && (
    profile.role === "admin" ||
    creneau.referent_charge_id === profile.id ||
    (creneau.participants ?? []).some((p) => p.id === profile.id)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasSituation && !form.titre.trim()) {
      setError("Saisissez un titre pour cette réunion."); return;
    }
    if (form.heure_fin <= form.heure_debut) {
      setError("L'heure de fin doit être après l'heure de début."); return;
    }
    setLoading(true); setError(null);

    // Le créateur (referent_id) doit TOUJOURS être la personne réellement
    // connectée — jamais la personne choisie dans "Référent en charge".
    // On relit l'identité en direct pour éviter toute valeur obsolète.
    let createurId = profile.id;
    if (!isEdit) {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        setError("Impossible de confirmer votre identité de connexion. Reconnectez-vous puis réessayez.");
        setLoading(false);
        return;
      }
      createurId = authData.user.id;
    }

    const payload = {
      date_creneau:       form.date_creneau || null,
      heure_debut:        form.heure_debut,
      heure_fin:          form.heure_fin,
      statut:             form.statut,
      situation_id:       form.situation_id  || null,
      eleve_id:           form.eleve_id      || null,
      note:               form.note          || null,
      titre:              hasSituation ? null : (form.titre.trim() || null),
      // En modification, on conserve le créateur d'origine du créneau.
      // En création, c'est toujours la personne connectée — le champ
      // "Référent en charge" (form.referent_charge_id) ne détermine que
      // qui est ASSIGNÉ, jamais qui est le créateur.
      referent_id:        creneau ? creneau.referent_id : createurId,
      referent_charge_id: form.referent_charge_id || null,
    };

    async function syncParticipants(creneauId: string) {
      // On repart de zéro à chaque sauvegarde : plus simple et fiable
      // que de calculer un diff, et le volume de participants reste faible.
      await supabase.from("creneau_participants").delete().eq("creneau_id", creneauId);
      if (participants.length > 0) {
        await supabase.from("creneau_participants").insert(
          participants.map((referentId) => ({ creneau_id: creneauId, referent_id: referentId }))
        );
      }
    }

    if (isEdit) {
      const { error: err } = await supabase.from("creneaux").update(payload).eq("id", creneau!.id);
      if (err) { setError(err.message); setLoading(false); return; }
      await syncParticipants(creneau!.id);
    } else {
      const { data: nouveau, error: err } = await supabase
        .from("creneaux").insert(payload).select("id").single();
      if (err) { setError(err.message); setLoading(false); return; }
      if (nouveau) await syncParticipants(nouveau.id);
    }

    setLoading(false); onSuccess(); onClose();
  }

  async function handleDelete() {
    if (!creneau) return;
    setDeleteLoading(true);
    await supabase.from("creneaux").delete().eq("id", creneau.id);
    setDeleteLoading(false); onSuccess(); onClose();
  }

  const canEdit = !creneau
    || creneau.referent_id === profile.id
    || creneau.referent_charge_id === profile.id
    || profile.role === "admin";

  const inputCls =
    "mt-1.5 w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm " +
    "text-[#1B1633] outline-none transition placeholder:text-[#B4B1C4] " +
    "focus:border-[#7C6BD6] focus:ring-4 focus:ring-[#7C6BD6]/15";
  const labelCls = "block text-sm font-medium text-[#3A3556]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#EEEDF5] px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-[#1B1633]">
            {isTache ? "Planifier cette tâche" : isEdit ? "Modifier le créneau" : "Nouveau créneau"}
          </h2>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#9A97AD] hover:bg-[#F3F2FA] transition">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {isTache && (
            <div className="rounded-xl border border-[#E7E6EF] bg-[#F8F7FC] px-4 py-3 text-sm text-[#6C6A80]">
              Choisissez une date pour planifier cette tâche et vous l'attribuer. Elle disparaîtra de la liste et deviendra un créneau normal.
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className={labelCls}>
              Date {!isTache && <span className="text-red-500">*</span>}
              {isTache && <span className="ml-1 text-xs font-normal text-[#9A97AD]">(obligatoire pour planifier)</span>}
            </label>
            <input type="date" value={form.date_creneau}
              onChange={(e) => set("date_creneau", e.target.value)}
              className={inputCls} disabled={!canEdit} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Début <span className="text-red-500">*</span></label>
              <input type="time" required value={form.heure_debut}
                onChange={(e) => set("heure_debut", e.target.value)}
                className={inputCls} disabled={!canEdit} />
            </div>
            <div>
              <label className={labelCls}>Fin <span className="text-red-500">*</span></label>
              <input type="time" required value={form.heure_fin}
                onChange={(e) => set("heure_fin", e.target.value)}
                className={inputCls} disabled={!canEdit} />
            </div>
          </div>

          {!isTache && (
            <div>
              <label className={labelCls}>Statut</label>
              <select value={form.statut} onChange={(e) => set("statut", e.target.value)}
                className={inputCls} disabled={!canEdit}>
                <option value="prevu">Prévu</option>
                <option value="realise">Réalisé</option>
                <option value="disponible">Disponibilité libre</option>
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Type d'événement <span className="text-red-500">*</span></label>
            <select
              value={form.situation_id || REUNION_VALUE}
              onChange={(e) => {
                const val = e.target.value;
                set("situation_id", val === REUNION_VALUE ? "" : val);
                set("eleve_id", "");
              }}
              className={inputCls} disabled={!canEdit}
            >
              <option value={REUNION_VALUE}>💬 Réunion / formation (sans situation)</option>
              {situations.length > 0 && (
                <optgroup label="Situations">
                  {situations.map((s) => (
                    <option key={s.id} value={s.id}>{s.reference ? `[${s.reference}] ` : ""}{s.titre}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="mt-1 text-xs text-[#9A97AD]">
              Choisissez « Réunion / formation » pour tout événement qui n'est lié à aucune situation.
            </p>
          </div>

          {!hasSituation && (
            <div>
              <label className={labelCls}>Titre de la réunion <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Ex. : Réunion d'équipe, Formation…"
                value={form.titre} onChange={(e) => set("titre", e.target.value)}
                className={inputCls} disabled={!canEdit} />
            </div>
          )}

          {hasSituation && (
            <div>
              <label className={labelCls}>Élève interviewé <span className="ml-1 text-xs font-normal text-[#9A97AD]">(optionnel)</span></label>
              <select value={form.eleve_id} onChange={(e) => set("eleve_id", e.target.value)}
                className={inputCls} disabled={!canEdit}>
                <option value="">-- Réunion entre adultes --</option>
                {elevesDisponibles.map((el) => (
                  <option key={el.id} value={el.id}>{el.nom} {el.prenom} ({el.classe})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Référent en charge</label>
            <select value={form.referent_charge_id}
              onChange={(e) => set("referent_charge_id", e.target.value)}
              className={inputCls} disabled={!canEdit}>
              <option value="">-- Sans responsable --</option>
              {referents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.prenom} {r.nom}{r.role === "admin" ? "  ·  Admin ⚙" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button type="button" onClick={() => setShowParticipants((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-[#6656B8] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canEdit}>
              <span className={`inline-block transition-transform ${showParticipants ? "rotate-90" : ""}`}>▸</span>
              Autres participants
              {participants.length > 0 && (
                <span className="rounded-full bg-[#F5F3FF] px-2 py-0.5 text-xs text-[#6656B8]">{participants.length}</span>
              )}
            </button>

            {showParticipants && (
              <div className="mt-2 rounded-xl border border-[#E7E6EF] bg-[#F8F7FC] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">Référents participants</p>
                  <div className="flex gap-2">
                    <button type="button" disabled={!canEdit}
                      onClick={() => setParticipants(autresReferents.map((r) => r.id))}
                      className="text-[10px] text-[#6656B8] hover:underline disabled:opacity-50">Tous</button>
                    <span className="text-[#D1CFE2]">|</span>
                    <button type="button" disabled={!canEdit}
                      onClick={() => setParticipants([])}
                      className="text-[10px] text-[#6656B8] hover:underline disabled:opacity-50">Aucun</button>
                  </div>
                </div>
                {autresReferents.length === 0 ? (
                  <p className="text-xs text-[#B4B1C4] italic">Aucun autre référent disponible.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {autresReferents.map((r) => {
                      const coche = participants.includes(r.id);
                      return (
                        <label key={r.id} className={`flex items-center gap-2.5 ${canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}>
                          <div className="h-4 w-4 shrink-0 rounded border-2 transition flex items-center justify-center"
                            style={{ backgroundColor: coche ? r.couleur : "white", borderColor: coche ? r.couleur : "#D1CFE2" }}>
                            {coche && (
                              <svg viewBox="0 0 10 10" width="8" height="8" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <input type="checkbox" className="sr-only" checked={coche} disabled={!canEdit}
                            onChange={() => toggleParticipant(r.id)} />
                          <span className="text-sm text-[#3A3556] flex-1 flex items-center gap-1.5">
                            {r.prenom} {r.nom}
                            {r.role === "admin" && (
                              <span className="rounded-full bg-[#1A1440] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                                Admin
                              </span>
                            )}
                          </span>
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: r.couleur }} />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Note <span className="ml-1 text-xs font-normal text-[#9A97AD]">(optionnel)</span></label>
            <textarea value={form.note ?? ""} onChange={(e) => set("note", e.target.value)}
              rows={3} placeholder="Remarques, lieu, contexte…"
              className={inputCls + " resize-none"} disabled={!canEdit} />
          </div>

          {/* Compte rendu — uniquement pour les réunions déjà enregistrées (pas de situation) */}
          {!hasSituation && !isTache && (
            isEdit ? (
              <PanneauCRReunion creneau={creneau!} profile={profile} canWrite={canWriteCR} onGlobalRefresh={onSuccess} />
            ) : (
              <p className="text-xs text-[#9A97AD] italic">
                Vous pourrez rédiger le compte rendu de cette réunion une fois le créneau enregistré.
              </p>
            )
          )}

          <div className="flex gap-3 pt-2">
            {isEdit && canEdit && (
              <button type="button" onClick={handleDelete} disabled={deleteLoading}
                className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition disabled:opacity-50">
                {deleteLoading ? "…" : "🗑️"}
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition">
              {canEdit ? "Annuler" : "Fermer"}
            </button>
            {canEdit && (
              <button type="submit" disabled={loading}
                className="flex-1 rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2A1E5C] transition disabled:opacity-50">
                {loading ? "…" : isTache ? "Planifier" : isEdit ? "Enregistrer" : "Créer"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Modale — Créer une tâche sans date
   ============================================================ */
function ModalNouvelleTache({
  profile, situations, referents,
  onClose, onSuccess,
}: {
  profile: Profile; situations: Situation[]; referents: Referent[];
  onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    titre:        "",
    situation_id: "",
    note:         "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.situation_id && !form.titre.trim()) {
      setError("Saisissez un titre ou rattachez à une situation."); return;
    }
    setLoading(true); setError(null);

    const hasSituation = !!form.situation_id;
    const { error: err } = await supabase.from("creneaux").insert({
      date_creneau:       null,
      heure_debut:        "09:00",
      heure_fin:          "10:00",
      statut:             "prevu",
      situation_id:       form.situation_id || null,
      titre:              hasSituation ? null : (form.titre.trim() || null),
      note:               form.note || null,
      referent_id:        profile.id,
      referent_charge_id: null,
    });

    if (err) { setError(err.message); setLoading(false); return; }
    setLoading(false); onSuccess(); onClose();
  }

  const inputCls =
    "mt-1.5 w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm " +
    "text-[#1B1633] outline-none transition placeholder:text-[#B4B1C4] " +
    "focus:border-[#7C6BD6] focus:ring-4 focus:ring-[#7C6BD6]/15";
  const labelCls = "block text-sm font-medium text-[#3A3556]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EEEDF5] px-6 py-4">
          <h2 className="text-base font-semibold text-[#1B1633]">Nouvelle tâche</h2>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#9A97AD] hover:bg-[#F3F2FA] transition">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-[#6C6A80]">
            Cette tâche apparaîtra dans la liste sans date. N'importe quel référent pourra se l'attribuer en lui donnant une date.
          </p>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className={labelCls}>Situation <span className="ml-1 text-xs font-normal text-[#9A97AD]">(optionnel)</span></label>
            <select value={form.situation_id} onChange={(e) => set("situation_id", e.target.value)} className={inputCls}>
              <option value="">-- Aucune --</option>
              {situations.map((s) => (
                <option key={s.id} value={s.id}>{s.reference ? `[${s.reference}] ` : ""}{s.titre}</option>
              ))}
            </select>
          </div>

          {!form.situation_id && (
            <div>
              <label className={labelCls}>Description de la tâche <span className="text-red-500">*</span></label>
              <input type="text" placeholder="Ex. : Contacter les parents de…"
                value={form.titre} onChange={(e) => set("titre", e.target.value)}
                className={inputCls} />
            </div>
          )}

          <div>
            <label className={labelCls}>Note <span className="ml-1 text-xs font-normal text-[#9A97AD]">(optionnel)</span></label>
            <textarea value={form.note} onChange={(e) => set("note", e.target.value)}
              rows={2} placeholder="Contexte, instructions…"
              className={inputCls + " resize-none"} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2A1E5C] transition disabled:opacity-50">
              {loading ? "Création…" : "Créer la tâche"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Liste des tâches sans date
   ============================================================ */
function ListeTaches({
  taches, profile, referents,
  onPlanifier,
}: {
  taches:     Creneau[];
  profile:    Profile;
  referents:  Referent[];
  onPlanifier: (t: Creneau) => void;
}) {
  if (taches.length === 0) return (
    <p className="text-xs text-[#B4B1C4] italic">Aucune tâche en attente.</p>
  );

  return (
    <div className="space-y-2">
      {taches.map((t) => {
        const label   = t.situation?.titre ?? t.titre ?? "Tâche";
        const ref     = referents.find((r) => r.id === t.referent_id);
        const couleur = ref?.couleur ?? "#9A97AD";

        return (
          <div key={t.id}
            className="group flex items-start gap-2 rounded-xl border border-[#E7E6EF] bg-white p-3
                       hover:border-[#7C6BD6] hover:shadow-sm transition cursor-pointer"
            onClick={() => onPlanifier(t)}
          >
            <div className="mt-0.5 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: couleur }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#1B1633] truncate">{label}</p>
              {t.note && <p className="text-[10px] text-[#9A97AD] truncate mt-0.5">{t.note}</p>}
              {ref && <p className="text-[10px] text-[#B4B1C4] mt-0.5">{ref.prenom} {ref.nom}</p>}
            </div>
            <span className="text-[10px] text-[#6656B8] opacity-0 group-hover:opacity-100 transition shrink-0 mt-0.5">
              Planifier →
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   Page principale
   ============================================================ */
export default function AgendaPage() {
  const router = useRouter();
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [referents, setReferents]   = useState<Referent[]>([]);
  const [creneaux, setCreneaux]     = useState<Creneau[]>([]);
  const [situations, setSituations] = useState<Situation[]>([]);
  const [elevesMap, setElevesMap]   = useState<Map<string, Eleve[]>>(new Map());
  const [loading, setLoading]       = useState(true);

  const [vue, setVue]         = useState<VueMode>("semaine");
  const [dateRef, setDateRef] = useState(new Date());

  const [refVisibles, setRefVisibles] = useState<Set<string>>(new Set());
  const [showSansRef, setShowSansRef] = useState(true);

  const [modalCreneau, setModalCreneau]       = useState<Creneau | null | "new">(null);
  const [modalDateInit, setModalDateInit]     = useState(dateToISO(new Date()));
  const [modalHeureInit, setModalHeureInit]   = useState("08:00");
  const [modalNouveauTache, setModalNouveauTache] = useState(false);
  const [tachePlanifier, setTachePlanifier]   = useState<Creneau | null>(null);

  const loadCreneaux = useCallback(async () => {
    const [creneauxRes, crsRes] = await Promise.all([
      supabase
        .from("creneaux")
        .select(`
          id, date_creneau, heure_debut, heure_fin, statut, note, titre,
          referent_id, referent_charge_id, situation_id, eleve_id,
          referent:profiles!creneaux_referent_id_fkey ( id, nom, prenom, couleur ),
          referent_charge:profiles!creneaux_referent_charge_id_fkey ( id, nom, prenom, couleur ),
          situation:situations ( id, titre, reference ),
          eleve:eleves ( id, nom, prenom, classe ),
          participants:creneau_participants ( referent:profiles ( id, nom, prenom, couleur ) )
        `)
        .order("date_creneau", { ascending: true, nullsFirst: false })
        .order("heure_debut"),
      supabase
        .from("comptes_rendus")
        .select("creneau_id")
        .not("creneau_id", "is", null)
        .not("contenu", "like", "[NOTE]%"),
    ]);

    if (creneauxRes.data) {
      const avecCR = new Set((crsRes.data ?? []).map((cr: any) => cr.creneau_id));
      setCreneaux(creneauxRes.data.map((c: any) => ({
        ...c,
        a_cr: avecCR.has(c.id),
        participants: (c.participants ?? []).map((p: any) => p.referent).filter(Boolean),
      })));
    }
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [profRes, refRes, sitRes, elevRes] = await Promise.all([
        supabase.from("profiles").select("id, role, couleur, nom, prenom").eq("id", user.id).single(),
        supabase.from("profiles").select("id, nom, prenom, couleur, role").in("role", ["admin", "referent"]).eq("actif", true).order("nom"),
        supabase.from("situations").select("id, titre, reference").neq("statut", "cloturee").order("titre"),
        supabase.from("situation_eleves").select("situation_id, eleve:eleves(id, nom, prenom, classe)"),
      ]);

      if (profRes.data) setProfile(profRes.data);
      if (refRes.data) {
        setReferents(refRes.data);
        setRefVisibles(new Set(refRes.data.map((r: Referent) => r.id)));
      }
      if (sitRes.data) setSituations(sitRes.data);
      if (elevRes.data) {
        const map = new Map<string, Eleve[]>();
        for (const row of elevRes.data as any[]) {
          const list = map.get(row.situation_id) ?? [];
          if (row.eleve) list.push(row.eleve);
          map.set(row.situation_id, list);
        }
        setElevesMap(map);
      }

      await loadCreneaux();
      setLoading(false);
    }
    init();
  }, [router, loadCreneaux]);

  const taches         = creneaux.filter((c) => !c.date_creneau);
  const creneauxDates  = creneaux.filter((c) => !!c.date_creneau);

  const creneauxFiltres = creneauxDates.filter((c) => {
    const refId = c.referent_charge_id ?? c.referent_id;
    const estAssigne = refId ? referents.some((r) => r.id === refId) : false;
    if (!refId || !estAssigne) return showSansRef;
    return refVisibles.has(refId);
  });

  function toggleRef(id: string) {
    setRefVisibles((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleTousRef(v: boolean) {
    setRefVisibles(v ? new Set(referents.map((r) => r.id)) : new Set());
  }

  async function handleRejoindre(c: Creneau) {
    if (!profile) return;
    await supabase.from("creneaux").update({ referent_charge_id: profile.id }).eq("id", c.id);
    await loadCreneaux();
  }

  function ouvrirPlanification(t: Creneau) {
    setTachePlanifier(t);
  }

  function ouvrirCreation(date: string, heure = "08:00") {
    setModalDateInit(date);
    setModalHeureInit(heure);
    setModalCreneau("new");
  }

  const semDeb = startOfWeek(dateRef);
  const semFin = addDays(semDeb, 6);
  const titreNav = vue === "semaine"
    ? `${semDeb.getDate()} – ${semFin.getDate()} ${MOIS_LONGS[semFin.getMonth()]} ${semFin.getFullYear()}`
    : `${MOIS_LONGS[dateRef.getMonth()]} ${dateRef.getFullYear()}`;

  function navPrev() {
    if (vue === "semaine") setDateRef((d) => addDays(d, -7));
    else setDateRef((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function navNext() {
    if (vue === "semaine") setDateRef((d) => addDays(d, 7));
    else setDateRef((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  const PanneauFiltres = () => (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">Référents</p>
        <div className="flex gap-2">
          <button onClick={() => toggleTousRef(true)} className="text-[10px] text-[#6656B8] hover:underline">Tous</button>
          <span className="text-[#D1CFE2]">|</span>
          <button onClick={() => toggleTousRef(false)} className="text-[10px] text-[#6656B8] hover:underline">Aucun</button>
        </div>
      </div>
      <div className="space-y-2">
        {referents.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-center gap-2.5">
            <div className="h-4 w-4 shrink-0 rounded border-2 transition flex items-center justify-center"
              style={{ backgroundColor: refVisibles.has(r.id) ? r.couleur : "white", borderColor: refVisibles.has(r.id) ? r.couleur : "#D1CFE2" }}>
              {refVisibles.has(r.id) && (
                <svg viewBox="0 0 10 10" width="8" height="8" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <input type="checkbox" className="sr-only" checked={refVisibles.has(r.id)} onChange={() => toggleRef(r.id)} />
            <span className="text-sm text-[#3A3556] flex-1 flex items-center gap-1.5">
              {r.prenom} {r.nom}
              {r.role === "admin" && (
                <span className="rounded-full bg-[#1A1440] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                  Admin
                </span>
              )}
            </span>
            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: r.couleur }} />
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-2.5 border-t border-[#F3F2FA] pt-2">
          <div className="h-4 w-4 shrink-0 rounded border-2 transition flex items-center justify-center"
            style={{ backgroundColor: showSansRef ? "#9A97AD" : "white", borderColor: showSansRef ? "#9A97AD" : "#D1CFE2" }}>
            {showSansRef && (
              <svg viewBox="0 0 10 10" width="8" height="8" fill="none">
                <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <input type="checkbox" className="sr-only" checked={showSansRef} onChange={() => setShowSansRef((v) => !v)} />
          <span className="text-sm text-[#3A3556] flex-1">Sans référent</span>
          <span className="h-3 w-3 rounded-full shrink-0 bg-[#D1CFE2]" />
        </label>
      </div>
    </div>
  );

  const PanneauTaches = () => (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">
          Tâches à planifier
          {taches.length > 0 && (
            <span className="ml-2 rounded-full bg-[#F5F3FF] px-1.5 py-0.5 text-[10px] text-[#6656B8]">
              {taches.length}
            </span>
          )}
        </p>
        <button onClick={() => setModalNouveauTache(true)}
          className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#1A1440] text-white text-sm hover:bg-[#2A1E5C] transition"
          title="Nouvelle tâche">＋</button>
      </div>
      <ListeTaches taches={taches} profile={profile!} referents={referents} onPlanifier={ouvrirPlanification} />
    </div>
  );

  const Legende = () => (
    <div className="flex flex-wrap gap-3 text-xs text-[#6C6A80]">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-3.5 rounded border-2 border-[#6656B8] bg-white" />
        Prévu
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-3.5 rounded bg-[#6656B8]" />
        Réalisé
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-3.5 rounded bg-[#F3F2FA] border border-[#EEEDF5]" />
        Disponibilité
      </div>
      <div className="flex items-center gap-1.5">
        <span className="relative inline-block h-3.5 w-3.5 rounded bg-[#6656B8]">
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-1 ring-white" />
        </span>
        CR non rédigé
      </div>
    </div>
  );

  const BasculeVue = () => (
    <div className="flex rounded-xl border border-[#E7E6EF] overflow-hidden">
      {(["semaine","mois"] as VueMode[]).map((v) => (
        <button key={v} onClick={() => setVue(v)}
          className={`px-4 py-2 text-sm font-medium transition ${vue === v ? "bg-[#1A1440] text-white" : "bg-white text-[#3A3556] hover:bg-[#F3F2FA]"}`}>
          {v === "semaine" ? "Semaine" : "Mois"}
        </button>
      ))}
    </div>
  );

  const BoutonsNav = () => (
    <div className="flex items-center gap-1">
      <button onClick={navPrev}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E7E6EF] bg-white text-[#3A3556] hover:bg-[#F3F2FA] transition">‹</button>
      <button onClick={() => setDateRef(new Date())}
        className="px-3 py-1.5 rounded-lg border border-[#E7E6EF] bg-white text-xs text-[#3A3556] hover:bg-[#F3F2FA] transition">Aujourd'hui</button>
      <button onClick={navNext}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E7E6EF] bg-white text-[#3A3556] hover:bg-[#F3F2FA] transition">›</button>
    </div>
  );

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement de l'agenda…</span>
      </div>
    );
  }

  const vueProps = {
    creneaux:       creneauxFiltres,
    referents,
    profile,
    onClickCreneau: (c: Creneau) => setModalCreneau(c),
    onClickCase:    ouvrirCreation,
    onRejoindre:    handleRejoindre,
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1B1633]">

      {modalCreneau !== null && (
        <ModalCreneau
          creneau={modalCreneau === "new" ? null : modalCreneau}
          dateInit={modalDateInit} heureInit={modalHeureInit}
          profile={profile} situations={situations} referents={referents} elevesMap={elevesMap}
          onClose={() => setModalCreneau(null)} onSuccess={loadCreneaux}
        />
      )}
      {modalNouveauTache && (
        <ModalNouvelleTache
          profile={profile} situations={situations} referents={referents}
          onClose={() => setModalNouveauTache(false)} onSuccess={loadCreneaux}
        />
      )}
      {tachePlanifier && (
        <ModalCreneau
          creneau={tachePlanifier}
          dateInit={dateToISO(new Date())} heureInit="08:00"
          profile={profile} situations={situations} referents={referents} elevesMap={elevesMap}
          onClose={() => setTachePlanifier(null)} onSuccess={loadCreneaux}
        />
      )}

      {/* 📱 MOBILE */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[#EEEDF5] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <button onClick={() => router.push("/dashboard")}
                className="mb-0.5 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
              <h1 className="text-lg font-semibold">Agenda</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModalNouveauTache(true)}
                className="flex h-9 items-center gap-1 rounded-xl border border-[#E7E6EF] bg-white px-3 text-xs text-[#3A3556] hover:bg-[#F3F2FA] transition">
                ☑️ Tâche
              </button>
              <button onClick={() => ouvrirCreation(dateToISO(new Date()))}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A1440] text-white hover:bg-[#2A1E5C] transition text-lg">＋</button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <BasculeVue />
            <BoutonsNav />
          </div>
          <p className="mt-2 text-sm font-medium text-[#1B1633]">{titreNav}</p>
        </header>
        <main className="flex-1 px-4 py-4 space-y-4 overflow-x-auto">
          <PanneauTaches />
          <PanneauFiltres />
          <Legende />
          {vue === "semaine"
            ? <VueSemaine semaineDeb={semDeb} {...vueProps} />
            : <VueMois moisRef={dateRef} {...vueProps} />
          }
        </main>
      </div>

      {/* 💻 PC */}
      <div className="hidden lg:flex min-h-screen">
        <aside className="w-60 shrink-0 border-r border-[#EEEDF5] bg-white p-4 space-y-4 overflow-y-auto">
          <div>
            <button onClick={() => router.push("/dashboard")}
              className="text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
            <h1 className="mt-1 text-lg font-semibold">Agenda</h1>
          </div>
          <button onClick={() => ouvrirCreation(dateToISO(new Date()))}
            className="w-full rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2A1E5C] transition text-center">
            ＋ Nouveau créneau
          </button>
          <PanneauTaches />
          <PanneauFiltres />
          <Legende />
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden px-6 py-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{titreNav}</h2>
              <BoutonsNav />
            </div>
            <BasculeVue />
          </div>
          <div className="flex-1 overflow-y-auto">
            {vue === "semaine"
              ? <VueSemaine semaineDeb={semDeb} {...vueProps} />
              : <VueMois moisRef={dateRef} {...vueProps} />
            }
          </div>
        </div>
      </div>
    </div>
  );
}