import { emitThemeCss } from "#tokens/steps/theme/services/emit-theme.ts";
import { type DesignTokensData } from "#tokens/schemas/design-tokens.ts";

function emitPageGround(tokens: DesignTokensData): string | undefined {
  const declarations: string[] = [];
  if (tokens.semantic.color["surface"] !== undefined) {
    declarations.push("  background-color: var(--color-surface);");
  }
  if (tokens.semantic.color["text"] !== undefined) {
    declarations.push("  color: var(--color-text);");
  }
  if (declarations.length === 0) return undefined;
  return `@layer base {\n  body {\n${declarations.map((line) => `  ${line}`).join("\n")}\n  }\n}\n`;
}

export function emitGlobalsCssFile(tokens: DesignTokensData): string {
  const parts = ['@import "tailwindcss";', '@import "./fonts.css";', emitThemeCss(tokens)];
  const ground = emitPageGround(tokens);
  if (ground !== undefined) parts.push(ground);
  return parts.join("\n\n");
}
