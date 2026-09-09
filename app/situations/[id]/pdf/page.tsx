// >>> NOUVEAU FICHIER : app/situations/[id]/pdf/page.tsx <<<
// Vue "dossier" d'une situation : format A4, autant de pages que nécessaire.
// Deux sorties :
//   - « Imprimer »        → boîte d'impression du navigateur (papier ou PDF)
//   - « Enregistrer PDF » → téléchargement direct d'un fichier .pdf
//                           (html2pdf.js : html2canvas + jsPDF, chargé à la demande)
// Dépendance : npm install html2pdf.js  (+ fichier types/html2pdf.d.ts)
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Types
   ============================================================ */
type StatutSituation = "ouverte" | "en_cours" | "cloturee";
type RoleActeur      = "victime" | "intimidateur" | "temoin" | "lanceur_alerte";

type Personne = { nom: string; prenom: string };
type Eleve    = { nom: string; prenom: string; classe: string };

type Acteur = {
  id: string;
  role: RoleActeur;
  lanceur_libre: string | null;
  eleve: Eleve | null;
};

type Situation = {
  id: string;
  reference: string | null;
  titre: string;
  description: string | null;
  statut: StatutSituation;
  gravite: number | null;
  date_signalement: string | null;
  created_at: string;
  updated_at: string;
  createur: Personne | null;
  situation_eleves: Acteur[];
  situation_motifs: { motif: { label: string } | null }[];
  situation_manifestations: { manifestation: { label: string } | null }[];
  situation_lieux: { lieu: { label: string } | null }[];
};

type Creneau = {
  id: string;
  date_creneau: string | null;
  heure_debut: string;
  heure_fin: string;
  statut: string;
  titre: string | null;
  note: string | null;
  eleve: Eleve | null;
  referent: Personne | null;
  referent_charge: Personne | null;
};

type CompteRendu = {
  id: string;
  creneau_id: string | null;
  date_entretien: string | null;
  contenu: string;
  archive: boolean;
  created_at: string;
  updated_at: string;
  auteur: Personne | null;
};

/* ============================================================
   Constantes & utilitaires
   ============================================================ */
const STATUT_LABELS: Record<StatutSituation, string> = {
  ouverte:  "Signalée",
  en_cours: "En cours de traitement",
  cloturee: "Traitée",
};

const GRAVITE_LABELS = ["Non évalué", "1 – Mineur", "2 – Faible", "3 – Modéré", "4 – Grave", "5 – Très grave"];

const ROLE_LABELS: Record<RoleActeur, string> = {
  victime:        "Victime(s)",
  intimidateur:   "Intimidateur(s)",
  temoin:         "Témoin(s)",
  lanceur_alerte: "Lanceur(s) d'alerte",
};

const PREFIXE_NOTE = "[NOTE]";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtDateHeure(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtHeure(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5).replace(":", "h");
}
function nomPersonne(p: Personne | null | undefined): string {
  return p ? `${p.prenom} ${p.nom}` : "—";
}
function nomActeur(a: Acteur): string {
  if (a.eleve) return `${a.eleve.nom} ${a.eleve.prenom} (${a.eleve.classe})`;
  if (a.lanceur_libre) return `${a.lanceur_libre} (hors élève)`;
  return "—";
}
function estNote(cr: CompteRendu): boolean {
  return cr.contenu.startsWith(PREFIXE_NOTE);
}
function contenuNote(cr: CompteRendu): string {
  return cr.contenu.slice(PREFIXE_NOTE.length).trim();
}

/* ============================================================
   Styles d'impression (A4)
   ============================================================ */
