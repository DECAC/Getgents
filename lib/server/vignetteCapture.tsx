import { ImageResponse } from "next/og";
import { paletteDuTitre, etiquetteVignette } from "@/lib/vignetteLien";
import { policesOg } from "@/lib/server/policesOg";

/**
 * Vignette d'un lien AVEC la capture de la page (option par page, 25/11) :
 * le style « pages empilées », la capture nette sur la feuille de devant, le
 * bouton de réponse et l'étiquette. AUCUN élément propre au lien (ni « pour
 * Marie ») : c'est la MÊME image pour tous les liens de la page, celle que
 * l'auteur a vue dans la fiche avant d'activer l'option.
 */

export const TAILLE_VIGNETTE = { width: 1200, height: 630 };

export async function vignetteAvecCapture(o: { png: Buffer; titre: string; action: string | null; langue: "fr" | "en" }): Promise<ImageResponse> {
  const p = paletteDuTitre(o.titre);
  const fonts = await policesOg();
  const src = `data:image/png;base64,${o.png.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: p.fond, fontFamily: "B" }}>
        <div style={{ position: "absolute", width: 860, height: 470, background: p.doux, borderRadius: 24, transform: "rotate(7deg)" }} />
        <div style={{ position: "absolute", width: 860, height: 470, background: p.fond2, borderRadius: 24, transform: "rotate(-5deg)" }} />
        <div
          style={{
            position: "relative",
            width: 860,
            height: 470,
            display: "flex",
            background: "#ffffff",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 24px 50px rgba(0,0,0,0.25)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={860} height={452} style={{ position: "absolute", top: 0, left: 0 }} alt="" />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 86,
              display: "flex",
              alignItems: "center",
              justifyContent: o.action ? "space-between" : "flex-end",
              padding: "0 28px",
              background: "#ffffff",
              borderTop: "1px solid #eeeeee",
            }}
          >
            {o.action ? (
              <div style={{ display: "flex", background: p.accent, color: "#ffffff", fontSize: 26, fontWeight: 700, borderRadius: 14, padding: "10px 22px" }}>{o.action}</div>
            ) : null}
            <div style={{ display: "flex", fontSize: 22, color: "#8a7f78" }}>Getgents Pages</div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            top: 40,
            right: 110,
            display: "flex",
            background: p.encre,
            color: "#ffffff",
            fontSize: 28,
            fontWeight: 700,
            padding: "10px 22px",
            borderRadius: 12,
            transform: "rotate(9deg)",
          }}
        >
          {etiquetteVignette("prive", o.langue)}
        </div>
      </div>
    ),
    { ...TAILLE_VIGNETTE, fonts }
  );
}
