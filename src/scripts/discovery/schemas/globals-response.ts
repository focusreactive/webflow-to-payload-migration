import { z } from "zod";

export const globalsResponseSchema = z.object({
  source: z.string().min(1),
  globals: z.array(
    z.object({
      name: z.enum(["header", "footer"]),
      nodeIds: z.array(z.string().min(1)).min(1),
      corroboratedRoutes: z.array(z.string().min(1)),
    }),
  ),
});
export type GlobalsResponse = z.infer<typeof globalsResponseSchema>;
