export const FONT_PROVIDER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const FONT_PROVIDER_HOSTS = new Set([
  "fonts.googleapis.com",
  "use.typekit.net",
  "fonts.bunny.net",
  "api.fontshare.com",
]);

export const GOOGLE_FONTS_CSS_ORIGIN = "https://fonts.googleapis.com/css";

export const FONT_FORMAT_BY_EXTENSION: Record<string, string> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};
