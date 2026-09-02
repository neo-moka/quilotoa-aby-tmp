import type { McpToolAnnotations, McpToolInfo } from "@/shared/api/tauri";

/**
 * Pure logic for the "View tools" panel: search filtering and the badge row
 * derived from provider annotations. Annotations are hints, not guarantees —
 * the panel forwards them verbatim and never infers safety from absence.
 */

export function filterMcpTools(
  tools: readonly McpToolInfo[],
  query: string,
): McpToolInfo[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [...tools];
  return tools.filter((tool) =>
    [tool.name, tool.title ?? "", tool.description ?? ""].some((field) =>
      field.toLowerCase().includes(needle),
    ),
  );
}

export type McpToolBadge = {
  label: string;
  tone: "info" | "success" | "destructive" | "warning";
};

export function mcpToolBadges(annotations: McpToolAnnotations): McpToolBadge[] {
  const badges: McpToolBadge[] = [];
  if (annotations.readOnlyHint === true) {
    badges.push({ label: "Read-only hint", tone: "info" });
  }
  if (annotations.destructiveHint === true) {
    badges.push({ label: "Destructive hint", tone: "destructive" });
  }
  if (annotations.idempotentHint === true) {
    badges.push({ label: "Idempotent hint", tone: "success" });
  }
  if (annotations.openWorldHint === true) {
    badges.push({ label: "External access hint", tone: "warning" });
  }
  return badges;
}

/** Parse the try-it arguments textarea: empty = {}, else strict JSON object. */
export function parseToolArguments(
  raw: string,
): { args: Record<string, unknown>; error?: undefined } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { args: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { error: "Arguments must be valid JSON." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { error: "Arguments must be a JSON object." };
  }
  return { args: parsed as Record<string, unknown> };
}
