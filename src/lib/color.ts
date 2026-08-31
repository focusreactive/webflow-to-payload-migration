export const COLOR_CHANNEL_TOLERANCE = 3;
export const COLOR_ALPHA_TOLERANCE = 0.02;

export function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseNumber(token: string): number | null {
  const t = token.trim();
  if (t === "" || t === "none") return 0;
  const match = /^(-?\d*\.?\d+)(%)?$/.exec(t);
  if (match === null) return null;
  const value = Number(match[1]);
  return match[2] === "%" ? value / 100 : value;
}

function parseChannel(token: string): number | null {
  const t = token.trim();
  const match = /^(-?\d*\.?\d+)(%)?$/.exec(t);
  if (match === null) return null;
  const value = Number(match[1]);
  return Math.round(clamp(match[2] === "%" ? (value / 100) * 255 : value, 0, 255));
}

function parseHex(hex: string): Rgba | null {
  const expand = (h: string): string =>
    h.length === 3 || h.length === 4 ?
      h
        .split("")
        .map((ch) => ch + ch)
        .join("")
    : h;
  const full = expand(hex);
  if (full.length !== 6 && full.length !== 8) return null;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  const a = full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1;
  if ([r, g, b].some((c) => Number.isNaN(c))) return null;
  return { r, g, b, a };
}

function srgbGamma(linear: number): number {
  const x = clamp(linear, 0, 1);
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

function oklchToRgba(l: number, c: number, hueDeg: number, alpha: number): Rgba {
  const h = (hueDeg * Math.PI) / 180;
  return oklabToRgba(l, c * Math.cos(h), c * Math.sin(h), alpha);
}

function oklabToRgba(l: number, a: number, b: number, alpha: number): Rgba {
  const lRoot = l + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = l - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = l - 0.0894841775 * a - 1.291485548 * b;
  const lLin = lRoot ** 3;
  const mLin = mRoot ** 3;
  const sLin = sRoot ** 3;
  const rLin = 4.0767416621 * lLin - 3.3077115913 * mLin + 0.2309699292 * sLin;
  const gLin = -1.2684380046 * lLin + 2.6097574011 * mLin - 0.3413193965 * sLin;
  const bLin = -0.0041960863 * lLin - 0.7034186147 * mLin + 1.707614701 * sLin;
  return {
    r: Math.round(srgbGamma(rLin) * 255),
    g: Math.round(srgbGamma(gLin) * 255),
    b: Math.round(srgbGamma(bLin) * 255),
    a: clamp(alpha, 0, 1),
  };
}

interface OklabColor {
  l: number;
  a: number;
  b: number;
  alpha: number;
}

function srgbInverseGamma(channel: number): number {
  const x = clamp(channel, 0, 1);
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function toOklab(color: Rgba): OklabColor {
  const r = srgbInverseGamma(color.r / 255);
  const g = srgbInverseGamma(color.g / 255);
  const b = srgbInverseGamma(color.b / 255);
  const lRoot = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mRoot = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const sRoot = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
    alpha: color.a,
  };
}

function splitColorArgs(inner: string): { coords: string[]; alpha: string | null } {
  const [main = "", alpha = null] = inner.split("/");
  const coords = main.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
  return { coords, alpha: alpha === null ? null : alpha.trim() };
}

export function parseColor(value: string): Rgba | null {
  const v = collapse(value).toLowerCase();
  if (v === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex !== null) return parseHex(hex[1] ?? "");

  const rgb = /^rgba?\(([^)]+)\)$/.exec(v);
  if (rgb !== null) {
    const { coords, alpha } = splitColorArgs(rgb[1] ?? "");
    if (coords.length < 3) return null;
    const r = parseChannel(coords[0] ?? "");
    const g = parseChannel(coords[1] ?? "");
    const b = parseChannel(coords[2] ?? "");
    const alphaToken = alpha ?? coords[3] ?? null;
    const a = alphaToken === null ? 1 : parseNumber(alphaToken);
    if (r === null || g === null || b === null || a === null) return null;
    return { r, g, b, a: clamp(a, 0, 1) };
  }

  const oklch = /^oklch\(([^)]+)\)$/.exec(v);
  if (oklch !== null) {
    const { coords, alpha } = splitColorArgs(oklch[1] ?? "");
    if (coords.length < 3) return null;
    const l = parseNumber(coords[0] ?? "");
    const chromaToken = (coords[1] ?? "").trim();
    const c = chromaToken.endsWith("%") ? (parseNumber(chromaToken) ?? 0) * 0.4 : parseNumber(chromaToken);
    const hue = parseNumber((coords[2] ?? "").replace(/deg$/, ""));
    const a = alpha === null ? 1 : parseNumber(alpha);
    if (l === null || c === null || hue === null || a === null) return null;
    return oklchToRgba(l, c, hue, clamp(a, 0, 1));
  }

  return null;
}

export function colorsClose(a: Rgba, b: Rgba): boolean {
  if (Math.abs(a.a - b.a) > COLOR_ALPHA_TOLERANCE) return false;
  // Fully transparent on both sides — the rgb channels never render.
  if (a.a === 0 && b.a === 0) return true;
  return (
    Math.abs(a.r - b.r) <= COLOR_CHANNEL_TOLERANCE
    && Math.abs(a.g - b.g) <= COLOR_CHANNEL_TOLERANCE
    && Math.abs(a.b - b.b) <= COLOR_CHANNEL_TOLERANCE
  );
}

// CSS color-mix() mixes premultiplied by alpha (CSS Color 5 §3.4), which is what
// makes `color-mix(in oklab, X 70%, transparent)` a 70%-alpha X rather than a
// colour dragged towards black.
export function mixOklab(from: Rgba, to: Rgba, weightFrom: number): Rgba {
  const weightTo = 1 - weightFrom;
  const left = toOklab(from);
  const right = toOklab(to);
  const alpha = left.alpha * weightFrom + right.alpha * weightTo;
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };

  const channel = (key: "l" | "a" | "b"): number =>
    (left[key] * left.alpha * weightFrom + right[key] * right.alpha * weightTo) / alpha;
  return oklabToRgba(channel("l"), channel("a"), channel("b"), alpha);
}
