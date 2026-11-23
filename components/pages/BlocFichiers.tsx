"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tailleLisible, typeDepuisNom } from "@/lib/fichiersPage";
import styles from "./pages.module.css";

interface Fichier {
  nom: string;
  type: string;
  taille: number;
}

/**
 * « Fichiers de la page » (onglet Page) : musique, photos, vidéos, PDF que la
 * page référence par leur NOM. Les fichiers ATTENDUS (référencés, pas encore
 * joints) viennent en tête, avec un bouton qui envoie le fichier choisi SOUS
 * LE NOM attendu — le nom du fichier sur l'ordinateur importe peu.
 * L'envoi part directement dans le stockage (adresse signée), sans passer par
 * l'application.
 */
export function BlocFichiers({ pageId, onMessage, onChange }: { pageId: string; onMessage: (m: string) => void; onChange: () => void }) {
  const [etat, setEtat] = useState<{ fichiers: Fichier[]; attendus: string[]; migration?: boolean } | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const choix = useRef<HTMLInputElement>(null);
  const cible = useRef<string | null>(null);
  const base = `/api/pages/${encodeURIComponent(pageId)}/fichiers`;

  const charger = useCallback(() => {
    void fetch(base, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d: { fichiers?: Fichier[]; attendus?: string[]; migration?: boolean }) =>
        setEtat({ fichiers: d.fichiers ?? [], attendus: d.attendus ?? [], migration: d.migration })
      )
      .catch(() => setEtat({ fichiers: [], attendus: [] }));
  }, [base]);

  useEffect(() => charger(), [charger]);

  if (!etat) return null;

  const ouvrir = (nom: string | null) => {
    cible.current = nom;
    choix.current?.click();
  };

  const envoyer = async (brut: File) => {
    const nom = cible.current ?? brut.name;
    const type = brut.type || typeDepuisNom(nom);
    const fichier = brut.type === type && brut.name === nom ? brut : new File([brut], nom, { type });
    setEnvoi(nom);
    try {
      const json = { "Content-Type": "application/json" };
      const r1 = await fetch(base, { method: "POST", credentials: "include", headers: json, body: JSON.stringify({ nom, type, taille: fichier.size }) });
      const p = (await r1.json().catch(() => ({}))) as { url?: string; local?: boolean; chemin?: string; error?: string };
      if (!r1.ok || !p.chemin) throw new Error(p.error ?? "L'envoi n'a pas pu être préparé.");
      let r2: Response;
      if (p.url) {
        const corps = new FormData();
        corps.append("cacheControl", "3600");
        corps.append("", fichier);
        // Mêmes en-têtes que `uploadToSignedUrl` de supabase-js (clé PUBLIQUE ; le jeton de l'adresse fait foi).
        const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const entetes: Record<string, string> = { "x-upsert": "false" };
        if (cle) Object.assign(entetes, { apikey: cle, Authorization: `Bearer ${cle}` });
        r2 = await fetch(p.url, { method: "PUT", headers: entetes, body: corps });
      } else {
        const q = new URLSearchParams({ nom, chemin: p.chemin });
        r2 = await fetch(`${base}/local?${q}`, { method: "PUT", credentials: "include", headers: { "Content-Type": type }, body: fichier });
      }
      if (!r2.ok) throw new Error("Le fichier n'a pas pu être envoyé. Réessayez.");
      const r3 = await fetch(`${base}/confirmer`, { method: "POST", credentials: "include", headers: json, body: JSON.stringify({ nom, chemin: p.chemin }) });
      const c = (await r3.json().catch(() => ({}))) as { error?: string };
      if (!r3.ok) throw new Error(c.error ?? "Le fichier n'a pas pu être enregistré.");
      onMessage(`« ${nom} » ajouté à la page.`);
      charger();
      onChange();
    } catch (e) {
      onMessage((e as Error).message);
    } finally {
      setEnvoi(null);
      cible.current = null;
    }
  };

  const retirer = async (nom: string) => {
    if (!window.confirm(`Retirer « ${nom} » de la page ? Tous les liens l'afficheront sans ce fichier.`)) return;
    const r = await fetch(`${base}?nom=${encodeURIComponent(nom)}`, { method: "DELETE", credentials: "include" });
    onMessage(r.ok ? `« ${nom} » retiré.` : "Le fichier n'a pas pu être retiré.");
    charger();
    onChange();
  };

  if (etat.fichiers.length === 0 && etat.attendus.length === 0 && !etat.migration) {
    return (
      <section className={styles.bloc}>
        <h3 className={styles.blocTitre}>Fichiers de la page</h3>
        <p className={styles.aide}>Musique, photos, vidéos ou PDF que la page affiche : la page les appelle par leur nom de fichier.</p>
        <input
          ref={choix}
          type="file"
          hidden
          accept="image/*,audio/*,video/*,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void envoyer(f);
          }}
        />
        <button type="button" className={styles.secondairePetit} onClick={() => ouvrir(null)} disabled={!!envoi}>
          {envoi ? `Envoi de « ${envoi} »…` : "+ Ajouter un fichier"}
        </button>
      </section>
    );
  }

  return (
    <section className={styles.bloc}>
      <h3 className={styles.blocTitre}>Fichiers de la page</h3>
      {etat.migration && <p className={styles.alerte}>Les fichiers joints ne sont pas encore installés (migration 036 à passer dans Supabase).</p>}
      <input
        ref={choix}
        type="file"
        hidden
        accept="image/*,audio/*,video/*,application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void envoyer(f);
        }}
      />
      {etat.attendus.length > 0 && (
        <>
          <p className={styles.aide}>
            La page appelle {etat.attendus.length > 1 ? "ces fichiers" : "ce fichier"} : sans {etat.attendus.length > 1 ? "eux" : "lui"}, vos
            destinataires voient un emplacement vide.
          </p>
          <ul className={styles.listeFichiers}>
            {etat.attendus.map((nom) => (
              <li key={nom} className={styles.fichierAttendu}>
                <span className={styles.fichierNom}>{nom}</span>
                <button type="button" className={styles.secondairePetit} onClick={() => ouvrir(nom)} disabled={!!envoi}>
                  {envoi === nom ? "Envoi…" : "Ajouter"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {etat.fichiers.length > 0 && (
        <ul className={styles.listeFichiers}>
          {etat.fichiers.map((f) => (
            <li key={f.nom}>
              <span className={styles.fichierNom}>{f.nom}</span>
              <span className={styles.fichierTaille}>{tailleLisible(f.taille)}</span>
              <button type="button" className={styles.lienTexte} onClick={() => ouvrir(f.nom)} disabled={!!envoi}>
                {envoi === f.nom ? "Envoi…" : "Remplacer"}
              </button>
              <button type="button" className={styles.lienDanger} onClick={() => void retirer(f.nom)} disabled={!!envoi}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={styles.secondairePetit} onClick={() => ouvrir(null)} disabled={!!envoi}>
        {envoi && !etat.attendus.includes(envoi) && !etat.fichiers.some((f) => f.nom === envoi) ? `Envoi de « ${envoi} »…` : "+ Ajouter un fichier"}
      </button>
    </section>
  );
}
