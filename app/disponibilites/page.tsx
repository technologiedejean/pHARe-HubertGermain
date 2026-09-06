// >>> Ce fichier CRÉE : app/disponibilites/page.tsx <<<
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Types
   ============================================================ */
type Profile = { id: string; role: "admin" | "referent"; couleur: string; nom: string; prenom: string };
type Personne = { id: string; nom: string; prenom: string; couleur: string; role: "admin" | "referent" };
type DispoRow = { id: string; referent_id: string; jour_semaine: number; code: string; semaine: "A" | "B" };
type Semaine = "A" | "B";
type Etat = { A: boolean; B: boolean; fusion: boolean };

/* ============================================================
   Grille horaire du collège
   ============================================================ */
const AXE_DEB = 8 * 60 + 15;   // 8h15
const AXE_FIN = 17 * 60 + 30;  // 17h30
const PXMIN   = 1.35;
const HAUTEUR = (AXE_FIN - AXE_DEB) * PXMIN;

type Periode = { code: string; d: string; f: string };

const STD: Periode[] = [
  { code: "M1", d: "9h00",  f: "9h55"  },
  { code: "M2", d: "9h55",  f: "10h50" },
  { code: "M3", d: "11h05", f: "12h00" },
  { code: "M4", d: "12h00", f: "12h55" },
  { code: "S1", d: "13h25", f: "14h20" },
  { code: "S2", d: "14h20", f: "15h15" },
  { code: "S3", d: "15h30", f: "16h25" },
  { code: "S4", d: "16h25", f: "17h20" },
];
const MER: Periode[] = [
  { code: "M1", d: "8h30",  f: "9h25"  },
  { code: "M2", d: "9h25",  f: "10h20" },
  { code: "M3", d: "10h35", f: "11h30" },
  { code: "M4", d: "11h30", f: "12h25" },
];

const JOURS = [
  { id: 1, nom: "Lundi",    court: "Lun", periodes: STD, merc: false },
  { id: 2, nom: "Mardi",    court: "Mar", periodes: STD, merc: false },
  { id: 3, nom: "Mercredi", court: "Mer", periodes: MER, merc: true  },
  { id: 4, nom: "Jeudi",    court: "Jeu", periodes: STD, merc: false },
  { id: 5, nom: "Vendredi", court: "Ven", periodes: STD, merc: false },
];

/* ============================================================
   Helpers
   ============================================================ */
function toMin(t: string): number { const [h, m] = t.split("h"); return Number(h) * 60 + Number(m || 0); }
function topPx(t: string): number { return (toMin(t) - AXE_DEB) * PXMIN; }
function nomComplet(p: { prenom: string; nom: string }): string { return `${p.prenom} ${p.nom}`; }
function keyDispo(j: number, code: string, s: Semaine): string { return `${j}|${code}|${s}`; }
function periodesJour(jourId: number): Periode[] { return JOURS.find((j) => j.id === jourId)!.periodes; }

/* ============================================================
   Page
   ============================================================ */
