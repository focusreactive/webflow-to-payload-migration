import type { Rect, StickyMeasurement } from "../types.ts";

interface MigElement {
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
  parentElement: MigElement | null;
  style: { visibility: string };
  getBoundingClientRect(): Rect;
}

interface MigStyleElement {
  id: string;
  textContent: string;
  remove(): void;
}

declare const document: {
  querySelectorAll(selector: string): ArrayLike<MigElement>;
  documentElement: { scrollHeight: number };
  fonts: { ready: Promise<unknown> };
  getAnimations(): {
    finished: Promise<unknown>;
    effect: { getTiming(): { iterations: number } } | null;
  }[];
  createElement(tag: string): MigStyleElement;
  head: { appendChild(element: MigStyleElement): void } | null;
  getElementById(id: string): MigStyleElement | null;
};

declare function getComputedStyle(el: MigElement): {
  getPropertyValue(prop: string): string;
};

declare function scrollTo(x: number, y: number): void;
declare function requestAnimationFrame(callback: () => void): number;

export interface PrimaryMeasurement {
  migId: string;
  props: Record<string, string>;
  rect: Rect;
}

export function scrollPageTo(y: number): void {
  scrollTo(0, y);
}

export function measurePrimaryViewport(curatedProperties: string[]): PrimaryMeasurement[] {
  const elements = Array.from(document.querySelectorAll("*"));

  return elements.map((element, index) => {
    const migId = `mig-${index}`;
    element.setAttribute("data-mig-id", migId);

    const computed = getComputedStyle(element);
    const props: Record<string, string> = {};
    for (const property of curatedProperties) {
      props[property] = computed.getPropertyValue(property);
    }

    const domRect = element.getBoundingClientRect();
    return {
      migId,
      props,
      rect: {
        x: domRect.x,
        y: domRect.y,
        width: domRect.width,
        height: domRect.height,
      },
    };
  });
}

export function measureRects(): Record<string, Rect> {
  const rects: Record<string, Rect> = {};

  for (const element of Array.from(document.querySelectorAll("[data-mig-id]"))) {
    const migId = element.getAttribute("data-mig-id");
    if (migId === null) continue;

    const domRect = element.getBoundingClientRect();
    rects[migId] = {
      x: domRect.x,
      y: domRect.y,
      width: domRect.width,
      height: domRect.height,
    };
  }

  return rects;
}

export function measureDocumentHeight(): number {
  return document.documentElement.scrollHeight;
}

export async function settlePage(args: { maxWaitMs: number; stableFrames: number }): Promise<void> {
  const deadline = Date.now() + args.maxWaitMs;
  const timeLeft = (): number => Math.max(0, deadline - Date.now());

  await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, timeLeft()))]);

  const finiteAnimations = document.getAnimations().filter((animation) => {
    const timing = animation.effect?.getTiming();
    return timing !== undefined && timing.iterations !== Infinity;
  });
  await Promise.race([
    Promise.all(finiteAnimations.map((animation) => animation.finished.catch(() => undefined))),
    new Promise((resolve) => setTimeout(resolve, timeLeft())),
  ]);

  const signature = (): string => {
    const parts: string[] = [String(document.documentElement.scrollHeight)];
    for (const element of Array.from(document.querySelectorAll("[style]"))) {
      parts.push(element.getAttribute("style") ?? "");
    }
    return parts.join("|");
  };

  let last = "";
  let stable = 0;
  while (stable < args.stableFrames && Date.now() < deadline) {
    const current = signature();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    stable = current === last ? stable + 1 : 0;
    last = current;
  }
}

export function measureStickyElements(): StickyMeasurement[] {
  const all = Array.from(document.querySelectorAll("[data-mig-id]"));
  const sticky = all.filter((element) => {
    const position = getComputedStyle(element).getPropertyValue("position");
    return position === "fixed" || position === "sticky";
  });

  const roots = sticky.filter((element) => {
    for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
      if (sticky.includes(parent)) return false;
    }
    return true;
  });

  return roots.flatMap((element) => {
    const migId = element.getAttribute("data-mig-id");
    const position = getComputedStyle(element).getPropertyValue("position");
    const rect = element.getBoundingClientRect();
    if (migId === null || rect.width <= 0 || rect.height <= 0) return [];
    const measured: StickyMeasurement = {
      migId,
      position: position === "fixed" ? "fixed" : "sticky",
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
    return [measured];
  });
}

export function setElementsHidden(args: {
  migIds: string[];
  hidden: boolean;
  attribute: string;
  styleId: string;
  css: string;
}): void {
  if (document.getElementById(args.styleId) === null) {
    const style = document.createElement("style");
    style.id = args.styleId;
    style.textContent = args.css;
    document.head?.appendChild(style);
  }

  const ids = new Set(args.migIds);
  for (const element of Array.from(document.querySelectorAll("[data-mig-id]"))) {
    const migId = element.getAttribute("data-mig-id");
    if (migId === null || !ids.has(migId)) continue;

    if (args.hidden) element.setAttribute(args.attribute, "1");
    else element.removeAttribute(args.attribute);
  }
}
