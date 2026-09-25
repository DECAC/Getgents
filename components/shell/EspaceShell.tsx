"use client";

import { EspaceProvider, useEspace } from "@/lib/context/EspaceContext";
import { CollabPreviewShell } from "@/components/collab/CollabPreviewShell";
import { SharedGentBody } from "@/components/shared-link/SharedGentShell";

function ShellInner() {
  const { currentEspace, storageReady, currentId } = useEspace();

  // Attendre l'hydratation (localStorage / serveur) : sinon on affiche un
  // instant le shell classique sur le FALLBACK, et Preview Event Manager
  // paraît « cassé » (chat vide au lieu du gabarit salon).
  if (!storageReady || !currentEspace) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          color: "var(--muted, #667)",
          fontSize: 14,
        }}
      >
        Ouverture de votre gent…
      </div>
    );
  }

  // Event Manager / collaboratif : Preview doit montrer le gabarit du salon,
  // pas l'espace conversationnel classique (sinon le créateur ne voit rien
  // de ce que les participants verront via le lien).
  if (currentEspace.collab?.enabled) {
    return <CollabPreviewShell espace={currentEspace} />;
  }
  // La même page que les visiteurs du gent (conversation, volet de ce que le
  // gent a produit), avec les données et les raccourcis du créateur.
  // L'ancienne coquille (colonne des gents, colonne de droite) n'est plus
  // servie ici.
  return <SharedGentBody personnelDe={currentId} />;
}

export function EspaceShell({ initialId }: { initialId: string }) {
  return (
    <EspaceProvider initialId={initialId} assistantOuvertAuDepart>
      <ShellInner />
    </EspaceProvider>
  );
}
