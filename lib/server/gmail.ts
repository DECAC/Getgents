// Connecteur Gmail — OAuth Google + API Gmail (lecture et envoi).
// Les jetons sont stockés par gent dans Supabase (integration_credentials).
// Secrets plateforme : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.

import {
  deleteCredential,
  getCredential,
  upsertCredential,
  type StoredCredential,
} from "@/lib/server/integrationCredentials";

export const GMAIL_PROVIDER = "gmail";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const MISSING_CONF = JSON.stringify({
  error:
    "Connecteur Gmail non configuré côté serveur : définissez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET (console Google Cloud → APIs & Services → Identifiants → OAuth 2.0).",
});

function googleClientId(): string | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  return id || null;
}

function googleClientSecret(): string | null {
  const s = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return s || null;
}

export function isGmailConfigured(): boolean {
  return !!googleClientId() && !!googleClientSecret();
}

export function redirectUri(origin: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || origin).replace(/\/$/, "");
  return `${base}/api/gmail/callback`;
}

/** État OAuth signé en base64url (gentId + expiration 10 min). */
export function encodeOAuthState(gentId: string): string {
  return Buffer.from(JSON.stringify({ gentId, exp: Date.now() + 600_000 }), "utf8").toString("base64url");
}

export function decodeOAuthState(state: string): { gentId: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      gentId?: string;
      exp?: number;
    };
    if (!parsed.gentId || typeof parsed.exp !== "number" || Date.now() > parsed.exp) return null;
    return { gentId: parsed.gentId };
  } catch {
    return null;
  }
}

export function consentUrl(gentId: string, origin: string): { url: string } | { error: string } {
  const clientId = googleClientId();
  if (!clientId || !googleClientSecret()) return { error: MISSING_CONF };
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: encodeOAuthState(gentId),
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function exchangeCode(code: string, origin: string): Promise<TokenResponse> {
  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) return { error: "missing_config" };
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  return (await res.json()) as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) return { error: "missing_config" };
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  return (await res.json()) as TokenResponse;
}

async function fetchUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

/** Échange le code OAuth et enregistre les jetons pour le gent. */
export async function handleOAuthCallback(
  code: string,
  gentId: string,
  origin: string
): Promise<{ email: string | null } | { error: string }> {
  const tokens = await exchangeCode(code, origin);
  if (tokens.error || !tokens.access_token) {
    return {
      error: tokens.error_description ?? tokens.error ?? "Échec de l'échange du code OAuth Google.",
    };
  }
  const email = await fetchUserEmail(tokens.access_token);
  const expiresAt =
    typeof tokens.expires_in === "number" ? new Date(Date.now() + tokens.expires_in * 1000) : null;
  const existing = await getCredential(gentId, GMAIL_PROVIDER);
  const saved = await upsertCredential({
    gentId,
    provider: GMAIL_PROVIDER,
    email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? null,
    expiresAt,
    scopes: GMAIL_SCOPES,
  });
  if ("error" in saved) return saved;
  return { email };
}

export async function getConnectionStatus(gentId: string): Promise<{ connected: boolean; email?: string }> {
  const cred = await getCredential(gentId, GMAIL_PROVIDER);
  if (!cred?.refreshToken && !cred?.accessToken) return { connected: false };
  return { connected: true, email: cred.email ?? undefined };
}

export async function disconnectGmail(gentId: string): Promise<void> {
  await deleteCredential(gentId, GMAIL_PROVIDER);
}

