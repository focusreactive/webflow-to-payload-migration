import { existsSync } from "node:fs";
import { join } from "node:path";

import { artifactPath, readArtifact, writeArtifact } from "#ir/artifact.ts";
import { collectionsArtifact, validatePageBinding, type PageBinding } from "#ir/collections.ts";
import type { ContentRecord } from "#ir/content.ts";
import { discoveryCollectionsArtifact, type CollectionSection, type DiscoveryCollectionsData } from "#ir/discovery.ts";
import type { IngestField } from "#ir/field-value.ts";
import type { CollectionField } from "#ir/schema.ts";
import { recordArtifact } from "#lib/manifest/index.ts";
import { slugifyId } from "#lib/slug.ts";
import { entityDirsFor, readShardJson, synthEntryDir } from "#lib/synth-store/paths.ts";

import { SYNTH_COLLECTIONS_STEP_ID } from "../constants/ids.ts";
import {
  COMPONENT_FILE,
  contentShardPath,
  responsePath,
  schemaShardPath,
  SCHEMA_SHARD_FILE,
  sectionDir,
  sectionEntityKey,
} from "../constants/paths.ts";
import { collectionContentResponseSchema } from "../schemas/content-response.ts";
import {
  collectionFieldsResponseSchema,
  sectionFieldsResponseSchema,
  type CollectionFieldsResponse,
  type SectionFieldsResponse,
} from "../schemas/fields-response.ts";
import type { AcceptOutcome, EntityAddress, Exemplar, FoldResult, RosterEntity, SynthVertical } from "../types.ts";

import { duplicateNameErrors } from "./utils/duplicate-name-errors.ts";
import { foldCollections, type CollectionShard } from "./utils/fold-collections.ts";

const VERTICAL = "collections" as const;

export interface CollectionSchemaShard {
  label: string;
  fields: CollectionField[];
  pageBinding: PageBinding;
}

export interface CollectionContentShard {
  items: ContentRecord[];
}

export interface SectionSchemaShard {
  itemFields: string[];
}

async function readDiscovery(projectPath: string): Promise<DiscoveryCollectionsData> {
  return (await readArtifact(projectPath, discoveryCollectionsArtifact)).data;
}

function readSchemaShard(projectPath: string, key: string): Promise<CollectionSchemaShard> {
  return readShardJson<CollectionSchemaShard>(schemaShardPath(projectPath, VERTICAL, key));
}

function sectionSchemaPath(projectPath: string, key: string, sectionId: string): string {
  return join(sectionDir(projectPath, key, sectionId), SCHEMA_SHARD_FILE);
}

function readSectionSchemaShard(projectPath: string, key: string, sectionId: string): Promise<SectionSchemaShard> {
  return readShardJson<SectionSchemaShard>(sectionSchemaPath(projectPath, key, sectionId));
}

function sectionOf(discovery: DiscoveryCollectionsData, key: string, sectionId: string): CollectionSection {
  const type = discovery.types.find((entry) => String(entry.collectionKey) === key);
  if (type === undefined) throw new Error(`unknown collection: ${key}`);
  const section = type.sections.find((candidate) => candidate.id === sectionId);
  if (section === undefined) throw new Error(`unknown section: ${key}/${sectionId}`);
  return section;
}

function itemFieldsOf(schema: CollectionSchemaShard, section: SectionSchemaShard): CollectionField[] {
  return schema.fields.filter((field) => section.itemFields.includes(field.name));
}

