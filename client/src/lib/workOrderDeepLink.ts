export type WorkOrderDeepLinkCandidate = {
  kind: "button" | "row";
  text: string;
  element: HTMLElement;
};

export function selectWorkOrderDeepLinkTarget(candidates: WorkOrderDeepLinkCandidate[], woId: string) {
  const normalizedId = woId.trim();
  if (!normalizedId) return null;
  return candidates.find(candidate => candidate.kind === "button" && candidate.text.includes(normalizedId)) ?? null;
}
