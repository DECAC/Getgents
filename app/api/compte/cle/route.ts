import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { chiffrer, secretBoxConfigure, SecretBoxIndisponible } from "@/lib/server/secretBox";
import { cleOpenRouterPlausible, indiceDeCle } from "@/lib/openRouterKey";

export const dynamic = "force-dynamic";

/**
 * Clé OpenRouter personnelle du compte.
 *
 * Règle absolue, et c'est le cœur de la sécurité de ce lot : la clé n'est
 * JAMAIS acceptée dans le corps d'une requête de génération, et n'est jamais
 * renvoyée au navigateur. Trois raisons, dans cet ordre :
 *
 * 1. un corps de requête traverse les journaux, les traces et les messages
 *    d'erreur — un secret y a une durée de vie qu'on ne maîtrise plus ;
 * 2. une clé fournie par l'appelant permettrait de faire payer un tiers, ou
 *    de sonder des clés volées à travers notre serveur ;
 * 3. le repli sur la clé plateforme et les quotas deviendraient
 *    contournables par un simple champ.
 *
 * Elle se lit exclusivement en base, à partir de l'identité du propriétaire
 * (`lib/server/openRouterKey.ts`). Ce qui sort d'ici est un indice de quatre
 * caractères, jamais la valeur.
 */

const OPENROUTER_MODELS = "https://openrouter.ai/api/v1/models";

interface EtatCle {
  present: boolean;
  hint: string | null;
  derniereReussite: string | null;
  derniereErreur: string | null;
}

const ABSENTE: EtatCle = { present: false, hint: null, derniereReussite: null, derniereErreur: null };

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ...ABSENTE, configure: secretBoxConfigure() });

  const { data } = await supabase
    .from("user_api_keys")
    .select("hint, last_ok_at, last_error")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  return NextResponse.json({
    present: !!data,
    hint: (data?.hint as string) ?? null,
    derniereReussite: (data?.last_ok_at as string) ?? null,
    derniereErreur: (data?.last_error as string) ?? null,
    configure: secretBoxConfigure(),
  });
}

/**
 * Enregistre une clé, APRÈS l'avoir essayée chez OpenRouter.
 *
 * Une clé fausse refusée à la saisie vaut mieux qu'un gent muet trois jours
 * plus tard, sans rien pour relier la panne à un copier-coller manqué.
 */
export async function PUT(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let body: { cle?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const cle = typeof body.cle === "string" ? body.cle.trim() : "";
  if (!cleOpenRouterPlausible(cle)) {
    return NextResponse.json(
      { error: "Ce n'est pas une clé OpenRouter : elle commence par « sk-or- ». Copiez-la depuis openrouter.ai/keys." },
      { status: 400 }
    );
  }

  let essai: Response;
  try {
    essai = await fetch(OPENROUTER_MODELS, {
      headers: { Authorization: `Bearer ${cle}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Impossible de joindre OpenRouter pour vérifier la clé. Réessayez dans un instant." },
      { status: 502 }
    );
  }

  if (essai.status === 401 || essai.status === 403) {
    return NextResponse.json(
      { error: "OpenRouter a refusé cette clé. Vérifiez qu'elle n'a pas été révoquée." },
      { status: 400 }
    );
  }
  if (!essai.ok) {
    return NextResponse.json(
      { error: `OpenRouter n'a pas répondu normalement (${essai.status}). Réessayez dans un instant.` },
      { status: 502 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Base indisponible." }, { status: 503 });

  let ciphertext: string;
  try {
    ciphertext = chiffrer(cle);
  } catch (e) {
    // Jamais de repli en clair : une clé stockée nue serait pire que pas de
    // clé du tout, et le silence rendrait la faute indétectable.
    if (e instanceof SecretBoxIndisponible) {
      console.error(JSON.stringify({ tag: "getgents:cle", event: "secret_box_absente" }));
      return NextResponse.json(
        { error: "Le stockage sécurisé n'est pas configuré sur ce serveur. Contactez l'administrateur." },
        { status: 503 }
      );
    }
    throw e;
  }

  const { error } = await supabase.from("user_api_keys").upsert(
    {
      user_id: auth.user.id,
      provider: "openrouter",
      ciphertext,
      hint: indiceDeCle(cle),
      key_version: 1,
      last_ok_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
  }

  return NextResponse.json({ present: true, hint: indiceDeCle(cle) });
}

/** Retrait : le compte repasse sur la clé de la plateforme, sous quota. */
export async function DELETE() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Base indisponible." }, { status: 503 });

  await supabase.from("user_api_keys").delete().eq("user_id", auth.user.id);
  return NextResponse.json({ present: false });
}
