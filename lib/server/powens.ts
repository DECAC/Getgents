// Connecteur Powens (agrégation bancaire) — MODE SANDBOX.
// Toute l'authentification vit côté serveur : POWENS_DOMAIN, POWENS_CLIENT_ID,
// POWENS_CLIENT_SECRET et (recommandé) POWENS_USER_TOKEN — jamais exposés au
// navigateur. Pensé pour des données de test Powens, pas des comptes réels :
// les conversations de la maquette ne sont ni chiffrées ni isolées par
// utilisateur.

function baseUrl(): string | null {
  if (process.env.POWENS_BASE_OVERRIDE) return process.env.POWENS_BASE_OVERRIDE;
  const domain = process.env.POWENS_DOMAIN;
  return domain ? `https://${domain}.biapi.pro/2.0` : null;
}

const MISSING_CONF_MSG = JSON.stringify({
  error:
    "Connecteur Powens non configuré côté serveur : définissez POWENS_DOMAIN, POWENS_CLIENT_ID et POWENS_CLIENT_SECRET (console Powens, mode sandbox) sur l'hébergement.",
});

// Jeton utilisateur : POWENS_USER_TOKEN si fourni (recommandé — stable entre
// déploiements), sinon un utilisateur sandbox est créé via /auth/init et son
// jeton gardé en mémoire (durée de vie du process serveur uniquement).
let cachedToken: string | null = null;

async function getUserToken(): Promise<{ token: string } | { error: string }> {
  if (process.env.POWENS_USER_TOKEN) return { token: process.env.POWENS_USER_TOKEN };
  if (cachedToken) return { token: cachedToken };
  const base = baseUrl();
  const clientId = process.env.POWENS_CLIENT_ID;
  const clientSecret = process.env.POWENS_CLIENT_SECRET;
  if (!base || !clientId || !clientSecret) return { error: MISSING_CONF_MSG };

  const res = await fetch(`${base}/auth/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    return { error: JSON.stringify({ error: `Powens /auth/init a répondu ${res.status}. Détail : ${detail}` }) };
  }
  const data = (await res.json()) as { auth_token?: string };
  if (!data.auth_token) return { error: JSON.stringify({ error: "Powens /auth/init n'a pas renvoyé de jeton." }) };
  cachedToken = data.auth_token;
  return { token: cachedToken };
}

async function powensGet(path: string): Promise<string> {
  const base = baseUrl();
  if (!base) return MISSING_CONF_MSG;
  const auth = await getUserToken();
  if ("error" in auth) return auth.error;
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${auth.token}`, Accept: "application/json" } });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    return JSON.stringify({
      error: `Powens a répondu ${res.status} sur ${path}. Détail : ${detail}. Si aucun compte n'est lié, le créateur doit lier une banque sandbox via « Lier un compte (webview) » dans l'onglet Connecteurs.`,
    });
  }
  return (await res.text()).slice(0, 12_000);
}

/** Comptes bancaires (sandbox) de l'utilisateur lié. */
export function accounts(): Promise<string> {
  return powensGet("/users/me/accounts");
}

/** Transactions (sandbox), optionnellement bornées par date (AAAA-MM-JJ) et limitées. */
export function transactions(minDate?: string, limit = 100): Promise<string> {
  const n = Math.min(Math.max(Math.round(limit), 1), 500);
  const params = new URLSearchParams({ limit: String(n) });
  if (minDate && /^\d{4}-\d{2}-\d{2}$/.test(minDate)) params.set("min_date", minDate);
  return powensGet(`/users/me/transactions?${params}`);
}

/**
 * URL de la webview Powens pour lier une banque sandbox au compte utilisateur
 * du serveur (code temporaire à usage unique dérivé du jeton).
 */
export async function connectWebviewUrl(redirectUri: string): Promise<{ url: string } | { error: string }> {
  const base = baseUrl();
  const domain = process.env.POWENS_DOMAIN;
  const clientId = process.env.POWENS_CLIENT_ID;
  if (!base || !clientId) return { error: MISSING_CONF_MSG };
  const auth = await getUserToken();
  if ("error" in auth) return { error: auth.error };

  const res = await fetch(`${base}/auth/token/code`, {
    headers: { Authorization: `Bearer ${auth.token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    return { error: JSON.stringify({ error: `Powens /auth/token/code a répondu ${res.status}. Détail : ${detail}` }) };
  }
  const data = (await res.json()) as { code?: string };
  if (!data.code) return { error: JSON.stringify({ error: "Powens n'a pas renvoyé de code temporaire." }) };

  const params = new URLSearchParams({
    domain: `${domain}.biapi.pro`,
    client_id: clientId,
    code: data.code,
    redirect_uri: redirectUri,
  });
  return { url: `https://webview.powens.com/connect?${params}` };
}
