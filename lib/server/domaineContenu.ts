import { createHmac } from "crypto";
import { signerAdresse, type ObjetContenu } from "@/lib/adresseSignee";
import { CHEMIN_CONTENU, lireDomaineContenu, origineAppValide, type DomaineContenu } from "@/lib/domaineContenu";

/** Le domaine de contenu configuré (`DOMAINE_CONTENU`), ou null : tout reste sur getgents.ai. */
export function domaineContenu(): DomaineContenu | null {
  return lireDomaineContenu(process.env.DOMAINE_CONTENU);
}

/** Clé des adresses signées, dérivée de SECRET_BOX_KEY (déjà requise en production). */
export function cleContenu(): string {
  const base = process.env.SECRET_BOX_KEY;
  if (base) return createHmac("sha256", base).update("getgents:domaine-contenu").digest("hex");
  return process.env.NODE_ENV === "production" ? "" : "cle-contenu-developpement";
}

/** Origine de l'application qui signe : celle de la requête reçue (getgents.ai, ou localhost en développement). */
export function origineApp(req: Request): string | null {
  const o = new URL(req.url).origin;
  return origineAppValide(o) ? o : null;
}

/**
 * Redirige le cadre vers le domaine de contenu, ou null s'il n'est pas
 * configuré (la route sert alors le document elle-même, comme avant).
 * 307 pour un brouillon : le navigateur y reposte le même corps.
 */
export function versDomaineContenu(req: Request, objet: ObjetContenu, statut: 302 | 307 = 302, suffixe = ""): Response | null {
  const d = domaineContenu();
  if (!d) return null;
  const cle = cleContenu();
  const o = origineApp(req);
  if (!cle || !o) {
    console.error(JSON.stringify({ tag: "getgents:contenu", event: "signature_impossible", cle: !!cle, origine: !!o }));
    return new Response("Document momentanément indisponible.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const jeton = signerAdresse(objet, { cle, origineApp: o, maintenant: Date.now() });
  return new Response(null, {
    status: statut,
    headers: {
      Location: `${d.origine}${CHEMIN_CONTENU}${jeton}${suffixe}`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
