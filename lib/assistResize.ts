export function clampAssistWidth(px: number): number {
  const max = Math.round(window.innerWidth * 0.3);
  const min = Math.min(260, max);
  return Math.max(min, Math.min(max, px));
}

export function getAssistWidthFromPointer(clientX: number): number {
  const rail = document.getElementById("rail");
  const railWidth = rail ? rail.getBoundingClientRect().width : 248;
  return clampAssistWidth(clientX - railWidth);
}

export function setAssistWidthFromPointer(clientX: number): void {
  document.documentElement.style.setProperty("--assist", getAssistWidthFromPointer(clientX) + "px");
}

export function canResizeAssist(): boolean {
  return typeof window !== "undefined" && window.innerWidth > 860;
}
