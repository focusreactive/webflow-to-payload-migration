import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { blockTypeSchema } from "#ir/blocks.ts";
import { runScaffold } from "#generate/scaffold.ts";

import { buildMinimalScaffoldFixture, stageBlockFiles } from "./fixtures/minimal-scaffold.ts";

const execFileAsync = promisify(execFile);

// tests/unit/scripts/generate -> repo root.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const tscBin = join(repoRoot, "node_modules/typescript/bin/tsc");

// The `build` gate compiles the real deliverable with the real `payload`/`next` installed, so it
// is what guarantees whole-app type completeness. This guard closes the gap the gate cannot
// close in CI, where nothing installs payload: it compiles the files the tool itself emits —
// the migration lib, the block renderer, the globals wrappers, a detail route and the seed —
// against stand-ins for exactly the modules this repo never installs.
const STUB_DECLARATIONS = `declare module "payload" {
  export interface PayloadDoc {
    id: string | number;
    [key: string]: unknown;
  }

  export interface Payload {
    find(args: Record<string, unknown>): Promise<{ docs: PayloadDoc[] }>;
    findGlobal(args: Record<string, unknown>): Promise<unknown>;
    findByID(args: Record<string, unknown>): Promise<PayloadDoc>;
    create(args: Record<string, unknown>): Promise<PayloadDoc>;
    update(args: Record<string, unknown>): Promise<PayloadDoc>;
    updateGlobal(args: Record<string, unknown>): Promise<unknown>;
  }

  export function getPayload(options: { config: unknown }): Promise<Payload>;
}

declare module "@payload-config" {
  const config: unknown;
  export default config;
}

declare module "next" {
  export type Metadata = Record<string, unknown>;
}

declare module "next/navigation" {
  export function notFound(): never;
}
`;

// execFile rejects with a bare "Command failed: …" message and parks tsc's own diagnostics on
// the error's stdout/stderr. A typecheck net whose failure names no file or TS code is one the
// next reader skips, so the diagnostics are lifted into the thrown message.
function capturedOutput(error: unknown, key: "stdout" | "stderr"): string {
  if (typeof error !== "object" || error === null || !(key in error)) return "";
  const value: unknown = Reflect.get(error, key);
  return typeof value === "string" ? value : "";
}

async function typecheck(projectPath: string): Promise<void> {
  try {
    await execFileAsync(process.execPath, [tscBin, "--noEmit", "-p", projectPath], { cwd: projectPath });
  } catch (error) {
    const diagnostics = `${capturedOutput(error, "stdout")}\n${capturedOutput(error, "stderr")}`.trim();
    throw new Error(`tsc rejected the generated deliverable:\n${diagnostics === "" ? String(error) : diagnostics}`, {
      cause: error,
    });
  }
}

function deliverableTsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        esModuleInterop: true,
        target: "ES2022",
        lib: ["DOM", "DOM.Iterable", "ES2022"],
        jsx: "react-jsx",
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        skipLibCheck: true,
        noEmit: true,
        paths: { "@/*": ["./src/*"] },
      },
      files: [
        "src/lib/normalize-values.ts",
        "src/lib/media-prop.ts",
        "src/lib/block-field-types.ts",
        "src/lib/collection-field-types.ts",
        "src/lib/global-field-types.ts",
        "src/lib/collection-slugs.ts",
        "src/blocks/RenderBlocks.tsx",
        "src/globals/Header/index.tsx",
        "src/globals/Footer/index.tsx",
        "src/app/(frontend)/works/[slug]/page.tsx",
        "src/seed/index.ts",
        "src/seed/transform.ts",
        "stubs.d.ts",
      ],
    },
    null,
    2,
  );
}

describe("generated deliverable typechecks under the deliverable's own strict tsconfig", () => {
  it("compiles the emitted blocks, globals, detail route and seed", async () => {
    // Placed inside the repo (not os.tmpdir()) so bare imports like "react" resolve through
    // this tool's own node_modules, the same way every other emitted file resolves them.
    const projectPath = await mkdtemp(join(repoRoot, ".tmp-deliverable-typecheck-"));
    try {
      const hero = blockTypeSchema.parse({
        id: "hero",
        name: "Hero",
        content: {},
        fields: [{ name: "heading", type: { type: "text" }, required: true }],
      });
      // The block's Component gets a props interface with a required prop — the exact shape
      // that a renderer handing it a bare Record<string, unknown> fails to satisfy.
      await buildMinimalScaffoldFixture(projectPath, { blocks: { blocks: [hero] } });
      await stageBlockFiles(projectPath, "hero", {
        configTs: "export const Hero = {};\n",
        propsTs: "export interface HeroProps {\n  heading: string;\n}\n",
        componentTsx:
          'import type { HeroProps } from "./props.ts";\n\nexport default function Hero(props: HeroProps) {\n  return <div>{props.heading}</div>;\n}\n',
      });

      await runScaffold({ projectPath });

      await writeFile(join(projectPath, "stubs.d.ts"), STUB_DECLARATIONS);
      await writeFile(join(projectPath, "tsconfig.json"), deliverableTsconfig());

      await typecheck(projectPath);
    } finally {
      await rm(projectPath, { recursive: true, force: true });
    }
  }, 30_000);
});
