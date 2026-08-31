import { readArtifact } from "#ir/artifact.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { VIEWPORTS } from "#lib/capture/defaults.ts";

import { printJson } from "../../utils/print-json.ts";

import {
  checkFonts,
  checkHealth,
  checkLaneOrigins,
  checkReferenceStyled,
  checkViewportDpr,
  type PreflightCheck,
} from "./checks.ts";
import { probeReferenceStylesheets } from "./utils/probe-reference-stylesheets.ts";
import { readLaneAllowedOrigins, readMcpDeviceScaleFactor } from "./utils/tool-config.ts";

export interface PreflightReport {
  ok: boolean;
  checks: PreflightCheck[];
}

async function firstRoute(projectPath: string): Promise<string | undefined> {
  const pages = (await readArtifact(projectPath, pagesArtifact)).data;
  return pages.pages.find((page) => page.kind === "static")?.route ?? pages.pages[0]?.route;
}

export async function runPreflight(opts: {
  projectPath: string;
  replayOrigin: string;
  harnessOrigin: string;
}): Promise<void> {
  const mcpDpr = await readMcpDeviceScaleFactor();

  const checks: PreflightCheck[] = [
    checkViewportDpr(VIEWPORTS, mcpDpr),
    checkLaneOrigins(await readLaneAllowedOrigins(), [opts.replayOrigin, opts.harnessOrigin]),
    await checkFonts(opts.projectPath),
    await checkHealth("replay", opts.replayOrigin),
    await checkHealth("harness", opts.harnessOrigin),
  ];

  const route = await firstRoute(opts.projectPath);
  if (checks.every((check) => check.ok) && route !== undefined) {
    checks.push(checkReferenceStyled(await probeReferenceStylesheets(opts.replayOrigin, route)));
  }

  const report: PreflightReport = { ok: checks.every((check) => check.ok), checks };
  printJson(report);
  if (!report.ok) process.exitCode = 1;
}
