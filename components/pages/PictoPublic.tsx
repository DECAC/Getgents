import type { Public } from "@/lib/exemplesPages";

/**
 * Pictos des publics de l'accueil (19/11, variante A choisie par l'éditeur) :
 * chaque public est une MINI-PAGE qui fait quelque chose — le produit répété
 * sur chaque carte. Palette des jetons Getgents ; trait encre.
 */
const ENCRE = "#2a1f19";

export function PictoPublic({ public: p, className }: { public: Public; className?: string }) {
  const commun = { className, viewBox: "0 0 64 64", width: 64, height: 64, "aria-hidden": true as const };
  if (p === "clients")
    return (
      <svg {...commun}>
        <rect x="4" y="8" width="44" height="50" rx="12" fill="#ffdee2" transform="rotate(-6 26 33)" />
        <rect x="14" y="6" width="36" height="46" rx="9" fill="#fff" stroke={ENCRE} strokeWidth="2.5" />
        <path d="M21 17h16M21 24h10" stroke={ENCRE} strokeWidth="2.5" strokeLinecap="round" />
        <rect x="21" y="32" width="22" height="9" rx="4.5" fill="#e65d76" />
        <circle cx="50" cy="46" r="11" fill="#dca331" stroke={ENCRE} strokeWidth="2.5" />
        <path d="m45 46 3.5 3.5L55 43" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (p === "equipe")
    return (
      <svg {...commun}>
        <rect x="6" y="14" width="30" height="38" rx="8" fill="#dbe7fb" stroke={ENCRE} strokeWidth="2.5" transform="rotate(-14 21 33)" />
        <rect x="28" y="14" width="30" height="38" rx="8" fill="#d4f1d4" stroke={ENCRE} strokeWidth="2.5" transform="rotate(12 43 33)" />
        <rect x="17" y="10" width="30" height="40" rx="8" fill="#fff" stroke={ENCRE} strokeWidth="2.5" />
        <circle cx="26" cy="22" r="3" fill="#e65d76" />
        <circle cx="32" cy="22" r="3" fill="#dca331" />
        <circle cx="38" cy="22" r="3" fill="#4a7fd6" />
        <path d="M24 32h16M24 39h11" stroke={ENCRE} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  if (p === "proches")
    return (
      <svg {...commun}>
        <circle cx="46" cy="16" r="9" fill="#dca331" />
        <path d="M6 50c6-5 11-5 17 0s11 5 17 0 11-5 18 0" fill="none" stroke="#4a7fd6" strokeWidth="3" strokeLinecap="round" />
        <path d="M9 33 52 20 36 50l-6-11Z" fill="#fff" stroke={ENCRE} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="m30 39 22-19" stroke={ENCRE} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M9 33l21 6" fill="none" stroke={ENCRE} strokeWidth="2.5" />
        <path d="M14 32 30 39l-4 7Z" fill="#ffdee2" />
      </svg>
    );
  return (
    <svg {...commun}>
      <rect x="10" y="8" width="36" height="48" rx="9" fill="#fff" stroke={ENCRE} strokeWidth="2.5" />
      <circle cx="28" cy="22" r="6" fill="#ffdee2" stroke={ENCRE} strokeWidth="2.5" />
      <rect x="18" y="36" width="5" height="10" rx="2" fill="#d4f1d4" stroke={ENCRE} strokeWidth="2" />
      <rect x="26" y="32" width="5" height="14" rx="2" fill="#dbe7fb" stroke={ENCRE} strokeWidth="2" />
      <rect x="34" y="27" width="5" height="19" rx="2" fill="#fde4bb" stroke={ENCRE} strokeWidth="2" />
      <path
        d="m50 6 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z"
        fill="#dca331"
        stroke={ENCRE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
