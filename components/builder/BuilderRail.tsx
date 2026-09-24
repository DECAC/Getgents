"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBuilder, type BuilderTab } from "@/lib/context/BuilderContext";
import { hasCustomName, isDirtySincePublish } from "@/lib/builderSnapshot";
import { ProductBrandMenu } from "@/components/shared/ProductBrandMenu";
import { useNavMobile } from "@/lib/context/NavMobileContext";
import styles from "./BuilderRail.module.css";
import { MenuCompte } from "@/components/compte/MenuCompte";
import { NouveauGentDialog } from "./NouveauGentDialog";

interface NavEntry {
  id: BuilderTab;
  label: string;
  icon: JSX.Element;
  blue?: boolean;
  /** Format activé sur ce gent : une pastille le signale dans le rail. */
  actif?: boolean;
}

interface NavSection {
  title?: string;
  entries: NavEntry[];
}

const ICON = {
  accueil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    </svg>
  ),
  mesgents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  ),
  miniapp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M8 8h8M8 12h5M8 16h8" />
    </svg>
  ),
  visionneuse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5z" />
      <path d="M8 8h7M8 12h7M8 16h4" />
    </svg>
  ),
  collaboratif: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M3.5 18.5c.8-3 2.8-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <path d="M13 18.5c.5-2 1.8-3.2 3.5-3.2 1.4 0 2.5.8 3 2.2" />
    </svg>
  ),
  options: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  ),
  nouveau: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  connectors: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 7H7a5 5 0 0 0 0 10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
    </svg>
  ),
  knowledge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M8 11h6M11 8v6" />
    </svg>
  ),
  diffusion: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
    </svg>
  ),
  prompt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5h16M4 10h16M4 15h10" />
      <path d="M15.5 20.5 21 15l-2-2-5.5 5.5-.5 2.5z" />
    </svg>
  ),
  marketing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10v4a2 2 0 0 0 2 2h3l7 4V4l-7 4H6a2 2 0 0 0-2 2z" />
      <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
    </svg>
  ),
};

/**
 * Deux étages, qui ne se mélangent plus.
 *
 * GLOBAL — toujours là : créer (un bouton, qui ouvre un formulaire), l'accueil,
 * la liste des gents. Rien ici ne dépend du gent ouvert.
 *
 * LE GENT OUVERT — sous son nom, et seulement quand il y en a un : tout ce qui
 * le règle. Le menu « Créer » d'autrefois mêlait les deux : selon l'écran, ses
 * entrées créaient un gent ou changeaient d'onglet, et le créateur qui voulait
 * régler son gent en fabriquait un nouveau une fois sur deux. Depuis la liste,
 * les entrées de configuration ouvraient en plus, sans le dire, le premier
 * gent venu.
 */
const NAV_GLOBAL: NavEntry[] = [
  { id: "accueil", label: "Accueil", icon: ICON.accueil },
  { id: "mesgents", label: "Mes gents", icon: ICON.mesgents, blue: true },
];

function navGent(formats: { miniapp: boolean; visionneuse: boolean; collaboratif: boolean }): NavSection[] {
  return [
    {
      title: "Configurer",
      entries: [
        { id: "prompt", label: "Prompt & Modèle", icon: ICON.prompt },
        // L'ancien « Gent Conversationnel » : des options de conversation
        // (recherche web, routine, fichiers, artefacts), pas un type de gent.
        { id: "conversationnel", label: "Options", icon: ICON.options },
        { id: "knowledge", label: "Connaissances", icon: ICON.knowledge },
        { id: "connectors", label: "Connecteurs", icon: ICON.connectors },
      ],
    },
    {
      // Des FACETTES du gent ouvert, cumulables — jamais des créations.
      title: "Formats",
      entries: [
        { id: "miniapp", label: "Mini App", icon: ICON.miniapp, actif: formats.miniapp },
        { id: "visionneuse", label: "Visionneuse", icon: ICON.visionneuse, actif: formats.visionneuse },
        { id: "collaboratif", label: "Event Manager", icon: ICON.collaboratif, actif: formats.collaboratif },
      ],
    },
    {
      title: "Diffuser et suivre",
      entries: [
        { id: "diffusion", label: "Diffusion", icon: ICON.diffusion },
        { id: "marketing", label: "Marketing", icon: ICON.marketing },
        { id: "audit", label: "Audit", icon: ICON.audit },
      ],
    },
  ];
}

