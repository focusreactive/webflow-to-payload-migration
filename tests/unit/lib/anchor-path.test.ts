import { anchorPaths } from "#lib/anchor-path.ts";

describe("anchorPaths", () => {
  it("maps every stamped id to its path of element-child indices below body", () => {
    const html = `<html><head><title>t</title></head><body>
      <header data-mig-id="mig-1"></header>
      <main><p>copy</p><section data-mig-id="mig-2"><span data-mig-id="mig-3"></span></section></main>
    </body></html>`;

    expect(anchorPaths(html)).toEqual({ "mig-1": [0], "mig-2": [1, 1], "mig-3": [1, 1, 0] });
  });

  it("returns an empty map for html the snapshot never stamped", () => {
    expect(anchorPaths("<html><body><div><span>copy</span></div></body></html>")).toEqual({});
  });

  it("keeps text and comment nodes out of the index count", () => {
    const html = `<html><body>copy<!-- c --><div></div>copy<div data-mig-id="mig-4"></div></body></html>`;

    expect(anchorPaths(html)).toEqual({ "mig-4": [1] });
  });
});
