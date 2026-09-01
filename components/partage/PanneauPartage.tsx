"use client";

import { useCallback, useEffect, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { estEmailPlausible } from "@/lib/emailIdentity";
import { slugMessage, slugProbleme, toSlug } from "@/lib/slug";
import styles from "./PanneauPartage.module.css";

interface Grant {
  id: string;
  invited_email: string;
  role: "viewer" | "editor";
  accepted_at: string | null;
}

/**
 * Partager un gent : nommément à quelqu'un, ou publiquement à une adresse.
 *
 * Les deux gestes sont volontairement côte à côte mais bien distincts. Inviter
 * une personne et publier au monde n'ont ni les mêmes conséquences ni le même
 * retour en arrière : une adresse publique peut avoir été indexée, et cesse
 * alors d'être entièrement révocable.
 */
export function PanneauPartage() {
  const { currentDraft } = useBuilder();
  const gentId = currentDraft.id;

  const [grants, setGrants] = useState<Grant[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const [slug, setSlug] = useState("");
  const [resume, setResume] = useState("");
  const [chatPublic, setChatPublic] = useState(false);
  const [publie, setPublie] = useState(false);
  const [erreurPub, setErreurPub] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState(false);

  const charger = useCallback(async () => {
    const res = await fetch(`/api/gents/${encodeURIComponent(gentId)}/grants`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { grants?: Grant[] };
    setGrants(data.grants ?? []);
  }, [gentId]);

  useEffect(() => {
    void charger();
    setSlug(toSlug(currentDraft.name));
  }, [charger, currentDraft.name]);

  async function inviter() {
    setErreur(null);
    if (!estEmailPlausible(email)) {
      setErreur("Cette adresse e-mail n'est pas valide.");
      return;
    }
    setOccupe(true);
    try {
      const res = await fetch(`/api/gents/${encodeURIComponent(gentId)}/grants`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErreur(data.error ?? "L'invitation n'a pas pu être envoyée.");
        return;
      }
      setEmail("");
      await charger();
    } finally {
      setOccupe(false);
    }
  }

  async function retirer(id: string) {
    await fetch(`/api/gents/${encodeURIComponent(gentId)}/grants/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await charger();
  }

  async function publier(visibility: "public" | "private") {
    setErreurPub(null);
    if (visibility === "public") {
      const probleme = slugProbleme(toSlug(slug));
      if (probleme) {
        setErreurPub(slugMessage(probleme));
        return;
      }
    }
    setOccupe(true);
    try {
      const res = await fetch(`/api/gents/${encodeURIComponent(gentId)}/publication`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility, slug: toSlug(slug), summary: resume, publicChat: chatPublic }),
      });
      const data = (await res.json()) as { error?: string; slug?: string; slugAjuste?: boolean };
      if (!res.ok) {
        setErreurPub(data.error ?? "La publication a échoué.");
        return;
      }
      if (data.slug) setSlug(data.slug);
      // L'adresse demandée était prise : le dire, plutôt que de laisser le
      // créateur diffuser une adresse qu'il croit être la sienne.
      setAjuste(!!data.slugAjuste);
      setPublie(visibility === "public");
    } finally {
      setOccupe(false);
    }
  }

  const domaine = (process.env.NEXT_PUBLIC_APP_URL ?? "https://getgents.ai").replace(/^https?:\/\//, "");

  return (
    <div className={styles.panneau}>
      <section className={styles.bloc}>
        <h3 className={styles.titre}>Partager avec quelqu&apos;un</h3>
        <p className={styles.aide}>
          La personne reçoit un e-mail. Si elle n&apos;a pas encore de compte, le gent
          l&apos;attendra à sa première connexion avec cette adresse.
        </p>

        {erreur ? <div className={styles.erreur}>{erreur}</div> : null}

        <div className={styles.ligne}>
          <input
            className={styles.champ}
            type="email"
            placeholder="adresse@exemple.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Adresse e-mail à inviter"
          />
          <select
            className={styles.select}
            value={role}
            onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
            aria-label="Droit accordé"
          >
            <option value="viewer">Lecture</option>
            <option value="editor">Co-édition</option>
          </select>
          <button type="button" className={styles.bouton} onClick={inviter} disabled={occupe}>
            Inviter
          </button>
        </div>

        {grants.length > 0 && (
          <ul className={styles.liste}>
            {grants.map((g) => (
              <li key={g.id} className={styles.item}>
                <span className={styles.adresse}>{g.invited_email}</span>
                <span className={styles.role}>
                  {g.role === "editor" ? "Co-édition" : "Lecture"}
                  {g.accepted_at ? "" : " · en attente"}
                </span>
                <button type="button" className={styles.retirer} onClick={() => retirer(g.id)}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.bloc}>
        <h3 className={styles.titre}>Publier sur le web</h3>
        <p className={styles.aide}>
          Le gent devient accessible à tous à son adresse, et référençable par les moteurs
          de recherche.
        </p>

        {erreurPub ? <div className={styles.erreur}>{erreurPub}</div> : null}

        <label className={styles.label} htmlFor="slug-public">
          Adresse publique
        </label>
        <div className={styles.adresseLigne}>
          <span className={styles.domaine}>{domaine}/</span>
          <input
            id="slug-public"
            className={styles.champ}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="mon-gent"
          />
        </div>

        <label className={styles.label} htmlFor="resume-public">
          Description (affichée dans l&apos;annuaire et par les moteurs)
        </label>
        <textarea
          id="resume-public"
          className={styles.zone}
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          rows={2}
          maxLength={280}
          placeholder="Ce que fait ce gent, en une phrase."
        />

        <label className={styles.case}>
          <input
            type="checkbox"
            checked={chatPublic}
            onChange={(e) => setChatPublic(e.target.checked)}
          />
          <span>
            Autoriser les visiteurs à lui parler
            <em className={styles.precision}>
              Chaque échange est facturé sur votre compte. Sans cette option, la page présente
              le gent sans permettre de converser.
            </em>
          </span>
        </label>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.bouton}
            onClick={() => publier("public")}
            disabled={occupe}
          >
            {publie ? "Mettre à jour la publication" : "Publier"}
          </button>
          {publie && (
            <button
              type="button"
              className={styles.secondaire}
              onClick={() => publier("private")}
              disabled={occupe}
            >
              Dépublier
            </button>
          )}
        </div>

        {ajuste && (
          <p className={styles.note}>
            L&apos;adresse demandée était déjà prise : celle-ci a été attribuée à la place.
          </p>
        )}

        {publie && (
          <p className={styles.note}>
            En ligne sur <strong>{domaine}/{slug}</strong>. Dépublier retire la page, mais une
            adresse déjà indexée peut rester visible quelque temps dans les moteurs.
          </p>
        )}
      </section>
    </div>
  );
}
