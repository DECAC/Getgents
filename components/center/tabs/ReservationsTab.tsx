"use client";

import { useEspace } from "@/lib/context/EspaceContext";
import type { EspaceTab, ReservationItem } from "@/lib/types";
import styles from "./ReservationsTab.module.css";

const STATUS_LABEL: Record<string, string> = {
  pending: "À envoyer",
  sent: "Envoyé — à valider",
  confirmed: "Confirmé",
  cancelled: "Écarté",
};

const STATUS_CLASS: Record<string, string> = {
  pending: styles.statusPending,
  sent: styles.statusSent,
  confirmed: styles.statusConfirmed,
  cancelled: styles.statusCancelled,
};

const IC_CLASS: Record<string, string> = {
  pending: styles.icPending,
  sent: styles.icSent,
  confirmed: styles.icDone,
  cancelled: styles.icCancelled,
};

export function ReservationsTab({ tab }: { tab: EspaceTab }) {
  const { openResvModal } = useEspace();
  const items: ReservationItem[] = tab.items ?? [];

  const counts = { pending: 0, sent: 0, confirmed: 0 };
  items.forEach((it) => {
    if (it.status in counts) counts[it.status as keyof typeof counts]++;
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        <div className={[styles.stat, styles.statPending].join(" ")}>
          <div className={styles.statN}>{counts.pending}</div>
          <div className={styles.statL}>À envoyer</div>
        </div>
        <div className={[styles.stat, styles.statSent].join(" ")}>
          <div className={styles.statN}>{counts.sent}</div>
          <div className={styles.statL}>Envoyées</div>
        </div>
        <div className={[styles.stat, styles.statDone].join(" ")}>
          <div className={styles.statN}>{counts.confirmed}</div>
          <div className={styles.statL}>Confirmées</div>
        </div>
      </div>

      <div className={styles.list}>
        {items.length === 0 ? (
          <div className={styles.empty}>
            Aucune proposition pour l&apos;instant. Le gent en déposera ici dès qu&apos;il en trouvera une pertinente.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={styles.row}>
              <div className={[styles.ic, IC_CLASS[item.status]].join(" ")}>{item.icon}</div>
              <div className={styles.info}>
                <div className={styles.rtitle}>{item.what}</div>
                <div className={styles.rmeta}>
                  {item.service}
                  {item.price ? ` · ${item.price}` : ""}
                </div>
              </div>
              <span className={[styles.status, STATUS_CLASS[item.status]].join(" ")}>
                {STATUS_LABEL[item.status] ?? item.status}
              </span>
              <button
                className={styles.goBtn}
                onClick={() => openResvModal(item.id)}
                aria-label={`Voir le détail de ${item.what}`}
                title="Voir le détail"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
