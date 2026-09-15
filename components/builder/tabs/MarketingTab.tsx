"use client";

import { useCallback, useEffect, useState } from "react";
import { readDownloadLeads, DOWNLOAD_LEADS_STORAGE_KEY } from "@/lib/downloadLeads";
import type { DownloadLead } from "@/lib/types";
import styles from "./MarketingTab.module.css";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Monitor « Marketing » : les personnes qui ont validé le formulaire de
 * téléchargement et reçu le PDF. Lecture seule, pas de CRM.
 */
export function MarketingTab() {
  const [leads, setLeads] = useState<DownloadLead[]>([]);

  const reload = useCallback(() => {
    setLeads(readDownloadLeads());
  }, []);

  useEffect(() => {
    reload();
    function onStorage(e: StorageEvent) {
      if (e.key === DOWNLOAD_LEADS_STORAGE_KEY) reload();
    }
    function onVisible() {
      if (document.visibilityState === "visible") reload();
    }
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  return (
    <div className={styles.wrap}>
      <h4 className={styles.sectionTitle}>Marketing</h4>
      <p className={styles.sectionSub}>
        Personnes qui ont renseigné le formulaire et téléchargé le document en PDF.
      </p>

      {leads.length === 0 ? (
        <div className={styles.empty}>
          Aucun téléchargement avec formulaire pour l&apos;instant. Activez le bouton et le
          formulaire dans Gent Conversationnel, puis testez via Preview.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Prénom</th>
                <th scope="col">Nom</th>
                <th scope="col">Email</th>
                <th scope="col">Gent</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{formatWhen(lead.createdAt)}</td>
                  <td>{lead.firstName}</td>
                  <td>{lead.lastName}</td>
                  <td>{lead.email}</td>
                  <td>{lead.gentName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
