"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./StudioPubliciste.module.css";
import { useEspace } from "@/lib/context/EspaceContext";
import { SafeHTML } from "@/components/shared/SafeHTML";
import { apiFetchInit } from "@/lib/apiFetch";
import { ListeProjets } from "./ListeProjets";
import { EtapeDirection } from "./EtapeDirection";
import { EtapeVoix } from "./EtapeVoix";
import { EtapeStoryboard } from "./EtapeStoryboard";
import { coutCroquis, devisProduction, dureeTotale, sceneModifiee } from "@/lib/publicisteStoryboard";
import { ETAPES_DIRECTION, MA_VOIX, POLICES, VOIX_GEMINI, JEUX_VOIX, coutDirection, type EtapeDirection as IdEtapeDirection } from "@/lib/publicisteDirection";
import {
  ETAPES_PUBLICISTE,
  ETAT_VIDE,
  filDuProjet,
  FICHE_VIDE,
  RUBRIQUES_FOND,
  RUBRIQUES_FORME,
  remplissage,
  type EtapePubliciste,
  type EtatProjet,
  type FichePubliciste,
} from "@/lib/publiciste";

/**
 * Le gent « Le Publiciste », CONFORME À LA MAQUETTE
 * (`mockups/recit/publiciste/index.html`, décision de l'éditeur du 27/11) :
 * barre des huit étapes, bulles du Publiciste, pied « Retour / Suivant ».
 *
 * Lot 1 : l'entretien est une VRAIE conversation avec le gent (même moteur
 * que les autres gents) ; la fiche « Ce que j'en retiens » se remplit de la
 * fiche que le gent recopie à chaque réponse ; le projet est enregistré côté
 * serveur (migration 040). Les étapes de direction artistique ont leur place
 * et leur bulle ; leurs générations arrivent aux lots suivants, et l'écran le
 * dit au lieu de faire semblant.
 */

type Statut = "chargement" | "pret" | "local" | "non_installe" | "erreur";

/** Première question, posée par l'écran (comme dans la maquette) : la consigne la connaît. */
export const PREMIERE_QUESTION = "Bonjour. Avant de parler de film ou de page, racontez-moi votre marque. Qu'est-ce que vous vendez, au fond ?";

