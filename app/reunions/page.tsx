// >>> Ce fichier REMPLACE : app/reunions/page.tsx <<<
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Types
   ============================================================ */
type Referent = { id: string; nom: string; prenom: string; couleur: string; role?: "admin" | "referent" };
type Profile  = { id: string; role: "admin" | "referent" };

type Reunion = {
  id: string;
  date_creneau: string;
  heure_debut: string;
  heure_fin: string;
  statut: "prevu" | "realise" | "disponible";
  titre: string | null;
  note: string | null;
  referent_charge_id: string | null;
  referent_charge?: Referent | null;
  participants?: Referent[];
  a_cr?: boolean;
  cr_non_lu?: boolean;
};

/* ============================================================
   Helpers
   ============================================================ */
function formatDateCourt(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function tousLesParticipants(r: Reunion): Referent[] {
  const liste = [...(r.referent_charge ? [r.referent_charge] : []), ...(r.participants ?? [])];
  return liste.filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
}

/* ============================================================
   Composants de base
   ============================================================ */
function Avatar({ r }: { r: Referent }) {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white"
      style={{ backgroundColor: r.couleur }} title={`${r.prenom} ${r.nom}`}>
      {r.prenom[0]}{r.nom[0]}
    </div>
  );
}

function BadgeStatut({ statut, aCr, nonLu }: { statut: Reunion["statut"]; aCr?: boolean; nonLu?: boolean }) {
  if (statut === "prevu") return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Prévue
    </span>
  );
  if (statut === "realise") {
    return aCr ? (
      <span className="relative inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> CR rédigé
        {nonLu && (
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
            title="Vous n'avez pas encore ouvert ce compte rendu" />
        )}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> CR manquant
      </span>
    );
  }
  return null;
}

/* ============================================================
   Page principale
   ============================================================ */
