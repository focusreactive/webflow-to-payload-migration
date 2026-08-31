import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { emitBlockConfig } from "#blocks/codegen/config.ts";
import { blockDirName } from "#blocks/codegen/names.ts";
import { emitBlockProps } from "#blocks/codegen/props.ts";
import { readArtifact, readNdjsonArtifact } from "#ir/artifact.ts";
import { blocksArtifact } from "#ir/blocks.ts";
import { collectionsArtifact, type CollectionEntry } from "#ir/collections.ts";
import { globalsArtifact, type GlobalsData } from "#ir/globals.ts";
import { layoutRouteArtifactFor } from "#ir/layout.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { writeFileAtomic } from "#lib/fs.ts";
import { readManifest } from "#lib/manifest/index.ts";
import { routeDir } from "#lib/route-dir.ts";
import { FONT_ASSETS_DIR, FONTS_CSS_RELATIVE_PATH, rewriteFontUrls } from "#lib/snapshot-store/fonts.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";
import { synthEntryDir } from "#lib/synth-store/paths.ts";
import { designTokensArtifact } from "#tokens/schemas/design-tokens.ts";

import { buildCollectionSlugMap, emitCollectionSlugsFile, RESERVED_COLLECTION_KEYS } from "./codegen/collection-slugs.ts";
import { collectionFileName, emitCmsCollectionFile, emitPagesCollectionFile } from "./codegen/collections.ts";
import { assertNoBaseRouteCollision, detailRoutePath, emitDetailWrapper } from "./codegen/detail-route.ts";
import {
  emitBlockFieldTypesFile,
  emitCollectionFieldTypesFile,
  emitGlobalFieldTypesFile,
} from "./codegen/field-type-maps.ts";
import { emitGlobalConfigFile } from "./codegen/globals-config.ts";
import { pascalCase } from "./codegen/names.ts";
import { emitPackageJson } from "./codegen/package-json.ts";
import { emitPayloadConfigFile } from "./codegen/payload-config.ts";
import { emitRenderBlocksFile } from "./codegen/render-blocks.ts";
import { emitGlobalsCssFile } from "./codegen/theme.ts";
import { writeAppEnv } from "./env.ts";
import { chromeBlockTypeFor } from "./globals-components.ts";
import { createOverlayDraft, readPreviouslyWritten, writeOverlay } from "./overlay.ts";
import { buildPageTreeArtifact } from "./page-meta.ts";
import { assertNoGlobalDirCollision, DELIVERABLE_FILES_ARTIFACT_PATH, PAGE_TREE_ARTIFACT_PATH } from "./paths.ts";
import { readTemplate } from "./templates/read-template.ts";

const deliverableSrcDir = join(dirname(fileURLToPath(import.meta.url)), "deliverable");

export function rewriteRelativeTsImports(code: string): string {
  const rewritten = code.replace(/(from\s+["'])(\.{1,2}\/[^"']*)\.tsx?(["'])/g, "$1$2$3");
  return ensureJsxNamespaceImport(rewritten);
}

async function stageRichTextDir(opts: {
  srcEntryDir: string;
  destDir: string;
  put: (relativePath: string, contents: string) => void;
  seen: Map<string, string>;
  warnings: string[];
  label: string;
}): Promise<void> {
  const dir = join(opts.srcEntryDir, "richtext");
  if (!existsSync(dir)) return;
  for (const file of (await readdir(dir)).sort()) {
    if (!file.endsWith(".tsx")) continue;
    const contents = rewriteRelativeTsImports(await readFile(join(dir, file), "utf8"));
    const relativePath = join(opts.destDir, "richtext", file);
    const previous = opts.seen.get(relativePath);
    if (previous !== undefined && previous !== contents) {
      opts.warnings.push(
        `richtext: ${opts.label} overwrites ${relativePath} with different per-tag styles — `
          + "two sections share the field name; the last one wins",
      );
    }
    opts.seen.set(relativePath, contents);
    opts.put(relativePath, contents);
  }
}

