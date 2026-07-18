// >>> Ce fichier REMPLACE : app/statistiques/page.tsx <<<
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Types
   ============================================================ */
type Profile = { id: string; role: "admin" | "referent" };

type StatItem = { label: string; count: number; couleur?: string };

type RawQualif = { situation_id: string | null; label: string };

type Demographie = { genres: Set<string>; niveaux: Set<string> };

// Population sur laquelle s'appliquent les filtres Genre/Niveau des graphiques
// de Qualifications. Choix obligatoire — on ne peut pas mélanger victimes et
// intimidateurs dans un même filtre, car "quels motifs touchent davantage les
// filles" n'a pas le même sens selon qu'on parle des filles victimes ou des
// filles intimidatrices.
type RoleFiltre = "victime" | "intimidateur";

type Stats = {
  totalSituations:   number;
  parStatut:         StatItem[];
  parGravite:        StatItem[];
  victimesParGenre:  StatItem[];
  victimesParNiveau: StatItem[];
  intimidateursParGenre:  StatItem[];
  intimidateursParNiveau: StatItem[];
};

/* ============================================================
   Palette de couleurs pour les graphiques
   ============================================================ */
const PALETTE = [
  "#6656B8", "#A78BFA", "#F3C77B", "#34D399", "#F87171",
  "#60A5FA", "#FB923C", "#A3E635", "#E879F9", "#38BDF8",
];

function couleur(i: number): string {
  return PALETTE[i % PALETTE.length];
}

// Couleurs fixes pour la comparaison victimes / intimidateurs
const COULEUR_VICTIMES      = "#6656B8"; // violet (identité pHARe)
const COULEUR_INTIMIDATEURS = "#FB923C"; // orange

// Options des deux filtres appliqués aux graphiques de Qualifications
const OPTIONS_GENRE = [
  { value: "masculin", label: "Garçons" },
  { value: "feminin",  label: "Filles" },
];
const OPTIONS_NIVEAU = [
  { value: "6ème", label: "6ème" },
  { value: "5ème", label: "5ème" },
  { value: "4ème", label: "4ème" },
  { value: "3ème", label: "3ème" },
];

const OPTIONS_ROLE_FILTRE: { value: RoleFiltre; label: string; couleur: string }[] = [
  { value: "victime",       label: "Victimes",      couleur: COULEUR_VICTIMES      },
  { value: "intimidateur",  label: "Intimidateurs", couleur: COULEUR_INTIMIDATEURS },
];

/* ============================================================
   Helpers
   ============================================================ */
function classeVersNiveau(classe: string | null | undefined): string {
  if (!classe) return "Non renseigné";
  const c = classe.trim().toUpperCase();
  if (c.startsWith("6")) return "6ème";
  if (c.startsWith("5")) return "5ème";
  if (c.startsWith("4")) return "4ème";
  if (c.startsWith("3")) return "3ème";
  if (c.startsWith("2") || c.includes("2NDE") || c.includes("SEC")) return "2nde";
  if (c.startsWith("1") || c.includes("1ERE") || c.includes("1ÈRE")) return "1ère";
  if (c.includes("TLE") || c.includes("TERM")) return "Terminale";
  return classe;
}

function compterParCle<T>(items: T[], fn: (item: T) => string): StatItem[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = fn(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count], i) => ({ label, count, couleur: couleur(i) }));
}

// Une situation est-elle concernée par le filtre "genre" ?
// Si elle n'a aucun élève masculin/féminin identifié, dans le rôle actif,
// (élève "autre" ou non renseigné uniquement), le filtre ne s'applique pas
// et elle passe.
function passeFiltreGenre(demo: Demographie | undefined, selection: Set<string>): boolean {
  if (!demo) return true;
  const pertinents = ["masculin", "feminin"].filter((g) => demo.genres.has(g));
  if (pertinents.length === 0) return true;
  return pertinents.some((g) => selection.has(g));
}

// Même logique pour le filtre "niveau" (6e/5e/4e/3e uniquement).
function passeFiltreNiveau(demo: Demographie | undefined, selection: Set<string>): boolean {
  if (!demo) return true;
  const pertinents = OPTIONS_NIVEAU.map((o) => o.value).filter((n) => demo.niveaux.has(n));
  if (pertinents.length === 0) return true;
  return pertinents.some((n) => selection.has(n));
}

/* ============================================================
   Graphique donut (camembert)
   ============================================================ */
