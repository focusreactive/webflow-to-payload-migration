function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureLetterLeading(base: string): string {
  if (base === "") return "collection";

  return /^[a-z]/.test(base) ? base : `c-${base}`;
}

export function slugBaseFor(collection: { key: string; label?: string | null }): string {
  const fromLabel = slugify(collection.label ?? "");
  const base = fromLabel !== "" ? fromLabel : slugify(collection.key);

  return ensureLetterLeading(base);
}
