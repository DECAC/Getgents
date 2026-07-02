"use client";

import { BuilderProvider } from "@/lib/context/BuilderContext";
import { BuilderRail } from "./BuilderRail";
import { BuilderCenter } from "./BuilderCenter";
import { BuilderAssistantPanel } from "./BuilderAssistantPanel";
import styles from "./BuilderShell.module.css";

export function BuilderShell({ initialId }: { initialId: string }) {
  return (
    <BuilderProvider initialId={initialId}>
      <div className={styles.shell}>
        <BuilderRail />
        <BuilderCenter />
        <BuilderAssistantPanel />
      </div>
    </BuilderProvider>
  );
}
