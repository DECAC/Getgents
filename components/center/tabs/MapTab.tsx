"use client";

import { useEspace } from "@/lib/context/EspaceContext";
import type { EspaceMap } from "@/lib/types";
import styles from "./MapTab.module.css";

export function MapTab({ map }: { map: EspaceMap }) {
  const { selectedDay, selectDay } = useEspace();
  const stops = map.stops;

  const routePath = stops.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");

  return (
    <div className={styles.mapview}>
      <div className={styles.mapcanvas}>
        <svg viewBox="0 0 720 420" role="img" aria-label="Carte schématique du road trip">
          <rect width="720" height="420" fill="#D6E2E2" />
          <g stroke="#C9D5D5" strokeWidth="1" opacity="0.5">
            <line x1="0" y1="105" x2="720" y2="105" />
            <line x1="0" y1="210" x2="720" y2="210" />
            <line x1="0" y1="315" x2="720" y2="315" />
            <line x1="180" y1="0" x2="180" y2="420" />
            <line x1="360" y1="0" x2="360" y2="420" />
            <line x1="540" y1="0" x2="540" y2="420" />
          </g>
          <path
            d="M0,0 H720 V205 C645,250 565,252 475,272 C405,288 365,300 305,318 C225,340 110,352 0,336 Z"
            fill="#E8EBE3"
            stroke="#C4CFC4"
            strokeWidth="1.5"
          />
          <g opacity="0.55" fill="none" stroke="#A9B7A2" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M345,150 l12,-20 12,20 z" />
            <path d="M368,158 l10,-16 10,16 z" />
            <path d="M390,150 l11,-18 11,18 z" />
          </g>
          <text x="350" y="178" fontFamily="Inter" fontSize="11" fill="#8FA088" fontWeight="500">
            Alpes
          </text>
          <text x="585" y="385" fontFamily="Inter" fontSize="12" fill="#7C9696" fontStyle="italic">
            Mer Méditerranée
          </text>
          <path
            d={routePath}
            fill="none"
            stroke="var(--sage)"
            strokeWidth="3"
            strokeDasharray="2 8"
            strokeLinecap="round"
            opacity="0.85"
          />
          {stops.map((stop) => {
            const on = selectedDay === stop.day;
            return (
              <g key={stop.day} className={styles.mapPin} onClick={() => selectDay(stop.day)} role="button" tabIndex={0} aria-label={`Étape ${stop.day} : ${stop.city}`}>
                <circle
                  cx={stop.x}
                  cy={stop.y}
                  r={on ? 17 : 14}
                  fill={on ? "var(--gold)" : "var(--sage)"}
                  stroke="#fff"
                  strokeWidth="2.5"
                />
                <text
                  x={stop.x}
                  y={stop.y + 4}
                  textAnchor="middle"
                  fontFamily="IBM Plex Mono"
                  fontSize="12"
                  fontWeight="600"
                  fill="#fff"
                >
                  {stop.day}
                </text>
                <text
                  x={stop.x}
                  y={stop.y - 22}
                  textAnchor="middle"
                  fontFamily="Inter"
                  fontSize="12"
                  fontWeight="600"
                  fill="var(--ink)"
                >
                  {stop.city}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className={styles.maplist}>
        <h4 className={styles.maplistTitle}>{map.title}</h4>
        <p className={styles.hint}>{map.hint}</p>
        {stops.map((stop) => (
          <button
            key={stop.day}
            className={[styles.stop, selectedDay === stop.day ? styles.stopSel : ""].filter(Boolean).join(" ")}
            onClick={() => selectDay(stop.day)}
            aria-pressed={selectedDay === stop.day}
          >
            <span className={[styles.stopD, selectedDay === stop.day ? styles.stopDSel : ""].filter(Boolean).join(" ")}>
              {stop.day}
            </span>
            <span>
              <span className={styles.stopCity}>{stop.city}</span>
              <span className={styles.stopNight}>{stop.night}</span>
            </span>
          </button>
        ))}
        <div className={styles.mapNote}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flex: "none" }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>
          <span>
            Carte schématique. La carte interactive (lieux réels, zoom) arrive dans une version
            ultérieure.
          </span>
        </div>
      </div>
    </div>
  );
}
