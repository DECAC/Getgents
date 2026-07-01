import { notFound } from "next/navigation";
import { ESPACES } from "@/lib/mock-data/espaces";
import { EspaceShell } from "@/components/shell/EspaceShell";

interface Props {
  params: { espaceId: string };
}

export default function EspacePage({ params }: Props) {
  if (!ESPACES[params.espaceId]) notFound();
  return <EspaceShell initialId={params.espaceId} />;
}

export function generateStaticParams() {
  return Object.keys(ESPACES).map((id) => ({ espaceId: id }));
}
