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

/** Messages d'API lisibles — ne jamais afficher le code brut (`not_found`). */
function messagePublication(code: string | undefined, status: number): string {
  switch (code) {
    case "not_found":
      return "Ce gent n'est pas encore sur le serveur. Cliquez d'abord sur « Diffuser » dans le menu de gauche, puis republiez ici.";
    case "forbidden":
      return "Vous n'avez pas le droit de publier ce gent.";
    case "unauthorized":
    case "auth_required":
      return "Session expirée. Reconnectez-vous, puis réessayez.";
    case "supabase_not_configured":
      return "Publication indisponible pour le moment (configuration serveur).";
    case "network":
      return "Connexion interrompue pendant l'enregistrement. Vérifiez votre réseau et réessayez.";
    case "missing_local":
    case "missing_draft":
      return "Le brouillon local est introuvable. Rechargez la page, cliquez sur Diffuser, puis réessayez.";
    case "invalid_id":
      return "Identifiant de gent invalide. Rechargez la page et réessayez.";
    default:
      if (code && !/^[a-z0-9_]+$/i.test(code)) return code; // déjà un message humain
      if (status === 401) return "Session expirée. Reconnectez-vous, puis réessayez.";
      if (status === 404) {
        return "Ce gent n'est pas encore sur le serveur. Cliquez d'abord sur « Diffuser » dans le menu de gauche, puis republiez ici.";
      }
      if (status === 500 && code) {
        return `Le serveur a refusé l'enregistrement : ${code}`;
      }
      return code ?? "La publication a échoué.";
  }
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
  const { currentDraft, publishDraft } = useBuilder();
  const gentId = currentDraft.id;
  const dejaDiffuse = currentDraft.status === "published";

  const [grants, setGrants] = useState<Grant[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [erreur, setErreur] = useState<string | null>(null);
  /** Message d'AVERTISSEMENT : l'opération a réussi, mais pas entièrement. */
  const [avis, setAvis] = useState<string | null>(null);
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

  /**
   * Recharge l'état de publication depuis le SERVEUR.
   *
   * Le panneau redérivait le slug du nom du gent à chaque montage, et
   * n'apprenait donc jamais l'adresse réellement publiée. Résultat : juste par
   * chance tant que le nom n'avait pas changé, faux dès que le serveur avait
   * ajusté l'adresse pour cause de collision (« mon-gent-2 ») ou dès un
   * renommage — le créateur copiait alors un lien qui ne menait nulle part. Le
   * résumé de l'annuaire et l'ouverture de la conversation étaient réinitialisés
   * de la même façon, à chaque ouverture de l'onglet.
   */
  const chargerPublication = useCallback(async () => {
    try {
      const res = await fetch(`/api/gents/${encodeURIComponent(gentId)}/publication`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        visibility?: string;
        slug?: string | null;
        summary?: string;
        publicChat?: boolean;
      };
      if (data.slug) setSlug(data.slug);
      setResume(data.summary ?? "");
      setChatPublic(!!data.publicChat);
      setPublie(data.visibility === "public");
      // `true` seulement si une adresse est déjà attribuée : c'est ce qui
      // autorise l'appelant à ne PAS écraser le champ par le nom du gent.
      return !!data.slug;
    } catch {
      // Serveur injoignable : on garde la proposition dérivée du nom plutôt
      // que de laisser le champ vide, mais on n'affirme pas que c'est publié.
      return false;
    }
  }, [gentId]);

  useEffect(() => {
    void charger();
    let annule = false;
    void chargerPublication().then((connu) => {
      // Le nom ne sert plus que de PROPOSITION, pour un gent jamais publié.
      // L'adresse réelle, quand elle existe, fait foi.
      if (!annule && !connu) setSlug(toSlug(currentDraft.name));
    });
    return () => {
      annule = true;
    };
  }, [charger, chargerPublication, currentDraft.name]);

  async function inviter() {
    setErreur(null);
    setAvis(null);
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
      const data = (await res.json()) as { error?: string; lien?: string; emailEnvoye?: boolean };
      if (!res.ok) {
        setErreur(data.error ?? "L'invitation n'a pas pu être envoyée.");
        return;
      }
      // Le partage a réussi, l'e-mail non : deux faits distincts, et taire le
      // second laissait le créateur attendre une réponse qui ne viendrait
      // jamais. On lui donne le lien pour qu'il le transmette lui-même.
      setAvis(
        data.emailEnvoye === false
          ? data.lien
            ? `Accès accordé, mais l'e-mail n'est pas parti. Transmettez ce lien vous-même : ${data.lien}`
            : "Accès accordé, mais l'e-mail n'est pas parti. Prévenez la personne vous-même."
          : null
      );
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
      if (!dejaDiffuse) {
        setErreurPub(
          "Diffusez d'abord le gent (bouton « Diffuser » dans le menu de gauche), puis cliquez sur Publier."
        );
        return;
      }
      const probleme = slugProbleme(toSlug(slug));
      if (probleme) {
        setErreurPub(slugMessage(probleme));
        return;
      }
    }
    setOccupe(true);
    try {
      // Diffuser et ATTENDRE le serveur — sans ça, « Publier » part à vide
      // (surtout si un 401/503 antérieur avait coupé les syncs en silence).
      if (visibility === "public") {
        const push = await publishDraft();
        if (!push.ok) {
          setErreurPub(messagePublication(push.error, push.status));
          return;
        }
      }
      const res = await fetch(`/api/gents/${encodeURIComponent(gentId)}/publication`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility, slug: toSlug(slug), summary: resume, publicChat: chatPublic }),
      });
      const data = (await res.json()) as { error?: string; slug?: string; slugAjuste?: boolean };
      if (!res.ok) {
        setErreurPub(messagePublication(data.error, res.status));
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

  const origine =
    (typeof window !== "undefined" ? window.location.origin : null) ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://getgents.ai";
  const domaine = origine.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const urlPublique = `${origine.replace(/\/$/, "")}/${slug}`;

  return (
    <div className={styles.panneau}>
      <section className={styles.bloc}>
        <h3 className={styles.titre}>Partager avec quelqu&apos;un</h3>
        <p className={styles.aide}>
          La personne reçoit un e-mail. Si elle n&apos;a pas encore de compte, le gent
          l&apos;attendra à sa première connexion avec cette adresse.
        </p>

        {erreur ? <div className={styles.erreur}>{erreur}</div> : null}
        {avis ? (
          <div className={styles.avis} role="status">
            {avis}
          </div>
        ) : null}

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
          de recherche. L&apos;adresse publique n&apos;est <b>pas</b> l&apos;URL du studio
          (celle avec <code>draft-…</code>) : c&apos;est{" "}
          <code>
            {domaine}/
            {slug || "mon-gent"}
          </code>
          .
        </p>

        {!dejaDiffuse && (
          <div className={styles.erreur} role="status">
            Ce gent n&apos;est pas encore diffusé. Cliquez d&apos;abord sur{" "}
            <b>Diffuser</b> dans le menu de gauche, puis revenez publier ici.
          </div>
        )}

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
            disabled={occupe || !dejaDiffuse}
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
            En ligne sur{" "}
            <a className={styles.lienPublic} href={urlPublique} target="_blank" rel="noreferrer">
              {domaine}/{slug}
            </a>
            . Dépublier retire la page, mais une adresse déjà indexée peut rester visible quelque
            temps dans les moteurs.
          </p>
        )}
      </section>
    </div>
  );
}
