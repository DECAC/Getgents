import { StudioMesGentsShell } from "@/components/builder/StudioMesGentsShell";

export const metadata = { title: "Mes gents · GetStudio" };

/** Liste des gents au niveau studio — hors vue d'un gent particulier. */
export default function StudioMesGentsPage() {
  return <StudioMesGentsShell />;
}
