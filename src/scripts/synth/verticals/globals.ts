import { artifactPath, readArtifact, writeArtifact } from "#ir/artifact.ts";
import { discoveryGlobalsArtifact, type DiscoveryGlobalsData } from "#ir/discovery.ts";
import type { IngestField } from "#ir/field-value.ts";
import { globalsArtifact, type GlobalField } from "#ir/globals.ts";
import { recordArtifact } from "#lib/manifest/index.ts";
import { entityDirsFor, readShardJson, synthEntryDir } from "#lib/synth-store/paths.ts";

import { SYNTH_GLOBALS_STEP_ID } from "../constants/ids.ts";
import { contentShardPath, responsePath, schemaShardPath } from "../constants/paths.ts";
import { globalContentResponseSchema } from "../schemas/content-response.ts";
import { globalFieldsResponseSchema, type GlobalFieldsResponse } from "../schemas/fields-response.ts";
import type { AcceptOutcome, EntityAddress, Exemplar, FoldResult, RosterEntity, SynthVertical } from "../types.ts";

import { duplicateNameErrors } from "./utils/duplicate-name-errors.ts";
import { foldGlobals, type GlobalShard } from "./utils/fold-globals.ts";

const VERTICAL = "globals" as const;

export interface GlobalSchemaShard {
  fields: GlobalField[];
}

export interface GlobalContentShard {
  values: Record<string, unknown>;
}

async function readDiscovery(projectPath: string): Promise<DiscoveryGlobalsData> {
  return (await readArtifact(projectPath, discoveryGlobalsArtifact)).data;
}

function readSchemaShard(projectPath: string, key: string): Promise<GlobalSchemaShard> {
  return readShardJson<GlobalSchemaShard>(schemaShardPath(projectPath, VERTICAL, key));
}

export const globalsVertical: SynthVertical = {
  id: VERTICAL,
  entityFlag: "global",
  stepId: SYNTH_GLOBALS_STEP_ID,
  sectioned: false,

  async roster(projectPath: string): Promise<RosterEntity[]> {
    return (await readDiscovery(projectPath)).types.map((type) => ({ key: type.name, sections: [] }));
  },

  surfaceKey(address: EntityAddress): string {
    return address.key;
  },

  surfaceDir(projectPath: string, address: EntityAddress): string {
    return synthEntryDir(projectPath, VERTICAL, address.key);
  },

  async exemplar(projectPath: string, address: EntityAddress): Promise<Exemplar> {
    const type = (await readDiscovery(projectPath)).types.find((entry) => entry.name === address.key);
    if (type === undefined) throw new Error(`unknown global: ${address.key}`);
    return type.exemplar;
  },

  fieldsResponseSchema() {
    return Promise.resolve(globalFieldsResponseSchema);
  },

  async fieldsSubject(projectPath: string, address: EntityAddress): Promise<unknown> {
    const type = (await readDiscovery(projectPath)).types.find((entry) => entry.name === address.key);
    if (type === undefined) throw new Error(`unknown global: ${address.key}`);
    return {
      name: address.key,
      exemplar: type.exemplar,
      responsePath: responsePath(projectPath, VERTICAL, address.key, "fields"),
    };
  },

  acceptFields(_projectPath: string, address: EntityAddress, response: unknown): Promise<AcceptOutcome<unknown>> {
    const data = response as GlobalFieldsResponse;
    const errors = duplicateNameErrors(data.fields, `global "${address.key}"`);
    if (errors.length > 0) return Promise.resolve({ ok: false, errors });
    return Promise.resolve({ ok: true, shard: { fields: data.fields } satisfies GlobalSchemaShard });
  },

  emitCodegen(): Promise<void> {
    return Promise.resolve();
  },

  async contentResponseSchema(projectPath: string, key: string) {
    return globalContentResponseSchema((await readSchemaShard(projectPath, key)).fields);
  },

  async contentSubject(projectPath: string, key: string): Promise<unknown> {
    const schema = await readSchemaShard(projectPath, key);
    const type = (await readDiscovery(projectPath)).types.find((entry) => entry.name === key);
    return {
      name: key,
      fields: schema.fields,
      exemplar: type?.exemplar ?? { route: "", nodeIds: [] },
      responsePath: responsePath(projectPath, VERTICAL, key, "content"),
    };
  },

  acceptContent(_projectPath: string, _key: string, response: unknown): Promise<AcceptOutcome<unknown>> {
    const { values } = response as GlobalContentShard;
    return Promise.resolve({ ok: true, shard: { values } });
  },

  async surfaceFields(projectPath: string, address: EntityAddress): Promise<IngestField[]> {
    return (await readSchemaShard(projectPath, address.key)).fields;
  },

  async surfaceLiterals(projectPath: string, address: EntityAddress): Promise<Record<string, unknown>> {
    return (await readShardJson<GlobalContentShard>(contentShardPath(projectPath, VERTICAL, address.key))).values;
  },

  async fold(projectPath: string): Promise<FoldResult> {
    const shards: GlobalShard[] = [];
    for (const name of entityDirsFor(projectPath, VERTICAL).sort()) {
      shards.push({
        name,
        schema: await readSchemaShard(projectPath, name),
        content: await readShardJson<GlobalContentShard>(contentShardPath(projectPath, VERTICAL, name)),
      });
    }
    const data = foldGlobals(shards);
    await writeArtifact(projectPath, globalsArtifact, { provenance: "ai", data });
    await recordArtifact(
      projectPath,
      SYNTH_GLOBALS_STEP_ID,
      globalsArtifact.kind,
      artifactPath(projectPath, globalsArtifact),
    );
    return { count: data.globals.length };
  },
};