const PRINT_STYLES = `
  @page { size: A4; margin: 16mm 14mm 18mm 14mm; }

  .a4 { width: 210mm; min-height: 297mm; padding: 16mm 14mm; margin: 0 auto; background: white; }

  .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  .break-before { break-before: page; page-break-before: always; }
  h1, h2, h3 { break-after: avoid; page-break-after: avoid; }

  /* Contenu riche des comptes rendus (issu de l'éditeur) */
  .cr-html { font-size: 10.5pt; line-height: 1.55; color: #1B1633; word-break: break-word; }
  .cr-html p, .cr-html li, .cr-html blockquote { break-inside: avoid; page-break-inside: avoid; }
  .cr-html p { margin: 0 0 0.4em 0; }
  .cr-html ul, .cr-html ol { margin: 0.2em 0 0.5em 1.4em; }
  .cr-html ul { list-style: disc; } .cr-html ol { list-style: decimal; }
  .cr-html h1, .cr-html h2, .cr-html h3 { font-weight: 600; margin: 0.6em 0 0.3em; }
  .cr-html h1 { font-size: 13pt; } .cr-html h2 { font-size: 12pt; } .cr-html h3 { font-size: 11pt; }
  .cr-html a { color: #6656B8; text-decoration: underline; }
  .cr-html img { max-width: 100%; height: auto; display: block; margin: 0.4em 0; break-inside: avoid; }
  .cr-html blockquote { border-left: 3px solid #D1CFE2; margin: 0.4em 0; padding-left: 0.8em; color: #3A3556; }
  .cr-html .mention, .cr-html [data-mention], .cr-html [data-reference] {
    background: #F5F3FF; color: #6656B8; border-radius: 4px; padding: 0 3px; font-weight: 500;
  }

  @media print {
    html, body { background: white !important; }
    .no-print { display: none !important; }
    .a4 { width: auto; min-height: 0; padding: 0; margin: 0; box-shadow: none; }
  }
`;

/* ============================================================
   Blocs d'affichage
   ============================================================ */
function Titre2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="avoid-break mt-8 mb-3 border-b-2 border-[#1A1440] pb-1 text-[13pt] font-semibold uppercase tracking-wide text-[#1A1440]">
      {children}
    </h2>
  );
}

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="avoid-break flex gap-3 py-1 text-[10.5pt]">
      <span className="w-[42mm] shrink-0 text-[#6C6A80]">{label}</span>
      <span className="flex-1 text-[#1B1633]">{children}</span>
    </div>
  );
}

function BlocCR({ cr }: { cr: CompteRendu }) {
  return (
    <div className="avoid-break mt-3 rounded-lg border border-[#E7E6EF] p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-[#F3F2FA] pb-1.5 text-[9.5pt]">
        <span className="font-semibold text-[#1A1440]">
          Compte rendu — {nomPersonne(cr.auteur)}
          {cr.archive && <span className="ml-2 rounded bg-[#F3F2FA] px-1.5 py-0.5 text-[8.5pt] font-normal text-[#6C6A80]">archivé</span>}
        </span>
        <span className="text-[#6C6A80]">
          {cr.date_entretien ? `Entretien du ${fmtDate(cr.date_entretien)} · ` : ""}
          rédigé le {fmtDateHeure(cr.created_at)}
          {cr.updated_at !== cr.created_at ? ` · modifié le ${fmtDateHeure(cr.updated_at)}` : ""}
        </span>
      </div>
      <div className="cr-html" dangerouslySetInnerHTML={{ __html: cr.contenu }} />
    </div>
  );
}

/* ============================================================
   Page
   ============================================================ */
