import { blockComponentName, blockDirName, blockPropsInterfaceName } from "#blocks/codegen/names.ts";
import { type BlocksData, type BlockType } from "#ir/blocks.ts";

const isCollectionList = (block: BlockType): boolean => block.collectionKey !== undefined;

export function emitContentBlocksFile(blocks: BlocksData): string {
  const imports = blocks.blocks
    .map((block) => `import { ${blockComponentName(block.id)} } from "./${blockDirName(block.id)}/config";`)
    .join("\n");
  const names = blocks.blocks.map((block) => blockComponentName(block.id)).join(", ");

  return `import type { Block } from "payload";

${imports}

export const contentBlocks: Block[] = [${names}];
`;
}

function adapterName(block: BlockType): string {
  return `${blockComponentName(block.id)}Adapter`;
}

function emitAdapter(block: BlockType): string {
  const component = `${blockComponentName(block.id)}Component`;
  const props = blockPropsInterfaceName(block.id);
  const typeId = JSON.stringify(String(block.id));

  if (!isCollectionList(block)) {
    return `function ${adapterName(block)}(block: BlockData) {
  return <${component} {...normalizeProps<${props}>(blockFieldTypes[${typeId}], block, ctx)} />;
}`;
  }

  return `async function ${adapterName(block)}(block: BlockData) {
  const docs = await collectionListDocs(${typeId}, block);
  return <${component} {...normalizeProps<${props}>(blockFieldTypes[${typeId}], block, ctx)} docs={docs} />;
}`;
}

export function emitContentBlockComponentsFile(blocks: BlocksData): string {
  const componentImports = blocks.blocks
    .map((block) => `import ${blockComponentName(block.id)}Component from "./${blockDirName(block.id)}/Component";`)
    .join("\n");
  const propsImports = blocks.blocks
    .map((block) => `import type { ${blockPropsInterfaceName(block.id)} } from "./${blockDirName(block.id)}/props";`)
    .join("\n");
  // Imported only when an adapter calls it: an unused import trips the deliverable's own lint.
  const runtimeImports = [
    `import { blockFieldTypes } from "@/lib/migration/block-field-types";`,
    ...(blocks.blocks.some(isCollectionList) ?
      [`import { collectionListDocs } from "@/lib/migration/collection-list-docs";`]
    : []),
    `import { normalizeProps } from "@/lib/migration/normalize-values";`,
  ].join("\n");
  const adapters = blocks.blocks.map(emitAdapter).join("\n\n");
  const entries = blocks.blocks
    .map((block) => `  ${JSON.stringify(String(block.id))}: ${adapterName(block)},`)
    .join("\n");

  return `import React from "react";

${runtimeImports}

${componentImports}
${propsImports}

type BlockData = Record<string, unknown>;

const ctx = {};

${adapters}

const contentBlockComponents: Record<string, React.ComponentType<BlockData>> = {
${entries}
};

export function renderContentBlock(
  block: { blockType?: string | null; id?: string | null },
  key: React.Key,
): React.ReactNode {
  const { blockType } = block;
  if (!blockType) return null;
  const Component = contentBlockComponents[blockType];
  if (Component === undefined) return null;
  return <Component key={key} {...block} />;
}
`;
}
