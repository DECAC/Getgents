"use client";

import { useEffect, useState } from "react";
import { ENGAGEMENT_PAR_DEFAUT, INTITULE_MAX, INTITULES_SUGGERES, intituleValide, type ReglageEngagement } from "@/lib/engagement";
import { INTITULES_SUGGERES_EN, textes, type Langue } from "@/lib/langueLecteur";
import styles from "./pages.module.css";

/**
 * Bloc « Engagement » de l'onglet Page : un bouton proposé aux lecteurs,
 * intitulé libre (30 caractères). La mention sous le bouton est FIXE.
 * L'intitulé s'enregistre à la sortie du champ ou sur une suggestion —
 * pas à chaque frappe : chaque enregistrement change la page des lecteurs.
 */
export function BlocEngagement({ pageId, onMessage, langue = "fr" }: { pageId: string; onMessage: (m: string) => void; langue?: Langue }) {
  // Suggestions dans la langue des lecteurs de la page (lot anglais 1).
  const suggestions = langue === "en" ? INTITULES_SUGGERES_EN : INTITULES_SUGGERES;
  const [reglage, setReglage] = useState<ReglageEngagement | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [migration, setMigration] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [choix, setChoix] = useState(0);

  useEffect(() => {
    let vivant = true;
    void fetch(`/api/pages/${encodeURIComponent(pageId)}/engagement`, { credentials: "include" })
      .then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as { engagement?: ReglageEngagement; migration?: boolean; choix?: number };
        if (!vivant) return;
        setChoix(d.choix ?? 0);
        if (d.migration) setMigration(true);
        const e = d.engagement ?? ENGAGEMENT_PAR_DEFAUT;
        setReglage(e);
        setBrouillon(e.intitule);
      })
      .catch(() => vivant && setReglage(ENGAGEMENT_PAR_DEFAUT));
    return () => {
      vivant = false;
    };
  }, [pageId]);

  if (!reglage) return null;

  const enregistrer = async (suivant: ReglageEngagement, reussite: string) => {
    setEnCours(true);
    try {
      const r = await fetch(`/api/pages/${encodeURIComponent(pageId)}/engagement`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(suivant),
      });
      const d = (await r.json().catch(() => ({}))) as { engagement?: ReglageEngagement; error?: string; migration?: boolean };
      if (d.migration) setMigration(true);
      if (!r.ok || !d.engagement) throw new Error(d.error ?? "Le réglage n'a pas pu être enregistré.");
      setReglage(d.engagement);
      setBrouillon(d.engagement.intitule);
      onMessage(reussite);
    } catch (e) {
      setBrouillon(reglage.intitule);
      onMessage((e as Error).message);
    } finally {
      setEnCours(false);
    }
  };

  const validerIntitule = (texte: string) => {
    const v = intituleValide(texte);
    if (!v) {
      setBrouillon(reglage.intitule);
      onMessage("L'intitulé ne peut pas être vide.");
      return;
    }
    if (v !== reglage.intitule) void enregistrer({ ...reglage, intitule: v }, "Intitulé enregistré.");
  };

  return (
    <section className={styles.bloc}>
      <h2 className={styles.blocTitre}>Bouton de réponse</h2>
      {migration ? (
        <p className={styles.aide}>Le bouton d&apos;engagement n&apos;est pas encore installé sur ce service (migration 031).</p>
      ) : (
        <>
          <label className={styles.interrupteur}>
            <span>
              <b>{reglage.actif ? "Activé : vos lecteurs peuvent vous répondre" : "Désactivé"}</b>
              Un bouton en bas de la page. En le cliquant, le lecteur vous envoie sa réponse : son nom,{" "}
              {choix > 0 ? "les cases et options qu'il a choisies dans la page" : "les choix éventuels faits dans la page"} et, si vous
              l&apos;autorisez, un mot. Vous la recevez par e-mail et dans l&apos;onglet Activité.
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={reglage.actif}
              disabled={enCours}
              onChange={() => void enregistrer({ ...reglage, actif: !reglage.actif }, reglage.actif ? "Bouton retiré." : "Bouton activé.")}
            />
          </label>

          {choix > 0 ? (
            <p className={styles.engagementChoixPage}>
              ✓ Cette page contient des choix à faire (cases, options…).{" "}
              {reglage.actif ? "Ils seront joints à chaque réponse." : "Activez le bouton pour recevoir ceux de vos lecteurs."}
            </p>
          ) : (
            <p className={styles.aide}>Aucune case ni option repérée dans cette page : la réponse portera le nom du lecteur et son mot.</p>
          )}

          {reglage.actif && (
            <div className={styles.engagementReglages}>
              <label className={styles.champLibelle} htmlFor="engagement-intitule">
                Intitulé du bouton
              </label>
              <div className={styles.chips}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={styles.chipChoix}
                    aria-pressed={reglage.intitule === s}
                    disabled={enCours}
                    onClick={() => s !== reglage.intitule && void enregistrer({ ...reglage, intitule: s }, "Intitulé enregistré.")}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className={styles.engagementChamp}>
                <input
                  id="engagement-intitule"
                  className={styles.champ}
                  value={brouillon}
                  maxLength={INTITULE_MAX}
                  disabled={enCours}
                  onChange={(e) => setBrouillon(e.target.value)}
                  onBlur={(e) => validerIntitule(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
                <small>
                  {brouillon.length} / {INTITULE_MAX}
                </small>
              </div>

              <label className={styles.interrupteur}>
                <span>
                  <b>Laisser un mot</b>
                  Le lecteur peut ajouter un message (500 caractères au plus).
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={reglage.mot}
                  disabled={enCours}
                  onChange={() => void enregistrer({ ...reglage, mot: !reglage.mot }, reglage.mot ? "Mot retiré." : "Le lecteur peut laisser un mot.")}
                />
              </label>

              <div className={styles.engagementApercu} aria-label="Aperçu chez le lecteur">
                <span className={styles.engagementBouton}>{brouillon.trim() || reglage.intitule}</span>
                <p>{textes(langue).mention(null, true, false)}</p>
              </div>
              <p className={styles.aide}>
                Au clic, le lecteur voit la liste de ses choix et peut en retirer avant d&apos;envoyer. Cette mention est fixe.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
