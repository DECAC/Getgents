/**
 * Moteur déterministe d'« Élysée 2027 ».
 *
 * Entrée : l'historique des messages (utilisateur/assistant), tel que le
 * client l'envoie à chaque tour. Sortie : le texte complet de la réponse,
 * avec son bloc QUESTIONS (choix cliquables, sans option « Autre »).
 *
 * L'état de la partie n'est jamais stocké côté serveur : il est reconstruit
 * en REJOUANT les messages utilisateur dans l'ordre. La fonction est pure —
 * ni horloge, ni hasard, ni appel réseau — donc le même historique produit
 * toujours la même réponse, et les tests la vérifient sans mock.
 */
import { DECISIONS, ORDRE_CANONIQUE, PRIORITE_VERS_DECISION, decisionParId } from "./decisions";
import {
  DIFFICULTES,
  JAUGES,
  SEUILS,
  type Decision,
  type Difficulte,
  type JaugeId,
  type OptionDecision,
} from "./types";

export const MOTEUR_ELYSEE = "elysee-2027";

type TypeFin = "revolution" | "guerre_civile" | "tutelle" | "victoire" | "victoire_mandat" | "bilan_mitige";

interface ChoixJoue {
  decisionId: string;
  optionIndex: number;
  avant: Record<JaugeId, number>;
  apres: Record<JaugeId, number>;
}

interface EtatPartie {
  difficulte: Difficulte;
  duree: number;
  titre: string;
  jauges: Record<JaugeId, number>;
  /** Décisions déjà tranchées (dans l'ordre où elles l'ont été). */
  jouees: string[];
  /** Décision actuellement posée au joueur. */
  enCours: string;
  /** Position de la décision en cours dans ORDRE_CANONIQUE. */
  positionCanon: number;
  /** Tours consécutifs au-dessus des seuils de victoire. */
  serieVictoire: number;
  historique: ChoixJoue[];
  fin: TypeFin | null;
}

interface Message {
  role: string;
  content: string;
}

/* ------------------------------------------------------------------ */
/* Analyse des messages                                                */
/* ------------------------------------------------------------------ */

/** Normalisation pour comparer les libellés sans se soucier de la casse ni des accents. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Assemble des sections de réponse : les vides sont ignorées, les autres
 *  séparées d'une ligne blanche. */
function sections(...parties: (string | null | undefined)[]): string {
  return parties.filter((p): p is string => !!p && p.trim().length > 0).join("\n\n");
}

const RE_DEMARRAGE = /^(demarre une nouvelle partie|nouvelle partie|rejouer)\b/;

function estDemarrage(texte: string): boolean {
  return RE_DEMARRAGE.test(norm(texte));
}

function difficulteDepuis(texte: string, defaut: Difficulte): Difficulte {
  const t = norm(texte);
  if (/\bapaisee\b/.test(t)) return "apaisee";
  if (/\btempete\b/.test(t)) return "tempete";
  if (/\brealiste\b/.test(t)) return "realiste";
  return defaut;
}

function dureeDepuis(texte: string, defaut: number): number {
  const t = norm(texte);
  if (/partie courte|8 tours/.test(t)) return 8;
  if (/mandat complet|15 tours/.test(t)) return 15;
  return defaut;
}

function titreDepuis(texte: string): string {
  const t = norm(texte);
  if (/madame la presidente/.test(t)) return "Madame la Présidente";
  if (/monsieur le president/.test(t)) return "Monsieur le Président";
  return "Président(e)";
}

function prioriteDepuis(texte: string): string | undefined {
  const t = norm(texte);
  for (const [priorite, decisionId] of Object.entries(PRIORITE_VERS_DECISION)) {
    if (t.includes(norm(priorite))) return decisionId;
  }
  return undefined;
}

/** Le texte après la dernière flèche « → » : le libellé de l'option cliquée. */
function libelleReponse(texte: string): string | null {
  const idx = texte.lastIndexOf("→");
  if (idx < 0) return null;
  const label = texte.slice(idx + 1).trim();
  return label.length ? label : null;
}

/* ------------------------------------------------------------------ */
/* État de la partie                                                   */
/* ------------------------------------------------------------------ */

