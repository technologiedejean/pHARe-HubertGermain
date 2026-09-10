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

// Le statut affiché est calculé à partir de la date et de l'heure de fin,
// et non du champ "statut" stocké en base (qui n'est jamais mis à jour).
function estPassee(r: Reunion, maintenant: Date): boolean {
  const [y, m, d] = r.date_creneau.split("-").map(Number);
  const [hh, mm] = r.heure_fin.slice(0, 5).split(":").map(Number);
  const fin = new Date(y, m - 1, d, hh, mm, 0, 0);
  return fin.getTime() < maintenant.getTime();
}

/* ============================================================
   Composants de base
   (définis au niveau module — jamais dans le rendu de la page,
   sinon le textarea perd le focus à chaque frappe)
   ============================================================ */
function Avatar({ r }: { r: Referent }) {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white"
      style={{ backgroundColor: r.couleur }} title={`${r.prenom} ${r.nom}`}>
      {r.prenom[0]}{r.nom[0]}
    </div>
  );
}

function BadgeStatut({ passee, aCr, nonLu }: { passee: boolean; aCr?: boolean; nonLu?: boolean }) {
  if (!passee) return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Prévue
    </span>
  );
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F2FA] px-2.5 py-0.5 text-xs font-medium text-[#6C6A80]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#B4B1C4]" /> Passée
      </span>
      {aCr ? (
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
      )}
    </span>
  );
}

/* ── Chevron ouvrir/fermer ──────────────────────────────────── */
function BoutonChevron({ ouvert, onClick, titre }: { ouvert: boolean; onClick: () => void; titre?: string }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={titre ?? (ouvert ? "Replier" : "Déplier")}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#6C6A80] transition
                  hover:bg-[#F3F2FA] hover:text-[#6656B8] ${ouvert ? "rotate-90" : ""}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    </button>
  );
}

