import { blockComponentName } from "#blocks/codegen/names.ts";
import { payloadField } from "#generate/payload-field.ts";
import { type SlugResolver } from "#generate/types.ts";
import { type BlockType } from "#ir/blocks.ts";

export function emitBlockConfig(block: BlockType, slugFor: SlugResolver = (key) => key, previewUrl?: string): string {
  const name = blockComponentName(block.id);
  const fields = block.fields.map((field) => payloadField(field, slugFor));
  const fieldsJson = JSON.stringify(fields, null, 2).split("\n").join("\n  ");
  const preview =
    previewUrl === undefined ? "" : (
      `  imageURL: ${JSON.stringify(previewUrl)},\n  imageAltText: ${JSON.stringify(`${block.name} block preview`)},\n`
    );

  return `import type { Block } from "payload";

export const ${name}: Block = {
  slug: ${JSON.stringify(String(block.id))},
  interfaceName: ${JSON.stringify(`${name}Block`)},
  labels: { singular: ${JSON.stringify(block.name)}, plural: ${JSON.stringify(block.name)} },
${preview}  fields: ${fieldsJson},
};
`;
}
