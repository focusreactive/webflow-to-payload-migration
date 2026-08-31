import { type GlobalDef } from "#ir/globals.ts";

import { payloadField } from "./fields.ts";
import { pascalCase } from "./names.ts";

export function globalConfigName(name: string): string {
  return `${pascalCase(name)}Global`;
}

export function emitGlobalConfigFile(def: GlobalDef): string {
  const name = globalConfigName(def.name);
  const body = JSON.stringify(
    { slug: def.name, label: def.name, fields: def.fields.map((field) => payloadField(field)) },
    null,
    2,
  );

  return (
    `import type { GlobalConfig } from "payload";\n\n` +
    `export const ${name}: GlobalConfig = {\n` +
    `  access: { read: () => true },\n` +
    `  ...(${body} as Omit<GlobalConfig, "access">),\n` +
    `};\n`
  );
}
