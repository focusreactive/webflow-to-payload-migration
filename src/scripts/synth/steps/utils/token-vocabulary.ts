import type { DesignTokensData } from "#tokens/schemas/design-tokens.ts";

export function tokenVocabulary(tokens: DesignTokensData): Record<string, Record<string, string[]>> {
  const names = (group: Record<string, unknown>): string[] => Object.keys(group).sort();
  return {
    primitive: Object.fromEntries(
      Object.entries(tokens.primitive).map(([group, entries]) => [group, names(entries)]),
    ),
    semantic: Object.fromEntries(Object.entries(tokens.semantic).map(([group, entries]) => [group, names(entries)])),
  };
}
