import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Aucune route ne doit repartir sans garde.
 *
 * Ce test ne vérifie pas une logique, il vérifie une DISCIPLINE : le défaut
 * d'origine n'était pas une garde mal écrite, c'était treize routes qui n'en
 * avaient aucune — dont `/api/chat`, par où passait l'exfiltration de
 * l'environnement serveur. Le risque n'est pas qu'une garde soit cassée, c'est
 * qu'une route future soit ajoutée sans y penser.
 *
 * Toute nouvelle route doit donc soit appeler une garde connue, soit être
 * inscrite ci-dessous avec la raison de son ouverture.
 */

const GARDES = [
  "requireUser",
  "requireUserWithQuota",
  "requireGentAccess",
  "requireGentOrDraftAccess",
  "requireDraftOwner",
  "checkCronSecret",
];

/** Routes publiques PAR NATURE, chacune avec sa justification. */
const OUVERTES: Record<string, string> = {
  "app/api/auth/bootstrap/route.ts": "appelle requireUser (détecté par le motif générique)",
  "app/api/links/[token]/route.ts": "révocation — garde par requireUser + requireGentAccess",
  "app/api/links/[token]/chat/route.ts": "authentifiée par le jeton du lien",
  "app/api/links/[token]/refresh/route.ts": "authentifiée par le jeton du lien",
  "app/api/links/[token]/starters/route.ts": "authentifiée par le jeton du lien",
  "app/api/gmail/callback/route.ts": "atterrissage OAuth Google — état signé + requireUser",
  "app/api/whatsapp/webhook/route.ts": "webhook Meta — vérifié par WHATSAPP_VERIFY_TOKEN",
  "app/api/powens/connect/route.ts": "redirection vers la webview bancaire, sans donnée du compte",
  // Salon collaboratif : mêmes règles que /l/<jeton>. Le jeton du lien fait
  // l'authentification (resolveCollabLink + canChat), puis l'identité du
  // participant est vérifiée dans la session — 401 sans elle, 403 si elle est
  // inconnue. Un compte n'y est jamais demandé : c'est le principe même du
  // salon, où les invités entrent avec leur seul prénom.
  "app/api/collab/[token]/join/route.ts": "authentifiée par le jeton du salon",
  "app/api/collab/[token]/messages/route.ts": "jeton du salon + identité du participant",
  "app/api/collab/[token]/state/route.ts": "jeton du salon + identité du participant",
};

function routes(dir: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dir)) {
    const chemin = join(dir, entree);
    if (statSync(chemin).isDirectory()) routes(chemin, acc);
    else if (entree === "route.ts") acc.push(chemin);
  }
  return acc;
}

describe("gardes des routes API", () => {
  const fichiers = routes("app/api");

  it("trouve bien toutes les routes du projet", () => {
    expect(fichiers.length).toBeGreaterThan(15);
  });

  it("n'en laisse aucune sans garde ni justification", () => {
    const sansGarde = fichiers.filter((f) => {
      if (OUVERTES[f]) return false;
      const src = readFileSync(f, "utf8");
      return !GARDES.some((g) => src.includes(g));
    });
    expect(sansGarde).toEqual([]);
  });

  it("ne garde aucune trace de l'ancien secret d'instance", () => {
    // `checkAppAccess` acceptait un secret unique et partagé, distribué à tout
    // visiteur par le middleware, et ne disait rien du PROPRIÉTAIRE du gent.
    for (const f of fichiers) {
      expect(readFileSync(f, "utf8")).not.toContain("checkAppAccess");
    }
  });

  it("n'a pas de justification d'ouverture devenue caduque", () => {
    // Une entrée qui ne correspond plus à aucun fichier signale une route
    // renommée ou supprimée : la liste doit rester une décision vivante.
    for (const f of Object.keys(OUVERTES)) {
      expect(fichiers).toContain(f);
    }
  });
});
