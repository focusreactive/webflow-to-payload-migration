import path from "path";
import { fileURLToPath } from "url";

import type { CollectionConfig } from "payload";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const Media: CollectionConfig = {
  slug: "media",
  access: { read: () => true },
  fields: [{ name: "alt", type: "text" }],
  upload: {
    staticDir: path.resolve(dirname, "../../public/media"),
  },
};
