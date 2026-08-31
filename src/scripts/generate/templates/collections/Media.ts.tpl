import path from "path";
import { fileURLToPath } from "url";

import type { CollectionConfig } from "payload";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const Media: CollectionConfig = {
  slug: "media",
  access: { read: () => true },
  fields: [
    // Custom text id = the migration asset id (16-hex). Verified by the M7
    // spike; keeps richText upload nodes and detail-route media lookups
    // map-free.
    { name: "id", type: "text", required: true },
    { name: "alt", type: "text" },
  ],
  upload: {
    staticDir: path.resolve(dirname, "../../public/media"),
  },
};
