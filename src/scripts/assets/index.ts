import { CliUsageError, parseServiceArgs } from "#lib/cli/index.ts";

import { runFonts, runMedia, runState } from "./steps/index.ts";

function main(): Promise<void> {
  const args = parseServiceArgs(process.argv.slice(2), {
    extraFlags: {
      media: { type: "boolean" },
      fonts: { type: "boolean" },
      state: { type: "boolean" },
    },
  });
  const project = args.projectPath;

  if (args["media"] === true) return runMedia(project, args.force);
  if (args["fonts"] === true) return runFonts(project, args.force);
  if (args["state"] === true) return runState(project);

  throw new CliUsageError("one of --media|--fonts|--state is required");
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(error instanceof CliUsageError ? error.exitCode : 1);
}
