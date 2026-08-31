import { findPaginations, paginationUrls, type PaginationInfo } from "#adapters/webflow/pagination.ts";

function dynList(paginationWrapper: string): string {
  return `<!doctype html><html><body>
    <div class="w-dyn-list">
      <div role="list" class="w-dyn-items"><div role="listitem" class="w-dyn-item">Item</div></div>
      ${paginationWrapper}
    </div>
  </body></html>`;
}

const NEXT_LINK_WRAPPER = `
  <div role="navigation" aria-label="List" class="w-pagination-wrapper">
    <a href="?7b68c208_page=2" aria-label="Next Page" class="w-pagination-next w-inline-block">Next</a>
    <link rel="prerender" href="?7b68c208_page=2"/>
    <div aria-label="Page 1 of 85" role="heading" class="w-page-count w-inline-block">1 / 85</div>
  </div>
`;

describe("findPaginations", () => {
  it("reads seed and pageCount from a real webflow.com/blog-style wrapper", () => {
    const html = dynList(NEXT_LINK_WRAPPER);

    const result = findPaginations(html);

    expect(result).toEqual([{ seed: "7b68c208", pageCount: 85 }]);
  });

  it("returns [] for a page with no pagination wrapper at all", () => {
    const html = dynList("");

    const result = findPaginations(html);

    expect(result).toEqual([]);
  });

  it("returns [] when there is no .w-dyn-list on the page", () => {
    const html = "<!doctype html><html><body><p>No collection list here.</p></body></html>";

    const result = findPaginations(html);

    expect(result).toEqual([]);
  });

  it('parses pageCount 1 from "1 / 1"', () => {
    const wrapper = `
      <div role="navigation" aria-label="List" class="w-pagination-wrapper">
        <a href="?7b68c208_page=2" aria-label="Next Page" class="w-pagination-next w-inline-block">Next</a>
        <div aria-label="Page 1 of 1" role="heading" class="w-page-count w-inline-block">1 / 1</div>
      </div>
    `;
    const html = dynList(wrapper);

    const result = findPaginations(html);

    expect(result).toEqual([{ seed: "7b68c208", pageCount: 1 }]);
  });

  it('falls back to <link rel="prerender"> href for the seed when the next-anchor is absent', () => {
    const wrapper = `
      <div role="navigation" aria-label="List" class="w-pagination-wrapper">
        <link rel="prerender" href="?7b68c208_page=2"/>
        <div aria-label="Page 1 of 85" role="heading" class="w-page-count w-inline-block">1 / 85</div>
      </div>
    `;
    const html = dynList(wrapper);

    const result = findPaginations(html);

    expect(result).toEqual([{ seed: "7b68c208", pageCount: 85 }]);
  });

  it("skips a wrapper when no seed can be found on either the next-anchor or the prerender link", () => {
    const wrapper = `
      <div role="navigation" aria-label="List" class="w-pagination-wrapper">
        <div aria-label="Page 1 of 85" role="heading" class="w-page-count w-inline-block">1 / 85</div>
      </div>
    `;
    const html = dynList(wrapper);

    const result = findPaginations(html);

    expect(result).toEqual([]);
  });

  it("defaults pageCount to 1 when there is no .w-page-count element at all", () => {
    const wrapper = `
      <div role="navigation" aria-label="List" class="w-pagination-wrapper">
        <a href="?7b68c208_page=2" aria-label="Next Page" class="w-pagination-next w-inline-block">Next</a>
      </div>
    `;
    const html = dynList(wrapper);

    const result = findPaginations(html);

    expect(result).toEqual([{ seed: "7b68c208", pageCount: 1 }]);
  });

  it("reads the seed when the _page param is not first in the query string", () => {
    const wrapper = `
      <div role="navigation" aria-label="List" class="w-pagination-wrapper">
        <a href="?foo=1&7b68c208_page=2" aria-label="Next Page" class="w-pagination-next w-inline-block">Next</a>
        <div aria-label="Page 1 of 85" role="heading" class="w-page-count w-inline-block">1 / 85</div>
      </div>
    `;
    const html = dynList(wrapper);

    const result = findPaginations(html);

    expect(result).toEqual([{ seed: "7b68c208", pageCount: 85 }]);
  });

  it("returns one entry per independent, non-nested .w-dyn-list", () => {
    const html = `<!doctype html><html><body>
      <div class="w-dyn-list">
        <div role="list" class="w-dyn-items"><div role="listitem" class="w-dyn-item">Item</div></div>
        <div role="navigation" aria-label="List" class="w-pagination-wrapper">
          <a href="?aaaaaaaa_page=2" aria-label="Next Page" class="w-pagination-next w-inline-block">Next</a>
          <div aria-label="Page 1 of 5" role="heading" class="w-page-count w-inline-block">1 / 5</div>
        </div>
      </div>
      <div class="w-dyn-list">
        <div role="list" class="w-dyn-items"><div role="listitem" class="w-dyn-item">Item</div></div>
        <div role="navigation" aria-label="List" class="w-pagination-wrapper">
          <a href="?bbbbbbbb_page=2" aria-label="Next Page" class="w-pagination-next w-inline-block">Next</a>
          <div aria-label="Page 1 of 9" role="heading" class="w-page-count w-inline-block">1 / 9</div>
        </div>
      </div>
    </body></html>`;

    const result = findPaginations(html);

    expect(result).toEqual([
      { seed: "aaaaaaaa", pageCount: 5 },
      { seed: "bbbbbbbb", pageCount: 9 },
    ]);
  });

  it("attributes a single shared wrapper to the inner list only, not to every ancestor .w-dyn-list", () => {
    const html = `<!doctype html><html><body>
      <div class="w-dyn-list">
        <div role="list" class="w-dyn-items">
          <div role="listitem" class="w-dyn-item">
            <div class="w-dyn-list">
              <div role="list" class="w-dyn-items"><div role="listitem" class="w-dyn-item">Item</div></div>
              <div role="navigation" aria-label="List" class="w-pagination-wrapper">
                <a href="?7b68c208_page=2" aria-label="Next Page" class="w-pagination-next w-inline-block">Next</a>
                <div aria-label="Page 1 of 85" role="heading" class="w-page-count w-inline-block">1 / 85</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body></html>`;

    const result = findPaginations(html);

    expect(result).toEqual([{ seed: "7b68c208", pageCount: 85 }]);
  });
});

describe("paginationUrls", () => {
  const info: PaginationInfo = { seed: "7b68c208", pageCount: 85 };

  it("produces 84 URLs, first for page 2 and last for page 85", () => {
    const result = paginationUrls("https://x/blog", info);

    expect(result).toHaveLength(84);
    expect(result[0]).toBe("https://x/blog?7b68c208_page=2");
    expect(result[83]).toBe("https://x/blog?7b68c208_page=85");
  });

  it("returns [] when pageCount is 1", () => {
    const result = paginationUrls("https://x/blog", { seed: "7b68c208", pageCount: 1 });

    expect(result).toEqual([]);
  });

  it("preserves an existing query string when adding the pagination param", () => {
    const result = paginationUrls("https://x/blog?category=news", {
      seed: "7b68c208",
      pageCount: 3,
    });

    expect(result).toEqual([
      "https://x/blog?category=news&7b68c208_page=2",
      "https://x/blog?category=news&7b68c208_page=3",
    ]);
  });
});
