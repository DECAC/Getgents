import { EspaceShell } from "@/components/shell/EspaceShell";

// Page privée : elle dépend des cookies de session, donc ne peut plus être
// pré-générée. Laisser un generateStaticParams ici servirait la même page à
// tout le monde, ou ferait échouer le build.
export const dynamic = "force-dynamic";

interface Props {
  params: { espaceId: string };
}

// Un identifiant absent du catalogue statique (ex. un gent tout juste publié
// depuis le builder, stocké côté client dans localStorage) est accepté :
// EspaceProvider l'initialise avec un placeholder puis le complète au montage.
export default function EspacePage({ params }: Props) {
  return <EspaceShell initialId={params.espaceId} />;
}

