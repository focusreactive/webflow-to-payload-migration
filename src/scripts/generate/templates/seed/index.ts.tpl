import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import config from "@payload-config";
import { convertHTMLToLexical, editorConfigFactory } from "@payloadcms/richtext-lexical";
import { JSDOM } from "jsdom";
import { getPayload, type Payload } from "payload";

import { collectionSlugs } from "../lib/collection-slugs";
import type { FieldDef } from "../lib/normalize-values";
import {
  collectAssetIdsFromValue,
  collectImgUrls,
  pageSlugForRoute,
  pageTitleForRoute,
  parseNdjson,
  partitionFields,
  payloadDataForFields,
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

async function seedAdmin(payload: Payload): Promise<void> {
  const email = process.env.PAYLOAD_ADMIN_EMAIL;
  const password = process.env.PAYLOAD_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("PAYLOAD_ADMIN_EMAIL / PAYLOAD_ADMIN_PASSWORD must be set (.env)");
  const existing = await payload.find({ collection: "users", where: { email: { equals: email } }, limit: 1 });
  if (existing.docs.length === 0) {
    await payload.create({ collection: "users", data: { email, password } });
  }
}

async function seedMedia(
  payload: Payload,
  assets: AssetRecord[],
  referenced: Set<string>,
  ids: Map<string, string | number>,
): Promise<number> {
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
    const filename = path.basename(asset.storePath);
    const existing = await payload.find({ collection: "media", where: { filename: { equals: filename } }, limit: 1 });
    const found = existing.docs[0];
    if (found !== undefined) {
      ids.set(assetId, found.id);
      continue;
    }
    const created = await payload.create({
      collection: "media",
      data: { alt: asset.alt ?? "" },
      filePath: path.resolve(SNAPSHOT_DIR, asset.storePath),
    });
    ids.set(assetId, created.id);
    count += 1;
  }
  return count;
}

interface PendingRefs {
  collection: string;
  docId: string | number;
  fields: FieldDef[];
  record: Record<string, unknown>;
}

async function seedItemsPass1(
  payload: Payload,
  collections: CollectionDef[],
  contentByCollection: Map<string, Record<string, unknown>[]>,
  docIds: Map<string, string | number>,
  ctx: SeedCtx,
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
      });
      const found = existing.docs[0] as { id: string | number } | undefined;
      const saved = (
        found === undefined
          ? await payload.create({ collection: slug as never, data: data as never })
          : await payload.update({ collection: slug as never, id: found.id, data: data as never })
      ) as { id: string | number };
      docIds.set(`${collection.key}:${migrationId}`, saved.id);
      if (refs.length > 0) pending.push({ collection: slug, docId: saved.id, fields: refs, record });
    }
  }
  return pending;
}

async function seedItemRefsPass2(payload: Payload, pending: PendingRefs[], ctx: SeedCtx): Promise<void> {
  for (const entry of pending) {
    const data = payloadDataForFields(entry.fields, entry.record, ctx);
    if (Object.keys(data).length === 0) continue;
    await payload.update({ collection: entry.collection as never, id: entry.docId, data: data as never });
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
  const mediaIds = new Map<string, string | number>();
  const docIds = new Map<string, string | number>();
  const ctx: SeedCtx = {
    htmlToLexical: (html) => convertHTMLToLexical({ editorConfig, html, JSDOM }),
    resolveAssetId,
    mediaIdFor: (assetId) => mediaIds.get(assetId),
    docIdFor: (collectionKey, migrationId) => docIds.get(`${collectionKey}:${migrationId}`),
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
  const mediaCount = await seedMedia(payload, assets, referenced, mediaIds);
  const pending = await seedItemsPass1(payload, collections, contentByCollection, docIds, ctx);
  await seedItemRefsPass2(payload, pending, ctx);
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
