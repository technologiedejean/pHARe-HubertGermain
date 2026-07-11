// >>> NOUVEAU FICHIER : app/statistiques/page.tsx <<<
// Créer le dossier : app/statistiques/
// Créer le fichier : app/statistiques/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Types
   ============================================================ */
type Profile = { id: string; role: "admin" | "referent" };

type StatItem = { label: string; count: number; couleur?: string };

type Stats = {
  totalSituations:   number;
  parStatut:         StatItem[];
  parGravite:        StatItem[];
  victimesParGenre:  StatItem[];
  victimesParNiveau: StatItem[];
  intimidateursParGenre:  StatItem[];
  intimidateursParNiveau: StatItem[];
  parMotif:          StatItem[];
  parManifestation:  StatItem[];
  parLieu:           StatItem[];
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
        {/* SVG donut */}
        <div className="shrink-0">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {/* Fond */}
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
            {/* Total au centre */}
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1B1633">{total}</text>
            <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fill="#9A97AD">total</text>
          </svg>
        </div>
        {/* Légende */}
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
function BarresH({ data, titre }: { data: StatItem[]; titre: string }) {
  if (data.length === 0) return (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-4">{titre}</p>
      <p className="text-sm text-[#B4B1C4] text-center py-6">Aucune donnée</p>
    </div>
  );

  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-4">{titre}</p>
      <div className="space-y-2.5">
        {data.map((d, i) => (
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
        ))}
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

  const loadStats = useCallback(async () => {
    // ── 1. Situations ──────────────────────────────────────
    const { data: situations } = await supabase
      .from("situations")
      .select("id, statut, gravite");

    // ── 2. Acteurs (victimes + intimidateurs) ──────────────
    const { data: acteurs } = await supabase
      .from("situation_eleves")
      .select(`role, eleve:eleves(genre, classe)`);

    // ── 3. Motifs cochés ───────────────────────────────────
    const { data: sitMotifs } = await supabase
      .from("situation_motifs")
      .select(`motif:motifs(label)`);

    // ── 4. Manifestations cochées ──────────────────────────
    const { data: sitManifs } = await supabase
      .from("situation_manifestations")
      .select(`manifestation:manifestations(label)`);

    // ── 5. Lieux cochés ────────────────────────────────────
    const { data: sitLieux } = await supabase
      .from("situation_lieux")
      .select(`lieu:lieux(label)`);

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

      parMotif: compterParCle(
        (sitMotifs ?? []) as any[],
        (m) => (m.motif as any)?.label ?? "Inconnu"
      ),

      parManifestation: compterParCle(
        (sitManifs ?? []) as any[],
        (m) => (m.manifestation as any)?.label ?? "Inconnu"
      ),

      parLieu: compterParCle(
        (sitLieux ?? []) as any[],
        (m) => (m.lieu as any)?.label ?? "Inconnu"
      ),
    });

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

  if (loading || !stats || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement des statistiques…</span>
      </div>
    );
  }

  const totalVictimes      = stats.victimesParGenre.reduce((s, d) => s + d.count, 0);
  const totalIntimidateurs = stats.intimidateursParGenre.reduce((s, d) => s + d.count, 0);

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
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-3">Qualifications</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <BarresH data={stats.parMotif}         titre="🎯 Motifs d'intimidation"  />
          <BarresH data={stats.parManifestation} titre="⚡ Manifestations"          />
          <BarresH data={stats.parLieu}          titre="📍 Lieux"                   />
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