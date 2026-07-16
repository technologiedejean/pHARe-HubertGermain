// >>> Ce fichier REMPLACE : components/EditeurRiche.tsx <
"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Éditeur riche minimal — sans librairie tierce.
   Utilise contentEditable + document.execCommand (toujours
   supporté par tous les navigateurs modernes en 2026, même si
   déprécié côté spécification W3C).

   Le contenu est stocké/renvoyé en HTML (pas en texte brut).

   Autocomplétion :
   - "@" propose des référents et des élèves.
     - Un référent devient une pastille non cliquable "@Prénom Nom"
       (pas de fiche individuelle à ouvrir).
     - Un élève devient un lien "@Prénom Nom" vers sa fiche,
       ouvert dans un nouvel onglet.
   - "#" propose des situations et des réunions → devient un lien
     "#Titre" vers la fiche correspondante, ouvert dans un nouvel onglet.
   ============================================================ */

const COULEURS_TEXTE = [
  { nom: "Par défaut", valeur: "#1B1633" },
  { nom: "Rouge",       valeur: "#dc2626" },
  { nom: "Bleu",        valeur: "#2563eb" },
  { nom: "Vert",        valeur: "#059669" },
  { nom: "Orange",      valeur: "#d97706" },
  { nom: "Violet",      valeur: "#7c3aed" },
];

const barreBoutonCls =
  "flex h-7 min-w-[28px] items-center justify-center rounded-lg border border-[#E7E6EF] " +
  "bg-white px-1.5 text-xs text-[#3A3556] hover:bg-[#F3F2FA] transition";

const MENTION_CLASS =
  "cr-mention inline-flex items-center rounded-full bg-[#F5F3FF] px-1.5 py-0.5 text-[#6656B8] font-medium";
const REFERENCE_CLASS =
  "cr-reference inline-flex items-center rounded-full bg-[#EFF6FF] px-1.5 py-0.5 text-blue-700 font-medium no-underline hover:underline";
const URL_LINK_CLASS = "cr-url-link text-blue-600 underline break-all";

