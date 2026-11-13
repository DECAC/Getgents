import { NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/authConfig";
import { getUser } from "@/lib/server/session";
import { MESSAGE_OFFRE_PAGES, offreDuCompte, plafondsDe, type Offre, type Plafonds } from "@/lib/offre";

/** L'offre d'un compte, d'après `COMPTES_COMPLETS` (absente : tout le monde est complet). */
export function offreDe(userId: string | null | undefined): Offre {
  return offreDuCompte(userId, process.env.COMPTES_COMPLETS);
}

export function plafondsDuCompte(userId: string | null | undefined): Plafonds | null {
  return plafondsDe(offreDe(userId));
}

/** 403 pour une route des gents appelée par un compte « pages », sinon null. */
export function refusOffrePages(userId: string): NextResponse | null {
  if (offreDe(userId) === "complete") return null;
  return NextResponse.json({ error: "offre_pages", message: MESSAGE_OFFRE_PAGES }, { status: 403 });
}

/**
 * L'offre de la personne connectée, pour une page rendue par le serveur.
 * Sans Supabase (développement), l'utilisateur local `dev-local`.
 */
export async function offreDuDemandeur(): Promise<{ offre: Offre; userId: string | null }> {
  if (!isAuthConfigured()) return { offre: process.env.NODE_ENV === "production" ? "complete" : offreDe("dev-local"), userId: "dev-local" };
  const u = await getUser();
  return { offre: offreDe(u?.id), userId: u?.id ?? null };
}

export interface UsageOffre {
  pages: number;
  liensActifs: number;
  questionsParMois: number;
}

/** Ce qu'un compte a consommé de ses plafonds. Une lecture en échec compte 0 : la page reste lisible. */
export async function usageDuCompte(userId: string): Promise<UsageOffre> {
  const [{ listerPages, idsDesPages }, { liensActifs }, { questionsDepuis }, { debutDuMois }] = await Promise.all([
    import("@/lib/server/pages"),
    import("@/lib/server/artefactsPartages"),
    import("@/lib/server/activitePages"),
    import("@/lib/offre"),
  ]);
  const [pages, liens, questions] = await Promise.all([
    listerPages(userId).then((l) => l.length).catch(() => 0),
    liensActifs(userId).catch(() => 0),
    idsDesPages(userId)
      .then((ids) => questionsDepuis(ids, debutDuMois()))
      .catch(() => 0),
  ]);
  return { pages, liensActifs: liens, questionsParMois: questions };
}
