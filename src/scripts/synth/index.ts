import { CliUsageError, parseServiceArgs } from "#lib/cli/index.ts";
import { readManifest } from "#lib/manifest/index.ts";

import {
  runAccept,
  runContentAccept,
  runContentSchema,
  runContentSubject,
  runDraftSubject,
  runFieldsAccept,
  runFieldsSchema,
  runFieldsSubject,
  runFinalize,
  runInputBuild,
  runPreflight,
  runRichTextAccept,
  runRichTextSchema,
  runRichTextSubject,
  runState,
} from "./steps/index.ts";
import {
  requireAddress,
  requireEntityLevel,
  requireOrigin,
  requireSurface,
  requireVertical,
} from "./utils/args.ts";

const FLAGS = [
  "preflight",
  "accept",
  "state",
  "fields-schema",
  "fields-subject",
  "fields-accept",
  "content-schema",
  "content-subject",
  "content-accept",
  "input-build",
  "draft-subject",
  "richtext-schema",
  "richtext-subject",
  "richtext-accept",
  "finalize",
] as const;

async function main(): Promise<void> {
  const args = parseServiceArgs(process.argv.slice(2), {
    extraFlags: {
      ...Object.fromEntries(FLAGS.map((flag) => [flag, { type: "boolean" as const }])),
      vertical: { type: "string" },
      block: { type: "string" },
      global: { type: "string" },
      collection: { type: "string" },
      section: { type: "string" },
      "replay-origin": { type: "string" },
      "harness-origin": { type: "string" },
    },
  });
  const projectPath = args.projectPath;

  if (args["preflight"] === true) {
    await runPreflight({
      projectPath,
      replayOrigin: requireOrigin(args, "replay-origin"),
      harnessOrigin: requireOrigin(args, "harness-origin"),
    });
    return;
  }

  await readManifest(projectPath);

  if (args["state"] === true) return runState(projectPath, requireVertical(args));
  if (args["finalize"] === true) return runFinalize(projectPath, requireVertical(args), args.force);

  if (args["fields-schema"] === true) {
    const { vertical, address } = requireAddress(args);
    return runFieldsSchema(projectPath, vertical, address);
  }
  if (args["fields-subject"] === true) {
    const { vertical, address } = requireAddress(args);
    return runFieldsSubject(projectPath, vertical, address);
  }
  if (args["fields-accept"] === true) {
    const { vertical, address } = requireAddress(args);
    return runFieldsAccept(projectPath, vertical, address);
  }

  if (args["content-schema"] === true) {
    const { vertical, key } = requireEntityLevel(args);
    return runContentSchema(projectPath, vertical, key);
  }
  if (args["content-subject"] === true) {
    const { vertical, key } = requireEntityLevel(args);
    return runContentSubject(projectPath, vertical, key);
  }
  if (args["content-accept"] === true) {
    const { vertical, key } = requireEntityLevel(args);
    return runContentAccept(projectPath, vertical, key);
  }

  if (args["input-build"] === true) {
    const { vertical, address } = requireSurface(args);
    return runInputBuild(projectPath, vertical, address);
  }
  if (args["draft-subject"] === true) {
    const { vertical, address } = requireSurface(args);
    return runDraftSubject(projectPath, vertical, address);
  }

  if (args["richtext-schema"] === true) {
    requireSurface(args);
    runRichTextSchema();
    return;
  }
  if (args["richtext-subject"] === true) {
    const { vertical, address } = requireSurface(args);
    return runRichTextSubject(projectPath, vertical, address);
  }
  if (args["richtext-accept"] === true) {
    const { vertical, address } = requireSurface(args);
    return runRichTextAccept(projectPath, vertical, address);
  }

  if (args["accept"] === true) {
    const { vertical, address } = requireSurface(args);
    return runAccept({
      projectPath,
      vertical,
      address,
      harnessOrigin: requireOrigin(args, "harness-origin"),
    });
  }

  throw new CliUsageError(`one of ${FLAGS.map((flag) => `--${flag}`).join(" | ")} is required`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(error instanceof CliUsageError ? error.exitCode : 1);
}
