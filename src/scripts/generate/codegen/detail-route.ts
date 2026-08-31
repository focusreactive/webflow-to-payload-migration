import { join } from "node:path";

import { pascalCase } from "./names.ts";

// Top-level segments the generated shell already owns; a migrated collection's detail route
// must not reuse one of them.
const BASE_ROUTE_SEGMENTS = new Set(["api", "admin"]);

export function detailRoutePath(routePattern: string): string {
  const segments = routePattern.replace(/^\/+/, "").split("/");
  const staticSegments = segments.filter((segment) => !segment.startsWith(":"));
  return join("src/app/(frontend)", ...staticSegments, "[slug]", "page.tsx");
}

export function assertNoBaseRouteCollision(routePattern: string): void {
  const first = routePattern.replace(/^\/+/, "").split("/")[0];
  if (first !== undefined && BASE_ROUTE_SEGMENTS.has(first)) {
    throw new Error(
      `collection route pattern "${routePattern}" shadows the generated shell route "/${first}"; `
        + `rename the collection key so its detail route gets a free segment`,
    );
  }
}

export function emitDetailWrapper(opts: {
  collectionKey: string;
  collectionSlug: string;
  pageBinding: {
    slugField: string;
    meta: { title?: string | undefined; description?: string | undefined; ogImage?: string | undefined };
  };
  template: { sectionId: string }[];
}): string {
  const imports = opts.template
    .map(
      (binding) =>
        `import ${pascalCase(binding.sectionId)} from "@/detail/${opts.collectionKey}/sections/${pascalCase(binding.sectionId)}";`,
    )
    .join("\n");
  const sections = opts.template
    .map((binding) => `      <${pascalCase(binding.sectionId)} doc={doc} />`)
    .join("\n");

  const meta = opts.pageBinding.meta;
  const metaLine = (key: "title" | "description") =>
    meta[key] !== undefined ? `    ${key}: item?.[${JSON.stringify(meta[key])}] as string | undefined,` : "";
  const ogLine =
    meta.ogImage !== undefined
      ? `    openGraph: { images: item?.[${JSON.stringify(meta.ogImage)}] ? [String(item[${JSON.stringify(meta.ogImage)}])] : [] },`
      : "";
  const slugFieldKey = JSON.stringify(opts.pageBinding.slugField);

  return `import config from "@payload-config";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPayload } from "payload";
import React from "react";

${imports}

interface Args {
  params: Promise<{ slug: string }>;
}

async function loadDoc(slug: string) {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: ${JSON.stringify(opts.collectionSlug)},
    where: { [${slugFieldKey}]: { equals: slug } },
    depth: 2,
    limit: 1,
  });
  return result.docs[0];
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: ${JSON.stringify(opts.collectionSlug)},
    limit: 1000,
    pagination: false,
  });
  return result.docs.map((entry) => ({ slug: String(entry[${slugFieldKey}]) }));
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params;
  const item = await loadDoc(slug);
  return {
${[metaLine("title"), metaLine("description"), ogLine].filter(Boolean).join("\n")}
  };
}

export default async function DetailPage({ params }: Args) {
  const { slug } = await params;
  const doc = await loadDoc(slug);
  if (!doc) notFound();

  return (
    <main>
${sections}
    </main>
  );
}
`;
}