/** Un projet enregistré (auteur connecté), ou en mémoire seulement (aperçu du créateur : `projetId` nul). */
function useProjet(projetId: string | null, auRevoir: () => void) {
  const persister = !!projetId;
  const [etat, setEtat] = useState<EtatProjet>(ETAT_VIDE);
  const [statut, setStatut] = useState<Statut>(persister ? "chargement" : "local");
  const [message, setMessage] = useState<string | null>(null);
  const version = useRef(0);
  const minuteur = useRef<number | null>(null);
  const aEcrire = useRef<EtatProjet | null>(null);
  // Rien ne s'écrit avant la PREMIÈRE lecture : au rechargement, la fiche du fil
  // passait dans l'état vide et partait au serveur — un projet entier écrasé
  // par « brief en cours, rien de choisi » (vu au lot 3).
  const charge = useRef(!persister);
  const adresse = projetId ? `/api/publiciste/projets/${encodeURIComponent(projetId)}` : "";
  // Dans une référence : la fonction change à chaque rendu du parent, et `lire`
  // en dépendait — le projet était RELU à chaque rendu, ce qui pouvait écraser
  // une modification pas encore enregistrée (vu au lot 3 : 37 lectures).
  const auRevoirRef = useRef(auRevoir);
  useEffect(() => {
    auRevoirRef.current = auRevoir;
  });

  const lire = useCallback(async () => {
    try {
      const r = await fetch(adresse, apiFetchInit());
      const j = await r.json().catch(() => null);
      if (r.status === 404) return auRevoirRef.current();
      if (!r.ok) {
        setStatut(j?.error === "non_installe" ? "non_installe" : "erreur");
        setMessage(j?.message ?? `Lecture du projet impossible (réf. ${r.status}).`);
        return;
      }
      version.current = j.version ?? 1;
      // Ce qui attendait d'être écrit portait un état ANTÉRIEUR à cette lecture : jeté.
      if (minuteur.current) window.clearTimeout(minuteur.current);
      minuteur.current = null;
      aEcrire.current = null;
      charge.current = true;
      setEtat({ ...ETAT_VIDE, ...j.etat, fiche: { ...FICHE_VIDE, ...j.etat?.fiche } });
      setStatut("pret");
    } catch {
      setStatut("erreur");
      setMessage("Lecture du projet impossible (réseau).");
    }
  }, [adresse]);

  useEffect(() => {
    if (persister) lire();
  }, [persister, lire]);

  const ecrire = useCallback(async () => {
    const e = aEcrire.current;
    if (!e) return;
    aEcrire.current = null;
    try {
      const r = await fetch(adresse, apiFetchInit({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ etat: e, version: version.current }) }));
      const j = await r.json().catch(() => null);
      if (r.status === 409) {
        setMessage(j?.message ?? "Le projet a changé dans un autre onglet : il a été relu.");
        return lire();
      }
      if (r.status === 404) return auRevoirRef.current();
      if (!r.ok) {
        setStatut(j?.error === "non_installe" ? "non_installe" : "erreur");
        setMessage(j?.message ?? `Enregistrement impossible (réf. ${r.status}).`);
        return;
      }
      version.current = j.version;
      setMessage(null);
    } catch {
      setMessage("Enregistrement impossible (réseau). Il sera retenté au prochain changement.");
    }
  }, [adresse, lire]);

  const modifier = useCallback(
    (f: (e: EtatProjet) => EtatProjet) => {
      setEtat((prev) => {
        const suivant = f(prev);
        if (persister && charge.current && suivant !== prev) {
          aEcrire.current = suivant;
          if (minuteur.current) window.clearTimeout(minuteur.current);
          minuteur.current = window.setTimeout(ecrire, 700);
        }
        return suivant;
      });
    },
    [persister, ecrire]
  );
  // En quittant le projet, l'écriture en attente part tout de suite.
  useEffect(
    () => () => {
      if (minuteur.current) {
        window.clearTimeout(minuteur.current);
        void ecrire();
      }
    },
    [ecrire]
  );
  return { etat, modifier, statut, message };
}

/** Le studio défile lui-même (html et body ne défilent pas) : remonter = faire défiler son conteneur. */
function remonter() {
  document.querySelector("[data-defilement-studio]")?.scrollTo(0, 0);
}

/** Le projet ouvert se lit dans l'adresse (`?projet=…`) : un lien, un rechargement, le bouton Retour le retrouvent. */
function projetDeLAdresse(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("projet");
}

export function StudioPubliciste({ apercuDe, personnelDe, token }: { apercuDe?: string; personnelDe?: string; token?: string }) {
  // L'auteur dans son espace a PLUSIEURS projets (« Vos projets », migration 041) ;
  // l'aperçu du créateur n'en a qu'un, en mémoire ; un visiteur n'y a pas accès.
  const multiProjets = !!personnelDe && !token;
  const [projetId, setProjetId] = useState<string | null>(null);
  const [adresseLue, setAdresseLue] = useState(false);
  useEffect(() => {
    setProjetId(projetDeLAdresse());
    setAdresseLue(true);
    const suivre = () => setProjetId(projetDeLAdresse());
    window.addEventListener("popstate", suivre);
    return () => window.removeEventListener("popstate", suivre);
  }, []);
  const ouvrirProjet = useCallback((id: string | null) => {
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("projet", id);
    else u.searchParams.delete("projet");
    window.history.pushState(window.history.state, "", u);
    setProjetId(id);
    remonter();
  }, []);

  if (token) {
    return (
      <div className={styles.studio} data-defilement-studio="">
        <main className={styles.main}>
          <div className={styles.intro}>
            <h2 className={styles.titre}>Le Publiciste</h2>
            <p className={styles.sous}>Ce gent n&apos;est pas encore ouvert aux visiteurs.</p>
          </div>
        </main>
      </div>
    );
  }
  if (multiProjets && !adresseLue) return <div className={styles.studio} />;
  if (multiProjets && !projetId) return <ListeProjets gentId={personnelDe!} ouvrir={ouvrirProjet} />;
  return <Projet key={projetId ?? "apercu"} projetId={multiProjets ? projetId : null} apercuDe={apercuDe} retourListe={multiProjets ? () => ouvrirProjet(null) : undefined} />;
}