/** Rail studio au niveau liste — sans gent ouvert ni bouton Diffuser. */
function BuilderRailList() {
  const router = useRouter();
  const [railCollapsed, setRailCollapsed] = useState(false);
  const activeTab: BuilderTab = "mesgents";

  function handleNav(tab: BuilderTab) {
    // Au niveau liste, le rail ne porte que la navigation globale : aucune
    // entrée n'y crée ni n'ouvre un gent en douce.
    if (tab === "accueil") {
      // L'accueil du studio est devenu l'accueil de Getgents : même écran,
      // nouvelle adresse.
      router.push("/accueil");
      return;
    }
    router.push("/builder/mesgents");
  }

  return (
    <RailChrome
      railCollapsed={railCollapsed}
      onToggleRail={() => setRailCollapsed((v) => !v)}
      activeTab={activeTab}
      onNav={handleNav}
      showPublish={false}
    />
  );
}

/** Rail dans la vue d'un gent — configuration, diffusion, assistant. */
function BuilderRailGent() {
  const router = useRouter();
  const { currentDraft, activeTab, switchTab, railCollapsed, toggleRail, publishDraft } = useBuilder();
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  function handleNav(tab: BuilderTab) {
    if (tab === "mesgents") {
      router.push("/builder/mesgents");
      return;
    }
    if (tab === "accueil") {
      router.push("/accueil");
      return;
    }
    // Tout le reste règle le gent ouvert : on change d'onglet, on ne crée
    // jamais. La création passe par « Nouveau gent » et son formulaire.
    switchTab(tab);
  }

  const nameOk = hasCustomName(currentDraft);
  const dirty = isDirtySincePublish(currentDraft);
  const live = currentDraft.status === "published";
  const publishDisabled = !nameOk || !currentDraft.systemPrompt.trim();

  let publishLabel = "Diffuser le gent";
  if (live && !dirty) publishLabel = "Rediffuser";
  else if (live && dirty) publishLabel = "Diffuser les modifications";

  let publishHint: string | undefined;
  if (!nameOk) publishHint = "Donnez un nom au gent avant de le diffuser";
  else if (!currentDraft.systemPrompt.trim()) publishHint = "Rédigez des instructions système avant de diffuser";
  else if (live && dirty) publishHint = "Des modifications ne sont pas encore diffusées aux utilisateurs";
  else if (live)
    publishHint =
      "Votre version de travail semble déjà diffusée. En cas de doute (réponses différentes entre Preview et lien), cliquez pour réécrire la version diffusée.";
  else publishHint = "Rend le gent accessible sur les canaux de l'onglet Diffusion";

  async function handlePublish() {
    setPublishError(null);
    setPublishing(true);
    try {
      const res = await publishDraft();
      if (!res.ok) {
        if (res.status === 401 || res.error === "unauthorized" || res.error === "auth_required") {
          setPublishError("Session expirée. Reconnectez-vous, puis cliquez à nouveau sur Diffuser.");
        } else if (res.status === 503 || res.error === "supabase_not_configured") {
          setPublishError("Serveur indisponible pour le moment. Réessayez dans un instant.");
        } else if (res.error === "network") {
          setPublishError("Connexion interrompue. Vérifiez votre réseau et réessayez.");
        } else {
          setPublishError(
            res.error && !/^[a-z0-9_]+$/i.test(res.error)
              ? res.error
              : `La diffusion a échoué${res.status ? ` (${res.status})` : ""}. Réessayez.`
          );
        }
      }
    } finally {
      setPublishing(false);
    }
  }

  return (
    <RailChrome
      railCollapsed={railCollapsed}
      onToggleRail={toggleRail}
      activeTab={activeTab}
      onNav={handleNav}
      gent={{
        nom: nameOk ? currentDraft.name : "Gent sans nom",
        icone: currentDraft.icon,
        sections: navGent({
          miniapp: !!currentDraft.pinnedArtefact?.enabled,
          visionneuse: !!currentDraft.visionneuse?.enabled,
          collaboratif: !!currentDraft.collab?.enabled,
        }),
      }}
      showPublish
      publishLabel={publishing ? "Diffusion…" : publishLabel}
      publishDisabled={publishDisabled || publishing}
      publishHint={publishHint}
      publishLive={live && !dirty}
      onPublish={handlePublish}
      publishBlocked={
        publishError
          ? publishError
          : publishDisabled
            ? !nameOk
              ? "Donnez un nom au gent (bandeau du haut) pour pouvoir le diffuser."
              : "Rédigez les instructions système (Configurer → Prompt & Modèle) pour pouvoir diffuser."
            : undefined
      }
    />
  );
}

