export function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = "";

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  }

  return url.toString();
}

export function routeFromUrl(url: string): string {
  return new URL(normalizeUrl(url)).pathname;
}
