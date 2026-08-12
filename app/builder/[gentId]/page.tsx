import { Suspense } from "react";
import { GENT_DRAFTS } from "@/lib/mock-data/builder";
import { BuilderShell } from "@/components/builder/BuilderShell";

interface Props {
  params: { gentId: string };
}

// Un identifiant absent du catalogue (ex. un brouillon tout juste créé) est
// accepté : BuilderProvider l'initialise à partir du gabarit "nouveau-gent".
// L'onglet d'atterrissage (?tab=…) est lu côté navigateur par BuilderShell :
// cette route étant prégénérée, `searchParams` arrive vide sur les pages
// statiques et lors des navigations côté client — le paramètre était alors
// silencieusement ignoré.
export default function BuilderGentPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <BuilderShell initialId={params.gentId} />
    </Suspense>
  );
}

export function generateStaticParams() {
  return Object.keys(GENT_DRAFTS).map((gentId) => ({ gentId }));
}