function Donut({ data, titre, total }: { data: StatItem[]; titre: string; total: number }) {
  const SIZE   = 120;
  const R      = 42;
  const CX     = SIZE / 2;
  const CY     = SIZE / 2;
  const STROKE = 18;
  const CIRC   = 2 * Math.PI * R;

  if (data.length === 0 || total === 0) return (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-4">{titre}</p>
      <p className="text-sm text-[#B4B1C4] text-center py-6">Aucune donnée</p>
    </div>
  );

  let offset = 0;
  const arcs = data.map((d) => {
    const frac  = d.count / total;
    const dash  = frac * CIRC;
    const gap   = CIRC - dash;
    const rot   = offset * 360;
    offset     += frac;
    return { ...d, dash, gap, rot };
  });

  return (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-4">{titre}</p>
      <div className="flex items-center gap-5">
        <div className="shrink-0">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F3F2FA" strokeWidth={STROKE} />
            {arcs.map((arc, i) => (
              <circle key={i} cx={CX} cy={CY} r={R} fill="none"
                stroke={arc.couleur} strokeWidth={STROKE}
                strokeDasharray={`${arc.dash} ${arc.gap}`}
                strokeDashoffset={CIRC / 4}
                transform={`rotate(${arc.rot}, ${CX}, ${CY})`}
                style={{ transition: "stroke-dasharray 0.5s ease" }}
              />
            ))}
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1B1633">{total}</text>
            <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fill="#9A97AD">total</text>
          </svg>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {data.slice(0, 8).map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.couleur }} />
              <span className="text-xs text-[#3A3556] truncate flex-1">{d.label}</span>
              <span className="text-xs font-semibold text-[#1B1633] shrink-0">{d.count}</span>
              <span className="text-[10px] text-[#B4B1C4] shrink-0 w-8 text-right">
                {Math.round(d.count / total * 100)}%
              </span>
            </div>
          ))}
          {data.length > 8 && (
            <p className="text-[10px] text-[#B4B1C4]">+{data.length - 8} autres</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Graphique barres horizontales
   ============================================================ */
function BarresH({ data, titre, sousTitre }: { data: StatItem[]; titre: string; sousTitre?: string }) {
  return (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">{titre}</p>
      {sousTitre && <p className="text-[11px] text-[#B4B1C4] mb-3 mt-0.5">{sousTitre}</p>}
      {data.length === 0 ? (
        <p className="text-sm text-[#B4B1C4] text-center py-6">Aucune donnée</p>
      ) : (
        <div className={`space-y-2.5 ${sousTitre ? "" : "mt-4"}`}>
          {(() => {
            const max = Math.max(...data.map((d) => d.count));
            return data.map((d, i) => (
              <div key={i} className="group">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-[#3A3556] truncate flex-1 mr-2">{d.label}</span>
                  <span className="text-xs font-semibold text-[#1B1633] shrink-0">{d.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#F3F2FA] overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-700"
                    style={{
                      width: `${(d.count / max) * 100}%`,
                      backgroundColor: d.couleur ?? PALETTE[i % PALETTE.length],
                    }}
                  />
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Graphique barres groupées : comparaison Victimes / Intimidateurs
   ============================================================ */
type LigneComparaison = { label: string; victimes: number; intimidateurs: number };

function BarresComparaison({
  victimesData, intimidateursData, titre,
}: {
  victimesData: StatItem[];
  intimidateursData: StatItem[];
  titre: string;
}) {
  const labels = Array.from(new Set([
    ...victimesData.map((d) => d.label),
    ...intimidateursData.map((d) => d.label),
  ]));

  const lignes: LigneComparaison[] = labels.map((label) => ({
    label,
    victimes:      victimesData.find((d) => d.label === label)?.count ?? 0,
    intimidateurs: intimidateursData.find((d) => d.label === label)?.count ?? 0,
  })).sort((a, b) => (b.victimes + b.intimidateurs) - (a.victimes + a.intimidateurs));

  const max = Math.max(1, ...lignes.map((l) => Math.max(l.victimes, l.intimidateurs)));
  const totalVictimes      = victimesData.reduce((s, d) => s + d.count, 0);
  const totalIntimidateurs = intimidateursData.reduce((s, d) => s + d.count, 0);

  if (lignes.length === 0 || (totalVictimes === 0 && totalIntimidateurs === 0)) {
    return (
      <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-4">{titre}</p>
        <p className="text-sm text-[#B4B1C4] text-center py-6">Aucune donnée</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">{titre}</p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-[#6C6A80]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COULEUR_VICTIMES }} />
            Victimes ({totalVictimes})
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#6C6A80]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COULEUR_INTIMIDATEURS }} />
            Intimidateurs ({totalIntimidateurs})
          </span>
        </div>
      </div>
      <div className="space-y-4">
        {lignes.map((l, i) => (
          <div key={i}>
            <p className="text-xs font-medium text-[#3A3556] mb-1.5">{l.label}</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-2.5 flex-1 rounded-full bg-[#F3F2FA] overflow-hidden">
                  <div className="h-2.5 rounded-full transition-all duration-700"
                    style={{ width: `${(l.victimes / max) * 100}%`, backgroundColor: COULEUR_VICTIMES }} />
                </div>
                <span className="w-6 shrink-0 text-right text-xs font-semibold text-[#1B1633]">{l.victimes}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 flex-1 rounded-full bg-[#F3F2FA] overflow-hidden">
                  <div className="h-2.5 rounded-full transition-all duration-700"
                    style={{ width: `${(l.intimidateurs / max) * 100}%`, backgroundColor: COULEUR_INTIMIDATEURS }} />
                </div>
                <span className="w-6 shrink-0 text-right text-xs font-semibold text-[#1B1633]">{l.intimidateurs}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Sélecteur de rôle (Victimes / Intimidateurs) — choix obligatoire
   pour pouvoir utiliser les filtres Genre/Niveau des graphiques de
   Qualifications. Un seul rôle actif à la fois : mélanger les deux
   rendrait le filtre Genre/Niveau ambigu (voir commentaire plus haut).
   ============================================================ */
function SelecteurRole({ selection, onChange }: {
  selection: RoleFiltre; onChange: (r: RoleFiltre) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-2">
        Filtrer sur les
      </p>
      <div className="inline-flex rounded-xl border border-[#E7E6EF] bg-[#F8F7FC] p-1">
        {OPTIONS_ROLE_FILTRE.map((o) => {
          const actif = selection === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                actif ? "text-white shadow-sm" : "text-[#6C6A80] hover:text-[#3A3556]"
              }`}
              style={actif ? { backgroundColor: o.couleur } : undefined}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-[#B4B1C4]">
        Les filtres Genre et Niveau ci-dessous s'appliquent uniquement aux élèves{" "}
        {selection === "victime" ? "victimes" : "intimidateurs"} de chaque situation.
      </p>
    </div>
  );
}

/* ============================================================
   Groupe de cases à cocher (filtre) avec bouton Tous / Aucun
   ============================================================ */
function FiltreCheckboxes({
  titre, options, selection, onChange,
}: {
  titre: string;
  options: { value: string; label: string }[];
  selection: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const tousCoches = options.every((o) => selection.has(o.value));

  function toggle(value: string) {
    const next = new Set(selection);
    if (next.has(value)) next.delete(value); else next.add(value);
    onChange(next);
  }

  return (
    <div className="flex-1 min-w-[220px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">{titre}</p>
        <div className="flex gap-1">
          <button
            onClick={() => onChange(new Set(options.map((o) => o.value)))}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
              tousCoches ? "bg-[#EFEAFB] text-[#6656B8]" : "text-[#B4B1C4] hover:bg-[#F3F2FA]"
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => onChange(new Set())}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
              selection.size === 0 ? "bg-[#EFEAFB] text-[#6656B8]" : "text-[#B4B1C4] hover:bg-[#F3F2FA]"
            }`}
          >
            Aucun
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const coche = selection.has(o.value);
          return (
            <label
              key={o.value}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs cursor-pointer transition ${
                coche
                  ? "border-[#D9D0F5] bg-[#F5F3FF] text-[#3A3556]"
                  : "border-[#E7E6EF] bg-white text-[#9A97AD]"
              }`}
            >
              <input
                type="checkbox"
                checked={coche}
                onChange={() => toggle(o.value)}
                style={{ accentColor: "#6656B8" }}
                className="h-3.5 w-3.5 rounded"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Carte chiffre clé
   ============================================================ */
function CarteChiffre({ label, value, sublabel, color }: {
  label: string; value: number | string; sublabel?: string; color?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5">
      <p className="text-sm text-[#6C6A80]">{label}</p>
      <p className="mt-1 text-3xl font-semibold" style={{ color: color ?? "#1B1633" }}>{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-[#9A97AD]">{sublabel}</p>}
    </div>
  );
}

/* ============================================================
   Page principale
   ============================================================ */
export default function StatistiquesPage() {
  const router = useRouter();
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);

  // Données brutes des qualifications (avec situation_id) + démographie par
  // situation, calculée séparément pour les victimes et pour les
  // intimidateurs (deux populations distinctes, jamais mélangées).
  // Conservées à part car recalculées côté client à chaque changement de
  // filtre, sans nouvel appel réseau.
  const [rawMotifs, setRawMotifs]   = useState<RawQualif[]>([]);
  const [rawManifs, setRawManifs]   = useState<RawQualif[]>([]);
  const [rawLieux, setRawLieux]     = useState<RawQualif[]>([]);
  const [demographiesVictimes, setDemographiesVictimes]           = useState<Map<string, Demographie>>(new Map());
  const [demographiesIntimidateurs, setDemographiesIntimidateurs] = useState<Map<string, Demographie>>(new Map());

  // Choix obligatoire de la population de référence pour les filtres
  // Genre/Niveau. "Victimes" par défaut — avec Genre/Niveau tout cochés,
  // ça ne change rien au comportement par défaut de l'écran.
  const [roleFiltre, setRoleFiltre]           = useState<RoleFiltre>("victime");
  const [selectionGenre, setSelectionGenre]   = useState<Set<string>>(new Set(OPTIONS_GENRE.map((o) => o.value)));
  const [selectionNiveau, setSelectionNiveau] = useState<Set<string>>(new Set(OPTIONS_NIVEAU.map((o) => o.value)));

  const loadStats = useCallback(async () => {
    // ── 1. Situations ──────────────────────────────────────
    const { data: situations } = await supabase
      .from("situations")
      .select("id, statut, gravite");

    // ── 2. Acteurs (victimes + intimidateurs), avec situation_id ──
    const { data: acteurs } = await supabase
      .from("situation_eleves")
      .select(`situation_id, role, eleve:eleves(genre, classe)`);

    // ── 3. Motifs cochés, avec situation_id ────────────────
    const { data: sitMotifs } = await supabase
      .from("situation_motifs")
      .select(`situation_id, motif:motifs(label)`);

    // ── 4. Manifestations cochées, avec situation_id ───────
    const { data: sitManifs } = await supabase
      .from("situation_manifestations")
      .select(`situation_id, manifestation:manifestations(label)`);

    // ── 5. Lieux cochés, avec situation_id ──────────────────
    const { data: sitLieux } = await supabase
      .from("situation_lieux")
      .select(`situation_id, lieu:lieux(label)`);

    // ── Calculs ────────────────────────────────────────────
    const sits    = situations ?? [];
    const acteursData = (acteurs ?? []) as any[];

    const victimes      = acteursData.filter((a) => a.role === "victime");
    const intimidateurs = acteursData.filter((a) => a.role === "intimidateur");

    const STATUT_LABELS: Record<string, string> = {
      ouverte: "Signalées", en_cours: "En cours", cloturee: "Traitées",
    };

    const GRAVITE_LABELS_MAP: Record<number, string> = {
      1: "1 – Mineur", 2: "2 – Faible", 3: "3 – Modéré", 4: "4 – Grave", 5: "5 – Très grave",
    };

    const GENRE_LABELS: Record<string, string> = {
      masculin: "Masculin", feminin: "Féminin", autre: "Autre / Non précisé",
    };

    setStats({
      totalSituations: sits.length,

      parStatut: compterParCle(sits, (s) => STATUT_LABELS[s.statut] ?? s.statut),

      parGravite: compterParCle(
        sits.filter((s) => s.gravite),
        (s) => GRAVITE_LABELS_MAP[s.gravite!] ?? `Gravité ${s.gravite}`
      ),

      victimesParGenre: compterParCle(
        victimes.filter((a) => a.eleve),
        (a) => GENRE_LABELS[a.eleve?.genre] ?? "Non renseigné"
      ),

      victimesParNiveau: compterParCle(
        victimes.filter((a) => a.eleve),
        (a) => classeVersNiveau(a.eleve?.classe)
      ),

      intimidateursParGenre: compterParCle(
        intimidateurs.filter((a) => a.eleve),
        (a) => GENRE_LABELS[a.eleve?.genre] ?? "Non renseigné"
      ),

      intimidateursParNiveau: compterParCle(
        intimidateurs.filter((a) => a.eleve),
        (a) => classeVersNiveau(a.eleve?.classe)
      ),
    });

    // ── Démographie par situation, séparée par rôle ────────
    // Un élève "vote" son genre et son niveau pour chaque situation où il
    // apparaît, mais uniquement dans la carte correspondant à SON rôle —
    // victime et intimidateur ne sont jamais comptés dans la même carte.
    const demoVictimes      = new Map<string, Demographie>();
    const demoIntimidateurs = new Map<string, Demographie>();
    for (const a of acteursData) {
      if (!a.situation_id || !a.eleve) continue;
      if (a.role !== "victime" && a.role !== "intimidateur") continue;
      const cible = a.role === "victime" ? demoVictimes : demoIntimidateurs;
      const entry = cible.get(a.situation_id) ?? { genres: new Set<string>(), niveaux: new Set<string>() };
      if (a.eleve.genre) entry.genres.add(a.eleve.genre);
      entry.niveaux.add(classeVersNiveau(a.eleve.classe));
      cible.set(a.situation_id, entry);
    }
    setDemographiesVictimes(demoVictimes);
    setDemographiesIntimidateurs(demoIntimidateurs);

    setRawMotifs(((sitMotifs ?? []) as any[]).map((m) => ({
      situation_id: m.situation_id, label: (m.motif as any)?.label ?? "Inconnu",
    })));
    setRawManifs(((sitManifs ?? []) as any[]).map((m) => ({
      situation_id: m.situation_id, label: (m.manifestation as any)?.label ?? "Inconnu",
    })));
    setRawLieux(((sitLieux ?? []) as any[]).map((m) => ({
      situation_id: m.situation_id, label: (m.lieu as any)?.label ?? "Inconnu",
    })));

    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: prof } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
      setProfile(prof);
      await loadStats();
    }
    init();
  }, [router, loadStats]);

  // La carte démographique active dépend du rôle choisi — jamais les deux
  // en même temps.
  const demographiesActives = roleFiltre === "victime" ? demographiesVictimes : demographiesIntimidateurs;

  // Filtrage + comptage des 3 graphiques de qualifications, recalculé
  // uniquement côté client à chaque changement de sélection.
  const situationRetenue = useCallback((situationId: string | null) => {
    if (!situationId) return true;
    const demo = demographiesActives.get(situationId);
    return passeFiltreGenre(demo, selectionGenre) && passeFiltreNiveau(demo, selectionNiveau);
  }, [demographiesActives, selectionGenre, selectionNiveau]);

  const parMotif = useMemo(
    () => compterParCle(rawMotifs.filter((m) => situationRetenue(m.situation_id)), (m) => m.label),
    [rawMotifs, situationRetenue]
  );
  const parManifestation = useMemo(
    () => compterParCle(rawManifs.filter((m) => situationRetenue(m.situation_id)), (m) => m.label),
    [rawManifs, situationRetenue]
  );
  const parLieu = useMemo(
    () => compterParCle(rawLieux.filter((m) => situationRetenue(m.situation_id)), (m) => m.label),
    [rawLieux, situationRetenue]
  );

  // Nombre de situations, parmi celles ayant au moins un élève du rôle
  // actif, qui passent les filtres — pour donner un repère à l'utilisateur.
  const { situationsRetenues, situationsTotal } = useMemo(() => {
    const ids = Array.from(demographiesActives.keys());
    return {
      situationsTotal: ids.length,
      situationsRetenues: ids.filter((id) => situationRetenue(id)).length,
    };
  }, [demographiesActives, situationRetenue]);

  if (loading || !stats || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement des statistiques…</span>
      </div>
    );
  }

  const totalVictimes      = stats.victimesParGenre.reduce((s, d) => s + d.count, 0);
  const totalIntimidateurs = stats.intimidateursParGenre.reduce((s, d) => s + d.count, 0);

  const filtresActifs =
    selectionGenre.size < OPTIONS_GENRE.length || selectionNiveau.size < OPTIONS_NIVEAU.length;

  /* ── Contenu ─────────────────────────────────────────────── */
  const Contenu = () => (
    <div className="space-y-10">

      {/* ── Chiffres clés ── */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-3">Vue d'ensemble</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <CarteChiffre label="Situations totales"  value={stats.totalSituations}            color="#1B1633" />
          <CarteChiffre label="Signalées"            value={stats.parStatut.find(s => s.label === "Signalées")?.count ?? 0}  color="#f59e0b" sublabel="En attente" />
          <CarteChiffre label="En cours"             value={stats.parStatut.find(s => s.label === "En cours")?.count ?? 0}   color="#3b82f6" sublabel="Traitement en cours" />
          <CarteChiffre label="Traitées"             value={stats.parStatut.find(s => s.label === "Traitées")?.count ?? 0}   color="#10b981" sublabel="Clôturées" />
        </div>
      </section>

      {/* ── Situations ── */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-3">Situations</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Donut data={stats.parStatut}  titre="Répartition par statut"  total={stats.totalSituations} />
          <BarresH data={stats.parGravite} titre="Répartition par gravité" />
        </div>
      </section>

      {/* ── Genre : victimes vs intimidateurs (comparaison directe) ── */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-3">
          Genre — victimes vs intimidateurs
        </p>
        <div className="grid grid-cols-1 gap-4">
          <BarresComparaison
            victimesData={stats.victimesParGenre}
            intimidateursData={stats.intimidateursParGenre}
            titre="Répartition par genre"
          />
        </div>
      </section>

      {/* ── Victimes ── */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-3">
          Victimes <span className="ml-1 rounded-full bg-[#F5F3FF] px-2 py-0.5 text-[#6656B8] font-normal normal-case">{totalVictimes}</span>
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Donut   data={stats.victimesParGenre}  titre="Répartition par genre"  total={totalVictimes} />
          <BarresH data={stats.victimesParNiveau} titre="Répartition par niveau" />
        </div>
      </section>

      {/* ── Intimidateurs ── */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-3">
          Intimidateurs <span className="ml-1 rounded-full bg-[#FFF7ED] px-2 py-0.5 text-orange-600 font-normal normal-case">{totalIntimidateurs}</span>
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Donut   data={stats.intimidateursParGenre}  titre="Répartition par genre"  total={totalIntimidateurs} />
          <BarresH data={stats.intimidateursParNiveau} titre="Répartition par niveau" />
        </div>
      </section>

      {/* ── Qualifications ── */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">Qualifications</p>
          {filtresActifs && (
            <span className="rounded-full bg-[#F5F3FF] px-2.5 py-1 text-[11px] text-[#6656B8]">
              {situationsRetenues} / {situationsTotal} situations correspondent aux filtres
              {" "}(parmi les {roleFiltre === "victime" ? "victimes" : "intimidateurs"})
            </span>
          )}
        </div>

        {/* Filtres */}
        <div className="rounded-2xl border border-[#EEEDF5] bg-white p-4 mb-4">
          <SelecteurRole selection={roleFiltre} onChange={setRoleFiltre} />
          <div className="flex flex-wrap gap-6">
            <FiltreCheckboxes titre="Genre"  options={OPTIONS_GENRE}  selection={selectionGenre}  onChange={setSelectionGenre} />
            <FiltreCheckboxes titre="Niveau" options={OPTIONS_NIVEAU} selection={selectionNiveau} onChange={setSelectionNiveau} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <BarresH data={parMotif}         titre="🎯 Motifs d'intimidation"  />
          <BarresH data={parManifestation} titre="⚡ Manifestations"          />
          <BarresH data={parLieu}          titre="📍 Lieux"                   />
        </div>
      </section>

      {/* Note de bas de page */}
      <p className="text-xs text-[#B4B1C4] text-center pb-4">
        Statistiques calculées sur l'ensemble des situations enregistrées dans pHARe.
        Un même élève peut apparaître dans plusieurs situations.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1B1633]">

      {/* ════════════════════════════════════════════════════
          📱 MOBILE
          ════════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[#EEEDF5] bg-white px-5 py-4 shadow-sm">
          <button onClick={() => router.push("/dashboard")}
            className="mb-1 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
          <h1 className="text-lg font-semibold">Statistiques</h1>
        </header>
        <main className="flex-1 px-5 py-6">
          <Contenu />
        </main>
      </div>

      {/* ════════════════════════════════════════════════════
          💻 PC
          ════════════════════════════════════════════════════ */}
      <div className="hidden lg:block max-w-5xl mx-auto px-8 py-8">
        <div className="mb-8">
          <button onClick={() => router.push("/dashboard")}
            className="mb-2 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-[#1B1633]">Statistiques</h1>
              <p className="mt-0.5 text-sm text-[#6C6A80]">
                Données agrégées sur l'ensemble des situations pHARe.
              </p>
            </div>
            <button onClick={loadStats}
              className="flex items-center gap-2 rounded-xl border border-[#E7E6EF] bg-white px-4 py-2
                         text-sm text-[#3A3556] hover:bg-[#F3F2FA] transition">
              ↻ Actualiser
            </button>
          </div>
        </div>
        <Contenu />
      </div>
    </div>
  );
}