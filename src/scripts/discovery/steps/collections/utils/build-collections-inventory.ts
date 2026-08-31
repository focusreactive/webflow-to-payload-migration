import { slugifyId } from "#lib/slug.ts";

export function mintSectionId(role: string, used: Set<string>): string {
  const base = slugifyId(role);
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}
