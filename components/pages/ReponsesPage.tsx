"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ligneChoix, pastillesLecture, type ReponseEngagement } from "@/lib/engagement";
import { lienWhatsApp, messageRappel, messageRelance } from "@/lib/groupesPages";
import { initiales } from "@/lib/pagesGetsite";
import { dureeLisible, ilYA, jourParis, type Activite } from "@/lib/activitePage";
import { attendus, csvReponses, listeLisible, ouverturesSurQuatorzeJours, syntheseChoix } from "@/lib/syntheseReponses";
import styles from "./pages.module.css";

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const jourCourt = (j: string) => new Date(`${j}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

type Filtre = "toutes" | "nouvelles" | "mot";

const IconeWhatsApp = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.8-.3-2.2-1-3.1-2.8-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z"
    />
  </svg>
);

/**
 * Onglet ACTIVITÉ (19/11, maquette validée). Répond d'abord à « où en sont
 * les réponses ? » (bandeau) et « qu'ont-ils choisi ? » (synthèse), puis les
 * réponses, qui a répondu, la courbe des ouvertures (sans nom) et les
 * questions. Ce qu'il ne dit PAS, exprès : qui a ouvert sans répondre.
 *
 * Monté dès l'ouverture de la fiche (pastille de l'onglet) ; les réponses
 * « nouvelles » deviennent vues quand l'auteur ouvre l'onglet — le badge
 * reste affiché le temps de la visite.
 */
export function ReponsesPage({
  pageId,
  visible,
  actualiser,
  onNouvelles,
  onTotal,
  liens = [],
  groupes = {},
  titre = "",
  langue = "fr",
  base = "",
  activite = null,
  onVoirAssistant,
}: {
  pageId: string;
  visible: boolean;
  actualiser: number;
  onNouvelles: (n: number) => void;
  /** Nombre de liens qui ont répondu (pour la fiche). */
  onTotal?: (n: number) => void;
  /** Liens ACTIFS de la page. */
  liens?: { jeton: string; destinataire: string }[];
  /** Liens de groupe : jeton → invités. */
  groupes?: Record<string, string[]>;
  titre?: string;
  /** Langue des lecteurs : celle des messages de relance. */
  langue?: "fr" | "en";
  /** Origine du site, pour composer les liens à relancer. */
  base?: string;
  /** Chiffres de lecture et questions (ActivitePage). */
  activite?: Activite | null;
  onVoirAssistant?: () => void;
}) {
  const [reponses, setReponses] = useState<ReponseEngagement[] | null>(null);
  const [actif, setActif] = useState<boolean | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const nouvellesVues = useRef<Set<string>>(new Set());

  const charger = useCallback(async () => {
    const [r, e] = await Promise.all([
      fetch(`/api/pages/${encodeURIComponent(pageId)}/reponses`, { credentials: "include" }).catch(() => null),
      fetch(`/api/pages/${encodeURIComponent(pageId)}/engagement`, { credentials: "include" }).catch(() => null),
    ]);
    if (r?.ok) setReponses(((await r.json().catch(() => ({}))) as { reponses?: ReponseEngagement[] }).reponses ?? []);
    if (e?.ok) setActif(!!((await e.json().catch(() => ({}))) as { engagement?: { actif?: boolean } }).engagement?.actif);
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

  const liste = reponses ?? [];
  const synthese = useMemo(() => syntheseChoix(liste), [liste]);
  const attente = useMemo(() => attendus(liens, groupes, liste), [liens, groupes, liste]);
  const courbe = useMemo(() => ouverturesSurQuatorzeJours(activite?.parJour ?? {}, jourParis()), [activite]);
  const maxCourbe = Math.max(1, ...courbe.map((c) => c.n));
  const estNouvelle = (r: ReponseEngagement) => !r.vueAt || nouvellesVues.current.has(r.id);
  const filtrees = liste.filter((r) => (filtre === "nouvelles" ? estNouvelle(r) : filtre === "mot" ? !!r.mot : true));
  const avecMot = liste.filter((r) => r.mot).length;
  const nbNouvellesAffichees = liste.filter(estNouvelle).length;

  const lienDe = (jeton: string) => `${base}/partage/${jeton}`;
  /** Relance d'un lien : un groupe nomme ses absents, une personne reçoit son lien. */
  const relanceDe = (l: (typeof attente.lignes)[number]) =>
    lienWhatsApp(
      l.invites
        ? messageRelance({ titre, lien: lienDe(l.jeton), attente: l.invites.filter((i) => !i.repondu).map((i) => i.prenom), langue })
        : messageRappel({ prenom: l.nom, titre, lien: lienDe(l.jeton), langue })
    );
  const aRelancer = attente.lignes.filter((l) => !l.repondu);

  const exporter = () => {
    const url = URL.createObjectURL(new Blob([csvReponses(liste)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    // Nom de fichier simple : certains navigateurs ignorent un nom à caractères spéciaux et écrivent « download ».
    const nom = (titre || "page")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    a.download = `${nom || "page"}-reponses.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!reponses) return null;

  const manquent = Array.from(new Set(attente.enAttente));
  const pourcentage = attente.total ? Math.round((attente.repondus / attente.total) * 100) : 0;
  const dernieresQuestions = (activite?.questions ?? []).flatMap((j) => j.items).slice(0, 3);

  return (
    <div className={styles.tableauActivite}>
      {/* 1. En un coup d'œil */}
      <section className={styles.resumeActivite}>
        {actif !== false && attente.total > 0 ? (
          <>
            <span className={styles.anneau} style={{ ["--part" as string]: `${pourcentage}%` }} aria-hidden="true">
              <b>
                {attente.repondus}/{attente.total}
              </b>
            </span>
            <div className={styles.resumeTexte}>
              <b>
                {attente.repondus} réponse{attente.repondus > 1 ? "s" : ""} sur {attente.total} attendue{attente.total > 1 ? "s" : ""}
              </b>
              <span>
                {manquent.length
                  ? `Il manque ${listeLisible(manquent.slice(0, 6))}${manquent.length > 6 ? ` et ${manquent.length - 6} autres` : ""}.`
                  : "Tout le monde a répondu."}
                {liste[0] ? ` Dernière réponse ${ilYA(liste[0].createdAt)}.` : ""}
              </span>
            </div>
          </>
        ) : (
          <div className={styles.resumeTexte}>
            <b>{attente.total ? "Bouton de réponse désactivé" : "Aucun destinataire pour l'instant"}</b>
            <span>
              {attente.total
                ? "Activez-le dans l'onglet Page pour que vos lecteurs vous répondent, choix compris."
                : "Partagez la page depuis l'onglet Partager pour suivre ici les réponses."}
            </span>
          </div>
        )}
        <div className={styles.resumeChiffres}>
          <div>
            <b>{activite?.ouvertures ?? 0}</b>
            <span>ouverture{(activite?.ouvertures ?? 0) > 1 ? "s" : ""}</span>
          </div>
          <div>
            <b>{activite?.totalQuestions ?? 0}</b>
            <span>question{(activite?.totalQuestions ?? 0) > 1 ? "s" : ""}</span>
          </div>
          <div>
            <b>{nbNouvellesAffichees}</b>
            <span>nouvelle{nbNouvellesAffichees > 1 ? "s" : ""}</span>
          </div>
        </div>
        {actif !== false && aRelancer.length === 1 && (
          <a className={styles.boutonWhatsApp} href={relanceDe(aRelancer[0])} target="_blank" rel="noopener noreferrer">
            <IconeWhatsApp />
            Relancer {attente.enAttente.length > 1 ? `les ${attente.enAttente.length} en attente` : attente.enAttente[0]}
          </a>
        )}
        {actif !== false && aRelancer.length > 1 && (
          <a className={styles.boutonWhatsApp} href="#qui-a-repondu">
            <IconeWhatsApp />
            Relancer les {attente.enAttente.length} en attente
          </a>
        )}
      </section>

      <div className={styles.activiteGrille}>
        <div className={styles.activiteColonne}>
          {/* 2. Ce qu'ils ont choisi */}
          {synthese.groupes.length > 0 && (
            <section className={styles.bloc}>
              <h2 className={styles.blocTitre}>
                <span>
                  Ce qu&apos;ils ont choisi{" "}
                  <small>
                    · {synthese.avecChoix} réponse{synthese.avecChoix > 1 ? "s" : ""}
                  </small>
                </span>
                <button type="button" className={styles.lienTexte} onClick={exporter}>
                  Exporter (CSV)
                </button>
              </h2>
              {synthese.groupes.map((g) => (
                <div key={g.groupe} className={styles.choixGroupe}>
                  <h3>{g.groupe}</h3>
                  {g.options.map((o) => {
                    const part = Math.round((o.nombre / synthese.avecChoix) * 100);
                    return (
                      <div key={o.valeur} className={styles.choixBarre}>
                        <span className={styles.choixValeur}>{/^[\d\s.,%€-]+$/.test(o.valeur) ? `Valeur : ${o.valeur}` : o.valeur}</span>
                        <span className={styles.choixJauge} aria-hidden="true">
                          <i style={{ width: `${part}%` }} />
                        </span>
                        <b>
                          {o.nombre} / {synthese.avecChoix}
                        </b>
                        {o.nombre < synthese.avecChoix && <span className={styles.choixQui}>{o.qui.join(", ")}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </section>
          )}

          {/* 3. Les réponses */}
          {liste.length > 0 && (
            <section className={styles.bloc}>
              <h2 className={styles.blocTitre}>
                <span>Réponses · {liste.length}</span>
                {synthese.groupes.length === 0 && (
                  <button type="button" className={styles.lienTexte} onClick={exporter}>
                    Exporter (CSV)
                  </button>
                )}
              </h2>
              <div className={styles.reponsesFiltres} role="group" aria-label="Filtrer les réponses">
                {(
                  [
                    ["toutes", `Toutes ${liste.length}`],
                    ["nouvelles", `Nouvelles ${nbNouvellesAffichees}`],
                    ["mot", `Avec un mot ${avecMot}`],
                  ] as [Filtre, string][]
                ).map(([f, l]) => (
                  <button key={f} type="button" aria-pressed={filtre === f} onClick={() => setFiltre(f)}>
                    {l}
                  </button>
                ))}
              </div>
              {filtrees.length === 0 && <p className={styles.aide}>Aucune réponse dans ce filtre.</p>}
              <ul className={styles.reponses}>
                {filtrees.map((r) => {
                  const nouvelle = estNouvelle(r);
                  const groupe = r.invite ? liens.find((l) => l.jeton === r.jeton)?.destinataire : null;
                  return (
                    <li key={r.id} className={styles.reponse}>
                      <div className={styles.reponseTete}>
                        <span className={styles.avatar} aria-hidden="true">
                          {initiales(r.destinataire)}
                        </span>
                        <b>{r.destinataire}</b>
                        {groupe && <span className={styles.badgeGroupe}>{groupe}</span>}
                        {nouvelle && <span className={styles.badgeNouvelle}>Nouvelle</span>}
                        <span className={styles.reponseQuand}>
                          {dateHeure(r.createdAt)} · version {r.version}
                        </span>
                      </div>
                      {r.choix.length > 0 && (
                        <div className={styles.reponseChoixPuces} aria-label="Ses choix dans la page">
                          {r.choix.map((c, i) => (
                            <span key={i} title={ligneChoix(c)}>
                              {/^[\d\s.,%€-]+$/.test(c.valeur) ? ligneChoix(c) : c.valeur}
                            </span>
                          ))}
                        </div>
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
        </div>

        <div className={styles.activiteColonne}>
          {/* 4. Qui a répondu */}
          {actif !== false && attente.lignes.length > 0 && (
            <section className={styles.bloc} id="qui-a-repondu">
              <h2 className={styles.blocTitre}>Qui a répondu</h2>
              <ul className={styles.quiListe}>
                {attente.lignes.map((l) => (
                  <li key={l.jeton}>
                    <div className={styles.quiLigne}>
                      <span className={styles.avatar} aria-hidden="true">
                        {initiales(l.nom)}
                      </span>
                      <span className={styles.quiNom}>
                        <b>{l.nom}</b>
                        <span>
                          {l.invites
                            ? `Lien de groupe · ${l.invites.filter((i) => i.repondu).length} / ${l.invites.length}`
                            : "Lien personnel"}
                        </span>
                      </span>
                      {l.repondu ? (
                        <span className={styles.etatRepondu}>a répondu</span>
                      ) : (
                        <a className={styles.lienWhatsApp} href={relanceDe(l)} target="_blank" rel="noopener noreferrer">
                          <IconeWhatsApp />
                          Relancer
                        </a>
                      )}
                    </div>
                    {l.invites && (
                      <div className={styles.quiInvites}>
                        {l.invites.map((i) => (
                          <span key={i.prenom} data-repondu={i.repondu ? "oui" : "non"}>
                            {i.prenom}
                            {i.repondu ? " ✓" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 5. Ouvertures */}
          <section className={styles.bloc}>
            <h2 className={styles.blocTitre}>
              <span>
                Ouvertures <small>· sans nom, 14 derniers jours</small>
              </span>
            </h2>
            <div className={styles.courbe} role="img" aria-label={`${courbe.reduce((n, c) => n + c.n, 0)} ouvertures sur 14 jours`}>
              {courbe.map((c, i) => (
                <i
                  key={c.jour}
                  title={`${jourCourt(c.jour)} : ${c.n} ouverture${c.n > 1 ? "s" : ""}`}
                  data-aujourdhui={i === courbe.length - 1 ? "oui" : "non"}
                  style={{ height: `${Math.max(4, (c.n / maxCourbe) * 100)}%` }}
                />
              ))}
            </div>
            <div className={styles.courbeAxe}>
              <span>{jourCourt(courbe[0].jour)}</span>
              <span>
                aujourd&apos;hui · {courbe[courbe.length - 1].n}
              </span>
            </div>
          </section>

          {/* 6. Questions */}
          {(activite?.totalQuestions ?? 0) > 0 && (
            <section className={styles.bloc}>
              <h2 className={styles.blocTitre}>Questions à l&apos;assistant</h2>
              <ul className={styles.questionsCourtes}>
                {dernieresQuestions.map((q, i) => (
                  <li key={q.id ?? i}>
                    « {q.question} »<span>{q.horsPage ? "la page ne le dit pas" : "répondue"}</span>
                  </li>
                ))}
              </ul>
              {onVoirAssistant && (
                <button type="button" className={styles.lienTexte} onClick={onVoirAssistant}>
                  Voir dans l&apos;onglet Assistant →
                </button>
              )}
            </section>
          )}

          {/* 7. Anciennes lectures partagées, jusqu'à leur effacement */}
          {activite && activite.lecteurs.some((l) => l.partage) && (
            <details className={styles.anciennesLectures}>
              <summary>Lectures partagées par l&apos;ancienne fenêtre ({activite.lecteurs.filter((l) => l.partage).length})</summary>
              <ul>
                {activite.lecteurs
                  .filter((l) => l.partage)
                  .map((l) => (
                    <li key={l.jeton}>
                      <b>{l.destinataire}</b> · {l.ouvertures} ouverture{l.ouvertures > 1 ? "s" : ""} · {dureeLisible(l.duree)}
                      {l.profondeur !== null ? (l.profondeur >= 95 ? " · lue jusqu'en bas" : ` · lue à ${l.profondeur} %`) : ""}
                    </li>
                  ))}
              </ul>
              <p>Effacées au bout de 120 jours.</p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
