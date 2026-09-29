/**
 * Un `fetch` qui abandonne au bout de `ms` millisecondes.
 *
 * Vécu (29/09) : getgents.ai « tournait sans fin ». Le middleware demande à
 * Supabase qui est connecté, à CHAQUE page, et attendait sa réponse sans
 * limite : un Supabase muet (projet en pause, panne) suspendait tout le site
 * pour un utilisateur connecté. Borné, l'appel échoue vite et proprement —
 * `@supabase/auth-js` le rend comme une `AuthRetryableFetchError`, sans
 * effacer la session.
 *
 * Fonctionne dans le runtime Edge (middleware) : AbortController et
 * setTimeout seulement. Un signal fourni par l'appelant reste respecté.
 */
export function fetchAvecDelai(ms: number, base: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const controleur = new AbortController();
    const minuterie = setTimeout(() => controleur.abort(), ms);
    const signalAppelant = init?.signal;
    if (signalAppelant) {
      if (signalAppelant.aborted) controleur.abort();
      else signalAppelant.addEventListener("abort", () => controleur.abort(), { once: true });
    }
    return base(input, { ...init, signal: controleur.signal }).finally(() => clearTimeout(minuterie));
  };
}

/** Au-delà, le service d'authentification est jugé injoignable (réponse normale : ~200 ms). */
export const DELAI_AUTH_MS = 6_000;

/** Erreur de RÉSEAU (injoignable, délai dépassé) — et non « pas de session ». */
export function authInjoignable(erreur: unknown): boolean {
  return !!erreur && typeof erreur === "object" && (erreur as { name?: unknown }).name === "AuthRetryableFetchError";
}
