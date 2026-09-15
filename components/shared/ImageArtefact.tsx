import styles from "./ImageArtefact.module.css";

/**
 * Affiche une illustration (générée ou photo web) dans le canvas / la modale.
 * Seules les URLs https et data:image sont acceptées.
 */
export function ImageArtefact({
  src,
  alt,
  caption,
  source,
  embedded = false,
  onNaturalSize,
}: {
  src: string;
  alt: string;
  caption?: string;
  source?: "generated" | "web";
  /** Mode tuile module : pas de plafond de hauteur, image entière visible. */
  embedded?: boolean;
  /** Dimensions naturelles une fois l'image chargée (ajustement de la tuile). */
  onNaturalSize?: (width: number, height: number) => void;
}) {
  if (!isAllowedImageSrc(src)) {
    return <p className={styles.fallback}>Image indisponible (adresse non autorisée).</p>;
  }

  return (
    <figure className={[styles.figure, embedded ? styles.figureEmbedded : ""].filter(Boolean).join(" ")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={embedded ? styles.imgEmbedded : styles.img}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            onNaturalSize?.(img.naturalWidth, img.naturalHeight);
          }
        }}
      />
      {(caption || source) && (
        <figcaption className={styles.caption}>
          {caption}
          {source && (
            <span className={styles.source}>
              {caption ? " · " : ""}
              {source === "generated" ? "Illustration générée" : "Photo web"}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}

function isAllowedImageSrc(src: string): boolean {
  if (src.startsWith("data:image/")) return true;
  try {
    const u = new URL(src);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}
