import { collectionConfigName, collectionFileName } from "./collections.ts";
import { globalConfigName } from "./globals-config.ts";
import { pascalCase } from "./utils/names.ts";

export function emitPayloadConfigFile(opts: { collectionSlugs: string[]; globalNames: string[] }): string {
  const collectionImports = opts.collectionSlugs
    .map(
      (slug) =>
        `import { ${collectionConfigName(slug)} } from "./collections/${collectionFileName(slug).replace(/\.ts$/, "")}";`,
    )
    .join("\n");
  const globalImports = opts.globalNames
    .map((name) => `import { ${globalConfigName(name)} } from "./globals/${pascalCase(name)}/config";`)
    .join("\n");
  const collectionNames = ["PagesCollection", "Media", "Users", ...opts.collectionSlugs.map(collectionConfigName)];
  const globalNames = opts.globalNames.map(globalConfigName);

  return `import path from "path";
import { fileURLToPath } from "url";

import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import sharp from "sharp";

import { Media } from "./collections/Media";
import { PagesCollection } from "./collections/Pages";
import { Users } from "./collections/Users";
${collectionImports}
${globalImports}

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
  },
  editor: lexicalEditor(),
  db: sqliteAdapter({
    client: { url: process.env.DATABASE_URI || "file:./payload.db" },
    push: true,
  }),
  collections: [${collectionNames.join(", ")}],
  globals: [${globalNames.join(", ")}],
  secret: process.env.PAYLOAD_SECRET || "",
  sharp,
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
});
`;
}