function nouvellePartie(texte: string, precedente: EtatPartie | null): EtatPartie {
  const difficulte = difficulteDepuis(texte, precedente?.difficulte ?? "realiste");
  const duree = dureeDepuis(texte, precedente?.duree ?? 15);
  const titre = titreDepuis(texte);
  const premiere = prioriteDepuis(texte) ?? ORDRE_CANONIQUE[0];
  return {
    difficulte,
    duree,
    titre,
    jauges: { ...DIFFICULTES[difficulte].jauges },
    jouees: [],
    enCours: premiere,
    positionCanon: Math.max(0, ORDRE_CANONIQUE.indexOf(premiere)),
    serieVictoire: 0,
    historique: [],
    fin: null,
  };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function verifierFin(etat: EtatPartie): TypeFin | null {
  const j = etat.jauges;
  if (j.bonheur <= SEUILS.revolution.max) return "revolution";
  if (j.cohesion <= SEUILS.guerreCivile.max) return "guerre_civile";
  if (j.finances <= SEUILS.tutelle.max) return "tutelle";
  if (etat.serieVictoire >= SEUILS.victoire.toursConsecutifs) return "victoire";
  if (etat.historique.length >= etat.duree) {
    return j.bonheur >= SEUILS.victoireFinDeMandat.bonheur ? "victoire_mandat" : "bilan_mitige";
  }
  return null;
}

/**
 * La décision suivante : d'abord le lien `suite` de l'option choisie (l'arbre
 * bifurque), sinon la prochaine décision non jouée de l'ordre canonique, en
 * évitant de servir deux fois de suite la même thématique.
 */
function prochaineDecision(etat: EtatPartie, suite?: string): { id: string; position: number } | null {
  if (suite && !etat.jouees.includes(suite) && decisionParId(suite)) {
    return { id: suite, position: ORDRE_CANONIQUE.indexOf(suite) };
  }
  const themeCourant = decisionParId(etat.enCours)?.theme;
  for (let i = 1; i <= ORDRE_CANONIQUE.length; i++) {
    const position = (etat.positionCanon + i) % ORDRE_CANONIQUE.length;
    const id = ORDRE_CANONIQUE[position];
    if (etat.jouees.includes(id)) continue;
    if (decisionParId(id)?.theme === themeCourant) continue;
    return { id, position };
  }
  return null;
}

function appliquerChoix(etat: EtatPartie, optionIndex: number): ChoixJoue {
  const decision = decisionParId(etat.enCours);
  if (!decision) throw new Error(`Décision inconnue : ${etat.enCours}`);
  const option = decision.options[optionIndex];
  const avant = { ...etat.jauges };
  for (const j of JAUGES) {
    etat.jauges[j.id] = clamp(etat.jauges[j.id] + option.effets[j.id]);
  }
  const choix: ChoixJoue = { decisionId: decision.id, optionIndex, avant, apres: { ...etat.jauges } };
  etat.historique.push(choix);
  etat.jouees.push(decision.id);
  const auDessus =
    etat.jauges.bonheur >= SEUILS.victoire.bonheur && etat.jauges.confiance >= SEUILS.victoire.confiance;
  etat.serieVictoire = auDessus ? etat.serieVictoire + 1 : 0;
  etat.fin = verifierFin(etat);
  if (!etat.fin) {
    const suivante = prochaineDecision(etat, option.suite);
    if (suivante) {
      etat.enCours = suivante.id;
      etat.positionCanon = suivante.position;
    } else {
      // Plus rien à servir (les 50 décisions ont été jouées) : fin de mandat.
      etat.fin = etat.jauges.bonheur >= SEUILS.victoireFinDeMandat.bonheur ? "victoire_mandat" : "bilan_mitige";
    }
  }
  return choix;
}

/* ------------------------------------------------------------------ */
/* Composition des réponses                                            */
/* ------------------------------------------------------------------ */

function blocQuestions(q: string, options: string[]): string {
  return `<!--QUESTIONS: ${JSON.stringify([{ q, options, multi: false, allowOther: false }])}-->`;
}

function fmtDelta(d: number): string {
  if (d > 0) return `+${d}`;
  if (d < 0) return `−${Math.abs(d)}`;
  return "=";
}

function tableauDeBord(etat: EtatPartie, choix?: ChoixJoue): string {
  const tour = Math.min(etat.historique.length + (etat.fin ? 0 : 1), etat.duree);
  const parties = JAUGES.map((j) => {
    const apres = etat.jauges[j.id];
    if (!choix) return `${j.label} ${apres}`;
    const av = choix.avant[j.id];
    return `${j.label} ${av} → ${apres} (${fmtDelta(apres - av)})`;
  });
  return `**Tour ${tour}/${etat.duree}** · ${parties.join(" · ")}`;
}

function alertes(choix: ChoixJoue): string[] {
  const lignes: string[] = [];
  for (const j of JAUGES) {
    const av = choix.avant[j.id];
    const ap = choix.apres[j.id];
    if (ap <= SEUILS.alerteBasse && av > SEUILS.alerteBasse) {
      lignes.push(`⚠ Alerte : ${j.label} tombe à ${ap}/100.`);
    }
    if (ap >= SEUILS.alerteHaute && av < SEUILS.alerteHaute) {
      lignes.push(`✦ Signal positif : ${j.label} atteint ${ap}/100.`);
    }
  }
  return lignes;
}

function blocDecision(decision: Decision): string {
  return [
    `### ${decision.theme} — ${decision.titre}`,
    "",
    decision.situation,
    "",
    `**${decision.question}**`,
    "",
    blocQuestions(decision.question, decision.options.map((o) => o.label)),
  ].join("\n");
}

const CONTEXTE_DIFFICULTE: Record<Difficulte, string> = {
  apaisee: "un pays relativement stable, qui vous fait encore confiance",
  realiste: "un pays tendu, entre attentes et défiance",
  tempete: "un pays ébranlé, où chaque décision sera un combat",
};

function texteOuverture(etat: EtatPartie): string {
  const decision = decisionParId(etat.enCours);
  if (!decision) return texteInvitation();
  return [
    `Bienvenue à l'Élysée, ${etat.titre}. Vous entrez en fonction dans ${CONTEXTE_DIFFICULTE[etat.difficulte]}. ` +
      `Votre mandat se jouera en ${etat.duree} décisions — chacune fera bouger le pays, et les jauges ci-dessous.`,
    "",
    tableauDeBord(etat),
    "",
    blocDecision(decision),
  ].join("\n");
}

const RECITS_FIN: Record<TypeFin, { titre: string; texte: string }> = {
  revolution: {
    titre: "Révolution",
    texte:
      "Le moral du pays s'est effondré. Les manifestations ont grandi semaine après semaine, et plus rien ne tient. " +
      "L'Assemblée vous retire sa confiance : votre mandat s'achève ici.",
  },
  guerre_civile: {
    titre: "Guerre civile",
    texte:
      "La cohésion nationale n'a pas survécu. Les fractures se sont durcies jusqu'à l'affrontement ouvert entre les camps. " +
      "La République se déchire : votre mandat s'achève ici.",
  },
  tutelle: {
    titre: "Mise sous tutelle",
    texte:
      "Les finances du pays sont à bout. Les marchés se sont fermés, Bruxelles a activé la procédure : " +
      "un comité de tutelle budgétaire gouvernera à votre place. Votre mandat s'achève ici.",
  },
  victoire: {
    titre: "Victoire",
    texte:
      "Les Français sont heureux et confiants dans l'avenir — les deux ensemble, et durablement. " +
      "Votre mandat entre dans l'histoire comme celui qui a rendu le pays à lui-même.",
  },
  victoire_mandat: {
    titre: "Mandat réussi",
    texte:
      "Au terme de votre mandat, le bonheur des Français dépasse le seuil que vous vous étiez fixé. " +
      "Le pays va mieux qu'à votre arrivée : les Français vous remercient.",
  },
  bilan_mitige: {
    titre: "Bilan mitigé",
    texte:
      "Le mandat se termine sans triomphe ni catastrophe. Des progrès réels, des occasions manquées : " +
      "les Français jugeront.",
  },
};

function ligneBilan(etat: EtatPartie): string {
  const decisifs = [...etat.historique]
    .sort((a, b) => amplitude(b) - amplitude(a))
    .slice(0, 3)
    .map((c, i) => {
      const d = decisionParId(c.decisionId);
      const o = d?.options[c.optionIndex];
      return d && o ? `${i + 1}. ${d.titre} — « ${o.label} »` : null;
    })
    .filter((l): l is string => !!l);
  if (!decisifs.length) return "";
  return ["**Vos trois décisions décisives :**", ...decisifs].join("\n");
}

function amplitude(c: ChoixJoue): number {
  return JAUGES.reduce((acc, j) => acc + Math.abs(c.apres[j.id] - c.avant[j.id]), 0);
}

function texteFin(etat: EtatPartie, option: OptionDecision, choix: ChoixJoue): string {
  const fin = RECITS_FIN[etat.fin ?? "bilan_mitige"];
  return sections(
    option.consequence,
    [tableauDeBord(etat, choix), ...alertes(choix)].join("\n"),
    `### ${fin.titre}`,
    fin.texte,
    ligneBilan(etat),
    blocQuestions("Une nouvelle partie ?", [
      "Rejouer en mode Apaisée",
      "Rejouer en mode Réaliste",
      "Rejouer en mode Tempête",
    ])
  );
}

function texteRecadrage(etat: EtatPartie): string {
  const decision = decisionParId(etat.enCours);
  if (!decision) return texteInvitation();
  return [
    `Cette simulation se joue par décisions, ${etat.titre} : choisissez l'une des quatre options ci-dessous.`,
    "",
    tableauDeBord(etat),
    "",
    blocDecision(decision),
  ].join("\n");
}

function texteApresFin(etat: EtatPartie): string {
  const fin = RECITS_FIN[etat.fin ?? "bilan_mitige"];
  return [
    `La partie est terminée, ${etat.titre} — issue : ${fin.titre.toLowerCase()}.`,
    "",
    blocQuestions("Une nouvelle partie ?", [
      "Rejouer en mode Apaisée",
      "Rejouer en mode Réaliste",
      "Rejouer en mode Tempête",
    ]),
  ].join("\n");
}

function texteInvitation(): string {
  return [
    "Bienvenue dans « Élysée 2027 » : vous incarnez le président ou la présidente nouvellement élu(e) " +
      "et vous gouvernez par décisions — chaque choix fait bouger cinq jauges du pays, du bonheur aux finances publiques. " +
      "Toutes les situations s'appuient sur des chiffres publics sourcés (Cour des comptes, INSEE, Banque de France).",
    "",
    blocQuestions("Par quoi commencer ?", [
      "Nouvelle partie — Réaliste",
      "Nouvelle partie — Apaisée",
      "Nouvelle partie — Tempête",
    ]),
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Point d'entrée : rejoue l'historique, répond au dernier message     */
/* ------------------------------------------------------------------ */

export function reponseJeuElysee(messages: Message[]): string {
  let etat: EtatPartie | null = null;
  let reponse = texteInvitation();

  for (const m of messages) {
    if (m.role !== "user" || typeof m.content !== "string") continue;
    const texte = m.content;

    if (estDemarrage(texte)) {
      etat = nouvellePartie(texte, etat);
      reponse = texteOuverture(etat);
      continue;
    }
    if (!etat) {
      reponse = texteInvitation();
      continue;
    }
    if (etat.fin) {
      reponse = texteApresFin(etat);
      continue;
    }

    const decision = decisionParId(etat.enCours);
    const libelle = libelleReponse(texte);
    const optionIndex =
      decision && libelle ? decision.options.findIndex((o) => norm(o.label) === norm(libelle)) : -1;

    if (decision && optionIndex >= 0) {
      const option = decision.options[optionIndex];
      const choix = appliquerChoix(etat, optionIndex);
      if (etat.fin) {
        reponse = texteFin(etat, option, choix);
      } else {
        const suivante = decisionParId(etat.enCours);
        reponse = sections(
          option.consequence,
          [tableauDeBord(etat, choix), ...alertes(choix)].join("\n"),
          suivante ? blocDecision(suivante) : null
        );
      }
    } else {
      reponse = texteRecadrage(etat);
    }
  }

  return reponse;
}

/** Exposé pour les tests : nombre de décisions disponibles. */
export function nombreDeDecisions(): number {
  return DECISIONS.length;
}
