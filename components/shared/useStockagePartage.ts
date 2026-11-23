"use client";

import { useEffect, type RefObject } from "react";

/**
 * Relais du `window.storage` d'un artefact (voir `AMORCE_ARTEFACT`) : le
 * document est isolé (origine opaque), il ne peut ni appeler Getgents ni
 * garder quoi que ce soit. Il écrit à la page parente, qui :
 * - `shared` vrai : appelle `url` (stockage de la PAGE, commun à tous ses
 *   lecteurs — les votes d'un sondage) avec ses propres cookies ;
 * - `shared` faux : garde la donnée dans SON localStorage, sous `portee`
 *   (le lien) — le lecteur la retrouve à sa prochaine visite.
 * Seul NOTRE cadre est écouté. `url` absente : rien n'est relayé, le
 * document garde sa mémoire de visite.
 */
export function useStockagePartage(cadre: RefObject<HTMLIFrameElement | null>, url: string | null | undefined, portee: string) {
  useEffect(() => {
    if (!url) return;
    const prefixeLocal = `getgents:stockage:${portee}:`;
    const repondre = (msg: Record<string, unknown>) => cadre.current?.contentWindow?.postMessage(msg, "*");

    function local(op: string, cle: string, valeur: unknown, prefixe: string): unknown {
      const ls = window.localStorage;
      if (op === "get") {
        const v = ls.getItem(prefixeLocal + cle);
        return v === null ? null : { key: cle, value: v, shared: false };
      }
      if (op === "set") {
        ls.setItem(prefixeLocal + cle, String(valeur));
        return { key: cle, value: valeur, shared: false };
      }
      if (op === "delete") {
        ls.removeItem(prefixeLocal + cle);
        return { key: cle, deleted: true, shared: false };
      }
      const keys: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k?.startsWith(prefixeLocal + prefixe)) keys.push(k.slice(prefixeLocal.length));
      }
      return { keys, prefix: prefixe, shared: false };
    }

    const surMessage = async (e: MessageEvent) => {
      if (!e.source || e.source !== cadre.current?.contentWindow) return;
      const d = e.data as { getgents?: string; id?: string; op?: string; cle?: string; valeur?: unknown; prefixe?: string; partage?: boolean } | null;
      if (d?.getgents === "stockage?") return repondre({ getgents: "stockage!" });
      if (d?.getgents !== "stockage" || typeof d.id !== "string") return;
      const id = d.id;
      try {
        if (!d.partage) {
          repondre({ getgents: "stockage:reponse", id, ok: true, resultat: local(d.op ?? "", d.cle ?? "", d.valeur, d.prefixe ?? "") });
          return;
        }
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: d.op, cle: d.cle, valeur: d.valeur, prefixe: d.prefixe }),
        });
        const corps = (await r.json().catch(() => ({}))) as { resultat?: unknown; error?: string };
        repondre(
          r.ok
            ? { getgents: "stockage:reponse", id, ok: true, resultat: corps.resultat ?? null }
            : { getgents: "stockage:reponse", id, ok: false, erreur: corps.error ?? `stockage refusé (${r.status})` }
        );
      } catch {
        repondre({ getgents: "stockage:reponse", id, ok: false, erreur: "stockage injoignable : vérifiez la connexion." });
      }
    };
    window.addEventListener("message", surMessage);
    // Le document a pu demander avant qu'on écoute : on se présente.
    repondre({ getgents: "stockage!" });
    return () => window.removeEventListener("message", surMessage);
  }, [cadre, url, portee]);
}
