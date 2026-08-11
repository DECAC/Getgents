import { GENT_DRAFTS } from "@/lib/mock-data/builder";
import { BuilderShell } from "@/components/builder/BuilderShell";
import type { BuilderTab } from "@/lib/context/BuilderContext";

interface Props {
  params: { gentId: string };
  searchParams?: { tab?: string };
}

const VALID_TABS: BuilderTab[] = [
  "accueil",
  "mesgents",
  "conversationnel",
  "miniapp",
  "visionneuse",
  "connectors",
  "knowledge",
  "audit",
  "diffusion",
];

// Un identifiant absent du catalogue (ex. un brouillon tout juste créé) est
// accepté : BuilderProvider l'initialise à partir du gabarit "nouveau-gent".
// ?tab=... permet d'atterrir directement sur un onglet (ex. "Mes gents" au
// clic sur le logo Getgents depuis l'espace utilisateur).
export default function BuilderGentPage({ params, searchParams }: Props) {
  const requestedTab = searchParams?.tab as BuilderTab | undefined;
  const initialTab = requestedTab && VALID_TABS.includes(requestedTab) ? requestedTab : undefined;
  return <BuilderShell initialId={params.gentId} initialTab={initialTab} />;
}

export function generateStaticParams() {
  return Object.keys(GENT_DRAFTS).map((gentId) => ({ gentId }));
}
