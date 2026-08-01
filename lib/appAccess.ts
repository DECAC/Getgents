// Pendant client de lib/server/appAccess : le secret d'accès aux routes
// /api/gents* n'est pas embarqué dans le bundle (ce serait le publier). Il est
// saisi une fois via ?key=... dans l'URL, puis conservé en localStorage pour
// les requêtes suivantes.
const KEY = "getgents:app-secret";
export const APP_ACCESS_HEADER = "x-app-secret";

/** Capture ?key=... au chargement, le range, et le retire de la barre d'adresse. */
export function captureAppSecretFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const key = url.searchParams.get("key");
    if (!key) return;
    window.localStorage.setItem(KEY, key);
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
  return secret ? { [APP_ACCESS_HEADER]: secret } : {};
}