async function validAccessToken(gentId: string): Promise<{ token: string } | { error: string }> {
  const cred = await getCredential(gentId, GMAIL_PROVIDER);
  if (!cred) {
    return {
      error: JSON.stringify({
        error:
          "Gmail non connecté pour ce gent. Le créateur doit cliquer sur « Connecter un compte Google » dans l'onglet Connecteurs du studio.",
      }),
    };
  }
  const stillValid = cred.expiresAt && cred.expiresAt.getTime() > Date.now() + 60_000;
  if (stillValid) return { token: cred.accessToken };

  if (!cred.refreshToken) {
    return {
      error: JSON.stringify({
        error: "Jeton Gmail expiré — reconnectez le compte Google dans l'onglet Connecteurs.",
      }),
    };
  }

  const refreshed = await refreshAccessToken(cred.refreshToken);
  if (refreshed.error || !refreshed.access_token) {
    return {
      error: JSON.stringify({
        error: `Impossible de renouveler l'accès Gmail : ${refreshed.error_description ?? refreshed.error ?? "erreur inconnue"}. Reconnectez le compte Google.`,
      }),
    };
  }
  const expiresAt =
    typeof refreshed.expires_in === "number" ? new Date(Date.now() + refreshed.expires_in * 1000) : null;
  await upsertCredential({
    ...cred,
    accessToken: refreshed.access_token,
    expiresAt,
  });
  return { token: refreshed.access_token };
}

async function gmailGet(gentId: string, path: string): Promise<string> {
  const auth = await validAccessToken(gentId);
  if ("error" in auth) return auth.error;
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    headers: { Authorization: `Bearer ${auth.token}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    return JSON.stringify({
      error: `Gmail API ${path} a répondu ${res.status}. Détail : ${text.slice(0, 400)}`,
    });
  }
  return text.slice(0, 12_000);
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function extractPlainText(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }[];
}): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractPlainText(part as typeof payload);
    if (text) return text;
  }
  return "";
}

/** Recherche de messages Gmail (syntaxe de recherche Gmail). */
export function searchMessages(gentId: string, query?: string, maxResults = 10): Promise<string> {
  const n = Math.min(Math.max(Math.round(maxResults), 1), 25);
  const params = new URLSearchParams({ maxResults: String(n) });
  if (query?.trim()) params.set("q", query.trim());
  return gmailGet(gentId, `/users/me/messages?${params}`);
}

/** Contenu d'un message (en-têtes + corps texte). */
export async function getMessage(gentId: string, messageId: string): Promise<string> {
  if (!messageId?.trim()) {
    return JSON.stringify({ error: "Identifiant de message requis." });
  }
  const auth = await validAccessToken(gentId);
  if ("error" in auth) return auth.error;
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId.trim())}?format=full`,
    { headers: { Authorization: `Bearer ${auth.token}`, Accept: "application/json" } }
  );
  const text = await res.text();
  if (!res.ok) {
    return JSON.stringify({
      error: `Gmail get message a répondu ${res.status}. Détail : ${text.slice(0, 400)}`,
    });
  }
  try {
    const data = JSON.parse(text) as {
      id?: string;
      snippet?: string;
      payload?: { headers?: { name: string; value: string }[]; mimeType?: string; body?: { data?: string }; parts?: unknown[] };
    };
    const headers = Object.fromEntries(
      (data.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value])
    );
    const body = data.payload ? extractPlainText(data.payload as Parameters<typeof extractPlainText>[0]) : "";
    return JSON.stringify({
      id: data.id,
      from: headers.from,
      to: headers.to,
      subject: headers.subject,
      date: headers.date,
      snippet: data.snippet,
      body: body.slice(0, 8000),
    }).slice(0, 12_000);
  } catch {
    return text.slice(0, 12_000);
  }
}

function encodeRawEmail(to: string, subject: string, body: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");
  return Buffer.from(lines, "utf8").toString("base64url");
}

/** Envoi d'un e-mail via le compte Gmail connecté. */
export async function sendMessage(
  gentId: string,
  to: string,
  subject: string,
  body: string
): Promise<string> {
  if (!to?.trim() || !subject?.trim()) {
    return JSON.stringify({ error: "Destinataire (to) et objet (subject) sont requis." });
  }
  const auth = await validAccessToken(gentId);
  if ("error" in auth) return auth.error;
  const raw = encodeRawEmail(to.trim(), subject.trim(), body ?? "");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  const text = await res.text();
  if (!res.ok) {
    return JSON.stringify({
      error: `Gmail send a répondu ${res.status}. Détail : ${text.slice(0, 400)}`,
    });
  }
  return text.slice(0, 2000);
}
