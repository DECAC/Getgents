import { GENT_DRAFTS } from "@/lib/mock-data/builder";
import { BuilderShell } from "@/components/builder/BuilderShell";

interface Props {
  params: { gentId: string };
}

// Un identifiant absent du catalogue (ex. un brouillon tout juste créé) est
// accepté : BuilderProvider l'initialise à partir du gabarit "nouveau-gent".
export default function BuilderGentPage({ params }: Props) {
  return <BuilderShell initialId={params.gentId} />;
}

export function generateStaticParams() {
  return Object.keys(GENT_DRAFTS).map((gentId) => ({ gentId }));
}
