// Exécution côté serveur d'un connecteur « API REST » configuré à la main dans
// le builder. Les paramètres fixes (ex. engine=google_flights), l'éventuelle
// clé API et les paramètres fournis par le modèle sont combinés pour former une
// requête HTTP réelle, dont la réponse (texte/JSON) est renvoyée au modèle.
import type { RestApiToolConfig } from "@/lib/types";

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Résout la valeur d'une clé : littérale, ou lue dans une variable
 * d'environnement serveur si elle est notée `env:NOM` ou `${NOM}`.
 * Permet de garder un vrai secret côté serveur plutôt que dans le navigateur.
 */
function resolveSecret(value: string): string {
  const trimmed = value.trim();
  const envMatch = trimmed.match(/^env:([A-Z0-9_]+)$/i) || trimmed.match(/^\$\{([A-Z0-9_]+)\}$/i);
  if (envMatch) return process.env[envMatch[1]] ?? "";
  return trimmed;
}

function isPlainString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/**
 * Construit et exécute la requête. `args` sont les paramètres fournis par le
 * modèle (mappés par nom sur les modelParams). Renvoie le corps de réponse en
 * texte (tronqué par l'appelant) et un indicateur de succès.
 */
export async function callRestApi(
  config: RestApiToolConfig,
  args: Record<string, unknown>
): Promise<{ text: string; ok: boolean }> {
  let url: URL;
  try {
    url = new URL(config.baseUrl);
  } catch {
    return { text: `URL de base invalide : ${config.baseUrl}`, ok: false };
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  for (const h of config.headers ?? []) {
    if (h.name.trim()) headers[h.name.trim()] = resolveSecret(h.value);
  }

  // Paramètres fixes définis par le créateur (ex. engine=google_flights).
  for (const q of config.queryParams ?? []) {
    if (q.name.trim()) url.searchParams.set(q.name.trim(), resolveSecret(q.value));
  }

  // Authentification par clé API (en-tête ou paramètre de requête).
  if (config.auth?.mode === "api-key" && config.auth.fieldName.trim()) {
    const key = resolveSecret(config.auth.value);
    if (config.auth.placement === "header") {
      headers[config.auth.fieldName.trim()] = key;
    } else {
      url.searchParams.set(config.auth.fieldName.trim(), key);
    }
  }

  // Paramètres remplis par le modèle : en query pour GET, en corps JSON pour POST.
  const modelParamNames = new Set((config.modelParams ?? []).map((p) => p.name));
  const bodyPayload: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(args)) {
    if (!modelParamNames.has(name)) continue;
    if (config.method === "POST") {
      bodyPayload[name] = value;
    } else if (isPlainString(value) || typeof value === "number" || typeof value === "boolean") {
      url.searchParams.set(name, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const init: RequestInit = { method: config.method, headers, signal: controller.signal };
    if (config.method === "POST") {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(bodyPayload);
    }
    const res = await fetch(url.toString(), init);
    const text = await res.text();
    if (!res.ok) {
      return { text: `Erreur HTTP ${res.status} : ${text.slice(0, 800)}`, ok: false };
    }
    return { text, ok: true };
  } catch (err) {
    const message = (err as Error).name === "AbortError" ? "délai dépassé (15 s)" : (err as Error).message;
    return { text: `Échec de l'appel API : ${message}`, ok: false };
  } finally {
    clearTimeout(timeout);
  }
}
