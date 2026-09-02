"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Ouverture du rail sur petit écran.
 *
 * Le rail était écrit comme un tiroir — `transform: translateX(-100%)` avec un
 * état `.open` pour le ramener — mais rien n'appliquait jamais cette classe, et
 * aucun bouton ne l'ouvrait. Sous 860 px, la colonne était donc hors écran
 * définitivement : plus de liste de gents, plus de menu de compte, plus de
 * déconnexion, plus de bascule entre Getgents, le Gent' space et le studio.
 * L'application s'affichait sur téléphone, mais on ne pouvait aller nulle part.
 *
 * L'état vit ici plutôt que dans chaque shell : le bouton qui ouvre et le rail
 * qui s'ouvre sont deux composants éloignés dans l'arbre, et les quatre shells
 * (espace, super-gent, studio, liste du studio) doivent se comporter pareil.
 */

interface NavMobile {
  ouvert: boolean;
  basculer: () => void;
  fermer: () => void;
}

const Contexte = createContext<NavMobile>({
  ouvert: false,
  basculer: () => undefined,
  fermer: () => undefined,
});

export function useNavMobile(): NavMobile {
  return useContext(Contexte);
}

export function NavMobileProvider({ children }: { children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const chemin = usePathname();

  const fermer = useCallback(() => setOuvert(false), []);
  const basculer = useCallback(() => setOuvert((v) => !v), []);

  // Toute navigation referme le tiroir : on ouvre le rail POUR aller
  // ailleurs, et le laisser ouvert masquerait la page qu'on vient d'atteindre.
  useEffect(() => {
    setOuvert(false);
  }, [chemin]);

  // Échap ferme, comme partout ailleurs dans l'application.
  useEffect(() => {
    if (!ouvert) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ouvert]);

  return (
    <Contexte.Provider value={{ ouvert, basculer, fermer }}>
      {children}
      {ouvert && (
        /* Voile : il assombrit la page ET donne une cible de fermeture large.
           Sur un téléphone tenu d'une main, viser une croix de 20 px en haut
           du tiroir est bien plus difficile que toucher n'importe où à côté. */
        <div className="nav-mobile-voile" onClick={fermer} aria-hidden="true" />
      )}
    </Contexte.Provider>
  );
}
