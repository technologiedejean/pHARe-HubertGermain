// >>> Ce fichier REMPLACE : app/dashboard/page.tsx <<<
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Types
   ============================================================ */
type Profile = {
  id: string;
  nom: string;
  prenom: string;
  role: "admin" | "referent";
  couleur: string;
};

type StatutSituation = "ouverte" | "en_cours" | "cloturee";

type Creneau = {
  id: string;
  date_creneau: string;
  heure_debut: string;
  heure_fin: string;
  statut: "disponible" | "prevu" | "realise";
  titre: string | null;
  situation_id: string | null;
  referent_id: string;
  referent_charge_id: string | null;
  situation?: { titre: string } | null;
  referent?: { id: string; nom: string; prenom: string; couleur: string } | null;
  referent_charge?: { id: string; nom: string; prenom: string; couleur: string } | null;
};

type Stats = {
  signalees: number;
  en_cours: number;
  traitees: number;
  entretiens_a_venir: number;
};

type NonLus = {
  situations: boolean;
  reunions: boolean;
};

/* ============================================================
   Navigation
   ============================================================ */
const NAV_ITEMS = [
  { href: "/dashboard",  label: "Tableau de bord", icon: "⬡"  },
  { href: "/situations", label: "Situations",       icon: "📋" },
  { href: "/reunions",   label: "Réunions",         icon: "🗓️" },
  { href: "/eleves",     label: "Élèves",           icon: "👤" },
  { href: "/agenda",     label: "Agenda",           icon: "📅" },
  { href: "/referents",  label: "Référents",        icon: "👥", adminOnly: true },
  { href: "/statistiques", label: "Statistiques", icon: "📊" },
  { href: "/parametres", label: "Paramètres",       icon: "⚙️", adminOnly: true },
];

/* ============================================================
   Helpers
   ============================================================ */
const MOIS_COURTS = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];

function formatDateCourt(iso: string): { jour: number; mois: string; jourSemaine: string } {
  const d = new Date(iso + "T00:00:00");
  const jours = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  return {
    jour:        d.getDate(),
    mois:        MOIS_COURTS[d.getMonth()],
    jourSemaine: jours[d.getDay()],
  };
}

function formatHeure(h: string): string { return h.slice(0, 5); }

function isAujourdhui(iso: string): boolean {
  return iso === new Date().toISOString().slice(0, 10);
}

function isDemain(iso: string): boolean {
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  return iso === demain.toISOString().slice(0, 10);
}

// Un lien de menu affiche-t-il la pastille "non lu" ? "Agenda" agrège les deux
// types de compte rendu puisque les deux y sont consultables (situations
// via l'onglet Entretiens de chaque fiche, réunions directement dans la modale).
function aDesNonLus(href: string, nonLus: NonLus): boolean {
  if (href === "/situations") return nonLus.situations;
  if (href === "/reunions")   return nonLus.reunions;
  if (href === "/agenda")     return nonLus.situations || nonLus.reunions;
  return false;
}

/* ============================================================
   Carte stat
   ============================================================ */
