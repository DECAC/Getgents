// Client serveur de l'API Opendatasoft Explore v2.1 — recherche par proximité
// (datasets géolocalisés) ou par filtres (datasets tabulaires type DVF).

import {
  normalizeDatasetRef,
  type DatasetRef,
  DVF_CANONICAL_DATASET_ID,
} from "@/lib/opendatasoft";

function baseUrl(domain: string): string {
  return process.env.OPENDATASOFT_BASE_OVERRIDE ?? `https://${domain}`;
}

export interface NearbySearchParams {
  lat: number;
  lon: number;
  radiusM?: number;
  limit?: number;
}

export interface TabularSearchParams {
  commune_insee?: string;
  /** Nom de commune (ex. Matignon) — secours si le code INSEE est inconnu. */
  commune_name?: string;
  dep_code?: string;
  property_type?: "maison" | "appartement";
  min_surface_m2?: number;
  max_surface_m2?: number;
  min_price?: number;
  max_price?: number;
  since_year?: number;
  search_text?: string;
  limit?: number;
}

export interface DatasetMeta {
  fields: string[];
  geoField: string | null;
  ok: boolean;
}

const metaCache = new Map<string, DatasetMeta>();

function metaCacheKey(ref: DatasetRef): string {
  const n = normalizeDatasetRef(ref);
  return `${n.domain}/${n.datasetId}`;
}

/** Métadonnées du dataset — ne met pas en cache les échecs (404, réseau). */
export async function getDatasetMeta(ref: DatasetRef): Promise<DatasetMeta> {
  const normalized = normalizeDatasetRef(ref);
  const key = metaCacheKey(normalized);
  if (metaCache.has(key)) return metaCache.get(key)!;

  let meta: DatasetMeta = { fields: [], geoField: null, ok: false };
  try {
    const res = await fetch(
      `${baseUrl(normalized.domain)}/api/explore/v2.1/catalog/datasets/${encodeURIComponent(normalized.datasetId)}`,
      { headers: { Accept: "application/json" } }
    );
    if (res.ok) {
      const data = (await res.json()) as { fields?: { name?: string; type?: string }[] };
      const fields = (data.fields ?? []).map((f) => f.name).filter((n): n is string => !!n);
      const geo = (data.fields ?? []).find((f) => f.type === "geo_point_2d");
      meta = { fields, geoField: geo?.name ?? null, ok: true };
      metaCache.set(key, meta);
    }
  } catch {
    // métadonnées inaccessibles — ne pas mettre en cache
  }
  return meta;
}

function hasField(meta: DatasetMeta, ...names: string[]): boolean {
  return names.some((n) => meta.fields.includes(n));
}

function firstField(meta: DatasetMeta, ...names: string[]): string | null {
  return names.find((n) => meta.fields.includes(n)) ?? null;
}

function escapeOdsString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

