import { colorsClose, mixOklab, parseColor, type Rgba } from "#lib/color.ts";
import { parseSemanticColorValue } from "#lib/semantic-color.ts";
import type { DesignTokensData } from "#tokens/schemas/design-tokens.ts";

export interface ColorCandidate {
  varName: string;
  rgba: Rgba;
}

const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 };

interface RoleContext {
  primitives: Map<string, Rgba>;
  roles: DesignTokensData["semantic"]["color"];
}

function resolveRole(value: string, ctx: RoleContext, seen: Set<string>): Rgba | undefined {
  const parsed = parseSemanticColorValue(value);
  if (parsed === undefined) return undefined;

  const resolveRef = (ref: { tier: "primitive" | "semantic"; name: string }): Rgba | undefined => {
    if (ref.tier === "primitive") return ctx.primitives.get(ref.name);
    if (seen.has(ref.name)) return undefined;
    const role = ctx.roles[ref.name];
    return role === undefined ? undefined : resolveRole(role.$value, ctx, new Set([...seen, ref.name]));
  };

  if (parsed.kind === "alias") return resolveRef(parsed.ref);

  const from = resolveRef(parsed.from);
  const to = parsed.to === "transparent" ? TRANSPARENT : resolveRef(parsed.to);
  if (from === undefined || to === undefined) return undefined;
  return mixOklab(from, to, parsed.weightPercent / 100);
}

export function buildColorCandidates(tokens: DesignTokensData): ColorCandidate[] {
  const primitives = new Map<string, Rgba>();
  for (const [name, token] of Object.entries(tokens.primitive.color)) {
    const rgba = parseColor(token.$value.hex);
    if (rgba !== null) primitives.set(name, { ...rgba, a: token.$value.alpha });
  }

  const out: ColorCandidate[] = [...primitives].map(([name, rgba]) => ({ varName: `--color-${name}`, rgba }));

  const ctx: RoleContext = { primitives, roles: tokens.semantic.color };
  for (const [name, token] of Object.entries(tokens.semantic.color)) {
    const rgba = resolveRole(token.$value, ctx, new Set([name]));
    if (rgba !== undefined) out.push({ varName: `--color-${name}`, rgba });
  }

  return out.sort((a, b) => a.varName.localeCompare(b.varName));
}

function channelDistance(a: Rgba, b: Rgba): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

export function resolveColor(measured: string, candidates: ColorCandidate[]): string {
  const m = parseColor(measured);
  if (m === null) return measured;
  let best: { varName: string; dist: number } | undefined;
  for (const candidate of candidates) {
    if (!colorsClose(m, candidate.rgba)) continue;
    const dist = channelDistance(m, candidate.rgba);
    if (best === undefined || dist < best.dist) best = { varName: candidate.varName, dist };
  }
  return best === undefined ? measured : `var(${best.varName})`;
}
