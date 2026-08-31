import type { AcceptError } from "../../types.ts";

export function duplicateNameErrors(fields: readonly { name: string }[], owner: string): AcceptError[] {
  const seen = new Set<string>();
  const errors: AcceptError[] = [];
  for (const field of fields) {
    if (seen.has(field.name)) {
      errors.push({
        code: "DUPLICATE_FIELD",
        where: "fields[].name",
        got: field.name,
        detail: `${owner} already has a field with this name`,
        fix: "Give every field a unique name.",
      });
    }
    seen.add(field.name);
  }
  return errors;
}