export const collectionsVertical: SynthVertical = {
  id: VERTICAL,
  entityFlag: "collection",
  stepId: SYNTH_COLLECTIONS_STEP_ID,
  sectioned: true,

  async roster(projectPath: string): Promise<RosterEntity[]> {
    return (await readDiscovery(projectPath)).types.map((type) => ({
      key: String(type.collectionKey),
      sections: type.sections.map((section) => section.id),
    }));
  },

  surfaceKey(address: EntityAddress): string {
    return address.section === undefined ? address.key : sectionEntityKey(address.key, address.section);
  },

  surfaceDir(projectPath: string, address: EntityAddress): string {
    return address.section === undefined ?
        synthEntryDir(projectPath, VERTICAL, address.key)
      : sectionDir(projectPath, address.key, address.section);
  },

  async exemplar(projectPath: string, address: EntityAddress): Promise<Exemplar> {
    const discovery = await readDiscovery(projectPath);
    const type = discovery.types.find((entry) => String(entry.collectionKey) === address.key);
    if (type === undefined) throw new Error(`unknown collection: ${address.key}`);
    if (address.section === undefined) return { route: type.representativeItem.route, nodeIds: [] };
    return {
      route: type.representativeItem.route,
      nodeIds: sectionOf(discovery, address.key, address.section).nodeIds,
    };
  },

  fieldsResponseSchema(_projectPath: string, address: EntityAddress) {
    return Promise.resolve(
      address.section === undefined ? collectionFieldsResponseSchema : sectionFieldsResponseSchema,
    );
  },

  async fieldsSubject(projectPath: string, address: EntityAddress): Promise<unknown> {
    const discovery = await readDiscovery(projectPath);
    if (address.section === undefined) {
      const type = discovery.types.find((entry) => String(entry.collectionKey) === address.key);
      if (type === undefined) throw new Error(`unknown collection: ${address.key}`);
      return {
        collectionKey: address.key,
        representativeItem: type.representativeItem,
        sections: type.sections.map((section) => ({ id: section.id, role: section.role, summary: section.summary })),
        responsePath: responsePath(projectPath, VERTICAL, address.key, "fields"),
      };
    }
    const section = sectionOf(discovery, address.key, address.section);
    const schema = await readSchemaShard(projectPath, address.key);
    return {
      collectionKey: address.key,
      sectionId: section.id,
      role: section.role,
      summary: section.summary,
      collectionFields: schema.fields,
      responsePath: responsePath(projectPath, VERTICAL, sectionEntityKey(address.key, section.id), "fields"),
    };
  },

  async acceptFields(projectPath: string, address: EntityAddress, response: unknown): Promise<AcceptOutcome<unknown>> {
    if (address.section === undefined) {
      const data = response as CollectionFieldsResponse;
      const errors = duplicateNameErrors(data.fields, `collection "${address.key}"`);
      for (const message of validatePageBinding({ fields: data.fields, pageBinding: data.pageBinding })) {
        errors.push({
          code: "PAGE_BINDING",
          where: "pageBinding",
          detail: message,
          fix: "Bind the page to fields the response actually declares.",
        });
      }
      if (errors.length > 0) return { ok: false, errors };
      return {
        ok: true,
        shard: {
          label: data.label,
          fields: data.fields,
          pageBinding: data.pageBinding,
        } satisfies CollectionSchemaShard,
      };
    }

    const data = response as SectionFieldsResponse;
    const known = new Set((await readSchemaShard(projectPath, address.key)).fields.map((field) => field.name));
    const errors = data.itemFields
      .filter((name) => !known.has(name))
      .map((name) => ({
        code: "UNKNOWN_ITEM_FIELD",
        where: "itemFields",
        got: name,
        detail: `collection "${address.key}" has no field with this name`,
        fix: "List only field names the collection schema declares.",
      }));
    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, shard: { itemFields: data.itemFields } satisfies SectionSchemaShard };
  },

  emitCodegen(): Promise<void> {
    return Promise.resolve();
  },

  async contentResponseSchema(projectPath: string, key: string) {
    return collectionContentResponseSchema((await readSchemaShard(projectPath, key)).fields);
  },

  async contentSubject(projectPath: string, key: string): Promise<unknown> {
    const schema = await readSchemaShard(projectPath, key);
    const type = (await readDiscovery(projectPath)).types.find((entry) => String(entry.collectionKey) === key);
    return {
      collectionKey: key,
      label: schema.label,
      slugField: schema.pageBinding.slugField,
      fields: schema.fields,
      representativeItem: type?.representativeItem ?? { route: "" },
      responsePath: responsePath(projectPath, VERTICAL, key, "content"),
    };
  },

  async acceptContent(projectPath: string, key: string, response: unknown): Promise<AcceptOutcome<unknown>> {
    const { slugField } = (await readSchemaShard(projectPath, key)).pageBinding;
    const { items } = response as { items: Record<string, unknown>[] };
    const shard: CollectionContentShard = {
      items: items.map((item) => ({
        ...item,
        id: slugifyId(String(item[slugField])),
        _provenance: "ai" as const,
      })),
    };
    return { ok: true, shard };
  },

  async surfaceFields(projectPath: string, address: EntityAddress): Promise<IngestField[]> {
    const schema = await readSchemaShard(projectPath, address.key);
    if (address.section === undefined) return schema.fields;
    return itemFieldsOf(schema, await readSectionSchemaShard(projectPath, address.key, address.section));
  },

  async surfaceLiterals(projectPath: string, address: EntityAddress): Promise<Record<string, unknown>> {
    const content = await readShardJson<CollectionContentShard>(contentShardPath(projectPath, VERTICAL, address.key));
    const item = (content.items[0] ?? {}) as Record<string, unknown>;
    if (address.section === undefined) return item;
    const section = await readSectionSchemaShard(projectPath, address.key, address.section);
    return Object.fromEntries(section.itemFields.filter((name) => name in item).map((name) => [name, item[name]]));
  },

  async fold(projectPath: string): Promise<FoldResult> {
    const discovery = await readDiscovery(projectPath);
    const shards: CollectionShard[] = [];
    for (const key of entityDirsFor(projectPath, VERTICAL).sort()) {
      const type = discovery.types.find((entry) => String(entry.collectionKey) === key);
      const template = [];
      for (const section of type?.sections ?? []) {
        const schemaPath = sectionSchemaPath(projectPath, key, section.id);
        if (!existsSync(schemaPath)) {
          throw new Error(`collection "${key}": section "${section.id}" has no schema.json — accept its fields first`);
        }
        if (!existsSync(join(sectionDir(projectPath, key, section.id), COMPONENT_FILE))) {
          throw new Error(`collection "${key}": section "${section.id}" has no ${COMPONENT_FILE} — verify it first`);
        }
        template.push({
          sectionId: section.id,
          itemFields: (await readSectionSchemaShard(projectPath, key, section.id)).itemFields,
        });
      }
      shards.push({
        key,
        schema: await readSchemaShard(projectPath, key),
        content: await readShardJson<CollectionContentShard>(contentShardPath(projectPath, VERTICAL, key)),
        template,
      });
    }
    const data = foldCollections(shards);
    await writeArtifact(projectPath, collectionsArtifact, { provenance: "ai", data });
    await recordArtifact(
      projectPath,
      SYNTH_COLLECTIONS_STEP_ID,
      collectionsArtifact.kind,
      artifactPath(projectPath, collectionsArtifact),
    );
    return { count: data.collections.length };
  },
};
