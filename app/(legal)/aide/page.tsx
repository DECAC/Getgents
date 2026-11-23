import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Aide — Getgents Pages",
  description: "Envoyer un artefact Claude ou un canvas par un lien privé, et utiliser le connecteur Getgents pour Claude.",
  alternates: { canonical: "/aide" },
};

export default function AidePage() {
  return (
    <>
      <h1 className={styles.titre}>Aide</h1>
      <ul className={styles.liste}>
        <li>
          <Link href="/aide/partager-un-artefact">Envoyer un artefact Claude à quelqu&apos;un qui n&apos;a pas de compte</Link>
        </li>
        <li>
          <Link href="/aide/connecteur">Le connecteur Getgents Pages pour Claude</Link>
        </li>
        <li>
          <Link href="/cgu">Conditions d&apos;utilisation</Link>
        </li>
      </ul>
    </>
  );
}
