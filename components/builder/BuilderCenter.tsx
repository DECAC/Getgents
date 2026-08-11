"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import { BuilderHeader } from "./BuilderHeader";
import { AccueilTab } from "./tabs/AccueilTab";
import { MesGentsTab } from "./tabs/MesGentsTab";
import { ConversationnelTab } from "./tabs/ConversationnelTab";
import { MiniAppTab } from "./tabs/MiniAppTab";
import { VisionneuseTab } from "./tabs/VisionneuseTab";
import { ConnectorsTab } from "./tabs/ConnectorsTab";
import { KnowledgeTab } from "./tabs/KnowledgeTab";
import { DiffusionTab } from "./tabs/DiffusionTab";
import { AuditTab } from "./tabs/AuditTab";
import styles from "./BuilderCenter.module.css";

export function BuilderCenter() {
  const { activeTab, currentId } = useBuilder();

  function renderContent() {
    if (activeTab === "mesgents") return <MesGentsTab />;
    if (activeTab === "conversationnel") return <ConversationnelTab />;
    if (activeTab === "miniapp") return <MiniAppTab />;
    if (activeTab === "visionneuse") return <VisionneuseTab />;
    if (activeTab === "connectors") return <ConnectorsTab />;
    if (activeTab === "knowledge") return <KnowledgeTab />;
    if (activeTab === "diffusion") return <DiffusionTab />;
    if (activeTab === "audit") return <AuditTab />;
    return <AccueilTab />;
  }

  return (
    <main className={styles.center} id="builder-main">
      <BuilderHeader />
      <div className={styles.content} key={currentId}>
        {renderContent()}
      </div>
    </main>
  );
}