export default function ReunionsPage() {
  const router = useRouter();
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [reunions, setReunions] = useState<Reunion[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [crManquantOnly, setCrManquantOnly] = useState(false);

  const load = useCallback(async () => {
    // On récupère l'utilisateur connecté directement ici (plutôt que de
    // dépendre de l'état "profile", qui pourrait encore être null au premier
    // appel de cette fonction mémoïsée).
    const { data: { user } } = await supabase.auth.getUser();

    const [reuRes, crsRes] = await Promise.all([
      supabase
        .from("creneaux")
        .select(`
          id, date_creneau, heure_debut, heure_fin, statut, titre, note, referent_charge_id,
          referent_charge:profiles!creneaux_referent_charge_id_fkey ( id, nom, prenom, couleur, role ),
          participants:creneau_participants ( referent:profiles ( id, nom, prenom, couleur, role ) )
        `)
        .is("situation_id", null)
        .not("titre", "is", null)
        .not("date_creneau", "is", null)
        .order("date_creneau", { ascending: false })
        .order("heure_debut", { ascending: false }),
      supabase
        .from("comptes_rendus")
        .select("id, creneau_id")
        .not("creneau_id", "is", null)
        .not("contenu", "like", "[NOTE]%"),
    ]);

    if (!reuRes.data) { setLoading(false); return; }

    // Correspondance créneau → id du compte rendu.
    const crParCreneau = new Map<string, string>();
    for (const cr of (crsRes.data ?? [])) {
      if (cr.creneau_id) crParCreneau.set(cr.creneau_id, cr.id);
    }
    const crIds = Array.from(crParCreneau.values());

    // Comptes rendus déjà lus par l'utilisateur connecté, parmi ceux existants.
    let luSet = new Set<string>();
    if (user && crIds.length > 0) {
      const { data: lectures } = await supabase
        .from("cr_lectures")
        .select("compte_rendu_id")
        .eq("referent_id", user.id)
        .in("compte_rendu_id", crIds);
      luSet = new Set((lectures ?? []).map((l: any) => l.compte_rendu_id));
    }

    setReunions(reuRes.data.map((r: any) => {
      const crId = crParCreneau.get(r.id) ?? null;
      return {
        ...r,
        a_cr: !!crId,
        cr_non_lu: !!crId && !luSet.has(crId),
        participants: (r.participants ?? []).map((p: any) => p.referent).filter(Boolean),
      };
    }));
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: prof } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
      setProfile(prof);
      await load();
    }
    init();
  }, [router, load]);

  const filtered = reunions.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (r.titre ?? "").toLowerCase().includes(q);
    const matchCr = !crManquantOnly || (r.statut === "realise" && !r.a_cr);
    return matchSearch && matchCr;
  });

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement des réunions…</span>
      </div>
    );
  }

  /* ── Carte (mobile) ────────────────────────────────────────── */
  const CarteReunion = ({ r }: { r: Reunion }) => {
    const participants = tousLesParticipants(r);
    return (
      <div className="rounded-2xl border border-[#EEEDF5] bg-white p-4 shadow-sm cursor-pointer"
        onClick={() => router.push(`/reunions/${r.id}`)}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#1B1633] leading-snug">{r.titre}</p>
            <p className="text-xs text-[#9A97AD] mt-0.5">
              {formatDateCourt(r.date_creneau)} · {r.heure_debut.slice(0, 5)}–{r.heure_fin.slice(0, 5)}
            </p>
          </div>
          <BadgeStatut statut={r.statut} aCr={r.a_cr} nonLu={r.cr_non_lu} />
        </div>
        {participants.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="flex -space-x-1.5">
              {participants.slice(0, 5).map((p) => <Avatar key={p.id} r={p} />)}
            </div>
            <span className="text-xs text-[#6C6A80] ml-1 truncate">
              {participants.map((p) => `${p.prenom} ${p.nom}`).join(", ")}
            </span>
          </div>
        )}
      </div>
    );
  };

  /* ── Ligne de tableau (PC) ─────────────────────────────────── */
  const LigneTableau = ({ r }: { r: Reunion }) => {
    const participants = tousLesParticipants(r);
    return (
      <tr className="hover:bg-[#F8F7FC] transition-colors cursor-pointer"
        onClick={() => router.push(`/reunions/${r.id}`)}>
        <td className="px-5 py-4">
          <p className="font-medium text-[#1B1633] leading-snug">{r.titre}</p>
          {r.note && <p className="text-xs text-[#9A97AD] mt-0.5 truncate max-w-xs">{r.note}</p>}
        </td>
        <td className="px-5 py-4 text-sm text-[#3A3556] whitespace-nowrap">{formatDateCourt(r.date_creneau)}</td>
        <td className="px-5 py-4 text-sm text-[#3A3556] whitespace-nowrap">
          {r.heure_debut.slice(0, 5)}–{r.heure_fin.slice(0, 5)}
        </td>
        <td className="px-5 py-4">
          {participants.length === 0 ? <span className="text-[#B4B1C4] text-sm">—</span> : (
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5">
                {participants.slice(0, 4).map((p) => <Avatar key={p.id} r={p} />)}
              </div>
              {participants.length > 4 && <span className="text-xs text-[#9A97AD]">+{participants.length - 4}</span>}
            </div>
          )}
        </td>
        <td className="px-5 py-4"><BadgeStatut statut={r.statut} aCr={r.a_cr} nonLu={r.cr_non_lu} /></td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1B1633]">

      {/* 📱 MOBILE */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[#EEEDF5] bg-white px-5 py-4 shadow-sm">
          <button onClick={() => router.push("/dashboard")}
            className="mb-1 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
          <h1 className="text-lg font-semibold">Réunions</h1>
          <div className="mt-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B4B1C4] text-sm">🔍</span>
              <input type="text" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[#E7E6EF] bg-white py-2 pl-9 pr-4 text-sm outline-none
                           placeholder:text-[#B4B1C4] focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15 transition" />
            </div>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-[#6C6A80]">
            <input type="checkbox" checked={crManquantOnly} onChange={(e) => setCrManquantOnly(e.target.checked)}
              className="rounded border-[#D1CFE2]" />
            CR manquant uniquement
          </label>
        </header>
        <main className="flex-1 px-5 py-5 space-y-3">
          {filtered.length === 0
            ? <p className="py-12 text-center text-sm text-[#9A97AD]">Aucune réunion trouvée.</p>
            : filtered.map((r) => <CarteReunion key={r.id} r={r} />)}
          <p className="pt-2 text-center text-xs text-[#9A97AD]">
            {filtered.length} réunion(s) sur {reunions.length}
          </p>
        </main>
      </div>

      {/* 💻 PC */}
      <div className="hidden lg:block px-10 py-8 max-w-6xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <button onClick={() => router.push("/dashboard")}
              className="mb-1 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
            <h1 className="text-2xl font-semibold">Réunions</h1>
            <p className="mt-0.5 text-sm text-[#6C6A80]">Toutes les réunions et formations, du plus récent au plus ancien.</p>
          </div>
          <button onClick={() => router.push("/agenda")}
            className="rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2A1E5C] transition">
            ＋ Planifier depuis l'agenda
          </button>
        </div>

        <div className="mb-5 flex items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B4B1C4] text-sm">🔍</span>
            <input type="text" placeholder="Rechercher une réunion…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#E7E6EF] bg-white py-2 pl-9 pr-4 text-sm outline-none
                         placeholder:text-[#B4B1C4] focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15 transition" />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#3A3556]">
            <input type="checkbox" checked={crManquantOnly} onChange={(e) => setCrManquantOnly(e.target.checked)}
              className="rounded border-[#D1CFE2]" />
            CR manquant uniquement
          </label>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#EEEDF5] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#EEEDF5] bg-[#F8F7FC]">
                {["Réunion", "Date", "Horaire", "Participants", "Statut"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F2FA]">
              {filtered.length === 0
                ? <tr><td colSpan={5} className="px-5 py-12 text-center text-[#9A97AD]">Aucune réunion ne correspond à votre recherche.</td></tr>
                : filtered.map((r) => <LigneTableau key={r.id} r={r} />)}
            </tbody>
          </table>
          <div className="border-t border-[#EEEDF5] px-5 py-3 text-xs text-[#9A97AD]">
            {filtered.length} réunion(s) affichée(s) sur {reunions.length}
          </div>
        </div>
      </div>
    </div>
  );
}