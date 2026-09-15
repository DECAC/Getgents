import { getSupabaseAdmin, missingSupabaseEnvVars } from "@/lib/server/supabase";
import { diffusedEspace } from "@/lib/server/gentVersions";
import { espaceForPublicLink } from "@/lib/espaceApiPayload";
import type { Espace } from "@/lib/types";

/**
 * Lecture d'un gent publié à la racine du domaine.
 *
 * Le point à ne jamais perdre de vue : la table contient le prompt système,
 * la mémoire, les conversations et les documents du créateur. Rien de tout
 * cela ne doit atteindre la page publique. On passe donc systématiquement par
 * `espaceForPublicLink`, qui est une LISTE BLANCHE — toute clé ajoutée plus
 * tard à `Espace` en est exclue par défaut, ce qui est exactement la bonne
 * façon de se tromper.
 */

export interface GentPublic {
  id: string;
  slug: string;
  espace: Espace;
  /** Le propriétaire a-t-il ouvert la conversation aux visiteurs ? */
  chatOuvert: boolean;
  ownerId: string | null;
  resume: string | null;
  publieLe: string | null;
}

/**
 * Trace d'une lecture qui n'a rien rendu.
 *
 * Les quatre causes d'un 404 produisaient le MEME ecran, sans distinction :
 * configuration serveur absente, slug inconnu, gent non public, ligne sans
 * contenu — et, la plus traitre, une ERREUR d'acces Supabase, qu'un
 * `if (error || !data)` confondait avec « rien trouve ». Une cle de service
 * revoquee donnait donc exactement le meme resultat qu'une adresse qui
 * n'existe pas, et rien ne permettait de les separer depuis l'exterieur.
 *
 * Le slug est ecrit — il est dans l'URL publique, il n'a rien de secret. Le
 * message d'erreur du fournisseur aussi : il nomme la cause reelle.
 */
function tracerAbsence(slug: string, raison: string, detail?: string) {
  console.warn(
    JSON.stringify({
      tag: "getgents:public",
      event: "gent_introuvable",
      slug,
      raison,
      ...(detail ? { detail: detail.slice(0, 200) } : {}),
    })
  );
}

export async function lireGentPublic(slug: string): Promise<GentPublic | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Ce cas fait tomber TOUS les gents publics a la fois, pas un seul :
    // nommer les variables absentes evite de chercher du cote des donnees.
    tracerAbsence(slug, "supabase_non_configure", missingSupabaseEnvVars().join(", "));
    return null;
  }

  const { data, error } = await supabase
    .from("published_gents")
    .select("id, espace, diffused, public_slug, public_chat, owner_id, directory_summary, published_at")
    .eq("public_slug", slug)
    .eq("visibility", "public")
    .maybeSingle();
  if (error) {
    // La distinction qui manquait : une cle revoquee, un schema change ou un
    // reseau coupe ne sont PAS « aucun resultat ».
    tracerAbsence(slug, "erreur_supabase", error.message);
    return null;
  }
  if (!data) {
    tracerAbsence(slug, "aucune_ligne_publique");
    return null;
  }

  // Version DIFFUSÉE, jamais la version de travail : le visiteur ne doit pas
  // tomber sur un prompt à moitié réécrit parce que le créateur teste.
  const diffuse = diffusedEspace(data as { espace: Espace; diffused?: Espace | null });
  if (!diffuse) {
    tracerAbsence(slug, "ligne_sans_contenu");
    return null;
  }

  return {
    id: data.id as string,
    slug: data.public_slug as string,
    espace: espaceForPublicLink(diffuse),
    chatOuvert: !!data.public_chat,
    ownerId: (data.owner_id as string | null) ?? null,
    resume: (data.directory_summary as string | null) ?? null,
    publieLe: (data.published_at as string | null) ?? null,
  };
}

/** Gents de l'annuaire — jamais la colonne `espace`, seulement la vitrine. */
export async function listerAnnuaire(limite = 60) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data } = await supabase
    .from("published_gents")
    .select("public_slug, espace, directory_summary, published_at")
    .eq("visibility", "public")
    .not("public_slug", "is", null)
    .order("published_at", { ascending: false })
    .limit(limite);

  return (data ?? []).map((r) => {
    const e = (r.espace ?? {}) as { name?: string; icon?: string; gent?: string };
    return {
      slug: r.public_slug as string,
      nom: e.name ?? "Gent",
      icone: e.icon ?? "✨",
      resume: (r.directory_summary as string | null) ?? null,
      publieLe: (r.published_at as string | null) ?? null,
    };
  });
}

/**
 * Jeton de conversation d'un gent public.
 *
 * Plutôt que de dupliquer tout le chemin conversationnel du lien de partage,
 * un gent public EST un lien de partage permanent, doté d'une jolie adresse.
 * Il hérite ainsi de garde-fous déjà éprouvés : plafond de régénérations,
 * révocation, journal des ouvertures. Le jeton apparaît dans le HTML de la
 * page, ce qui est sans conséquence : il ne donne accès qu'à ce qui est déjà
 * public, et la régénération d'artefact y est fermée.
 */
export async function tokenConversationPublique(gentId: string, slug: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const etiquette = `public:${slug}`;
  const { data: existant } = await supabase
    .from("share_links")
    .select("token, revoked_at")
    .eq("gent_id", gentId)
    .eq("target_label", etiquette)
    .maybeSingle();

  if (existant && !existant.revoked_at) return existant.token as string;

  const { createShareLink } = await import("@/lib/server/shareLinks");
  try {
    const lien = await createShareLink({
      gentId,
      targetLabel: etiquette,
      allowChat: true,
      // La régénération d'artefact est un appel lourd : elle reste au créateur.
      allowRefresh: false,
      maxRefresh: 0,
    });
    return lien.token;
  } catch {
    return null;
  }
}
