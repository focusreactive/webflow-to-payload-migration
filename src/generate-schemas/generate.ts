import { join } from "node:path";

import { z } from "zod";

import { writeFileAtomic } from "#lib/fs.ts";
import { migrateConfigSchema } from "#lib/migrate-config/index.ts";

const JSON_SCHEMA_OPTIONS = { io: "input" } as const;

export function generateSchemaFiles(): Record<string, string> {
  return {
    "migrate.config.schema.json": serialize(z.toJSONSchema(migrateConfigSchema, JSON_SCHEMA_OPTIONS)),
  };
}

export async function writeSchemaFiles(targetDir: string): Promise<void> {
  for (const [relativePath, content] of Object.entries(generateSchemaFiles())) {
    await writeFileAtomic(join(targetDir, relativePath), content);
  }
}

function serialize(schema: unknown): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}
