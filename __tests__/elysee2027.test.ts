import * as fs from "fs";
import * as path from "path";
import { DECISIONS, ORDRE_CANONIQUE, PRIORITE_VERS_DECISION, decisionParId } from "@/lib/elysee2027/decisions";
import { reponseJeuElysee } from "@/lib/elysee2027/moteur";
import { AMPLITUDE_MAX, DIFFICULTES, JAUGES } from "@/lib/elysee2027/types";
import { extractQuestions } from "@/lib/suggestions";

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

  test("chaque décision a exactement 4 options aux libellés distincts", () => {
    for (const d of DECISIONS) {
      expect(d.options).toHaveLength(4);
      const labels = d.options.map((o) => o.label.trim().toLowerCase());
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

/** Joue un tour : choisit l'option selon `strategie` et renvoie la réponse. */
function jouerTour(messages: Msg[], strategie: (d: (typeof DECISIONS)[number]) => number): string {
  const reponsePrecedente = reponseJeuElysee(messages);
  const q = questionEnCours(reponsePrecedente);
  const decision = DECISIONS.find((d) => d.question === q.q);
  if (!decision) throw new Error(`Question introuvable : ${q.q}`);
  const idx = strategie(decision);
  messages.push({ role: "user", content: `${q.q} → ${decision.options[idx].label}` });
  return reponseJeuElysee(messages);
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

/** Jauges affichées au tableau de bord d'une réponse (valeurs après variation). */
function jaugesAffichees(reponse: string): number[] {
  const ligne = reponse.split("\n").find((l) => l.startsWith("**Tour "));
  expect(ligne).toBeDefined();
  const sansEnteteNiDeltas = ligne!.replace(/\*\*Tour \d+\/\d+\*\*/g, "").replace(/\([^)]*\)/g, "");
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
    // « Conserver la marge » : bonheur −1, confiance +1, pouvoir d'achat 0, finances +2, cohésion 0.
    const reponse = jouerTour(messages, () => 2);
    expect(reponse).toContain("Tour 2/8");
    expect(reponse).toContain("Bonheur 45 → 44");
    expect(reponse).toContain("Confiance 38 → 39");
    expect(reponse).toContain("Finances 35 → 37");
    expect(questionEnCours(reponse).allowOther).toBe(false);
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
});
