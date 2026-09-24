"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { creerGent, type FormatGent } from "@/lib/builderDraftStorage";
import styles from "./NouveauGentDialog.module.css";

const FORMATS: { id: FormatGent; titre: string; desc: string }[] = [
  { id: "conversationnel", titre: "Conversationnel", desc: "Il dialogue, et produit des artefacts quand l'échange s'y prête." },
  { id: "miniapp", titre: "Mini App", desc: "Quelques entrées, un tableau de bord permanent." },
  { id: "visionneuse", titre: "Visionneuse", desc: "Un document que vous fixez, lu en pleine page." },
  { id: "collaboratif", titre: "Event Manager", desc: "Un salon à plusieurs : dispos, options, synthèse." },
];

/**
 * Le SEUL formulaire de création du studio.
 *
 * Créer passait par des entrées de menu qui, selon l'écran, créaient un gent
 * ou changeaient d'onglet : une fois sur deux, on voulait régler le gent
 * ouvert et on en fabriquait un nouveau. La création est désormais un acte
 * délibéré, derrière ce formulaire : une phrase (facultative) et un format.
 *
 * Rendu dans un portail : le rail est un tiroir TRANSFORMÉ sous 860 px, et un
 * `position: fixed` y serait confiné au tiroir au lieu de couvrir l'écran.
 */
export function NouveauGentDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<FormatGent>("conversationnel");
  const [creating, setCreating] = useState(false);
  const zoneRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    zoneRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function creer() {
    // `creating` reste vrai jusqu'à la navigation : un double clic ne doit
    // pas fabriquer deux gents pour une seule intention.
    if (creating) return;
    setCreating(true);
    const { url } = creerGent(format, description);
    onClose();
    router.push(url);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.voile} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className={styles.boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nouveau-gent-titre"
        onSubmit={(e) => {
          e.preventDefault();
          creer();
        }}
      >
        <div className={styles.entete}>
          <h2 id="nouveau-gent-titre" className={styles.titre}>
            Nouveau gent
          </h2>
          <button type="button" className={styles.fermer} onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <label className={styles.libelle} htmlFor="nouveau-gent-role">
          Son rôle, en une phrase <span className={styles.facultatif}>— facultatif</span>
        </label>
        <textarea
          id="nouveau-gent-role"
          ref={zoneRef}
          className={styles.zone}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              creer();
            }
          }}
          placeholder="Ex. : un gent qui prépare mes réponses aux candidats à partir de leur CV…"
        />
        <p className={styles.aide}>L&apos;assistant du studio part de cette phrase pour rédiger les instructions.</p>

        <fieldset className={styles.formats}>
          <legend className={styles.libelle}>Format de départ</legend>
          {FORMATS.map((f) => (
            <label key={f.id} className={[styles.format, format === f.id ? styles.formatOn : ""].filter(Boolean).join(" ")}>
              <input
                type="radio"
                name="format"
                value={f.id}
                checked={format === f.id}
                onChange={() => setFormat(f.id)}
                className={styles.radio}
              />
              <span className={styles.formatTitre}>{f.titre}</span>
              <span className={styles.formatDesc}>{f.desc}</span>
            </label>
          ))}
        </fieldset>
        <p className={styles.aide}>Rien n&apos;est verrouillé : les autres formats s&apos;ajoutent plus tard, depuis le gent.</p>

        <div className={styles.pied}>
          <button type="button" className={styles.secondaire} onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className={styles.principal} disabled={creating}>
            {creating ? "Création…" : "Créer le gent"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
