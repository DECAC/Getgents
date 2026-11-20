import { ImageResponse } from "next/og";
import { apercuPourJeton } from "@/lib/server/apercuLien";

/**
 * Vignette d'aperçu d'un lien de page partagée — `og:image`, ajoutée aux
 * métadonnées par sa seule présence (convention Next). WhatsApp, LinkedIn et
 * Slack en tirent la grande carte ; sans elle, au mieux une ligne de texte.
 *
 * Ce qu'elle montre suit `apercuPourJeton` : titre, « pour qui » (jamais une
 * adresse e-mail), bouton de réponse. Page protégée : titre seul. Lien
 * expiré ou révoqué : carte générique, rien de la page. Ne lève jamais —
 * une erreur 500 se lirait comme un lien mort.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Aperçu de la page partagée";
export const runtime = "nodejs";

// Reprises de `styles/tokens.css`.
const ENCRE = "#2a1f19";
const ESTOMPE = "#73665f";
const FOND = "#fbf3ed";
const CARTE = "#fffdf9";
const FILET = "#eadbd3";
const ACCENT = "#e65d76";

export default async function Image({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const apercu = await apercuPourJeton(jeton);
  const titre = apercu?.titre ?? "Lien privé";
  const description = apercu ? apercu.description : "Ce lien n'est plus valable.";
  const protegee = apercu?.protegee ?? false;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: FOND, padding: 56 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: CARTE,
            border: `2px solid ${FILET}`,
            borderRadius: 36,
            padding: "52px 60px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: ACCENT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  color: CARTE,
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24"><path d="M12 1.5 L14.6 9.4 L22.5 12 L14.6 14.6 L12 22.5 L9.4 14.6 L1.5 12 L9.4 9.4 Z" fill={CARTE} /></svg>
              </div>
              <div style={{ fontSize: 24, color: ESTOMPE, letterSpacing: 1 }}>GETGENTS PAGES</div>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: ESTOMPE,
                border: `2px solid ${FILET}`,
                borderRadius: 999,
                padding: "8px 20px",
              }}
            >
              {protegee ? "Lien privé · protégé par code" : "Lien privé"}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {apercu?.pour && <div style={{ display: "flex", fontSize: 30, color: ACCENT, fontWeight: 700 }}>Pour {apercu.pour}</div>}
            <div
              style={{
                display: "flex",
                fontSize: titre.length > 50 ? 56 : 70,
                fontWeight: 700,
                color: ENCRE,
                lineHeight: 1.08,
                letterSpacing: -1.5,
              }}
            >
              {titre}
            </div>
            <div style={{ display: "flex", fontSize: 28, color: ESTOMPE, lineHeight: 1.35 }}>{description.slice(0, 150)}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {apercu?.action ? (
              <div
                style={{
                  display: "flex",
                  background: ACCENT,
                  color: CARTE,
                  fontSize: 26,
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: "14px 30px",
                }}
              >
                {apercu.action}
              </div>
            ) : (
              <div style={{ display: "flex" }} />
            )}
            <div style={{ display: "flex", fontSize: 24, color: ESTOMPE }}>getgents.ai</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
