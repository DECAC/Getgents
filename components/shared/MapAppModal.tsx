"use client";

import { useEffect } from "react";
import styles from "./MapAppModal.module.css";

export interface MapDestination {
  lat: number;
  lon: number;
  address?: string;
}

// Le web ne peut pas savoir quelles applications sont installées sur le
// téléphone : on propose donc les liens universels des principales apps de
// cartographie + l'application par défaut du système (URI geo:, mobile).
function appLinks({ lat, lon, address }: MapDestination) {
  const q = address ? encodeURIComponent(address) : `${lat},${lon}`;
  return [
    {
      icon: "🗺️",
      name: "Google Maps",
      url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    },
    {
      icon: "🧭",
      name: "Apple Plans",
      url: `https://maps.apple.com/?daddr=${lat},${lon}&q=${q}`,
    },
    {
      icon: "🚗",
      name: "Waze",
      url: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`,
    },
    {
      icon: "📱",
      name: "Application par défaut",
      url: `geo:${lat},${lon}?q=${q}`,
    },
  ];
}

interface Props {
  destination: MapDestination;
  onClose: () => void;
}

export function MapAppModal({ destination, onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mapapp-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <h3 className={styles.title} id="mapapp-title">
          Ouvrir l&apos;itinéraire
        </h3>
        {destination.address && <div className={styles.address}>📍 {destination.address}</div>}
        <div className={styles.list}>
          {appLinks(destination).map((app) => (
            <a
              key={app.name}
              className={styles.appBtn}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
            >
              <span className={styles.appIc}>{app.icon}</span>
              <span className={styles.appName}>{app.name}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </a>
          ))}
        </div>
        <button className={styles.cancelBtn} onClick={onClose}>
          Annuler
        </button>
      </div>
    </div>
  );
}
