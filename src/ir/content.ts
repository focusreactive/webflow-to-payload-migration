import { z } from "zod";

import { provenanceSchema } from "#ir/common.ts";

export const contentRecordSchema = z.looseObject({
  id: z.string().min(1),
  _provenance: provenanceSchema,
  _confidence: z.number().min(0).max(1).optional(),
});
export type ContentRecord = z.infer<typeof contentRecordSchema>;