function RailChrome({
  railCollapsed,
  onToggleRail,
  activeTab,
  onNav,
  gent,
  showPublish,
  publishLabel,
  publishDisabled,
  publishHint,
  publishLive,
  onPublish,
  publishBlocked,
}: {
  railCollapsed: boolean;
  onToggleRail: () => void;
  activeTab: BuilderTab;
  onNav: (tab: BuilderTab) => void;
  /** Le gent ouvert : son nom coiffe les réglages. Absent au niveau liste. */
  gent?: { nom: string; icone?: string; sections: NavSection[] };
  showPublish: boolean;
  publishLabel?: string;
  publishDisabled?: boolean;
  publishHint?: string;
  publishLive?: boolean;
  onPublish?: () => void | Promise<unknown>;
  publishBlocked?: string;
}) {
  // Le tiroir mobile : sous 860 px la colonne sort de l'écran, et c'est ce
  // drapeau qui la ramène. Elle était simplement masquée jusqu'ici, sans
  // remplacement — le studio n'avait donc aucune navigation sur téléphone.
  const { ouvert } = useNavMobile();
  const [creation, setCreation] = useState(false);

  function entree(entry: NavEntry) {
    const on = activeTab === entry.id;
    return (
      <button
        key={entry.id}
        className={[
          styles.navItem,
          entry.blue ? styles.navItemBlue : "",
          on ? (entry.blue ? styles.navItemOnBlue : styles.navItemOn) : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onNav(entry.id)}
        title={entry.actif ? `${entry.label} — activé sur ce gent` : entry.label}
        aria-current={on ? "page" : undefined}
      >
        <span className={styles.navIcon}>{entry.icon}</span>
        <span className={styles.navLabel}>{entry.label}</span>
        {entry.actif && <span className={styles.actif} aria-label="activé" />}
      </button>
    );
  }

  return (
    <nav
      className={[styles.rail, railCollapsed ? styles.collapsed : "", ouvert ? styles.open : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label="Navigation du studio"
      id="builder-rail"
    >
      <div className={styles.brand}>
        <ProductBrandMenu surface="studio" compact={railCollapsed} />
        <button
          className={styles.railToggle}
          onClick={onToggleRail}
          aria-label={railCollapsed ? "Déployer la colonne" : "Réduire la colonne"}
          title={railCollapsed ? "Déployer" : "Réduire"}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: railCollapsed ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }}
          >
            <path d="M14 6l-6 6 6 6" />
          </svg>
        </button>
      </div>

      <div className={styles.nav}>
        <button type="button" className={styles.nouveau} onClick={() => setCreation(true)} title="Créer un nouveau gent">
          <span className={styles.navIcon}>{ICON.nouveau}</span>
          <span className={styles.navLabel}>Nouveau gent</span>
        </button>

        <div className={styles.section}>{NAV_GLOBAL.map(entree)}</div>

        {gent && (
          <div className={styles.gent}>
            <div className={styles.gentTete} title={gent.nom}>
              <span className={styles.gentIcone} aria-hidden="true">
                {gent.icone || "✦"}
              </span>
              <span className={styles.gentNom}>{gent.nom}</span>
            </div>

            {showPublish && onPublish && (
              <>
                <button
                  type="button"
                  className={[styles.publishBtn, publishLive ? styles.publishBtnLive : ""].filter(Boolean).join(" ")}
                  onClick={onPublish}
                  disabled={publishDisabled}
                  title={publishHint}
                >
                  <svg
                    className={styles.publishIcon}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                  <span className={styles.publishLabel}>{publishLabel}</span>
                </button>
                {publishBlocked && <div className={styles.publishBlocked}>{publishBlocked}</div>}
              </>
            )}

            {gent.sections.map((section) => (
              <div className={styles.section} key={section.title}>
                <div className={styles.sectionTitle}>{section.title}</div>
                {section.entries.map(entree)}
              </div>
            ))}
          </div>
        )}
      </div>

      {creation && <NouveauGentDialog onClose={() => setCreation(false)} />}

      {/* Le studio est la destination par défaut après connexion : sans ce
          bloc, on y arrivait sans savoir sous quel compte, ni comment en
          sortir. */}
      <MenuCompte />
    </nav>
  );
}

export function BuilderRail({ mode = "gent" }: { mode?: "gent" | "list" }) {
  if (mode === "list") return <BuilderRailList />;
  return <BuilderRailGent />;
}
