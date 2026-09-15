import { securityTxt } from "@/lib/legal";

export const dynamic = "force-dynamic";

/**
 * `/.well-known/security.txt` (RFC 9116).
 *
 * Servi par une route plutôt que par un fichier statique pour une raison
 * précise : le champ `Expires` est obligatoire, et un fichier figé finit
 * toujours par annoncer une date passée — ce qui rend le document invalide
 * et donne l'impression d'un service à l'abandon. Ici, l'échéance est
 * recalculée à un an glissant.
 */
function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://getgents.ai").replace(/\/+$/, "");
}

export async function GET() {
  const dans1An = new Date();
  dans1An.setUTCFullYear(dans1An.getUTCFullYear() + 1);

  return new Response(securityTxt(baseUrl(), dans1An.toISOString()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
