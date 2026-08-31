/* Migration seed (generated). Run once from the deliverable app dir:
 *   pnpm seed
 * Reads the migration IR from .migration/ (the tool's Tier-1 working dir),
 * so it is an OPERATOR step — a cloned repo without .migration/ cannot re-run
 * it (structural regeneration uses migration/ir instead).
 */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import config from "@payload-config";
import { convertHTMLToLexical, editorConfigFactory } from "@payloadcms/richtext-lexical";
import { JSDOM } from "jsdom";
import { getPayload, type Payload } from "payload";

import { I18N_CONFIG } from "../lib/config/i18n";
import { collectionSlugs } from "../lib/migration/collection-slugs";
import type { FieldDef } from "../lib/migration/normalize-values";
import type { Locale } from "../lib/types";
import {
  collectAssetIdsFromValue,
  collectImgUrls,
  parseNdjson,
  partitionFields,
  payloadDataForFields,
  type SeedCtx,
} from "./transform";

// `payload run` starts in the app dir while .migration/ sits at the monorepo root, so the
// working dirs are resolved by walking up to the manifest rather than from a fixed depth.
function findMigrationRoot(start: string): string {
  let current = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(current, ".migration", "manifest.json"))) return current;
    const parent = path.dirname(current);
    if (parent === current) throw new Error("could not find .migration/manifest.json above the app directory");
    current = parent;
  }
}

const MIGRATION_ROOT = findMigrationRoot(process.cwd());
const ARTIFACTS_DIR = path.join(MIGRATION_ROOT, ".migration", "artifacts");
const SNAPSHOT_DIR = path.join(MIGRATION_ROOT, ".migration", "snapshot");

// Every write is a bulk import, so the afterChange revalidation hooks would fire Next cache
// invalidations for a server that is not running.
const SEED_CONTEXT = { disableRevalidate: true } as const;

const slugOf = (collectionKey: string): string => collectionSlugs[collectionKey] ?? collectionKey;

const warnings: string[] = [];
const warn = (message: string): void => {
  warnings.push(message);
  console.warn(`[seed] warn: ${message}`);
};

async function readEnvelope<T>(relativePath: string): Promise<T | undefined> {
  try {
    const raw = JSON.parse(await readFile(path.join(ARTIFACTS_DIR, relativePath), "utf8")) as { data: T };
    return raw.data;
  } catch {
    return undefined;
  }
}

interface AssetRecord {
  assetId: string;
  canonicalUrl: string;
  status: string;
  storePath?: string;
  alt?: string;
}

interface CollectionDef {
  key: string;
  fields: FieldDef[];
  pageBinding: { slugField: string };
  items: Record<string, unknown>[];
}

interface GlobalDef {
  name: string;
  fields: FieldDef[];
  values: Record<string, unknown>;
}

interface BlockDef {
  id: string;
  fields: FieldDef[];
}

// The page payload the seed hands Payload. Declared so the literal below is checked field by
// field instead of disappearing into the widening cast at the create/update boundary.
interface PageSeedData {
  title: string;
  slug: string;
  blocks: Record<string, unknown>[];
  _status: "draft" | "published";
  parent?: string | number;
  header?: string | number;
  footer?: string | number;
  meta?: { title: string; description: string };
}

interface PageNode {
  path: string;
  slug: string;
  parentPath: string | null;
  depth: number;
  route: string | null;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

type LayoutSource = { kind: "literal"; value: unknown };
interface LayoutRecord {
  order: number;
  blockType: string;
  fields: Record<string, LayoutSource>;
}

function literalOnly(fields: Record<string, LayoutSource>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [slug, source] of Object.entries(fields)) {
    out[slug] = source.value;
  }
  return out;
}

// The artifact carries the locale the tool generated the app for; resolving it through
// I18N_CONFIG both types it as the config's own Locale and fails loud if the two disagree.
function resolveLocale(code: string): Locale {
  const configured = I18N_CONFIG.locales.find((entry) => entry.code === code);
  if (configured === undefined) {
    throw new Error(`page-tree.json locale "${code}" is not one of the locales in lib/config/i18n.ts`);
  }
  return configured.code;
}

// ---------- referenced-asset collection ----------