export async function searchNearby(
  ref: DatasetRef,
  { lat, lon, radiusM = 1500, limit = 5 }: NearbySearchParams,
): Promise<string> {
  const normalized = normalizeDatasetRef(ref);
  const meta = await getDatasetMeta(normalized);
  if (!meta.ok) {
    return JSON.stringify({
      error: `Dataset introuvable ou inaccessible : ${normalized.datasetId} sur ${normalized.domain}.`,
      hint:
        normalized.datasetId !== DVF_CANONICAL_DATASET_ID
          ? `Utilise plutôt le dataset DVF officiel : ${DVF_CANONICAL_DATASET_ID}`
          : undefined,
    });
  }
  if (!meta.geoField) {
    return JSON.stringify({
      error: `Le dataset ${normalized.datasetId} ne contient pas de champ géographique — utilise l'outil __query avec commune_insee (code INSEE), dep_code ou commune_name plutôt que __nearby.`,
      available_fields: meta.fields.slice(0, 25),
    });
  }

  const radius = Math.min(Math.max(Math.round(radiusM), 50), 20_000);
  const n = Math.min(Math.max(Math.round(limit), 1), 20);
  const point = `geom'POINT(${lon} ${lat})'`;
  const params = new URLSearchParams({
    where: `within_distance(${meta.geoField}, ${point}, ${radius}m)`,
    order_by: `distance(${meta.geoField}, ${point})`,
    limit: String(n),
  });
  const url = `${baseUrl(normalized.domain)}/api/explore/v2.1/catalog/datasets/${encodeURIComponent(
    normalized.datasetId,
  )}/records?${params}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    return JSON.stringify({ error: `Le portail ${normalized.domain} a répondu ${res.status}.` });
  }
  const data = (await res.json()) as { total_count?: number; results?: Record<string, unknown>[] };
  return JSON.stringify({
    dataset: normalized.datasetId,
    total_in_radius: data.total_count ?? data.results?.length ?? 0,
    radius_m: radius,
    results: data.results ?? [],
  });
}

function buildTabularWhere(meta: DatasetMeta, p: TabularSearchParams): string[] {
  const clauses: string[] = [];

  const inseeField = firstField(meta, "l_codinsee", "code_commune", "codinsee", "insee_com");
  if (p.commune_insee?.trim() && inseeField) {
    clauses.push(`search(${inseeField}, '${escapeOdsString(p.commune_insee.trim())}')`);
  }

  const depField = firstField(meta, "dep_code", "code_departement", "dep");
  if (p.dep_code?.trim() && depField) {
    clauses.push(`${depField}='${escapeOdsString(p.dep_code.trim())}'`);
  }

  if (p.property_type === "maison" && hasField(meta, "nblocmai")) {
    clauses.push("nblocmai > 0");
  } else if (p.property_type === "maison" && hasField(meta, "type_local")) {
    clauses.push("search(type_local, 'Maison')");
  } else if (p.property_type === "appartement" && hasField(meta, "nblocapt")) {
    clauses.push("nblocapt > 0");
  } else if (p.property_type === "appartement" && hasField(meta, "type_local")) {
    clauses.push("search(type_local, 'Appartement')");
  }

  const surfaceField = firstField(meta, "sbati", "surface_reelle_bati", "surface_totale", "surface");
  if (typeof p.min_surface_m2 === "number" && surfaceField) {
    clauses.push(`${surfaceField} >= ${p.min_surface_m2}`);
  }
  if (typeof p.max_surface_m2 === "number" && surfaceField) {
    clauses.push(`${surfaceField} <= ${p.max_surface_m2}`);
  }

  const priceField = firstField(meta, "valeurfonc", "valeur_fonciere", "prix");
  if (typeof p.min_price === "number" && priceField) {
    clauses.push(`${priceField} >= ${p.min_price}`);
  }
  if (typeof p.max_price === "number" && priceField) {
    clauses.push(`${priceField} <= ${p.max_price}`);
  }

  const dateField = firstField(meta, "datemut", "date_mutation", "anneemut");
  if (typeof p.since_year === "number" && dateField) {
    clauses.push(`${dateField} >= '${p.since_year}-01-01'`);
  }

  if (p.commune_name?.trim()) {
    const communeField = firstField(meta, "nom_commune", "libcom", "commune");
    if (communeField) {
      clauses.push(`search(${communeField}, '${escapeOdsString(p.commune_name.trim())}')`);
    } else {
      clauses.push(`search('${escapeOdsString(p.commune_name.trim())}')`);
    }
  }

  if (p.search_text?.trim()) {
    clauses.push(`search('${escapeOdsString(p.search_text.trim())}')`);
  }

  return clauses;
}

function extractPriceSurface(row: Record<string, unknown>): { price: number; surface: number } | null {
  const price = Number(row.valeurfonc ?? row.valeur_fonciere ?? row.prix);
  const surface = Number(row.sbati ?? row.surface_reelle_bati ?? row.surface_totale ?? row.surface);
  if (!Number.isFinite(price) || !Number.isFinite(surface) || surface <= 0) return null;
  return { price, surface };
}

function summarizeDvfResults(results: Record<string, unknown>[]): Record<string, unknown> | undefined {
  const rows = results
    .map((r) => {
      const ps = extractPriceSurface(r);
      if (!ps) return null;
      return { ...ps, pricePerM2: Math.round(ps.price / ps.surface) };
    })
    .filter((r): r is { price: number; surface: number; pricePerM2: number } => r !== null);

  if (!rows.length) return undefined;

  const pricesPerM2 = rows.map((r) => r.pricePerM2);
  return {
    transactions_with_surface: rows.length,
    avg_price_per_m2: Math.round(pricesPerM2.reduce((a, b) => a + b, 0) / pricesPerM2.length),
    min_price_per_m2: Math.min(...pricesPerM2),
    max_price_per_m2: Math.max(...pricesPerM2),
    avg_price: Math.round(rows.reduce((a, r) => a + r.price, 0) / rows.length),
    avg_surface_m2: Math.round(rows.reduce((a, r) => a + r.surface, 0) / rows.length),
  };
}

/** Recherche filtrée pour datasets tabulaires (DVF, statistiques…). */
export async function searchRecords(ref: DatasetRef, params: TabularSearchParams): Promise<string> {
  const normalized = normalizeDatasetRef(ref);
  const meta = await getDatasetMeta(normalized);

  if (!meta.ok) {
    return JSON.stringify({
      error: `Dataset introuvable : ${ref.datasetId} (normalisé → ${normalized.datasetId} sur ${normalized.domain}).`,
      hint: `Dataset DVF recommandé : ${DVF_CANONICAL_DATASET_ID} sur ${normalized.domain}`,
    });
  }

  if (meta.geoField) {
    return JSON.stringify({
      error: `Le dataset ${normalized.datasetId} est géolocalisé — utilise __nearby avec lat/lon plutôt que __query.`,
    });
  }

  const clauses = buildTabularWhere(meta, params);
  if (!clauses.length) {
    return JSON.stringify({
      error:
        "Aucun filtre valide : fournis commune_insee (code INSEE 5 chiffres, ex. Matignon → 22118), commune_name, dep_code (ex. 22) ou search_text. " +
        "Ne confonds pas code postal (22550) et code INSEE (22118).",
      available_fields: meta.fields.slice(0, 30),
      example_for_matignon: {
        commune_insee: "22118",
        dep_code: "22",
        property_type: "maison",
        min_surface_m2: 80,
        max_surface_m2: 200,
        since_year: 2019,
      },
    });
  }

  const limit = Math.min(Math.max(Math.round(params.limit ?? 15), 1), 50);
  const dateField = firstField(meta, "datemut", "date_mutation", "anneemut");
  const qs = new URLSearchParams({
    where: clauses.join(" AND "),
    limit: String(limit),
    ...(dateField ? { order_by: `${dateField} DESC` } : {}),
  });

  const url = `${baseUrl(normalized.domain)}/api/explore/v2.1/catalog/datasets/${encodeURIComponent(
    normalized.datasetId,
  )}/records?${qs}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return JSON.stringify({
      error: `Le portail ${normalized.domain} a répondu ${res.status}.`,
      detail: body.slice(0, 400),
    });
  }

  const data = (await res.json()) as { total_count?: number; results?: Record<string, unknown>[] };
  const results = data.results ?? [];
  const summary = results.some((r) => extractPriceSurface(r)) ? summarizeDvfResults(results) : undefined;

  return JSON.stringify({
    dataset: normalized.datasetId,
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
    const ds = normalizeDatasetRef(datasets[i]);
    const meta = metas[i];
    if (!meta.ok) {
      parts.push(
        `Dataset « ${datasets[i].label} » : ERREUR — dataset introuvable ou URL obsolète. Ne réessaie pas : bascule sur recherche web.`,
      );
      continue;
    }
    if (meta.geoField) {
      parts.push(`Dataset « ${datasets[i].label} » (${ds.datasetId}) : géolocalisé — outil __nearby avec lat/lon.`);
    } else {
      parts.push(
        `Dataset « ${datasets[i].label} » (${ds.datasetId}) : tabulaire DVF — outil __query OBLIGATOIRE avec au minimum commune_insee OU commune_name + dep_code. ` +
          "Ex. Matignon (22550) → commune_insee=22118, dep_code=22, property_type=maison. " +
          "N'appelle pas __query sans ces filtres. Maximum 1 appel dataset par analyse.",
      );
    }
  }
  return parts.length ? `\n\n[Connecteurs dataset — mode d'emploi]\n${parts.join("\n")}` : "";
}
