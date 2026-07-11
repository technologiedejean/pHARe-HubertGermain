// >>> Ce fichier REMPLACE : app/eleves/[id]/page.tsx <<<
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Types
   ============================================================ */
type RoleEleve = "victime" | "intimidateur" | "temoin" | "lanceur_alerte";

type Eleve = {
  id: string;
  nom: string;
  prenom: string;
  classe: string;
  genre: string | null;
};

type SituationLiee = {
  id: string;
  titre: string;
  reference: string | null;
  statut: "ouverte" | "en_cours" | "cloturee";
  gravite: number | null;
  role: RoleEleve;
};

type Entretien = {
  id: string;
  date_creneau: string;
  heure_debut: string;
  heure_fin: string;
  note: string | null;
  situation_id: string;
  situation_titre: string;
  role: RoleEleve;
  referent?: { nom: string; prenom: string; couleur: string };
  cr?: {
    id: string;
    contenu: string;
    created_at: string;
    updated_at: string;
    auteur?: { nom: string; prenom: string; couleur: string };
  } | null;
};

type NoteItem = {
  id: string;
  contenu: string;
  created_at: string;
  situation_id: string;
  situation_titre: string;
  role: RoleEleve;
  auteur?: { nom: string; prenom: string; couleur: string };
};

/* ============================================================
   Constantes
   ============================================================ */
const ROLE_CONFIG: Record<RoleEleve, { label: string; bg: string; text: string; bande: string }> = {
  victime:        { label: "Victime",          bg: "#f0fdf4", text: "#065f46", bande: "#6ee7b7" },
  intimidateur:   { label: "Intimidateur",     bg: "#fef2f2", text: "#991b1b", bande: "#fca5a5" },
  temoin:         { label: "Témoin",           bg: "#eff6ff", text: "#1d4ed8", bande: "#93c5fd" },
  lanceur_alerte: { label: "Lanceur d'alerte", bg: "#f5f3ff", text: "#5b21b6", bande: "#a78bfa" },
};

const STATUT_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  ouverte:  { label: "Signalée", bg: "bg-amber-50",   text: "text-amber-700"   },
  en_cours: { label: "En cours", bg: "bg-blue-50",    text: "text-blue-700"    },
  cloturee: { label: "Traitée",  bg: "bg-emerald-50", text: "text-emerald-700" },
};

const GRAVITE_LABELS = ["", "1 – Mineur", "2 – Faible", "3 – Modéré", "4 – Grave", "5 – Très grave"];

/* ============================================================
   Helpers
   ============================================================ */
