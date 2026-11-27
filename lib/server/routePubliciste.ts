import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { refusOffrePages } from "@/lib/server/offre";
import type { Cause } from "@/lib/server/publicisteProjets";

/** L'auteur d'un projet du Publiciste : la session, jamais un paramètre. Comptes complets seulement. */
export async function auteurPubliciste(): Promise<{ userId: string } | { refus: NextResponse }> {
  const auth = await requireUser();
  if ("response" in auth) return { refus: auth.response };
  const horsOffre = refusOffrePages(auth.user.id);
  if (horsOffre) return { refus: horsOffre };
  return { userId: auth.user.id };
}

const MESSAGES: Record<Cause, [number, string]> = {
  non_installe: [503, "L'enregistrement des projets n'est pas encore installé (migrations 040 et 041)."],
  erreur: [503, "Le projet n'a pas pu être lu ou enregistré. Réessayez dans un instant."],
  introuvable: [404, "Ce projet n'existe plus."],
  conflit: [409, "Le projet a changé dans un autre onglet : il est relu."],
  plafond: [409, "Vous avez atteint 100 projets pour ce gent. Supprimez-en un pour en commencer un autre."],
};

export function refusPubliciste(cause: Cause): NextResponse {
  const [status, message] = MESSAGES[cause];
  return NextResponse.json({ error: cause, message }, { status });
}

export const gentValide = (g: unknown): g is string => typeof g === "string" && /^[\w-]{1,120}$/.test(g);
export const idValide = (g: unknown): g is string => typeof g === "string" && /^[0-9a-f-]{36}$/i.test(g);