export default function SituationPdfPage() {
  const params       = useParams<{ id: string }>();
  const router       = useRouter();

  const [situation, setSituation] = useState<Situation | null>(null);
  const [creneaux, setCreneaux]   = useState<Creneau[]>([]);
  const [crs, setCrs]             = useState<CompteRendu[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [exportErreur, setExportErreur]   = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const id = params.id;

      const [sitRes, crenRes, crRes] = await Promise.all([
        supabase
          .from("situations")
          .select(`
            id, reference, titre, description, statut, gravite,
            date_signalement, created_at, updated_at,
            createur:profiles!situations_cree_par_fkey ( nom, prenom ),
            situation_eleves ( id, role, lanceur_libre, eleve:eleves ( nom, prenom, classe ) ),
            situation_motifs ( motif:motifs ( label ) ),
            situation_manifestations ( manifestation:manifestations ( label ) ),
            situation_lieux ( lieu:lieux ( label ) )
          `)
          .eq("id", id)
          .single(),
        supabase
          .from("creneaux")
          .select(`
            id, date_creneau, heure_debut, heure_fin, statut, titre, note,
            eleve:eleves ( nom, prenom, classe ),
            referent:profiles!creneaux_referent_id_fkey ( nom, prenom ),
            referent_charge:profiles!creneaux_referent_charge_id_fkey ( nom, prenom )
          `)
          .eq("situation_id", id)
          .order("date_creneau", { ascending: true })
          .order("heure_debut", { ascending: true }),
        supabase
          .from("comptes_rendus")
          .select(`
            id, creneau_id, date_entretien, contenu, archive, created_at, updated_at,
            auteur:profiles!comptes_rendus_auteur_id_fkey ( nom, prenom )
          `)
          .eq("situation_id", id)
          .order("created_at", { ascending: true }),
      ]);

      if (sitRes.error || !sitRes.data) {
        setError("Situation introuvable ou accès non autorisé.");
        setLoading(false);
        return;
      }

      setSituation(sitRes.data as unknown as Situation);
      setCreneaux((crenRes.data ?? []) as unknown as Creneau[]);
      setCrs((crRes.data ?? []) as unknown as CompteRendu[]);
      setLoading(false);
    }
    load();
  }, [params.id, router]);

  // Titre du document → nom de fichier proposé par le navigateur
  useEffect(() => {
    if (!situation) return;
    const ancien = document.title;
    document.title = `pHARe – ${situation.reference ?? situation.titre}`;
    return () => { document.title = ancien; };
  }, [situation]);

  /* ── Enregistrement direct en PDF ─────────────────────────── */
  async function enregistrerPdf() {
    if (!docRef.current || !situation || exportEnCours) return;
    setExportEnCours(true); setExportErreur(null);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const base = (situation.reference ?? situation.titre)
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")
        .slice(0, 60) || "situation";
      await html2pdf()
        .set({
          filename:    `pHARe-${base}.pdf`,
          margin:      [16, 14, 18, 14],              // mm : haut, droite, bas, gauche
          image:       { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false },
          jsPDF:       { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak:   { mode: ["css", "legacy"], avoid: [".avoid-break", "img", "tr"] },
        })
        .from(docRef.current)
        .save();
    } catch (e: any) {
      console.error(e);
      setExportErreur("L'enregistrement du PDF a échoué. Utilisez « Imprimer » puis « Enregistrer au format PDF ».");
    } finally {
      setExportEnCours(false);
    }
  }

  /* ── États d'attente ──────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Préparation du dossier…</span>
      </div>
    );
  }
  if (error || !situation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FBFBFD] px-6">
        <p className="text-sm text-red-600">{error ?? "Erreur inconnue."}</p>
        <button onClick={() => window.close()} className="text-sm text-[#6656B8] hover:underline">Fermer</button>
      </div>
    );
  }

  /* ── Préparation des données ──────────────────────────────── */
  const acteursParRole = (role: RoleActeur) => situation.situation_eleves.filter((a) => a.role === role);
  const motifs         = situation.situation_motifs.map((m) => m.motif?.label).filter(Boolean) as string[];
  const manifestations = situation.situation_manifestations.map((m) => m.manifestation?.label).filter(Boolean) as string[];
  const lieux          = situation.situation_lieux.map((l) => l.lieu?.label).filter(Boolean) as string[];

  const crsEntretien = crs.filter((c) => !estNote(c));
  const notes        = crs.filter(estNote);

  const entretiens   = creneaux.filter((c) => !!c.date_creneau);
  const taches       = creneaux.filter((c) => !c.date_creneau);
  const crsOrphelins = crsEntretien
    .filter((c) => !c.creneau_id || !creneaux.some((k) => k.id === c.creneau_id))
    .sort((a, b) => (a.date_entretien ?? a.created_at).localeCompare(b.date_entretien ?? b.created_at));

  const nbCr = crsEntretien.length;

  // Référents intervenus : ceux qui ont mené un entretien (référent en charge,
  // sinon référent du créneau) et/ou rédigé un compte rendu ou une note.
  const intervenants = new Map<string, { nom: Personne; entretiens: number; crs: number; notes: number }>();
  const cle = (p: Personne) => `${p.nom}|${p.prenom}`;
  const ajouter = (p: Personne | null, champ: "entretiens" | "crs" | "notes") => {
    if (!p) return;
    const k = cle(p);
    const cur = intervenants.get(k) ?? { nom: p, entretiens: 0, crs: 0, notes: 0 };
    cur[champ] += 1;
    intervenants.set(k, cur);
  };
  for (const c of entretiens) ajouter(c.referent_charge ?? c.referent, "entretiens");
  for (const cr of crsEntretien) ajouter(cr.auteur, "crs");
  for (const n of notes) ajouter(n.auteur, "notes");
  const listeIntervenants = Array.from(intervenants.values())
    .sort((a, b) => b.entretiens - a.entretiens || b.crs - a.crs || a.nom.nom.localeCompare(b.nom.nom));

  return (
    <div className="min-h-screen bg-[#E9E8F1] text-[#1B1633]">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* ── Barre d'outils (écran uniquement) ─────────────────── */}
      <div className="no-print sticky top-0 z-10 border-b border-[#D1CFE2] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <button onClick={() => router.push("/situations")}
              className="text-xs text-[#6656B8] hover:underline">← Situations</button>
            <p className="truncate text-sm font-semibold">Dossier de la situation</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => router.push(`/situations/${situation.id}`)}
              className="rounded-xl border border-[#E7E6EF] bg-white px-3 py-2 text-sm text-[#3A3556] hover:bg-[#F3F2FA] transition">
              Voir la situation
            </button>
            <button onClick={() => window.print()}
              className="rounded-xl border border-[#1A1440] bg-white px-4 py-2 text-sm font-medium text-[#1A1440] hover:bg-[#F5F3FF] transition">
              🖨️ Imprimer
            </button>
            <button onClick={enregistrerPdf} disabled={exportEnCours}
              className="rounded-xl bg-[#1A1440] px-4 py-2 text-sm font-medium text-white hover:bg-[#2A1E5C] transition disabled:opacity-60">
              {exportEnCours ? "Génération…" : "⬇️ Enregistrer le PDF"}
            </button>
          </div>
        </div>
        {exportErreur && (
          <div className="mx-auto max-w-[210mm] px-4 pb-3">
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{exportErreur}</p>
          </div>
        )}
      </div>

      {/* ── Document A4 ───────────────────────────────────────── */}
      <div className="py-6 print:py-0">
        <div className="a4 shadow-xl">
         <div ref={docRef}>

          {/* En-tête */}
          <div className="avoid-break flex items-start justify-between gap-6 border-b-4 border-[#1A1440] pb-4">
            <div className="min-w-0">
              <p className="text-[9pt] font-semibold uppercase tracking-[0.2em] text-[#6656B8]">
                pHARe · Collège Hubert Germain
              </p>
              <h1 className="mt-1 text-[18pt] font-bold leading-tight text-[#1A1440]">{situation.titre}</h1>
              {situation.reference && (
                <p className="mt-0.5 font-mono text-[9.5pt] text-[#6C6A80]">Réf. {situation.reference}</p>
              )}
            </div>
            <div className="shrink-0 text-right text-[9pt] text-[#6C6A80]">
              <p>Dossier édité le</p>
              <p className="font-medium text-[#1B1633]">{fmtDateHeure(new Date().toISOString())}</p>
            </div>
          </div>

          <p className="avoid-break mt-2 text-[8.5pt] italic text-[#9A97AD]">
            Document confidentiel — données à caractère personnel relatives à des mineurs. Ne pas diffuser en dehors de l'équipe pHARe.
          </p>

          {/* 1. Synthèse */}
          <Titre2>1. Synthèse de la situation</Titre2>
          <div className="avoid-break">
            <Ligne label="Statut">{STATUT_LABELS[situation.statut]}</Ligne>
            <Ligne label="Gravité">{GRAVITE_LABELS[situation.gravite ?? 0]}</Ligne>
            <Ligne label="Date du signalement">{fmtDate(situation.date_signalement)}</Ligne>
            <Ligne label="Créée par">{nomPersonne(situation.createur)} · le {fmtDateHeure(situation.created_at)}</Ligne>
            <Ligne label="Dernière mise à jour">{fmtDateHeure(situation.updated_at)}</Ligne>
            <Ligne label="Entretiens / CR">
              {entretiens.length} entretien(s) planifié(s) · {nbCr} compte(s) rendu(s) · {notes.length} note(s)
            </Ligne>
          </div>

          {/* 2. Personnes impliquées */}
          <Titre2>2. Personnes impliquées</Titre2>
          <div className="avoid-break">
            {(["victime", "intimidateur", "temoin", "lanceur_alerte"] as RoleActeur[]).map((role) => {
              const liste = acteursParRole(role);
              return (
                <Ligne key={role} label={ROLE_LABELS[role]}>
                  {liste.length === 0
                    ? <span className="text-[#B4B1C4]">—</span>
                    : liste.map((a) => <span key={a.id} className="block">{nomActeur(a)}</span>)}
                </Ligne>
              );
            })}
          </div>

          {/* 3. Qualification */}
          <Titre2>3. Qualification</Titre2>
          <div className="avoid-break">
            <Ligne label="Motifs">{motifs.length ? motifs.join(", ") : <span className="text-[#B4B1C4]">Non renseigné</span>}</Ligne>
            <Ligne label="Manifestations">{manifestations.length ? manifestations.join(", ") : <span className="text-[#B4B1C4]">Non renseigné</span>}</Ligne>
            <Ligne label="Lieux">{lieux.length ? lieux.join(", ") : <span className="text-[#B4B1C4]">Non renseigné</span>}</Ligne>
          </div>

          {/* 4. Description */}
          <Titre2>4. Description et contexte</Titre2>
          {situation.description
            ? <p className="avoid-break whitespace-pre-wrap text-[10.5pt] leading-relaxed">{situation.description}</p>
            : <p className="text-[10.5pt] text-[#B4B1C4]">Aucune description saisie.</p>}

          {/* 5. Entretiens */}
          <Titre2>5. Entretiens ({entretiens.length})</Titre2>
          {entretiens.length === 0 && crsOrphelins.length === 0 && (
            <p className="text-[10.5pt] text-[#B4B1C4]">Aucun entretien planifié pour cette situation.</p>
          )}

          {entretiens.map((c, idx) => {
            const crsDuCreneau = crsEntretien.filter((cr) => cr.creneau_id === c.id);
            const personneRencontree = c.eleve
              ? `${c.eleve.nom} ${c.eleve.prenom} (${c.eleve.classe})`
              : c.titre ?? "Non précisée";
            const mene = c.referent_charge ?? c.referent;
            return (
              <div key={c.id} className="mt-5">
                <div className="avoid-break rounded-lg bg-[#F8F7FC] px-3 py-2">
                  <p className="text-[11pt] font-semibold text-[#1A1440]">
                    Entretien {idx + 1} — {fmtDate(c.date_creneau)}
                    <span className="ml-2 font-normal text-[#6C6A80]">{fmtHeure(c.heure_debut)} – {fmtHeure(c.heure_fin)}</span>
                  </p>
                  <div className="mt-1 grid grid-cols-2 gap-x-6 text-[9.5pt] text-[#3A3556]">
                    <p><span className="text-[#6C6A80]">Personne rencontrée : </span>{personneRencontree}</p>
                    <p><span className="text-[#6C6A80]">Mené par : </span>{nomPersonne(mene)}</p>
                    {c.titre && c.eleve && <p className="col-span-2"><span className="text-[#6C6A80]">Objet : </span>{c.titre}</p>}
                    {c.note && <p className="col-span-2"><span className="text-[#6C6A80]">Note de planification : </span>{c.note}</p>}
                  </div>
                </div>
                {crsDuCreneau.length === 0
                  ? <p className="avoid-break mt-2 pl-3 text-[9.5pt] italic text-[#9A97AD]">Aucun compte rendu rédigé pour cet entretien.</p>
                  : crsDuCreneau.map((cr) => <BlocCR key={cr.id} cr={cr} />)}
              </div>
            );
          })}

          {crsOrphelins.length > 0 && (
            <div className="mt-6">
              <h3 className="avoid-break text-[11pt] font-semibold text-[#1A1440]">Comptes rendus non rattachés à un créneau</h3>
              {crsOrphelins.map((cr) => <BlocCR key={cr.id} cr={cr} />)}
            </div>
          )}

          {taches.length > 0 && (
            <div className="avoid-break mt-6">
              <h3 className="text-[11pt] font-semibold text-[#1A1440]">Tâches à planifier</h3>
              <ul className="mt-1 list-disc pl-5 text-[10pt]">
                {taches.map((t) => (
                  <li key={t.id}>
                    {t.titre ?? "Tâche sans titre"}
                    {t.eleve && ` — ${t.eleve.nom} ${t.eleve.prenom}`}
                    <span className="text-[#6C6A80]"> ({nomPersonne(t.referent_charge ?? t.referent)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 6. Notes */}
          <Titre2>6. Notes de suivi ({notes.length})</Titre2>
          {notes.length === 0
            ? <p className="text-[10.5pt] text-[#B4B1C4]">Aucune note.</p>
            : notes.map((n) => (
                <div key={n.id} className="avoid-break mt-2 border-l-4 border-[#7C6BD6] pl-3">
                  <p className="text-[9pt] text-[#6C6A80]">
                    <span className="font-semibold text-[#1A1440]">{nomPersonne(n.auteur)}</span> · {fmtDateHeure(n.created_at)}
                  </p>
                  <div className="cr-html mt-0.5" dangerouslySetInnerHTML={{ __html: contenuNote(n) }} />
                </div>
              ))}

          {/* 7. Référents intervenus */}
          <Titre2>7. Référents intervenus sur le dossier</Titre2>
          <div className="avoid-break">
            {listeIntervenants.length === 0
              ? <p className="text-[10.5pt] text-[#B4B1C4]">Aucun entretien ni compte rendu enregistré pour l'instant.</p>
              : (
                <table className="w-full text-[10pt]">
                  <thead>
                    <tr className="border-b border-[#D1CFE2] text-left text-[#6C6A80]">
                      <th className="py-1 font-medium">Référent</th>
                      <th className="py-1 text-right font-medium">Entretiens menés</th>
                      <th className="py-1 text-right font-medium">Comptes rendus</th>
                      <th className="py-1 text-right font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listeIntervenants.map((r) => (
                      <tr key={cle(r.nom)} className="border-b border-[#F3F2FA]">
                        <td className="py-1 font-medium text-[#1A1440]">{nomPersonne(r.nom)}</td>
                        <td className="py-1 text-right">{r.entretiens || "—"}</td>
                        <td className="py-1 text-right">{r.crs || "—"}</td>
                        <td className="py-1 text-right">{r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            <p className="mt-1 text-[8.5pt] text-[#9A97AD]">
              Situation créée par {nomPersonne(situation.createur)}.
            </p>
          </div>

          {/* Pied de page */}
          <div className="avoid-break mt-10 border-t border-[#D1CFE2] pt-2 text-[8.5pt] text-[#9A97AD]">
            pHARe — Programme de lutte contre le harcèlement à l'école · Collège Hubert Germain ·
            {situation.reference ? ` ${situation.reference} · ` : " "}édité le {fmtDate(new Date().toISOString())}
          </div>
         </div>
        </div>
      </div>
    </div>
  );
}