function formatDateLong(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatDateHeure(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ============================================================
   Carte entretien dépliable
   ============================================================ */
function CarteEntretien({ entretien }: { entretien: Entretien }) {
  const [ouvert, setOuvert] = useState(false);
  const router  = useRouter();
  const role    = ROLE_CONFIG[entretien.role];
  const hasCR   = !!entretien.cr;

  const aujourd_hui = new Date().toISOString().slice(0, 10);
  const estPasse    = entretien.date_creneau <= aujourd_hui;

  let icone   = "📅";
  let mention = "";
  if (estPasse && hasCR)  { icone = "✅"; mention = "Compte rendu disponible"; }
  if (estPasse && !hasCR) { icone = "⏳"; mention = "Compte rendu en attente"; }

  return (
    <div className="rounded-2xl overflow-hidden border border-[#EEEDF5] shadow-sm">
      {/* En-tête cliquable */}
      <div className="flex">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: role.bande }} />
        <div className="flex-1 cursor-pointer select-none" style={{ backgroundColor: role.bg }}
          onClick={() => setOuvert((v) => !v)}>
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug" style={{ color: role.text }}>
                {icone} {estPasse ? "Entretien réalisé le" : "Entretien prévu le"} {formatDateLong(entretien.date_creneau)}
              </p>
              {mention && (
                <p className="text-xs mt-0.5 font-medium" style={{ color: role.text, opacity: 0.75 }}>
                  {mention}
                </p>
              )}
              <p className="text-xs text-[#6C6A80] mt-1">
                {entretien.heure_debut.slice(0, 5)} – {entretien.heure_fin.slice(0, 5)}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/situations/${entretien.situation_id}`); }}
                className="mt-1 text-[10px] text-[#6656B8] hover:underline truncate block max-w-[240px]">
                → {entretien.situation_titre}
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {entretien.referent && (
                <div className="flex items-center gap-1.5">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: entretien.referent.couleur }}>
                    {entretien.referent.prenom[0]}{entretien.referent.nom[0]}
                  </div>
                  <span className="text-xs text-[#9A97AD] hidden sm:block">
                    {entretien.referent.prenom} {entretien.referent.nom}
                  </span>
                </div>
              )}
              <div className={`text-[#9A97AD] transition-transform duration-200 ${ouvert ? "rotate-180" : ""}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu déplié */}
      {ouvert && (
        <div className="border-t border-[#EEEDF5] bg-white px-5 py-4">
          {hasCR ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                {entretien.cr!.auteur && (
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: entretien.cr!.auteur.couleur ?? "#9A97AD" }}>
                    {entretien.cr!.auteur.prenom[0]}{entretien.cr!.auteur.nom[0]}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-[#1B1633]">
                    {entretien.cr!.auteur?.prenom} {entretien.cr!.auteur?.nom}
                  </p>
                  <p className="text-xs text-[#9A97AD]">
                    Rédigé le {formatDateHeure(entretien.cr!.created_at)}
                    {entretien.cr!.updated_at !== entretien.cr!.created_at &&
                      ` · Modifié le ${formatDateHeure(entretien.cr!.updated_at)}`}
                  </p>
                </div>
              </div>
              <p className="text-sm text-[#3A3556] whitespace-pre-wrap leading-relaxed">
                {entretien.cr!.contenu}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#9A97AD] text-center py-2">
              Aucun compte rendu rédigé pour cet entretien.
            </p>
          )}
          {entretien.note && (
            <div className="mt-3 rounded-xl border border-[#EEEDF5] bg-[#F8F7FC] px-4 py-3">
              <p className="text-xs text-[#9A97AD] mb-1">Note du créneau</p>
              <p className="text-sm text-[#3A3556] italic">{entretien.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Carte note
   ============================================================ */
function CarteNote({ note }: { note: NoteItem }) {
  const router = useRouter();
  const role   = ROLE_CONFIG[note.role];

  return (
    <div className="flex rounded-2xl overflow-hidden border border-[#EEEDF5] shadow-sm">
      <div className="w-1.5 shrink-0" style={{ backgroundColor: role.bande }} />
      <div className="flex-1 bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#3A3556] whitespace-pre-wrap leading-relaxed">{note.contenu}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {note.auteur && (
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: note.auteur.couleur ?? "#9A97AD" }}>
                    {note.auteur.prenom[0]}{note.auteur.nom[0]}
                  </div>
                  <span className="text-xs text-[#9A97AD]">{note.auteur.prenom} {note.auteur.nom}</span>
                </div>
              )}
              <span className="text-xs text-[#B4B1C4]">· {formatDateHeure(note.created_at)}</span>
              <button
                onClick={() => router.push(`/situations/${note.situation_id}`)}
                className="text-[10px] text-[#6656B8] hover:underline">
                → {note.situation_titre}
              </button>
            </div>
          </div>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: role.bg, color: role.text }}>
            {role.label}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Page principale
   ============================================================ */
export default function ProfilElevePage() {
  const router  = useRouter();
  const params  = useParams();
  const eleveId = params.id as string;

  const [eleve, setEleve]           = useState<Eleve | null>(null);
  const [situations, setSituations] = useState<SituationLiee[]>([]);
  const [entretiens, setEntretiens] = useState<Entretien[]>([]);
  const [notes, setNotes]           = useState<NoteItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [onglet, setOnglet]         = useState<"entretiens" | "notes">("entretiens");

  const load = useCallback(async () => {
    // 1. Infos élève
    const { data: eleveData } = await supabase
      .from("eleves")
      .select("id, nom, prenom, classe, genre")
      .eq("id", eleveId)
      .single();
    if (!eleveData) { router.push("/eleves"); return; }
    setEleve(eleveData);

    // 2. Situations où l'élève est mentionné (avec son rôle)
    const { data: sitElevesData } = await supabase
      .from("situation_eleves")
      .select(`role, situation:situations(id, titre, reference, statut, gravite)`)
      .eq("eleve_id", eleveId);

    const sits: SituationLiee[] = (sitElevesData ?? [])
      .filter((se: any) => se.situation)
      .map((se: any) => ({ ...se.situation, role: se.role }));
    setSituations(sits);

    const situationIds = sits.map((s) => s.id);
    if (situationIds.length === 0) {
      setEntretiens([]); setNotes([]); setLoading(false); return;
    }

    // Map situation_id → { titre, role }
    const sitMap = new Map(sits.map((s) => [s.id, { titre: s.titre, role: s.role }]));

    // 3. Créneaux liés à ces situations ET où cet élève a été entendu
    const { data: creneauxData } = await supabase
      .from("creneaux")
      .select(`
        id, date_creneau, heure_debut, heure_fin, statut, note, situation_id,
        referent_charge:profiles!creneaux_referent_charge_id_fkey(nom, prenom, couleur),
        referent:profiles!creneaux_referent_id_fkey(nom, prenom, couleur)
      `)
      .in("situation_id", situationIds)
      .eq("eleve_id", eleveId)
      .not("date_creneau", "is", null)
      .neq("statut", "disponible")
      .order("date_creneau", { ascending: false })
      .order("heure_debut",  { ascending: false });

    const creneauIds = (creneauxData ?? []).map((c: any) => c.id);

    // 4. CR liés à ces créneaux
    const { data: crsData } = creneauIds.length > 0
      ? await supabase
          .from("comptes_rendus")
          .select(`
            id, contenu, creneau_id, created_at, updated_at,
            auteur:profiles!comptes_rendus_auteur_id_fkey(nom, prenom, couleur)
          `)
          .in("creneau_id", creneauIds)
          .not("contenu", "like", "[NOTE]%")
      : { data: [] };

    // Aussi charger les CR par date_entretien (rétrocompat)
    const { data: crsParDateData } = await supabase
      .from("comptes_rendus")
      .select(`
        id, contenu, creneau_id, date_entretien, created_at, updated_at,
        auteur:profiles!comptes_rendus_auteur_id_fkey(nom, prenom, couleur)
      `)
      .in("situation_id", situationIds)
      .is("creneau_id", null)
      .not("contenu", "like", "[NOTE]%");

    // Map creneau_id → CR
    const crParCreneauId = new Map((crsData ?? []).map((cr: any) => [cr.creneau_id, cr]));
    // Map date → CR (fallback rétrocompat)
    const crParDate = new Map((crsParDateData ?? []).map((cr: any) => [cr.date_entretien, cr]));

    const entretiensList: Entretien[] = (creneauxData ?? []).map((c: any) => {
      const sit = sitMap.get(c.situation_id);
      return {
        id:              c.id,
        date_creneau:    c.date_creneau,
        heure_debut:     c.heure_debut,
        heure_fin:       c.heure_fin,
        note:            c.note,
        situation_id:    c.situation_id,
        situation_titre: sit?.titre ?? "Situation inconnue",
        role:            sit?.role  ?? "temoin",
        referent:        c.referent_charge ?? c.referent ?? undefined,
        cr:              crParCreneauId.get(c.id) ?? crParDate.get(c.date_creneau) ?? null,
      };
    });
    setEntretiens(entretiensList);

    // 5. Notes liées à ces situations
    const { data: notesData } = await supabase
      .from("comptes_rendus")
      .select(`
        id, contenu, created_at, situation_id,
        auteur:profiles!comptes_rendus_auteur_id_fkey(nom, prenom, couleur)
      `)
      .in("situation_id", situationIds)
      .like("contenu", "[NOTE]%")
      .order("created_at", { ascending: false });

    const notesList: NoteItem[] = (notesData ?? []).map((n: any) => {
      const sit = sitMap.get(n.situation_id);
      return {
        id:              n.id,
        contenu:         n.contenu.replace(/^\[NOTE\]\s*/, ""),
        created_at:      n.created_at,
        situation_id:    n.situation_id,
        situation_titre: sit?.titre ?? "Situation inconnue",
        role:            sit?.role  ?? "temoin",
        auteur:          n.auteur,
      };
    });
    setNotes(notesList);
    setLoading(false);
  }, [eleveId, router]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      await load();
    }
    init();
  }, [router, load]);

  if (loading || !eleve) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement…</span>
      </div>
    );
  }

  const rolesSituations = [...new Set(situations.map((s) => s.role))];

  /* ── Composants internes ── */
  const Entete = () => (
    <div className="flex items-start gap-4">
      <div className="h-16 w-16 shrink-0 rounded-2xl flex items-center justify-center text-2xl font-bold text-white bg-[#1A1440]">
        {eleve.prenom[0]}{eleve.nom[0]}
      </div>
      <div className="flex-1">
        <h1 className="text-2xl font-semibold text-[#1B1633]">{eleve.prenom} {eleve.nom}</h1>
        <p className="text-sm text-[#6C6A80] mt-0.5">{eleve.classe}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {rolesSituations.map((role) => {
            const cfg   = ROLE_CONFIG[role];
            const count = situations.filter((s) => s.role === role).length;
            return (
              <span key={role} className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                {cfg.label} ({count} situation{count > 1 ? "s" : ""})
              </span>
            );
          })}
          {situations.length === 0 && (
            <span className="text-sm text-[#9A97AD]">Aucune situation enregistrée</span>
          )}
        </div>
      </div>
    </div>
  );

  const SituationsLiees = () => (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white overflow-hidden">
      <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#9A97AD] border-b border-[#F3F2FA]">
        Situations
      </p>
      {situations.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-[#B4B1C4]">Aucune situation.</p>
      ) : (
        <div className="divide-y divide-[#F3F2FA]">
          {situations.map((s) => {
            const role   = ROLE_CONFIG[s.role];
            const statut = STATUT_CONFIG[s.statut];
            return (
              <button key={s.id}
                onClick={() => router.push(`/situations/${s.id}`)}
                className="flex w-full items-start gap-3 px-4 py-3 hover:bg-[#F8F7FC] transition text-left">
                <div className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: role.bande }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1B1633] truncate">
                    {s.reference ? `[${s.reference}] ` : ""}{s.titre}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs font-medium" style={{ color: role.text }}>{role.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statut.bg} ${statut.text}`}>
                      {statut.label}
                    </span>
                    {s.gravite && (
                      <span className="text-[10px] text-[#9A97AD]">{GRAVITE_LABELS[s.gravite]}</span>
                    )}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B4B1C4" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const TabBar = () => (
    <div className="flex border-b border-[#EEEDF5] gap-1">
      {([
        { key: "entretiens" as const, label: `Entretiens (${entretiens.length})` },
        { key: "notes"      as const, label: `Notes (${notes.length})`           },
      ]).map((o) => (
        <button key={o.key} onClick={() => setOnglet(o.key)}
          className={`px-5 py-3 text-sm font-medium transition border-b-2 -mb-px ${
            onglet === o.key
              ? "border-[#6656B8] text-[#6656B8]"
              : "border-transparent text-[#6C6A80] hover:text-[#1B1633]"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );

  const ContenuOnglet = () => {
    if (onglet === "entretiens") {
      if (entretiens.length === 0) return (
        <div className="py-12 text-center">
          <p className="text-sm text-[#9A97AD]">Aucun entretien enregistré pour cet élève.</p>
          <p className="mt-1 text-xs text-[#B4B1C4]">
            Les entretiens apparaissent ici dès qu'un créneau est lié à une situation impliquant cet élève.
          </p>
        </div>
      );
      return (
        <div className="space-y-3">
          {entretiens.map((e) => <CarteEntretien key={e.id} entretien={e} />)}
        </div>
      );
    }

    if (notes.length === 0) return (
      <div className="py-12 text-center">
        <p className="text-sm text-[#9A97AD]">Aucune note pour cet élève.</p>
      </div>
    );
    return (
      <div className="space-y-3">
        {notes.map((n) => <CarteNote key={n.id} note={n} />)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1B1633]">

      {/* 📱 MOBILE */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[#EEEDF5] bg-white shadow-sm px-5 py-4">
          <button onClick={() => router.push("/eleves")}
            className="mb-2 text-xs text-[#6656B8] hover:underline">← Élèves</button>
          <Entete />
        </header>
        <main className="flex-1 px-5 py-4 space-y-4">
          <SituationsLiees />
          <TabBar />
          <ContenuOnglet />
        </main>
      </div>

      {/* 💻 PC — 2 colonnes */}
      <div className="hidden lg:block max-w-5xl mx-auto px-8 py-8">
        <button onClick={() => router.push("/eleves")}
          className="mb-4 text-xs text-[#6656B8] hover:underline">← Retour aux élèves</button>
        <div className="mb-6"><Entete /></div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <SituationsLiees />
          </div>
          <div className="col-span-2 space-y-4">
            <TabBar />
            <ContenuOnglet />
          </div>
        </div>
      </div>
    </div>
  );
}