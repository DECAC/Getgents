import type { Espace, ThemeTabProposalAction } from "@/lib/types";

// Format demandé au modèle : terminer sa réponse par un bloc caché
// <!--THEME_TAB: {"action":"create","label":"Titre du thème","moduleIds":["tab-1","artef-123"]}-->
// (ou "action":"rename" avec "tabId"+"label", ou "action":"delete" avec "tabId")
// quand regrouper plusieurs modules sous un onglet thématique apporte une
// vraie valeur de navigation. Jamais appliqué automatiquement — proposé à
// l'utilisateur, qui valide ou ignore (voir confirmThemeProposal côté client).
const THEME_TAB_RE = /<!--THEME_TAB:\s*(\{[\s\S]*?\})\s*-->/;
const TRUNCATED_MARKER_RE = /<!--THEME_TAB:[\s\S]*$/;

/**
 * Décrit les modules actuellement affichés dans le canvas de l'espace (mêmes
 * ids que ModuleCanvas.tsx : `tab-<id>`, `map`, `artef-<id>`) ainsi que les
 * onglets thématiques déjà créés, pour que le modèle puisse référencer des
 * ids valides dans un bloc THEME_TAB — il n'a sinon aucune visibilité sur les
 * ids générés côté client.
 */
export function describeModulesForPrompt(espace: Espace): string {
  const lines: string[] = [];
  espace.tabs.forEach((t) => lines.push(`- tab-${t.id} · ${t.name} · onglet structurel`));
  if (espace.map) lines.push(`- map · ${espace.map.title} · carte`);
  espace.artefacts.forEach((a) => lines.push(`- artef-${a.id} · ${a.title} · ${a.type}`));

  const themeTabs = espace.themeTabs ?? [];
  const themeLines = themeTabs.map(
    (t) => `- ${t.id} · "${t.label}" · regroupe : ${t.moduleIds.join(", ") || "(vide)"}`
  );

  return (
    `Modules actuels de l'espace (id · titre · type) :\n${lines.join("\n") || "(aucun)"}\n\n` +
    `Onglets thématiques déjà créés (id · nom · modules regroupés) :\n${themeLines.join("\n") || "(aucun)"}`
  );
}

export const THEME_TAB_PROMPT_INSTRUCTION =
  "L'espace utilisateur propose aussi une vue par onglets thématiques, en plus de la vue par modules : chaque onglet thématique regroupe plusieurs modules (onglets structurels, carte, artefacts) sous un nom de thème. " +
  "Quand plusieurs modules listés ci-dessus se rattachent à un même thème et que les regrouper aiderait vraiment la navigation (ex. tout ce qui concerne l'hébergement, tout ce qui concerne le budget), termine ta réponse (après le texte visible, sur sa propre ligne, jamais plus d'un bloc par réponse) par : " +
  '<!--THEME_TAB: {"action":"create","label":"Nom du thème","moduleIds":["id1","id2"]}--> ' +
  "en réutilisant exactement les ids listés ci-dessus (jamais un id inventé) ; ou, pour ajuster un onglet thématique existant, " +
  '<!--THEME_TAB: {"action":"rename","tabId":"theme-...","label":"Nouveau nom"}--> ' +
  'ou <!--THEME_TAB: {"action":"delete","tabId":"theme-..."}-->. ' +
  "Ne propose ce bloc que ponctuellement, quand un vrai regroupement thématique émerge de la conversation — jamais à chaque réponse, et jamais en même temps qu'un bloc ARTEFACT. " +
  "L'utilisateur décide toujours d'appliquer ou d'ignorer la proposition — ne dis jamais que l'onglet est déjà créé, renommé ou supprimé.";

export function extractThemeTabSignal(raw: string): { text: string; themeAction: ThemeTabProposalAction | null } {
  const match = raw.match(THEME_TAB_RE);
  if (!match) {
    const truncated = raw.match(TRUNCATED_MARKER_RE);
    if (truncated) return { text: raw.slice(0, truncated.index).trim(), themeAction: null };
    return { text: raw, themeAction: null };
  }

  let themeAction: ThemeTabProposalAction | null = null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && parsed.action === "create" && typeof parsed.label === "string" && Array.isArray(parsed.moduleIds)) {
      const moduleIds = parsed.moduleIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 20);
      if (moduleIds.length > 0) themeAction = { action: "create", label: parsed.label, moduleIds };
    } else if (parsed && parsed.action === "rename" && typeof parsed.tabId === "string" && typeof parsed.label === "string") {
      themeAction = { action: "rename", tabId: parsed.tabId, label: parsed.label };
    } else if (parsed && parsed.action === "delete" && typeof parsed.tabId === "string") {
      themeAction = { action: "delete", tabId: parsed.tabId };
    }
  } catch {
    // ignore malformed block
  }

  const start = match.index ?? 0;
  const text = (raw.slice(0, start) + raw.slice(start + match[0].length)).trim();
  return { text, themeAction };
}
