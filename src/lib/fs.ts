import { createHash, randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export async function writeFileAtomic(filePath: string, content: string | Buffer): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });

  const tmpPath = join(dir, `.${basename(filePath)}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    await writeFile(tmpPath, content);
    await rename(tmpPath, filePath);
  } catch (error) {
    await rm(tmpPath, { force: true });
    throw error;
  }
}

const COLLISION_HASH_LENGTH = 8;
const FALLBACK_NAME = "file";

export function sanitizeFileName(rawName: string, opts?: { existing?: ReadonlySet<string> }): string {
  const withoutQuery = rawName.split(/[?#]/, 1)[0] ?? "";
  const decoded = tryDecodeUri(withoutQuery);

  const extensionMatch = /\.([a-zA-Z0-9]+)$/.exec(decoded);
  const rawExtension = extensionMatch?.[1];
  const extension = rawExtension ? `.${rawExtension.toLowerCase()}` : "";
  const base = extensionMatch ? decoded.slice(0, extensionMatch.index) : decoded;

  const cleanBase =
    base
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "") || FALLBACK_NAME;

  const candidate = `${cleanBase}${extension}`;
  if (!opts?.existing?.has(candidate)) return candidate;

  const hash = createHash("sha256").update(rawName).digest("hex").slice(0, COLLISION_HASH_LENGTH);
  return `${cleanBase}-${hash}${extension}`;
}

function tryDecodeUri(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
