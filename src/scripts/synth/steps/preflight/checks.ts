import { access } from "node:fs/promises";
import { join } from "node:path";

import { FONTS_CSS_RELATIVE_PATH } from "#lib/snapshot-store/fonts.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";

import { allowsOrigin } from "./utils/allowed-origins.ts";

export interface PreflightCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor: number;
}

export function checkViewportDpr(viewports: Record<string, Viewport>, mcpDpr: number): PreflightCheck {
  const mismatched = Object.entries(viewports).filter(([, viewport]) => viewport.deviceScaleFactor !== mcpDpr);
  return {
    name: "viewport-dpr",
    ok: mismatched.length === 0,
    detail:
      mismatched.length === 0 ?
        `every viewport captures at ${mcpDpr}x`
      : `these viewports do not capture at the mcp ratio ${mcpDpr}x: ${mismatched.map(([name]) => name).join(", ")}`,
  };
}

export function checkLaneOrigins(lanes: Record<string, string[]>, origins: string[]): PreflightCheck {
  const blocked = Object.entries(lanes).flatMap(([lane, entries]) =>
    entries.length === 0 ?
      []
    : origins.filter((origin) => !allowsOrigin(entries, origin)).map((origin) => `${lane} blocks ${origin}`),
  );

  return {
    name: "lane-origins",
    ok: blocked.length === 0,
    detail:
      blocked.length === 0 ?
        `every lane reaches ${origins.join(" and ")}`
      : `${blocked.join(", ")} — a bare host entry carries no port, use "localhost:*"`,
  };
}

export interface StylesheetProbe {
  route: string;
  linked: string[];
  applied: { href: string; rules: number }[];
}

export function checkReferenceStyled(probe: StylesheetProbe): PreflightCheck {
  const ruleCountByHref = new Map(probe.applied.map((sheet) => [sheet.href, sheet.rules]));
  const dropped = probe.linked.filter((href) => (ruleCountByHref.get(href) ?? 0) === 0);
  const total = probe.applied.reduce((sum, sheet) => sum + sheet.rules, 0);

  return {
    name: "reference-styled",
    ok: dropped.length === 0,
    detail:
      dropped.length === 0 ?
        `${probe.route} applied ${total} css rules from ${probe.linked.length} local stylesheet(s)`
      : `${probe.route} dropped ${dropped.join(", ")} — a rewritten url that kept its integrity hash renders the reference unstyled`,
  };
}

export async function checkFonts(projectPath: string): Promise<PreflightCheck> {
  const path = join(projectPath, SNAPSHOT_DIR, FONTS_CSS_RELATIVE_PATH);
  const ok = await access(path)
    .then(() => true)
    .catch(() => false);

  return {
    name: "fonts",
    ok,
    detail: ok ? "the snapshot carries fonts.css" : `missing ${path} — every glyph would differ between the two sides`,
  };
}

export async function checkHealth(name: string, origin: string): Promise<PreflightCheck> {
  try {
    const response = await fetch(`${origin}/_health`);

    return {
      name,
      ok: response.ok,
      detail: `${origin} answered ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      name,
      ok: false,
      detail: `${origin} is unreachable: ${message}`,
    };
  }
}