/* ── Crayon ─────────────────────────────────────────────────── */
function BoutonCrayon({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} title="Modifier la note"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#9A97AD] transition
                 hover:bg-[#F3F2FA] hover:text-[#6656B8]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  );
}

/* ── Éditeur de note (partagé mobile / PC) ──────────────────── */
function EditeurNote({ valeur, onChange, onSave, onCancel, saving }: {
  valeur: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="space-y-2">
      <textarea value={valeur} onChange={(e) => onChange(e.target.value)} rows={3} autoFocus
        placeholder="Note de la réunion…"
        className="w-full resize-y rounded-xl border border-[#7C6BD6] bg-white px-3 py-2 text-sm text-[#3A3556] outline-none
                   focus:ring-2 focus:ring-[#7C6BD6]/15 transition" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={saving}
          className="rounded-lg border border-[#E7E6EF] bg-white px-3 py-1.5 text-xs font-medium text-[#6C6A80] hover:bg-[#F8F7FC] transition">
          Annuler
        </button>
        <button type="button" onClick={onSave} disabled={saving}
          className="rounded-lg bg-[#6656B8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5546A6] transition disabled:opacity-60">
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

/* ── Props communes aux cartes et lignes ────────────────────── */
type PropsLigne = {
  r: Reunion;
  maintenant: Date;
  ouverte: boolean;
  onToggle: () => void;
  peutEditer: boolean;
  enEdition: boolean;
  noteEdition: string;
  setNoteEdition: (v: string) => void;
  onCommencerEdition: () => void;
  onSauvegarder: () => void;
  onAnnuler: () => void;
  saving: boolean;
  onOuvrir: () => void;
};

/* ── Carte (mobile) ─────────────────────────────────────────── */
function CarteReunion(p: PropsLigne) {
  const { r, maintenant, ouverte, onToggle, peutEditer, enEdition, noteEdition, setNoteEdition,
          onCommencerEdition, onSauvegarder, onAnnuler, saving, onOuvrir } = p;
  const participants = tousLesParticipants(r);
  const aNote = !!r.note?.trim();
  return (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-4 shadow-sm cursor-pointer" onClick={onOuvrir}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#1B1633] leading-snug">{r.titre}</p>
          <p className="text-xs text-[#9A97AD] mt-0.5">
            {formatDateCourt(r.date_creneau)} · {r.heure_debut.slice(0, 5)}–{r.heure_fin.slice(0, 5)}
          </p>
        </div>
      </div>
      <div className="mb-2">
        <BadgeStatut passee={estPassee(r, maintenant)} aCr={r.a_cr} nonLu={r.cr_non_lu} />
      </div>

      {/* Note */}
      {enEdition ? (
        <div className="mt-2">
          <EditeurNote valeur={noteEdition} onChange={setNoteEdition} onSave={onSauvegarder} onCancel={onAnnuler} saving={saving} />
        </div>
      ) : (aNote || peutEditer) && (
        <div className="mt-2 flex items-start gap-1">
          {aNote && <BoutonChevron ouvert={ouverte} onClick={onToggle} />}
          <p className={`flex-1 min-w-0 text-xs text-[#6C6A80] leading-relaxed ${ouverte ? "whitespace-pre-wrap" : "truncate"}`}>
            {aNote ? r.note : <span className="italic text-[#B4B1C4]">Aucune note</span>}
          </p>
          {peutEditer && <BoutonCrayon onClick={onCommencerEdition} />}
        </div>
      )}

      {participants.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex -space-x-1.5">
            {participants.slice(0, 5).map((x) => <Avatar key={x.id} r={x} />)}
          </div>
          <span className="text-xs text-[#6C6A80] ml-1 truncate">
            {participants.map((x) => `${x.prenom} ${x.nom}`).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Ligne de tableau (PC) ──────────────────────────────────── */
function LigneTableau(p: PropsLigne) {
  const { r, maintenant, ouverte, onToggle, peutEditer, enEdition, noteEdition, setNoteEdition,
          onCommencerEdition, onSauvegarder, onAnnuler, saving, onOuvrir } = p;
  const participants = tousLesParticipants(r);
  const aNote = !!r.note?.trim();
  return (
    <>
      <tr className={`transition-colors cursor-pointer ${enEdition ? "bg-[#F8F7FC]" : "hover:bg-[#F8F7FC]"}`} onClick={onOuvrir}>
        <td className="pl-4 pr-1 py-4 align-top w-8">
          {aNote && <BoutonChevron ouvert={ouverte} onClick={onToggle} />}
        </td>
        <td className="px-2 py-4">
          <p className="font-medium text-[#1B1633] leading-snug">{r.titre}</p>
          {!enEdition && (aNote || peutEditer) && (
            <div className="mt-0.5 flex items-start gap-1">
              <p className={`flex-1 min-w-0 text-xs text-[#9A97AD] ${ouverte ? "whitespace-pre-wrap max-w-xl" : "truncate max-w-xs"}`}>
                {aNote ? r.note : <span className="italic text-[#B4B1C4]">Aucune note</span>}
              </p>
              {peutEditer && <BoutonCrayon onClick={onCommencerEdition} />}
            </div>
          )}
        </td>
        <td className="px-5 py-4 text-sm text-[#3A3556] whitespace-nowrap align-top">{formatDateCourt(r.date_creneau)}</td>
        <td className="px-5 py-4 text-sm text-[#3A3556] whitespace-nowrap align-top">
          {r.heure_debut.slice(0, 5)}–{r.heure_fin.slice(0, 5)}
        </td>
        <td className="px-5 py-4 align-top">
          {participants.length === 0 ? <span className="text-[#B4B1C4] text-sm">—</span> : (
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5">
                {participants.slice(0, 4).map((x) => <Avatar key={x.id} r={x} />)}
              </div>
              {participants.length > 4 && <span className="text-xs text-[#9A97AD]">+{participants.length - 4}</span>}
            </div>
          )}
        </td>
        <td className="px-5 py-4 whitespace-nowrap align-top">
          <BadgeStatut passee={estPassee(r, maintenant)} aCr={r.a_cr} nonLu={r.cr_non_lu} />
        </td>
      </tr>

      {/* Ligne d'édition de la note */}
      {enEdition && (
        <tr className="bg-[#F8F7FC]">
          <td />
          <td colSpan={5} className="px-2 pb-4 pt-0">
            <EditeurNote valeur={noteEdition} onChange={setNoteEdition} onSave={onSauvegarder} onCancel={onAnnuler} saving={saving} />
          </td>
        </tr>
      )}
    </>
  );
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
  const [maintenant, setMaintenant] = useState<Date>(() => new Date());

  // Accordéon : réunions dont la note est dépliée
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());
  // Édition de note
  const [enEditionId, setEnEditionId] = useState<string | null>(null);
  const [noteEdition, setNoteEdition] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
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

    const crParCreneau = new Map<string, string>();
    for (const cr of (crsRes.data ?? [])) {
      if (cr.creneau_id) crParCreneau.set(cr.creneau_id, cr.id);
    }
    const crIds = Array.from(crParCreneau.values());

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

  /* ── Actions note ─────────────────────────────────────────── */
  const toggleOuverte = (id: string) => {
    setOuvertes((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const commencerEdition = (r: Reunion) => {
    setEnEditionId(r.id);
    setNoteEdition(r.note ?? "");
  };

  const annulerEdition = () => {
    setEnEditionId(null);
    setNoteEdition("");
  };

  const sauvegarderNote = async () => {
    if (!enEditionId) return;
    setSaving(true);
    const nouvelleNote = noteEdition.trim() || null;
    const { error } = await supabase.from("creneaux").update({ note: nouvelleNote }).eq("id", enEditionId);
    setSaving(false);
    if (error) { alert("Impossible d'enregistrer la note : " + error.message); return; }
    setReunions((prev) => prev.map((r) => (r.id === enEditionId ? { ...r, note: nouvelleNote } : r)));
    annulerEdition();
  };

  const peutEditer = (r: Reunion) =>
    !!profile && (profile.role === "admin" || r.referent_charge_id === profile.id);

  const filtered = reunions.filter((r) => {
    const q = search.toLowerCase();
    return !q || (r.titre ?? "").toLowerCase().includes(q);
  });

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement des réunions…</span>
      </div>
    );
  }

  const propsPour = (r: Reunion): PropsLigne => ({
    r,
    maintenant,
    ouverte: ouvertes.has(r.id),
    onToggle: () => toggleOuverte(r.id),
    peutEditer: peutEditer(r),
    enEdition: enEditionId === r.id,
    noteEdition,
    setNoteEdition,
    onCommencerEdition: () => commencerEdition(r),
    onSauvegarder: sauvegarderNote,
    onAnnuler: annulerEdition,
    saving,
    onOuvrir: () => router.push(`/reunions/${r.id}`),
  });

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
        </header>
        <main className="flex-1 px-5 py-5 space-y-3">
          {filtered.length === 0
            ? <p className="py-12 text-center text-sm text-[#9A97AD]">Aucune réunion trouvée.</p>
            : filtered.map((r) => <CarteReunion key={r.id} {...propsPour(r)} />)}
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

        <div className="mb-5">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B4B1C4] text-sm">🔍</span>
            <input type="text" placeholder="Rechercher une réunion…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#E7E6EF] bg-white py-2 pl-9 pr-4 text-sm outline-none
                         placeholder:text-[#B4B1C4] focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15 transition" />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#EEEDF5] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#EEEDF5] bg-[#F8F7FC]">
                <th className="w-8" />
                {["Réunion", "Date", "Horaire", "Participants", "Statut"].map((h, i) => (
                  <th key={h} className={`${i === 0 ? "px-2" : "px-5"} py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-[#9A97AD]`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F2FA]">
              {filtered.length === 0
                ? <tr><td colSpan={6} className="px-5 py-12 text-center text-[#9A97AD]">Aucune réunion ne correspond à votre recherche.</td></tr>
                : filtered.map((r) => <LigneTableau key={r.id} {...propsPour(r)} />)}
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