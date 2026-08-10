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
}: {
  src: string;
  alt: string;
  caption?: string;
  source?: "generated" | "web";
}) {
  if (!isAllowedImageSrc(src)) {
    return <p className={styles.fallback}>Image indisponible (adresse non autorisée).</p>;
  }

  return (
    <figure className={styles.figure}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.img} src={src} alt={alt} loading="lazy" />
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
