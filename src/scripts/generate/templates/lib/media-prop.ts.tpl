import config from "@payload-config";
import { getPayload } from "payload";

import type { MediaProp } from "./normalize-values";

export async function mediaProp(assetId: string): Promise<MediaProp | undefined> {
  const payload = await getPayload({ config });
  try {
    const doc = (await payload.findByID({ collection: "media", id: assetId })) as unknown as Record<string, unknown>;
    if (typeof doc["url"] !== "string") return undefined;
    const alt = doc["alt"];
    return { src: doc["url"], ...(typeof alt === "string" && alt !== "" ? { alt } : {}) };
  } catch {
    return undefined;
  }
}
