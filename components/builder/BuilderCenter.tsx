"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import { BuilderHeader } from "./BuilderHeader";
import { PromptTab } from "./tabs/PromptTab";
import { ConnectorsTab } from "./tabs/ConnectorsTab";
import { ArtefactsTab } from "./tabs/ArtefactsTab";
import { DiffusionTab } from "./tabs/DiffusionTab";
import { AuditTab } from "./tabs/AuditTab";
import styles from "./BuilderCenter.module.css";

export function BuilderCenter() {
  const { activeTab } = useBuilder();

  function renderContent() {
    if (activeTab === "connectors") return <ConnectorsTab />;
    if (activeTab === "artefacts") return <ArtefactsTab />;
    if (activeTab === "diffusion") return <DiffusionTab />;
    if (activeTab === "audit") return <AuditTab />;
    return <PromptTab />;
  }

  return (
    <main className={styles.center} id="builder-main">
      <BuilderHeader />
      <div className={styles.content}>{renderContent()}</div>
    </main>
  );
}
