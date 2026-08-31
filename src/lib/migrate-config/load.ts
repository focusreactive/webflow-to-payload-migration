import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { migrateConfigSchema, type MigrateConfig } from "./schema.ts";
import { toolRootDir } from "./tool-root-dir.ts";

const CONFIG_FILE_NAME = "migrate.config.json";

export function loadMigrateConfig(rootDir: string = toolRootDir()): MigrateConfig {
  const configPath = join(rootDir, CONFIG_FILE_NAME);
  if (!existsSync(configPath)) {
    throw new Error(
      `${CONFIG_FILE_NAME} not found at ${configPath}. `
        + `It is committed to the repository, so a clone missing it is a damaged checkout.`,
    );
  }

  const envPath = join(rootDir, ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);

  const raw: unknown = JSON.parse(readFileSync(configPath, "utf8"));
  return migrateConfigSchema.parse(raw);
}
