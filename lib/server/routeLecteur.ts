import { NextResponse } from "next/server";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { langueDuLecteur } from "@/lib/server/langueLecteur";
import { COOKIE_LANGUE, estLangue, messageLecteur } from "@/lib/langueLecteur";

type Gestionnaire = (req: Request, props: { params: Promise<{ jeton: string }> }) => Promise<Response>;

function cookie(req: Request, nom: string): string | undefined {
  const brut = req.headers.get("cookie") ?? "";
  for (const part of brut.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === nom) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/**
 * Routes du LECTEUR (lot anglais 1) : leurs messages d'erreur sont écrits en
 * français ; quand le lecteur lit la page en anglais, on les traduit au
 * passage (`messageLecteur`), sans toucher aux routes. La langue n'est
 * calculée QUE sur une erreur : le chemin normal ne coûte rien de plus.
 */
export function avecMessagesTraduits(gestionnaire: Gestionnaire): Gestionnaire {
  return async (req, props) => {
    const res = await gestionnaire(req, props);
    if (res.status < 400 || !(res.headers.get("content-type") ?? "").includes("json")) return res;
    const corps = (await res.clone().json().catch(() => null)) as Record<string, unknown> | null;
    if (!corps || typeof corps.error !== "string") return res;
    const choix = cookie(req, COOKIE_LANGUE);
    let langue = estLangue(choix) ? choix : "fr";
    if (!estLangue(choix)) {
      const { jeton } = await props.params;
      const a = await lireArtefact(jeton).catch(() => null);
      if (a) langue = await langueDuLecteur(a, undefined).catch(() => "fr" as const);
    }
    if (langue === "fr") return res;
    const entetes = new Headers(res.headers);
    entetes.delete("content-length");
    return NextResponse.json({ ...corps, error: messageLecteur(corps.error, langue) }, { status: res.status, headers: entetes });
  };
}

export { cookie as cookieDeRequete };
