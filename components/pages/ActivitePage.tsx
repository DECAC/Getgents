"use client";

import { useCallback, useEffect, useState } from "react";
import { dureeLisible, ilYA, type Activite } from "@/lib/activitePage";
import { initiales } from "@/lib/pagesGetsite";
import { estSuggeree, propositions, SUGGESTION_MAX, SUGGESTIONS_MAX, type Suggestion } from "@/lib/suggestionsPage";
import styles from "./pages.module.css";

const jourLisible = (jour: string) => {
  const r = ilYA(jour);
  return r === "aujourd'hui" || r === "hier" ? r.toUpperCase() : new Date(jour + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }).toUpperCase();
};

const quand = (iso: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return jourLisible(iso).toLowerCase();
  const d = new Date(iso);
  const jour = ilYA(iso).startsWith("il y a") || ilYA(iso) === "à l'instant" ? "Aujourd'hui" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
  return `${jour}, ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}`;
};

/**
 * Onglet « Activité » d'une page : à gauche les lectures, nominatives
 * seulement pour qui a accepté ; à droite les questions, sans nom ni lien.
 * Les deux colonnes ne partagent AUCUNE clé : on ne peut pas rattacher une
 * question à un lecteur.
 */
interface Precision {
  id: string;
  questionId: string | null;
  sujet: string;
  texte: string;
  createdAt: string;
}

