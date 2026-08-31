import { describe, expect, it } from "vitest";

import { checkAssetsResolve, checkInputCovered, checkInputUsed, checkSyntax } from "#synth/steps/accept/checks.ts";

describe("accept checks", () => {
  it("passes syntax on valid tsx and fails on broken tsx", async () => {
    await expect(checkSyntax('export const A = () => <div className="x" />;')).resolves.toMatchObject({ ok: true });
    await expect(checkSyntax("export const A = () => <div className=;")).resolves.toMatchObject({ ok: false });
  });

  it("requires every declared field to have a value in the input", () => {
    expect(checkInputCovered(["title", "body"], { title: "t", body: "b" })).toMatchObject({ ok: true });
    expect(checkInputCovered(["title", "body"], { title: "t" })).toMatchObject({ ok: false });
  });

  it("requires every input key to be referenced by the component source", () => {
    const source = "export const A = ({ title }: Props) => <h1>{title}</h1>;";
    expect(checkInputUsed({ title: "t" }, source)).toMatchObject({ ok: true });
    expect(checkInputUsed({ title: "t", subtitle: "s" }, source)).toMatchObject({ ok: false });
  });

  it("requires every referenced asset id to exist in the media inventory", () => {
    const known = new Set(["asset-1"]);
    expect(checkAssetsResolve({ hero: { type: "image", assetId: "asset-1" } }, known)).toMatchObject({ ok: true });
    expect(checkAssetsResolve({ hero: { type: "image", assetId: "asset-9" } }, known)).toMatchObject({ ok: false });
  });
});
