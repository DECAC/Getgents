import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/server/supabase";
import { chiffrer, dechiffrer, secretBoxConfigure } from "@/lib/server/secretBox";

/**
 * Jetons OAuth des connecteurs, CHIFFRÉS AU REPOS.
 *
 * Ils étaient stockés en clair. Ce sont les identifiants d'accès à la boîte
 * mail de quelqu'un : une lecture de la base — sauvegarde égarée, accès
 * console, incident chez l'hébergeur — donnait le courrier de tous les
 * utilisateurs ayant branché Gmail. C'est la donnée la plus sensible du
 * projet, et elle était la moins protégée.
 *
 * La bascule se fait SANS INTERRUPTION grâce à `enc_version` :
 *   0 = clair, hérité — lu tel quel, puis rechiffré dès qu'on y touche ;
 *   1 = AES-256-GCM.
 *
 * Deux règles fermes :
 * - on n'écrit JAMAIS en clair. Sans `SECRET_BOX_KEY`, l'enregistrement est
 *   refusé avec un message explicite. Un repli silencieux en clair
 *   rétablirait exactement le problème qu'on corrige, en donnant en plus
 *   l'illusion qu'il est réglé.
 * - un jeton illisible vaut un jeton absent. `dechiffrer` renvoie `null`
 *   plutôt que de lever : l'utilisateur est invité à rebrancher Gmail, ce qui
 *   est désagréable mais réparable — une exception non rattrapée, elle,
 *   casserait la conversation entière.
 */

export interface StoredCredential {
  gentId: string;
  provider: string;
  email: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string | null;
}

interface Row {
  gent_id: string;
  provider: string;
  email: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string | null;
  enc_version?: number | null;
}

/** Version d'enregistrement écrite par ce code. */
const VERSION_CHIFFREE = 1;

function rowToCredential(row: Row): StoredCredential | null {
  const chiffree = (row.enc_version ?? 0) >= VERSION_CHIFFREE;

  const accessToken = chiffree ? dechiffrer(row.access_token) : row.access_token;
  if (!accessToken) return null;

  // Le jeton de rafraîchissement peut légitimement être absent. On distingue
  // « pas de jeton » de « jeton illisible » : dans le second cas on renvoie
  // null pour l'ensemble, car un access_token sans refresh_token exploitable
  // expirera sans possibilité de renouvellement — mieux vaut redemander la
  // connexion tout de suite que dans une heure, au milieu d'une tâche.
  let refreshToken: string | null = row.refresh_token;
  if (chiffree && row.refresh_token) {
    refreshToken = dechiffrer(row.refresh_token);
    if (!refreshToken) return null;
  }

  return {
    gentId: row.gent_id,
    provider: row.provider,
    email: row.email,
    accessToken,
    refreshToken,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    scopes: row.scopes,
  };
}

export function credentialsStorageAvailable(): boolean {
  return isSupabaseConfigured();
}

export async function getCredential(gentId: string, provider: string): Promise<StoredCredential | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("integration_credentials")
    .select("*")
    .eq("gent_id", gentId)
    .eq("provider", provider)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as Row;
  const cred = rowToCredential(row);
  if (!cred) {
    console.error(
      JSON.stringify({
        tag: "getgents:oauth",
        event: "jeton_illisible",
        gentId,
        provider,
      })
    );
    return null;
  }

  // Rechiffrement opportuniste : une ligne héritée est reprise dès qu'on la
  // LIT, sans attendre le prochain renouvellement de jeton. Un gent dont le
  // jeton ne se rafraîchit jamais serait sinon resté en clair indéfiniment.
  // Non attendu : la lecture ne doit pas ralentir pour une écriture de
  // maintenance, et un échec est sans conséquence — la prochaine lecture
  // réessaiera.
  if ((row.enc_version ?? 0) < VERSION_CHIFFREE && secretBoxConfigure()) {
    void upsertCredential(cred).catch(() => undefined);
  }

  return cred;
}

export async function upsertCredential(cred: StoredCredential): Promise<{ ok: true } | { error: string }> {
  const db = getSupabaseAdmin();
  if (!db) {
    return {
      error:
        "Supabase non configuré : les jetons Gmail ne peuvent pas être enregistrés. Définissez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, puis exécutez supabase/migrations/005_integration_credentials.sql.",
    };
  }

  // Jamais de repli en clair. Refuser est désagréable ; écrire en clair
  // rétablirait la faille qu'on corrige, en laissant croire qu'elle ne l'est
  // plus — c'est le seul des deux échecs qui soit silencieux.
  if (!secretBoxConfigure()) {
    return {
      error:
        "SECRET_BOX_KEY n'est pas configurée : les jetons d'accès à votre messagerie " +
        "ne peuvent pas être chiffrés, et ne seront donc pas enregistrés.",
    };
  }

  const { error } = await db.from("integration_credentials").upsert(
    {
      gent_id: cred.gentId,
      provider: cred.provider,
      email: cred.email,
      access_token: chiffrer(cred.accessToken),
      refresh_token: cred.refreshToken ? chiffrer(cred.refreshToken) : null,
      expires_at: cred.expiresAt?.toISOString() ?? null,
      scopes: cred.scopes,
      enc_version: VERSION_CHIFFREE,
    },
    { onConflict: "gent_id,provider" }
  );
  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteCredential(gentId: string, provider: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db.from("integration_credentials").delete().eq("gent_id", gentId).eq("provider", provider);
}
