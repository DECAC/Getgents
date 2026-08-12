import { NextRequest, NextResponse } from "next/server";
import { consentUrl, isGmailConfigured, redirectUri } from "@/lib/server/gmail";
import { isPersistableDraftId } from "@/lib/builderDraftStorage";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const callback = redirectUri(origin);

  if (req.nextUrl.searchParams.get("debug") === "1") {
    return NextResponse.json({
      redirect_uri: callback,
      next_public_app_url: process.env.NEXT_PUBLIC_APP_URL ?? null,
      hint:
        "Dans Google Cloud Console → Identifiants → client OAuth « Application Web » → « URI de redirection autorisés », ajoutez EXACTEMENT redirect_uri ci-dessus.",
    });
  }

  const gentId = req.nextUrl.searchParams.get("gentId")?.trim();
  if (!gentId) {
    return NextResponse.json({ error: "Paramètre gentId requis." }, { status: 400 });
  }
  if (!isPersistableDraftId(gentId)) {
    return NextResponse.json(
      {
        error: `Identifiant de gent invalide (« ${gentId} »). Ouvrez un vrai gent dans le studio (/builder/votre-gent) puis reconnectez Gmail depuis l'onglet Connecteurs.`,
      },
      { status: 400 }
    );
  }
  if (!isGmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "Connecteur Gmail non configuré : définissez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sur Vercel.",
        redirect_uri: callback,
      },
      { status: 500 }
    );
  }

  const result = consentUrl(gentId, origin);
  if ("error" in result) {
    return NextResponse.json(JSON.parse(result.error), { status: 500 });
  }
  return NextResponse.redirect(result.url);
}
