// Client serveur de l'API Opendatasoft Explore v2.1 — recherche des
// enregistrements les plus proches d'une position (géo-filtrage côté portail,
// aucun index local nécessaire).

import type { DatasetRef } from "@/lib/opendatasoft";

// La variable OPENDATASOFT_BASE_OVERRIDE permet de pointer les tests locaux
// vers un mock (le domaine réel étant inaccessible depuis certains sandboxes).
function baseUrl(domain: string): string {
  return process.env.OPENDATASOFT_BASE_OVERRIDE ?? `https://${domain}`;
}

export interface NearbySearchParams {
  lat: number;
  lon: number;
  /** Rayon de recherche en mètres (borné à 20 km). */
  radiusM?: number;
  limit?: number;
}

// Le nom du champ géographique varie d'un dataset à l'autre (geo_point_2d,
// geom, coordonnees…) : on le découvre via les métadonnées du dataset, avec
// un cache mémoire par dataset (durée de vie du process serveur).
const geoFieldCache = new Map<string, string | null>();

async function resolveGeoField(ref: DatasetRef): Promise<string | null> {
  const key = `${ref.domain}/${ref.datasetId}`;
  if (geoFieldCache.has(key)) return geoFieldCache.get(key) ?? null;

  let field: string | null = "geo_point_2d";
  try {
    const res = await fetch(
      `${baseUrl(ref.domain)}/api/explore/v2.1/catalog/datasets/${encodeURIComponent(ref.datasetId)}`,
      { headers: { Accept: "application/json" } }
    );
    if (res.ok) {
      const meta = (await res.json()) as { fields?: { name?: string; type?: string }[] };
      const geo = meta.fields?.find((f) => f.type === "geo_point_2d");
      field = geo?.name ?? null;
    }
  } catch {
    // métadonnées inaccessibles : on tente le nom conventionnel
  }
  geoFieldCache.set(key, field);
  return field;
}

export async function searchNearby(
  ref: DatasetRef,
  { lat, lon, radiusM = 1500, limit = 5 }: NearbySearchParams,
): Promise<string> {
  const geoField = await resolveGeoField(ref);
  if (!geoField) {
    return JSON.stringify({
      error: `Le dataset ${ref.datasetId} ne contient pas de champ géographique (geo_point_2d) — recherche par proximité impossible.`,
    });
  }

  const radius = Math.min(Math.max(Math.round(radiusM), 50), 20_000);
  const n = Math.min(Math.max(Math.round(limit), 1), 20);
  const point = `geom'POINT(${lon} ${lat})'`;
  const params = new URLSearchParams({
    where: `within_distance(${geoField}, ${point}, ${radius}m)`,
    order_by: `distance(${geoField}, ${point})`,
    limit: String(n),
  });
  const url = `${baseUrl(ref.domain)}/api/explore/v2.1/catalog/datasets/${encodeURIComponent(
    ref.datasetId,
  )}/records?${params}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    return JSON.stringify({ error: `Le portail ${ref.domain} a répondu ${res.status}.` });
  }
  const data = (await res.json()) as { total_count?: number; results?: Record<string, unknown>[] };
  return JSON.stringify({
    dataset: ref.datasetId,
    total_in_radius: data.total_count ?? data.results?.length ?? 0,
    radius_m: radius,
    results: data.results ?? [],
  });
}
