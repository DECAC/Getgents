"use client";

import { BuilderProvider, useBuilder } from "@/lib/context/BuilderContext";
import { BuilderRail } from "./BuilderRail";
import { BuilderCenter } from "./BuilderCenter";
import { BuilderAssistantPanel } from "./BuilderAssistantPanel";
import styles from "./BuilderShell.module.css";

function BuilderShellInner() {
  const { railCollapsed } = useBuilder();

  return (
    <div className={[styles.shell, railCollapsed ? styles.collapsed : ""].filter(Boolean).join(" ")}>
      <BuilderRail />
      <BuilderCenter />
      <BuilderAssistantPanel />
    </div>
  );
}

export function BuilderShell({ initialId }: { initialId: string }) {
  return (
    <BuilderProvider initialId={initialId}>
      <BuilderShellInner />
    </BuilderProvider>
  );
}
