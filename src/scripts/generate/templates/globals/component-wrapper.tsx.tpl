import config from "@payload-config";
import { getPayload } from "payload";
import React from "react";

import { globalFieldTypes } from "@/lib/global-field-types";
import { normalizeRecord } from "@/lib/normalize-values";

import Component from "./Component";

// Server wrapper: fetches the global's editable values and feeds the
// AI-authored presentation component through the shared normalizer.
export async function __NAME__(): Promise<React.JSX.Element> {
  const payload = await getPayload({ config });
  const data = await payload.findGlobal({ slug: "__SLUG__" as never, depth: 2 });
  const props = normalizeRecord(globalFieldTypes["__SLUG__"] ?? [], data as unknown as Record<string, unknown>, {});
  return <Component {...(props as unknown as React.ComponentProps<typeof Component>)} />;
}
