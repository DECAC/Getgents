// Client serveur de l'API Opendatasoft Explore v2.1 — recherche par proximité
// (datasets géolocalisés) ou par filtres (datasets tabulaires type DVF).

import type { DatasetRef } from "@/lib/opendatasoft";

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

export interface TabularSearchParams {
  /** Code INSEE de la commune (5 chiffres, ex. 22118 pour Matignon — pas le code postal). */
  commune_insee?: string;
  /** Code département (ex. "22"). */
  dep_code?: string;
  /** Type de bien pour les jeux DVF : maison ou appartement. */
  property_type?: "maison" | "appartement";
  min_surface_m2?: number;
  max_surface_m2?: number;
  min_price?: number;
  max_price?: number;
  /** Année minimum de mutation (ex. 2019). */
  since_year?: number;
  /** Recherche textuelle libre (ODS search()). */
  search_text?: string;
  limit?: number;
}

export interface DatasetMeta {
  fields: string[];
  geoField: string | null;
}

const metaCache = new Map<string, DatasetMeta>();

/** Métadonnées du dataset (champs + éventuel champ géographique), mises en cache. */
export async function getDatasetMeta(ref: DatasetRef): Promise<DatasetMeta> {
  const key = `${ref.domain}/${ref.datasetId}`;
  if (metaCache.has(key)) return metaCache.get(key)!;

  let meta: DatasetMeta = { fields: [], geoField: null };
  try {
    const res = await fetch(
      `${baseUrl(ref.domain)}/api/explore/v2.1/catalog/datasets/${encodeURIComponent(ref.datasetId)}`,
      { headers: { Accept: "application/json" } }
    );
    if (res.ok) {
      const data = (await res.json()) as { fields?: { name?: string; type?: string }[] };
      const fields = (data.fields ?? []).map((f) => f.name).filter((n): n is string => !!n);
      const geo = (data.fields ?? []).find((f) => f.type === "geo_point_2d");
      meta = { fields, geoField: geo?.name ?? null };
    }
  } catch {
    // métadonnées inaccessibles
  }
  metaCache.set(key, meta);
  return meta;
}

function hasField(meta: DatasetMeta, name: string): boolean {
  return meta.fields.includes(name);
}

function escapeOdsString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

