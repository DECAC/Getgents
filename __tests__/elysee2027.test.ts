import * as fs from "fs";
import * as path from "path";
import { DECISIONS, ORDRE_CANONIQUE, PRIORITE_VERS_DECISION, decisionParId } from "@/lib/elysee2027/decisions";
import { reponseJeuElysee,
  normaliserReponse,
  LIBELLE_SUITE,
} from "@/lib/elysee2027/moteur";
import { AMPLITUDE_MAX, DIFFICULTES, JAUGES, SEUILS } from "@/lib/elysee2027/types";
import { extractQuestions } from "@/lib/suggestions";
import { extractEtatJeu } from "@/lib/jeuEtat";
import { ESPACES } from "@/lib/mock-data/espaces";
import { GENT_DRAFTS } from "@/lib/mock-data/builder";

/* ------------------------------------------------------------------ */
/* Les données : 50 décisions valides et sourcées                      */
/* ------------------------------------------------------------------ */

describe("elysee2027 — données", () => {
  test("50 décisions, identifiants uniques", () => {
    expect(DECISIONS).toHaveLength(50);
    expect(new Set(DECISIONS.map((d) => d.id)).size).toBe(50);
  });

  test("l'ordre canonique couvre les 50 décisions une seule fois", () => {
    expect(ORDRE_CANONIQUE).toHaveLength(50);
    expect(new Set(ORDRE_CANONIQUE).size).toBe(50);
    for (const id of ORDRE_CANONIQUE) expect(decisionParId(id)).toBeDefined();
  });

  test("l'ordre canonique ne sert jamais deux fois la même thématique de suite", () => {
    for (let i = 1; i < ORDRE_CANONIQUE.length; i++) {
      const avant = decisionParId(ORDRE_CANONIQUE[i - 1]);
      const apres = decisionParId(ORDRE_CANONIQUE[i]);
      expect(avant && apres && avant.theme === apres.theme).toBe(false);
    }
  });

  test("toute décision d'ouverture est mise en scène, et la mise en scène reste facultative", () => {
    // Chaque priorité du formulaire de départ fixe la première décision de la
    // partie : ces décisions-là sont les seules que TOUT joueur voit. Ce sont
    // donc elles qu'on habille en premier, et le test le garde.
    for (const id of Object.values(PRIORITE_VERS_DECISION)) {
      const d = decisionParId(id)!;
      expect(d.lieu).toBeTruthy();
      expect(d.urgence).toBeTruthy();
      expect(d.scenette).toBeTruthy();
      for (const o of d.options) {
        expect(o.une).toBeTruthy();
        expect(o.reaction).toBeTruthy();
      }
    }
    // Et l'inverse : le jeu doit rester jouable sans mise en scène, sinon les
    // décisions non encore habillées casseraient la partie.
    expect(DECISIONS.some((d) => !d.scenette)).toBe(true);
  });

  test("la mise en scène n'invente ni chiffre, ni personne, ni journal réel", () => {
    /*
     * Trois règles, et elles ne sont pas décoratives :
     *  — les chiffres vivent dans `situation`, où un autre test exige leur
     *    source ; un chiffre glissé dans du récit échapperait à ce contrôle ;
     *  — un conseiller est une FONCTION, jamais une personne réelle : le jeu
     *    ne met pas de mots dans la bouche de quelqu'un ;
     *  — le quotidien cité est INVENTÉ : prêter une une à un vrai journal
     *    serait lui faire écrire ce qu'il n'a pas écrit.
     */
    const QUOTIDIENS_REELS = /le monde|le figaro|liberation|libération|les echos|les échos|la croix|l'?humanite|l'?humanité|le parisien|ouest-france|mediapart|le point|l'?express|marianne/i;
    const recits = DECISIONS.flatMap((d) => [
      ...(d.scenette ? [d.scenette] : []),
      ...d.options.flatMap((o) => [...(o.une ? [o.une] : []), ...(o.reaction ? [o.reaction] : [])]),
    ]);
    expect(recits.length).toBeGreaterThan(0);
    for (const texte of recits) {
      // « 7 h 40 » et « 20 minutes » vivent dans `lieu`/`urgence`, pas ici.
      expect(texte).not.toMatch(/\d/);
      expect(texte).not.toMatch(QUOTIDIENS_REELS);
    }
  });

  test("chaque décision a exactement 4 options aux libellés distincts", () => {
    for (const d of DECISIONS) {
      expect(d.options).toHaveLength(4);
      // Normalisés AVEC la règle du moteur, pas avec une approximation :
      // `trim().toLowerCase()` laissait passer deux libellés ne différant que
      // par un accent ou une espace double. Le moteur, lui, les confond — et
      // `findIndex` retiendrait silencieusement le premier.
      const labels = d.options.map((o) => normaliserReponse(o.label));
      expect(new Set(labels).size).toBe(4);
      for (const o of d.options) {
        expect(o.label.length).toBeGreaterThan(0);
        expect(o.consequence.length).toBeGreaterThan(40);
      }
    }
  });

  test("chaque situation cite une source et un millésime", () => {
    const sourceRe = /\((Cour des comptes|INSEE|Insee|Banque de France)[^)]*\d{4}[^)]*\)/;
    for (const d of DECISIONS) {
      expect(sourceRe.test(d.situation)).toBe(true);
    }
  });

  test("chaque option influe sur les 5 jauges, dans la borne ±12", () => {
    const cles = JAUGES.map((j) => j.id).sort();
    for (const d of DECISIONS) {
      for (const o of d.options) {
        expect(Object.keys(o.effets).sort()).toEqual(cles);
        for (const j of JAUGES) {
          const v = o.effets[j.id];
          expect(Number.isInteger(v)).toBe(true);
          expect(Math.abs(v)).toBeLessThanOrEqual(AMPLITUDE_MAX);
        }
      }
    }
  });

  test("les liens « suite » et les priorités pointent vers des décisions existantes", () => {
    for (const d of DECISIONS) {
      for (const o of d.options) {
        if (o.suite) expect(decisionParId(o.suite)).toBeDefined();
      }
    }
    for (const id of Object.values(PRIORITE_VERS_DECISION)) {
      expect(decisionParId(id)).toBeDefined();
    }
  });

  test("le moteur et ses données n'importent aucun module de facturation LLM", () => {
    // Discipline : ce dossier est débranché d'OpenRouter PAR CONSTRUCTION —
    // le test interdit toute dépendance de code vers la clé ou le fournisseur.
    const dossier = path.join(__dirname, "..", "lib", "elysee2027");
    for (const f of fs.readdirSync(dossier).filter((f) => f.endsWith(".ts"))) {
      const source = fs.readFileSync(path.join(dossier, f), "utf8");
      expect(/from\s+["'][^"']*openRouter/i.test(source)).toBe(false);
      expect(/openrouter\.ai/i.test(source)).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Le moteur : déroulé de partie                                       */
/* ------------------------------------------------------------------ */

const DEMARRAGE_COURT_REALISTE =
  "Démarre une nouvelle partie. Difficulté : Réaliste. Priorité affichée de mon mandat : Pouvoir d'achat. Format : Partie courte (8 tours). Appelle-moi Madame la Présidente.";

const DEMARRAGE_COURT_TEMPETE =
  "Démarre une nouvelle partie. Difficulté : Tempête. Priorité affichée de mon mandat : Pouvoir d'achat. Format : Partie courte (8 tours). Appelle-moi Monsieur le Président.";

interface Msg {
  role: string;
  content: string;
}

/** Extrait la question posée par une réponse du moteur. */
function questionEnCours(reponse: string) {
  const { questions } = extractQuestions(reponse);
  expect(questions).toHaveLength(1);
  return questions[0];
}

/** Répond à la question posée, quelle qu'elle soit, et renvoie la réponse. */
function repondre(messages: Msg[], q: { q: string }, libelle: string): string {
  messages.push({ role: "user", content: `${q.q} → ${libelle}` });
  return reponseJeuElysee(messages);
}

/**
 * Joue un tour COMPLET : tranche la décision, puis lève la pause d'après-choix.
 *
 * Le tour se joue en deux temps depuis la mise en scène — la conséquence
 * d'abord, la question suivante seulement quand le joueur la demande. Le
 * harnais franchit les deux, pour que les tests existants continuent de
 * décrire ce qu'ils décrivaient : un tour de jeu.
 */
function jouerTour(messages: Msg[], strategie: (d: (typeof DECISIONS)[number]) => number): string {
  const reponsePrecedente = reponseJeuElysee(messages);
  const q = questionEnCours(reponsePrecedente);
  const decision = DECISIONS.find((d) => d.question === q.q);
  if (!decision) throw new Error(`Question introuvable : ${q.q}`);
  const idx = strategie(decision);
  const apresChoix = repondre(messages, q, decision.options[idx].label);
  // Fin de partie : pas de pause, le bilan est déjà la réponse.
  const suite = questionEnCours(apresChoix);
  if (suite.options.length !== 1 || suite.options[0] !== LIBELLE_SUITE) return apresChoix;
  return repondre(messages, suite, LIBELLE_SUITE);
}

/** Joue jusqu'à une fin de partie (ou 50 tours), renvoie la dernière réponse. */
function jouerJusquaFin(
  messages: Msg[],
  strategie: (d: (typeof DECISIONS)[number]) => number
): string {
  const FINS = ["### Révolution", "### Guerre civile", "### Mise sous tutelle", "### Victoire", "### Mandat réussi", "### Bilan mitigé"];
  let reponse = reponseJeuElysee(messages);
  for (let i = 0; i < 50 && !FINS.some((f) => reponse.includes(f)); i++) {
    reponse = jouerTour(messages, strategie);
  }
  return reponse;
}

/** La ligne « **Tour 3/8** · Bonheur 45 → 41 (−4) · … » d'une réponse. */
function ligneTableauDeBord(reponse: string): string {
  const ligne = reponse.split("\n").find((l) => l.startsWith("**Tour "));
  expect(ligne).toBeDefined();
  return ligne!;
}

/** Jauges affichées au tableau de bord d'une réponse (valeurs après variation). */
function jaugesAffichees(reponse: string): number[] {
  const ligne = ligneTableauDeBord(reponse);
  const sansEnteteNiDeltas = ligne.replace(/\*\*Tour \d+\/\d+\*\*/g, "").replace(/\([^)]*\)/g, "");
  return Array.from(sansEnteteNiDeltas.matchAll(/(\d+)(?:\s*→\s*(\d+))?/g)).map((m) => Number(m[2] ?? m[1]));
}

const optionMinimisant = (jauge: (typeof JAUGES)[number]["id"]) =>
  (d: (typeof DECISIONS)[number]) => {
    let pire = 0;
    d.options.forEach((o, idx) => {
      if (o.effets[jauge] < d.options[pire].effets[jauge]) pire = idx;
    });
    return pire;
  };

describe("elysee2027 — moteur", () => {
  /*
   * Régression : `prochaineDecision` évitait de servir deux fois la même
   * thématique de suite — en UNE passe. Si toutes les décisions non jouées
   * restantes partageaient le thème courant, la boucle s'épuisait, renvoyait
   * `null`, et le moteur clôturait le mandat AVANT son terme, sans trace.
   *
   * Honnêteté sur la portée : avec 50 décisions, 13 thèmes et un mandat
   * plafonné à 15 tours, cette branche précise n'est pas atteignable par l'API
   * publique — ce test ne l'exerce donc PAS. Il garde la propriété générale
   * dont elle relève : un mandat va jusqu'à son terme annoncé. Il mordrait si
   * le jeu de décisions se réduisait ou si la durée augmentait, c'est-à-dire
   * exactement dans les conditions qui rendraient le défaut réel.
   */
  test("un mandat complet va jusqu'à son terme, jamais faute de décision à servir", () => {
    const messages: Msg[] = [{
      role: "user",
      content: "Démarre une nouvelle partie. Difficulté : Réaliste. Priorité affichée de mon mandat : Pouvoir d'achat. Format : Mandat complet (15 tours). Appelle-moi Madame la Présidente.",
    }];
    // Stratégie médiane : on cherche à ne déclencher aucune fin par effondrement,
    // pour que seul le terme du mandat puisse conclure la partie.
    const reponse = jouerJusquaFin(messages, (d) => {
      let meilleure = 0;
      d.options.forEach((o, i) => {
        const somme = (x: typeof o) => Object.values(x.effets).reduce((a, b) => a + b, 0);
        if (somme(o) > somme(d.options[meilleure])) meilleure = i;
      });
      return meilleure;
    });
    expect(reponse).toMatch(/### (Victoire|Mandat réussi|Bilan mitigé)/);
    // La partie n'a pas pu se clore avant le tour 15 par manque de décision.
    expect(reponse).not.toContain("Tour 14/15");
  });

  test("le démarrage ouvre une partie : tour 1/8, jauges Réaliste, 4 options sans « Autre »", () => {
    const reponse = reponseJeuElysee([{ role: "user", content: DEMARRAGE_COURT_REALISTE }]);
    expect(reponse).toContain("Tour 1/8");
    expect(reponse).toContain("Madame la Présidente");
    // Priorité « Pouvoir d'achat » → la première décision est l'inflation.
    expect(reponse).toContain("Économie — L'inflation est revenue");
    const q = questionEnCours(reponse);
    expect(q.options).toHaveLength(4);
    expect(q.allowOther).toBe(false);
    expect(reponse).toContain(`Bonheur ${DIFFICULTES.realiste.jauges.bonheur}`);
  });

  test("une réponse applique exactement les effets de l'option choisie", () => {
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_REALISTE }];
    const premiere = questionEnCours(reponseJeuElysee(messages));
    const decision = DECISIONS.find((d) => d.question === premiere.q)!;
    // « Conserver la marge » : bonheur −1, confiance +1, pouvoir d'achat 0, finances +2, cohésion 0.
    const pause = repondre(messages, premiere, decision.options[2].label);
    expect(pause).toContain("Bonheur 45 → 44");
    expect(pause).toContain("Confiance 38 → 39");
    expect(pause).toContain("Finances 35 → 37");

    // La suite ne vient qu'à la demande — et elle repart de l'état atteint.
    const suite = repondre(messages, questionEnCours(pause), LIBELLE_SUITE);
    expect(suite).toContain("Tour 2/8");
    expect(questionEnCours(suite).allowOther).toBe(false);
  });

  test("la pause d'après-choix ne sert pas la question suivante", () => {
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_REALISTE }];
    const premiere = questionEnCours(reponseJeuElysee(messages));
    const decision = DECISIONS.find((d) => d.question === premiere.q)!;
    const pause = repondre(messages, premiere, decision.options[0].label);

    // Une seule action possible : demander la suite.
    const q = questionEnCours(pause);
    expect(q.options).toEqual([LIBELLE_SUITE]);
    expect(pause).toContain(decision.options[0].consequence);
    // Et surtout : aucune décision servie sous la conséquence.
    expect(pause).not.toContain("###");
  });

  test("pendant la pause, un libellé de la décision suivante ne tranche rien", () => {
    /*
     * Le piège que ce test garde : `enCours` désigne DÉJÀ la décision
     * suivante pendant la pause. Si le moteur appariait les libellés à ce
     * moment-là, un clic en retard — ou un bouton resté à l'écran —
     * trancherait une décision que le joueur n'a jamais lue, sans erreur.
     */
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_REALISTE }];
    const premiere = questionEnCours(reponseJeuElysee(messages));
    const decision = DECISIONS.find((d) => d.question === premiere.q)!;
    repondre(messages, premiere, decision.options[0].label);

    // On identifie la décision suivante en levant la pause sur une COPIE.
    const leverLaPause = (fil: Msg[]) =>
      reponseJeuElysee([...fil, { role: "user", content: `Poursuivre ? → ${LIBELLE_SUITE}` }]);
    const attendue = questionEnCours(leverLaPause(messages)).q;

    // Puis on clique le libellé de cette décision AVANT d'avoir demandé la suite.
    const suivante = DECISIONS.find((d) => d.question === attendue)!;
    const egare = repondre(messages, { q: "Poursuivre ?" }, suivante.options[0].label);
    expect(questionEnCours(egare).options).toEqual([LIBELLE_SUITE]);

    // Rien n'a été tranché : la suite sert toujours la MÊME décision.
    expect(questionEnCours(leverLaPause(messages)).q).toBe(attendue);
  });

  test("le moteur est déterministe : même historique, même réponse", () => {
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_REALISTE }];
    jouerTour(messages, () => 0);
    expect(reponseJeuElysee(messages)).toBe(reponseJeuElysee(messages));
  });

  test("une réponse libre recadre sans faire avancer la partie", () => {
    const messages: Msg[] = [
      { role: "user", content: DEMARRAGE_COURT_REALISTE },
      { role: "user", content: "Je veux tout nationaliser, et vite." },
    ];
    const reponse = reponseJeuElysee(messages);
    expect(reponse).toContain("quatre options");
    expect(reponse).toContain("Tour 1/8");
    expect(questionEnCours(reponse).q).toContain("marge de manœuvre");
  });

  test("en Tempête, creuser les finances finit en Mise sous tutelle", () => {
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_TEMPETE }];
    const reponse = jouerJusquaFin(messages, optionMinimisant("finances"));
    expect(reponse).toContain("### Mise sous tutelle");
    expect(reponse).toContain("Rejouer en mode");
    expect(questionEnCours(reponse).allowOther).toBe(false);
  });

  test("une partie courte se termine au plus tard après 8 décisions, avec bilan", () => {
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_REALISTE }];
    const reponse = jouerJusquaFin(messages, () => 0);
    const FINS = ["### Révolution", "### Guerre civile", "### Mise sous tutelle", "### Victoire", "### Mandat réussi", "### Bilan mitigé"];
    expect(FINS.some((f) => reponse.includes(f))).toBe(true);
    expect(reponse).toContain("Vos trois décisions décisives");
  });

  test("les jauges affichées restent toujours entre 0 et 100", () => {
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_REALISTE }];
    let reponse = reponseJeuElysee(messages);
    for (let i = 0; i < 8; i++) {
      for (const v of jaugesAffichees(reponse)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      if (reponse.includes("Rejouer en mode")) break;
      reponse = jouerTour(messages, () => 3);
    }
  });

  test("rejouer après une fin repart à zéro avec la nouvelle difficulté", () => {
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_TEMPETE }];
    jouerJusquaFin(messages, optionMinimisant("finances"));
    messages.push({ role: "user", content: "Rejouer en mode Apaisée" });
    const relance = reponseJeuElysee(messages);
    expect(relance).toContain("Tour 1/8"); // le format court est conservé
    expect(relance).toContain(`Bonheur ${DIFFICULTES.apaisee.jauges.bonheur}`);
  });

  test("sans message de démarrage, le moteur propose de commencer", () => {
    const reponse = reponseJeuElysee([{ role: "user", content: "Bonjour, c'est quoi ce gent ?" }]);
    expect(reponse).toContain("Nouvelle partie");
    expect(questionEnCours(reponse).allowOther).toBe(false);
  });

  test("les deux gents « Élysée » cohabitent, et un seul porte le moteur", () => {
    // Les deux versions sont gardées côte à côte POUR ÊTRE COMPARÉES : le même
    // jeu tenu par un modèle d'un côté, par du code de l'autre.
    //
    // `moteurJeu` est le SEUL bit qui décide du chemin de chat (`/api/chat` et
    // la route du lien de partage testent l'égalité stricte). Le poser sur le
    // gent génératif le couperait de son modèle ; l'oublier sur le
    // déterministe le renverrait vers OpenRouter avec un prompt qui n'a jamais
    // servi. Dans les deux cas, aucune erreur — juste un jeu qui n'est plus
    // celui qu'on croit.
    const generatif = GENT_DRAFTS["elysee-2027"];
    const deterministe = GENT_DRAFTS["elysee-2027-deterministe"];
    expect(generatif).toBeDefined();
    expect(deterministe).toBeDefined();
    expect(generatif.moteurJeu).toBeUndefined();
    expect(deterministe.moteurJeu).toBe("elysee-2027");
    expect(generatif.name).not.toBe(deterministe.name);
    // Deux gents ne peuvent pas partager l'identifiant de leur formulaire.
    expect(generatif.jumpForm?.id).not.toBe(deterministe.jumpForm?.id);
  });

  test("l'espace de démonstration existe et est branché sur le moteur", () => {
    // /espace/elysee-2027-deterministe doit se charger SANS serveur : l'espace
    // vient du catalogue statique, dérivé du brouillon du studio.
    const espace = ESPACES["elysee-2027-deterministe"];
    expect(espace).toBeDefined();
    expect(espace.moteurJeu).toBe("elysee-2027");
    expect(espace.jumpForm?.fields.length).toBeGreaterThan(0);
    expect(espace.conversations.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* L'état exposé à l'interface (bandeau de jauges)                     */
/* ------------------------------------------------------------------ */

describe("elysee2027 — état pour l'interface", () => {
  test("chaque réponse d'une partie porte un état lisible par le code", () => {
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_REALISTE }];
    const { text, etat } = extractEtatJeu(reponseJeuElysee(messages));
    expect(etat).not.toBeNull();
    expect(etat!.moteur).toBe("elysee-2027");
    expect(etat!.tour).toBe(1);
    expect(etat!.duree).toBe(8);
    expect(etat!.difficulte).toBe("realiste");
    expect(etat!.titre).toBe("Madame la Présidente");
    expect(etat!.jauges).toEqual(DIFFICULTES.realiste.jauges);
    // Aucune variation au premier affichage : rien n'a encore été décidé.
    expect(etat!.deltas).toBeUndefined();
    expect(etat!.derniers).toEqual([]);
    // Et le bloc ne se voit pas dans le texte lu par le joueur.
    expect(text).not.toMatch(/ETAT_JEU/);
    expect(text).toContain("Tour 1/8");
  });

  test("l'état et le tableau de bord textuel annoncent les MÊMES valeurs", () => {
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_REALISTE }];
    for (let i = 0; i < 6; i++) {
      const reponse = jouerTour(messages, (d) => i % 4);
      const { etat } = extractEtatJeu(reponse);
      expect(etat).not.toBeNull();
      const affichees = jaugesAffichees(reponse);
      expect(JAUGES.map((j) => etat!.jauges[j.id])).toEqual(affichees);
      const ligne = ligneTableauDeBord(reponse);
      expect(ligne).toContain(`Tour ${etat!.tour}/${etat!.duree}`);
      if (reponse.includes("Rejouer en mode")) break;
    }
  });

  test("après une décision, l'état porte la variation de chaque jauge", () => {
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_REALISTE }];
    // Option 2 de la décision d'inflation : bonheur −1, confiance +1, finances +2.
    const { etat } = extractEtatJeu(jouerTour(messages, () => 2));
    expect(etat!.deltas).toEqual({
      bonheur: -1,
      confiance: 1,
      pouvoirAchat: 0,
      finances: 2,
      cohesion: 0,
    });
    expect(etat!.jauges.bonheur).toBe(DIFFICULTES.realiste.jauges.bonheur - 1);
    expect(etat!.derniers).toHaveLength(1);
    expect(etat!.derniers[0]).toMatchObject({ tour: 1, titre: expect.any(String) });
  });

  test("les trois derniers tours sont rappelés, du plus récent au plus ancien", () => {
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_REALISTE }];
    let reponse = "";
    for (let i = 0; i < 4; i++) reponse = jouerTour(messages, () => 1);
    const { etat } = extractEtatJeu(reponse);
    expect(etat!.derniers).toHaveLength(3);
    expect(etat!.derniers.map((t) => t.tour)).toEqual([4, 3, 2]);
    for (const t of etat!.derniers) expect(t.choix.length).toBeGreaterThan(0);
  });

  test("un recadrage n'invente aucune variation", () => {
    const messages: Msg[] = [
      { role: "user", content: DEMARRAGE_COURT_REALISTE },
      { role: "user", content: "Je gouverne par ordonnances." },
    ];
    const { etat } = extractEtatJeu(reponseJeuElysee(messages));
    expect(etat!.deltas).toBeUndefined();
    expect(etat!.tour).toBe(1);
  });

  test("la fin de partie est annoncée dans l'état, pas seulement dans le texte", () => {
    const messages: Msg[] = [{ role: "user", content: DEMARRAGE_COURT_TEMPETE }];
    const reponse = jouerJusquaFin(messages, optionMinimisant("finances"));
    const { etat } = extractEtatJeu(reponse);
    expect(etat!.fin).toBe("tutelle");
    expect(etat!.finTitre).toBe("Mise sous tutelle");
    expect(etat!.jauges.finances).toBeLessThanOrEqual(SEUILS.tutelle.max);
  });

  test("tant qu'aucune partie n'est lancée, aucun état n'est émis", () => {
    const { etat } = extractEtatJeu(reponseJeuElysee([{ role: "user", content: "C'est quoi ce jeu ?" }]));
    expect(etat).toBeNull();
  });

  test("le chemin sans quota exige l'identifiant EXACT du moteur", () => {
    // Discipline de facturation : une condition sur la simple présence du
    // champ `jeu` ouvrait une sortie du compteur LLM (voir app/api/chat).
    const route = fs.readFileSync(path.join(__dirname, "..", "app", "api", "chat", "route.ts"), "utf8");
    expect(route).toMatch(/body\.jeu === MOTEUR_ELYSEE/);
    expect(route).not.toMatch(/if \(body\.jeu\)/);
  });
});
