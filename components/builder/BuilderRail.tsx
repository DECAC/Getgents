"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBuilder, type BuilderTab } from "@/lib/context/BuilderContext";
import { listVisibleDrafts } from "@/lib/builderDraftStorage";
import { hasCustomName, isDirtySincePublish } from "@/lib/builderSnapshot";
import { ProductBrandMenu } from "@/components/shared/ProductBrandMenu";
import styles from "./BuilderRail.module.css";

interface NavEntry {
  id: BuilderTab;
  label: string;
  icon: JSX.Element;
  blue?: boolean;
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
  conversationnel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-4.6A8.4 8.4 0 1 1 21 11.5z" />
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
  apercu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 4v5" />
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
};

const NAV: NavSection[] = [
  { entries: [{ id: "accueil", label: "Accueil", icon: ICON.accueil }] },
  { entries: [{ id: "mesgents", label: "Mes gents", icon: ICON.mesgents, blue: true }] },
  {
    title: "Créer",
    entries: [
      { id: "conversationnel", label: "Gent Conversationnel", icon: ICON.conversationnel },
      { id: "miniapp", label: "Mini App", icon: ICON.miniapp },
      { id: "visionneuse", label: "Visionneuse", icon: ICON.visionneuse },
      { id: "apercu", label: "Aperçu", icon: ICON.apercu },
    ],
  },
  {
    title: "Contexte",
    entries: [
      { id: "connectors", label: "Connecteurs", icon: ICON.connectors },
      { id: "knowledge", label: "Connaissances", icon: ICON.knowledge },
    ],
  },
  { title: "Monitor", entries: [{ id: "audit", label: "Audit", icon: ICON.audit }] },
  { entries: [{ id: "diffusion", label: "Diffusion", icon: ICON.diffusion }] },
];

function firstDraftId(): string | null {
  return listVisibleDrafts()[0]?.id ?? null;
}

/** Rail studio au niveau liste — sans gent ouvert ni bouton Diffuser. */
function BuilderRailList() {
  const router = useRouter();
  const [railCollapsed, setRailCollapsed] = useState(false);
  const activeTab: BuilderTab = "mesgents";

  function handleNav(tab: BuilderTab) {
    if (tab === "mesgents") {
      router.push("/builder/mesgents");
      return;
    }
    if (tab === "accueil") {
      router.push("/builder");
      return;
    }
    const id = firstDraftId();
    if (!id) {
      router.push("/builder");
      return;
    }
    router.push(`/builder/${id}?tab=${tab}`);
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

  function handleNav(tab: BuilderTab) {
    if (tab === "mesgents") {
      router.push("/builder/mesgents");
      return;
    }
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

  return (
    <RailChrome
      railCollapsed={railCollapsed}
      onToggleRail={toggleRail}
      activeTab={activeTab}
      onNav={handleNav}
      showPublish
      publishLabel={publishLabel}
      publishDisabled={publishDisabled}
      publishHint={publishHint}
      publishLive={live && !dirty}
      onPublish={publishDraft}
      publishBlocked={
        publishDisabled
          ? !nameOk
            ? "Donnez un nom au gent (bandeau du haut) pour pouvoir le diffuser."
            : "Rédigez les instructions système (onglet Gent Conversationnel) pour pouvoir diffuser."
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
  showPublish: boolean;
  publishLabel?: string;
  publishDisabled?: boolean;
  publishHint?: string;
  publishLive?: boolean;
  onPublish?: () => void;
  publishBlocked?: string;
}) {
  return (
    <nav
      className={[styles.rail, railCollapsed ? styles.collapsed : ""].filter(Boolean).join(" ")}
      aria-label="Configuration du gent"
      id="builder-rail"
    >
      <div className={styles.brand}>
        <ProductBrandMenu surface="studio" />
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

      <div className={styles.nav}>
        {NAV.map((section, si) => (
          <div className={styles.section} key={section.title ?? `top-${si}`}>
            {section.title && <div className={styles.sectionTitle}>{section.title}</div>}
            {section.entries.map((entry) => (
              <button
                key={entry.id}
                className={[
                  styles.navItem,
                  entry.blue ? styles.navItemBlue : "",
                  activeTab === entry.id ? (entry.blue ? styles.navItemOnBlue : styles.navItemOn) : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onNav(entry.id)}
                title={entry.label}
                aria-current={activeTab === entry.id ? "page" : undefined}
              >
                <span className={styles.navIcon}>{entry.icon}</span>
                <span className={styles.navLabel}>{entry.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

export function BuilderRail({ mode = "gent" }: { mode?: "gent" | "list" }) {
  if (mode === "list") return <BuilderRailList />;
  return <BuilderRailGent />;
}
