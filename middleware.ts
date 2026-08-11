import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_ACCESS_COOKIE } from "@/lib/appAccessConstants";

/**
 * Sur les pages créateur (builder, espace), pose un cookie httpOnly contenant
 * APP_ACCESS_SECRET pour que les appels /api/gents* et /api/drafts* passent
 * sans saisie manuelle à chaque déploiement ou nouvel onglet preview.
 * Les liens de partage (/l/*) sont exclus : le destinataire ne reçoit pas la clé.
 */
export function middleware(request: NextRequest) {
  const secret = process.env.APP_ACCESS_SECRET?.trim();
  if (!secret) return NextResponse.next();

  const response = NextResponse.next();
  const existing = request.cookies.get(APP_ACCESS_COOKIE)?.value;
  if (existing !== secret) {
    response.cookies.set(APP_ACCESS_COOKIE, secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: ["/", "/builder/:path*", "/espace/:path*"],
};
