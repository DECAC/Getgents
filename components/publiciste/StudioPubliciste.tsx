"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./StudioPubliciste.module.css";
import { useEspace } from "@/lib/context/EspaceContext";
import { SafeHTML } from "@/components/shared/SafeHTML";
import { apiFetchInit } from "@/lib/apiFetch";
import { ListeProjets } from "./ListeProjets";
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
  const adresse = projetId ? `/api/publiciste/projets/${encodeURIComponent(projetId)}` : "";

  const lire = useCallback(async () => {
    try {
      const r = await fetch(adresse, apiFetchInit());
      const j = await r.json().catch(() => null);
      if (r.status === 404) return auRevoir();
      if (!r.ok) {
        setStatut(j?.error === "non_installe" ? "non_installe" : "erreur");
        setMessage(j?.message ?? `Lecture du projet impossible (réf. ${r.status}).`);
        return;
      }
      version.current = j.version ?? 1;
      setEtat({ ...ETAT_VIDE, ...j.etat, fiche: { ...FICHE_VIDE, ...j.etat?.fiche } });
      setStatut("pret");
    } catch {
      setStatut("erreur");
      setMessage("Lecture du projet impossible (réseau).");
    }
  }, [adresse, auRevoir]);

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
      if (r.status === 404) return auRevoir();
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
  }, [adresse, lire, auRevoir]);

  const modifier = useCallback(
    (f: (e: EtatProjet) => EtatProjet) => {
      setEtat((prev) => {
        const suivant = f(prev);
        if (persister && suivant !== prev) {
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
    id === "entretien" ? fiche.pret || etat.etape !== "entretien" : id === "recap" ? false : !!etat.choix[id as keyof EtatProjet["choix"]];

  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [etat.etape]);

  const sousTitreProjet =
    fiche.projet || fiche.marque
      ? `Projet « ${fiche.projet || fiche.marque} »${fiche.marque && fiche.projet && fiche.marque !== fiche.projet ? ` · ${fiche.marque}` : ""}`
      : "Nouveau projet";
  const etatPied =
    etat.etape === "entretien"
      ? "Fond et forme, avant de produire"
      : etat.etape === "recap"
        ? ""
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
            <Recap fiche={fiche} etat={etat} aller={aller} />
          ) : (
            <EtapeAVenir etape={etat.etape} numero={index} fiche={fiche} aller={aller} />
          )}
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
      <Entete n={0} titre="L'entretien" sous="On parle du fond, puis de la forme. Répondez avec vos mots : le Publiciste tient la fiche à jour." />
      <div className={styles.entretien}>
        <section className={styles.filE} aria-label="Conversation avec le Publiciste">
          <div className={styles.filTete}>
            <p className={styles.note}>
              {fil.length ? `${fil.length + 1} messages` : "L'entretien commence"} · {remplies} rubrique{remplies > 1 ? "s" : ""} sur {total} remplie{remplies > 1 ? "s" : ""}
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

/** Ce que chaque étape fera, dans les mots de la maquette, et le lot qui l'apporte. */
const A_VENIR: Record<string, { titre: string; sous: string; bulle: string; lot: string }> = {
  visuel: {
    titre: "Direction visuelle",
    sous: "Trois planches d'ambiance. On juge un univers, pas une image finale.",
    bulle: "Je relève votre univers, puis je vous propose trois planches d'ambiance, chacune avec ce qu'elle apporte et ce qu'elle risque, et ma recommandation.",
    lot: "lot 2",
  },
  typo: {
    titre: "Typographie",
    sous: "Les lettres de l'étiquette, de la page finale et de la phrase de fin.",
    bulle: "Je vous montre trois associations de polices en spécimens vivants, avec le texte de votre projet.",
    lot: "lot 2",
  },
  couleurs: {
    titre: "Couleurs",
    sous: "La palette de l'histoire et de la page à son nom.",
    bulle: "Trois palettes de cinq couleurs, tirées de votre marque et de l'univers choisi.",
    lot: "lot 2",
  },
  musique: {
    titre: "Musique",
    sous: "Choisissez avec vos oreilles : trois extraits de 30 secondes.",
    bulle: "Vous me dites ce que la musique doit faire ressentir ; je le traduis en instruments et en tempo pour le compositeur.",
    lot: "lot 3",
  },
  voix: {
    titre: "Voix",
    sous: "Six voix lisent le même texte : trois voix d'homme, trois voix de femme. Et la vôtre, si vous le souhaitez.",
    bulle: "Toutes reçoivent la même consigne : français de France, la voix qui sert votre histoire. Votre voix peut aussi être recomposée à partir d'un enregistrement de 30 secondes.",
    lot: "lot 3",
  },
  storyboard: {
    titre: "Storyboard",
    sous: "Les scènes, leurs croquis, et l'animatique avec la voix et la musique choisies.",
    bulle: "Je raconte l'histoire scène par scène, avec un croquis pour chacune. Vous corrigez directement, et je redessine seulement ce qui change.",
    lot: "lot 4",
  },
};

function EtapeAVenir({ etape, numero, fiche, aller }: { etape: string; numero: number; fiche: FichePubliciste; aller: (id: EtapePubliciste) => void }) {
  const a = A_VENIR[etape];
  if (!a) return null;
  const { remplies, total } = remplissage(fiche);
  return (
    <>
      <Entete n={numero} titre={a.titre} sous={a.sous} />
      <Bulle>
        <p>{a.bulle}</p>
        {!fiche.pret && (
          <p>
            Terminons d&apos;abord l&apos;entretien : la fiche est remplie à {remplies} sur {total}.{" "}
            <button type="button" className={styles.lien} onClick={() => aller("entretien")}>
              Reprendre l&apos;entretien
            </button>
          </p>
        )}
      </Bulle>
      <div className={styles.aVenir}>
        <b>Cette étape arrive au {a.lot}.</b> Ses propositions seront générées pour votre projet ; rien n&apos;est simulé ici.
      </div>
    </>
  );
}

function Recap({ fiche, etat, aller }: { fiche: FichePubliciste; etat: EtatProjet; aller: (id: EtapePubliciste) => void }) {
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
  const manque = (["visuel", "typo", "couleurs", "musique", "voix"] as const).filter((k) => !etat.choix[k]).length;
  return (
    <>
      <Entete n={7} titre="Valider la direction" sous="Vérifiez vos choix. La production ne démarre qu'après votre accord." />
      <Bulle>
        <p>{manque ? `Il reste ${manque === 1 ? "un choix" : `${manque} choix`} à faire avant de valider la direction.` : "Tout est choisi."}</p>
      </Bulle>
      <div className={styles.recap}>
        {ligne("Forme", "entretien", fiche.forme.forme || null, fiche.forme.forme ? (fiche.formeDecidee ? "Décidée à l'entretien" : "Pressentie à l'entretien") : undefined)}
        {ligne("Univers", "visuel", etat.choix.visuel ?? null)}
        {ligne("Lettres", "typo", etat.choix.typo ?? null)}
        {ligne("Couleurs", "couleurs", etat.choix.couleurs ?? null)}
        {ligne("Musique", "musique", etat.choix.musique ?? null)}
        {ligne("Voix", "voix", etat.choix.voix ?? null)}
        {ligne("Storyboard", "storyboard", etat.choix.storyboard ?? null)}
      </div>
      <div className={styles.couts}>
        <b>Ce que coûte la direction artistique</b>
        <div>
          <span>Rien n&apos;a encore été généré pour ce projet.</span>
          <span>0,00 $</span>
        </div>
      </div>
      <div className={styles.actionsRecap}>
        <button type="button" className={[styles.bouton, styles.corail].join(" ")} disabled>
          Valider la direction
        </button>
      </div>
    </>
  );
}
