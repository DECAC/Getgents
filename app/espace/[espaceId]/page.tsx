import { ESPACES } from "@/lib/mock-data/espaces";
import { EspaceShell } from "@/components/shell/EspaceShell";

interface Props {
  params: { espaceId: string };
}

// Un identifiant absent du catalogue statique (ex. un gent tout juste publié
// depuis le builder, stocké côté client dans localStorage) est accepté :
// EspaceProvider l'initialise avec un placeholder puis le complète au montage.
export default function EspacePage({ params }: Props) {
  return <EspaceShell initialId={params.espaceId} />;
}

export function generateStaticParams() {
  return Object.keys(ESPACES).map((id) => ({ espaceId: id }));
}
