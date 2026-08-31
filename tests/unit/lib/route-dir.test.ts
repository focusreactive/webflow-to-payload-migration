import { join } from "node:path/posix";

import { routeDir } from "#lib/route-dir.ts";

describe("routeDir", () => {
  it("maps the root route to 'index' and nested routes to sanitized segments", () => {
    expect(routeDir("/")).toBe("index");
    expect(routeDir("/about")).toBe("about");
    expect(routeDir("/blog/My Post")).toBe(join("blog", "my-post"));
  });
});
