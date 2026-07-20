// Connecteur « Dataset open data » — portail Opendatasoft (opendata.paris.fr,
// public.opendatasoft.com, etc.). Isomorphe : utilisé côté builder pour
// valider l'URL collée, et côté serveur pour construire les appels API.

/** Domaine API stable pour les datasets fédérés `@public`. */
export const ODS_PUBLIC_API_DOMAIN = "public.opendatasoft.com";

/** Dataset DVF DGFiP/Cerema stable sur public.opendatasoft.com. */
export const DVF_CANONICAL_DATASET_ID =
  "buildingref-france-demande-de-valeurs-foncieres-par-mutation-millesime";

export const DVF_CANONICAL_DATASET_URL = `https://${ODS_PUBLIC_API_DOMAIN}/explore/dataset/${DVF_CANONICAL_DATASET_ID}/`;

/** Alias d'IDs obsolètes ou mal formés (@public, anciens slugs data.gouv). */
const DATASET_ID_ALIASES: Record<string, string> = {
  "demande-de-valeurs-foncieres-agrege-a-la-transaction": DVF_CANONICAL_DATASET_ID,
  "demande-de-valeurs-foncieres-geolocalisees": DVF_CANONICAL_DATASET_ID,
  "demandes-de-valeurs-foncieres": DVF_CANONICAL_DATASET_ID,
};

export interface DatasetRef {
  /** Domaine du portail, ex. "opendata.paris.fr". */
  domain: string;
  /** Identifiant du dataset, ex. "sanisettesparis". */
  datasetId: string;
  /** Libellé lisible pour le modèle (nom donné par le builder). */
  label?: string;
}

/**
 * Normalise une référence dataset : retire le suffixe `@public`, redirige
 * data.opendatasoft.com vers public.opendatasoft.com, résout les alias DVF.
 */
export function normalizeDatasetRef(ref: DatasetRef): DatasetRef {
  let datasetId = decodeURIComponent(ref.datasetId).replace(/@[^/@]+$/i, "");
  datasetId = DATASET_ID_ALIASES[datasetId] ?? datasetId;

  let domain = ref.domain.toLowerCase();
  if (domain === "data.opendatasoft.com" || domain === "www.data.opendatasoft.com") {
    domain = ODS_PUBLIC_API_DOMAIN;
  }

  return { ...ref, domain, datasetId };
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
  return normalizeDatasetRef({ domain: url.hostname, datasetId: decodeURIComponent(m[1]) });
}

/** Sérialise la référence dans le champ `detail` d'un GentToolInstance. */
export function datasetRefToDetail(ref: DatasetRef): string {
  const n = normalizeDatasetRef(ref);
  return `https://${n.domain}/explore/dataset/${n.datasetId}/`;
}

/** Indique si l'URL pointe vers un jeu DVF (transactions immobilières). */
export function isDvfDatasetUrl(raw: string): boolean {
  const ref = parseDatasetUrl(raw);
  if (!ref) return false;
  const id = ref.datasetId.toLowerCase();
  return id.includes("valeurs-foncieres") || id.includes("dvf") || id === DVF_CANONICAL_DATASET_ID;
}
