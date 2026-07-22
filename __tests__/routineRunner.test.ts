import { isRoutineDue } from "@/lib/routineSchedule";
import type { Routine } from "@/lib/types";

// 10h00 heure de Paris un mardi (été → UTC+2).
const TUE_10H_PARIS = new Date("2026-07-21T08:00:00Z");

function routine(patch: Partial<Routine> = {}): Routine {
  return { enabled: true, frequency: "daily", hour: 8, mission: "Veille du jour", ...patch };
}

describe("isRoutineDue", () => {
  it("due quand l'heure est passée et jamais exécutée", () => {
    expect(isRoutineDue(routine(), TUE_10H_PARIS)).toBe(true);
  });

  it("pas due avant l'heure configurée", () => {
    expect(isRoutineDue(routine({ hour: 14 }), TUE_10H_PARIS)).toBe(false);
  });

  it("pas due si désactivée ou mission vide", () => {
    expect(isRoutineDue(routine({ enabled: false }), TUE_10H_PARIS)).toBe(false);
    expect(isRoutineDue(routine({ mission: "  " }), TUE_10H_PARIS)).toBe(false);
  });

  it("daily : pas de double exécution le même jour, due le lendemain", () => {
    const ranToday = routine({ lastRunAt: "2026-07-21T06:05:00Z" });
    expect(isRoutineDue(ranToday, TUE_10H_PARIS)).toBe(false);
    const ranYesterday = routine({ lastRunAt: "2026-07-20T06:05:00Z" });
    expect(isRoutineDue(ranYesterday, TUE_10H_PARIS)).toBe(true);
  });

  it("weekly : due seulement après ~une semaine", () => {
    const ranThreeDaysAgo = routine({ frequency: "weekly", lastRunAt: "2026-07-18T08:00:00Z" });
    expect(isRoutineDue(ranThreeDaysAgo, TUE_10H_PARIS)).toBe(false);
    const ranLastWeek = routine({ frequency: "weekly", lastRunAt: "2026-07-14T08:00:00Z" });
    expect(isRoutineDue(ranLastWeek, TUE_10H_PARIS)).toBe(true);
  });

  it("gère la bascule de jour Paris vs UTC (23h Paris = 21h UTC)", () => {
    // Run hier 23h50 Paris ; il est aujourd'hui 8h Paris → dû.
    const lateYesterday = routine({ lastRunAt: "2026-07-20T21:50:00Z" });
    const today8hParis = new Date("2026-07-21T06:00:00Z");
    expect(isRoutineDue(lateYesterday, today8hParis)).toBe(true);
  });
});
