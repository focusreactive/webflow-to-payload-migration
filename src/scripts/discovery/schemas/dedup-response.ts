import { z } from "zod";

const instanceKeySchema = z.object({ route: z.string().min(1), nodeId: z.string().min(1) });

export const dedupResponseSchema = z.object({
  types: z.array(
    z.object({
      name: z.string().min(1),
      role: z.string().min(1),
      exemplar: instanceKeySchema,
      members: z.array(instanceKeySchema).min(1),
      collectionKey: z.string().nullable(),
    }),
  ),
});
export type DedupResponse = z.infer<typeof dedupResponseSchema>;
