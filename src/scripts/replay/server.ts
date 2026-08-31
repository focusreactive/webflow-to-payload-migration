import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { basename, join } from "node:path";

import { routeFromUrl } from "#lib/url.ts";
import { FONT_ASSETS_DIR, FONTS_CSS_RELATIVE_PATH, rewriteFontUrls } from "#lib/snapshot-store/fonts.ts";
import { openSnapshotStore, readOnlyClient } from "#lib/snapshot-store/index.ts";
import { SNAPSHOT_DIR } from "#lib/snapshot-store/paths.ts";

import { createAnchorMaps } from "./anchors.ts";
import { createReplayLookup } from "./assets.ts";
import { ASSET_ROUTE_PREFIX, rewriteCss, rewriteHtml } from "./rewrite.ts";

const PAGE_ROUTE_PREFIX = "/r";
const FONT_ROUTE_PREFIX = "/f/";
const HEALTH_ROUTE = "/_health";
const CSS_CONTENT_TYPE = "text/css";
const HOME_ROUTE = "/";
const EMPTY_ROUTE_SEGMENT = "";

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const ANY_AVAILABLE_PORT = 0;
const LOCALHOST = "127.0.0.1";

export interface ReplayServer {
  origin: string;
  close(): Promise<void>;
}

export async function createReplayServer(opts: { projectPath: string; port?: number }): Promise<ReplayServer> {
  const lookup = await createReplayLookup(opts.projectPath);
  const store = await openSnapshotStore(opts.projectPath, readOnlyClient());
  const pages = new Map<string, string>();
  for (const entry of store.entries()) {
    if (entry.kind !== "page") continue;
    pages.set(routeFromUrl(entry.url), entry.url);
  }

  const fontsCssPath = join(opts.projectPath, SNAPSHOT_DIR, FONTS_CSS_RELATIVE_PATH);
  const fontsCss =
    existsSync(fontsCssPath) ? rewriteFontUrls(await readFile(fontsCssPath, "utf8"), FONT_ROUTE_PREFIX) : "";
  const anchorMaps = createAnchorMaps({ projectPath: opts.projectPath, store });

  const server: Server = createServer((request, response) => {
    void (async (): Promise<void> => {
      const path = decodeURIComponent((request.url ?? HOME_ROUTE).split("?")[0] ?? HOME_ROUTE);

      if (path === HEALTH_ROUTE) {
        response.writeHead(HTTP_OK, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
        return;
      }

      if (path.startsWith(FONT_ROUTE_PREFIX)) {
        const file = join(opts.projectPath, SNAPSHOT_DIR, FONT_ASSETS_DIR, basename(path));
        if (!existsSync(file)) {
          response.writeHead(HTTP_NOT_FOUND).end();
          return;
        }
        response.writeHead(HTTP_OK).end(await readFile(file));
        return;
      }

      if (path.startsWith(ASSET_ROUTE_PREFIX)) {
        const hit = await lookup.read(path.slice(ASSET_ROUTE_PREFIX.length));
        if (hit === undefined) {
          response.writeHead(HTTP_NOT_FOUND).end();
          return;
        }
        const isCss = hit.contentType?.startsWith(CSS_CONTENT_TYPE) === true;
        const body =
          isCss ?
            rewriteCss({
              css: hit.body.toString("utf8"),
              baseUrl: hit.url,
              idFor: (url) => lookup.idFor(url),
            })
          : hit.body;
        response.writeHead(HTTP_OK, hit.contentType === undefined ? {} : { "content-type": hit.contentType }).end(body);
        return;
      }

      if (path === PAGE_ROUTE_PREFIX || path.startsWith(`${PAGE_ROUTE_PREFIX}/`)) {
        const routeTail = path.slice(PAGE_ROUTE_PREFIX.length);
        const route = routeTail === EMPTY_ROUTE_SEGMENT ? HOME_ROUTE : routeTail;
        const pageUrl = pages.get(route);
        const entry = pageUrl === undefined ? undefined : store.get(pageUrl);
        if (entry === undefined || pageUrl === undefined) {
          response.writeHead(HTTP_NOT_FOUND).end();
          return;
        }
        const raw = await readFile(join(opts.projectPath, SNAPSHOT_DIR, entry.paths.raw), "utf8");
        const anchors = await anchorMaps.forRoute(route);
        const html = rewriteHtml({
          html: raw,
          baseUrl: pageUrl,
          idFor: (url) => lookup.idFor(url),
          fontsCss,
          ...(anchors !== undefined && { anchors }),
        });
        response.writeHead(HTTP_OK, { "content-type": "text/html; charset=utf-8" }).end(html);
        return;
      }

      response.writeHead(HTTP_NOT_FOUND).end();
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      response.writeHead(HTTP_INTERNAL_SERVER_ERROR, { "content-type": "text/plain" }).end(message);
    });
  });

  await new Promise<void>((resolve) => server.listen(opts.port ?? ANY_AVAILABLE_PORT, LOCALHOST, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("replay server has no address");

  return {
    origin: `http://localhost:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
