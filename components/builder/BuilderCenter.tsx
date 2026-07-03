"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import { BuilderHeader } from "./BuilderHeader";
import { PromptTab } from "./tabs/PromptTab";
import { KnowledgeTab } from "./tabs/KnowledgeTab";
import { ModelsTab } from "./tabs/ModelsTab";
import { ConnectorsTab } from "./tabs/ConnectorsTab";
import { ArtefactsTab } from "./tabs/ArtefactsTab";
import styles from "./BuilderCenter.module.css";

export function BuilderCenter() {
  const { activeTab } = useBuilder();

  function renderContent() {
    if (activeTab === "knowledge") return <KnowledgeTab />;
    if (activeTab === "models") return <ModelsTab />;
    if (activeTab === "connectors") return <ConnectorsTab />;
    if (activeTab === "artefacts") return <ArtefactsTab />;
    return <PromptTab />;
  }

  return (
    <main className={styles.center} id="builder-main">
      <BuilderHeader />
      <div className={styles.content}>{renderContent()}</div>
    </main>
  );
}
