import { CliUsageError, parseServiceArgs } from "#lib/cli/index.ts";

import { runAccept, runCandidates, runSchema, runState, runTheme } from "./steps/index.ts";

async function main(): Promise<void> {
  const args = parseServiceArgs(process.argv.slice(2), {
    extraFlags: {
      candidates: { type: "boolean" },
      schema: { type: "boolean" },
      accept: { type: "boolean" },
      theme: { type: "boolean" },
      state: { type: "boolean" },
    },
  });
  const project = args.projectPath;

  if (args["candidates"] === true) return runCandidates(project, args.force);
  if (args["schema"] === true) return runSchema(project);
  if (args["accept"] === true) return runAccept(project);
  if (args["theme"] === true) return runTheme(project);
  if (args["state"] === true) return runState(project);

  throw new CliUsageError("one of --candidates|--schema|--accept|--theme|--state is required");
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`${message}\n`);
  process.exit(error instanceof CliUsageError ? error.exitCode : 1);
}