export default function DisponibilitesPage() {
  const router = useRouter();

  const [profile, setProfile]   = useState<Profile | null>(null);
  const [personnes, setPersonnes] = useState<Personne[]>([]);
  const [loading, setLoading]   = useState(true);
  const [mode, setMode]         = useState<"edition" | "consultation">("edition");

  // Édition (mes dispos)
  const [etat, setEtat]         = useState<Record<number, Record<string, Etat>>>({});
  const dbKeysRef               = useRef<Map<string, string>>(new Map()); // key -> row id
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState<{ type: "ok" | "err"; texte: string } | null>(null);

  // Consultation
  const [dispoParPersonne, setDispoParPersonne] = useState<Map<string, Set<string>>>(new Map());
  const [selection, setSelection]               = useState<Set<string>>(new Set());

  // Mobile : jour affiché
  const [jourMobile, setJourMobile] = useState<number>(1);

  /* ---------- Construction de l'état d'édition depuis les lignes ---------- */
  const construireEtat = useCallback((rows: DispoRow[]) => {
    const e: Record<number, Record<string, Etat>> = {};
    const dbKeys = new Map<string, string>();
    for (const j of JOURS) { e[j.id] = {}; for (const p of j.periodes) e[j.id][p.code] = { A: false, B: false, fusion: true }; }
    for (const r of rows) {
      if (!e[r.jour_semaine]?.[r.code]) continue;
      e[r.jour_semaine][r.code][r.semaine] = true;
      dbKeys.set(keyDispo(r.jour_semaine, r.code, r.semaine), r.id);
    }
    for (const j of JOURS) for (const p of j.periodes) {
      const c = e[j.id][p.code];
      c.fusion = c.A === c.B; // fusion déduite : A = B
    }
    dbKeysRef.current = dbKeys;
    setEtat(e);
  }, []);

  /* ---------- Chargement ---------- */
  const chargerTout = useCallback(async (monId: string) => {
    const { data } = await supabase
      .from("disponibilites")
      .select("id, referent_id, jour_semaine, code, semaine");
    const rows = (data ?? []) as DispoRow[];

    // Mes dispos → édition
    construireEtat(rows.filter((r) => r.referent_id === monId));

    // Toutes les dispos → consultation
    const map = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = map.get(r.referent_id) ?? new Set<string>();
      set.add(keyDispo(r.jour_semaine, r.code, r.semaine));
      map.set(r.referent_id, set);
    }
    setDispoParPersonne(map);
  }, [construireEtat]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: prof } = await supabase
        .from("profiles").select("id, role, couleur, nom, prenom").eq("id", user.id).single();
      if (!prof) { router.push("/login"); return; }
      setProfile(prof);

      const { data: gens } = await supabase
        .from("profiles").select("id, nom, prenom, couleur, role").eq("actif", true).order("nom");
      const liste = (gens ?? []) as Personne[];
      setPersonnes(liste);
      setSelection(new Set(prof ? [prof.id] : []));

      await chargerTout(prof.id);
      setLoading(false);
    }
    init();
  }, [router, chargerTout]);

  /* ---------- Diff / dirty ---------- */
  const desiredKeys = new Set<string>();
  for (const j of JOURS) for (const p of j.periodes) {
    const c = etat[j.id]?.[p.code]; if (!c) continue;
    if (c.A) desiredKeys.add(keyDispo(j.id, p.code, "A"));
    if (c.B) desiredKeys.add(keyDispo(j.id, p.code, "B"));
  }
  const aInserer  = Array.from(desiredKeys).filter((k) => !dbKeysRef.current.has(k));
  const aSupprimer = Array.from(dbKeysRef.current.keys()).filter((k) => !desiredKeys.has(k));
  const dirty = aInserer.length > 0 || aSupprimer.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  /* ---------- Mutations d'état (édition) ---------- */
  function majCase(jour: number, code: string, fn: (c: Etat) => Etat) {
    setEtat((prev) => {
      const copie = { ...prev, [jour]: { ...prev[jour], [code]: fn(prev[jour][code]) } };
      return copie;
    });
    setMessage(null);
  }
  const toggleFusion = (j: number, c: string) => majCase(j, c, (s) =>
    s.A === s.B ? { ...s, fusion: !s.fusion } : (s.fusion ? { ...s, fusion: false } : { A: s.A || s.B, B: s.A || s.B, fusion: true }));
  const clicFusionne = (j: number, c: string) => majCase(j, c, (s) => { const v = !s.A; return { A: v, B: v, fusion: true }; });
  const clicA = (j: number, c: string) => majCase(j, c, (s) => ({ ...s, A: !s.A }));
  const clicB = (j: number, c: string) => majCase(j, c, (s) => ({ ...s, B: !s.B }));

  function toutEffacer() {
    if (!confirm("Effacer toutes vos disponibilités ?")) return;
    setEtat((prev) => {
      const e: Record<number, Record<string, Etat>> = {};
      for (const j of JOURS) { e[j.id] = {}; for (const p of j.periodes) e[j.id][p.code] = { A: false, B: false, fusion: true }; }
      return e;
    });
    setMessage(null);
  }
  function annuler() { if (profile) construireEtat(rowsFromDb()); setMessage(null); }
  function rowsFromDb(): DispoRow[] {
    return Array.from(dbKeysRef.current.entries()).map(([k, id]) => {
      const [j, code, s] = k.split("|");
      return { id, referent_id: profile!.id, jour_semaine: Number(j), code, semaine: s as Semaine };
    });
  }

  /* ---------- Enregistrement ---------- */
  async function enregistrer() {
    if (!dirty || !profile) return;
    setSaving(true); setMessage(null);
    let erreur: string | null = null;

    if (aSupprimer.length > 0) {
      const ids = aSupprimer.map((k) => dbKeysRef.current.get(k)!);
      const { error } = await supabase.from("disponibilites").delete().in("id", ids);
      if (error) erreur = error.message;
    }
    if (!erreur && aInserer.length > 0) {
      const rows = aInserer.map((k) => { const [j, code, s] = k.split("|");
        return { referent_id: profile.id, jour_semaine: Number(j), code, semaine: s as Semaine }; });
      const { error } = await supabase.from("disponibilites").insert(rows);
      if (error) erreur = error.message;
    }

    await chargerTout(profile.id);
    setSaving(false);
    setMessage(erreur ? { type: "err", texte: `Erreur : ${erreur}` } : { type: "ok", texte: "Disponibilités enregistrées." });
  }

  /* ---------- Consultation : qui est dispo ? ---------- */
  function refsDispo(jour: number, code: string, s: Semaine): Personne[] {
    const k = keyDispo(jour, code, s);
    return personnes.filter((p) => selection.has(p.id) && dispoParPersonne.get(p.id)?.has(k));
  }
  const toggleRef = (id: string) => setSelection((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const tousRefs  = () => setSelection(new Set(personnes.map((p) => p.id)));
  const aucunRef  = () => setSelection(new Set());

  /* ============================================================
     Rendu
     ============================================================ */
  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement des disponibilités…</span>
      </div>
    );
  }

  const maCouleur = profile.couleur;

  /* ---------- Bascule Édition / Consultation ---------- */
  const Bascule = () => (
    <div className="inline-flex rounded-xl border border-[#E7E6EF] bg-white p-1 text-sm">
      <button onClick={() => setMode("edition")}
        className={`rounded-lg px-3 py-1.5 transition ${mode === "edition" ? "bg-[#1A1440] text-white" : "text-[#3A3556] hover:bg-[#F3F2FA]"}`}>
        Mes disponibilités
      </button>
      <button onClick={() => setMode("consultation")}
        className={`rounded-lg px-3 py-1.5 transition ${mode === "consultation" ? "bg-[#1A1440] text-white" : "text-[#3A3556] hover:bg-[#F3F2FA]"}`}>
        Consulter les référents
      </button>
    </div>
  );

  /* ---------- Barre d'actions (édition) ---------- */
  const Actions = () => (
    <div className="flex flex-col gap-2">
      <button onClick={enregistrer} disabled={!dirty || saving}
        className="w-full rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2A1E5C] transition disabled:opacity-40 disabled:cursor-not-allowed">
        {saving ? "Enregistrement…" : dirty ? "Enregistrer les modifications" : "Enregistré"}
      </button>
      <div className="flex gap-2">
        <button onClick={annuler} disabled={!dirty || saving}
          className="flex-1 rounded-xl border border-[#E7E6EF] bg-white px-3 py-2 text-xs text-[#3A3556] hover:bg-[#F3F2FA] transition disabled:opacity-40">Annuler</button>
        <button onClick={toutEffacer} disabled={saving}
          className="flex-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition disabled:opacity-40">Tout effacer</button>
      </div>
      {message && <p className={`text-xs ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}>{message.texte}</p>}
    </div>
  );

  /* ---------- Sélecteur de référents (consultation) ---------- */
  const SelecteurReferents = () => (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#9B98AE]">Référents</span>
        <span className="text-xs">
          <button onClick={tousRefs} className="text-[#6656B8] hover:underline">Tous</button>
          <span className="mx-1 text-[#D8D6E4]">|</span>
          <button onClick={aucunRef} className="text-[#6656B8] hover:underline">Aucun</button>
        </span>
      </div>
      <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
        {personnes.map((p) => {
          const coche = selection.has(p.id);
          return (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-[#F7F6FC]">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition"
                style={{ backgroundColor: coche ? p.couleur : "#fff", borderColor: coche ? p.couleur : "#D8D6E4" }}>
                {coche && <span className="text-[10px] leading-none text-white">✓</span>}
              </span>
              <input type="checkbox" className="sr-only" checked={coche} onChange={() => toggleRef(p.id)} />
              <span className="flex-1 text-sm text-[#1B1633]">{nomComplet(p)}</span>
              {p.role === "admin" && (
                <span className="rounded-md bg-[#1A1440] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">ADMIN</span>
              )}
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.couleur }} />
            </label>
          );
        })}
      </div>
    </div>
  );

  /* ---------- En-têtes de jours ---------- */
  const EntetesJours = () => (
    <div className="grid border-b border-[#EEEDF5]" style={{ gridTemplateColumns: "58px repeat(5, 1fr)" }}>
      <div className="bg-[#FBFBFD] border-r border-[#EEEDF5] py-2 text-center text-xs font-semibold text-[#9B98AE]">Horaire</div>
      {JOURS.map((j) => (
        <div key={j.id}
          className={`bg-[#FBFBFD] border-r border-[#EEEDF5] py-2 text-center text-sm font-semibold last:border-r-0 ${j.merc ? "shadow-[inset_0_-3px_0_#FCEA00]" : ""}`}>
          {j.nom}
          <span className="block text-[11px] font-normal text-[#9B98AE]">{j.merc ? "horaires spécifiques" : "\u00A0"}</span>
        </div>
      ))}
    </div>
  );

  /* ---------- Axe horaire ---------- */
  const heuresRepere = [9, 10, 11, 12, 13, 14, 15, 16, 17];
  const Axe = () => (
    <div className="relative border-r border-[#EEEDF5] bg-[#FBFBFD]" style={{ height: HAUTEUR }}>
      {heuresRepere.map((h) => (
        <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] text-[#9B98AE]"
          style={{ top: (h * 60 - AXE_DEB) * PXMIN }}>{h}h</div>
      ))}
    </div>
  );

  /* ---------- Grille PC (édition) ---------- */
  const GrilleEdition = () => (
    <div className="inline-block min-w-full rounded-2xl border border-[#EEEDF5] bg-white overflow-hidden">
      <EntetesJours />
      <div className="grid" style={{ gridTemplateColumns: "58px repeat(5, 1fr)" }}>
        <Axe />
        {JOURS.map((j) => (
          <div key={j.id}
            className="relative border-r border-[#EEEDF5] last:border-r-0"
            style={{ height: HAUTEUR, background: j.merc
              ? "repeating-linear-gradient(-45deg,#FBF6D9 0 5px,#FFFDF0 5px 10px)"
              : "repeating-linear-gradient(-45deg,#F4F3FA 0 5px,#FBFBFD 5px 10px)" }}>
            {heuresRepere.map((h) => (
              <div key={h} className="absolute inset-x-0 border-t border-[#EFEEF6]" style={{ top: (h * 60 - AXE_DEB) * PXMIN }} />
            ))}
            {j.periodes.map((p) => {
              const c = etat[j.id][p.code];
              const top = topPx(p.d), height = (toMin(p.f) - toMin(p.d)) * PXMIN - 2;
              return (
                <div key={p.code}
                  className="group absolute left-1 right-1 flex overflow-hidden rounded-lg border border-[#EEEDF5] bg-white"
                  style={{ top, height }}>
                  {c.fusion ? (
                    <DemiCase code={p.code} heure={`${p.d}–${p.f}`} tag="A+B" on={c.A} couleur={maCouleur}
                      onClick={() => clicFusionne(j.id, p.code)} />
                  ) : (
                    <>
                      <DemiCase code={p.code} heure={`${p.d}–${p.f}`} tag="A" on={c.A} couleur={maCouleur} onClick={() => clicA(j.id, p.code)} />
                      <DemiCase code="" heure="" tag="B" on={c.B} couleur={maCouleur} onClick={() => clicB(j.id, p.code)} bordure />
                    </>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); toggleFusion(j.id, p.code); }}
                    title={c.fusion ? "Séparer A / B" : "Fusionner A = B"}
                    className={`absolute right-1 top-1 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border text-[10px] transition
                      ${c.fusion ? "border-[#FCEA00] bg-[#FCEA00] text-[#1A1440] opacity-100"
                                 : "border-[#EEEDF5] bg-white text-[#6C6A80] opacity-0 group-hover:opacity-100"}`}>⇔</button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  /* ---------- Grille PC (consultation) ---------- */
  const GrilleConsultation = () => (
    <div className="inline-block min-w-full rounded-2xl border border-[#EEEDF5] bg-white overflow-hidden">
      <EntetesJours />
      <div className="grid" style={{ gridTemplateColumns: "58px repeat(5, 1fr)" }}>
        <Axe />
        {JOURS.map((j) => (
          <div key={j.id}
            className="relative border-r border-[#EEEDF5] last:border-r-0"
            style={{ height: HAUTEUR, background: j.merc
              ? "repeating-linear-gradient(-45deg,#FBF6D9 0 5px,#FFFDF0 5px 10px)"
              : "repeating-linear-gradient(-45deg,#F4F3FA 0 5px,#FBFBFD 5px 10px)" }}>
            {heuresRepere.map((h) => (
              <div key={h} className="absolute inset-x-0 border-t border-[#EFEEF6]" style={{ top: (h * 60 - AXE_DEB) * PXMIN }} />
            ))}
            {j.periodes.map((p) => {
              const top = topPx(p.d), height = (toMin(p.f) - toMin(p.d)) * PXMIN - 2;
              const a = refsDispo(j.id, p.code, "A"), b = refsDispo(j.id, p.code, "B");
              return (
                <div key={p.code} className="absolute left-1 right-1 flex overflow-hidden rounded-lg border border-[#EEEDF5] bg-white"
                  style={{ top, height }}>
                  <PastilleZone code={p.code} tag="A" refs={a} />
                  <PastilleZone code="" tag="B" refs={b} bordure />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  /* ---------- MOBILE : sélecteur de jour ---------- */
  const OngletsJours = () => (
    <div className="grid grid-cols-5 gap-1">
      {JOURS.map((j) => (
        <button key={j.id} onClick={() => setJourMobile(j.id)}
          className={`rounded-xl py-2 text-xs font-medium transition ${jourMobile === j.id ? "bg-[#1A1440] text-white" : "border border-[#E7E6EF] bg-white text-[#3A3556]"} ${j.merc ? "ring-1 ring-[#FCEA00]" : ""}`}>
          {j.court}
        </button>
      ))}
    </div>
  );

  /* ---------- MOBILE : liste des créneaux d'un jour (édition) ---------- */
  const ListeEditionMobile = () => (
    <div className="space-y-2">
      {periodesJour(jourMobile).map((p) => {
        const c = etat[jourMobile][p.code];
        return (
          <div key={p.code} className="rounded-xl border border-[#EEEDF5] bg-white p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">{p.code} <span className="font-normal text-[#6C6A80]">{p.d}–{p.f}</span></span>
              <button onClick={() => toggleFusion(jourMobile, p.code)}
                className={`rounded-lg border px-2 py-0.5 text-[11px] ${c.fusion ? "border-[#FCEA00] bg-[#FCEA00] text-[#1A1440]" : "border-[#E7E6EF] bg-white text-[#6C6A80]"}`}>
                {c.fusion ? "A = B" : "A / B séparés"} ⇔
              </button>
            </div>
            {c.fusion ? (
              <BoutonSemaine label="Semaines A et B" on={c.A} couleur={maCouleur} onClick={() => clicFusionne(jourMobile, p.code)} />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <BoutonSemaine label="Semaine A" on={c.A} couleur={maCouleur} onClick={() => clicA(jourMobile, p.code)} />
                <BoutonSemaine label="Semaine B" on={c.B} couleur={maCouleur} onClick={() => clicB(jourMobile, p.code)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  /* ---------- MOBILE : liste consultation ---------- */
  const ListeConsultationMobile = () => (
    <div className="space-y-2">
      {periodesJour(jourMobile).map((p) => {
        const a = refsDispo(jourMobile, p.code, "A"), b = refsDispo(jourMobile, p.code, "B");
        return (
          <div key={p.code} className="rounded-xl border border-[#EEEDF5] bg-white p-2.5">
            <div className="mb-1.5 text-sm font-semibold">{p.code} <span className="font-normal text-[#6C6A80]">{p.d}–{p.f}</span></div>
            <div className="grid grid-cols-2 gap-2">
              <ZoneMobile tag="A" refs={a} />
              <ZoneMobile tag="B" refs={b} />
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ============================================================
     Layout
     ============================================================ */
  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1B1633]">

      {/* 📱 MOBILE */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[#EEEDF5] bg-white px-5 py-4 shadow-sm space-y-3">
          <div>
            <button onClick={() => router.push("/dashboard")} className="mb-0.5 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
            <h1 className="text-lg font-semibold">Disponibilités</h1>
          </div>
          <Bascule />
        </header>
        <main className="flex-1 px-4 py-4 space-y-4">
          {mode === "edition" ? (
            <>
              <p className="text-xs text-[#6C6A80]">Coche les créneaux libres de ton emploi du temps où tu peux mener un entretien ou une réunion.</p>
              <OngletsJours />
              <ListeEditionMobile />
              <Actions />
            </>
          ) : (
            <>
              <SelecteurReferents />
              <OngletsJours />
              <ListeConsultationMobile />
            </>
          )}
        </main>
      </div>

      {/* 💻 PC */}
      <div className="hidden lg:flex min-h-screen">
        <aside className="w-64 shrink-0 border-r border-[#EEEDF5] bg-white p-4 space-y-4 overflow-y-auto">
          <div>
            <button onClick={() => router.push("/dashboard")} className="text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
            <h1 className="mt-1 text-lg font-semibold">Disponibilités</h1>
          </div>
          <Bascule />
          {mode === "edition" ? (
            <>
              <div className="rounded-xl border border-[#EEEDF5] bg-white p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: maCouleur }} />
                  <span className="font-medium">{nomComplet(profile)}</span>
                </div>
                <p className="mt-2 text-xs text-[#6C6A80]">Clique une case pour te rendre disponible. Le bouton ⇔ fusionne la semaine A et la semaine B.</p>
              </div>
              <Actions />
            </>
          ) : (
            <SelecteurReferents />
          )}
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden px-6 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {mode === "edition" ? `Ma semaine type — ${nomComplet(profile)}` : "Disponibilités des référents"}
            </h2>
            {mode === "edition" && dirty && <span className="text-xs text-[#6656B8]">Modifications non enregistrées</span>}
          </div>
          <div className="flex-1 overflow-auto">
            {mode === "edition" ? <GrilleEdition /> : <GrilleConsultation />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Sous-composants (module-level : pas de remount au clavier)
   ============================================================ */
function DemiCase({ code, heure, tag, on, couleur, onClick, bordure }:
  { code: string; heure: string; tag: string; on: boolean; couleur: string; onClick: () => void; bordure?: boolean }) {
  return (
    <div onClick={onClick}
      className={`flex flex-1 cursor-pointer select-none flex-col justify-between p-1.5 text-[11px] transition ${bordure ? "border-l border-dashed border-[#EEEDF5]" : ""} ${on ? "text-white" : "text-[#6C6A80] hover:bg-[#F3F2FA]"}`}
      style={on ? { backgroundColor: couleur } : undefined}>
      <span className="font-bold">{code}</span>
      <span className="font-semibold opacity-90">{tag}</span>
      <span className="text-[10px] opacity-85 whitespace-nowrap">{heure || "\u00A0"}</span>
    </div>
  );
}

function PastilleZone({ code, tag, refs, bordure }:
  { code: string; tag: string; refs: Personne[]; bordure?: boolean }) {
  return (
    <div className={`flex flex-1 flex-col p-1.5 text-[11px] ${bordure ? "border-l border-dashed border-[#EEEDF5]" : ""}`}>
      <span className="mb-1 text-[10px] font-semibold text-[#9B98AE]">{code}{code ? " · " : ""}{tag}</span>
      <div className="flex flex-wrap gap-1">
        {refs.length === 0
          ? <span className="text-[10px] text-[#C9C7D6]">—</span>
          : refs.map((r) => (
              <span key={r.id} title={nomComplet(r)} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.couleur }} />
            ))}
      </div>
    </div>
  );
}

function BoutonSemaine({ label, on, couleur, onClick }:
  { label: string; on: boolean; couleur: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${on ? "border-transparent text-white" : "border-[#E7E6EF] bg-white text-[#3A3556]"}`}
      style={on ? { backgroundColor: couleur } : undefined}>{label}</button>
  );
}

function ZoneMobile({ tag, refs }: { tag: string; refs: Personne[] }) {
  return (
    <div className="rounded-lg border border-[#EEEDF5] p-2">
      <span className="text-[10px] font-semibold text-[#9B98AE]">Semaine {tag}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {refs.length === 0
          ? <span className="text-[11px] text-[#C9C7D6]">Personne</span>
          : refs.map((r) => (
              <span key={r.id} className="flex items-center gap-1 rounded-full bg-[#F5F4FB] px-2 py-0.5 text-[11px]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.couleur }} />{r.prenom}
              </span>
            ))}
      </div>
    </div>
  );
}