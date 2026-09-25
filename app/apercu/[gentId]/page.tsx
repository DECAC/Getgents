import type { Metadata } from "next";
import { ApercuPage } from "@/components/shared-link/ApercuPage";

// Page privée (voir middleware) : l'aperçu d'une version de travail ne
// regarde que son créateur, et ne doit jamais être indexé.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aperçu · Getgents",
  robots: { index: false, follow: false },
};

export default function ApercuGentPage({ params }: { params: { gentId: string } }) {
  return <ApercuPage gentId={params.gentId} />;
}