function referencedAssetIds(opts: {
  collections: CollectionDef[];
  contentByCollection: Map<string, Record<string, unknown>[]>;
  blocks: BlockDef[];
  layoutFiles: { route: string; records: LayoutRecord[] }[];
  globals: GlobalDef[];
  resolveAssetId: (url: string) => string | undefined;
}): Set<string> {
  const ids = new Set<string>();
  const addFromValue = (field: FieldDef, value: unknown): void => {
    for (const id of collectAssetIdsFromValue(field.type, value)) ids.add(id);
    if (field.type.type === "richText" && typeof value === "string") {
      for (const url of collectImgUrls(value)) {
        const id = opts.resolveAssetId(url);
        if (id !== undefined) ids.add(id);
      }
    }
  };

  for (const collection of opts.collections) {
    for (const record of opts.contentByCollection.get(collection.key) ?? []) {
      for (const field of collection.fields) addFromValue(field, record[field.name]);
    }
  }
  const blockById = new Map(opts.blocks.map((block) => [block.id, block]));
  for (const file of opts.layoutFiles) {
    for (const record of file.records) {
      const block = blockById.get(record.blockType);
      if (block === undefined) continue;
      for (const field of block.fields) {
        const source = record.fields[field.name];
        if (source !== undefined && source.kind === "literal") addFromValue(field, source.value);
      }
    }
  }
  for (const def of opts.globals) {
    for (const field of def.fields) addFromValue(field, def.values[field.name]);
  }
  return ids;
}

// ---------- seed passes ----------

async function seedAdmin(payload: Payload): Promise<void> {
  const email = process.env.PAYLOAD_ADMIN_EMAIL;
  const password = process.env.PAYLOAD_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("PAYLOAD_ADMIN_EMAIL / PAYLOAD_ADMIN_PASSWORD must be set (.env)");
  const existing = await payload.find({ collection: "users", where: { email: { equals: email } }, limit: 1 });
  if (existing.docs.length === 0) {
    await payload.create({
      collection: "users",
      data: { email, password, name: "Admin", role: "admin" },
      context: SEED_CONTEXT,
    });
  }
}

const altFor = (asset: AssetRecord): string => {
  if (asset.alt !== undefined && asset.alt !== "") return asset.alt;
  const fileName = path.basename(asset.storePath ?? asset.canonicalUrl).replace(/\.[a-z0-9]+$/iu, "");
  return fileName.replace(/[-_]+/gu, " ").trim() || asset.assetId;
};

async function seedMedia(
  payload: Payload,
  assets: AssetRecord[],
  referenced: Set<string>,
  locale: Locale,
): Promise<{ count: number; ids: Map<string, string | number> }> {
  let count = 0;
  const ids = new Map<string, string | number>();
  const byId = new Map(assets.map((asset) => [asset.assetId, asset]));
  for (const assetId of [...referenced].sort()) {
    const asset = byId.get(assetId);
    if (asset === undefined) {
      warn(`referenced asset ${assetId} is not in assets.json`);
      continue;
    }
    if (asset.status !== "downloaded" || asset.storePath === undefined) {
      warn(`asset ${assetId} (${asset.canonicalUrl}) was not downloaded — media doc skipped`);
      continue;
    }
    const filename = path.basename(asset.storePath);
    const existing = await payload.find({
      collection: "media",
      where: { filename: { equals: filename } },
      limit: 1,
      locale,
    });
    const found = existing.docs[0];
    if (found !== undefined) {
      ids.set(assetId, found.id);
      continue;
    }
    const created = await payload.create({
      collection: "media",
      data: { alt: altFor(asset) },
      filePath: path.resolve(SNAPSHOT_DIR, asset.storePath),
      locale,
      context: SEED_CONTEXT,
    });
    ids.set(assetId, created.id);
    count += 1;
  }
  return { count, ids };
}

// A relationship write deferred to pass 2, once every item has a doc id.
interface PendingRefs {
  collection: string;
  docId: string | number;
  fields: FieldDef[];
  record: Record<string, unknown>;
}

// Items carry no custom id — Payload owns the doc id — so a re-run recognises an item by the slug
// its detail route is built on, and pass 1 records the doc id each migration key resolved to.
async function seedItemsPass1(
  payload: Payload,
  collections: CollectionDef[],
  contentByCollection: Map<string, Record<string, unknown>[]>,
  docIds: Map<string, string | number>,
  ctx: SeedCtx,
  locale: Locale,
): Promise<PendingRefs[]> {
  const pending: PendingRefs[] = [];
  for (const collection of collections) {
    const records = contentByCollection.get(collection.key) ?? [];
    const { plain, refs } = partitionFields(collection.fields);
    const slugField = collection.pageBinding.slugField;
    const slug = slugOf(collection.key);
    for (const record of records) {
      const migrationId = String(record["id"]);
      const slugValue = record[slugField];
      if (typeof slugValue !== "string" || slugValue === "") {
        warn(`${collection.key} item ${migrationId} has no "${slugField}" value — skipped`);
        continue;
      }
      const data = payloadDataForFields(plain, record, ctx);
      const existing = await payload.find({
        collection: slug as never,
        where: { [slugField]: { equals: slugValue } },
        limit: 1,
        locale,
      });
      const found = existing.docs[0];
      const saved =
        found === undefined
          ? await payload.create({ collection: slug as never, data: data as never, locale, context: SEED_CONTEXT })
          : await payload.update({
              collection: slug as never,
              id: found.id,
              data: data as never,
              locale,
              context: SEED_CONTEXT,
            });
      docIds.set(`${collection.key}:${migrationId}`, saved.id);
      if (refs.length > 0) pending.push({ collection: slug, docId: saved.id, fields: refs, record });
    }
  }
  return pending;
}