function Projet({ projetId, apercuDe, retourListe }: { projetId: string | null; apercuDe?: string; retourListe?: () => void }) {
  const { activeConversation, sendMessage, isThinking, thinkingStatus, stopGeneration, ouvrirFil } = useEspace();
  const auRevoir = useCallback(() => retourListe?.(), [retourListe]);
  const { etat, modifier, statut, message } = useProjet(projetId, auRevoir);

  // Chaque projet a SON fil d'entretien dans l'espace du gent.
  const fil = projetId ? filDuProjet(projetId) : null;
  useEffect(() => {
    if (fil) ouvrirFil(fil);
  }, [fil, ouvrirFil]);
  const filPret = !fil || activeConversation.id === fil;

  // La fiche la plus récente que porte la conversation : elle fait foi, et
  // passe dans le projet enregistré (l'aperçu, lui, repart d'un fil vierge).
  const ficheDuFil = useMemo(() => {
    // Tant que le fil du projet n'est pas ouvert, celui affiché est un AUTRE :
    // sa fiche ne doit jamais passer dans ce projet.
    if (!filPret) return null;
    const msgs = activeConversation.messages;
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].fichePubliciste) return msgs[i].fichePubliciste!;
    return null;
  }, [activeConversation.messages, filPret]);
  useEffect(() => {
    if (ficheDuFil && JSON.stringify(ficheDuFil) !== JSON.stringify(etat.fiche)) modifier((e) => ({ ...e, fiche: ficheDuFil }));
  }, [ficheDuFil, etat.fiche, modifier]);
  const fiche: FichePubliciste = ficheDuFil ?? etat.fiche;

  const aller = (id: EtapePubliciste) => {
    modifier((e) => (e.etape === id ? e : { ...e, etape: id }));
    remonter();
  };
  const index = ETAPES_PUBLICISTE.findIndex((e) => e.id === etat.etape);
  const fait = (id: EtapePubliciste) =>
    id === "entretien"
      ? fiche.pret || etat.etape !== "entretien"
      : id === "recap"
        ? !!etat.valide
        : id === "storyboard"
          ? !!etat.storyboard && (etat.etape === "recap" || !!etat.valide)
          : !!etat.choix[id as keyof EtatProjet["choix"]];

  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [etat.etape]);

  const sousTitreProjet =
    fiche.projet || fiche.marque
      ? `Projet « ${fiche.projet || fiche.marque} »${fiche.marque && fiche.projet && fiche.marque !== fiche.projet ? ` · ${fiche.marque}` : ""}`
      : "Nouveau projet";
  const nomChoisi = (e: string) => {
    const id = etat.choix[e as keyof EtatProjet["choix"]];
    if (!id) return null;
    if (e === "visuel") return etat.direction?.visuel?.visuel?.find((p) => p.id === id)?.nom ?? null;
    if (e === "typo") return etat.direction?.typo?.typo?.find((p) => p.id === id)?.nom ?? POLICES.find((p) => p.id === id)?.nom ?? null;
    if (e === "couleurs") return etat.direction?.couleurs?.couleurs?.find((p) => p.id === id)?.nom ?? null;
    if (e === "musique") return etat.direction?.musique?.musique?.find((p) => p.id === id)?.nom ?? null;
    if (e === "voix") return id === MA_VOIX ? "Votre voix" : (VOIX_GEMINI.find((v) => v.id === id)?.nom ?? null);
    return id;
  };
  const LIBELLES_PIED: Record<string, string> = { visuel: "Univers", typo: "Lettres", couleurs: "Couleurs", musique: "Musique", voix: "Voix" };
  const etatPied =
    etat.etape === "entretien"
      ? "Fond et forme, avant de produire"
      : etat.etape === "recap"
        ? ""
        : etat.etape === "storyboard"
          ? etat.storyboard
            ? `${etat.storyboard.scenes.length} scènes · ${dureeTotale(etat.storyboard.scenes)} s`
            : "Pas encore écrit"
          : nomChoisi(etat.etape)
          ? `${LIBELLES_PIED[etat.etape] ?? "Choix"} : ${nomChoisi(etat.etape)}`
          : "Pas encore choisi";

  return (
    <div className={styles.studio} data-defilement-studio="">
      {apercuDe && (
        <div className={styles.bandeau} role="note">
          <span>
            <b>Aperçu</b> — rien n&apos;est enregistré ici. Le projet de l&apos;auteur vit dans son espace.
          </span>
          <a href={`/builder/${encodeURIComponent(apercuDe)}`}>Retour au studio</a>
        </div>
      )}
      <header className={styles.barre}>
        <div className={styles.barreIn}>
          <div className={styles.ident}>
            {retourListe && (
              <button type="button" className={styles.retour} onClick={retourListe} title="Vos projets" aria-label="Retour à vos projets">
                ‹
              </button>
            )}
            <span className={styles.avatar} aria-hidden="true">
              P
            </span>
            <span className={styles.identTexte}>
              <b>Le Publiciste</b>
              <small>{sousTitreProjet}</small>
            </span>
            <span className={styles.cout} title="Coût de la direction artistique déjà engagé, hors voix (facturation Google et Mistral non relevée)">
              <span className={styles.coutL}>Direction artistique</span>
              <b>{coutTotal(etat).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $</b>
              <span>+ voix</span>
            </span>
          </div>
          <nav className={styles.etapes} aria-label="Étapes" ref={navRef}>
            {ETAPES_PUBLICISTE.map((e, i) => (
              <button
                key={e.id}
                type="button"
                className={[styles.etapeB, fait(e.id) ? styles.fait : ""].join(" ")}
                aria-current={etat.etape === e.id ? "step" : undefined}
                onClick={() => aller(e.id)}
              >
                <span className={styles.n}>{fait(e.id) && etat.etape !== e.id ? "✓" : String(i)}</span>
                {e.nom}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        {(statut === "non_installe" || statut === "erreur" || message) && (
          <p className={statut === "non_installe" || statut === "erreur" ? styles.alerte : styles.noteBandeau} role="status">
            {message}
          </p>
        )}
        <section className={styles.vue} aria-live="polite">
          {etat.etape === "entretien" ? (
            <Entretien
              fiche={fiche}
              messages={filPret ? activeConversation.messages : []}
              envoyer={sendMessage}
              enCours={isThinking}
              statutReflexion={thinkingStatus}
              arreter={stopGeneration}
            />
          ) : etat.etape === "recap" ? (
            <Recap fiche={fiche} etat={etat} aller={aller} nomChoisi={nomChoisi} modifier={modifier} projetId={projetId} />
          ) : (ETAPES_DIRECTION as readonly string[]).includes(etat.etape) ? (
            <EtapeDirection
              key={etat.etape}
              etape={etat.etape as IdEtapeDirection}
              numero={index}
              projetId={projetId}
              etat={etat}
              modifier={modifier}
              fiche={fiche}
              allerEntretien={() => aller("entretien")}
            />
          ) : etat.etape === "storyboard" ? (
            <EtapeStoryboard numero={index} projetId={projetId} etat={etat} modifier={modifier} fiche={fiche} allerEntretien={() => aller("entretien")} />
          ) : etat.etape === "voix" ? (
            <EtapeVoix numero={index} projetId={projetId} etat={etat} modifier={modifier} fiche={fiche} />
          ) : null}
        </section>
      </main>

      <footer className={styles.pied}>
        <div className={styles.piedIn}>
          <span className={styles.etat}>{etatPied}</span>
          <span className={styles.piedBoutons}>
            {index > 0 && (
              <button type="button" className={[styles.bouton, styles.leger].join(" ")} onClick={() => aller(ETAPES_PUBLICISTE[index - 1].id)}>
                Retour
              </button>
            )}
            {index < ETAPES_PUBLICISTE.length - 1 && (
              <button type="button" className={styles.bouton} onClick={() => aller(ETAPES_PUBLICISTE[index + 1].id)}>
                {index === 0 ? "Vers la direction artistique" : "Suivant"}
              </button>
            )}
          </span>
        </div>
      </footer>
    </div>
  );
}

function Entete({ n, titre, sous }: { n: number; titre: string; sous: string }) {
  return (
    <div className={styles.intro}>
      <span className={styles.mono}>{n ? `Étape ${n} sur 7` : "Avant de commencer"}</span>
      <h2 className={styles.titre}>{titre}</h2>
      <p className={styles.sous}>{sous}</p>
    </div>
  );
}

function Bulle({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.bulle}>
      <span className={styles.avatar} aria-hidden="true">
        P
      </span>
      <div className={styles.bulleTxt}>{children}</div>
    </div>
  );
}

function Entretien({
  fiche,
  messages,
  envoyer,
  enCours,
  statutReflexion,
  arreter,
}: {
  fiche: FichePubliciste;
  messages: ReturnType<typeof useEspace>["activeConversation"]["messages"];
  envoyer: (t: string) => void;
  enCours: boolean;
  statutReflexion: string | null;
  arreter: () => void;
}) {
  const [texte, setTexte] = useState("");
  const fil = messages.filter((m) => (m.role === "user" || m.role === "agent") && (m.text?.trim() || m.role === "agent"));
  const finRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "nearest" });
  }, [fil.length, enCours]);
  const envoyerTexte = () => {
    const t = texte.trim();
    if (!t || enCours) return;
    envoyer(t);
    setTexte("");
  };
  const { remplies, total } = remplissage(fiche);
  const section = (titre: string, rubriques: readonly { cle: string; libelle: string }[], valeurs: Record<string, string | undefined>, certitude?: React.ReactNode) => (
    <div className={styles.sec}>
      <div className={styles.secT}>
        <span className={styles.lab}>{titre}</span>
        {certitude}
      </div>
      <dl>
        {rubriques.map((r) => (
          <div key={r.cle}>
            <dt>{r.libelle}</dt>
            <dd className={valeurs[r.cle] ? undefined : styles.vide}>{valeurs[r.cle] || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <>
      <Entete n={0} titre="Le brief" sous="On parle du fond, puis de la forme. Répondez avec vos mots : le Publiciste tient la fiche à jour." />
      <div className={styles.entretien}>
        <section className={styles.filE} aria-label="Conversation avec le Publiciste">
          <div className={styles.filTete}>
            <p className={styles.note}>
              {fil.length ? `${fil.length + 1} messages` : "Le brief commence"} · {remplies} rubrique{remplies > 1 ? "s" : ""} sur {total} remplie{remplies > 1 ? "s" : ""}
            </p>
          </div>
          <div className={[styles.msg, styles.msgP].join(" ")}>
            <span className={styles.qui}>Le Publiciste</span>
            <div className={styles.corpsM}>{PREMIERE_QUESTION}</div>
          </div>
          {fil.map((m, i) => {
            const derniere = i === fil.length - 1;
            if (m.role === "agent" && !m.text?.trim()) {
              return derniere && enCours ? (
                <div key={m.id ?? i} className={[styles.msg, styles.msgP].join(" ")}>
                  <span className={styles.qui}>Le Publiciste</span>
                  <div className={[styles.corpsM, styles.ecrit].join(" ")}>{statutReflexion ?? "Le Publiciste réfléchit…"}</div>
                </div>
              ) : null;
            }
            return (
              <div key={m.id ?? i} className={[styles.msg, m.role === "user" ? styles.msgA : styles.msgP].join(" ")}>
                <span className={styles.qui}>{m.role === "user" ? "Vous" : "Le Publiciste"}</span>
                <div className={styles.corpsM}>
                  <SafeHTML html={m.text ?? ""} />
                </div>
              </div>
            );
          })}
          <div ref={finRef} />
          <div className={styles.composer}>
            <textarea
              id="entretien-reponse"
              rows={2}
              placeholder="Répondre au Publiciste…"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  envoyerTexte();
                }
              }}
            />
            {enCours ? (
              <button type="button" className={[styles.bouton, styles.leger].join(" ")} onClick={arreter}>
                Arrêter
              </button>
            ) : (
              <button type="button" className={styles.bouton} onClick={envoyerTexte} disabled={!texte.trim()}>
                Envoyer
              </button>
            )}
          </div>
        </section>
        <aside className={styles.fiche} aria-label="Ce que le Publiciste en retient">
          <h3>Ce que j&apos;en retiens</h3>
          {section("Le fond", RUBRIQUES_FOND, fiche.fond)}
          {section(
            "La forme",
            RUBRIQUES_FORME,
            fiche.forme,
            <span className={[styles.certitude, fiche.formeDecidee ? styles.ok : ""].join(" ")}>{fiche.formeDecidee ? "Décidée" : "Pressentie"}</span>
          )}
          <p className={styles.piedF}>
            {fiche.pret
              ? "J'ai de quoi travailler : la direction artistique peut commencer."
              : "La forme peut rester ouverte : elle s'affine pendant la direction artistique, en voyant les pistes."}
          </p>
        </aside>
      </div>
    </>
  );
}