function StatCard({
  label, value, color, href, sublabel,
}: {
  label: string;
  value: number | string;
  color: string;
  href?: string;
  sublabel?: string;
}) {
  const router = useRouter();
  return (
    <div
      className={`rounded-2xl border border-[#EEEDF5] bg-white p-5 shadow-sm
                  ${href ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={() => href && router.push(href)}
    >
      <p className="text-sm text-[#6C6A80]">{label}</p>
      <p className="mt-1 text-3xl font-semibold" style={{ color }}>
        {value === -1 ? <span className="text-xl text-[#B4B1C4]">…</span> : value}
      </p>
      {sublabel && <p className="mt-0.5 text-xs text-[#9A97AD]">{sublabel}</p>}
    </div>
  );
}

/* ============================================================
   Carte créneau
   ============================================================ */
function CarteEvenement({
  creneau,
  profileId,
  onClick,
}: {
  creneau: Creneau;
  profileId: string;
  onClick: () => void;
}) {
  const isMine =
    creneau.referent_id === profileId ||
    creneau.referent_charge_id === profileId;

  const referentPrincipal = creneau.referent_charge ?? creneau.referent;
  const couleur           = referentPrincipal?.couleur ?? "#9A97AD";
  const label             = creneau.situation?.titre ?? creneau.titre ?? "Disponibilité";
  const { jour, mois, jourSemaine } = formatDateCourt(creneau.date_creneau);

  const today  = isAujourdhui(creneau.date_creneau);
  const demain = isDemain(creneau.date_creneau);

  return (
    <div
      className={`flex gap-4 rounded-2xl border bg-white p-4 cursor-pointer
                  transition-all hover:shadow-md
                  ${isMine
                    ? "border-[#7C6BD6] shadow-sm ring-1 ring-[#7C6BD6]/20"
                    : "border-[#EEEDF5] shadow-sm"
                  }`}
      onClick={onClick}
    >
      {/* Bande couleur gauche */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <div
          className="w-1 flex-1 rounded-full min-h-[40px]"
          style={{ backgroundColor: couleur }}
        />
      </div>

      {/* Date compacte */}
      <div className={`flex flex-col items-center justify-center w-12 shrink-0 rounded-xl py-1
                       ${today ? "bg-[#F5F3FF]" : "bg-[#F8F7FC]"}`}>
        <p className={`text-[10px] font-medium uppercase ${today ? "text-[#6656B8]" : "text-[#9A97AD]"}`}>
          {today ? "Auj." : demain ? "Dem." : jourSemaine}
        </p>
        <p className={`text-lg font-bold leading-tight ${today ? "text-[#6656B8]" : "text-[#1B1633]"}`}>
          {jour}
        </p>
        <p className={`text-[10px] ${today ? "text-[#6656B8]" : "text-[#9A97AD]"}`}>{mois}</p>
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium leading-snug truncate
                         ${isMine ? "text-[#1B1633]" : "text-[#3A3556]"}`}>
            {label}
          </p>
          {isMine && (
            <span className="shrink-0 rounded-full bg-[#F5F3FF] px-2 py-0.5 text-[10px]
                             font-semibold text-[#6656B8]">
              Vous
            </span>
          )}
        </div>

        <p className="text-xs text-[#6C6A80] mt-0.5">
          {formatHeure(creneau.heure_debut)} – {formatHeure(creneau.heure_fin)}
        </p>

        {/* Référent en charge */}
        {referentPrincipal && (
          <div className="mt-2 flex items-center gap-1.5">
            <div
              className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ backgroundColor: couleur }}
            >
              {referentPrincipal.prenom[0]}{referentPrincipal.nom[0]}
            </div>
            <p className="text-xs text-[#9A97AD]">
              {referentPrincipal.prenom} {referentPrincipal.nom}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Page principale
   ============================================================ */
export default function DashboardPage() {
  const router  = useRouter();
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [stats, setStats]           = useState<Stats>({ signalees: -1, en_cours: -1, traitees: -1, entretiens_a_venir: -1 });
  const [creneaux, setCreneaux]     = useState<Creneau[]>([]);
  const [nonLus, setNonLus]         = useState<NonLus>({ situations: false, reunions: false });
  const [loading, setLoading]       = useState(true);
  const [menuOpen, setMenuOpen]     = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, nom, prenom, role, couleur")
        .eq("id", user.id)
        .single();

      if (!prof) { router.push("/login"); return; }

      const { data: flags } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", user.id)
        .single();

      if (flags?.must_change_password) { router.push("/change-password"); return; }

      setProfile(prof);

      // Statistiques situations
      const today = new Date().toISOString().slice(0, 10);

      const [sigRes, enCRes, traRes, agendaRes, crsRes] = await Promise.all([
        supabase.from("situations").select("id", { count: "exact", head: true }).eq("statut", "ouverte"),
        supabase.from("situations").select("id", { count: "exact", head: true }).eq("statut", "en_cours"),
        supabase.from("situations").select("id", { count: "exact", head: true }).eq("statut", "cloturee"),
        supabase
          .from("creneaux")
          .select(`
            id, date_creneau, heure_debut, heure_fin, statut, titre,
            situation_id, referent_id, referent_charge_id,
            situation:situations(titre),
            referent:profiles!creneaux_referent_id_fkey(id, nom, prenom, couleur),
            referent_charge:profiles!creneaux_referent_charge_id_fkey(id, nom, prenom, couleur)
          `)
          .in("statut", ["prevu", "disponible"])
          .gte("date_creneau", today)
          .order("date_creneau")
          .order("heure_debut")
          .limit(20),
        // Tous les comptes rendus visibles par l'utilisateur (la RLS limite déjà
        // aux situations auxquelles il a accès). situation_id distingue le type :
        // non-null = entretien de situation, null = réunion.
        supabase
          .from("comptes_rendus")
          .select("id, situation_id")
          .not("contenu", "like", "[NOTE]%"),
      ]);

      // Compter les entretiens à venir (statut "prevu")
      const nbAVenir = (agendaRes.data ?? []).filter((c: any) => c.statut === "prevu").length;

      setStats({
        signalees:          sigRes.count ?? 0,
        en_cours:           enCRes.count ?? 0,
        traitees:           traRes.count ?? 0,
        entretiens_a_venir: nbAVenir,
      });

      setCreneaux((agendaRes.data as any) ?? []);

      // Croise avec les comptes rendus déjà lus par cet utilisateur pour
      // savoir si une pastille "non lu" doit apparaître sur le menu.
      const crIds = (crsRes.data ?? []).map((c: any) => c.id);
      let luSet = new Set<string>();
      if (crIds.length > 0) {
        const { data: lectures } = await supabase
          .from("cr_lectures")
          .select("compte_rendu_id")
          .eq("referent_id", user.id)
          .in("compte_rendu_id", crIds);
        luSet = new Set((lectures ?? []).map((l: any) => l.compte_rendu_id));
      }
      const nonLusSituations = (crsRes.data ?? []).some((c: any) => c.situation_id !== null && !luSet.has(c.id));
      const nonLusReunions   = (crsRes.data ?? []).some((c: any) => c.situation_id === null && !luSet.has(c.id));
      setNonLus({ situations: nonLusSituations, reunions: nonLusReunions });

      setLoading(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement…</span>
      </div>
    );
  }

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.adminOnly || profile.role === "admin"
  );

  const initiales = `${profile.prenom[0]}${profile.nom[0]}`.toUpperCase();

  // Sépare "mes" créneaux des autres
  const mesCreneaux   = creneaux.filter(
    (c) => c.referent_id === profile.id || c.referent_charge_id === profile.id
  );
  const autresCreneaux = creneaux.filter(
    (c) => c.referent_id !== profile.id && c.referent_charge_id !== profile.id
  );
  // Réunit en mettant les miens en premier
  const creneauxTries = [...mesCreneaux, ...autresCreneaux];

  /* ── Contenu principal ───────────────────────────────────── */
  const MainContent = () => (
    <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-10 space-y-8">

      {/* Bonjour */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6656B8]">
          Tableau de bord
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#1B1633]">
          Bonjour, {profile.prenom} 👋
        </h1>
        <p className="mt-1 text-sm text-[#6C6A80]">
          {profile.role === "admin"
            ? "Vue administrateur — accès complet."
            : "Vue référent — vos situations et votre agenda."}
        </p>
      </div>

      {/* Statistiques */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-3">
          Situations
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Signalées"
            value={stats.signalees}
            color="#f59e0b"
            href="/situations"
            sublabel="En attente de prise en charge"
          />
          <StatCard
            label="En cours"
            value={stats.en_cours}
            color="#3b82f6"
            href="/situations"
            sublabel="Traitement en cours"
          />
          <StatCard
            label="Traitées"
            value={stats.traitees}
            color="#10b981"
            href="/situations"
            sublabel="Situations clôturées"
          />
          <StatCard
            label="Evènements à venir"
            value={stats.entretiens_a_venir}
            color="#6656B8"
            href="/agenda"
            sublabel="Créneaux planifiés"
          />
        </div>
      </div>

      {/* Prochains événements */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">
            Prochains événements
          </p>
          <button onClick={() => router.push("/agenda")}
            className="text-xs text-[#6656B8] hover:underline">
            Voir l'agenda →
          </button>
        </div>

        {creneauxTries.length === 0 ? (
          <div className="rounded-2xl border border-[#EEEDF5] bg-white p-8 text-center">
            <p className="text-sm text-[#9A97AD]">Aucun événement à venir.</p>
            <button onClick={() => router.push("/agenda")}
              className="mt-3 rounded-xl bg-[#1A1440] px-4 py-2 text-sm text-white
                         hover:bg-[#2A1E5C] transition">
              Ouvrir l'agenda
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Légende */}
            <div className="flex items-center gap-4 text-xs text-[#9A97AD]">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full border border-[#7C6BD6] bg-[#F5F3FF]" />
                Vos événements
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full border border-[#EEEDF5] bg-white" />
                Autres référents
              </div>
            </div>

            {creneauxTries.map((c) => (
              <CarteEvenement
                key={c.id}
                creneau={c}
                profileId={profile.id}
                onClick={() => router.push("/agenda")}
              />
            ))}

            {creneaux.length >= 20 && (
              <p className="text-center text-xs text-[#9A97AD] pt-1">
                Affichage limité aux 20 prochains événements.{" "}
                <button onClick={() => router.push("/agenda")}
                  className="text-[#6656B8] hover:underline">
                  Voir tout l'agenda
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1B1633]">

      {/* ════════════════════════════════════════════════════
          📱 MOBILE
          ════════════════════════════════════════════════════ */}
      <div className="lg:hidden flex min-h-screen flex-col">
        {/* Barre haute */}
        <header className="flex items-center justify-between px-5 py-4
                           border-b border-[#EEEDF5] bg-white shadow-sm">
          <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-hidden>
              <circle cx="20" cy="20" r="6" fill="#F3C77B" />
              <path d="M20 20 L40 11 L40 29 Z" fill="#F3C77B" fillOpacity="0.35" />
            </svg>
            <span className="text-lg font-semibold tracking-tight text-[#1B1633]">
              p<span className="text-[#F3C77B]">HAR</span>e
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: profile.couleur }}
            >
              {initiales}
            </div>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="relative flex h-8 w-8 flex-col items-center justify-center gap-1.5"
              aria-label="Menu"
            >
              {(nonLus.situations || nonLus.reunions) && !menuOpen && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
              )}
              <span className={`block h-0.5 w-5 bg-[#1B1633] transition-all
                               ${menuOpen ? "translate-y-2 rotate-45" : ""}`} />
              <span className={`block h-0.5 w-5 bg-[#1B1633] transition-all
                               ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 w-5 bg-[#1B1633] transition-all
                               ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
            </button>
          </div>
        </header>

        {/* Menu tiroir */}
        {menuOpen && (
          <nav className="border-b border-[#EEEDF5] bg-white px-5 py-4 shadow-md">
            <ul className="space-y-1">
              {visibleNav.map((item) => (
                <li key={item.href}>
                  <a href={item.href}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm
                               font-medium text-[#3A3556] hover:bg-[#F3F2FA]"
                    onClick={() => setMenuOpen(false)}>
                    <span>{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {aDesNonLus(item.href, nonLus) && (
                      <span className="h-2 w-2 rounded-full bg-red-500" title="Contenu non lu" />
                    )}
                  </a>
                </li>
              ))}
              <li>
                <button onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm
                             font-medium text-red-600 hover:bg-red-50">
                  <span>🚪</span> Se déconnecter
                </button>
              </li>
            </ul>
          </nav>
        )}

        <MainContent />
      </div>

      {/* ════════════════════════════════════════════════════
          💻 PC — sidebar fixe + contenu
          ════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex min-h-screen">

        {/* Sidebar */}
        <aside className="flex w-64 flex-col border-r border-[#EEEDF5] bg-white">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-[#EEEDF5]">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none" aria-hidden>
              <circle cx="20" cy="20" r="6" fill="#F3C77B" />
              <path d="M20 20 L40 11 L40 29 Z" fill="#F3C77B" fillOpacity="0.35" />
              <path d="M20 20 L0 11 L0 29 Z" fill="#F3C77B" fillOpacity="0.15" />
            </svg>
            <span className="text-xl font-semibold tracking-tight text-[#1B1633]">
              p<span className="text-[#F3C77B]">HAR</span>e
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4">
            <ul className="space-y-1">
              {visibleNav.map((item) => (
                <li key={item.href}>
                  <a href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm
                               font-medium transition-colors
                               ${item.href === "/dashboard"
                                 ? "bg-[#F3F2FA] text-[#6656B8]"
                                 : "text-[#3A3556] hover:bg-[#F3F2FA]"}`}>
                    <span className="text-base">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {aDesNonLus(item.href, nonLus) && (
                      <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" title="Contenu non lu" />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Profil + déconnexion */}
          <div className="border-t border-[#EEEDF5] px-4 py-4">
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                           text-xs font-bold text-white"
                style={{ backgroundColor: profile.couleur }}
              >
                {initiales}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#1B1633]">
                  {profile.prenom} {profile.nom}
                </p>
                <p className="text-xs text-[#9A97AD] capitalize">{profile.role}</p>
              </div>
            </div>
            <button onClick={handleLogout}
              className="mt-2 flex w-full items-center gap-2 rounded-xl px-4 py-2 text-sm
                         font-medium text-red-600 hover:bg-red-50 transition-colors">
              <span>🚪</span> Se déconnecter
            </button>
          </div>
        </aside>

        {/* Contenu */}
        <MainContent />
      </div>
    </div>
  );
}