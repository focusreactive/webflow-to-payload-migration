export function resolveUrl(rawUrl: string, baseUrl: string): string | undefined {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return undefined;
  }
}
