import { DECISIONS_A } from "./decisionsA";
import { DECISIONS_B } from "./decisionsB";
import type { Decision } from "./types";

/** Les 50 décisions du jeu, dans l'ordre de rédaction (par thème). */
export const DECISIONS: Decision[] = [...DECISIONS_A, ...DECISIONS_B];

/**
 * Ordre de déroulé par défaut : entrelacé pour ne jamais servir deux fois de
 * suite la même thématique. Les liens `suite` des options font diverger la
 * partie de cet ordre — c'est ce qui en fait un arbre, pas une liste.
 */
export const ORDRE_CANONIQUE: string[] = [
  "sante-maillage",
  "finances-dette",
  "edu-carte",
  "mobilite-rurale",
  "social-natalite",
  "industrie-foncier",
  "logement-attribution",
  "securite-repartition",
  "num-illectronisme",
  "emploi-territoires",
  "environnement-carbone",
  "sante-om",
  "finances-inflation",
  "edu-mixite",
  "territoires-qpv",
  "mobilite-financement",
  "social-pensions",
  "industrie-delais",
  "logement-renovation",
  "securite-prevention",
  "num-fibre",
  "emploi-rsa",
  "finances-croissance",
  "sante-chroniques",
  "edu-cyber",
  "territoires-perequation",
  "mobilite-bornes",
  "social-monoparentalite",
  "industrie-aides",
  "logement-sousoccupation",
  "securite-municipales",
  "num-cuivre",
  "emploi-independants",
  "finances-epargne",
  "sante-deficit",
  "edu-rural",
  "territoires-crte",
  "social-pauvrete",
  "industrie-pme",
  "logement-construction",
  "environnement-foncier",
  "finances-collectivites",
  "sante-ght",
  "territoires-cites",
  "social-sansdomicile",
  "environnement-climat-entreprises",
  "finances-mission",
  "institutions-euro",
  "emploi-comites",
  "institutions-educfi",
];

/**
 * La priorité de mandat choisie au formulaire de départ fixe la PREMIÈRE
 * décision de la partie : deux parties avec des priorités différentes ne
 * commencent pas pareil. Les clés reprennent les options du jumpForm du gent.
 */
export const PRIORITE_VERS_DECISION: Record<string, string> = {
  "Pouvoir d'achat": "finances-inflation",
  "Services publics (santé, école)": "sante-maillage",
  "Transition écologique": "environnement-carbone",
  "Sécurité et cohésion": "securite-repartition",
  "Réindustrialisation et emploi": "industrie-foncier",
  "Redressement des finances publiques": "finances-dette",
};

const INDEX = new Map(DECISIONS.map((d) => [d.id, d]));

export function decisionParId(id: string): Decision | undefined {
  return INDEX.get(id);
}
