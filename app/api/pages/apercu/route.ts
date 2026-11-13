import { marked } from "marked";
import { requireUser } from "@/lib/server/session";
import { CSP_ARTEFACT, documentArtefact } from "@/lib/documentArtefact";
import { empreinteBrouillon } from "@/lib/adresseSignee";
import { versDomaineContenu } from "@/lib/server/domaineContenu";
import { nettoyerCollage } from "@/lib/importPage";
import { CONTENU_MAX, FORMATS_ARTEFACT, type FormatArtefact } from "@/lib/mcpPartage";

/**
 * Aperçu d'un code COLLÉ, avant qu'il devienne une page. Le formulaire de la
 * fenêtre « Nouvelle page » le poste dans un cadre : même document et même
 * isolement que chez le destinataire (CSP `sandbox` sans `allow-same-origin`).
 * Un `srcdoc` hériterait de la CSP de Getgents, qui bloquerait les scripts de
 * l'artefact — d'où cet aller-retour. Rien n'est enregistré.
 */
export const dynamic = "force-dynamic";

const texte = (s: string, status: number) => new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return texte("Connexion requise.", 401);
  const f = await req.formData().catch(() => null);
  const brutContenu = String(f?.get("contenu") ?? "");
  const contenu = nettoyerCollage(brutContenu);
  const brut = String(f?.get("format") ?? "");
  const format: FormatArtefact = (FORMATS_ARTEFACT as readonly string[]).includes(brut) ? (brut as FormatArtefact) : "html";
  if (contenu.length > CONTENU_MAX) return texte("Contenu trop volumineux pour l'aperçu.", 413);
  // Domaine de contenu : 307, le navigateur y reposte le MÊME corps, dont
  // l'adresse signée porte l'empreinte (un autre code n'y passerait pas).
  if (contenu) {
    const h = empreinteBrouillon(brutContenu, brut, String(f?.get("titre") ?? ""));
    const ailleurs = versDomaineContenu(req, { t: "brouillon", u: auth.user.id, h }, 307);
    if (ailleurs) return ailleurs;
  }
  const html = contenu
    ? documentArtefact(contenu, format, String(f?.get("titre") ?? "Aperçu").slice(0, 200), (md) => marked.parse(md, { async: false }) as string)
    : '<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;color:#999;display:grid;place-items:center;height:90vh;margin:0">L\'aperçu apparaîtra ici.</body>';
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP_ARTEFACT,
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
