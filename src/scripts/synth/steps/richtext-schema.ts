import { richTextResponseSchema } from "../schemas/richtext-response.ts";
import { printResponseSchema } from "../utils/print-response-schema.ts";

export function runRichTextSchema(): void {
  printResponseSchema(richTextResponseSchema);
}
