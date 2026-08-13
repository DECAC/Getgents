"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

const VALID_TABS: BuilderTab[] = [
  "accueil",
  "mesgents",
  "conversationnel",
  "miniapp",
  "visionneuse",
  "apercu",
  "connectors",
  "knowledge",
  "audit",
  "diffusion",
  "marketing",
];

export function BuilderShell({ initialId }: { initialId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLegacyTemplateRoute = initialId === NOUVEAU_GENT_TEMPLATE_ID;

  // Onglet d'atterrissage lu depuis l'URL réelle (?tab=…) : l'accueil du studio
  // y envoie le créateur sur le bon mode de construction, et le retour d'OAuth
  // Gmail sur l'onglet Connecteurs.
  const requested = searchParams.get("tab") as BuilderTab | null;
  const initialTab = requested && VALID_TABS.includes(requested) ? requested : undefined;

  useEffect(() => {
    if (isLegacyTemplateRoute) {
      router.replace(`/builder/${allocateNewDraft()}`);
    }
  }, [isLegacyTemplateRoute, router]);

  // Mes gents vit au niveau studio (/builder/mesgents), pas dans la vue d'un
  // gent avec son bandeau — les anciennes URLs ?tab=mesgents sont redirigées.
  useEffect(() => {
    if (requested === "mesgents") {
      router.replace("/builder/mesgents");
    }
  }, [requested, router]);

  if (isLegacyTemplateRoute) return null;
  if (requested === "mesgents") return null;

  return (
    <BuilderProvider initialId={initialId} initialTab={initialTab}>
      <BuilderShellInner />
    </BuilderProvider>
  );
}
