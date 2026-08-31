import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { emitBlockConfig } from "#blocks/codegen/config.ts";
import { emitBlockProps } from "#blocks/codegen/props.ts";
import { artifactPath, readArtifact, writeArtifact } from "#ir/artifact.ts";
import { blocksArtifact, blockTypeSchema, type BlockField } from "#ir/blocks.ts";
import { collectionsArtifact } from "#ir/collections.ts";
import { discoveryBlocksArtifact, type DiscoveryBlocksData } from "#ir/discovery.ts";
import type { IngestField } from "#ir/field-value.ts";
import { recordArtifact } from "#lib/manifest/index.ts";
import { entityDirsFor, readShardJson, synthEntryDir } from "#lib/synth-store/paths.ts";

import { SYNTH_BLOCKS_STEP_ID } from "../constants/ids.ts";
import { contentShardPath, responsePath, schemaShardPath } from "../constants/paths.ts";
import { blockContentResponseSchema } from "../schemas/content-response.ts";
import { blockFieldsResponseSchema, type BlockFieldsResponse } from "../schemas/fields-response.ts";
import type { AcceptOutcome, EntityAddress, Exemplar, FoldResult, RosterEntity, SynthVertical } from "../types.ts";

import { duplicateNameErrors } from "./utils/duplicate-name-errors.ts";
import { foldBlocks, type BlockShard } from "./utils/fold-blocks.ts";

const VERTICAL = "blocks" as const;

export interface BlockSchemaShard {
  name: string;
  fields: BlockField[];
  collectionKey?: string;
}

export interface BlockContentShard {
  literals: Record<string, unknown>;
}

async function readDiscovery(projectPath: string): Promise<DiscoveryBlocksData> {
  return (await readArtifact(projectPath, discoveryBlocksArtifact)).data;
}

async function knownCollectionKeys(projectPath: string): Promise<string[]> {
  const collections = (await readArtifact(projectPath, collectionsArtifact)).data;
  return collections.collections.map((collection) => String(collection.key));
}

async function collectionKeysIfFolded(projectPath: string): Promise<string[]> {
  try {
    return await knownCollectionKeys(projectPath);
  } catch {
    return [];
  }
}

function readSchemaShard(projectPath: string, key: string): Promise<BlockSchemaShard> {
  return readShardJson<BlockSchemaShard>(schemaShardPath(projectPath, VERTICAL, key));
}

export const blocksVertical: SynthVertical = {
  id: VERTICAL,
  entityFlag: "block",
  stepId: SYNTH_BLOCKS_STEP_ID,
  sectioned: false,

  async roster(projectPath: string): Promise<RosterEntity[]> {
    return (await readDiscovery(projectPath)).types.map((type) => ({ key: String(type.id), sections: [] }));
  },

  surfaceKey(address: EntityAddress): string {
    return address.key;
  },

  surfaceDir(projectPath: string, address: EntityAddress): string {
    return synthEntryDir(projectPath, VERTICAL, address.key);
  },

  async exemplar(projectPath: string, address: EntityAddress): Promise<Exemplar> {
    const type = (await readDiscovery(projectPath)).types.find((entry) => String(entry.id) === address.key);
    if (type === undefined) throw new Error(`unknown block type: ${address.key}`);
    return type.exemplar;
  },

  fieldsResponseSchema() {
    return Promise.resolve(blockFieldsResponseSchema);
  },

  async fieldsSubject(projectPath: string, address: EntityAddress): Promise<unknown> {
    const type = (await readDiscovery(projectPath)).types.find((entry) => String(entry.id) === address.key);
    if (type === undefined) throw new Error(`unknown block type: ${address.key}`);
    return {
      typeId: address.key,
      name: type.name,
      role: type.role,
      exemplar: type.exemplar,
      ...(type.collectionKey !== undefined ? { collectionKey: String(type.collectionKey) } : {}),
      collectionKeys: await collectionKeysIfFolded(projectPath),
      responsePath: responsePath(projectPath, VERTICAL, address.key, "fields"),
    };
  },

  acceptFields(_projectPath: string, address: EntityAddress, response: unknown): Promise<AcceptOutcome<unknown>> {
    const data = response as BlockFieldsResponse;
    const errors = duplicateNameErrors(data.fields, `block "${address.key}"`);
    if (errors.length > 0) return Promise.resolve({ ok: false, errors });

    const shard: BlockSchemaShard = {
      name: data.name,
      fields: data.fields,
      ...(data.collectionKey !== undefined ? { collectionKey: data.collectionKey } : {}),
    };
    return Promise.resolve({ ok: true, shard });
  },

  async emitCodegen(projectPath: string, address: EntityAddress, shard: unknown): Promise<void> {
    const schema = shard as BlockSchemaShard;
    const blockForCodegen = blockTypeSchema.parse({
      id: address.key,
      name: schema.name,
      fields: schema.fields,
      ...(schema.collectionKey !== undefined ? { collectionKey: schema.collectionKey } : {}),
      content: {},
    });
    const dir = synthEntryDir(projectPath, VERTICAL, address.key);
    await writeFile(join(dir, "config.ts"), emitBlockConfig(blockForCodegen));
    await writeFile(join(dir, "props.ts"), emitBlockProps(blockForCodegen));
  },

  async contentResponseSchema(projectPath: string, key: string) {
    return blockContentResponseSchema((await readSchemaShard(projectPath, key)).fields);
  },

  async contentSubject(projectPath: string, key: string): Promise<unknown> {
    const schema = await readSchemaShard(projectPath, key);
    const type = (await readDiscovery(projectPath)).types.find((entry) => String(entry.id) === key);
    return {
      typeId: key,
      name: schema.name,
      fields: schema.fields,
      ...(schema.collectionKey !== undefined ? { collectionKey: schema.collectionKey } : {}),
      exemplar: type?.exemplar ?? { route: "", nodeIds: [] },
      responsePath: responsePath(projectPath, VERTICAL, key, "content"),
    };
  },

  acceptContent(_projectPath: string, _key: string, response: unknown): Promise<AcceptOutcome<unknown>> {
    const { literals } = response as BlockContentShard;
    return Promise.resolve({ ok: true, shard: { literals } });
  },

  async surfaceFields(projectPath: string, address: EntityAddress): Promise<IngestField[]> {
    return (await readSchemaShard(projectPath, address.key)).fields;
  },

  async surfaceLiterals(projectPath: string, address: EntityAddress): Promise<Record<string, unknown>> {
    return (await readShardJson<BlockContentShard>(contentShardPath(projectPath, VERTICAL, address.key))).literals;
  },

  async fold(projectPath: string): Promise<FoldResult> {
    const shards: BlockShard[] = [];
    for (const key of entityDirsFor(projectPath, VERTICAL).sort()) {
      shards.push({
        key,
        schema: await readSchemaShard(projectPath, key),
        content: await readShardJson<BlockContentShard>(contentShardPath(projectPath, VERTICAL, key)),
      });
    }
    const data = foldBlocks(shards, await knownCollectionKeys(projectPath));
    await writeArtifact(projectPath, blocksArtifact, { provenance: "ai", data });
    await recordArtifact(
      projectPath,
      SYNTH_BLOCKS_STEP_ID,
      blocksArtifact.kind,
      artifactPath(projectPath, blocksArtifact),
    );
    return { count: data.blocks.length };
  },
};
