// >>> Ce fichier REMPLACE : app/reunions/[id]/page.tsx <<<
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { EditeurRiche, ContenuRiche } from "@/components/EditeurRiche";

/* ============================================================
   Types
   ============================================================ */
type Referent = { id: string; nom: string; prenom: string; couleur: string; role?: "admin" | "referent" };
type Profile  = { id: string; role: "admin" | "referent" };

type Reunion = {
  id: string; date_creneau: string; heure_debut: string; heure_fin: string;
  statut: "prevu" | "realise" | "disponible"; titre: string | null; note: string | null;
  referent_id: string | null; referent_charge_id: string | null;
  referent_charge?: Referent | null;
  participants?: Referent[];
};

type CompteRendu = {
  id: string; contenu: string; created_at: string; updated_at: string; auteur_id: string;
  auteur?: { prenom: string; nom: string; couleur: string };
};

/* ============================================================
   Helpers
   ============================================================ */
function formatDateLongue(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function Avatar({ r, size = "sm" }: { r: Referent; size?: "sm" | "md" }) {
  const sz = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  return (
    <div className={`${sz} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: r.couleur }}>
      {r.prenom[0]}{r.nom[0]}
    </div>
  );
}

// Le contenu des CR est désormais du HTML (éditeur riche). Un simple ".trim()"
// ne suffit pas à détecter un contenu réellement vide (un div contentEditable
// vide peut renvoyer "", "<br>" ou "<p></p>" selon le navigateur) : on retire
// les balises avant de vérifier.
function estVide(html: string): boolean {
  return !html || html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;
}

/* ============================================================
   Infos de la réunion
   (Composant HORS du render de la page pour garder une identité stable
   entre les rendus — sinon les enfants, dont l'éditeur du CR, seraient
   démontés/remontés à chaque frappe.)
   ============================================================ */
function InfosReunion({ reunion, tousParticipants, onAllerAgenda }: {
  reunion: Reunion;
  tousParticipants: Referent[];
  onAllerAgenda: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5 space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-[#1B1633]">{reunion.titre}</h2>
        <p className="text-sm text-[#6C6A80] mt-1 capitalize">{formatDateLongue(reunion.date_creneau)}</p>
        <p className="text-sm text-[#6C6A80]">{reunion.heure_debut.slice(0, 5)} – {reunion.heure_fin.slice(0, 5)}</p>
      </div>
      {reunion.note && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-1">Note</p>
          <p className="text-sm text-[#3A3556] whitespace-pre-wrap">{reunion.note}</p>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD] mb-2">Participants</p>
        {tousParticipants.length === 0 ? (
          <p className="text-sm text-[#B4B1C4] italic">Aucun participant renseigné.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tousParticipants.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 rounded-full border border-[#E7E6EF] bg-[#F8F7FC] px-2.5 py-1">
                <Avatar r={p} />
                <span className="text-sm text-[#1B1633]">{p.prenom} {p.nom}</span>
                {reunion.referent_charge_id === p.id && (
                  <span className="rounded-full bg-[#F5F3FF] px-1.5 py-0.5 text-[9px] font-semibold text-[#6656B8]">En charge</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={onAllerAgenda} className="text-xs text-[#6656B8] hover:underline">
        Modifier l'horaire ou les participants depuis l'agenda →
      </button>
    </div>
  );
}

/* ============================================================
   Panneau compte rendu
   (Idem : composant hors du render de la page.)
   ============================================================ */
function PanneauCR({
  cr, editing, canWrite, isAdmin, contenu, setContenu, saving, deleting,
  onStartEdit, onCancelEdit, onSave, onDelete,
}: {
  cr: CompteRendu | null;
  editing: boolean;
  canWrite: boolean;
  isAdmin: boolean;
  contenu: string;
  setContenu: (v: string) => void;
  saving: boolean;
  deleting: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#EEEDF5] bg-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9A97AD]">Compte rendu</p>
        {/* Suppression réservée à l'admin, uniquement si un CR existe et qu'on n'est pas déjà en édition */}
        {isAdmin && cr && !editing && (
          <button
            onClick={onDelete}
            disabled={deleting}
            title="Supprimer le compte rendu"
            aria-label="Supprimer le compte rendu"
            className="rounded-lg p-1.5 text-[#B4B1C4] hover:bg-red-50 hover:text-red-500 transition disabled:opacity-50"
          >
            {deleting ? (
              <span className="text-xs">…</span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            )}
          </button>
        )}
      </div>
      {editing && canWrite ? (
        <div className="space-y-3">
          <EditeurRiche
            value={contenu}
            onChange={setContenu}
            placeholder="Rédigez le compte rendu de cette réunion…"
            minHeightClass="min-h-[200px]"
            autoFocus
          />
          <div className="flex gap-3">
            <button onClick={onCancelEdit}
              className="flex-1 rounded-xl border border-[#E7E6EF] px-4 py-2 text-sm text-[#3A3556] hover:bg-[#F3F2FA]">
              Annuler
            </button>
            <button onClick={onSave} disabled={saving || estVide(contenu)}
              className="flex-1 rounded-xl bg-[#1A1440] px-4 py-2 text-sm text-white hover:bg-[#2A1E5C] disabled:opacity-50 transition">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      ) : cr ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-[#9A97AD]">
              {cr.auteur?.prenom} {cr.auteur?.nom} · {new Date(cr.created_at).toLocaleDateString("fr-FR")}
              {cr.updated_at !== cr.created_at && " (modifié)"}
            </p>
            {canWrite && (
              <button onClick={onStartEdit}
                className="rounded-xl border border-[#E7E6EF] px-3 py-1.5 text-xs text-[#3A3556] hover:bg-[#F3F2FA] transition">
                ✏️ Modifier
              </button>
            )}
          </div>
          <ContenuRiche html={cr.contenu} />
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-[#9A97AD] mb-3">Aucun compte rendu rédigé pour cette réunion.</p>
          {canWrite ? (
            <button onClick={onStartEdit}
              className="rounded-xl bg-[#1A1440] px-4 py-2 text-sm font-medium text-white hover:bg-[#2A1E5C] transition">
              ✏️ Rédiger le compte rendu
            </button>
          ) : (
            <p className="text-xs text-[#B4B1C4] italic">Seul le référent en charge de cette réunion peut rédiger ce compte rendu.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Page principale
   ============================================================ */
export default function ReunionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const reunionId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [reunion, setReunion] = useState<Reunion | null>(null);
  const [cr, setCr]           = useState<CompteRendu | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [contenu, setContenu] = useState("");
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [reuRes, crRes] = await Promise.all([
      supabase.from("creneaux")
        .select(`
          id, date_creneau, heure_debut, heure_fin, statut, titre, note, referent_id, referent_charge_id,
          referent_charge:profiles!creneaux_referent_charge_id_fkey ( id, nom, prenom, couleur, role ),
          participants:creneau_participants ( referent:profiles ( id, nom, prenom, couleur, role ) )
        `)
        .eq("id", reunionId).single(),
      supabase.from("comptes_rendus")
        .select("id, contenu, created_at, updated_at, auteur_id, auteur:profiles!comptes_rendus_auteur_id_fkey(prenom, nom, couleur)")
        .eq("creneau_id", reunionId)
        .not("contenu", "like", "[NOTE]%")
        .maybeSingle(),
    ]);

    if (reuRes.data) {
      setReunion({
        ...(reuRes.data as any),
        participants: ((reuRes.data as any).participants ?? []).map((p: any) => p.referent).filter(Boolean),
      });
    }
    setCr(crRes.data as any);

    // Cette page constitue "l'ouverture" du compte rendu : on marque
    // immédiatement sa lecture pour l'utilisateur connecté, s'il ne l'avait
    // pas déjà lu. La pastille "non lu" disparaîtra ensuite partout ailleurs
    // (agenda, liste des réunions) pour cette personne uniquement.
    if (crRes.data) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: dejaLu } = await supabase
          .from("cr_lectures")
          .select("compte_rendu_id")
          .eq("compte_rendu_id", (crRes.data as any).id)
          .eq("referent_id", user.id)
          .maybeSingle();
        if (!dejaLu) {
          const { error } = await supabase.from("cr_lectures").insert({
            compte_rendu_id: (crRes.data as any).id,
            referent_id: user.id,
          });
          if (error) {
            console.error("Impossible d'enregistrer la lecture du compte rendu :", error);
          }
        }
      }
    }
  }, [reunionId]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: prof } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
      setProfile(prof);
      await load();
      setLoading(false);
    }
    init();
  }, [router, load]);

  if (loading || !profile || !reunion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement…</span>
      </div>
    );
  }

  const tousParticipants = [
    ...(reunion.referent_charge ? [reunion.referent_charge] : []),
    ...(reunion.participants ?? []),
  ].filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);

  const isAdmin = profile.role === "admin";

  const canWrite =
    isAdmin ||
    reunion.referent_charge_id === profile.id;

  async function handleSave() {
    if (estVide(contenu) || !profile || !reunion) return;
    setSaving(true);
    if (cr) {
      await supabase.from("comptes_rendus").update({ contenu }).eq("id", cr.id);
    } else {
      // Le cast "as any" contourne un typage Supabase généré AVANT la migration
      // (situation_id y est encore déclaré non-nullable). À retirer une fois
      // les types régénérés via `supabase gen types typescript`.
      await supabase.from("comptes_rendus").insert({
        creneau_id:     reunionId,
        situation_id:   null,
        auteur_id:      profile.id,
        contenu,
        date_entretien: reunion.date_creneau,
        archive:        false,
      } as any);
    }
    setSaving(false);
    setEditing(false);
    await load();
  }

  async function handleDelete() {
    if (!isAdmin || !cr) return;
    const confirme = window.confirm(
      "Supprimer définitivement ce compte rendu ? Cette action est irréversible."
    );
    if (!confirme) return;

    setDeleting(true);
    const { error } = await supabase.from("comptes_rendus").delete().eq("id", cr.id);
    setDeleting(false);

    if (error) {
      console.error("Impossible de supprimer le compte rendu :", error);
      window.alert("La suppression a échoué. Veuillez réessayer.");
      return;
    }

    setCr(null);
    setEditing(false);
    setContenu("");
  }

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1B1633]">

      {/* 📱 MOBILE */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[#EEEDF5] bg-white px-5 py-4 shadow-sm">
          <button onClick={() => router.push("/reunions")} className="text-xs text-[#6656B8] hover:underline">
            ← Réunions
          </button>
        </header>
        <main className="flex-1 px-5 py-5 space-y-4">
          <InfosReunion reunion={reunion} tousParticipants={tousParticipants} onAllerAgenda={() => router.push("/agenda")} />
          <PanneauCR
            cr={cr} editing={editing} canWrite={canWrite} isAdmin={isAdmin} contenu={contenu} setContenu={setContenu}
            saving={saving} deleting={deleting}
            onStartEdit={() => { setEditing(true); setContenu(cr?.contenu ?? ""); }}
            onCancelEdit={() => { setEditing(false); setContenu(cr?.contenu ?? ""); }}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        </main>
      </div>

      {/* 💻 PC */}
      <div className="hidden lg:block max-w-3xl mx-auto px-8 py-8">
        <button onClick={() => router.push("/reunions")} className="mb-4 text-xs text-[#6656B8] hover:underline">
          ← Retour aux réunions
        </button>
        <div className="space-y-6">
          <InfosReunion reunion={reunion} tousParticipants={tousParticipants} onAllerAgenda={() => router.push("/agenda")} />
          <PanneauCR
            cr={cr} editing={editing} canWrite={canWrite} isAdmin={isAdmin} contenu={contenu} setContenu={setContenu}
            saving={saving} deleting={deleting}
            onStartEdit={() => { setEditing(true); setContenu(cr?.contenu ?? ""); }}
            onCancelEdit={() => { setEditing(false); setContenu(cr?.contenu ?? ""); }}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}