function Recap({
  fiche,
  etat,
  aller,
  nomChoisi,
  modifier,
  projetId,
}: {
  fiche: FichePubliciste;
  etat: EtatProjet;
  aller: (id: EtapePubliciste) => void;
  nomChoisi: (e: string) => string | null;
  modifier: (f: (e: EtatProjet) => EtatProjet) => void;
  projetId: string | null;
}) {
  const [confirmer, setConfirmer] = useState(false);
  const ligne = (k: string, id: EtapePubliciste, val: string | null, detail?: string) => (
    <div className={styles.l} key={k}>
      <span className={styles.k}>{k}</span>
      <span className={[styles.v, val ? "" : styles.vVide].join(" ")}>
        {val || "À choisir"}
        {detail && <small>{detail}</small>}
      </span>
      <button type="button" onClick={() => aller(id)}>
        {val ? "Modifier" : "Choisir"}
      </button>
    </div>
  );
  const manque = (["visuel", "typo", "couleurs", "musique", "voix"] as const).filter((k) => !etat.choix[k]).length + (etat.storyboard ? 0 : 1);
  const sb = etat.storyboard;
  const nbMod = sb ? sb.scenes.filter(sceneModifiee).length : 0;
  const resumeSb = sb
    ? [nbMod ? `${nbMod} scène${nbMod > 1 ? "s modifiées" : " modifiée"}` : "", sb.commentaire.trim() ? "une remarque sur l'ensemble" : ""].filter(Boolean).join(" · ") || "Accepté tel quel"
    : null;
  const recommencer = () => {
    setConfirmer(false);
    modifier((e) => ({ ...e, etape: "visuel", choix: {}, direction: {}, storyboard: undefined, valide: undefined, voix: e.voix ? { ...e.voix, extraits: {}, lignes: undefined, ecartees: [], jeu: undefined } : undefined }));
  };
  return (
    <>
      <Entete n={7} titre="Valider la direction" sous="Vérifiez vos choix. La production ne démarre qu'après votre accord." />
      <Bulle>
        <p>
          {manque
            ? `Il reste ${manque === 1 ? "un choix" : `${manque} choix`} à faire avant de lancer la production.`
            : "Tout est choisi. Si vous validez, je produis les images finales, la voix et la musique complètes sur cette base, puis je vous montre le film."}
        </p>
      </Bulle>
      <div className={styles.recap}>
        {ligne("Forme", "entretien", fiche.forme.forme || null, fiche.forme.forme ? (fiche.formeDecidee ? "Décidée au brief" : "Pressentie au brief") : undefined)}
        {ligne("Univers", "visuel", nomChoisi("visuel"))}
        {ligne("Lettres", "typo", nomChoisi("typo"), etat.choix.typo ? POLICES.find((p) => p.id === etat.choix.typo)?.detail : undefined)}
        {ligne("Couleurs", "couleurs", nomChoisi("couleurs"))}
        {ligne("Musique", "musique", nomChoisi("musique"))}
        {ligne("Voix", "voix", nomChoisi("voix"), etat.choix.voix ? `Jeu : ${etat.voix?.jeu ? JEUX_VOIX.find((j) => j.id === etat.voix?.jeu)?.nom : "à préciser"}` : undefined)}
        {ligne("Storyboard", "storyboard", resumeSb, sb ? `${sb.scenes.length} scènes · ${dureeTotale(sb.scenes)} s` : undefined)}
      </div>
      <Couts etat={etat} />
      {etat.valide ? (
        <div className={styles.valide}>
          <b>Direction validée. </b>La production n&apos;est pas encore branchée dans le gent : elle arrive au lot suivant. Vos choix sont gardés dans ce projet.
        </div>
      ) : confirmer ? (
        <div className={styles.confirmer} role="alert">
          <span>Effacer toute la direction artistique de ce projet (pistes, choix, voix lues, storyboard) ? Le brief est gardé.</span>
          <button type="button" className={[styles.bouton, styles.leger].join(" ")} onClick={() => setConfirmer(false)}>
            Annuler
          </button>
          <button type="button" className={[styles.bouton, styles.corail].join(" ")} onClick={recommencer}>
            Tout recommencer
          </button>
        </div>
      ) : (
        <div className={styles.actionsRecap}>
          <button type="button" className={[styles.bouton, styles.corail].join(" ")} disabled={manque > 0 || !projetId} onClick={() => modifier((e) => ({ ...e, valide: true }))}>
            Valider et lancer la production
          </button>
          <button type="button" className={[styles.bouton, styles.leger].join(" ")} onClick={() => setConfirmer(true)} disabled={!projetId}>
            Tout recommencer
          </button>
        </div>
      )}
    </>
  );
}

