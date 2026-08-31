/**
 * Variables d'environnement qu'un connecteur a le droit de lire.
 *
 * Un connecteur « API REST » peut noter sa clé `env:NOM_DE_VARIABLE` pour la
 * garder côté serveur — bonne idée, mais `resolveSecretInfo` faisait
 * `process.env[nom]` avec un NOM VENANT DU CLIENT, sans aucune restriction.
 * La configuration du connecteur étant acceptée par `POST /api/chat` (route
 * sans garde), n'importe qui pouvait déclarer un connecteur pointant sur son
 * propre serveur, avec `value: "env:SUPABASE_SERVICE_ROLE_KEY"`, et recevoir
 * la clé d'administration de la base. Idem pour la clé OpenRouter ou le
 * secret Google.
 *
 * Le principe retenu est une liste blanche fermée : seules les variables
 * DESTINÉES aux connecteurs sont lisibles. Tout le reste de l'environnement
 * est hors de portée, y compris les variables ajoutées plus tard — c'est le
 * sens d'une liste blanche, et c'est pourquoi elle est préférable à une liste
 * de variables interdites, qu'il aurait fallu penser à compléter à chaque fois.
 *
 * Module PUR (hors lecture de `process.env` dans `readConnectorEnv`), testable.
 */

/**
 * Clés d'API tierces utilisables depuis un connecteur configuré dans le
 * studio. Pour en ajouter une, il faut la nommer ici : c'est délibérément un
 * geste explicite.
 */
export const CONNECTOR_ENV_ALLOWLIST: readonly string[] = [
  "SERPAPI_KEY",
  "PRIM_API_KEY",
];

export function isAllowedEnvName(name: string): boolean {
  // Comparaison exacte, sensible à la casse : `serpapi_key` n'est pas
  // `SERPAPI_KEY`, et accepter les variantes rouvrirait la porte aux noms
  // approchants (`OPENROUTER_API_KEY ` avec une espace, par exemple).
  return CONNECTOR_ENV_ALLOWLIST.includes(name);
}

/** Message de refus destiné au créateur : il doit dire quoi faire. */
export function envRefusalMessage(name: string): string {
  return (
    `La variable « ${name} » n'est pas accessible depuis un connecteur. ` +
    `Seules ${CONNECTOR_ENV_ALLOWLIST.join(", ")} le sont. ` +
    `Saisissez la clé directement dans le champ « Clé d'API » du connecteur, ` +
    `ou demandez l'ajout de cette variable à la liste autorisée.`
  );
}

/** Lecture effective — renvoie null si le nom n'est pas autorisé. */
export function readConnectorEnv(name: string): string | null {
  if (!isAllowedEnvName(name)) return null;
  return process.env[name] ?? "";
}
