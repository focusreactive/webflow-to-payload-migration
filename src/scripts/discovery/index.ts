import { CliUsageError, parseServiceArgs } from "#lib/cli/index.ts";

import {
  runBlocksAccept,
  runBlocksSchema,
  runBlocksSubject,
  runCollections,
  runDedupAccept,
  runDedupSchema,
  runDedupSubject,
  runFinalize,
  runGlobalsAccept,
  runGlobalsSchema,
  runGlobalsSubject,
  runState,
} from "./steps/index.ts";

function main(): Promise<void> {
  const args = parseServiceArgs(process.argv.slice(2), {
    extraFlags: {
      "globals-schema": { type: "boolean" },
      "globals-subject": { type: "boolean" },
      "globals-accept": { type: "boolean" },
      "blocks-schema": { type: "boolean" },
      "blocks-subject": { type: "boolean" },
      "blocks-accept": { type: "boolean" },
      "dedup-schema": { type: "boolean" },
      "dedup-subject": { type: "boolean" },
      "dedup-accept": { type: "boolean" },
      collections: { type: "boolean" },
      finalize: { type: "boolean" },
      state: { type: "boolean" },
      route: { type: "string" },
    },
  });
  const project = args.projectPath;
  const route = typeof args["route"] === "string" ? args["route"] : undefined;

  if (args["globals-schema"] === true) return runGlobalsSchema(project);
  if (args["globals-subject"] === true) return runGlobalsSubject(project);
  if (args["globals-accept"] === true) return runGlobalsAccept(project);
  if (args["blocks-schema"] === true) return runBlocksSchema(project);
  if (args["blocks-subject"] === true) return runBlocksSubject(project, route);
  if (args["blocks-accept"] === true) {
    if (route === undefined) throw new CliUsageError("--route is required for --blocks-accept");
    return runBlocksAccept(project, route);
  }
  if (args["dedup-schema"] === true) return runDedupSchema(project);
  if (args["dedup-subject"] === true) return runDedupSubject(project);
  if (args["dedup-accept"] === true) return runDedupAccept(project);
  if (args["collections"] === true) return runCollections(project, args.force);
  if (args["finalize"] === true) return runFinalize(project, args.force);
  if (args["state"] === true) return runState(project);

  throw new CliUsageError(
    "one of --globals-schema|--globals-subject|--globals-accept|--blocks-schema|--blocks-subject"
      + "|--blocks-accept|--dedup-schema|--dedup-subject|--dedup-accept|--collections|--finalize|--state is required",
  );
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(error instanceof CliUsageError ? error.exitCode : 1);
}
