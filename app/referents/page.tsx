// >>> Ce fichier REMPLACE : app/referents/page.tsx <<<
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Types
   ============================================================ */
type Referent = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  couleur: string;
  actif: boolean;
  must_change_password: boolean;
};
type Profile = { role: "admin" | "referent"; id: string };

/* ============================================================
   Palette de couleurs
   ============================================================ */
const COULEURS = [
  "#3b82f6","#8b5cf6","#ec4899","#f97316","#10b981",
  "#06b6d4","#f59e0b","#6366f1","#dc2626","#84cc16",
];

/* ============================================================
   Règles mot de passe
   ============================================================ */
const REGLES_MDP = [
  { label: "12 caractères minimum",   test: (p: string) => p.length >= 12          },
  { label: "Une majuscule",            test: (p: string) => /[A-Z]/.test(p)         },
  { label: "Une minuscule",            test: (p: string) => /[a-z]/.test(p)         },
  { label: "Un chiffre",               test: (p: string) => /[0-9]/.test(p)         },
  { label: "Un caractère spécial",     test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function mdpValide(p: string) {
  return REGLES_MDP.every((r) => r.test(p));
}

/* ============================================================
   Checklist mot de passe
   ============================================================ */
function ChecklistMdp({ password }: { password: string }) {
  return (
    <ul className="mt-2 space-y-1">
      {REGLES_MDP.map((regle) => {
        const ok = regle.test(password);
        return (
          <li key={regle.label} className="flex items-center gap-2 text-xs">
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full
                             text-[10px] font-bold transition-colors ${
              ok ? "bg-emerald-500 text-white" : "bg-[#E7E6EF] text-[#9A97AD]"
            }`}>
              {ok ? "✓" : "·"}
            </span>
            <span className={`transition-colors ${ok ? "text-emerald-700" : "text-[#6C6A80]"}`}>
              {regle.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ============================================================
   Sélecteur de couleur
   ============================================================ */
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {COULEURS.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
            value === c ? "ring-2 ring-offset-2 ring-[#7C6BD6] scale-110" : ""
          }`}
          style={{ backgroundColor: c }} />
      ))}
      <label className="relative h-7 w-7 cursor-pointer rounded-full border-2 border-dashed
                        border-[#D1CFE2] flex items-center justify-center text-[#9A97AD]
                        hover:border-[#7C6BD6] transition" title="Couleur personnalisée">
        <span className="text-xs">+</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded-full" />
      </label>
    </div>
  );
}

/* ============================================================
   Avatar initiales
   ============================================================ */
function Avatar({ nom, prenom, couleur, size = "md" }: {
  nom: string; prenom: string; couleur: string; size?: "sm" | "md" | "lg";
}) {
  const sz = size === "sm" ? "h-8 w-8 text-xs"
           : size === "lg" ? "h-14 w-14 text-lg"
           : "h-10 w-10 text-sm";
  return (
    <div className={`${sz} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: couleur }}>
      {prenom[0]}{nom[0]}
    </div>
  );
}

/* ============================================================
   Modale — Création / Modification d'un référent
   ============================================================ */
function ModalReferent({
  referent, onClose, onSuccess,
}: {
  referent: Referent | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!referent;
  const [form, setForm] = useState({
    nom:      referent?.nom     ?? "",
    prenom:   referent?.prenom  ?? "",
    email:    referent?.email   ?? "",
    password: "",
    couleur:  referent?.couleur ?? COULEURS[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [showMdpRules, setShowMdpRules] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Le formulaire est valide si :
  // - En création : mot de passe obligatoire et valide
  // - En modification : soit pas de mot de passe (on ne change pas), soit mot de passe valide
  const mdpSaisi   = form.password.length > 0;
  const mdpOk      = mdpSaisi ? mdpValide(form.password) : true;
  const canSubmit  = form.nom.trim() && form.prenom.trim() && form.email.trim()
                     && (!isEdit ? mdpValide(form.password) : mdpOk)
                     && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true); setError(null);

    const body: Record<string, any> = {
      id:      referent?.id,
      nom:     form.nom.trim(),
      prenom:  form.prenom.trim(),
      email:   form.email.trim(),
      couleur: form.couleur,
    };
    if (form.password.trim()) body.password = form.password.trim();

    const res  = await fetch("/api/referents", {
      method:  isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Une erreur est survenue."); return; }
    onSuccess(); onClose();
  }

  const inputCls =
    "mt-1.5 w-full rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5 text-sm " +
    "text-[#1B1633] outline-none transition placeholder:text-[#B4B1C4] " +
    "focus:border-[#7C6BD6] focus:ring-4 focus:ring-[#7C6BD6]/15";
  const labelCls = "block text-sm font-medium text-[#3A3556]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-[#EEEDF5] px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-[#1B1633]">
            {isEdit ? "Modifier le référent" : "Créer un référent"}
          </h2>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full
                       text-[#9A97AD] hover:bg-[#F3F2FA] transition">✕</button>
        </div>

        {/* Aperçu avatar */}
        <div className="flex items-center gap-3 px-6 pt-5">
          <Avatar nom={form.nom || "?"} prenom={form.prenom || "?"} couleur={form.couleur} size="lg" />
          <div>
            <p className="font-semibold text-[#1B1633]">
              {form.prenom || "Prénom"} {form.nom || "Nom"}
            </p>
            <p className="text-sm text-[#9A97AD]">Référent</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Nom / Prénom */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nom <span className="text-red-500">*</span></label>
              <input type="text" required placeholder="DUPONT"
                value={form.nom} onChange={(e) => set("nom", e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Prénom <span className="text-red-500">*</span></label>
              <input type="text" required placeholder="Marie"
                value={form.prenom} onChange={(e) => set("prenom", e.target.value)}
                className={inputCls} />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelCls}>Adresse e-mail <span className="text-red-500">*</span></label>
            <input type="email" required placeholder="marie.dupont@college.fr"
              value={form.email} onChange={(e) => set("email", e.target.value)}
              className={inputCls} />
          </div>

          {/* Mot de passe */}
          <div>
            <label className={labelCls}>
              {isEdit ? "Nouveau mot de passe provisoire" : "Mot de passe provisoire"}
              {!isEdit && <span className="text-red-500"> *</span>}
            </label>
            <input
              type="password"
              placeholder={isEdit ? "Laisser vide pour ne pas changer" : "12 caractères minimum"}
              value={form.password}
              onChange={(e) => {
                set("password", e.target.value);
                setShowMdpRules(e.target.value.length > 0);
              }}
              className={`${inputCls} ${
                mdpSaisi
                  ? mdpValide(form.password)
                    ? "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200"
                    : "border-red-300 focus:border-red-400 focus:ring-red-100"
                  : ""
              }`}
            />

            {/* Checklist temps réel */}
            {showMdpRules && (
              <div className={`mt-2 rounded-xl border px-4 py-3 ${
                mdpValide(form.password)
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-[#E7E6EF] bg-[#F8F7FC]"
              }`}>
                {mdpValide(form.password) ? (
                  <p className="text-xs font-medium text-emerald-700">
                    ✓ Mot de passe valide
                  </p>
                ) : (
                  <>
                    <p className="text-xs font-medium text-[#3A3556] mb-1">
                      Conditions requises :
                    </p>
                    <ChecklistMdp password={form.password} />
                  </>
                )}
              </div>
            )}

            {/* Message d'aide si création et pas encore de mot de passe */}
            {!isEdit && !mdpSaisi && (
              <p className="mt-1.5 text-xs text-[#9A97AD]">
                Le référent devra le changer à sa première connexion.
              </p>
            )}

            {/* Message si modification sans mot de passe */}
            {isEdit && !mdpSaisi && (
              <p className="mt-1.5 text-xs text-[#9A97AD]">
                Laissez vide pour conserver le mot de passe actuel.
              </p>
            )}
          </div>

          {/* Couleur */}
          <div>
            <label className={labelCls}>Couleur d'agenda</label>
            <ColorPicker value={form.couleur} onChange={(c) => setForm((f) => ({ ...f, couleur: c }))} />
            <p className="mt-1.5 text-xs text-[#9A97AD]">
              Cette couleur identifie le référent dans l'agenda partagé.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5
                         text-sm font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition">
              Annuler
            </button>
            <button type="submit" disabled={!canSubmit}
              className="flex-1 rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm font-medium
                         text-white hover:bg-[#2A1E5C] transition disabled:opacity-40
                         disabled:cursor-not-allowed">
              {loading
                ? (isEdit ? "Enregistrement…" : "Création…")
                : (isEdit ? "Enregistrer" : "Créer le compte")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Modale — Confirmation de suppression
   ============================================================ */
function ModalConfirmSuppr({
  referent, onConfirm, onCancel, loading,
}: {
  referent: Referent; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="px-6 py-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">🗑️</div>
          <h2 className="mt-4 text-base font-semibold text-[#1B1633]">Supprimer ce référent ?</h2>
          <p className="mt-1.5 text-sm text-[#6C6A80]">
            <span className="font-medium text-[#1B1633]">{referent.prenom} {referent.nom}</span>
            {" "}— {referent.email}
          </p>
          <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
            ⚠️ Son compte sera définitivement supprimé. Les CR et situations qu'il a traités
            resteront dans la base, mais ne lui seront plus accessibles.
          </div>
          <p className="mt-3 text-sm text-[#9A97AD]">Cette action est irréversible.</p>
        </div>
        <div className="flex gap-3 border-t border-[#EEEDF5] px-6 py-4">
          <button onClick={onCancel}
            className="flex-1 rounded-xl border border-[#E7E6EF] bg-white px-4 py-2.5
                       text-sm font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium
                       text-white hover:bg-red-700 transition disabled:opacity-50">
            {loading ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Carte référent
   ============================================================ */
function CarteReferent({
  referent, isAdmin, isSelf, onEdit, onToggleActif, onDelete,
}: {
  referent: Referent;
  isAdmin: boolean;
  isSelf: boolean;
  onEdit: () => void;
  onToggleActif: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
      referent.actif ? "border-[#EEEDF5]" : "border-[#E7E6EF] opacity-60"
    }`}>
      <div className="flex items-center gap-3">
        <Avatar nom={referent.nom} prenom={referent.prenom} couleur={referent.couleur} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[#1B1633] truncate">
              {referent.prenom} {referent.nom}
              {isSelf && <span className="ml-1.5 text-xs text-[#6656B8] font-normal">(vous)</span>}
            </p>
            {!referent.actif && (
              <span className="rounded-full bg-[#F3F2FA] px-2 py-0.5 text-xs text-[#9A97AD]">
                Désactivé
              </span>
            )}
            {referent.must_change_password && referent.actif && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                1ère connexion en attente
              </span>
            )}
          </div>
          <p className="text-sm text-[#6C6A80] truncate">{referent.email}</p>
        </div>
        <div className="h-4 w-4 shrink-0 rounded-full border-2 border-white shadow"
          style={{ backgroundColor: referent.couleur }} title="Couleur agenda" />
      </div>

      {isAdmin && !isSelf && (
        <div className="mt-3 flex gap-2 border-t border-[#F3F2FA] pt-3">
          <button onClick={onEdit}
            className="flex-1 rounded-xl border border-[#E7E6EF] bg-white px-3 py-2 text-xs
                       font-medium text-[#3A3556] hover:bg-[#F3F2FA] transition">
            ✏️ Modifier
          </button>
          <button onClick={onToggleActif}
            className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
              referent.actif
                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}>
            {referent.actif ? "⏸ Désactiver" : "▶ Réactiver"}
          </button>
          <button onClick={onDelete}
            className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs
                       font-medium text-red-600 hover:bg-red-100 transition">
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Page principale
   ============================================================ */
export default function ReferentsPage() {
  const router = useRouter();
  const [referents, setReferents]     = useState<Referent[]>([]);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filterActif, setFilterActif] = useState("tous");
  const [modalCreate, setModalCreate] = useState(false);
  const [modalEdit, setModalEdit]     = useState<Referent | null>(null);
  const [modalDelete, setModalDelete] = useState<Referent | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadReferents = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, nom, prenom, email, couleur, actif, must_change_password")
      .eq("role", "referent")
      .order("nom", { ascending: true });
    if (data) setReferents(data);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: prof } = await supabase
        .from("profiles").select("id, role").eq("id", user.id).single();
      setProfile(prof);
      await loadReferents();
      setLoading(false);
    }
    init();
  }, [router, loadReferents]);

  async function handleToggleActif(ref: Referent) {
    await fetch("/api/referents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ref.id, actif: !ref.actif }),
    });
    await loadReferents();
  }

  async function handleDelete() {
    if (!modalDelete) return;
    setDeleteLoading(true);
    await fetch("/api/referents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: modalDelete.id }),
    });
    setDeleteLoading(false);
    setModalDelete(null);
    await loadReferents();
  }

  const filtered = referents.filter((r) => {
    const q = search.toLowerCase();
    return (
      (!q || r.nom.toLowerCase().includes(q) || r.prenom.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)) &&
      (filterActif === "tous" || (filterActif === "actif" && r.actif) || (filterActif === "inactif" && !r.actif))
    );
  });

  const isAdmin  = profile?.role === "admin";
  const selectCls =
    "rounded-xl border border-[#E7E6EF] bg-white px-3 py-2 text-sm text-[#3A3556] " +
    "outline-none focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15 transition";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
        <span className="text-[#6C6A80]">Chargement des référents…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1B1633]">
      {modalCreate && (
        <ModalReferent referent={null} onClose={() => setModalCreate(false)} onSuccess={loadReferents} />
      )}
      {modalEdit && (
        <ModalReferent referent={modalEdit} onClose={() => setModalEdit(null)} onSuccess={loadReferents} />
      )}
      {modalDelete && (
        <ModalConfirmSuppr
          referent={modalDelete}
          onConfirm={handleDelete}
          onCancel={() => setModalDelete(null)}
          loading={deleteLoading}
        />
      )}

      {/* ════════════════════════════════════════════════════
          📱 MOBILE
          ════════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 border-b border-[#EEEDF5] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <button onClick={() => router.push("/dashboard")}
                className="mb-0.5 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
              <h1 className="text-lg font-semibold">Référents</h1>
            </div>
            {isAdmin && (
              <button onClick={() => setModalCreate(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A1440]
                           text-white hover:bg-[#2A1E5C] transition text-lg">＋</button>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B4B1C4] text-sm">🔍</span>
              <input type="text" placeholder="Rechercher…"
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[#E7E6EF] bg-white py-2 pl-9 pr-4
                           text-sm outline-none placeholder:text-[#B4B1C4]
                           focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15 transition" />
            </div>
            <select value={filterActif} onChange={(e) => setFilterActif(e.target.value)} className={selectCls}>
              <option value="tous">Tous</option>
              <option value="actif">Actifs</option>
              <option value="inactif">Inactifs</option>
            </select>
          </div>
        </header>
        <main className="flex-1 px-5 py-5 space-y-3">
          {filtered.length === 0
            ? <p className="py-12 text-center text-sm text-[#9A97AD]">Aucun référent trouvé.</p>
            : filtered.map((r) => (
              <CarteReferent key={r.id} referent={r}
                isAdmin={isAdmin} isSelf={r.id === profile?.id}
                onEdit={() => setModalEdit(r)}
                onToggleActif={() => handleToggleActif(r)}
                onDelete={() => setModalDelete(r)} />
            ))
          }
          <p className="pt-2 text-center text-xs text-[#9A97AD]">
            {filtered.length} référent(s) sur {referents.length}
          </p>
        </main>
      </div>

      {/* ════════════════════════════════════════════════════
          💻 PC
          ════════════════════════════════════════════════════ */}
      <div className="hidden lg:block px-10 py-8 max-w-5xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <button onClick={() => router.push("/dashboard")}
              className="mb-1 text-xs text-[#6656B8] hover:underline">← Tableau de bord</button>
            <h1 className="text-2xl font-semibold">Référents</h1>
            <p className="mt-0.5 text-sm text-[#6C6A80]">
              {isAdmin ? "Gérez les comptes de l'équipe référente." : "L'annuaire de l'équipe référente."}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setModalCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-[#1A1440] px-4 py-2.5 text-sm
                         font-medium text-white hover:bg-[#2A1E5C] transition
                         focus:outline-none focus:ring-4 focus:ring-[#7C6BD6]/30">
              ＋ Créer un référent
            </button>
          )}
        </div>

        <div className="mb-5 flex gap-3">
          <div className="relative min-w-[220px] flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B4B1C4] text-sm">🔍</span>
            <input type="text" placeholder="Rechercher un référent…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#E7E6EF] bg-white py-2 pl-9 pr-4
                         text-sm outline-none placeholder:text-[#B4B1C4]
                         focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15 transition" />
          </div>
          <select value={filterActif} onChange={(e) => setFilterActif(e.target.value)} className={selectCls}>
            <option value="tous">Tous les comptes</option>
            <option value="actif">Actifs uniquement</option>
            <option value="inactif">Désactivés</option>
          </select>
        </div>

        {filtered.length === 0
          ? <p className="py-12 text-center text-[#9A97AD]">Aucun référent ne correspond à votre recherche.</p>
          : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((r) => (
                <CarteReferent key={r.id} referent={r}
                  isAdmin={isAdmin} isSelf={r.id === profile?.id}
                  onEdit={() => setModalEdit(r)}
                  onToggleActif={() => handleToggleActif(r)}
                  onDelete={() => setModalDelete(r)} />
              ))}
            </div>
          )
        }
        <p className="mt-4 text-xs text-[#9A97AD]">
          {filtered.length} référent(s) sur {referents.length}
        </p>
      </div>
    </div>
  );
}