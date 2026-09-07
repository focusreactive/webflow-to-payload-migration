import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

import { emitBlockConfig } from "#blocks/codegen/config.ts";
import { blockDirName } from "#blocks/codegen/names.ts";
import { emitBlockProps } from "#blocks/codegen/props.ts";
import { readArtifact, readNdjsonArtifact } from "#ir/artifact.ts";
import { blocksArtifact } from "#ir/blocks.ts";
import { collectionsArtifact, type CollectionEntry } from "#ir/collections.ts";
import { globalsArtifact } from "#ir/globals.ts";
import { layoutRouteArtifactFor } from "#ir/layout.ts";
import { pagesArtifact } from "#ir/pages.ts";
import { writeFileAtomic } from "#lib/fs.ts";
import { readManifest } from "#lib/manifest/index.ts";
import { routeDir } from "#lib/route-dir.ts";
import { FONT_ASSETS_DIR, FONTS_CSS_RELATIVE_PATH, rewriteFontUrls } from "#lib/snapshot-store/fonts.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";
import { synthEntryDir } from "#lib/synth-store/paths.ts";
import { designTokensArtifact } from "#tokens/schemas/design-tokens.ts";

import { DELIVERABLE_SRC_DIR } from "../../constants/dirs.ts";
import { DELIVERABLE_FILES_ARTIFACT_PATH, PAGE_TREE_ARTIFACT_PATH } from "../../constants/paths.ts";
import { readTemplate } from "../../templates/read-template.ts";

import { writeAppEnv } from "./app-env.ts";
import { chromeBlockTypeFor } from "./chrome-block-type.ts";
import { buildCollectionSlugMap, emitCollectionSlugsFile } from "./collection-slugs.ts";
import { collectionFileName, emitCmsCollectionFile, emitPagesCollectionFile } from "./collections.ts";
import { assertNoBaseRouteCollision, detailRoutePath, emitDetailWrapper } from "./detail-route.ts";
import { emitBlockFieldTypesFile, emitCollectionFieldTypesFile, emitGlobalFieldTypesFile } from "./field-type-maps.ts";
import { emitGlobalConfigFile } from "./globals-config.ts";
import { createOverlayDraft, readPreviouslyWritten, writeOverlay } from "./overlay.ts";
import { emitPackageJson } from "./package-json.ts";
import { buildPageTreeArtifact } from "./page-meta.ts";
import { emitPayloadConfigFile } from "./payload-config.ts";
import { emitRenderBlocksFile } from "./render-blocks.ts";
import { emitGlobalsCssFile } from "./theme.ts";
import {
  assertNoBuiltInCollectionKeyCollision,
  assertNoGlobalDirCollision,
  chromeTokens,
  readOptional,
  rewriteRelativeTsImports,
  stageRichTextDir,
} from "./utils/emit-deliverable.ts";
import { pascalCase } from "./utils/names.ts";

export async function emitDeliverable(args: { projectPath: string }): Promise<{ files: string[]; warnings: string[] }> {
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

  draft.emit(
    "src/lib/normalize-values.ts",
    await readFile(join(DELIVERABLE_SRC_DIR, "lib/normalize-values.ts"), "utf8"),
  );
  draft.emit("src/lib/media-prop.ts", await readTemplate("lib/media-prop.ts.tpl"));
  draft.emit("src/lib/block-field-types.ts", emitBlockFieldTypesFile(blocks, slugFor));
  draft.emit("src/lib/collection-field-types.ts", emitCollectionFieldTypesFile(collectionEntries, slugFor));
  draft.emit("src/lib/collection-slugs.ts", emitCollectionSlugsFile(collectionSlugMap));
  draft.emit("src/lib/global-field-types.ts", emitGlobalFieldTypesFile(globals));
  draft.emit("src/lib/normalize-ctx.ts", await readTemplate("lib/normalize-ctx.ts.tpl"));

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

  draft.emit("src/seed/index.ts", await readTemplate("seed/index.ts.tpl"));
  draft.emit(
    "src/seed/transform.ts",
    rewriteRelativeTsImports(await readFile(join(DELIVERABLE_SRC_DIR, "seed/transform.ts"), "utf8")),
  );

  const { files, removed } = await writeOverlay({ projectPath, templates, emitted, previouslyWritten });
  await writeFileAtomic(
    join(projectPath, DELIVERABLE_FILES_ARTIFACT_PATH),
    `${JSON.stringify({ files, removed, warnings }, null, 2)}\n`,
  );

  await writeAppEnv({ projectPath, projectName });

  return { files, warnings };
}
