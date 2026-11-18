/**
 * Guide « Découvrez ce que vivra votre lecteur » (18/11) — logique PURE.
 *
 * Les étapes se cochent d'après ce qui s'est RÉELLEMENT passé, lu sur la
 * page et son activité : un lien existe, la page a été ouverte (hors
 * visites de l'auteur — d'où la navigation privée), puis, sur une page
 * d'EXEMPLE, l'auteur a RÉPONDU à la question piège (une précision existe :
 * c'est le geste qui montre la valeur du produit, choix de l'éditeur) ; sur
 * une vraie page, une question a été posée.
 */

export interface EtatDecouverte {
  liens: number;
  ouvertures: number;
  questions: number;
  precisions: number;
  assistant: boolean;
  exemple: boolean;
  /** Question dont la page d'exemple ne dit volontairement rien. */
  questionPiege: string | null;
  questionArrivee: boolean;
}

export interface EtapeDecouverte {
  cle: "lien" | "ouverture" | "question";
  titre: string;
  texte: string;
  faite: boolean;
  active: boolean;
}

export function etapesDecouverte(e: EtatDecouverte): EtapeDecouverte[] {
  const lien = e.liens > 0;
  const ouverture = e.ouvertures > 0;
  const question = e.exemple ? e.precisions > 0 : e.questions > 0;
  const brutes: Omit<EtapeDecouverte, "active">[] = [
    {
      cle: "lien",
      titre: "Envoyez-la-vous",
      texte: lien ? "Lien créé." : "Un lien privé à votre adresse : vous serez votre premier lecteur.",
      faite: lien,
    },
    {
      cle: "ouverture",
      titre: "Ouvrez-la comme un lecteur",
      texte: ouverture
        ? "Ouverte : la lecture apparaît dans l'onglet Activité."
        : "En navigation privée : sinon, Getgents vous reconnaît comme l'auteur et ne compte pas la visite.",
      faite: ouverture,
    },
    e.exemple
      ? e.questionArrivee
        ? {
            cle: "question",
            titre: "Répondez à la question",
            texte: question
              ? "Réponse ajoutée : l'assistant s'en servira pour tous vos lecteurs."
              : "La page ne le disait pas : l'assistant l'a dit au lecteur. Ajoutez la réponse, il s'en servira pour tous.",
            faite: question,
          }
        : {
            cle: "question",
            titre: "Posez-lui une question",
            texte: `Depuis le lien, demandez à l'assistant de la page : « ${e.questionPiege ?? "une question"} »`,
            faite: false,
          }
      : {
          cle: "question",
          titre: "Posez-lui une question",
          texte: question
            ? "Question reçue : elle apparaît dans l'onglet Assistant."
            : e.assistant
              ? "Depuis le lien, posez une question à l'assistant de la page."
              : "Activez l'assistant (onglet Assistant), puis posez-lui une question depuis le lien.",
          faite: question,
        },
  ];
  const premiere = brutes.findIndex((x) => !x.faite);
  return brutes.map((x, i) => ({ ...x, active: i === premiere }));
}
