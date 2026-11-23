"use client";

import { sansMarqueur } from "@/lib/activitePage";
import { useEffect, useRef, useState } from "react";
import { streamChatCompletion } from "@/lib/streamChat";
import { renderMarkdown } from "@/lib/markdown";
import { SafeHTML } from "@/components/shared/SafeHTML";
import type { MessageAssistant } from "@/lib/assistantDocument";
import { textes, type Langue } from "@/lib/langueLecteur";
import styles from "./partage.module.css";

/**
 * Le panneau de l'assistant du document. Le fil ne vit que dans la page :
 * rien n'est gardé côté serveur, recharger la page le vide.
 */
export default function AssistantDocument({
  jeton,
  amorces,
  ouvert,
  agrandi,
  onFermer,
  onAgrandir,
  onConfidentialite,
  langue,
}: {
  jeton: string;
  amorces: string[];
  ouvert: boolean;
  agrandi: boolean;
  onFermer: () => void;
  onAgrandir: () => void;
  onConfidentialite: () => void;
  langue: Langue;
}) {
  const t = textes(langue);
  const [fil, setFil] = useState<MessageAssistant[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const basRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);

  // À l'ouverture, on peut écrire tout de suite — après la transition, sinon
  // le défilement vers le champ ferait sauter la page.
  useEffect(() => {
    if (!ouvert) return;
    const t = window.setTimeout(() => champRef.current?.focus({ preventScroll: true }), 260);
    return () => window.clearTimeout(t);
  }, [ouvert]);

  useEffect(() => {
    basRef.current?.scrollIntoView({ block: "end" });
  }, [fil]);

  async function poser(question: string) {
    const q = question.trim();
    if (!q || enCours) return;
    const historique: MessageAssistant[] = [...fil, { role: "user", content: q }];
    setFil([...historique, { role: "assistant", content: "" }]);
    setSaisie("");
    setEnCours(true);
    setErreur(null);
    try {
      const r = await streamChatCompletion(
        { model: "", messages: historique },
        // Le marqueur « hors page » est pour l'auteur, pas pour le visiteur.
        (texte) => setFil([...historique, { role: "assistant", content: sansMarqueur(texte).texte }]),
        undefined,
        undefined,
        `/api/partage/${encodeURIComponent(jeton)}/assistant`
      );
      const reponse = sansMarqueur(r.text).texte;
      if (!reponse.trim()) throw new Error(t.assistantVide);
      setFil([...historique, { role: "assistant", content: reponse }]);
    } catch (e) {
      setFil(historique.slice(0, -1));
      setSaisie(q);
      setErreur((e as Error).message || t.assistantEchec);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <aside className={styles.assistant} aria-label={t.assistantNom} aria-hidden={!ouvert}>
      <div className={styles.assistantTete}>
        <span className={styles.avatar} aria-hidden="true">✦</span>
        <div>
          <div className={styles.assistantNom}>{t.assistantNom}</div>
          <div className={styles.assistantSous}>{t.assistantSous}</div>
        </div>
        <div className={styles.outils}>
          <button type="button" className={`${styles.outil} ${styles.outilAgrandir}`} onClick={onAgrandir} aria-label={agrandi ? t.reduire : t.agrandir}>
            {agrandi ? "⤡" : "⤢"}
          </button>
          <button type="button" className={styles.outil} onClick={onFermer} aria-label={t.fermerAssistant}>
            ✕
          </button>
        </div>
      </div>

      <div className={styles.fil}>
        <div className={styles.bulleAssistant}>
          {t.assistantBonjour}
          {fil.length === 0 && (
            <div className={styles.amorces}>
              {amorces.map((a) => (
                <button key={a} type="button" className={styles.amorce} onClick={() => poser(a)}>
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>
        {fil.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className={styles.bulleVous}>
              {m.content}
            </div>
          ) : (
            <div key={i} className={styles.bulleAssistant}>
              {m.content ? <SafeHTML html={renderMarkdown(m.content)} className={styles.texte} /> : <span className={styles.attente}>…</span>}
            </div>
          )
        )}
        {erreur && <div className={styles.erreur}>{erreur}</div>}
        <div ref={basRef} />
      </div>

      <form
        className={styles.saisie}
        onSubmit={(e) => {
          e.preventDefault();
          void poser(saisie);
        }}
      >
        <textarea
          ref={champRef}
          className={styles.champ}
          value={saisie}
          rows={1}
          maxLength={2000}
          placeholder={t.assistantSaisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void poser(saisie);
            }
          }}
        />
        <button type="submit" className={styles.envoyer} disabled={enCours || !saisie.trim()} aria-label={t.envoyer}>
          →
        </button>
      </form>
      <p className={styles.mention}>
        {t.assistantMention} ·{" "}
        <button type="button" className={styles.mentionLien} onClick={onConfidentialite}>
          {t.confidentialite}
        </button>
      </p>
    </aside>
  );
}
