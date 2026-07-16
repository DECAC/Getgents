// Connecteur réel IDFM PRIM (transports Île-de-France) — API authentifiée :
// la clé est lue côté serveur (variable d'environnement PRIM_API_KEY, jamais
// exposée au navigateur). Deux capacités via l'API Navitia de PRIM :
// arrêts à proximité d'une position, et prochains passages (temps réel).

const PRIM_BASE = process.env.PRIM_BASE_OVERRIDE ?? "https://prim.iledefrance-mobilites.fr/marketplace";

function headers(): Record<string, string> | null {
  const key = process.env.PRIM_API_KEY;
  if (!key) return null;
  return { apikey: key, Accept: "application/json" };
}

/**
 * La racine Navitia de PRIM est déjà scopée sur l'Île-de-France : le chemin
 * avec /coverage/fr-idf provoque « unknown type: coverage » sur certains
 * endpoints. On essaie les variantes dans l'ordre et on garde la première
 * qui répond 2xx (le détail de la dernière erreur est conservé).
 */
async function fetchNavitia(
  paths: string[],
  h: Record<string, string>
): Promise<{ res: Response | null; lastDetail: string; lastStatus: number }> {
  let lastDetail = "";
  let lastStatus = 0;
  for (const p of paths) {
    const res = await fetch(`${PRIM_BASE}${p}`, { headers: h });
    if (res.ok) return { res, lastDetail, lastStatus };
    lastStatus = res.status;
    lastDetail = (await res.text().catch(() => "")).slice(0, 300);
  }
  return { res: null, lastDetail, lastStatus };
}

const MISSING_KEY_MSG = JSON.stringify({
  error:
    "Clé API PRIM absente côté serveur (variable d'environnement PRIM_API_KEY). Le créateur du gent doit la configurer sur l'hébergement — https://prim.iledefrance-mobilites.fr pour obtenir une clé.",
});

export async function stopsNearby(lat: number, lon: number, radiusM = 500): Promise<string> {
  const h = headers();
  if (!h) return MISSING_KEY_MSG;
  const radius = Math.min(Math.max(Math.round(radiusM), 100), 2000);
  const query = `coord/${lon}%3B${lat}/places_nearby?type%5B%5D=stop_point&distance=${radius}&count=10`;
  const { res, lastDetail, lastStatus } = await fetchNavitia(
    [`/v2/navitia/coverage/fr-idf/${query}`, `/v2/navitia/${query}`],
    h
  );
  if (!res) {
    return JSON.stringify({ error: `PRIM a répondu ${lastStatus} (arrêts à proximité). Détail : ${lastDetail}` });
  }
  const data = (await res.json()) as {
    places_nearby?: { distance?: string; stop_point?: { id?: string; name?: string; lines?: { code?: string; name?: string }[] } }[];
  };
  const stops = (data.places_nearby ?? [])
    .filter((p) => p.stop_point?.id)
    .map((p) => ({
      stop_id: p.stop_point!.id,
      name: p.stop_point!.name,
      distance_m: p.distance ? Number(p.distance) : undefined,
      lines: p.stop_point!.lines?.map((l) => l.code || l.name).filter(Boolean),
    }));
  return JSON.stringify({ stops });
}

/**
 * Repli SIRI Lite : stop-monitoring PRIM avec le MonitoringRef STIF dérivé de
 * l'identifiant Navitia (stop_point:IDFM:463641 → STIF:StopPoint:Q:463641:).
 * Retourne null si indisponible (le message d'erreur Navitia est alors renvoyé).
 */
async function siriStopMonitoring(stopId: string, h: Record<string, string>): Promise<string | null> {
  const num = stopId.match(/^stop_point:IDFM:(\d+)$/)?.[1];
  if (!num) return null;
  const ref = `STIF:StopPoint:Q:${num}:`;
  const res = await fetch(`${PRIM_BASE}/stop-monitoring?MonitoringRef=${encodeURIComponent(ref)}`, { headers: h });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    Siri?: {
      ServiceDelivery?: {
        StopMonitoringDelivery?: {
          MonitoredStopVisit?: {
            MonitoredVehicleJourney?: {
              PublishedLineName?: { value?: string }[];
              DestinationName?: { value?: string }[];
              MonitoredCall?: { ExpectedDepartureTime?: string; AimedDepartureTime?: string };
            };
          }[];
        }[];
      };
    };
  };
  const visits = data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit ?? [];
  if (!visits.length) return null;
  const departures = visits.slice(0, 8).map((v) => {
    const j = v.MonitoredVehicleJourney;
    const expected = j?.MonitoredCall?.ExpectedDepartureTime;
    const iso = expected ?? j?.MonitoredCall?.AimedDepartureTime ?? "";
    const heure = iso
      ? new Date(iso).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
      : "";
    return {
      ligne: j?.PublishedLineName?.[0]?.value,
      direction: j?.DestinationName?.[0]?.value,
      heure,
      temps_reel: !!expected,
    };
  });
  return JSON.stringify({ departures, source: "SIRI stop-monitoring" });
}

export async function nextDepartures(stopId: string): Promise<string> {
  const h = headers();
  if (!h) return MISSING_KEY_MSG;
  // Validation stricte puis identifiant passé BRUT : la passerelle PRIM
  // rejette (400) les deux-points encodés en %3A par encodeURIComponent.
  if (!/^stop_point:[A-Za-z0-9:_.\-]+$/.test(stopId)) {
    return JSON.stringify({ error: "stop_id invalide — utilise un identifiant renvoyé par l'outil d'arrêts à proximité." });
  }
  const query = `stop_points/${stopId}/departures?count=8&data_freshness=realtime`;
  const { res, lastDetail, lastStatus } = await fetchNavitia(
    [`/v2/navitia/${query}`, `/v2/navitia/coverage/fr-idf/${query}`],
    h
  );
  if (!res) {
    // Plan B : SIRI Lite stop-monitoring, l'API temps réel officielle de PRIM.
    const siri = await siriStopMonitoring(stopId, h).catch(() => null);
    if (siri) return siri;
    return JSON.stringify({
      error: `PRIM a répondu ${lastStatus} (prochains passages, arrêt ${stopId}). Détail : ${lastDetail}. Ne réessaie pas en boucle : si l'erreur persiste sur 2 arrêts, informe l'utilisateur et propose une alternative.`,
    });
  }
  const data = (await res.json()) as {
    departures?: {
      display_informations?: { label?: string; direction?: string; commercial_mode?: string };
      stop_date_time?: { departure_date_time?: string; data_freshness?: string };
    }[];
  };
  const departures = (data.departures ?? []).map((d) => {
    // Format Navitia : AAAAMMJJTHHMMSS (heure locale Paris).
    const raw = d.stop_date_time?.departure_date_time ?? "";
    const hhmm = raw.length >= 13 ? `${raw.slice(9, 11)}:${raw.slice(11, 13)}` : raw;
    return {
      ligne: d.display_informations?.label,
      direction: d.display_informations?.direction,
      mode: d.display_informations?.commercial_mode,
      heure: hhmm,
      temps_reel: d.stop_date_time?.data_freshness === "realtime",
    };
  });
  return JSON.stringify({ departures });
}
