const HOME_PATH = "home";

export function segmentsOf(route: string): string[] {
  const segments = route.split("/").filter((segment) => segment !== "");

  return segments.length === 0 ? [HOME_PATH] : segments;
}

export function titleFromSlug(slug: string): string {
  if (slug === HOME_PATH) return "Home";
  const words = slug.replace(/[-_]+/gu, " ").trim();
  if (words === "") return slug;

  return words.charAt(0).toUpperCase() + words.slice(1);
}
