import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { writeFileAtomic } from "#lib/fs.ts";

export async function writeAppEnv(opts: { projectPath: string; projectName: string }): Promise<void> {
  const envPath = join(opts.projectPath, ".env");
  if (existsSync(envPath)) return;

  const lines = [
    "DATABASE_URI=file:./payload.db",
    `PAYLOAD_SECRET=${randomBytes(32).toString("hex")}`,
    "PAYLOAD_ADMIN_EMAIL=admin@example.com",
    `PAYLOAD_ADMIN_PASSWORD=${randomBytes(16).toString("hex")}`,
    "",
  ];
  await writeFileAtomic(envPath, lines.join("\n"));
}
