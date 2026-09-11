import { ImageResponse } from "next/og";
import { lireGentPublic } from "@/lib/server/publicGent";
import { slugProbleme } from "@/lib/slug";

/**
 * Vignette d'aperçu d'un gent public — `og:image`.
 *
 * LinkedIn n'arrivait pas à composer d'aperçu à partir d'un lien de gent. Les
 * balises Open Graph étaient pourtant là (titre, description, URL, siteName) :
 * il manquait la SEULE qui décide, l'image. Sans elle, LinkedIn affiche au
 * mieux une ligne de texte, au pire rien du tout — et l'échec est muet, le
 * partageur croyant que le lien est cassé.
 *
 * Générée à la demande plutôt que fixe : une vignette unique pour tous les
 * gents rendrait chaque partage indistinguable du précédent, ce qui est
 * exactement ce qu'un aperçu doit éviter.
 *
 * Le fichier suit la convention Next : sa seule présence ajoute
 * `og:image`, `og:image:width` et `og:image:height` aux métadonnées de la
 * page, sans rien à déclarer dans `generateMetadata`.
 */

/** Format attendu par LinkedIn, Slack et X — 1,91:1. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Aperçu du gent";

/**
 * `nodejs` et non `edge` : la lecture du gent passe par le client Supabase
 * serveur, qui n'est pas garanti sur le runtime edge.
 */
export const runtime = "nodejs";

// Reprises de `styles/tokens.css` : la vignette doit ressembler au produit.
const ENCRE = "#2a1f19";
const ESTOMPE = "#73665f";
const FOND = "#fbf3ed";
const CARTE = "#fffdf9";
const FILET = "#eadbd3";
const ACCENT = "#e65d76";

export default async function Image({ params }: { params: { slug: string } }) {
  // Ne lève JAMAIS : un aperçu qui échoue vaut une page sans image, pas une
  // erreur 500 que le robot interpréterait comme un lien mort.
  let nom = "Getgents";
  let resume = "Un assistant créé sur Getgents.";
  try {
    if (!slugProbleme(params.slug)) {
      const gent = await lireGentPublic(params.slug);
      if (gent) {
        nom = gent.espace.name || nom;
        resume = gent.resume || gent.espace.gent || resume;
      }
    }
  } catch {
    // On garde les valeurs de repli.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: FOND,
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: ACCENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              color: CARTE,
            }}
          >
            ✦
          </div>
          <div style={{ fontSize: 26, color: ESTOMPE, letterSpacing: 1 }}>GETGENTS</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: nom.length > 40 ? 62 : 78,
              fontWeight: 700,
              color: ENCRE,
              lineHeight: 1.1,
              letterSpacing: -1.5,
            }}
          >
            {nom.slice(0, 70)}
          </div>
          <div style={{ fontSize: 30, color: ESTOMPE, lineHeight: 1.4 }}>
            {resume.slice(0, 140)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            borderTop: `2px solid ${FILET}`,
            paddingTop: 26,
            fontSize: 26,
            color: ESTOMPE,
          }}
        >
          <span style={{ color: ACCENT, fontWeight: 700 }}>Discuter avec ce gent</span>
          <span>· getgents.ai</span>
        </div>
      </div>
    ),
    size
  );
}
