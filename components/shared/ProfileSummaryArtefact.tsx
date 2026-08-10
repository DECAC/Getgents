"use client";

import type { ProfileSummaryMedia } from "@/lib/profileSummaryArtefact";
import styles from "./ProfileSummaryArtefact.module.css";

type Summary = NonNullable<import("@/lib/types").Artefact["profileSummary"]>;

const ROLE_LABEL: Record<string, string> = {
  portrait: "Portrait",
  logo: "Logo",
  cover: "Couverture",
  illustration: "Illustration",
};

interface Props {
  summary: Summary;
  artefactId?: string;
  /** Présent dans le canvas / la modale pour autoriser les générations. */
  onGenerateMedia?: (mediaId: string) => void;
  canGenerate?: boolean;
  compact?: boolean;
}

export function ProfileSummaryArtefact({
  summary,
  onGenerateMedia,
  canGenerate,
  compact,
}: Props) {
  const media = summary.media ?? [];
  const cover = media.find((m) => m.role === "cover" && m.imageUrl);
  const portrait = media.find((m) => m.role === "portrait");
  const logos = media.filter((m) => m.role === "logo");
  const others = media.filter((m) => m.role === "illustration" || (m.role === "cover" && !m.imageUrl));

  return (
    <article className={[styles.card, compact ? styles.compact : ""].filter(Boolean).join(" ")}>
      {cover?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.cover} src={cover.imageUrl} alt={cover.caption || "Couverture"} />
      )}

      <header className={styles.head}>
        <MediaSlot
          media={portrait}
          className={styles.portrait}
          onGenerate={onGenerateMedia}
          canGenerate={canGenerate}
          fallback="👤"
        />
        <div className={styles.identity}>
          <h3 className={styles.name}>{summary.name}</h3>
          {summary.headline && <p className={styles.headline}>{summary.headline}</p>}
          {summary.location && <p className={styles.location}>{summary.location}</p>}
        </div>
      </header>

      {summary.summary && <p className={styles.pitch}>{summary.summary}</p>}

      {!!summary.highlights?.length && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Points clés</h4>
          <ul className={styles.chips}>
            {summary.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      )}

      {!!summary.experience?.length && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Parcours</h4>
          <ul className={styles.timeline}>
            {summary.experience.map((e, i) => (
              <li key={`${e.title}-${i}`}>
                <div className={styles.expTitle}>
                  {e.title}
                  {e.org ? <span className={styles.expOrg}> · {e.org}</span> : null}
                </div>
                {e.period && <div className={styles.expPeriod}>{e.period}</div>}
                {e.highlight && <div className={styles.expHighlight}>{e.highlight}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!summary.skills?.length && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Compétences</h4>
          <div className={styles.skillRow}>
            {summary.skills.map((s) => (
              <span key={s} className={styles.skill}>
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {!!summary.education?.length && !compact && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Formation</h4>
          <ul className={styles.timeline}>
            {summary.education.map((e, i) => (
              <li key={`${e.title}-${i}`}>
                <div className={styles.expTitle}>
                  {e.title}
                  {e.org ? <span className={styles.expOrg}> · {e.org}</span> : null}
                </div>
                {e.period && <div className={styles.expPeriod}>{e.period}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!logos.length && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Logos</h4>
          <div className={styles.logoRow}>
            {logos.map((m) => (
              <MediaSlot
                key={m.id}
                media={m}
                className={styles.logo}
                onGenerate={onGenerateMedia}
                canGenerate={canGenerate}
                label={ROLE_LABEL[m.role]}
              />
            ))}
          </div>
        </section>
      )}

      {!!others.length && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Illustrations</h4>
          <div className={styles.illustRow}>
            {others.map((m) => (
              <MediaSlot
                key={m.id}
                media={m}
                className={styles.illust}
                onGenerate={onGenerateMedia}
                canGenerate={canGenerate}
                label={ROLE_LABEL[m.role]}
              />
            ))}
          </div>
        </section>
      )}

      {!!summary.links?.length && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Liens</h4>
          <div className={styles.links}>
            {summary.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                {l.label}
              </a>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function MediaSlot({
  media,
  className,
  onGenerate,
  canGenerate,
  fallback,
  label,
}: {
  media?: ProfileSummaryMedia;
  className: string;
  onGenerate?: (mediaId: string) => void;
  canGenerate?: boolean;
  fallback?: string;
  label?: string;
}) {
  if (!media) {
    return fallback ? <div className={[className, styles.fallback].join(" ")}>{fallback}</div> : null;
  }

  if (media.imageUrl && media.status === "ready") {
    return (
      <figure className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media.imageUrl} alt={media.caption || label || media.role} />
        {media.caption && <figcaption>{media.caption}</figcaption>}
      </figure>
    );
  }

  return (
    <div className={[className, styles.pendingSlot].join(" ")}>
      <div className={styles.pendingLabel}>{label || ROLE_LABEL[media.role] || "Image"}</div>
      {media.status === "generating" && <div className={styles.pendingMeta}>Génération…</div>}
      {media.status === "error" && <div className={styles.pendingMeta}>Échec — réessayez</div>}
      {(media.status === "pending" || media.status === "error") && media.kind === "generate" && (
        <button
          type="button"
          className={styles.genBtn}
          disabled={!canGenerate || !onGenerate}
          title={
            canGenerate
              ? "Autoriser la génération de cette illustration (modèle économique)"
              : "Aucun modèle image assigné à ce gent"
          }
          onClick={() => onGenerate?.(media.id)}
        >
          Autoriser la génération
        </button>
      )}
      {media.kind === "web" && media.status !== "ready" && (
        <div className={styles.pendingMeta}>Photo indisponible</div>
      )}
    </div>
  );
}