const DIRECTIVE_PROLOGUE = /^\s*(["'])use (?:client|server)\1;?[ \t]*\r?\n?/;

function ensureJsxNamespaceImport(code: string): string {
  if (!/\bJSX\./.test(code)) return code;
  if (/import[^;]*\bJSX\b[^;]*from\s+["']react["']/.test(code)) return code;
  const jsxImport = `import type { JSX } from "react";\n`;
  const directive = DIRECTIVE_PROLOGUE.exec(code)?.[0];
  if (directive === undefined) return `${jsxImport}${code}`;
  return `${directive}${jsxImport}${code.slice(directive.length)}`;
}

async function readOptional<T>(reader: () => Promise<{ data: T }>): Promise<T | undefined> {
  try {
    return (await reader()).data;
  } catch {
    return undefined;
  }
}

interface ChromeTokens {
  HEADER_IMPORT: string;
  FOOTER_IMPORT: string;
  HEADER_JSX: string;
  FOOTER_JSX: string;
}

// The shell's root layout renders whichever chrome globals the IR actually carries; a slot with
// no global collapses to an empty string rather than to a dangling import.
function chromeTokens(globals: GlobalsData): ChromeTokens {
  const present = new Set(globals.globals.map((def) => def.name));
  return {
    HEADER_IMPORT: present.has("header") ? 'import { Header } from "@/globals/Header";' : "",
    FOOTER_IMPORT: present.has("footer") ? 'import { Footer } from "@/globals/Footer";' : "",
    HEADER_JSX: present.has("header") ? "<Header />" : "",
    FOOTER_JSX: present.has("footer") ? "<Footer />" : "",
  };
}

// buildCollectionSlugMap seeds its disambiguation from RESERVED_COLLECTION_KEYS, so a computed
// slug landing on a reserved word should be unreachable; this guard exists to catch that
// invariant breaking rather than a collision it is still possible to hit.
function assertNoBuiltInCollectionKeyCollision(slugs: readonly string[]): void {
  for (const slug of slugs) {
    if (RESERVED_COLLECTION_KEYS.has(slug)) {
      throw new Error(
        `CMS collection slug "${slug}" collides with a reserved collection; `
          + `buildCollectionSlugMap's reserved-word seeding should have disambiguated this — treat it as a bug there`,
      );
    }
  }
}

export async function runScaffold(args: { projectPath: string }): Promise<{ files: string[]; warnings: string[] }> {
  const { projectPath } = args;
  const warnings: string[] = [];
  const manifest = await readManifest(projectPath);
  const pages = (await readArtifact(projectPath, pagesArtifact)).data;
  const blocks = (await readArtifact(projectPath, blocksArtifact)).data;
  const globals = (await readArtifact(projectPath, globalsArtifact)).data;
  const tokens = (await readArtifact(projectPath, designTokensArtifact)).data;
  const collectionEntries: CollectionEntry[] =
    (await readOptional(() => readArtifact(projectPath, collectionsArtifact)))?.collections ?? [];
  assertNoGlobalDirCollision(blocks);

  const projectName = basename(projectPath);
  const { draft, templates, emitted } = createOverlayDraft();
  const previouslyWritten = await readPreviouslyWritten(projectPath);
  const stagedRichText = new Map<string, string>();

  // --- shell ---
  draft.template("package.json", emitPackageJson(projectName));
  draft.template("tsconfig.json", await readTemplate("shell/tsconfig.json.tpl"));
  draft.template("next.config.ts", await readTemplate("shell/next.config.ts.tpl"));
  draft.template("postcss.config.js", await readTemplate("shell/postcss.config.js.tpl"));
  draft.template("eslint.config.mjs", await readTemplate("shell/eslint.config.mjs.tpl"));
  draft.template(".gitignore", await readTemplate("shell/gitignore.tpl"));
  draft.template(".env.example", await readTemplate("shell/env.example.tpl"));
  draft.template(
    "README.md",
    await readTemplate("shell/README.md.tpl", { PROJECT_NAME: projectName, SOURCE_URL: manifest.sourceUrl }),
  );

  // --- (payload) route group ---
  draft.template("src/app/(payload)/layout.tsx", await readTemplate("app-payload/layout.tsx.tpl"));
  draft.template("src/app/(payload)/custom.scss", await readTemplate("app-payload/custom.scss.tpl"));
  draft.template("src/app/(payload)/admin/importMap.js", await readTemplate("app-payload/import-map.js.tpl"));
  draft.template(
    "src/app/(payload)/admin/[[...segments]]/page.tsx",
    await readTemplate("app-payload/admin-page.tsx.tpl"),
  );
  draft.template(
    "src/app/(payload)/admin/[[...segments]]/not-found.tsx",
    await readTemplate("app-payload/admin-not-found.tsx.tpl"),
  );
  draft.template("src/app/(payload)/api/[...slug]/route.ts", await readTemplate("app-payload/api-route.ts.tpl"));
  draft.template("src/app/(payload)/api/graphql/route.ts", await readTemplate("app-payload/graphql-route.ts.tpl"));

  // --- payload config + collections ---
  const { map: collectionSlugMap, warnings: slugWarnings } = buildCollectionSlugMap(collectionEntries);
  warnings.push(...slugWarnings);
  const slugFor = (key: string): string => collectionSlugMap.get(key) ?? key;
  const collectionSlugs = collectionEntries.map((entry) => slugFor(String(entry.key)));
  assertNoBuiltInCollectionKeyCollision(collectionSlugs);
  const globalNames = globals.globals.map((def) => def.name);

  draft.template("src/payload.config.ts", emitPayloadConfigFile({ collectionSlugs, globalNames }));
  draft.template("src/collections/Media.ts", await readTemplate("collections/Media.ts.tpl"));
  draft.template("src/collections/Users.ts", await readTemplate("collections/Users.ts.tpl"));
  draft.template("src/collections/Pages.ts", emitPagesCollectionFile(blocks.blocks));

  for (const entry of collectionEntries) {
    const slug = slugFor(String(entry.key));
    draft.emit(join("src/collections", collectionFileName(slug)), emitCmsCollectionFile(entry, slug, slugFor));
  }

  // --- globals (the chrome roles the IR carries) ---
  for (const def of globals.globals) {
    const name = def.name;
    const dir = join("src/globals", pascalCase(name));
    draft.emit(join(dir, "config.ts"), emitGlobalConfigFile(def));
    draft.emit(
      join(dir, "index.tsx"),
      await readTemplate("globals/component-wrapper.tsx.tpl", { NAME: pascalCase(name), SLUG: name }),
    );
    draft.emit(join(dir, "props.ts"), emitBlockProps(chromeBlockTypeFor(def)));

    const stagedComponent = join(synthEntryDir(projectPath, "globals", name), "Component.tsx");
    if (!existsSync(stagedComponent)) {
      throw new Error(
        `global "${name}" is missing Component.tsx — run the synth:globals --finalize --global ${name} unit first`,
      );
    }
    draft.emit(join(dir, "Component.tsx"), rewriteRelativeTsImports(await readFile(stagedComponent, "utf8")));
    await stageRichTextDir({
      srcEntryDir: synthEntryDir(projectPath, "globals", name),
      destDir: dir,
      put: draft.emit,
      seen: stagedRichText,
      warnings,
      label: `global "${name}"`,
    });
  }

  // --- blocks (copy authored artifacts + RenderBlocks) ---
  for (const block of blocks.blocks) {
    const fromDir = synthEntryDir(projectPath, "blocks", String(block.id));
    const toDir = join("src/blocks", blockDirName(block.id));
    for (const file of ["config.ts", "props.ts", "Component.tsx"]) {
      const source = join(fromDir, file);
      if (!existsSync(source)) {
        throw new Error(`block "${String(block.id)}" is missing ${file} — the blocks stage must be complete`);
      }
      if (file === "config.ts") {
        draft.emit(join(toDir, file), emitBlockConfig(block, slugFor));
      } else if (file === "props.ts") {
        draft.emit(join(toDir, file), emitBlockProps(block));
      } else {
        draft.emit(join(toDir, file), rewriteRelativeTsImports(await readFile(source, "utf8")));
      }
    }
    await stageRichTextDir({
      srcEntryDir: fromDir,
      destDir: toDir,
      put: draft.emit,
      seen: stagedRichText,
      warnings,
      label: `block "${String(block.id)}"`,
    });
  }
  draft.template("src/blocks/RenderBlocks.tsx", emitRenderBlocksFile(blocks));

  // --- lib: the runtime helpers the emitted code imports ---
  draft.emit(
    "src/lib/normalize-values.ts",
    await readFile(join(deliverableSrcDir, "lib/normalize-values.ts"), "utf8"),
  );
  draft.emit("src/lib/media-prop.ts", await readTemplate("lib/media-prop.ts.tpl"));
  draft.emit("src/lib/block-field-types.ts", emitBlockFieldTypesFile(blocks, slugFor));
  draft.emit("src/lib/collection-field-types.ts", emitCollectionFieldTypesFile(collectionEntries, slugFor));
  draft.emit("src/lib/collection-slugs.ts", emitCollectionSlugsFile(collectionSlugMap));
  draft.emit("src/lib/global-field-types.ts", emitGlobalFieldTypesFile(globals));

  // --- frontend ---
  draft.template(
    "src/app/(frontend)/layout.tsx",
    await readTemplate("app-frontend/layout.tsx.tpl", { ...chromeTokens(globals) }),
  );
  const snapshotFontsCssPath = join(projectPath, SNAPSHOT_DIR, FONTS_CSS_RELATIVE_PATH);
  const fontsCss = existsSync(snapshotFontsCssPath) ? await readFile(snapshotFontsCssPath, "utf8") : "";
  if (fontsCss === "") warnings.push("fonts: snapshot fonts.css missing or empty — app ships without webfonts");
  draft.emit("src/app/(frontend)/fonts.css", rewriteFontUrls(fontsCss, "/fonts/"));
  draft.emit("src/app/(frontend)/globals.css", emitGlobalsCssFile(tokens));
  draft.template("src/app/(frontend)/not-found.tsx", await readTemplate("app-frontend/not-found.tsx.tpl"));
  draft.template("src/app/(frontend)/[[...slug]]/page.tsx", await readTemplate("app-frontend/catch-all-page.tsx.tpl"));

  // --- detail routes ---
  const entryByKey = new Map(collectionEntries.map((entry) => [String(entry.key), entry]));
  for (const collection of pages.collections) {
    const entry = entryByKey.get(collection.key);
    if (entry === undefined) {
      warnings.push(`collection "${collection.key}": no collections.json entry — no detail route generated`);
      continue;
    }
    const key = String(entry.key);
    if (entry.template.length === 0) {
      warnings.push(`collection "${key}": empty section template — no detail route generated`);
      continue;
    }
    assertNoBaseRouteCollision(collection.routePattern);
    let missingSection = false;
    for (const binding of entry.template) {
      const staged = join(
        synthEntryDir(projectPath, "collections", key),
        "sections",
        binding.sectionId,
        "Component.tsx",
      );
      if (!existsSync(staged)) {
        warnings.push(`collection "${key}": staged section "${binding.sectionId}" missing — no detail route generated`);
        missingSection = true;
        break;
      }
      draft.emit(
        join("src/detail", key, "sections", `${pascalCase(binding.sectionId)}.tsx`),
        rewriteRelativeTsImports(await readFile(staged, "utf8")),
      );
      await stageRichTextDir({
        srcEntryDir: join(synthEntryDir(projectPath, "collections", key), "sections", binding.sectionId),
        destDir: join("src/detail", key, "sections"),
        put: draft.emit,
        seen: stagedRichText,
        warnings,
        label: `collection "${key}" section "${binding.sectionId}"`,
      });
    }
    if (missingSection) continue;
    draft.emit(
      detailRoutePath(collection.routePattern),
      emitDetailWrapper({
        collectionKey: key,
        collectionSlug: slugFor(key),
        pageBinding: entry.pageBinding,
        template: entry.template,
      }),
    );
  }

  // Every captured static route should have a layout/routes artifact for the seed to pick up.
  const staticRoutes = pages.pages.filter((page) => page.kind === "static").map((page) => page.route);
  for (const route of staticRoutes) {
    try {
      await readNdjsonArtifact(projectPath, layoutRouteArtifactFor(routeDir(route)));
    } catch {
      warnings.push(
        `static route "${route}": layout/routes artifact missing — the page will be seeded as an empty draft`,
      );
    }
  }

  // The nested page tree (container nodes included) and the head metadata are resolved here
  // so the deliverable's seed only has to write what this artifact already decided.
  const pageTree = await buildPageTreeArtifact({ projectPath, routes: staticRoutes });
  await writeFileAtomic(
    join(projectPath, PAGE_TREE_ARTIFACT_PATH),
    `${JSON.stringify({ nodes: pageTree }, null, 2)}\n`,
  );

  const fontAssetsDir = join(projectPath, SNAPSHOT_DIR, FONT_ASSETS_DIR);
  if (existsSync(fontAssetsDir)) {
    for (const file of await readdir(fontAssetsDir)) {
      draft.emit(join("public/fonts", file), await readFile(join(fontAssetsDir, file)));
    }
  }

  // --- seed ---
  draft.emit("src/seed/index.ts", await readTemplate("seed/index.ts.tpl"));
  draft.emit(
    "src/seed/transform.ts",
    rewriteRelativeTsImports(await readFile(join(deliverableSrcDir, "seed/transform.ts"), "utf8")),
  );

  const { files, removed } = await writeOverlay({ projectPath, templates, emitted, previouslyWritten });
  await writeFileAtomic(
    join(projectPath, DELIVERABLE_FILES_ARTIFACT_PATH),
    `${JSON.stringify({ files, removed, warnings }, null, 2)}\n`,
  );

  // .env stays outside the overlay so stale-file removal cannot delete the secrets it holds.
  await writeAppEnv({ projectPath, projectName });

  return { files, warnings };
}
