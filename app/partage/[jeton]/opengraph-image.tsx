import { ImageResponse } from "next/og";
import { apercuPourJeton } from "@/lib/server/apercuLien";
import { policesOg } from "@/lib/server/policesOg";
import { vignetteAvecCapture } from "@/lib/server/vignetteCapture";
import { imageCapture } from "@/lib/server/apercusLien";
import { paletteDuTitre, tailleTitre, enteteVignette, etiquetteVignette } from "@/lib/vignetteLien";

/**
 * Vignette d'aperçu d'un lien de page partagée — `og:image`, ajoutée aux
 * métadonnées par sa seule présence (convention Next). WhatsApp, LinkedIn et
 * Slack en tirent la carte de l'aperçu.
 *
 * Style « pages empilées » (choisi par l'éditeur le 20/11 parmi trois) :
 * couleur tirée du TITRE (deux pages dans un même fil ne se ressemblent pas),
 * police libre (OFL) de `lib/og/polices` — une police manuscrite a été
 * écartée : elle n'avait pas le « é » (« privé » sortait « prive »). Ce qu'elle montre suit
 * `apercuPourJeton` : titre, « pour qui » (jamais une adresse e-mail),
 * bouton de réponse. Page protégée : titre seul. Lien expiré ou révoqué :
 * carte générique. Ne lève jamais — une erreur 500 se lirait comme un lien mort.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Aperçu de la page partagée";
export const runtime = "nodejs";

const etoile = (taille: number, couleur: string) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24">
    <path d="M12 1.5 L14.6 9.4 L22.5 12 L14.6 14.6 L12 22.5 L9.4 14.6 L1.5 12 L9.4 9.4 Z" fill={couleur} />
  </svg>
);

export default async function Image({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const apercu = await apercuPourJeton(jeton);
  // Option « aperçu par capture » activée par l'auteur, capture de la version courante : la page elle-même.
  if (apercu?.capture) {
    const png = await imageCapture(apercu.capture.pageId, apercu.capture.version).catch(() => null);
    if (png) return vignetteAvecCapture({ png, titre: apercu.titre, action: apercu.action, langue: apercu.langue });
  }
  const fonts = await policesOg();
  const titre = apercu?.titre ?? "Lien privé · Private link";
  const p = paletteDuTitre(titre);
  const confettis = [
    [90, 80, 28, p.fond2],
    [1080, 90, 20, "#ffffff"],
    [140, 520, 18, "#ffffff"],
    [1100, 470, 34, p.fond2],
    [560, 40, 14, "#ffffff"],
    [980, 560, 16, p.encre],
  ] as const;
  const langue = apercu?.langue ?? "fr";
  const etiquette = etiquetteVignette(!apercu ? "expire" : apercu.protegee ? "protege" : "prive", langue);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: p.fond, fontFamily: "B" }}>
        {confettis.map(([x, y, r, c], i) => (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: r, height: r, borderRadius: i % 2 ? 4 : r, background: c, transform: `rotate(${i * 25}deg)` }} />
        ))}
        <div style={{ position: "absolute", width: 860, height: 470, background: p.doux, borderRadius: 24, transform: "rotate(7deg)" }} />
        <div style={{ position: "absolute", width: 860, height: 470, background: p.fond2, borderRadius: 24, transform: "rotate(-5deg)" }} />
        <div
          style={{
            width: 860,
            height: 470,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#ffffff",
            borderRadius: 24,
            padding: "50px 56px",
            boxShadow: "0 24px 50px rgba(0,0,0,0.22)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: "#8a7f78", letterSpacing: 1.5 }}>
            {etoile(26, p.accent)} {enteteVignette(apercu?.pour ?? null, !apercu, langue)}
          </div>
          <div style={{ display: "flex", fontSize: tailleTitre(titre), fontWeight: 700, color: p.encre, lineHeight: 1.0, letterSpacing: -2 }}>{titre}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {apercu?.action ? (
              <div style={{ display: "flex", background: p.accent, color: "#ffffff", fontSize: 28, fontWeight: 700, borderRadius: 16, padding: "14px 28px" }}>
                {apercu.action}
              </div>
            ) : (
              <div style={{ display: "flex" }} />
            )}
            <div style={{ display: "flex", fontSize: 24, color: "#8a7f78" }}>Getgents Pages</div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            top: 46,
            right: 120,
            display: "flex",
            background: p.encre,
            color: "#ffffff",
            fontSize: 30,
            fontWeight: 700,
            padding: "10px 22px",
            borderRadius: 12,
            transform: "rotate(9deg)",
          }}
        >
          {etiquette}
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
