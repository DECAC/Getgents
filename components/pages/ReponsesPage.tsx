"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ligneChoix, pastillesLecture, type ReponseEngagement } from "@/lib/engagement";
import { cleInvite, lienWhatsApp, messageRelance } from "@/lib/groupesPages";
import styles from "./pages.module.css";

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/**
 * Réponses des lecteurs au bouton d'engagement, en tête de l'onglet
 * Activité. Monté dès l'ouverture de la fiche (pastille de l'onglet) ; les
 * réponses « nouvelles » deviennent vues quand l'auteur ouvre l'onglet —
 * le badge reste affiché le temps de la visite.
 */
export function ReponsesPage({
  pageId,
  visible,
  actualiser,
  onNouvelles,
  onTotal,
  groupes = [],
  titre = "",
}: {
  pageId: string;
  visible: boolean;
  actualiser: number;
  onNouvelles: (n: number) => void;
  /** Nombre de liens qui ont répondu (tuile de l'onglet Activité). */
  onTotal?: (n: number) => void;
  /** Liens de groupe actifs de la page : suivi « a répondu / en attente » et relance. */
  groupes?: { jeton: string; nom: string; invites: string[]; lien: string }[];
  titre?: string;
}) {
  const [reponses, setReponses] = useState<ReponseEngagement[] | null>(null);
  const nouvellesVues = useRef<Set<string>>(new Set());

  const charger = useCallback(async () => {
    const r = await fetch(`/api/pages/${encodeURIComponent(pageId)}/reponses`, { credentials: "include" }).catch(() => null);
    if (!r?.ok) return;
    const d = (await r.json().catch(() => ({}))) as { reponses?: ReponseEngagement[] };
    setReponses(d.reponses ?? []);
  }, [pageId]);

  useEffect(() => {
    void charger();
  }, [charger, actualiser]);

  const nouvelles = (reponses ?? []).filter((x) => !x.vueAt);
  const total = reponses ? new Set(reponses.map((x) => x.jeton)).size : 0;
  useEffect(() => {
    onTotal?.(total);
  }, [total, onTotal]);
  useEffect(() => {
    onNouvelles(visible ? 0 : nouvelles.length);
  }, [nouvelles.length, visible, onNouvelles]);

  const nbNouvelles = nouvelles.length;
  useEffect(() => {
    if (!visible || nbNouvelles === 0) return;
    for (const n of reponses ?? []) if (!n.vueAt) nouvellesVues.current.add(n.id);
    void fetch(`/api/pages/${encodeURIComponent(pageId)}/reponses`, { method: "PATCH", credentials: "include" }).then(() => {
      const maintenant = new Date().toISOString();
      setReponses((liste) => liste?.map((x) => (x.vueAt ? x : { ...x, vueAt: maintenant })) ?? liste);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, nbNouvelles, pageId]);

  if (!reponses) return null;

  const suivis = groupes.map((g) => {
    const faits = new Set(reponses.filter((r) => r.jeton === g.jeton && r.invite).map((r) => cleInvite(r.invite!)));
    return { ...g, faits, attente: g.invites.filter((i) => !faits.has(cleInvite(i))) };
  });
  if (reponses.length === 0 && suivis.length === 0) return null;

  return (
    <>
      {suivis.map((g) => (
        <section key={g.jeton} className={`${styles.bloc} ${styles.groupeSuivi}`}>
          <h2 className={styles.blocTitre}>
            {g.nom} · {g.invites.length - g.attente.length} / {g.invites.length} ont répondu
          </h2>
          <div className={styles.invitesGrille}>
            {g.invites.map((i) => {
              const fait = g.faits.has(cleInvite(i));
              return (
                <div key={i} className={styles.inviteCase} data-repondu={fait ? "oui" : "non"}>
                  <b>{i}</b>
                  <span>{fait ? "a répondu" : "en attente"}</span>
                </div>
              );
            })}
          </div>
          {g.attente.length > 0 && (
            <div className={styles.relance}>
              <div>
                <b>
                  Relancer {g.attente.length === 1 ? g.attente[0] : `les ${g.attente.length} en attente`}
                </b>
                <small>WhatsApp s&apos;ouvre avec un rappel qui les nomme, et le lien du groupe. Rien ne part sans vous.</small>
              </div>
              <a
                className={styles.boutonWhatsApp}
                href={lienWhatsApp(messageRelance({ titre, lien: g.lien, attente: g.attente }))}
                target="_blank"
                rel="noopener noreferrer"
              >
                Relancer
              </a>
            </div>
          )}
        </section>
      ))}
      {reponses.length > 0 && (
    <section className={styles.bloc}>
      <h2 className={styles.blocTitre}>
        Réponses · {reponses.length}
      </h2>
      <ul className={styles.reponses}>
        {reponses.map((r) => {
          const nouvelle = !r.vueAt || nouvellesVues.current.has(r.id);
          return (
            <li key={r.id} className={styles.reponse}>
              <div className={styles.reponseTete}>
                <b>{r.destinataire}</b>
                <span>« {r.intitule} »</span>
                {r.invite && <span className={styles.badgeGroupe}>via le lien de groupe</span>}
                <span className={nouvelle ? styles.badgeNouvelle : styles.badgeVue}>{nouvelle ? "Nouvelle" : "Vue"}</span>
              </div>
              <div className={styles.reponseMeta}>
                {dateHeure(r.createdAt)} · version {r.version} lue
              </div>
              {r.choix.length > 0 && (
                <ul className={styles.reponseChoix} aria-label="Ses choix dans la page">
                  {r.choix.map((c, i) => (
                    <li key={i}>
                      {ligneChoix(c)}
                      {c.modifie && <span className={styles.reponseModifie}> · choisi par le lecteur</span>}
                    </li>
                  ))}
                </ul>
              )}
              {r.mot && <blockquote className={styles.reponseMot}>{r.mot}</blockquote>}
              {r.lecture ? (
                <div className={styles.reponseLecture} aria-label="Sa lecture de la page">
                  {pastillesLecture(r.lecture).map((p) => (
                    <span key={p}>{p}</span>
                  ))}
                </div>
              ) : (
                <div className={styles.reponseSansLecture}>N&apos;a pas joint sa lecture.</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
      )}
    </>
  );
}
