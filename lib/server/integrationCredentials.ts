import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/server/supabase";

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
}

function rowToCredential(row: Row): StoredCredential {
  return {
    gentId: row.gent_id,
    provider: row.provider,
    email: row.email,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
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
  return rowToCredential(data as Row);
}

export async function upsertCredential(cred: StoredCredential): Promise<{ ok: true } | { error: string }> {
  const db = getSupabaseAdmin();
  if (!db) {
    return {
      error:
        "Supabase non configuré : les jetons Gmail ne peuvent pas être enregistrés. Définissez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, puis exécutez supabase/migrations/005_integration_credentials.sql.",
    };
  }
  const { error } = await db.from("integration_credentials").upsert(
    {
      gent_id: cred.gentId,
      provider: cred.provider,
      email: cred.email,
      access_token: cred.accessToken,
      refresh_token: cred.refreshToken,
      expires_at: cred.expiresAt?.toISOString() ?? null,
      scopes: cred.scopes,
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
