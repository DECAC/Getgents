"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BuilderProvider, useBuilder, type BuilderTab } from "@/lib/context/BuilderContext";
import { allocateNewDraft, NOUVEAU_GENT_TEMPLATE_ID } from "@/lib/builderDraftStorage";
import { BuilderRail } from "./BuilderRail";
import { BuilderCenter } from "./BuilderCenter";
import { BuilderAssistantPanel } from "./BuilderAssistantPanel";
import styles from "./BuilderShell.module.css";

function BuilderShellInner() {
  const { railCollapsed, assistantCollapsed } = useBuilder();

  return (
    <div
      className={[
        styles.shell,
        railCollapsed ? styles.collapsed : "",
        assistantCollapsed ? styles.assistantCollapsed : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <BuilderRail />
      <BuilderCenter />
      <BuilderAssistantPanel />
    </div>
  );
}

export function BuilderShell({ initialId, initialTab }: { initialId: string; initialTab?: BuilderTab }) {
  const router = useRouter();
  const isLegacyTemplateRoute = initialId === NOUVEAU_GENT_TEMPLATE_ID;

  useEffect(() => {
    if (isLegacyTemplateRoute) {
      router.replace(`/builder/${allocateNewDraft()}`);
    }
  }, [isLegacyTemplateRoute, router]);

  if (isLegacyTemplateRoute) return null;

  return (
    <BuilderProvider initialId={initialId} initialTab={initialTab}>
      <BuilderShellInner />
    </BuilderProvider>
  );
}
