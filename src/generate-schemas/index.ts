import { join } from "node:path";

import { generateSchemaFiles, writeSchemaFiles } from "./generate.ts";

const schemasDir = join(import.meta.dirname, "..", "..", "schemas");

await writeSchemaFiles(schemasDir);
console.log(`Generated ${Object.keys(generateSchemaFiles()).length} schema file(s) in ${schemasDir}`);