export async function searchNearby(
  ref: DatasetRef,
  { lat, lon, radiusM = 1500, limit = 5 }: NearbySearchParams,
): Promise<string> {
  const { geoField } = await getDatasetMeta(ref);
  if (!geoField) {
    return JSON.stringify({
      error: `Le dataset ${ref.datasetId} ne contient pas de champ géographique — utilise l'outil __query avec des filtres (commune_insee, type de bien, surface…) plutôt que __nearby.`,
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

function buildTabularWhere(meta: DatasetMeta, p: TabularSearchParams): string[] {
  const clauses: string[] = [];

  if (p.commune_insee?.trim() && hasField(meta, "l_codinsee")) {
    const code = escapeOdsString(p.commune_insee.trim());
    clauses.push(`search(l_codinsee, '${code}')`);
  }
  if (p.dep_code?.trim() && hasField(meta, "dep_code")) {
    clauses.push(`dep_code='${escapeOdsString(p.dep_code.trim())}'`);
  }
  if (p.property_type === "maison" && hasField(meta, "nblocmai")) {
    clauses.push("nblocmai > 0");
  } else if (p.property_type === "appartement" && hasField(meta, "nblocapt")) {
    clauses.push("nblocapt > 0");
  }
  if (typeof p.min_surface_m2 === "number" && hasField(meta, "sbati")) {
    clauses.push(`sbati >= ${p.min_surface_m2}`);
  }
  if (typeof p.max_surface_m2 === "number" && hasField(meta, "sbati")) {
    clauses.push(`sbati <= ${p.max_surface_m2}`);
  }
  if (typeof p.min_price === "number" && hasField(meta, "valeurfonc")) {
    clauses.push(`valeurfonc >= ${p.min_price}`);
  }
  if (typeof p.max_price === "number" && hasField(meta, "valeurfonc")) {
    clauses.push(`valeurfonc <= ${p.max_price}`);
  }
  if (typeof p.since_year === "number" && hasField(meta, "anneemut")) {
    clauses.push(`anneemut >= '${p.since_year}-01-01'`);
  }
  if (p.search_text?.trim()) {
    clauses.push(`search('${escapeOdsString(p.search_text.trim())}')`);
  }

  return clauses;
}

function summarizeDvfResults(results: Record<string, unknown>[]): Record<string, unknown> | undefined {
  const rows = results
    .map((r) => {
      const price = Number(r.valeurfonc);
      const surface = Number(r.sbati);
      if (!Number.isFinite(price) || !Number.isFinite(surface) || surface <= 0) return null;
      return { price, surface, pricePerM2: Math.round(price / surface) };
    })
    .filter((r): r is { price: number; surface: number; pricePerM2: number } => r !== null);

  if (!rows.length) return undefined;

  const pricesPerM2 = rows.map((r) => r.pricePerM2);
  const avg = Math.round(pricesPerM2.reduce((a, b) => a + b, 0) / pricesPerM2.length);
  return {
    transactions_with_surface: rows.length,
    avg_price_per_m2: avg,
    min_price_per_m2: Math.min(...pricesPerM2),
    max_price_per_m2: Math.max(...pricesPerM2),
    avg_price: Math.round(rows.reduce((a, r) => a + r.price, 0) / rows.length),
    avg_surface_m2: Math.round(rows.reduce((a, r) => a + r.surface, 0) / rows.length),
  };
}

/** Recherche filtrée pour datasets tabulaires (DVF, statistiques…). */
export async function searchRecords(ref: DatasetRef, params: TabularSearchParams): Promise<string> {
  const meta = await getDatasetMeta(ref);
  if (meta.geoField) {
    return JSON.stringify({
      error: `Le dataset ${ref.datasetId} est géolocalisé — utilise l'outil __nearby avec lat/lon plutôt que __query.`,
    });
  }

  const clauses = buildTabularWhere(meta, params);
  if (!clauses.length) {
    return JSON.stringify({
      error:
        "Aucun filtre valide : fournis au minimum commune_insee (code INSEE à 5 chiffres, pas le code postal), dep_code ou search_text. " +
        `Champs disponibles : ${meta.fields.slice(0, 30).join(", ")}${meta.fields.length > 30 ? "…" : ""}.`,
    });
  }

  const limit = Math.min(Math.max(Math.round(params.limit ?? 15), 1), 50);
  const qs = new URLSearchParams({
    where: clauses.join(" AND "),
    limit: String(limit),
    order_by: hasField(meta, "datemut") ? "datemut DESC" : hasField(meta, "anneemut") ? "anneemut DESC" : "",
  });
  if (!qs.get("order_by")) qs.delete("order_by");

  const url = `${baseUrl(ref.domain)}/api/explore/v2.1/catalog/datasets/${encodeURIComponent(
    ref.datasetId,
  )}/records?${qs}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return JSON.stringify({
      error: `Le portail ${ref.domain} a répondu ${res.status}.`,
      detail: body.slice(0, 400),
    });
  }

  const data = (await res.json()) as { total_count?: number; results?: Record<string, unknown>[] };
  const results = data.results ?? [];
  const summary = hasField(meta, "valeurfonc") && hasField(meta, "sbati") ? summarizeDvfResults(results) : undefined;

  return JSON.stringify({
    dataset: ref.datasetId,
    total_matching: data.total_count ?? results.length,
    filters_applied: clauses,
    ...(summary ? { market_summary: summary } : {}),
    results,
  });
}

/** Instructions runtime injectées dans le prompt selon le type de dataset. */
export function buildDatasetRuntimeInstructions(
  datasets: (DatasetRef & { label: string })[],
  metas: DatasetMeta[],
): string {
  const parts: string[] = [];
  for (let i = 0; i < datasets.length; i++) {
    const ds = datasets[i];
    const meta = metas[i];
    if (meta.geoField) {
      parts.push(
        `Dataset « ${ds.label} » (${ds.datasetId}) : géolocalisé — outil __nearby avec lat/lon. Demande la position via <!--GEOLOC_REQUEST--> si elle n'est pas déjà dans le contexte.`,
      );
    } else {
      parts.push(
        `Dataset « ${ds.label} » (${ds.datasetId}) : tabulaire (sans GPS) — outil __query. ` +
          "Pour une commune, utilise le code INSEE à 5 chiffres (ex. Matignon 22550 → INSEE 22118), pas le code postal. " +
          "Filtres utiles : commune_insee, dep_code, property_type (maison/appartement), min/max surface et prix, since_year. " +
          "Ne demande pas la géolocalisation pour ce dataset.",
      );
    }
  }
  return parts.length ? `\n\n[Connecteurs dataset — mode d'emploi]\n${parts.join("\n")}` : "";
}
