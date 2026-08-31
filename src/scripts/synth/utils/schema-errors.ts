import type { z } from "zod";

import type { AcceptError } from "../types.ts";

export function schemaErrors(issues: readonly z.core.$ZodIssue[]): AcceptError[] {
  return issues.map((issue) => ({
    code: "SCHEMA",
    where: issue.path.join(".") || "(root)",
    detail: issue.message,
    fix: "Make the response match the schema printed by the schema step.",
  }));
}
