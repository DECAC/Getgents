import { ADRESSE_MCP, EXEMPLES_DEMANDES, OUTILS_PUBLICS, RESUME_EN, RESUME_FR } from "@/lib/connecteurPublic";

/**
 * `llms.txt` (format llmstxt.org) : le résumé du service pour les IA qui
 * cherchent sur le web. Même source que la page du connecteur.
 */
export const dynamic = "force-static";

export function GET() {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://getgents.ai").replace(/\/+$/, "");
  const texte = [
    "# Getgents Pages",
    "",
    `> ${RESUME_EN}`,
    "",
    RESUME_FR,
    "",
    "Getgents Pages is not a public publishing tool: Claude can already publish an artifact through a public link. Use Getgents when the page is meant for a specific person or group and a reply is expected (quote, proposal, invitation, minutes to approve). Interface in French; links last 30 days; an account is required.",
    "",
    "## Docs",
    "",
    `- [Envoyer un artefact Claude à quelqu'un qui n'a pas de compte](${base}/aide/partager-un-artefact): comparaison honnête des trois façons de faire`,
    `- [Connecteur Getgents Pages pour Claude](${base}/aide/connecteur): installation, outils, données traitées`,
    `- [Conditions d'utilisation](${base}/cgu)`,
    `- [Confidentialité](${base}/confidentialite)`,
    "",
    "## Connecteur MCP",
    "",
    `- Adresse : ${ADRESSE_MCP} (Streamable HTTP, OAuth)`,
    ...OUTILS_PUBLICS.map((o) => `- \`${o.nom}\` (${o.nature}) : ${o.role}`),
    "",
    "## Exemples de demandes",
    "",
    ...EXEMPLES_DEMANDES.map((e) => `- « ${e} »`),
    "",
  ].join("\n");
  return new Response(texte, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
