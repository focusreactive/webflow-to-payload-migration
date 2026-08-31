import { z } from "zod";

export const migrateConfigSchema = z.strictObject({
  $schema: z.string().optional(),
  workspace: z.strictObject({ path: z.string() }).default({ path: "../migrations" }),
});

export type MigrateConfig = z.infer<typeof migrateConfigSchema>;
