/* Migration seed (generated). Run once from the deliverable root:
 *   pnpm seed
 * Reads the migration IR from .migration/ (the tool's Tier-1 working dir),
 * so it is an OPERATOR step — a cloned repo without .migration/ cannot re-run
 * it (structural regeneration uses migration/ir instead).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import config from "@payload-config";
import { convertHTMLToLexical, editorConfigFactory } from "@payloadcms/richtext-lexical";
import { JSDOM } from "jsdom";
import { getPayload, type Payload } from "payload";

import { collectionSlugs } from "../lib/collection-slugs";
import type { FieldDef } from "../lib/normalize-values";
import {
  assertValidCustomId,
  collectAssetIdsFromValue,
  collectImgUrls,
  omitFields,
  pageSlugForRoute,
  pageTitleForRoute,
  parseNdjson,
  payloadDataForFields,
  refFieldNames,
  type SeedCtx,
} from "./transform";

const ARTIFACTS_DIR = path.join(".migration", "artifacts");
const SNAPSHOT_DIR = path.join(".migration", "snapshot");

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
    await payload.create({ collection: "users", data: { email, password } });
  }
}

async function seedMedia(payload: Payload, assets: AssetRecord[], referenced: Set<string>): Promise<number> {
  let count = 0;
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
    assertValidCustomId(assetId, "media asset");
    const exists = await payload.findByID({ collection: "media", id: assetId }).catch(() => null);
    if (exists !== null) continue;
    await payload.create({
      collection: "media",
      data: { id: assetId, alt: asset.alt ?? "" },
      filePath: path.resolve(SNAPSHOT_DIR, asset.storePath),
    });
    count += 1;
  }
  return count;
}

async function seedItemsPass1(
  payload: Payload,
  collections: CollectionDef[],
  contentByCollection: Map<string, Record<string, unknown>[]>,
  ctx: SeedCtx,
): Promise<Map<string, { collection: string; id: string; refs: Record<string, unknown> }>> {
  const pass2 = new Map<string, { collection: string; id: string; refs: Record<string, unknown> }>();
  for (const collection of collections) {
    const records = contentByCollection.get(collection.key) ?? [];
    const refNames = refFieldNames(collection.fields);
    for (const record of records) {
      const id = String(record["id"]);
      assertValidCustomId(id, `${collection.key} item`);
      const data = payloadDataForFields(collection.fields, record, ctx);
      const refs = Object.fromEntries(Object.entries(data).filter(([name]) => refNames.includes(name)));
      const plain = { id, ...omitFields(data, refNames) };
      const slug = slugOf(collection.key);
      const exists = await payload.findByID({ collection: slug as never, id }).catch(() => null);
      if (exists === null) {
        await payload.create({ collection: slug as never, data: plain as never });
      } else {
        await payload.update({ collection: slug as never, id, data: omitFields(plain, ["id"]) as never });
      }
      if (Object.keys(refs).length > 0) {
        pass2.set(`${collection.key}:${id}`, { collection: slug, id, refs });
      }
    }
  }
  return pass2;
}

async function seedItemRefsPass2(
  payload: Payload,
  pass2: Map<string, { collection: string; id: string; refs: Record<string, unknown> }>,
): Promise<void> {
  for (const entry of pass2.values()) {
    await payload.update({ collection: entry.collection as never, id: entry.id, data: entry.refs as never });
  }
}

async function seedPages(
  payload: Payload,
  layoutFiles: { route: string; records: LayoutRecord[] }[],
  blocks: BlockDef[],
  ctx: SeedCtx,
): Promise<number> {
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  let count = 0;
  for (const file of layoutFiles.sort((a, b) => a.route.localeCompare(b.route))) {
    const layout = [...file.records]
      .sort((a, b) => a.order - b.order)
      .map((record) => {
        const block = blockById.get(record.blockType);
        if (block === undefined) throw new Error(`layout ${file.route}: unknown blockType "${record.blockType}"`);
        const values = literalOnly(record.fields);
        return { blockType: record.blockType, ...payloadDataForFields(block.fields, values, ctx) };
      });
    const slug = pageSlugForRoute(file.route);
    const data = { title: pageTitleForRoute(file.route), slug, layout };
    const existing = await payload.find({ collection: "pages", where: { slug: { equals: slug } }, limit: 1 });
    const doc = existing.docs[0];
    if (doc === undefined) {
      await payload.create({ collection: "pages", data: data as never });
    } else {
      await payload.update({ collection: "pages", id: doc.id, data: data as never });
    }
    count += 1;
  }
  return count;
}

async function seedGlobals(payload: Payload, globals: GlobalDef[], ctx: SeedCtx): Promise<string[]> {
  const seeded: string[] = [];
  for (const def of globals) {
    const data = payloadDataForFields(def.fields, def.values, ctx);
    await payload.updateGlobal({ slug: def.name as never, data: data as never });
    seeded.push(def.name);
  }
  return seeded;
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

  const urlToAssetId = new Map(assets.map((asset) => [asset.canonicalUrl, asset.assetId]));
  const resolveAssetId = (url: string): string | undefined => urlToAssetId.get(url);
  // Media docs and migrated items both carry the migration id as their custom text id
  // (see collections/Media.ts.tpl and emitCmsCollectionFile), so resolving a reference to a
  // doc id is the identity — there is no separate id map to keep.
  const ctx: SeedCtx = {
    htmlToLexical: (html) => convertHTMLToLexical({ editorConfig, html, JSDOM }),
    resolveAssetId,
    mediaIdFor: (assetId) => assetId,
    docIdFor: (_collectionKey, migrationId) => migrationId,
    warn,
  };

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

  await seedAdmin(payload);
  const referenced = referencedAssetIds({
    collections,
    contentByCollection,
    blocks,
    layoutFiles,
    globals,
    resolveAssetId,
  });
  const mediaCount = await seedMedia(payload, assets, referenced);
  const pass2 = await seedItemsPass1(payload, collections, contentByCollection, ctx);
  await seedItemRefsPass2(payload, pass2);
  const pagesCount = await seedPages(payload, layoutFiles, blocks, ctx);
  const seededGlobals = await seedGlobals(payload, globals, ctx);

  const summary = {
    media: mediaCount,
    items: Object.fromEntries([...contentByCollection.entries()].map(([key, records]) => [key, records.length])),
    pages: pagesCount,
    globals: seededGlobals,
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
