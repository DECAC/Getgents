// Connecteur « Dataset open data » — portail Opendatasoft (opendata.paris.fr,
// data.gouv.fr régionalisés, etc.). Isomorphe : utilisé côté builder pour
// valider l'URL collée, et côté serveur pour construire les appels API.

export interface DatasetRef {
  /** Domaine du portail, ex. "opendata.paris.fr". */
  domain: string;
  /** Identifiant du dataset, ex. "sanisettesparis". */
  datasetId: string;
  /** Libellé lisible pour le modèle (nom donné par le builder). */
  label?: string;
}

/**
 * Extrait {domain, datasetId} d'une URL de portail Opendatasoft collée par
 * un builder non technique — page d'exploration (`/explore/dataset/<id>/...`)
 * ou URL API (`/api/explore/v2.1/catalog/datasets/<id>/...`).
 * Retourne null si l'URL ne ressemble pas à un dataset Opendatasoft.
 */
export function parseDatasetUrl(raw: string): DatasetRef | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const m =
    url.pathname.match(/\/explore\/dataset\/([^/?#]+)/) ??
    url.pathname.match(/\/catalog\/datasets\/([^/?#]+)/);
  if (!m) return null;
  return { domain: url.hostname, datasetId: decodeURIComponent(m[1]) };
}

/** Sérialise la référence dans le champ `detail` d'un GentToolInstance. */
export function datasetRefToDetail(ref: DatasetRef): string {
  return `https://${ref.domain}/explore/dataset/${ref.datasetId}/`;
}
