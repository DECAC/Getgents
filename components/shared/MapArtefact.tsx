"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/lib/types";

// Fond de plan officiel Plan IGN v2 servi par la Géoplateforme
// (cartes.gouv.fr / data.geopf.fr) — service ouvert, sans clé API.
const IGN_WMTS =
  "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
  "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM" +
  "&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}";

const IGN_ATTRIBUTION = '&copy; <a href="https://cartes.gouv.fr">IGN — cartes.gouv.fr</a>';

export function MapArtefact({
  points,
  height = 260,
  userPosition,
}: {
  points: MapPoint[];
  height?: number;
  /** Position de l'utilisateur (partagée avec consentement) — marqueur distinct. */
  userPosition?: { lat: number; lon: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !points.length) return;

    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    // Leaflet manipule window/document : import dynamique côté client
    // uniquement (le composant peut être monté pendant l'hydratation SSR).
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer(IGN_WMTS, { attribution: IGN_ATTRIBUTION, maxZoom: 19 }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: '<div style="width:14px;height:14px;border-radius:50%;background:var(--plum,#6d4c7d);border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const latLngs: [number, number][] = [];
      for (const p of points) {
        latLngs.push([p.lat, p.lon]);
        L.marker([p.lat, p.lon], { icon }).addTo(map!).bindPopup(p.label);
      }

      if (userPosition) {
        const userIcon = L.divIcon({
          className: "",
          html: '<div style="width:16px;height:16px;border-radius:50%;background:#2f6fde;border:3px solid #fff;box-shadow:0 0 0 4px rgba(47,111,222,0.25)"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([userPosition.lat, userPosition.lon], { icon: userIcon })
          .addTo(map!)
          .bindPopup("Votre position");
      }

      if (latLngs.length > 1) {
        L.polyline(latLngs, { color: "#6d4c7d", weight: 2.5, opacity: 0.55, dashArray: "6 6" }).addTo(map);
      }

      // Le cadrage inclut la position de l'utilisateur, mais pas le tracé.
      const bounds = userPosition ? [...latLngs, [userPosition.lat, userPosition.lon] as [number, number]] : latLngs;
      if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28] });
      } else {
        map.setView(bounds[0], 12);
      }
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, userPosition]);

  if (!points.length) return null;

  return (
    <div
      ref={containerRef}
      style={{ height, borderRadius: 10, overflow: "hidden", background: "var(--bg)", zIndex: 0 }}
      aria-label="Carte des lieux mentionnés"
    />
  );
}
