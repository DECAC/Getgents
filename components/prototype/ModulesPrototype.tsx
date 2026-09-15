"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ModulesPrototype.module.css";

/* ==========================================================================
 * Prototype de refonte des modules générés.
 *
 * Tout est simulé côté client : aucun appel réseau, aucune dépendance au
 * reste de l'app. L'objectif est de juger la SENSATION — l'espace comme une
 * petite application dont les onglets et les tuiles évoluent au fil des
 * échanges — avant d'engager la refonte du socle.
 * ========================================================================== */

type BlockKind =
  | "heading"
  | "text"
  | "stats"
  | "chart"
  | "table"
  | "callout"
  | "checklist"
  | "map"
  | "profile"
  | "contacts"
  | "jobs"
  | "actions";

type ContactStatus = "todo" | "sent" | "replied";

interface JobItem {
  title: string;
  company: string;
  place: string;
  contract: string;
  remote: boolean;
  match: number;
  salary: string;
  note: string;
  dismissed?: boolean;
}

type Block =
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string }
  | { kind: "stats"; items: { value: string; label: string; delta?: string; dir?: "up" | "down" }[] }
  | { kind: "chart"; caption: string; series: { label: string; value: number; muted?: boolean }[] }
  | { kind: "table"; columns: string[]; numeric?: number[]; rows: string[][] }
  | { kind: "callout"; tone: "info" | "warning" | "success"; title?: string; text: string }
  | { kind: "checklist"; items: { label: string; done: boolean }[] }
  | { kind: "map"; points: { label: string; x: number; y: number }[] }
  | {
      kind: "profile";
      initials: string;
      name: string;
      headline: string;
      facts: { value: string; label: string }[];
      skills: string[];
      completeness: number;
    }
  | { kind: "contacts"; items: { name: string; role: string; last: string; status: ContactStatus }[] }
  | { kind: "jobs"; filters: string[]; active: string; expanded: number | null; items: JobItem[] }
  | { kind: "actions"; items: string[] };

type Size = "compact" | "standard" | "large" | "full";
type Freshness = "fresh" | "stale" | "error";
type Status = "ready" | "building" | "draft";
type Glyph =
  | "chart"
  | "check"
  | "map"
  | "doc"
  | "alert"
  | "sun"
  | "user"
  | "users"
  | "briefcase"
  | "mail"
  | "compass";

interface ModuleItem {
  id: string;
  title: string;
  theme: string;
  glyph: Glyph;
  size: Size;
  source: string;
  updatedAt: string;
  freshness: Freshness;
  status: Status;
  pinned: boolean;
  version: number;
  /** Nombre de blocs déjà rendus — c'est lui qui produit la construction progressive. */
  revealed: number;
  blocks: Block[];
  errorText?: string;
  /** Ce qui a produit le module : sans ça, « Rafraîchir » ne saurait quoi relancer. */
  intent: string;
  /** Module fraîchement proposé : il attend « Garder » ou « Écarter ». */
  awaitingVerdict?: boolean;
  /** A bougé depuis le dernier passage — allume la pastille de l'onglet. */
  recent?: boolean;
}

interface EspaceMeta {
  id: string;
  name: string;
  glyph: Glyph;
  themes: string[];
  activity: string;
}

const SIZE_CLASS: Record<Size, string> = {
  compact: styles.sizeCompact,
  standard: styles.sizeStandard,
  large: styles.sizeLarge,
  full: styles.sizeFull,
};

const SIZE_LABEL: Record<Size, string> = {
  compact: "S",
  standard: "M",
  large: "L",
  full: "XL",
};

/* ---------------------------------------------------------------- Icônes */

