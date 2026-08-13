import type { DownloadLead } from "@/lib/types";

export const DOWNLOAD_LEADS_STORAGE_KEY = "getgents:download-leads";

/**
 * Contacts marketing : personnes qui ont rempli le formulaire ET téléchargé
 * le PDF. Même modèle que les gents publiés — localStorage du navigateur,
 * pour que l'onglet Monitor survive à un rafraîchissement.
 */
export function readDownloadLeads(): DownloadLead[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DOWNLOAD_LEADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DownloadLead[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDownloadLeads(leads: DownloadLead[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DOWNLOAD_LEADS_STORAGE_KEY, JSON.stringify(leads));
  } catch {
    // quota / navigation privée
  }
}

export function addDownloadLead(lead: DownloadLead): void {
  const current = readDownloadLeads();
  writeDownloadLeads([lead, ...current]);
}
