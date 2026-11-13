import { marked } from "marked";
import { empreinteBrouillon, lireAdresse, type AdresseLue } from "@/lib/adresseSignee";
import { estDomaineContenu } from "@/lib/domaineContenu";
import { cspArtefact, documentArtefact } from "@/lib/documentArtefact";
import { nettoyerCollage } from "@/lib/importPage";
import { CONTENU_MAX, FORMATS_ARTEFACT, type FormatArtefact } from "@/lib/mcpPartage";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { cleContenu, domaineContenu } from "@/lib/server/domaineContenu";
import { contenuPourProprietaire } from "@/lib/server/pages";

/**
 * Le DOMAINE DE CONTENU (`lib/domaineContenu.ts`) : sert un document sur
 * présentation d'une adresse signée par getgents.ai, et rien d'autre — toute
 * autre adresse de ce domaine est réécrite ici (`next.config.mjs`) et tombe
 * en 404. Aucun cookie, aucune session : la signature fait foi.
 *
 * Même document et même isolement que sur getgents.ai (CSP `sandbox` sans
 * `allow-same-origin`) ; seul `frame-ancestors` change : il nomme l'origine
 * qui a signé.
 */
export const dynamic = "force-dynamic";

const texte = (s: string, status: number) =>
  new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });

const rendre = (md: string) => marked.parse(md, { async: false }) as string;

function document(html: string, a: AdresseLue): Response {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": cspArtefact(a.o),
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/** Adresse lue, ou la réponse de refus. Le domaine doit être celui de la requête quand il est configuré. */
function adresse(req: Request, token: string): AdresseLue | Response {
  const d = domaineContenu();
  if (!d || !estDomaineContenu(req.headers.get("host"), d)) return texte("Introuvable.", 404);
  const r = lireAdresse(token, cleContenu(), Date.now());
  if (r.ok) return r.adresse;
  if (token !== "introuvable") console.info(JSON.stringify({ tag: "getgents:contenu", event: "adresse_refusee", raison: r.raison }));
  // Une adresse expirée vient d'un cadre ouvert longtemps : recharger la page en redonne une.
  return r.raison === "expiree" ? texte("Ce lien a expiré : rechargez la page.", 410) : texte("Introuvable.", 404);
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const a = adresse(req, params.token);
  if (a instanceof Response) return a;
  if (a.t === "partage") {
    const p = await lireArtefact(a.j).catch(() => null);
    if (!p) return texte("Ce lien n'existe pas ou a expiré.", 404);
    return document(documentArtefact(p.contenu, p.format, p.titre, rendre), a);
  }
  if (a.t === "page") {
    const page = await contenuPourProprietaire(a.u, a.id).catch(() => null);
    if (!page) return texte("Page introuvable.", 404);
    return document(documentArtefact(page.contenu, page.format, page.titre, rendre), a);
  }
  // Un brouillon n'existe que dans le corps POSTé.
  return texte("Introuvable.", 404);
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const a = adresse(req, params.token);
  if (a instanceof Response) return a;
  if (a.t !== "brouillon") return texte("Introuvable.", 404);
  const f = await req.formData().catch(() => null);
  const brutContenu = String(f?.get("contenu") ?? "");
  const brutFormat = String(f?.get("format") ?? "");
  const brutTitre = String(f?.get("titre") ?? "");
  // Le corps doit être CELUI que getgents.ai a vu : sinon l'adresse servirait n'importe quel code.
  if (empreinteBrouillon(brutContenu, brutFormat, brutTitre) !== a.h) {
    console.info(JSON.stringify({ tag: "getgents:contenu", event: "adresse_refusee", raison: "empreinte" }));
    return texte("Introuvable.", 404);
  }
  const contenu = nettoyerCollage(brutContenu);
  if (contenu.length > CONTENU_MAX) return texte("Contenu trop volumineux pour l'aperçu.", 413);
  const format: FormatArtefact = (FORMATS_ARTEFACT as readonly string[]).includes(brutFormat) ? (brutFormat as FormatArtefact) : "html";
  return document(documentArtefact(contenu, format, (brutTitre || "Aperçu").slice(0, 200), rendre), a);
}
