export interface ColorRef {
  tier: "primitive" | "semantic";
  name: string;
}

export type SemanticColorValue =
  | { kind: "alias"; ref: ColorRef }
  | { kind: "mix"; from: ColorRef; weightPercent: number; to: ColorRef | "transparent" };

const REF_BODY = String.raw`\{(primitive|semantic)\.color\.([a-z0-9]+(?:-[a-z0-9]+)*)\}`;
const PERCENT_BODY = String.raw`(100|\d{1,2})`;
const MIX_BODY = String.raw`color-mix\(in oklab, ${REF_BODY} ${PERCENT_BODY}%, (?:${REF_BODY}|(transparent))\)`;

export const SEMANTIC_COLOR_VALUE_PATTERN = new RegExp(`^(?:${REF_BODY}|${MIX_BODY})$`);

const ALIAS_PATTERN = new RegExp(`^${REF_BODY}$`);
const MIX_PATTERN = new RegExp(`^${MIX_BODY}$`);
const REF_NAME_PATTERN = /\{(?:primitive|semantic)\.color\.([a-z0-9]+(?:-[a-z0-9]+)*)\}/g;

function refFrom(tier: string | undefined, name: string | undefined): ColorRef | undefined {
  if (name === undefined) return undefined;
  if (tier !== "primitive" && tier !== "semantic") return undefined;
  return { tier, name };
}

export function parseSemanticColorValue(value: string): SemanticColorValue | undefined {
  const alias = ALIAS_PATTERN.exec(value);
  if (alias !== null) {
    const ref = refFrom(alias[1], alias[2]);
    return ref === undefined ? undefined : { kind: "alias", ref };
  }

  const mix = MIX_PATTERN.exec(value);
  if (mix === null) return undefined;

  const from = refFrom(mix[1], mix[2]);
  const to = mix[6] === "transparent" ? "transparent" : refFrom(mix[4], mix[5]);
  if (from === undefined || to === undefined) return undefined;
  return { kind: "mix", from, weightPercent: Number(mix[3]), to };
}

export function isSemanticColorValue(value: string): boolean {
  return SEMANTIC_COLOR_VALUE_PATTERN.test(value);
}

export function colorRefs(value: SemanticColorValue): ColorRef[] {
  if (value.kind === "alias") return [value.ref];
  return value.to === "transparent" ? [value.from] : [value.from, value.to];
}

export function semanticColorToCss(value: string): string {
  return value.replace(REF_NAME_PATTERN, (_match, name: string) => `var(--color-${name})`);
}
