"use client";

import { useEffect } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import type { ReservationItem } from "@/lib/types";
import styles from "./Modal.module.css";
import resvStyles from "./ResvModal.module.css";

function ActionCard({ item, onConfirm, onCancel, toolConnected }: {
  item: ReservationItem;
  onConfirm: () => void;
  onCancel: () => void;
  toolConnected: boolean;
}) {
  const { service, category, what, rows, price, status } = item;
  const isAcct = category === "compte_tiers";

  if (status === "cancelled") {
    return (
      <div className={[resvStyles.card, resvStyles.cardDone].join(" ")} style={{ borderColor: "var(--line)" }}>
        <div className={resvStyles.ahead} style={{ background: "var(--bg)", color: "var(--muted)" }}>{service}</div>
        <div className={resvStyles.abody}>
          <div className={[resvStyles.what, resvStyles.muted].join(" ")}>{what}</div>
          <div className={[resvStyles.confirmedTag, resvStyles.muted].join(" ")}>Écarté — rien n&apos;a été envoyé</div>
        </div>
      </div>
    );
  }

  if (isAcct && status === "sent") {
    return (
      <div className={[resvStyles.card, resvStyles.cardSent].join(" ")}>
        <div className={resvStyles.ahead}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          {service}
        </div>
        <div className={resvStyles.abody}>
          <div className={resvStyles.what}>{what}</div>
          <Rows rows={rows} price={price} />
          <div className={resvStyles.sentTag}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            Envoyé vers {service} — validez et payez là-bas pour confirmer
          </div>
        </div>
      </div>
    );
  }

  if (isAcct && !toolConnected) {
    return (
      <div className={resvStyles.card}>
        <div className={resvStyles.ahead}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.7M12 17h.01" />
          </svg>
          Proposition — {service}
        </div>
        <div className={resvStyles.abody}>
          <div className={resvStyles.what}>{what}</div>
          <Rows rows={rows} price={price} />
          <div className={resvStyles.warn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <span>Connectez votre compte {service} pour pouvoir envoyer cette proposition. Le paiement se fera toujours chez {service}, jamais sur Getgents.</span>
          </div>
          <div className={resvStyles.actions}>
            <button className={resvStyles.cancel} onClick={onCancel}>Écarter</button>
            <button className={[resvStyles.confirm, resvStyles.extBtn].join(" ")} onClick={() => alert(`Connexion ${service} — non implémentée dans ce commit.`)}>
              Connecter {service}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "confirmed") {
    return (
      <div className={[resvStyles.card, resvStyles.cardDone].join(" ")}>
        <div className={resvStyles.ahead}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l2 2 4-4" /><circle cx="12" cy="12" r="9" />
          </svg>
          {service}
        </div>
        <div className={resvStyles.abody}>
          <div className={resvStyles.what}>{what}</div>
          <Rows rows={rows} price={price} />
          <div className={resvStyles.confirmedTag}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l2 2 4-4" /><circle cx="12" cy="12" r="9" />
            </svg>
            Confirmé par vous · exécuté
          </div>
        </div>
      </div>
    );
  }

  // pending (ecriture or compte_tiers connected)
  const confirmLabel = isAcct
    ? `Envoyer vers ${service}`
    : price ? "Confirmer et payer" : "Confirmer la réservation";

  return (
    <div className={resvStyles.card}>
      <div className={resvStyles.ahead}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.86 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0z" />
        </svg>
        Action engageante — {service}
      </div>
      <div className={resvStyles.abody}>
        <div className={resvStyles.what}>{what}</div>
        <Rows rows={rows} price={price} />
        <div className={resvStyles.warn}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <span>Rien n&apos;est réservé ni payé tant que vous n&apos;avez pas confirmé. Le gent agit pour votre compte, jamais en autonomie. Getgents ne réserve ni ne paie jamais.</span>
        </div>
        <div className={resvStyles.actions}>
          <button className={resvStyles.cancel} onClick={onCancel}>Annuler</button>
          <button
            className={[resvStyles.confirm, isAcct ? resvStyles.extBtn : ""].join(" ")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
        {isAcct && toolConnected && (
          <div className={resvStyles.acctNote}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l2 2 4-4" /><circle cx="12" cy="12" r="9" />
            </svg>
            Compte {service} connecté
          </div>
        )}
      </div>
    </div>
  );
}

function Rows({ rows, price }: { rows: [string, string][]; price: string | null }) {
  return (
    <div className={resvStyles.rows}>
      {rows.map(([label, val]) => (
        <div key={label} className={resvStyles.row}>
          <span>{label}</span><b>{val}</b>
        </div>
      ))}
      {price && (
        <div className={resvStyles.row}>
          <span>Montant indicatif</span><b>{price}</b>
        </div>
      )}
    </div>
  );
}

export function ResvModal() {
  const { currentEspace, modalResvId, closeModal, confirmReservation, cancelReservation } = useEspace();

  const resvTab = currentEspace.tabs.find((t) => t.kind === "resv");
  const item = modalResvId && resvTab?.items
    ? resvTab.items.find((x) => x.id === modalResvId) ?? null
    : null;

  const toolConnected = item
    ? (currentEspace.tools.find((t) => t.name === item.service)?.connected ?? false)
    : false;

  useEffect(() => {
    if (item) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [item]);

  if (!item) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="resv-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div className={styles.modal}>
        <div className={styles.head}>
          <div className={styles.ti} style={{ fontSize: "18px" }}>{item.icon}</div>
          <div>
            <h3 className={styles.title} id="resv-modal-title">{item.what}</h3>
            <div className={styles.meta}>{item.service}</div>
          </div>
          <button className={styles.closeBtn} onClick={closeModal} aria-label="Fermer">✕</button>
        </div>

        <div className={styles.body}>
          <ActionCard
            item={item}
            toolConnected={toolConnected}
            onConfirm={() => confirmReservation(item.id)}
            onCancel={() => cancelReservation(item.id)}
          />
        </div>
      </div>
    </div>
  );
}
