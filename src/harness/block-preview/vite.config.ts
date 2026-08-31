import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";


const projectDir = process.env.MIGRATE_PROJECT;
if (!projectDir) throw new Error("block-preview: MIGRATE_PROJECT env is required");
const artifacts = join(projectDir, ".migration", "artifacts");
const here = dirname(fileURLToPath(import.meta.url));

const snapshotFontsCss = join(projectDir, ".migration", "snapshot", "styles", "fonts.css");
const appCss = join(here, "app.css");

mkdirSync(join(artifacts, "synth"), { recursive: true });

const require = createRequire(import.meta.url);
const RUNTIME_SPECIFIERS = ["@payloadcms/richtext-lexical/react"];

function runtimeAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const specifier of RUNTIME_SPECIFIERS) {
    try {
      aliases[specifier] = require.resolve(specifier);
    } catch {
      // not installed — leave it to the default resolver so the error is clear
    }
  }
  return aliases;
}

function tailwindRescanPlugin(): Plugin {
  return {
    name: "block-preview:tailwind-rescan",
    apply: "serve",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const graph = ctx.server?.environments.client.moduleGraph;
        if (!graph) return html;
        for (const mod of graph.getModulesByFile(appCss) ?? []) graph.invalidateModule(mod);
        return html;
      },
    },
  };
}

export default defineConfig({
  root: here,
  plugins: [
    tailwindRescanPlugin(),
    {
      name: "block-preview:site-paths",
      enforce: "pre",
      transform(code, id) {
        if (id.endsWith("block-preview/app.css")) {
          return code.replaceAll("__PROJECT_SYNTH__", join(artifacts, "synth"));
        }
        return undefined;
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "#site-theme": join(artifacts, "theme.css"),
      "#site-fonts": existsSync(snapshotFontsCss) ? snapshotFontsCss : join(here, "fonts-fallback.css"),
      ...runtimeAliases(),
    },
  },
  server: {
    fs: {
      allow: [here, projectDir],
    },
  },
  define: {
    __PROJECT_ROOT__: JSON.stringify(projectDir),
  },
});
