import { ESPACES as INITIAL_ESPACES } from "@/lib/mock-data/espaces";
import type { EspacesMap, ReservationItem } from "@/lib/types";

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function isToolConnected(espaces: EspacesMap, espaceId: string, serviceName: string): boolean {
  const tool = espaces[espaceId].tools.find((t) => t.name === serviceName);
  return tool?.connected ?? false;
}

function confirmReservation(espaces: EspacesMap, espaceId: string, itemId: string): EspacesMap {
  const next = deepClone(espaces);
  const espace = next[espaceId];
  for (const tab of espace.tabs) {
    if (tab.kind !== "resv" || !tab.items) continue;
    const item = tab.items.find((x: ReservationItem) => x.id === itemId);
    if (!item) continue;
    if (item.category === "compte_tiers") {
      if (!isToolConnected(next, espaceId, item.service)) return espaces; // invariant: jamais d'envoi sans compte connecté
      item.status = "sent";
    } else {
      item.status = "confirmed";
    }
  }
  return next;
}

function connectTool(espaces: EspacesMap, espaceId: string, toolName: string): EspacesMap {
  const next = deepClone(espaces);
  const tool = next[espaceId].tools.find((t) => t.name === toolName);
  if (tool) tool.connected = true;
  return next;
}

function getResvItem(espaces: EspacesMap, espaceId: string, itemId: string): ReservationItem | undefined {
  const tab = espaces[espaceId].tabs.find((t) => t.kind === "resv");
  return tab?.items?.find((x: ReservationItem) => x.id === itemId);
}

describe("Invariant compte_tiers — aucun envoi sans compte connecté", () => {
  let espaces: EspacesMap;

  beforeEach(() => {
    espaces = deepClone(INITIAL_ESPACES);
  });

  test("appeler confirmReservation sur un item compte_tiers non connecté ne change pas son statut", () => {
    const itemId = "resa-booking";
    const before = getResvItem(espaces, "voyage", itemId);
    expect(before?.status).toBe("pending");
    expect(before?.category).toBe("compte_tiers");
    expect(isToolConnected(espaces, "voyage", "Booking.com")).toBe(false);

    const updated = confirmReservation(espaces, "voyage", itemId);
    const after = getResvItem(updated, "voyage", itemId);

    expect(after?.status).toBe("pending"); // statut inchangé
  });

  test("appeler confirmReservation sur un item compte_tiers connecté le passe à 'sent'", () => {
    const itemId = "resa-booking";
    espaces = connectTool(espaces, "voyage", "Booking.com");
    expect(isToolConnected(espaces, "voyage", "Booking.com")).toBe(true);

    const updated = confirmReservation(espaces, "voyage", itemId);
    const after = getResvItem(updated, "voyage", itemId);

    expect(after?.status).toBe("sent");
  });

  test("appeler confirmReservation sur un item 'ecriture' le passe à 'confirmed' sans vérification de connexion", () => {
    const itemId = "resa-ferry";
    const before = getResvItem(espaces, "voyage", itemId);
    expect(before?.category).toBe("ecriture");

    const updated = confirmReservation(espaces, "voyage", itemId);
    const after = getResvItem(updated, "voyage", itemId);

    expect(after?.status).toBe("confirmed");
  });

  test("confirmer un item compte_tiers connecté ne passe jamais à 'confirmed' — toujours 'sent'", () => {
    const itemId = "resa-booking";
    espaces = connectTool(espaces, "voyage", "Booking.com");

    const updated = confirmReservation(espaces, "voyage", itemId);
    const after = getResvItem(updated, "voyage", itemId);

    expect(after?.status).not.toBe("confirmed");
    expect(after?.status).toBe("sent");
  });
});

describe("Section Fichiers — jamais les artefacts générés", () => {
  test("les fichiers et les artefacts sont des structures distinctes", () => {
    const espace = INITIAL_ESPACES.voyage;
    const fileIds = espace.files.map((f) => f.id);
    const artefactIds = espace.artefacts.map((a) => a.id);
    const overlap = fileIds.filter((id) => artefactIds.includes(id));
    expect(overlap).toHaveLength(0);
  });

  test("l'espace fiscal a des artefacts mais aucun fichier", () => {
    expect(INITIAL_ESPACES.fiscal.files).toHaveLength(0);
    expect(INITIAL_ESPACES.fiscal.artefacts.length).toBeGreaterThan(0);
  });
});