function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "chart":
      return (
        <svg {...p}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      );
    case "check":
      return (
        <svg {...p}>
          <path d="M4 12l5 5L20 6" />
        </svg>
      );
    case "map":
      return (
        <svg {...p}>
          <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15" />
        </svg>
      );
    case "doc":
      return (
        <svg {...p}>
          <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />
        </svg>
      );
    case "alert":
      return (
        <svg {...p}>
          <path d="M12 4 2 20h20L12 4zM12 10v4M12 17.5v.5" />
        </svg>
      );
    case "sun":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
        </svg>
      );
    case "user":
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
      );
    case "users":
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3.4" />
          <path d="M2 20c0-3.4 3.1-5.2 7-5.2s7 1.8 7 5.2M16 5.2a3.4 3.4 0 0 1 0 6.6M18 20c0-2.4-.9-4-2.4-5" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...p}>
          <rect x="3" y="7" width="18" height="13" rx="2.5" />
          <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18" />
        </svg>
      );
    case "mail":
      return (
        <svg {...p}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...p}>
          <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
        </svg>
      );
    case "wand":
      return (
        <svg {...p}>
          <path d="M4 20 16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM19 11l.7 1.3 1.3.7-1.3.7-.7 1.3-.7-1.3-1.3-.7 1.3-.7.7-1.3z" />
        </svg>
      );
    case "expand":
      return (
        <svg {...p}>
          <path d="M9 3H3v6M15 21h6v-6M3 3l7 7M21 21l-7-7" />
        </svg>
      );
    case "more":
      return (
        <svg {...p}>
          <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "pin":
      return (
        <svg {...p}>
          <path d="M15 3l6 6-3 1-4 4-1 5-6-6 5-1 4-4 -1-3zM8 16l-4 4" />
        </svg>
      );
    case "trash":
      return (
        <svg {...p}>
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
        </svg>
      );
    case "history":
      return (
        <svg {...p}>
          <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2" />
        </svg>
      );
    case "export":
      return (
        <svg {...p}>
          <path d="M12 16V4M8 8l4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
      );
    case "send":
      return (
        <svg {...p} strokeWidth={2.2}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case "compass":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5z" />
        </svg>
      );
    case "info":
      return (
        <svg {...p} strokeWidth={2.2}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7.5v.5" />
        </svg>
      );
    case "edit":
      return (
        <svg {...p}>
          <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
        </svg>
      );
    case "x":
      return (
        <svg {...p} strokeWidth={2.4}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...p}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------ Les espaces */

const ESPACES: EspaceMeta[] = [
  {
    id: "emploi",
    name: "Recherche d'emploi",
    glyph: "briefcase",
    themes: ["Mon profil", "Réseau", "Postes identifiés", "Candidatures"],
    activity: "Le gent a repéré 2 nouveaux postes et mis à jour votre profil ce matin.",
  },
  {
    id: "voyage",
    name: "Voyage Japon",
    glyph: "compass",
    themes: ["Budget & dépenses", "Sur place", "Formalités"],
    activity: "Le gent a rafraîchi le budget il y a 2 heures.",
  },
];

const EMPLOI: ModuleItem[] = [
  {
    id: "cv",
    title: "Mon mini CV",
    theme: "Mon profil",
    glyph: "user",
    size: "large",
    source: "profil + LinkedIn",
    updatedAt: "il y a 1 h",
    freshness: "fresh",
    status: "ready",
    pinned: true,
    version: 4,
    revealed: 3,
    recent: true,
    intent: "Consolider le profil professionnel à partir des échanges et du CV importé",
    blocks: [
      {
        kind: "profile",
        initials: "CL",
        name: "Camille Léaud",
        headline: "Cheffe de projet digital · 6 ans d'expérience",
        facts: [
          { value: "6 ans", label: "Expérience" },
          { value: "Sous 1 mois", label: "Disponibilité" },
          { value: "48–56 k€", label: "Prétentions" },
        ],
        skills: ["Gestion de projet", "Product discovery", "Figma", "SQL", "Anglais courant"],
        completeness: 78,
      },
      {
        kind: "callout",
        tone: "warning",
        title: "Il manque vos résultats chiffrés",
        text: "Deux expériences sur trois n'ont pas d'indicateur. C'est le premier filtre des recruteurs.",
      },
      {
        kind: "actions",
        items: ["Ajouter mes résultats chiffrés", "Adapter mon CV à une offre", "Générer une version PDF"],
      },
    ],
  },
  {
    id: "atouts",
    title: "Ce qui ressort de votre parcours",
    theme: "Mon profil",
    glyph: "doc",
    size: "standard",
    source: "analyse du gent",
    updatedAt: "il y a 1 h",
    freshness: "fresh",
    status: "ready",
    pinned: false,
    version: 1,
    revealed: 2,
    intent: "Identifier les points forts à mettre en avant",
    blocks: [
      {
        kind: "text",
        text: "Votre fil conducteur est la refonte de parcours utilisateurs dans des équipes réduites. C'est un profil recherché par les scale-ups qui structurent leur produit.",
      },
      {
        kind: "callout",
        tone: "success",
        text: "Angle recommandé : « je fais avancer un produit avec peu de moyens et beaucoup de méthode ».",
      },
    ],
  },
  {
    id: "contacts",
    title: "Contacts clés de votre réseau",
    theme: "Réseau",
    glyph: "users",
    size: "large",
    source: "LinkedIn + Gmail",
    updatedAt: "il y a 3 h",
    freshness: "fresh",
    status: "ready",
    pinned: false,
    version: 2,
    revealed: 2,
    recent: true,
    intent: "Identifier les personnes du réseau les mieux placées pour ouvrir une porte",
    blocks: [
      {
        kind: "contacts",
        items: [
          { name: "Inès Moreau", role: "Head of Product · Alma", last: "échange il y a 3 semaines", status: "todo" },
          { name: "Thomas Berger", role: "CTO · Swile", last: "relancé lundi", status: "sent" },
          { name: "Sofia Nunes", role: "Recruteuse · Doctolib", last: "a répondu vendredi", status: "replied" },
          { name: "Marc Delaunay", role: "Ex-manager · Ubisoft", last: "aucun échange depuis 8 mois", status: "todo" },
          { name: "Léa Fontaine", role: "Product Owner · Qonto", last: "échange il y a 5 jours", status: "sent" },
        ],
      },
      { kind: "actions", items: ["Qui relancer en priorité ?", "Rédiger un message à Inès"] },
    ],
  },
  {
    id: "relances",
    title: "Relances à faire",
    theme: "Réseau",
    glyph: "check",
    size: "compact",
    source: "manuel",
    updatedAt: "hier",
    freshness: "fresh",
    status: "ready",
    pinned: false,
    version: 1,
    revealed: 1,
    intent: "Suivre les relances de réseau",
    blocks: [
      {
        kind: "checklist",
        items: [
          { label: "Répondre à Sofia", done: true },
          { label: "Message à Marc", done: false },
          { label: "Café avec Inès", done: false },
          { label: "Mettre à jour LinkedIn", done: false },
        ],
      },
    ],
  },
  {
    id: "postes",
    title: "Postes identifiés pour vous",
    theme: "Postes identifiés",
    glyph: "briefcase",
    size: "full",
    source: "Welcome to the Jungle + APEC",
    updatedAt: "il y a 20 min",
    freshness: "fresh",
    status: "ready",
    pinned: true,
    version: 7,
    revealed: 2,
    recent: true,
    intent: "Repérer les offres correspondant au profil et les classer par pertinence",
    blocks: [
      {
        kind: "jobs",
        filters: ["Tous", "Télétravail", "CDI", "Score > 80"],
        active: "Tous",
        expanded: 0,
        items: [
          {
            title: "Product Manager — parcours client",
            company: "Alma",
            place: "Paris 11e",
            contract: "CDI",
            remote: true,
            match: 92,
            salary: "52–60 k€",
            note: "Inès Moreau y est Head of Product : une introduction interne vaut mieux qu'une candidature à froid.",
          },
          {
            title: "Cheffe de projet digital senior",
            company: "Doctolib",
            place: "Levallois",
            contract: "CDI",
            remote: true,
            match: 84,
            salary: "50–58 k€",
            note: "Sofia Nunes, qui vous a répondu vendredi, recrute sur ce poste.",
          },
          {
            title: "Product Owner — outils internes",
            company: "Qonto",
            place: "Paris 2e",
            contract: "CDI",
            remote: false,
            match: 76,
            salary: "48–54 k€",
            note: "Poste plus technique que votre historique, mais Léa Fontaine peut vous briefer.",
          },
          {
            title: "Consultante transformation digitale",
            company: "Wavestone",
            place: "La Défense",
            contract: "CDI",
            remote: false,
            match: 61,
            salary: "45–52 k€",
            note: "Rythme conseil, déplacements fréquents — éloigné de vos critères déclarés.",
          },
          {
            title: "Product Manager (freelance 6 mois)",
            company: "Swile",
            place: "Montpellier",
            contract: "Freelance",
            remote: true,
            match: 71,
            salary: "550 €/j",
            note: "Thomas Berger est CTO ici. Mission courte, utile si la recherche s'étire.",
          },
        ],
      },
      {
        kind: "actions",
        items: ["Trouver des postes similaires", "Préparer un entretien Alma", "Élargir à Lyon et Bordeaux"],
      },
    ],
  },
  {
    id: "marche",
    title: "Marché et salaires",
    theme: "Postes identifiés",
    glyph: "chart",
    size: "standard",
    source: "APEC",
    updatedAt: "3 août",
    freshness: "stale",
    status: "ready",
    pinned: false,
    version: 1,
    revealed: 2,
    intent: "Situer les prétentions salariales par rapport au marché",
    blocks: [
      {
        kind: "stats",
        items: [
          { value: "54 k€", label: "Médiane du poste" },
          { value: "+11 %", label: "Vs vos prétentions", delta: "marge de négociation", dir: "down" },
        ],
      },
      {
        kind: "chart",
        caption: "Salaire brut annuel médian par niveau, en k€ · source APEC · 2026",
        series: [
          { label: "Junior", value: 38 },
          { label: "Confirmé", value: 46 },
          { label: "Senior", value: 58 },
          { label: "Lead", value: 70, muted: true },
        ],
      },
    ],
  },
  {
    id: "suivi",
    title: "Suivi des candidatures",
    theme: "Candidatures",
    glyph: "mail",
    size: "large",
    source: "Gmail",
    updatedAt: "il y a 40 min",
    freshness: "fresh",
    status: "ready",
    pinned: false,
    version: 5,
    revealed: 2,
    intent: "Suivre l'avancement de chaque candidature envoyée",
    blocks: [
      {
        kind: "stats",
        items: [
          { value: "7", label: "Envoyées" },
          { value: "2", label: "Entretiens" },
          { value: "3", label: "Sans réponse" },
        ],
      },
      {
        kind: "table",
        columns: ["Entreprise", "Poste", "Étape", "Depuis"],
        rows: [
          ["Alma", "Product Manager", "Entretien RH", "2 jours"],
          ["Doctolib", "Cheffe de projet", "CV envoyé", "6 jours"],
          ["Qonto", "Product Owner", "Test technique", "1 jour"],
          ["Payfit", "PM outils", "Sans réponse", "18 jours"],
        ],
      },
    ],
  },
  {
    id: "prochaine",
    title: "Prochaine étape",
    theme: "Candidatures",
    glyph: "alert",
    size: "compact",
    source: "analyse du gent",
    updatedAt: "il y a 40 min",
    freshness: "fresh",
    status: "ready",
    pinned: false,
    version: 1,
    revealed: 2,
    intent: "Dire quoi faire maintenant",
    blocks: [
      {
        kind: "callout",
        tone: "warning",
        title: "Entretien Alma jeudi 10 h",
        text: "Payfit est sans réponse depuis 18 jours : une relance courte suffit.",
      },
      { kind: "actions", items: ["Préparer l'entretien Alma", "Relancer Payfit"] },
    ],
  },
];

const VOYAGE: ModuleItem[] = [
  {
    id: "budget",
    title: "Budget prévisionnel",
    theme: "Budget & dépenses",
    glyph: "chart",
    size: "large",
    source: "Powens",
    updatedAt: "il y a 2 h",
    freshness: "fresh",
    status: "ready",
    pinned: true,
    version: 3,
    revealed: 3,
    intent: "Suivre le budget du voyage à partir des comptes connectés",
    blocks: [
      {
        kind: "stats",
        items: [
          { value: "2 340 €", label: "Budget total", delta: "+180 € ce mois", dir: "up" },
          { value: "840 €", label: "Transport" },
          { value: "1 500 €", label: "Sur place" },
        ],
      },
      {
        kind: "chart",
        caption: "Dépenses engagées par mois, en euros · source Powens · 4 derniers mois",
        series: [
          { label: "Avr", value: 210 },
          { label: "Mai", value: 480 },
          { label: "Juin", value: 900 },
          { label: "Juil", value: 750, muted: true },
        ],
      },
      {
        kind: "table",
        columns: ["Poste", "Engagé", "Reste"],
        numeric: [1, 2],
        rows: [
          ["Billets d'avion", "780 €", "0 €"],
          ["Hébergement", "620 €", "380 €"],
          ["Transport sur place", "0 €", "260 €"],
        ],
      },
    ],
  },
  {
    id: "itineraire",
    title: "Itinéraire jour par jour",
    theme: "Sur place",
    glyph: "map",
    size: "large",
    source: "web",
    updatedAt: "3 août",
    freshness: "stale",
    status: "ready",
    pinned: false,
    version: 1,
    revealed: 2,
    intent: "Construire l'itinéraire entre Tokyo, Kyoto et Osaka",
    blocks: [
      {
        kind: "map",
        points: [
          { label: "Tokyo", x: 72, y: 38 },
          { label: "Kyoto", x: 44, y: 56 },
          { label: "Osaka", x: 36, y: 66 },
          { label: "Hakone", x: 62, y: 48 },
        ],
      },
      {
        kind: "text",
        text: "Quatre étapes sur douze jours. Le trajet Tokyo → Kyoto se fait en 2 h 15 par Shinkansen ; Kyoto → Osaka en 30 minutes, ce qui permet de garder une seule base pour les deux villes.",
      },
    ],
  },
  {
    id: "checklist",
    title: "Avant le départ",
    theme: "Formalités",
    glyph: "check",
    size: "compact",
    source: "manuel",
    updatedAt: "hier",
    freshness: "fresh",
    status: "ready",
    pinned: false,
    version: 1,
    revealed: 1,
    intent: "Lister les démarches à effectuer avant le départ",
    blocks: [
      {
        kind: "checklist",
        items: [
          { label: "Passeport valide 6 mois", done: true },
          { label: "Visa dématérialisé", done: true },
          { label: "Assurance voyage", done: false },
          { label: "Change en yens", done: false },
          { label: "Adaptateur type A", done: false },
        ],
      },
    ],
  },
  {
    id: "formalites",
    title: "Formalités d'entrée au Japon",
    theme: "Formalités",
    glyph: "doc",
    size: "large",
    source: "web",
    updatedAt: "il y a 2 h",
    freshness: "fresh",
    status: "ready",
    pinned: false,
    version: 1,
    revealed: 4,
    intent: "Résumer les formalités d'entrée pour un séjour touristique",
    blocks: [
      { kind: "heading", text: "Ce qui a changé en 2026" },
      {
        kind: "text",
        text: "Depuis avril 2026, le visa court séjour touristique est entièrement dématérialisé. La demande se fait en ligne et la réponse arrive par courriel, sans passage au consulat.",
      },
      {
        kind: "callout",
        tone: "info",
        title: "Délai officiel : 5 jours ouvrés",
        text: "Comptez une semaine pleine en période de vacances scolaires japonaises.",
      },
      {
        kind: "table",
        columns: ["Document", "Obligatoire", "Validité"],
        rows: [
          ["Passeport", "Oui", "6 mois après le retour"],
          ["Visa en ligne", "Oui", "90 jours"],
          ["Attestation d'hébergement", "Non", "—"],
        ],
      },
    ],
  },
  {
    id: "vols",
    title: "Vols surveillés",
    theme: "Budget & dépenses",
    glyph: "alert",
    size: "compact",
    source: "Skyscanner",
    updatedAt: "il y a 20 min",
    freshness: "error",
    status: "ready",
    pinned: false,
    version: 2,
    revealed: 0,
    errorText: "Le connecteur Skyscanner n'a pas répondu dans le délai imparti.",
    intent: "Surveiller le prix des vols Paris–Tokyo",
    blocks: [
      {
        kind: "stats",
        items: [
          { value: "612 €", label: "Meilleur prix", delta: "−48 € en 7 j", dir: "down" },
          { value: "3", label: "Alertes actives" },
        ],
      },
    ],
  },
];

const SEED: Record<string, ModuleItem[]> = { emploi: EMPLOI, voyage: VOYAGE };

/** Suggestions du composeur, par espace. */
const IDEAS: Record<string, string[]> = {
  emploi: [
    "Analyse mon adéquation avec l'offre Alma",
    "Rédige un message à Inès Moreau",
    "Où en sont mes candidatures ?",
  ],
  voyage: ["Compare les quartiers où loger à Tokyo", "Où part mon budget ce mois-ci ?", "Météo des sept prochains jours"],
};

/* ---------------------------------------------------- Blocs interactifs */

function ProfileBlock({
  block,
  update,
  onAsk,
}: {
  block: Extract<Block, { kind: "profile" }>;
  update: (b: Block) => void;
  onAsk: (p: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.headline);
  const [adding, setAdding] = useState(false);
  const [skill, setSkill] = useState("");

  return (
    <>
      <div className={styles.profile}>
        <span className={styles.avatar}>{block.initials}</span>
        <div className={styles.profileMain}>
          <div className={styles.profileName}>{block.name}</div>
          <div className={styles.headlineRow}>
            {editing ? (
              <input
                className={styles.headlineInput}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  update({ ...block, headline: draft.trim() || block.headline });
                  setEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    update({ ...block, headline: draft.trim() || block.headline });
                    setEditing(false);
                  }
                  if (e.key === "Escape") {
                    setDraft(block.headline);
                    setEditing(false);
                  }
                }}
                aria-label="Titre du profil"
              />
            ) : (
              <>
                <button type="button" className={styles.headline} onClick={() => setEditing(true)}>
                  {block.headline}
                </button>
                <Icon name="edit" size={12} />
              </>
            )}
          </div>
          <div className={styles.facts}>
            {block.facts.map((f) => (
              <div key={f.label}>
                <div className={styles.factValue}>{f.value}</div>
                <div className={styles.factLabel}>{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.skills}>
        {block.skills.map((s) => (
          <span className={styles.skill} key={s}>
            {s}
            <button
              type="button"
              className={styles.skillX}
              aria-label={`Retirer ${s}`}
              onClick={() => update({ ...block, skills: block.skills.filter((x) => x !== s) })}
            >
              <Icon name="x" size={9} />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            className={styles.skillInput}
            value={skill}
            autoFocus
            placeholder="Compétence…"
            onChange={(e) => setSkill(e.target.value)}
            onBlur={() => setAdding(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && skill.trim()) {
                update({ ...block, skills: [...block.skills, skill.trim()] });
                setSkill("");
                setAdding(false);
              }
              if (e.key === "Escape") setAdding(false);
            }}
          />
        ) : (
          <button type="button" className={styles.skillAdd} onClick={() => setAdding(true)}>
            + Compétence
          </button>
        )}
      </div>

      <div>
        <div className={styles.meterRow}>
          <span className={styles.meterLabel}>Profil complété</span>
          <span className={styles.meterValue}>{block.completeness} %</span>
        </div>
        <div className={styles.meter}>
          <span className={styles.meterFill} style={{ width: `${block.completeness}%` }} />
        </div>
        <button
          type="button"
          className={styles.skillAdd}
          style={{ marginTop: 8 }}
          onClick={() => onAsk("Aide-moi à compléter mon profil")}
        >
          Compléter les 22 % manquants
        </button>
      </div>
    </>
  );
}

const CONTACT_STATUS: Record<ContactStatus, { label: string; cls: string; next: ContactStatus }> = {
  todo: { label: "À relancer", cls: styles.stTodo, next: "sent" },
  sent: { label: "Relancé", cls: styles.stSent, next: "replied" },
  replied: { label: "A répondu", cls: styles.stReplied, next: "todo" },
};

function ContactsBlock({
  block,
  update,
  onAsk,
}: {
  block: Extract<Block, { kind: "contacts" }>;
  update: (b: Block) => void;
  onAsk: (p: string) => void;
}) {
  return (
    <div className={styles.contacts}>
      {block.items.map((c, i) => {
        const st = CONTACT_STATUS[c.status];
        const initials = c.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2);
        return (
          <div className={styles.contactRow} key={c.name}>
            <span className={styles.contactAvatar}>{initials}</span>
            <span className={styles.contactMain}>
              <span className={styles.contactName}>{c.name}</span>
              <span className={styles.contactRole}>
                {c.role} · {c.last}
              </span>
            </span>
            <button
              type="button"
              className={[styles.statusPill, st.cls].join(" ")}
              title="Changer le statut"
              onClick={() =>
                update({
                  ...block,
                  items: block.items.map((x, j) => (j === i ? { ...x, status: st.next } : x)),
                })
              }
            >
              {st.label}
            </button>
            <button
              type="button"
              className={styles.contactAction}
              title={`Rédiger un message à ${c.name}`}
              onClick={() => onAsk(`Rédige un message à ${c.name}`)}
            >
              <Icon name="mail" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function JobsBlock({
  block,
  update,
  onAsk,
}: {
  block: Extract<Block, { kind: "jobs" }>;
  update: (b: Block) => void;
  onAsk: (p: string) => void;
}) {
  const shown = block.items
    .map((j, i) => ({ job: j, i }))
    .filter(({ job }) => {
      if (job.dismissed) return false;
      if (block.active === "Télétravail") return job.remote;
      if (block.active === "CDI") return job.contract === "CDI";
      if (block.active === "Score > 80") return job.match > 80;
      return true;
    });

  return (
    <>
      <div className={styles.jobFilters}>
        {block.filters.map((f) => (
          <button
            type="button"
            key={f}
            className={[styles.jobChip, block.active === f ? styles.jobChipOn : ""].filter(Boolean).join(" ")}
            onClick={() => update({ ...block, active: f, expanded: null })}
          >
            {f}
          </button>
        ))}
      </div>

      <div className={styles.jobList}>
        {shown.map(({ job, i }) => {
          const open = block.expanded === i;
          return (
            <div className={[styles.job, open ? styles.jobOpen : ""].filter(Boolean).join(" ")} key={job.title}>
              <button
                type="button"
                className={styles.jobHead}
                onClick={() => update({ ...block, expanded: open ? null : i })}
                aria-expanded={open}
              >
                <span className={styles.jobMain}>
                  <span className={styles.jobTitle}>{job.title}</span>
                  <span className={styles.jobMeta}>
                    {job.company} · {job.place} · {job.contract}
                    {job.remote ? " · télétravail" : ""}
                  </span>
                </span>
                <span className={styles.jobMatch}>
                  <span className={styles.jobMatchValue}>{job.match} %</span>
                  <span className={styles.matchBar}>
                    <span
                      className={[styles.matchFill, job.match < 75 ? styles.matchFillMid : ""].filter(Boolean).join(" ")}
                      style={{ width: `${job.match}%` }}
                    />
                  </span>
                </span>
                <Icon name="chevron" size={14} />
              </button>

              {open && (
                <div className={styles.jobBody}>
                  <div className={styles.jobTags}>
                    <span className={styles.jobTag}>{job.salary}</span>
                    <span className={styles.jobTag}>{job.contract}</span>
                    {job.remote && <span className={styles.jobTag}>Télétravail</span>}
                  </div>
                  <p className={styles.jobNote}>{job.note}</p>
                  <div className={styles.jobActions}>
                    <button
                      type="button"
                      className={styles.jobBtn}
                      onClick={() => onAsk(`Prépare ma candidature pour ${job.title} chez ${job.company}`)}
                    >
                      Préparer ma candidature
                    </button>
                    <button
                      type="button"
                      className={styles.jobBtnGhost}
                      onClick={() =>
                        update({
                          ...block,
                          expanded: null,
                          items: block.items.map((x, j) => (j === i ? { ...x, dismissed: true } : x)),
                        })
                      }
                    >
                      Pas pour moi
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------ Rendu bloc */

function BlockView({
  block,
  update,
  onAsk,
}: {
  block: Block;
  update: (b: Block) => void;
  onAsk: (p: string) => void;
}) {
  switch (block.kind) {
    case "heading":
      return <div className={styles.blockHeading}>{block.text}</div>;

    case "text":
      return <p className={styles.blockText}>{block.text}</p>;

    case "stats":
      return (
        <div className={styles.stats}>
          {block.items.map((s) => (
            <div className={styles.stat} key={s.label}>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
              {s.delta && (
                <div
                  className={[styles.statDelta, s.dir === "down" ? styles.deltaDown : styles.deltaUp]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {s.delta}
                </div>
              )}
            </div>
          ))}
        </div>
      );

    case "chart": {
      const max = Math.max(...block.series.map((d) => d.value), 1);
      return (
        <div>
          <div className={styles.chart}>
            {block.series.map((d) => (
              <div className={styles.chartCol} key={d.label}>
                <div
                  className={[styles.bar, d.muted ? styles.barMuted : ""].filter(Boolean).join(" ")}
                  style={{ height: `${Math.max(6, (d.value / max) * 100)}%` }}
                  title={`${d.label} : ${d.value}`}
                />
                <span className={styles.barLabel}>{d.label}</span>
              </div>
            ))}
          </div>
          <div className={styles.chartCaption}>{block.caption}</div>
        </div>
      );
    }

    case "table":
      return (
        <table className={styles.table}>
          <thead>
            <tr>
              {block.columns.map((c, i) => (
                <th key={c} className={block.numeric?.includes(i) ? styles.tdNum : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={block.numeric?.includes(ci) ? styles.tdNum : undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "callout": {
      const toneClass =
        block.tone === "warning"
          ? styles.calloutWarning
          : block.tone === "success"
            ? styles.calloutSuccess
            : styles.calloutInfo;
      return (
        <div className={[styles.callout, toneClass].join(" ")}>
          <span className={styles.calloutIcon}>
            <Icon name="info" size={14} />
          </span>
          <span>
            {block.title && <strong className={styles.calloutTitle}>{block.title}</strong>}
            {block.text}
          </span>
        </div>
      );
    }

    case "checklist":
      return (
        <div className={styles.checklist}>
          {block.items.map((item, i) => (
            <button
              type="button"
              className={styles.checkRow}
              key={item.label}
              onClick={() =>
                update({
                  ...block,
                  items: block.items.map((it, j) => (j === i ? { ...it, done: !it.done } : it)),
                })
              }
            >
              <span className={[styles.box, item.done ? styles.boxOn : ""].filter(Boolean).join(" ")}>
                <Icon name="check" size={11} />
              </span>
              <span className={item.done ? styles.checkDone : undefined}>{item.label}</span>
            </button>
          ))}
        </div>
      );

    case "map":
      return (
        <div className={styles.mapBox}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M18 74 L30 58 L38 62 L46 44 L58 50 L70 30 L84 36"
              fill="none"
              stroke="var(--line)"
              strokeWidth="0.8"
            />
            <path d="M0 82 L26 70 L52 78 L78 62 L100 70 L100 100 L0 100 Z" fill="var(--line-soft)" />
          </svg>
          {block.points.map((pt) => (
            <span className={styles.mapPin} key={pt.label} style={{ left: `${pt.x}%`, top: `${pt.y}%` }}>
              <span className={styles.mapPinLabel}>{pt.label}</span>
              <span className={styles.mapPinDot} />
            </span>
          ))}
        </div>
      );

    case "profile":
      return <ProfileBlock block={block} update={update} onAsk={onAsk} />;

    case "contacts":
      return <ContactsBlock block={block} update={update} onAsk={onAsk} />;

    case "jobs":
      return <JobsBlock block={block} update={update} onAsk={onAsk} />;

    case "actions":
      return (
        <div className={styles.actionPills}>
          {block.items.map((a) => (
            <button type="button" className={styles.actionPill} key={a} onClick={() => onAsk(a)}>
              <Icon name="wand" size={12} />
              {a}
            </button>
          ))}
        </div>
      );

    default:
      return null;
  }
}

/** Silhouette du bloc en cours d'écriture — le contenu arrive par-dessus. */
function BlockSkeleton({ kind }: { kind: BlockKind }) {
  const tall = kind === "stats" || kind === "chart" || kind === "map" || kind === "table" || kind === "jobs" || kind === "contacts" || kind === "profile";
  if (tall) return <div className={[styles.shimmer, styles.shimmerBlock].join(" ")} />;
  return (
    <div className={styles.skeleton}>
      <div className={styles.shimmer} style={{ width: "92%" }} />
      <div className={styles.shimmer} style={{ width: "78%" }} />
    </div>
  );
}

/* ------------------------------------------------------------ Carte module */

function ModuleCard({
  module: m,
  onRefresh,
  onRefine,
  onUpdateBlock,
  onAsk,
  onSetSize,
  onTogglePin,
  onRemove,
  onKeep,
  dragging,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  module: ModuleItem;
  onRefresh: () => void;
  onRefine: (text: string) => void;
  onUpdateBlock: (index: number, block: Block) => void;
  onAsk: (prompt: string) => void;
  onSetSize: (size: Size) => void;
  onTogglePin: () => void;
  onRemove: () => void;
  onKeep: () => void;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineText, setRefineText] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const building = m.status === "building";
  const draft = m.status === "draft";

  const dotClass = building
    ? styles.dotBuilding
    : m.freshness === "error"
      ? styles.dotError
      : m.freshness === "stale"
        ? styles.dotStale
        : styles.dotFresh;

  const metaText = building
    ? "le gent construit ce module…"
    : m.freshness === "error"
      ? "échec de la dernière mise à jour"
      : `${m.updatedAt} · ${m.source}`;

  function submitRefine() {
    const t = refineText.trim();
    if (!t) return;
    onRefine(t);
    setRefineText("");
    setRefineOpen(false);
  }

  return (
    <section
      className={[
        styles.card,
        SIZE_CLASS[m.size],
        draft ? styles.cardDraft : "",
        m.pinned ? styles.cardPinned : "",
        dragging ? styles.cardDragging : "",
        dropTarget ? styles.cardDropTarget : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <header className={styles.head} draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <span className={[styles.glyph, m.pinned ? styles.glyphAccent : ""].filter(Boolean).join(" ")}>
          <Icon name={m.glyph} size={15} />
        </span>

        <div className={styles.headText}>
          <div className={styles.title}>{m.title}</div>
          <div className={styles.meta}>
            <span className={[styles.dot, dotClass].join(" ")} />
            {metaText}
          </div>
        </div>

        {m.version > 1 && !building && <span className={styles.version}>v{m.version}</span>}

        <div className={styles.menuWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Actions du module"
            aria-expanded={menuOpen}
          >
            <Icon name="more" size={16} />
          </button>

          {menuOpen && (
            <div className={styles.menu} role="menu">
              <div className={styles.menuLabel}>Taille</div>
              <div className={styles.sizeRow}>
                {(["compact", "standard", "large", "full"] as Size[]).map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={[styles.sizeChip, m.size === s ? styles.sizeChipOn : ""].filter(Boolean).join(" ")}
                    onClick={() => {
                      onSetSize(s);
                      setMenuOpen(false);
                    }}
                  >
                    {SIZE_LABEL[s]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  onTogglePin();
                  setMenuOpen(false);
                }}
              >
                <Icon name="pin" size={14} />
                {m.pinned ? "Retirer des épinglés" : "Épingler"}
              </button>
              <button type="button" className={styles.menuItem}>
                <Icon name="history" size={14} />
                Versions ({m.version})
              </button>
              <button type="button" className={styles.menuItem}>
                <Icon name="export" size={14} />
                Exporter
              </button>
              <button
                type="button"
                className={[styles.menuItem, styles.menuItemDanger].join(" ")}
                onClick={() => {
                  onRemove();
                  setMenuOpen(false);
                }}
              >
                <Icon name="trash" size={14} />
                Supprimer
              </button>
            </div>
          )}
        </div>
      </header>

      {m.freshness === "stale" && !building && (
        <div className={styles.staleBar}>
          <Icon name="alert" size={13} />
          Données du 3 août
          <button type="button" className={styles.staleAction} onClick={onRefresh}>
            Actualiser
          </button>
        </div>
      )}

      <div className={styles.body}>
        {m.freshness === "error" && !building ? (
          <div className={styles.errorBody}>
            <p className={styles.errorText}>{m.errorText}</p>
            <button type="button" className={styles.retryBtn} onClick={onRefresh}>
              <Icon name="refresh" size={13} />
              Réessayer
            </button>
          </div>
        ) : (
          <>
            {m.blocks.slice(0, m.revealed).map((b, i) => (
              <BlockView
                key={`${m.id}-${i}`}
                block={b}
                update={(next) => onUpdateBlock(i, next)}
                onAsk={onAsk}
              />
            ))}
            {building && m.revealed < m.blocks.length && <BlockSkeleton kind={m.blocks[m.revealed].kind} />}
          </>
        )}
      </div>

      {draft ? (
        <div className={styles.draftBar}>
          <span className={styles.draftHint}>Nouveau module</span>
          <button type="button" className={styles.dropBtn} onClick={onRemove}>
            Écarter
          </button>
          <button type="button" className={styles.keepBtn} onClick={onKeep}>
            Garder
          </button>
        </div>
      ) : refineOpen ? (
        <div className={styles.refineBar}>
          <input
            className={styles.refineInput}
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRefine();
              if (e.key === "Escape") setRefineOpen(false);
            }}
            placeholder="Trie par salaire, enlève les freelances…"
            aria-label="Affiner ce module"
            autoFocus
          />
          <button type="button" className={styles.refineSend} onClick={submitRefine} disabled={!refineText.trim()}>
            Affiner
          </button>
        </div>
      ) : (
        !building && (
          <div className={styles.actions}>
            <button type="button" className={styles.action} onClick={onRefresh}>
              <Icon name="refresh" size={13} />
              Rafraîchir
            </button>
            <button type="button" className={styles.action} onClick={() => setRefineOpen(true)}>
              <Icon name="wand" size={13} />
              Affiner
            </button>
            <button type="button" className={styles.action}>
              <Icon name="expand" size={13} />
              Ouvrir
            </button>
          </div>
        )
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Page */

const LAYOUT_KEY = "getgents:prototype-modules-layout";

/** Module fabriqué à la volée quand l'utilisateur demande quelque chose. */
function askedModule(prompt: string, theme: string): ModuleItem {
  const p = prompt.toLowerCase();
  const isMessage = /message|lettre|mail|relanc|candidature|entretien/.test(p);
  return {
    id: `m-${Date.now()}`,
    title: prompt.length > 44 ? `${prompt.slice(0, 44)}…` : prompt,
    theme,
    glyph: isMessage ? "mail" : "doc",
    size: "large",
    source: "gent",
    updatedAt: "à l'instant",
    freshness: "fresh",
    status: "building",
    pinned: false,
    version: 1,
    revealed: 0,
    awaitingVerdict: true,
    intent: prompt,
    blocks: isMessage
      ? [
          { kind: "heading", text: "Proposition de message" },
          {
            kind: "text",
            text: "Bonjour Inès, j'ai vu qu'Alma recrutait sur le parcours client. J'ai passé les six dernières années à refondre ce type de parcours dans des équipes réduites, et le poste correspond exactement à ce que je cherche. Seriez-vous disponible pour en parler quinze minutes cette semaine ?",
          },
          {
            kind: "callout",
            tone: "info",
            title: "Pourquoi ce ton",
            text: "Court, factuel, une seule demande. Les messages de plus de six lignes obtiennent deux fois moins de réponses.",
          },
          { kind: "actions", items: ["Plus court", "Ton plus direct", "Ajouter mes chiffres clés"] },
        ]
      : [
          { kind: "heading", text: "Ce qu'il faut retenir" },
          {
            kind: "text",
            text: "Un rapport n'est plus un bloc de texte : il est composé des mêmes blocs que les autres modules, il hérite donc de la même finition et des mêmes interactions.",
          },
          {
            kind: "callout",
            tone: "info",
            title: "Blocs disponibles",
            text: "titre, texte, encadré, tableau, chiffres clés, graphique, liste à cocher, carte, profil, contacts, offres, actions.",
          },
          { kind: "actions", items: ["Approfondir", "Résumer en trois points"] },
        ],
  };
}

export function ModulesPrototype() {
  const [espaceId, setEspaceId] = useState("emploi");
  const [data, setData] = useState<Record<string, ModuleItem[]>>(SEED);
  const [tab, setTab] = useState<string>("all");
  const [prompt, setPrompt] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const hydrated = useRef(false);

  const espace = ESPACES.find((e) => e.id === espaceId)!;
  const modules = data[espaceId];

  /* La disposition survit au rechargement — c'est ce qui manque le plus
   * aujourd'hui, où l'ordre et les tailles vivent en mémoire seulement. */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LAYOUT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, { id: string; size: Size; pinned: boolean }[]>;
        setData((all) => {
          const next: Record<string, ModuleItem[]> = { ...all };
          for (const [key, entries] of Object.entries(saved)) {
            const current = next[key];
            if (!current) continue;
            const byId = new Map(current.map((m) => [m.id, m]));
            const ordered: ModuleItem[] = [];
            for (const entry of entries) {
              const m = byId.get(entry.id);
              if (!m) continue;
              ordered.push({ ...m, size: entry.size, pinned: entry.pinned });
              byId.delete(entry.id);
            }
            next[key] = [...ordered, ...Array.from(byId.values())];
          }
          return next;
        });
      }
    } catch {
      /* disposition illisible : on garde celle par défaut */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const layout: Record<string, { id: string; size: Size; pinned: boolean }[]> = {};
    for (const [key, list] of Object.entries(data)) {
      layout[key] = list
        .filter((m) => m.status !== "draft")
        .map((m) => ({ id: m.id, size: m.size, pinned: m.pinned }));
    }
    try {
      window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      /* stockage indisponible : sans effet sur la démo */
    }
  }, [data]);

  /* Construction progressive : un bloc apparaît, puis le suivant. */
  const anyBuilding = useMemo(
    () => Object.values(data).some((list) => list.some((m) => m.status === "building")),
    [data]
  );

  useEffect(() => {
    if (!anyBuilding) return;
    const timer = window.setInterval(() => {
      setData((all) => {
        const next: Record<string, ModuleItem[]> = {};
        for (const [key, list] of Object.entries(all)) {
          next[key] = list.map((m) => {
            if (m.status !== "building") return m;
            const step = m.revealed + 1;
            if (step >= m.blocks.length) {
              return {
                ...m,
                revealed: m.blocks.length,
                status: m.awaitingVerdict ? "draft" : "ready",
                freshness: "fresh",
                updatedAt: "à l'instant",
              };
            }
            return { ...m, revealed: step };
          });
        }
        return next;
      });
    }, 480);
    return () => window.clearInterval(timer);
  }, [anyBuilding]);

  function setModules(fn: (list: ModuleItem[]) => ModuleItem[]) {
    setData((all) => ({ ...all, [espaceId]: fn(all[espaceId]) }));
  }

  function patch(id: string, fn: (m: ModuleItem) => ModuleItem) {
    setModules((list) => list.map((m) => (m.id === id ? fn(m) : m)));
  }

  function refresh(id: string) {
    patch(id, (m) => ({ ...m, status: "building", revealed: 0, freshness: "fresh", errorText: undefined }));
  }

  function refreshAll() {
    setModules((list) =>
      list.map((m) => (m.status === "ready" ? { ...m, status: "building", revealed: 0, errorText: undefined } : m))
    );
  }

  function refine(id: string, text: string) {
    patch(id, (m) => ({
      ...m,
      status: "building",
      revealed: 0,
      version: m.version + 1,
      freshness: "fresh",
      errorText: undefined,
      blocks: [
        ...m.blocks,
        { kind: "callout", tone: "success", title: "Affiné", text: `« ${text} » — appliqué à ce module.` },
      ],
    }));
  }

  /** Toute demande — barre du bas, action dans une tuile, bouton d'un poste. */
  function ask(prompt: string) {
    const question = prompt.trim();
    if (!question) return;
    const theme = tab === "all" || tab === "pinned" ? espace.themes[0] : tab;
    setModules((list) => [askedModule(question, theme), ...list]);
  }

  function reorder(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setModules((list) => {
      const from = list.findIndex((m) => m.id === dragId);
      const to = list.findIndex((m) => m.id === targetId);
      if (from < 0 || to < 0) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
    setOverId(null);
  }

  const visible = useMemo(() => {
    if (tab === "pinned") return modules.filter((m) => m.pinned);
    if (tab === "all") return modules;
    return modules.filter((m) => m.theme === tab);
  }, [modules, tab]);

  function cardFor(m: ModuleItem) {
    return (
      <ModuleCard
        key={m.id}
        module={m}
        dragging={dragId === m.id}
        dropTarget={overId === m.id && dragId !== m.id}
        onDragStart={() => setDragId(m.id)}
        onDragOver={() => setOverId(m.id)}
        onDrop={() => reorder(m.id)}
        onDragEnd={() => {
          setDragId(null);
          setOverId(null);
        }}
        onRefresh={() => refresh(m.id)}
        onRefine={(t) => refine(m.id, t)}
        onAsk={ask}
        onUpdateBlock={(index, block) =>
          patch(m.id, (x) => ({ ...x, blocks: x.blocks.map((b, i) => (i === index ? block : b)) }))
        }
        onSetSize={(s) => patch(m.id, (x) => ({ ...x, size: s }))}
        onTogglePin={() => patch(m.id, (x) => ({ ...x, pinned: !x.pinned }))}
        onRemove={() => setModules((list) => list.filter((x) => x.id !== m.id))}
        onKeep={() => patch(m.id, (x) => ({ ...x, status: "ready", awaitingVerdict: false }))}
      />
    );
  }

  const pinnedCount = modules.filter((m) => m.pinned).length;

  return (
    <div className={styles.page}>
      <div className={styles.demoNote}>
        <Icon name="info" size={13} />
        Prototype — contenu simulé, aucune donnée réelle. Route isolée : le produit n&apos;est pas modifié.
      </div>

      <header className={styles.topBar}>
        <span className={styles.espaceMark}>
          <Icon name={espace.glyph} size={16} />
        </span>
        <div>
          <h1 className={styles.espaceName}>{espace.name}</h1>
          <div className={styles.espaceSub}>
            {modules.length} modules · {pinnedCount} épinglé{pinnedCount > 1 ? "s" : ""}
          </div>
        </div>

        <span className={styles.topSpacer} />

        <div className={styles.espaceSwitch}>
          {ESPACES.map((e) => (
            <button
              type="button"
              key={e.id}
              className={[styles.espacePill, e.id === espaceId ? styles.espacePillOn : ""].filter(Boolean).join(" ")}
              onClick={() => {
                setEspaceId(e.id);
                setTab("all");
              }}
            >
              <Icon name={e.glyph} size={13} />
              {e.name}
            </button>
          ))}
        </div>

        <button type="button" className={styles.ghostBtn} onClick={refreshAll} disabled={anyBuilding}>
          <Icon name="refresh" size={14} />
          Tout rafraîchir
        </button>
      </header>

      {/* Les thèmes du gent deviennent la navigation principale : on survole
          son sujet par onglets, comme dans une application. */}
      <nav className={styles.tabsBar} aria-label="Thèmes de l'espace">
        <button
          type="button"
          className={[styles.tab, tab === "all" ? styles.tabOn : ""].filter(Boolean).join(" ")}
          onClick={() => setTab("all")}
        >
          Tout
          <span className={styles.tabCount}>{modules.length}</span>
        </button>

        {espace.themes.map((t) => {
          const list = modules.filter((m) => m.theme === t);
          const moved = list.some((m) => m.recent || m.status === "draft");
          return (
            <button
              type="button"
              key={t}
              className={[styles.tab, tab === t ? styles.tabOn : ""].filter(Boolean).join(" ")}
              onClick={() => setTab(t)}
            >
              {t}
              <span className={styles.tabCount}>{list.length}</span>
              {moved && <span className={styles.tabDot} title="Mis à jour récemment" />}
            </button>
          );
        })}

        <button
          type="button"
          className={[styles.tab, tab === "pinned" ? styles.tabOn : ""].filter(Boolean).join(" ")}
          onClick={() => setTab("pinned")}
        >
          <Icon name="pin" size={13} />
          Épinglés
          <span className={styles.tabCount}>{pinnedCount}</span>
        </button>
      </nav>

      <div className={styles.scroll}>
        <div className={styles.activity}>
          <span className={styles.activityDot} />
          {espace.activity}
        </div>

        {visible.length === 0 ? (
          <p className={styles.emptyView}>Rien dans cet onglet pour l&apos;instant.</p>
        ) : tab === "all" ? (
          espace.themes
            .map((t) => [t, visible.filter((m) => m.theme === t)] as const)
            .filter(([, list]) => list.length > 0)
            .map(([theme, list]) => (
              <div className={styles.themeGroup} key={theme}>
                <h2 className={styles.themeTitle}>
                  {theme}
                  <span className={styles.themeTitleLine} />
                </h2>
                <div className={styles.grid}>{list.map(cardFor)}</div>
              </div>
            ))
        ) : (
          <div className={styles.grid}>{visible.map(cardFor)}</div>
        )}
      </div>

      <div className={styles.composer}>
        <div className={styles.composerRow}>
          <input
            className={styles.composerInput}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              ask(prompt);
              setPrompt("");
            }}
            placeholder="Demandez quelque chose à votre gent…"
            aria-label="Demander un module"
          />
          <button
            type="button"
            className={styles.sendBtn}
            disabled={!prompt.trim()}
            onClick={() => {
              ask(prompt);
              setPrompt("");
            }}
            aria-label="Envoyer"
          >
            <Icon name="send" size={17} />
          </button>
        </div>
        <div className={styles.ideas}>
          {IDEAS[espaceId].map((idea) => (
            <button type="button" key={idea} className={styles.idea} onClick={() => ask(idea)}>
              {idea}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
