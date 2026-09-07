import config from "@payload-config";
import { getPayload } from "payload";
import React from "react";

import { globalFieldTypes } from "@/lib/global-field-types";
import { normalizeCtx } from "@/lib/normalize-ctx";
import { normalizeRecord } from "@/lib/normalize-values";

import Component from "./Component";

export async function __NAME__(): Promise<React.JSX.Element> {
  const payload = await getPayload({ config });
  const data = await payload.findGlobal({ slug: "__SLUG__" as never, depth: 2 });
  const props = normalizeRecord(globalFieldTypes["__SLUG__"] ?? [], data as unknown as Record<string, unknown>, normalizeCtx);
  return <Component {...(props as unknown as React.ComponentProps<typeof Component>)} />;
}
