import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";
import "./app.css";

declare const __PROJECT_ROOT__: string;

const IMAGE_SETTLE_TIMEOUT_MS = 5000;

function settled(img: HTMLImageElement): Promise<void> {
  if (img.complete) return Promise.resolve();
  img.loading = "eager";
  if (img.complete) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, IMAGE_SETTLE_TIMEOUT_MS);
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}

async function main(): Promise<void> {
  const params = new URLSearchParams(window.location.search);

  const kind = params.get("kind") ?? "block";
  const entry = params.get("entry");
  if (!entry) throw new Error("block-preview: missing ?entry=");
  const inputUrl = params.get("input");
  const input =
    inputUrl === null ? {} : ((await (await fetch(inputUrl)).json()) as Record<string, unknown>);

  const url = `/@fs/${__PROJECT_ROOT__}/${entry}`;
  const mod = (await import(/* @vite-ignore */ url)) as { default: ComponentType<Record<string, unknown>> };
  const Component = mod.default;

  const container = document.getElementById("root");
  if (!container) throw new Error("block-preview: #root missing");

  document.body.setAttribute("data-render-kind", kind);
  createRoot(container).render(<Component {...input} />);

  await document.fonts.ready;
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await Promise.all(Array.from(document.images).map(settled));
  document.body.setAttribute("data-render-ready", "true");
}

main().catch((err: unknown) => {
  document.body.setAttribute("data-render-error", String(err instanceof Error ? err.message : err));
});