async function seedItemRefsPass2(payload: Payload, pending: PendingRefs[], ctx: SeedCtx, locale: Locale): Promise<void> {
  for (const entry of pending) {
    const data = payloadDataForFields(entry.fields, entry.record, ctx);
    if (Object.keys(data).length === 0) continue;
    await payload.update({
      collection: entry.collection as never,
      id: entry.docId,
      data: data as never,
      locale,
      context: SEED_CONTEXT,
    });
  }
}

interface ChromeDoc {
  id: string | number;
}

async function seedChrome(
  payload: Payload,
  globals: GlobalDef[],
  ctx: SeedCtx,
  locale: Locale,
): Promise<Map<string, string | number>> {
  const ids = new Map<string, string | number>();
  for (const def of globals) {
    const data = {
      name: def.name.charAt(0).toUpperCase() + def.name.slice(1),
      ...payloadDataForFields(def.fields, def.values, ctx),
    };
    const existing = (await payload.find({ collection: def.name as never, limit: 1, locale })) as unknown as {
      docs: ChromeDoc[];
    };
    const doc = existing.docs[0];
    const saved = (doc === undefined
      ? await payload.create({ collection: def.name as never, data: data as never, locale, context: SEED_CONTEXT })
      : await payload.update({
          collection: def.name as never,
          id: doc.id,
          data: data as never,
          locale,
          context: SEED_CONTEXT,
        })) as unknown as ChromeDoc;
    ids.set(def.name, saved.id);
  }
  return ids;
}

// Mirrors the frontend's own page lookup (dal/getPageBySlug): the nested-docs plugin makes the
// slug ambiguous across branches, so the last breadcrumb url is what identifies a page.
async function findPageIdByPath(
  payload: Payload,
  node: PageNode,
  locale: Locale,
): Promise<string | number | undefined> {
  const candidates = await payload.find({
    collection: "page",
    where: { slug: { equals: node.slug } },
    limit: 100,
    locale,
    overrideAccess: true,
  });
  const targetUrl = `/${node.path}`;
  return candidates.docs.find((doc) => doc.breadcrumbs?.at(-1)?.url === targetUrl)?.id;
}

async function seedPageTree(
  payload: Payload,
  nodes: PageNode[],
  layoutByRoute: Map<string, LayoutRecord[]>,
  blocks: BlockDef[],
  chromeIds: Map<string, string | number>,
  ctx: SeedCtx,
  locale: Locale,
): Promise<number> {
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const idByPath = new Map<string, string | number>();
  const headerId = chromeIds.get("header");
  const footerId = chromeIds.get("footer");
  let count = 0;

  for (const node of nodes) {
    const records = node.route === null ? [] : (layoutByRoute.get(node.route) ?? []);
    const blocksData = [...records]
      .sort((a, b) => a.order - b.order)
      .map((record) => {
        const block = blockById.get(record.blockType);
        if (block === undefined) {
          throw new Error(`layout ${String(node.route)}: unknown blockType "${record.blockType}"`);
        }
        return { blockType: record.blockType, ...payloadDataForFields(block.fields, literalOnly(record.fields), ctx) };
      });

    const parentId = node.parentPath === null ? undefined : idByPath.get(node.parentPath);
    // `blocks` is required and Payload enforces required fields only on publish, so a node
    // publishes only with both a captured route and blocks to show. A container, or a route
    // whose layout artifact never arrived, stays a recoverable draft instead of aborting the
    // whole seed on a validation error.
    const data: PageSeedData = {
      title: node.title,
      slug: node.slug,
      blocks: blocksData,
      _status: node.route !== null && blocksData.length > 0 ? "published" : "draft",
      ...(parentId === undefined ? {} : { parent: parentId }),
      ...(headerId === undefined ? {} : { header: headerId }),
      ...(footerId === undefined ? {} : { footer: footerId }),
      ...(node.metaTitle === null && node.metaDescription === null
        ? {}
        : { meta: { title: node.metaTitle ?? node.title, description: node.metaDescription ?? "" } }),
    };

    // One widening at the boundary rather than two blanket casts on the literal: `blocks` is a
    // discriminated union over the migrated block configs in the generated Page type, and this
    // seed assembles it from blocks.json at runtime, so nothing typed ahead of generate:types
    // can describe it. PageSeedData types every other field, so a wrong-shaped page payload is
    // a compile error again.
    const pageData = data as never;

    const existingId = await findPageIdByPath(payload, node, locale);
    const saved =
      existingId === undefined
        ? await payload.create({ collection: "page", data: pageData, locale, context: SEED_CONTEXT })
        : await payload.update({
            collection: "page",
            id: existingId,
            data: pageData,
            locale,
            context: SEED_CONTEXT,
          });

    idByPath.set(node.path, saved.id);
    if (node.route !== null) count += 1;
  }

  return count;
}

