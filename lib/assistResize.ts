function clampWidth(px: number): number {
  const max = Math.round(window.innerWidth * 0.3);
  const min = Math.min(260, max);
  return Math.max(min, Math.min(max, px));
}

export function clampAssistWidth(px: number): number {
  return clampWidth(px);
}

// Espace utilisateur : le panneau assistant est en 2e colonne (juste après le
// rail), sa largeur se mesure depuis la gauche.
export function getAssistWidthFromPointer(clientX: number): number {
  const rail = document.getElementById("rail");
  const railWidth = rail ? rail.getBoundingClientRect().width : 248;
  return clampWidth(clientX - railWidth);
}

export function setAssistWidthFromPointer(clientX: number): void {
  document.documentElement.style.setProperty("--assist", getAssistWidthFromPointer(clientX) + "px");
}

// Builder : le panneau assistant est en dernière colonne, collé au bord
// droit de la fenêtre — sa largeur se mesure depuis la droite.
export function getBuilderAssistWidthFromPointer(clientX: number): number {
  return clampWidth(window.innerWidth - clientX);
}

export function setBuilderAssistWidthFromPointer(clientX: number): void {
  document.documentElement.style.setProperty("--builder-assist", getBuilderAssistWidthFromPointer(clientX) + "px");
}

export function canResizeAssist(): boolean {
  return typeof window !== "undefined" && window.innerWidth > 860;
}
