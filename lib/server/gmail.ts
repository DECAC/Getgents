import { createHmac, timingSafeEqual } from "node:crypto";
import { generateImageFromPrompt } from "@/lib/server/generateImage";
import type { ContexteLlm } from "@/lib/server/openRouterKey";
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
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
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
/**
 * Le `state` OAuth n'était que du base64 en clair : lisible, et surtout
 * FORGEABLE. Il suffisait d'y écrire l'identifiant du gent de quelqu'un
 * d'autre et de terminer le parcours Google pour rattacher un compte Gmail à
 * un gent qui ne vous appartient pas — ou, sur un lien envoyé à la victime,
 * pour capter le sien.
 *
 * Il est désormais signé, et porte l'identifiant du compte qui a lancé la
 * connexion : le callback vérifie que c'est bien la même personne qui revient.
 * La clé de signature est GOOGLE_CLIENT_SECRET, déjà nécessaire au connecteur
 * — pas de variable d'environnement supplémentaire à configurer et à oublier.
 */
function stateKey(): string {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

function signState(payload: string): string {
  return createHmac("sha256", stateKey()).update(payload).digest("base64url");
}

export function encodeOAuthState(gentId: string, userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ gentId, userId, exp: Date.now() + 600_000 }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${signState(payload)}`;
}

export function decodeOAuthState(state: string): { gentId: string; userId: string } | null {
  try {
    const [payload, signature] = state.split(".");
    if (!payload || !signature) return null;

    const attendue = signState(payload);
    // Comparaison à temps constant : une comparaison naïve laisserait deviner
    // la signature octet par octet en mesurant le temps de réponse.
    const a = Buffer.from(signature);
    const b = Buffer.from(attendue);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      gentId?: string;
      userId?: string;
      exp?: number;
    };
    if (!parsed.gentId || !parsed.userId) return null;
    if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) return null;
    return { gentId: parsed.gentId, userId: parsed.userId };
  } catch {
    return null;
  }
}

export function consentUrl(gentId: string, origin: string, userId: string): { url: string } | { error: string } {
  const clientId = googleClientId();
  if (!clientId || !googleClientSecret()) return { error: MISSING_CONF };
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: encodeOAuthState(gentId, userId),
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

function encodeSubject(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  const b64 = Buffer.from(subject, "utf8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function resolveImageBytes(
  ctx: ContexteLlm,
  imageUrl?: string,
  imagePrompt?: string
): Promise<{ bytes: Buffer; mimeType: string } | { error: string }> {
  let url = imageUrl?.trim();
  if (!url && imagePrompt?.trim()) {
    const generated = await generateImageFromPrompt(imagePrompt.trim(), ctx);
    if ("error" in generated) return generated;
    url = generated.imageUrl;
  }
  if (!url) return { error: "Aucune image fournie (imageUrl ou imagePrompt requis)." };

  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return { error: "URL data:image invalide." };
    return { bytes: Buffer.from(m[2], "base64"), mimeType: m[1] || "image/png" };
  }

  if (!url.startsWith("https://")) {
    return { error: "imageUrl doit être une URL https:// ou data:image/…" };
  }

  const res = await fetch(url);
  if (!res.ok) {
    return { error: `Impossible de télécharger l'image (${res.status}).` };
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length) return { error: "Image téléchargée vide." };
  return { bytes, mimeType };
}

function encodeHtmlEmail(to: string, subject: string, htmlBody: string, textBody: string): string {
  const boundary = `getgents_alt_${Date.now()}`;
  const lines = [
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    textBody || stripTags(htmlBody),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "",
    htmlBody,
    `--${boundary}--`,
  ].join("\r\n");
  return Buffer.from(lines, "utf8").toString("base64url");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function encodePlainEmail(to: string, subject: string, body: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
    "",
    body,
  ].join("\r\n");
  return Buffer.from(lines, "utf8").toString("base64url");
}

function encodeHtmlEmailWithInlineImage(
  to: string,
  subject: string,
  htmlBody: string,
  imageBytes: Buffer,
  mimeType: string
): string {
  const boundary = `getgents_${Date.now()}`;
  const cid = "inline-image";
  const imageBase64 = imageBytes.toString("base64");
  const lines = [
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    htmlBody.includes("cid:") ? htmlBody : `${htmlBody}<br><img src="cid:${cid}" alt="Illustration" style="max-width:480px;height:auto;" />`,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "Content-Transfer-Encoding: base64",
    `Content-ID: <${cid}>`,
    "",
    imageBase64,
    `--${boundary}--`,
  ].join("\r\n");
  return Buffer.from(lines, "utf8").toString("base64url");
}

export interface GmailSendOptions {
  htmlBody?: string;
  imageUrl?: string;
  imagePrompt?: string;
}

/** Envoi d'un e-mail via le compte Gmail connecté (texte, HTML et image inline optionnels). */
// `ctx` dit QUI paie une éventuelle génération d'image jointe au message :
// le propriétaire du gent, pas la plateforme.
export async function sendMessage(
  gentId: string,
  to: string,
  subject: string,
  body: string,
  ctx: ContexteLlm,
  options?: GmailSendOptions
): Promise<string> {
  if (!to?.trim() || !subject?.trim()) {
    return JSON.stringify({ error: "Destinataire (to) et objet (subject) sont requis." });
  }
  const auth = await validAccessToken(gentId);
  if ("error" in auth) return auth.error;

  const hasImage = !!(options?.imageUrl?.trim() || options?.imagePrompt?.trim());
  let raw: string;

  if (hasImage) {
    const image = await resolveImageBytes(ctx, options?.imageUrl, options?.imagePrompt);
    if ("error" in image) return JSON.stringify({ error: image.error });
    const html =
      options?.htmlBody?.trim() ||
      (body?.trim()
        ? `<html><body><p>${escapeHtml(body.trim())}</p></body></html>`
        : "<html><body></body></html>");
    raw = encodeHtmlEmailWithInlineImage(to.trim(), subject.trim(), html, image.bytes, image.mimeType);
  } else if (options?.htmlBody?.trim()) {
    raw = encodeHtmlEmail(to.trim(), subject.trim(), options.htmlBody.trim(), body ?? "");
  } else {
    raw = encodePlainEmail(to.trim(), subject.trim(), body ?? "");
  }

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