// ---------- main ----------

async function main(): Promise<void> {
  const payload = await getPayload({ config });
  const resolvedConfig = await config;
  const editorConfig = await editorConfigFactory.default({ config: resolvedConfig });

  const collections =
    ((await readEnvelope<{ collections: CollectionDef[] }>("collections.json")) ?? { collections: [] }).collections;
  const blocks = ((await readEnvelope<{ blocks: BlockDef[] }>("blocks.json")) ?? { blocks: [] }).blocks;
  const globals = ((await readEnvelope<{ globals: GlobalDef[] }>("globals.json")) ?? { globals: [] }).globals;
  const assets = ((await readEnvelope<{ assets: AssetRecord[] }>("assets.json")) ?? { assets: [] }).assets;

  const { localeCode, nodes } = JSON.parse(
    await readFile(path.join(ARTIFACTS_DIR, "generate", "page-tree.json"), "utf8"),
  ) as { localeCode: string; nodes: PageNode[] };
  const locale = resolveLocale(localeCode);

  const urlToAssetId = new Map(assets.map((asset) => [asset.canonicalUrl, asset.assetId]));
  const resolveAssetId = (url: string): string | undefined => urlToAssetId.get(url);

  const contentByCollection = new Map<string, Record<string, unknown>[]>();
  for (const collection of collections) {
    contentByCollection.set(collection.key, collection.items);
  }

  const layoutFiles: { route: string; records: LayoutRecord[] }[] = [];
  const routesDir = path.join(ARTIFACTS_DIR, "layout", "routes");
  let routeFiles: string[] = [];
  try {
    routeFiles = (await readdir(routesDir, { recursive: true })).filter((file) => String(file).endsWith(".ndjson"));
  } catch {
    warn("layout/routes is missing — no pages seeded");
  }
  for (const file of routeFiles) {
    const parsed = parseNdjson(await readFile(path.join(routesDir, String(file)), "utf8"));
    const route = typeof parsed.meta["route"] === "string" ? (parsed.meta["route"] as string) : undefined;
    if (route === undefined) {
      warn(`layout/routes/${String(file)}: meta has no route — skipped`);
      continue;
    }
    layoutFiles.push({ route, records: parsed.records as unknown as LayoutRecord[] });
  }
  const layoutByRoute = new Map(layoutFiles.map((file) => [file.route, file.records]));

  await seedAdmin(payload);
  const referenced = referencedAssetIds({
    collections,
    contentByCollection,
    blocks,
    layoutFiles,
    globals,
    resolveAssetId,
  });
  const media = await seedMedia(payload, assets, referenced, locale);
  // Filled by pass 1 and read by every later pass, so a relationship anywhere — an item, a block
  // literal, a chrome doc — resolves to the doc id its target item was seeded with.
  const docIds = new Map<string, string | number>();
  const ctx: SeedCtx = {
    htmlToLexical: (html) => convertHTMLToLexical({ editorConfig, html, JSDOM }),
    resolveAssetId,
    mediaIdFor: (assetId) => media.ids.get(assetId),
    docIdFor: (collectionKey, migrationId) => docIds.get(`${collectionKey}:${migrationId}`),
    warn,
  };
  const pending = await seedItemsPass1(payload, collections, contentByCollection, docIds, ctx, locale);
  await seedItemRefsPass2(payload, pending, ctx, locale);
  const chromeIds = await seedChrome(payload, globals, ctx, locale);
  const pagesCount = await seedPageTree(payload, nodes, layoutByRoute, blocks, chromeIds, ctx, locale);

  const summary = {
    media: media.count,
    items: Object.fromEntries([...contentByCollection.entries()].map(([key, records]) => [key, records.length])),
    pages: pagesCount,
    chrome: [...chromeIds.keys()],
    warnings,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

try {
  await main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