export function ActivitePage({ id, onMessage }: { id: string; onMessage?: (m: string) => void }) {
  const [a, setA] = useState<Activite | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [precisions, setPrecisions] = useState<Precision[] | null>(null);
  const [precisionsErreur, setPrecisionsErreur] = useState<string | null>(null);
  /** Formulaire ouvert : une question (son id), une précision (« p:<id> »), ou une nouvelle (« nouvelle »). */
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [sujet, setSujet] = useState("");
  const [texte, setTexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [formErreur, setFormErreur] = useState<string | null>(null);

  // Questions suggérées aux visiteurs (levier 3). `editeur` : la suggestion en cours de relecture.
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggestionsErreur, setSuggestionsErreur] = useState<string | null>(null);
  const [editeur, setEditeur] = useState<{ index: number | null; texte: string; origine: Suggestion["origine"]; questionId?: string } | null>(null);

  const chargerSuggestions = useCallback(async () => {
    const r = await fetch(`/api/pages/${encodeURIComponent(id)}/suggestions`, { credentials: "include" });
    const j = (await r.json().catch(() => ({}))) as { suggestions?: Suggestion[]; error?: string };
    if (r.ok) {
      setSuggestions(j.suggestions ?? []);
      setSuggestionsErreur(null);
    } else setSuggestionsErreur(j.error || "Les questions suggérées n'ont pas pu être chargées.");
  }, [id]);

  useEffect(() => {
    void chargerSuggestions();
  }, [chargerSuggestions]);

  async function enregistrerSuggestions(liste: Suggestion[], message: string) {
    const r = await fetch(`/api/pages/${encodeURIComponent(id)}/suggestions`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestions: liste }),
    });
    const j = (await r.json().catch(() => ({}))) as { suggestions?: Suggestion[]; error?: string };
    if (!r.ok) return onMessage?.(j.error || "L'enregistrement a échoué. Réessayez.");
    setSuggestions(j.suggestions ?? liste);
    setEditeur(null);
    onMessage?.(message);
  }

  const proposer = (texte: string, questionId?: string) =>
    setEditeur({ index: null, texte: texte.slice(0, SUGGESTION_MAX), origine: questionId ? "question" : "libre", ...(questionId ? { questionId } : {}) });

  const validerEditeur = () => {
    if (!editeur || !suggestions || !editeur.texte.trim()) return;
    const s: Suggestion = { texte: editeur.texte.trim(), origine: editeur.origine, ...(editeur.questionId ? { questionId: editeur.questionId } : {}) };
    const liste = editeur.index === null ? [...suggestions, s] : suggestions.map((x, i) => (i === editeur.index ? s : x));
    void enregistrerSuggestions(liste, editeur.index === null ? "Question suggérée : les visiteurs la verront dans l'assistant." : "Question suggérée modifiée.");
  };

  const deplacer = (i: number, sens: -1 | 1) => {
    if (!suggestions) return;
    const j = i + sens;
    if (j < 0 || j >= suggestions.length) return;
    const l = [...suggestions];
    [l[i], l[j]] = [l[j], l[i]];
    void enregistrerSuggestions(l, "Ordre enregistré.");
  };

  const chargerPrecisions = useCallback(async () => {
    const r = await fetch(`/api/pages/${encodeURIComponent(id)}/complements`, { credentials: "include" });
    const j = (await r.json().catch(() => ({}))) as { complements?: Precision[]; error?: string };
    if (r.ok) {
      setPrecisions(j.complements ?? []);
      setPrecisionsErreur(null);
    } else setPrecisionsErreur(j.error || "Les précisions n'ont pas pu être chargées.");
  }, [id]);

  useEffect(() => {
    void chargerPrecisions();
  }, [chargerPrecisions]);

  const ouvrir = (cle: string, s: string, t: string) => {
    setOuvert(cle);
    setSujet(s);
    setTexte(t);
    setFormErreur(null);
  };

  async function enregistrer(questionId: string | null) {
    if (!texte.trim() || enCours) return;
    setEnCours(true);
    setFormErreur(null);
    const modif = ouvert?.startsWith("p:") ? ouvert.slice(2) : null;
    const r = await fetch(`/api/pages/${encodeURIComponent(id)}/complements${modif ? `/${modif}` : ""}`, {
      method: modif ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sujet, texte, questionId }),
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setEnCours(false);
    if (!r.ok) return setFormErreur(j.error || "L'enregistrement a échoué. Réessayez.");
    setOuvert(null);
    onMessage?.(modif ? "Précision modifiée." : "Précision ajoutée : l'assistant s'en sert dès maintenant.");
    void chargerPrecisions();
  }

  async function retirer(p: Precision) {
    if (!window.confirm("Retirer cette précision ? L'assistant ne s'en servira plus.")) return;
    const r = await fetch(`/api/pages/${encodeURIComponent(id)}/complements/${p.id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      onMessage?.("Précision retirée.");
      void chargerPrecisions();
    } else onMessage?.("Le retrait a échoué. Réessayez.");
  }

  const formulaire = (questionId: string | null) => (
    <div className={styles.precisionForm}>
      <label className={styles.precisionLabel}>
        Sujet <span>(pour vous repérer — jamais montré aux visiteurs)</span>
        <input className={styles.champ} value={sujet} maxLength={300} onChange={(e) => setSujet(e.target.value)} />
      </label>
      <label className={styles.precisionLabel}>
        Votre précision <span>— l&apos;assistant s&apos;en servira pour répondre</span>
        <textarea className={styles.precisionTexte} value={texte} maxLength={1500} rows={3} autoFocus onChange={(e) => setTexte(e.target.value)} />
      </label>
      <p className={styles.precisionPortee}>Elle vaut pour tous les destinataires de la page, sans leur être signalée.</p>
      {formErreur && <p className={styles.erreur}>{formErreur}</p>}
      <div className={styles.precisionActions}>
        <button type="button" className={styles.principal} disabled={!texte.trim() || enCours} onClick={() => void enregistrer(questionId)}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" className={styles.secondaire} onClick={() => setOuvert(null)}>
          Annuler
        </button>
      </div>
    </div>
  );

  useEffect(() => {
    let vivant = true;
    (async () => {
      const r = await fetch(`/api/pages/${encodeURIComponent(id)}/activite`, { credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!vivant) return;
      if (!r.ok) setErreur((j as { error?: string }).error || "L'activité n'a pas pu être chargée.");
      else setA(j as Activite);
    })();
    return () => {
      vivant = false;
    };
  }, [id]);

  if (erreur) return <p className={styles.erreur}>{erreur}</p>;
  if (!a) return <p className={styles.sous}>Chargement…</p>;

  // « Sans réponse » : ce qui reste à traiter — une question déjà précisée n'en est plus.
  const sansReponse = a.questions
    .flatMap((j) => j.items)
    .filter((q) => q.horsPage === true && !(q.id && precisions?.some((p) => p.questionId === q.id))).length;

  const plein = !!suggestions && suggestions.length >= SUGGESTIONS_MAX;
  const questionsPosees = a.questions.flatMap((j) =>
    j.items.map((q) => ({ id: q.id, question: q.question, repondue: q.horsPage === false || (!!q.id && !!precisions?.some((p) => p.questionId === q.id)) }))
  );
  const proposees = suggestions ? propositions(questionsPosees, suggestions) : [];
  const relecture = editeur && (
    <div className={styles.suggestionEditeur}>
      <label className={styles.precisionLabel}>
        {editeur.index === null ? "Nouvelle question suggérée" : "Modifier la question suggérée"}
        <span>Relisez : retirez tout détail propre à un client (nom, montant, entreprise).</span>
        <input
          className={styles.champ}
          value={editeur.texte}
          maxLength={SUGGESTION_MAX}
          autoFocus
          onChange={(e) => setEditeur({ ...editeur, texte: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && validerEditeur()}
        />
      </label>
      <p className={styles.precisionPortee}>Visible par tous les destinataires, dans l&apos;assistant.</p>
      <div className={styles.precisionActions}>
        <button type="button" className={styles.principal} disabled={!editeur.texte.trim()} onClick={validerEditeur}>
          Publier
        </button>
        <button type="button" className={styles.secondaire} onClick={() => setEditeur(null)}>
          Annuler
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.activite}>
      <div className={styles.tuiles}>
        <div className={styles.tuile}>
          <b>{a.ouvertures}</b>
          <span>
            ouverture{a.ouvertures > 1 ? "s" : ""} de la page{a.anonymes ? `, dont ${a.anonymes} anonyme${a.anonymes > 1 ? "s" : ""}` : ""}
          </span>
        </div>
        <div className={styles.tuile}>
          <b>
            {a.partages} / {a.destinataires}
          </b>
          <span>destinataires ont partagé leurs données</span>
        </div>
        <div className={styles.tuile}>
          <b>{a.totalQuestions}</b>
          <span>
            question{a.totalQuestions > 1 ? "s" : ""} posée{a.totalQuestions > 1 ? "s" : ""}
            {sansReponse ? ` · ${sansReponse} sans réponse` : ""}
          </span>
        </div>
        <div className={styles.tuile}>
          <b>{ilYA(a.derniere)}</b>
          <span>dernière ouverture{precisions?.length ? ` · ${precisions.length} précision${precisions.length > 1 ? "s" : ""} de l'auteur` : ""}</span>
        </div>
      </div>

      <div className={styles.activiteCols}>
        <section className={`${styles.bloc} ${styles.pleineLargeur}`} aria-label="Lectures partagées">
          <h2 className={styles.blocTitre}>
            Lectures partagées <small>avec l&apos;accord du destinataire</small>
          </h2>
          {a.lecteurs.length === 0 && <p className={styles.aide}>Aucun destinataire actif.</p>}
          <ul className={styles.lecteurs}>
            {a.lecteurs.map((l) => (
              <li key={l.jeton} className={styles.lecteur}>
                <div className={styles.lecteurLigne}>
                  <span className={styles.avatar} aria-hidden="true">
                    {initiales(l.destinataire)}
                  </span>
                  <div className={styles.lecteurTexte}>
                    <b>{l.destinataire}</b>
                    <span>
                      {l.partage
                        ? [
                            `${l.ouvertures} ouverture${l.ouvertures > 1 ? "s" : ""}`,
                            dureeLisible(l.duree),
                            l.profondeur === null ? null : l.profondeur >= 95 ? "a lu jusqu'en bas" : `a lu ${l.profondeur} %`,
                            l.version ? `version ${l.version}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "N'a pas partagé ses données"}
                    </span>
                  </div>
                  <span className={styles.lecteurEtat} data-partage={l.partage ? "oui" : "non"}>
                    {l.partage ? ilYA(l.derniere) : "—"}
                  </span>
                </div>
                {l.partage && (
                  <ol className={styles.frise}>
                    {l.visites.slice(0, 8).map((v, i) => (
                      <li key={i}>
                        <b>{quand(v.debut)}</b> · {dureeLisible(v.duree)}
                        {v.appareil ? ` · ${v.appareil === "telephone" ? "téléphone" : "ordinateur"}` : ""}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
          <p className={styles.aide}>« N&apos;a pas partagé » ne dit pas si la page a été ouverte : un destinataire qui refuse ne laisse rien deviner.</p>
        </section>

        <section className={styles.bloc} aria-label="Questions posées sur la page">
          <h2 className={styles.blocTitre}>
            Questions posées sur la page <small>sans nom ni lien</small>
          </h2>
          {a.questions.length === 0 && <p className={styles.aide}>Aucune question pour l&apos;instant. Activez l&apos;assistant IA pour que vos destinataires puissent en poser.</p>}
          {a.questions.map((j) => (
            <div key={j.jour}>
              <div className={styles.jour}>{jourLisible(j.jour)}</div>
              {j.items.map((q, i) => {
                const completee = !!q.id && !!precisions?.some((p) => p.questionId === q.id);
                const repondable = q.horsPage === true && !!q.id && !completee && !!precisions;
                const suggerable = (q.horsPage === false || completee) && !!suggestions;
                const suggeree = !!suggestions && estSuggeree(q, suggestions, questionsPosees);
                return (
                  <div key={q.id ?? i} className={styles.question} data-hors-page={q.horsPage && !completee ? "oui" : "non"} data-completee={completee ? "oui" : "non"}>
                    <div className={styles.questionLigne}>
                      <span>{q.question}</span>
                      {completee ? (
                        <small>✓ précisée par vous</small>
                      ) : repondable && ouvert !== q.id ? (
                        <button type="button" className={styles.repondre} onClick={() => ouvrir(q.id!, q.question, "")}>
                          Répondre
                        </button>
                      ) : (
                        <small>{q.horsPage === true ? "la page ne le dit pas" : q.horsPage === false ? "répondu" : "—"}</small>
                      )}
                      {suggerable &&
                        (suggeree ? (
                          <span className={styles.suggerer} data-actif="oui">
                            ★ Suggérée
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={styles.suggerer}
                            disabled={plein}
                            title={plein ? `${SUGGESTIONS_MAX} questions suggérées au plus : retirez-en une d'abord.` : "Proposer cette question aux visiteurs"}
                            onClick={() => proposer(q.question, q.id)}
                          >
                            ☆ Suggérer
                          </button>
                        ))}
                    </div>
                    {ouvert === q.id && formulaire(q.id!)}
                  </div>
                );
              })}
            </div>
          ))}
          {a.horsPage > 0 && (
            <p className={styles.aide}>« La page ne le dit pas » : l&apos;information manquait. Répondez, et l&apos;assistant s&apos;en servira pour les prochains visiteurs.</p>
          )}
        </section>

        <section className={styles.bloc} aria-label="Questions suggérées aux visiteurs">
          <h2 className={styles.blocTitre}>
            Questions suggérées aux visiteurs <small>{SUGGESTIONS_MAX} au plus, dans l&apos;assistant</small>
          </h2>
          {suggestionsErreur && <p className={styles.aide}>{suggestionsErreur}</p>}
          {suggestions && (
            <ol className={styles.suggestions}>
              {suggestions.map((s, i) =>
                editeur?.index === i ? (
                  <li key={i}>{relecture}</li>
                ) : (
                  <li key={i} className={styles.suggestion}>
                    <span className={styles.ordre}>
                      <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => deplacer(i, -1)}>
                        ↑
                      </button>
                      <button type="button" aria-label="Descendre" disabled={i === suggestions.length - 1} onClick={() => deplacer(i, 1)}>
                        ↓
                      </button>
                    </span>
                    <span className={styles.suggestionTexte}>{s.texte}</span>
                    {s.origine === "defaut" && <span className={styles.pastilleGrise}>par défaut</span>}
                    {s.origine === "question" && s.questionId && !questionsPosees.some((q) => q.id === s.questionId && q.question.trim() === s.texte) && (
                      <span className={styles.pastilleGrise}>reformulée</span>
                    )}
                    {s.origine !== "defaut" && (
                      <button type="button" className={styles.lienBleu} onClick={() => setEditeur({ index: i, texte: s.texte, origine: s.origine, ...(s.questionId ? { questionId: s.questionId } : {}) })}>
                        Modifier
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.lienRouge}
                      onClick={() => void enregistrerSuggestions(suggestions.filter((_, k) => k !== i), "Question suggérée retirée.")}
                    >
                      Retirer
                    </button>
                  </li>
                )
              )}
            </ol>
          )}
          {editeur?.index === null && relecture}
          {suggestions && !editeur && (
            <button type="button" className={styles.precisionAjout} disabled={plein} onClick={() => proposer("")}>
              {plein ? `${SUGGESTIONS_MAX} questions suggérées au plus` : "+ Écrire une question suggérée"}
            </button>
          )}
          {proposees.length > 0 && (
            <>
              <h3 className={styles.sousTitre}>Proposées d&apos;après les questions posées</h3>
              {proposees.map((p) => (
                <div key={p.texte} className={styles.proposition}>
                  <div className={styles.propositionTexte}>
                    <b>{p.texte}</b>
                    <span>
                      posée {p.occurrences} fois{p.formulations > 1 ? ` · ${p.formulations} formulations proches` : ""}
                    </span>
                  </div>
                  <button type="button" className={styles.principalPetit} disabled={plein || !!editeur} onClick={() => proposer(p.texte, p.questionId)}>
                    Ajouter
                  </button>
                </div>
              ))}
            </>
          )}
          <p className={styles.aide}>
            Rien n&apos;est montré aux visiteurs sans votre accord : relisez chaque question, une formulation peut révéler un détail propre à un client. Seules les
            questions auxquelles l&apos;assistant sait répondre sont proposées.
          </p>
        </section>

        <section className={`${styles.bloc} ${styles.pleineLargeur}`} aria-label="Précisions de l'auteur">
          <h2 className={styles.blocTitre}>
            Précisions de l&apos;auteur <small>lues par l&apos;assistant avec la page</small>
          </h2>
          {precisionsErreur && <p className={styles.aide}>{precisionsErreur}</p>}
          {precisions?.map((p) => (
            <div key={p.id} className={styles.precision}>
              {ouvert === `p:${p.id}` ? (
                formulaire(p.questionId)
              ) : (
                <>
                  {p.sujet && <div className={styles.precisionSujet}>{p.sujet}</div>}
                  <div className={styles.precisionCorps}>{p.texte}</div>
                  <div className={styles.precisionMeta}>
                    Ajoutée le {new Date(p.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" })} ·{" "}
                    <button type="button" className={styles.lienBleu} onClick={() => ouvrir(`p:${p.id}`, p.sujet, p.texte)}>
                      Modifier
                    </button>{" "}
                    ·{" "}
                    <button type="button" className={styles.lienRouge} onClick={() => void retirer(p)}>
                      Retirer
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {precisions && (ouvert === "nouvelle" ? (
            <div className={styles.precision}>{formulaire(null)}</div>
          ) : (
            <button type="button" className={styles.precisionAjout} onClick={() => ouvrir("nouvelle", "", "")}>
              + Ajouter une précision
            </button>
          ))}
          <p className={styles.aide}>
            Une précision vaut pour <b>tous</b> les destinataires de la page. Pour une condition propre à un client, écrivez-lui directement. Quand une précision
            devient importante, ajoutez-la plutôt à la page elle-même (nouvelle version depuis Claude).
          </p>
        </section>
      </div>
    </div>
  );
}
