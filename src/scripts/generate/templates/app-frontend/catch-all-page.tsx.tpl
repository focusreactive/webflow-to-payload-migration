import config from "@payload-config";
import { notFound } from "next/navigation";
import { getPayload } from "payload";
import React from "react";

import { RenderBlocks } from "@/blocks/RenderBlocks";

export async function generateStaticParams(): Promise<{ slug: string[] }[]> {
  const payload = await getPayload({ config });
  const pages = await payload.find({ collection: "pages", limit: 1000, pagination: false });
  return pages.docs.map((doc) => ({
    slug: doc.slug === "home" ? [] : String(doc.slug).split("/"),
  }));
}

type Args = { params: Promise<{ slug?: string[] }> };

export default async function Page({ params }: Args) {
  const { slug } = await params;
  const path = slug !== undefined && slug.length > 0 ? slug.join("/") : "home";
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "pages",
    where: { slug: { equals: path } },
    depth: 2,
    limit: 1,
  });
  const page = result.docs[0];
  if (!page) notFound();
  return <RenderBlocks blocks={page.layout ?? []} />;
}