/** Ce qu'a coûté la direction artistique, mesuré, puis l'estimation de la production — comme le bloc de la maquette. */
const coutTotal = (etat: EtatProjet) => Math.round((coutDirection(etat.direction, etat.depenseTexte).total + coutCroquis(etat.storyboard)) * 100) / 100;

function Couts({ etat }: { etat: EtatProjet }) {
  const c = coutDirection(etat.direction, etat.depenseTexte);
  const n = (etat.direction?.visuel?.visuel ?? []).filter((p) => p.cout !== undefined).length;
  const nm = (etat.direction?.musique?.musique ?? []).filter((p) => p.cout !== undefined).length;
  const nc = (etat.storyboard?.scenes ?? []).filter((s) => s.coutCroquis !== undefined).length;
  const total = coutTotal(etat);
  const devis = devisProduction(etat.storyboard?.scenes.length ?? 10);
  const totalProd = devis.reduce((a, d) => a + (d.cout ?? 0), 0);
  const eur = (x: number) => x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
  return (
    <div className={styles.couts}>
      <b>Ce que coûte la direction artistique (déjà engagé)</b>
      {total === 0 ? (
        <div>
          <span>Rien n&apos;a encore été généré pour ce projet.</span>
          <span>0,00 $</span>
        </div>
      ) : (
        <>
          <div>
            <span>Pistes et storyboard (texte)</span>
            <span>{eur(c.texte)}</span>
          </div>
          {n > 0 && (
            <div>
              <span>{n} planche{n > 1 ? "s" : ""} d&apos;ambiance</span>
              <span>{eur(c.planches)}</span>
            </div>
          )}
          {nm > 0 && (
            <div>
              <span>
                {nm} extrait{nm > 1 ? "s" : ""} de musique
              </span>
              <span>{eur(c.musique)}</span>
            </div>
          )}
          {nc > 0 && (
            <div>
              <span>Storyboard, {nc} croquis</span>
              <span>{eur(coutCroquis(etat.storyboard))}</span>
            </div>
          )}
          <div>
            <span>Voix (facturées par Google et Mistral)</span>
            <span>non relevé</span>
          </div>
          <div className={styles.tot}>
            <span>Total hors voix</span>
            <span>{eur(total)}</span>
          </div>
        </>
      )}
      <b style={{ marginTop: 10 }}>Estimation de la production</b>
      {devis.map((d) => (
        <div key={d.libelle}>
          <span>{d.libelle}</span>
          <span>{d.cout ? `≈ ${eur(d.cout)}` : "à décider"}</span>
        </div>
      ))}
      <div className={styles.tot}>
        <span>Total estimé</span>
        <span>≈ {eur(totalProd)}</span>
      </div>
    </div>
  );
}
