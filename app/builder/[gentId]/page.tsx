import { Suspense } from "react";
import { BuilderShell } from "@/components/builder/BuilderShell";

// Page privée : elle dépend des cookies de session, donc ne peut plus être
// pré-générée. Laisser un generateStaticParams ici servirait la même page à
// tout le monde, ou ferait échouer le build.
export const dynamic = "force-dynamic";

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

