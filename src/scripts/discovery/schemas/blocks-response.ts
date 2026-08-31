import { z } from "zod";

export const blocksResponseSchema = z.object({
  route: z.string().min(1),
  instances: z.array(
    z.object({
      nodeIds: z.array(z.string().min(1)).min(1),
      role: z.string().min(1),
      summary: z.string(),
    }),
  ),
});
export type BlocksResponse = z.infer<typeof blocksResponseSchema>;
