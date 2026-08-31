"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import styles from "./MenuCompte.module.css";

/**
 * Bloc de compte du rail — à la place du « Camille Léaud / Forfait Gents »
 * qui était codé en dur.
 *
 * C'est aussi le point d'appel de la purge du cache local à la déconnexion
 * (lot 6) : sans elle, les gents d'un compte resteraient lisibles par le
 * suivant sur la même machine.
 */
export function MenuCompte() {
  const [email, setEmail] = useState<string | null>(null);
  const [sortie, setSortie] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    let vivant = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (vivant) setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (vivant) setEmail(session?.user?.email ?? null);
    });
    return () => {
      vivant = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const initiales = (email ?? "?")
    .split("@")[0]
    .split(/[.\-_]/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function deconnexion() {
    setSortie(true);
    const supabase = getSupabaseBrowser();
    await supabase?.auth.signOut();
    // Rechargement complet : les cookies de session viennent d'être effacés,
    // et les composants serveur doivent repartir d'une page anonyme.
    window.location.assign("/connexion");
  }

  return (
    <div className={styles.acct}>
      <Link href="/compte" className={styles.identite} title={email ?? "Mon compte"}>
        <span className={styles.av}>{initiales}</span>
        <span className={styles.meta}>
          <span className={styles.who}>{email ?? "Mon compte"}</span>
          <span className={styles.plan}>Voir mon compte</span>
        </span>
      </Link>
      <button type="button" className={styles.sortie} onClick={deconnexion} disabled={sortie}>
        {sortie ? "…" : "Se déconnecter"}
      </button>
    </div>
  );
}
