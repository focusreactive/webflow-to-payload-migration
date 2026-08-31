export function firstSameOriginSitemapUrl(sitemapUrls: string[], origin: string): string | undefined {
  return sitemapUrls.find((url) => {
    try {
      return new URL(url).origin === origin;
    } catch {
      return false;
    }
  });
}
