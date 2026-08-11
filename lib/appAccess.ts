// Pendant client de lib/server/appAccess : le secret d'accès aux routes
// /api/gents* n'est pas embarqué dans le bundle (ce serait le publier). Il est
// saisi une fois via ?key=... dans l'URL, conservé en localStorage, ou posé
// automatiquement en cookie httpOnly par middleware.ts sur /builder et /espace.
import { APP_ACCESS_HEADER } from "@/lib/appAccessConstants";

export { APP_ACCESS_HEADER };
const KEY = "getgents:app-secret";
/** Capture ?key=... au chargement, le range, et le retire de la barre d'adresse. */
export function captureAppSecretFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const key = url.searchParams.get("key");
    if (!key) return;
    writeAppSecret(key);
    url.searchParams.delete("key");
    window.history.replaceState({}, "", url.toString());
  } catch {
    // URL exotique ou localStorage indisponible : on ignore.
  }
}

export function readAppSecret(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * Enregistre la clé directement, sans passer par l'URL — utilisé par
 * `AppAccessPrompt`, affiché là où un 401 « unauthorized » survient (ex. la
 * section Lien de Diffusion), pour ne pas exiger de revenir à la racine de
 * l'app avec `?key=…` à chaque fois qu'un nouvel onglet ou une preview le
 * demande.
 */
export function writeAppSecret(secret: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, secret.trim());
  } catch {
    // localStorage indisponible — sans remède ici.
  }
  // Import dynamique pour éviter une dépendance circulaire au chargement :
  // sans ça, un 401 préalable laissait remoteAvailable=false pour toute la session.
  void import("@/lib/builderDraftStorage").then((m) => m.resetDraftsRemoteAvailability());
  void import("@/lib/publishedGents").then((m) => m.resetPublishedRemoteAvailability());
}

let captured = false;

/**
 * En-têtes à joindre aux appels /api/gents* — vide si aucun secret connu.
 *
 * La capture de ?key=… est faite ici, à la première requête, plutôt que dans un
 * effet de montage : les effets enfants s'exécutent avant ceux du layout, donc
 * un composant monté haut dans l'arbre ne garantirait pas de passer avant le
 * premier fetch.
 */
export function appAccessHeaders(): Record<string, string> {
  if (!captured) {
    captured = true;
    captureAppSecretFromUrl();
  }
  const secret = readAppSecret();
  // Le cookie httpOnly posé par le middleware suffit pour same-origin ; le
  // header reste utile en local ou après saisie manuelle / ?key=…
  return secret ? { [APP_ACCESS_HEADER]: secret } : {};
}

/** Options fetch recommandées pour les routes protégées (cookie + header). */
export function appAccessFetchInit(init: RequestInit = {}): RequestInit {
  appAccessHeaders(); // capture ?key=… au premier appel
  return {
    ...init,
    credentials: "include",
    headers: { ...init.headers, ...appAccessHeaders() },
  };
}
