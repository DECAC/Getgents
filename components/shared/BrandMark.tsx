import {
  BRAND_ICON_SRC,
  BRAND_LABEL,
  BRAND_WORDMARK_SRC,
  type BrandWordmarkKey,
} from "@/lib/brand";
import styles from "./BrandMark.module.css";

/** Icône GG (marque) — remplace les anciens carrés / emojis devant les titres. */
export function BrandIcon({
  className,
  size = 26,
  alt = "",
  variant = "default",
}: {
  className?: string;
  size?: number;
  /** Vide = décoratif. */
  alt?: string;
  /** Remplit le conteneur parent (cases d'icône gent). */
  variant?: "default" | "fill" | "fillSm";
}) {
  const cls =
    variant === "fill"
      ? [styles.gentIc, className].filter(Boolean).join(" ")
      : variant === "fillSm"
        ? [styles.gentIcSm, className].filter(Boolean).join(" ")
        : [styles.icon, className].filter(Boolean).join(" ");
  return (
    // eslint-disable-next-line @next/next/no-img-element -- asset de marque local
    <img
      src={BRAND_ICON_SRC}
      alt={alt}
      width={variant === "default" ? size : undefined}
      height={variant === "default" ? size : undefined}
      className={cls}
      draggable={false}
      aria-hidden={alt ? undefined : true}
    />
  );
}

/** Wordmark Getgents / GetSpace / GetStudio. */
export function BrandWordmark({
  which,
  className,
  height = 28,
  layout = "inline",
}: {
  which: BrandWordmarkKey;
  className?: string;
  height?: number;
  layout?: "inline" | "hero" | "auth";
}) {
  const src = BRAND_WORDMARK_SRC[which];
  const label = BRAND_LABEL[which];
  const layoutClass =
    layout === "hero" ? styles.wordmarkHero : layout === "auth" ? styles.wordmarkAuth : styles.wordmark;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      height={layout === "inline" ? height : undefined}
      className={[layoutClass, className].filter(Boolean).join(" ")}
      draggable={false}
      style={layout === "inline" ? { height, width: "auto" } : undefined}
    />
  );
}
