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
function resolveSecretInfo(value: string): { value: string; envName: string | null } {
  const trimmed = value.trim();
  const envMatch = trimmed.match(/^env:([A-Z0-9_]+)$/i) || trimmed.match(/^\$\{([A-Z0-9_]+)\}$/i);
  if (envMatch) return { value: process.env[envMatch[1]] ?? "", envName: envMatch[1] };
  return { value: trimmed, envName: null };
}

function resolveSecret(value: string): string {
  return resolveSecretInfo(value).value;
}

function isPlainString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

// Noms de paramètres considérés comme sensibles → masqués dans les diagnostics.
const SECRETISH_PARAM = /(key|secret|token|password|pwd|auth|app_?id|apikey|client_?id)/i;

/** URL lisible pour le diagnostic, avec les valeurs sensibles remplacées par ***. */
function maskUrl(u: URL, extraSecretNames: Set<string>): string {
  const clone = new URL(u.toString());
  const extra = new Set(Array.from(extraSecretNames).map((s) => s.toLowerCase()));
  for (const name of Array.from(clone.searchParams.keys())) {
    if (extra.has(name.toLowerCase()) || SECRETISH_PARAM.test(name)) {
      clone.searchParams.set(name, "***");
    }
  }
  return clone.toString();
}

/** Résume un corps d'erreur : titre d'une page HTML, ou extrait du texte/JSON. */
function summarizeErrorBody(text: string): string {
  const trimmed = text.trim();
  if (/^<(!doctype|html|\?xml)/i.test(trimmed)) {
    const title = trimmed.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    return title
      ? `réponse HTML du serveur « ${title} » (ce n'est pas du JSON : requête rejetée avant l'application, souvent une URL/paramètre invalide ou des identifiants refusés)`
      : "réponse HTML du serveur (pas de JSON — requête probablement rejetée avant l'application)";
  }
  return trimmed.slice(0, 500) || "(réponse vide)";
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
    const { value: key, envName } = resolveSecretInfo(config.auth.value);
    // Clé absente : message explicite plutôt que de laisser l'API renvoyer un
    // 401 opaque — c'est la cause d'échec la plus fréquente en test.
    if (!key) {
      return {
        text: envName
          ? `Clé API absente : la variable d'environnement « ${envName} » n'est pas définie côté serveur. ` +
            `Définissez-la (par exemple dans un fichier .env.local à la racine du projet : ${envName}=votre_clé) puis redémarrez le serveur, ` +
            `ou saisissez directement la clé dans le champ « Clé d'API » du connecteur (builder → onglet Connecteurs).`
          : `Clé API absente : saisissez la clé dans le champ « Clé d'API » du connecteur (builder → onglet Connecteurs), ` +
            `ou utilisez env:NOM_DE_VARIABLE avec la variable définie côté serveur.`,
        ok: false,
      };
    }
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

  // URL réellement appelée, secrets masqués — jointe aux diagnostics pour que
  // le créateur (et le modèle) voient les paramètres envoyés et se corrigent.
  const secretNames = new Set<string>();
  if (config.auth?.mode === "api-key" && config.auth.placement === "query" && config.auth.fieldName.trim()) {
    secretNames.add(config.auth.fieldName.trim());
  }
  const masked = maskUrl(url, secretNames);

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
      return {
        text:
          `Erreur HTTP ${res.status} — URL appelée : ${masked}${config.method === "POST" ? ` (corps JSON : ${JSON.stringify(bodyPayload).slice(0, 300)})` : ""}. ` +
          `Détail : ${summarizeErrorBody(text)}. ` +
          `Conseils : vérifie que chaque paramètre a une valeur valide pour cette API (un nom de ville/région ou un code seul, une date au bon format — pas une phrase libre), retire les paramètres optionnels douteux, et confirme les identifiants (teste l'URL ci-dessus dans un navigateur avec tes vraies clés). Ne répète pas le même appel à l'identique.`,
        ok: false,
      };
    }
    return { text, ok: true };
  } catch (err) {
    const message = (err as Error).name === "AbortError" ? "délai dépassé (15 s)" : (err as Error).message;
    return { text: `Échec de l'appel API (${masked}) : ${message}`, ok: false };
  } finally {
    clearTimeout(timeout);
  }
}
