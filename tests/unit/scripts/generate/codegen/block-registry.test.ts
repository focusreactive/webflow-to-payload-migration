import { blockTypeSchema } from "#ir/blocks.ts";
import { emitContentBlockComponentsFile, emitContentBlocksFile } from "#generate/codegen/block-registry.ts";

const hero = blockTypeSchema.parse({
  id: "hero",
  name: "Hero",
  content: {},
  fields: [{ name: "heading", type: { type: "text" }, required: true }],
});

const postsList = blockTypeSchema.parse({
  id: "posts-list",
  name: "Posts list",
  content: {},
  collectionKey: "posts",
  fields: [{ name: "limit", type: { type: "number" }, required: false }],
});

describe("emitContentBlocksFile", () => {
  it("imports every block config and exports them as one array", () => {
    const source = emitContentBlocksFile({ blocks: [hero, postsList] });

    expect(source).toContain('import { Hero } from "./hero/config";');
    expect(source).toContain('import { PostsList } from "./posts-list/config";');
    expect(source).toContain("export const contentBlocks: Block[] = [Hero, PostsList];");
  });
});

describe("emitContentBlockComponentsFile", () => {
  it("wraps a plain block in a synchronous normalizing adapter", () => {
    const source = emitContentBlockComponentsFile({ blocks: [hero] });

    expect(source).toContain('import HeroComponent from "./hero/Component";');
    expect(source).toContain("normalizeProps<HeroProps>");
    expect(source).not.toContain("async");
  });

  it("wraps a collection-list block in an async adapter that fetches its docs", () => {
    const source = emitContentBlockComponentsFile({ blocks: [postsList] });

    expect(source).toContain("async function PostsListAdapter");
    expect(source).toContain('collectionListDocs("posts-list", block)');
    expect(source).toContain("docs={docs}");
  });

  it("renders without an extra wrapper element", () => {
    const source = emitContentBlockComponentsFile({ blocks: [hero] });

    expect(source).toContain("return <Component key={key} {...block} />;");
    expect(source).not.toContain("<div key={key}>");
  });
});