type ResultatAutocomplete = {
  id: string;
  kind: "referent" | "eleve" | "situation" | "reunion";
  label: string;
  sublabel?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function iconePour(kind: ResultatAutocomplete["kind"]): string {
  if (kind === "referent") return "🧑";
  if (kind === "eleve")    return "🎓";
  if (kind === "situation") return "📋";
  return "🗓️";
}

export function EditeurRiche({
  value,
  onChange,
  placeholder = "Rédigez ici…",
  minHeightClass = "min-h-[160px]",
  autoFocus = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeightClass?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const aRempliInitial = useRef(false);
  const rangeActifRef = useRef<Range | null>(null);
  const timerRechercheRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [popup, setPopup] = useState<{
    trigger: "@" | "#";
    top: number;
    left: number;
    resultats: ResultatAutocomplete[];
    chargement: boolean;
  } | null>(null);

  const [lienSurvole, setLienSurvole] = useState<{ el: HTMLAnchorElement; top: number; left: number } | null>(null);
  const [lienEnEdition, setLienEnEdition] = useState<{ el: HTMLAnchorElement; valeur: string; url: string; top: number; left: number } | null>(null);
  const timerSurvolRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rangeLienRef = useRef<Range | null>(null);
  const [creationLien, setCreationLien] = useState<{ top: number; left: number; texte: string; url: string } | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
    if (!aRempliInitial.current && autoFocus) {
      aRempliInitial.current = true;
      ref.current?.focus();
    }
  }, [value, autoFocus]);

  function exec(commande: string, argument?: string) {
    ref.current?.focus();
    document.execCommand(commande, false, argument);
    onChange(ref.current?.innerHTML ?? "");
  }

  async function rechercher(trigger: "@" | "#", requete: string) {
    setPopup((p) => (p ? { ...p, chargement: true } : p));

    let resultats: ResultatAutocomplete[] = [];

    if (trigger === "@") {
      const [refRes, elevesRes] = await Promise.all([
        supabase.from("profiles").select("id, nom, prenom")
          .eq("actif", true).in("role", ["admin", "referent"])
          .or(`nom.ilike.%${requete}%,prenom.ilike.%${requete}%`)
          .order("nom").limit(5),
        supabase.from("eleves").select("id, nom, prenom, classe")
          .or(`nom.ilike.%${requete}%,prenom.ilike.%${requete}%`)
          .order("nom").limit(5),
      ]);
      resultats = [
        ...(refRes.data ?? []).map((r: any) => ({
          id: r.id, kind: "referent" as const,
          label: `${r.prenom} ${r.nom}`, sublabel: "Référent",
        })),
        ...(elevesRes.data ?? []).map((e: any) => ({
          id: e.id, kind: "eleve" as const,
          label: `${e.prenom} ${e.nom}`, sublabel: e.classe,
        })),
      ];
    } else {
      const [sitRes, reuRes] = await Promise.all([
        supabase.from("situations").select("id, titre, reference")
          .ilike("titre", `%${requete}%`).limit(5),
        supabase.from("creneaux").select("id, titre, date_creneau")
          .is("situation_id", null).not("titre", "is", null).not("date_creneau", "is", null)
          .ilike("titre", `%${requete}%`).order("date_creneau", { ascending: false }).limit(5),
      ]);
      resultats = [
        ...(sitRes.data ?? []).map((s: any) => ({
          id: s.id, kind: "situation" as const,
          label: s.titre, sublabel: s.reference ?? "Situation",
        })),
        ...(reuRes.data ?? []).map((r: any) => ({
          id: r.id, kind: "reunion" as const,
          label: r.titre, sublabel: "Réunion",
        })),
      ];
    }

    setPopup((p) => (p ? { ...p, resultats, chargement: false } : p));
  }

  function lancerRechercheDebouncee(trigger: "@" | "#", requete: string) {
    if (timerRechercheRef.current) clearTimeout(timerRechercheRef.current);
    timerRechercheRef.current = setTimeout(() => rechercher(trigger, requete), 200);
  }

  const detecterMention = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) { setPopup(null); return; }
    const range = sel.getRangeAt(0);
    if (!range.collapsed || range.startContainer.nodeType !== Node.TEXT_NODE) {
      setPopup(null); return;
    }
    if (!ref.current.contains(range.startContainer)) { setPopup(null); return; }

    const texte = range.startContainer.textContent ?? "";
    const caret = range.startOffset;
    const avantCaret = texte.slice(0, caret);
    const match = avantCaret.match(/(^|\s)([@#])([^\s@#]*)$/);
    if (!match) { setPopup(null); return; }

    const trigger    = match[2] as "@" | "#";
    const requete    = match[3];
    const startIndex = avantCaret.length - match[2].length - match[3].length;

    const mentionRange = document.createRange();
    mentionRange.setStart(range.startContainer, startIndex);
    mentionRange.setEnd(range.startContainer, caret);
    rangeActifRef.current = mentionRange.cloneRange();

    const rect = mentionRange.getBoundingClientRect();
    setPopup((p) => ({
      trigger,
      top: rect.bottom + 4,
      left: rect.left,
      resultats: p && p.trigger === trigger ? p.resultats : [],
      chargement: true,
    }));
    lancerRechercheDebouncee(trigger, requete);
  }, []);

  function linkifierSiTapee() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed || range.startContainer.nodeType !== Node.TEXT_NODE) return;
    if (!ref.current.contains(range.startContainer)) return;

    const texte = range.startContainer.textContent ?? "";
    const caret = range.startOffset;
    if (caret === 0 || texte[caret - 1] !== " ") return;

    const avantEspace = texte.slice(0, caret - 1);
    const match = avantEspace.match(/(https?:\/\/\S+)$/i);
    if (!match) return;

    const url        = match[1];
    const startIndex = avantEspace.length - url.length;

    const urlRange = document.createRange();
    urlRange.setStart(range.startContainer, startIndex);
    urlRange.setEnd(range.startContainer, caret - 1);

    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(urlRange);

    const html = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="${URL_LINK_CLASS}">${escapeHtml(url)}</a>`;
    document.execCommand("insertHTML", false, html);
  }

  function handleInput() {
    linkifierSiTapee();
    onChange(ref.current?.innerHTML ?? "");
    detecterMention();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    let imageFile: File | null = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        imageFile = items[i].getAsFile();
        break;
      }
    }
    if (!imageFile) {
      const texte = e.clipboardData.getData("text/plain");
      if (texte && /https?:\/\/\S+/i.test(texte)) {
        e.preventDefault();
        const htmlAvecLiens = escapeHtml(texte)
          .replace(/\n/g, "<br/>")
          .replace(
            /(https?:\/\/[^\s<]+)/gi,
            (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="${URL_LINK_CLASS}">${url}</a>`
          );
        document.execCommand("insertHTML", false, htmlAvecLiens);
        onChange(ref.current?.innerHTML ?? "");
      }
      return;
    }

    e.preventDefault();

    const sel = window.getSelection();
    const savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxLargeur = 400;
        const echelle    = Math.min(1, maxLargeur / img.naturalWidth);
        const largeur    = Math.max(40, Math.round(img.naturalWidth * echelle));
        const ratio      = img.naturalWidth / img.naturalHeight;

        const html =
          `<span contenteditable="false" style="display:inline-block;resize:horizontal;overflow:hidden;` +
          `width:${largeur}px;aspect-ratio:${ratio};max-width:100%;vertical-align:bottom;">` +
          `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain;display:block;" /></span>&nbsp;`;

        ref.current?.focus();
        if (savedRange) {
          const s = window.getSelection();
          s?.removeAllRanges();
          s?.addRange(savedRange);
        }
        document.execCommand("insertHTML", false, html);
        onChange(ref.current?.innerHTML ?? "");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(imageFile);
  }

  function insererResultat(item: ResultatAutocomplete) {
    if (!rangeActifRef.current) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(rangeActifRef.current);

    let html: string;
    if (item.kind === "referent") {
      html = `<span class="${MENTION_CLASS}" contenteditable="false" data-mention-kind="referent" data-mention-id="${item.id}">@${escapeHtml(item.label)}</span>`;
    } else if (item.kind === "eleve") {
      html = `<a href="/eleves/${item.id}" target="_blank" rel="noopener noreferrer" class="${MENTION_CLASS}" contenteditable="false" data-mention-kind="eleve" data-mention-id="${item.id}">@${escapeHtml(item.label)}</a>`;
    } else {
      const href = item.kind === "situation" ? `/situations/${item.id}` : `/reunions/${item.id}`;
      html = `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${REFERENCE_CLASS}" contenteditable="false" data-ref-kind="${item.kind}" data-ref-id="${item.id}">#${escapeHtml(item.label)}</a>`;
    }

    ref.current?.focus();
    document.execCommand("insertHTML", false, `${html}&nbsp;`);
    onChange(ref.current?.innerHTML ?? "");
    setPopup(null);
    rangeActifRef.current = null;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && popup) {
      setPopup(null);
      rangeActifRef.current = null;
    }
  }

  function annulerFermetureHover() {
    if (timerSurvolRef.current) { clearTimeout(timerSurvolRef.current); timerSurvolRef.current = null; }
  }

  function programmerFermetureHover() {
    annulerFermetureHover();
    timerSurvolRef.current = setTimeout(() => setLienSurvole(null), 200);
  }

  function handleMouseOverEditeur(e: React.MouseEvent<HTMLDivElement>) {
    const cible = (e.target as HTMLElement).closest("a");
    if (!cible || !ref.current?.contains(cible)) return;
    const href = cible.getAttribute("href") ?? "";
    if (!/^https?:\/\//i.test(href)) return;
    annulerFermetureHover();
    const rect = cible.getBoundingClientRect();
    setLienSurvole({ el: cible as HTMLAnchorElement, top: rect.top - 34, left: rect.left });
  }

  function handleMouseOutEditeur() {
    programmerFermetureHover();
  }

  function ouvrirEditionLien() {
    if (!lienSurvole) return;
    annulerFermetureHover();
    const texteActuel = lienSurvole.el.textContent ?? "";
    const urlActuelle = lienSurvole.el.getAttribute("href") ?? "";
    setLienEnEdition({ el: lienSurvole.el, valeur: texteActuel, url: urlActuelle, top: lienSurvole.top, left: lienSurvole.left });
    setLienSurvole(null);
  }

  function validerEditionLien() {
    if (!lienEnEdition) return;
    const texte = lienEnEdition.valeur.trim();
    const url   = lienEnEdition.url.trim();
    if (texte) lienEnEdition.el.textContent = texte;
    if (url)   lienEnEdition.el.setAttribute("href", url);
    onChange(ref.current?.innerHTML ?? "");
    setLienEnEdition(null);
  }

  function ouvrirCreationLien() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !ref.current?.contains(sel.anchorNode)) return;
    const range = sel.getRangeAt(0).cloneRange();
    rangeLienRef.current = range;
    const rect = range.getBoundingClientRect();
    setCreationLien({ top: rect.bottom + 6, left: rect.left, texte: sel.toString(), url: "" });
  }

  function validerCreationLien() {
    if (!creationLien || !rangeLienRef.current) return;
    const url = creationLien.url.trim();
    if (!url) return;
    const texte = creationLien.texte.trim() || url;

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(rangeLienRef.current);

    ref.current?.focus();
    const html = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="${URL_LINK_CLASS}">${escapeHtml(texte)}</a>`;
    document.execCommand("insertHTML", false, html);
    onChange(ref.current?.innerHTML ?? "");
    setCreationLien(null);
    rangeLienRef.current = null;
  }

  useEffect(() => {
    if (!popup) return;
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && popupRef.current.contains(e.target as Node)) return;
      setPopup(null);
    }
    const t = setTimeout(() => document.addEventListener("mousedown", handleClickOutside), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handleClickOutside); };
  }, [popup]);

  return (
    <div className="relative rounded-xl border border-[#E7E6EF] bg-white overflow-hidden
                     focus-within:border-[#7C6BD6] focus-within:ring-4 focus-within:ring-[#7C6BD6]/15 transition">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#EEEDF5] bg-[#F8F7FC] px-2 py-1.5">
        <select
          onChange={(e) => { if (e.target.value) exec("formatBlock", e.target.value); e.target.value = ""; }}
          defaultValue=""
          className="h-7 rounded-lg border border-[#E7E6EF] bg-white px-1.5 text-xs text-[#3A3556] outline-none cursor-pointer"
          title="Style de paragraphe"
        >
          <option value="" disabled>Style</option>
          <option value="P">Texte normal</option>
          <option value="H1">Titre 1</option>
          <option value="H2">Titre 2</option>
          <option value="H3">Titre 3</option>
        </select>

        <button type="button" onClick={() => exec("bold")} className={`${barreBoutonCls} font-bold`} title="Gras (Ctrl+B)">G</button>
        <button type="button" onClick={() => exec("italic")} className={`${barreBoutonCls} italic`} title="Italique (Ctrl+I)">I</button>
        <button type="button" onClick={() => exec("underline")} className={`${barreBoutonCls} underline`} title="Souligné (Ctrl+U)">S</button>

        <span className="mx-1 h-5 w-px bg-[#E7E6EF]" />

        <button type="button" onClick={() => exec("justifyLeft")} className={barreBoutonCls} title="Aligner à gauche">⯇≡</button>
        <button type="button" onClick={() => exec("justifyCenter")} className={barreBoutonCls} title="Centrer">≡</button>
        <button type="button" onClick={() => exec("justifyRight")} className={barreBoutonCls} title="Aligner à droite">≡⯈</button>

        <span className="mx-1 h-5 w-px bg-[#E7E6EF]" />

        <button type="button" onClick={() => exec("insertUnorderedList")} className={barreBoutonCls} title="Liste à puces">• ≡</button>

        <span className="mx-1 h-5 w-px bg-[#E7E6EF]" />

        <button type="button" onClick={ouvrirCreationLien} className={barreBoutonCls} title="Transformer la sélection en lien">🔗 Lien</button>

        <span className="mx-1 h-5 w-px bg-[#E7E6EF]" />

        <div className="flex items-center gap-1">
          {COULEURS_TEXTE.map((c) => (
            <button key={c.valeur} type="button" onClick={() => exec("foreColor", c.valeur)}
              className="h-5 w-5 shrink-0 rounded-full border border-white shadow ring-1 ring-[#E7E6EF]"
              style={{ backgroundColor: c.valeur }}
              title={`Couleur : ${c.nom}`} />
          ))}
        </div>

        <button type="button" onClick={() => exec("removeFormat")}
          className={`${barreBoutonCls} ml-auto`} title="Effacer la mise en forme">✕ Effacer</button>
      </div>

      <p className="px-4 pt-2 text-[11px] text-[#B4B1C4]">
        Astuce : tapez <span className="font-mono">@</span> pour mentionner un référent/élève,
        {" "}<span className="font-mono">#</span> pour lier une situation/réunion.
      </p>

      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        onMouseUp={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onKeyUp={detecterMention}
        onClick={detecterMention}
        onMouseOver={handleMouseOverEditeur}
        onMouseOut={handleMouseOutEditeur}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        className={`w-full ${minHeightClass} px-4 py-2.5 text-sm text-[#1B1633] outline-none overflow-y-auto
                   empty:before:content-[attr(data-placeholder)] empty:before:text-[#B4B1C4]
                   [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:my-2
                   [&_h2]:text-base [&_h2]:font-semibold [&_h2]:my-1.5
                   [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-1
                   [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                   [&_img]:block [&_img]:rounded-lg`}
      />

      {lienSurvole && !lienEnEdition && (
        <button
          type="button"
          onClick={ouvrirEditionLien}
          onMouseEnter={annulerFermetureHover}
          onMouseLeave={programmerFermetureHover}
          className="fixed z-[9999] flex items-center gap-1 rounded-lg border border-[#E7E6EF]
                     bg-white px-2 py-1 text-xs font-medium text-[#3A3556] shadow-lg hover:bg-[#F3F2FA] transition"
          style={{ top: lienSurvole.top, left: lienSurvole.left }}
        >
          ✏️ Texte du lien
        </button>
      )}

      {lienEnEdition && (
        <div
          className="fixed z-[9999] w-64 rounded-xl border border-[#E7E6EF] bg-white p-3 shadow-xl space-y-2"
          style={{ top: lienEnEdition.top, left: lienEnEdition.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div>
            <p className="text-xs font-medium text-[#3A3556] mb-1">Texte affiché</p>
            <input
              type="text"
              autoFocus
              value={lienEnEdition.valeur}
              onChange={(e) => setLienEnEdition((p) => (p ? { ...p, valeur: e.target.value } : p))}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); validerEditionLien(); }
                if (e.key === "Escape") setLienEnEdition(null);
              }}
              placeholder="Ex. : Cliquer ici"
              className="w-full rounded-lg border border-[#E7E6EF] bg-white px-2.5 py-1.5 text-sm text-[#1B1633]
                         outline-none focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-[#3A3556] mb-1">Adresse (URL)</p>
            <input
              type="url"
              value={lienEnEdition.url}
              onChange={(e) => setLienEnEdition((p) => (p ? { ...p, url: e.target.value } : p))}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); validerEditionLien(); }
                if (e.key === "Escape") setLienEnEdition(null);
              }}
              placeholder="https://…"
              className="w-full rounded-lg border border-[#E7E6EF] bg-white px-2.5 py-1.5 text-sm text-[#1B1633]
                         outline-none focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setLienEnEdition(null)}
              className="flex-1 rounded-lg border border-[#E7E6EF] px-2 py-1.5 text-xs text-[#3A3556] hover:bg-[#F3F2FA] transition">
              Annuler
            </button>
            <button type="button" onClick={validerEditionLien}
              className="flex-1 rounded-lg bg-[#1A1440] px-2 py-1.5 text-xs text-white hover:bg-[#2A1E5C] transition">
              Valider
            </button>
          </div>
        </div>
      )}

      {creationLien && (
        <div
          className="fixed z-[9999] w-64 rounded-xl border border-[#E7E6EF] bg-white p-3 shadow-xl space-y-2"
          style={{ top: creationLien.top, left: creationLien.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div>
            <p className="text-xs font-medium text-[#3A3556] mb-1">Texte affiché</p>
            <input
              type="text"
              value={creationLien.texte}
              onChange={(e) => setCreationLien((p) => (p ? { ...p, texte: e.target.value } : p))}
              onKeyDown={(e) => { if (e.key === "Escape") setCreationLien(null); }}
              className="w-full rounded-lg border border-[#E7E6EF] bg-white px-2.5 py-1.5 text-sm text-[#1B1633]
                         outline-none focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-[#3A3556] mb-1">Adresse (URL)</p>
            <input
              type="url"
              autoFocus
              value={creationLien.url}
              onChange={(e) => setCreationLien((p) => (p ? { ...p, url: e.target.value } : p))}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); validerCreationLien(); }
                if (e.key === "Escape") setCreationLien(null);
              }}
              placeholder="https://…"
              className="w-full rounded-lg border border-[#E7E6EF] bg-white px-2.5 py-1.5 text-sm text-[#1B1633]
                         outline-none focus:border-[#7C6BD6] focus:ring-2 focus:ring-[#7C6BD6]/15"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setCreationLien(null)}
              className="flex-1 rounded-lg border border-[#E7E6EF] px-2 py-1.5 text-xs text-[#3A3556] hover:bg-[#F3F2FA] transition">
              Annuler
            </button>
            <button type="button" onClick={validerCreationLien} disabled={!creationLien.url.trim()}
              className="flex-1 rounded-lg bg-[#1A1440] px-2 py-1.5 text-xs text-white hover:bg-[#2A1E5C] transition disabled:opacity-40">
              Valider
            </button>
          </div>
        </div>
      )}

      {popup && (
        <div
          ref={popupRef}
          className="fixed z-[9999] w-64 max-h-56 overflow-y-auto rounded-xl border border-[#E7E6EF]
                     bg-white shadow-xl"
          style={{ top: popup.top, left: popup.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {popup.chargement ? (
            <p className="px-3 py-2.5 text-xs text-[#9A97AD]">Recherche…</p>
          ) : popup.resultats.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-[#B4B1C4] italic">Aucun résultat.</p>
          ) : (
            popup.resultats.map((item) => (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                onClick={() => insererResultat(item)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F3F2FA] transition"
              >
                <span className="shrink-0">{iconePour(item.kind)}</span>
                <span className="flex-1 min-w-0 truncate text-[#1B1633]">{item.label}</span>
                {item.sublabel && (
                  <span className="shrink-0 text-xs text-[#9A97AD]">{item.sublabel}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ContenuRiche({ html, className = "" }: { html: string; className?: string }) {
  const contientDuHtml = /<[a-z][\s\S]*>/i.test(html);
  const contenuAffiche = contientDuHtml ? html : html.replace(/\n/g, "<br/>");

  return (
    <div
      className={`text-sm text-[#3A3556] leading-relaxed
                 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:my-2
                 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:my-1.5
                 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-1
                 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                 [&_img]:h-full [&_img]:w-full [&_img]:rounded-lg
                 [&_span]:!resize-none [&_span]:max-w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: contenuAffiche }}
    />
  );
}