interface CaptureStyleElement {
  id: string;
  textContent: string;
  remove(): void;
}

declare const document: {
  documentElement: { scrollHeight: number };
  getAnimations(): {
    effect: { getTiming(): { iterations: number } } | null;
    currentTime: number;
    pause(): void;
    play(): void;
  }[];
  createElement(tag: string): CaptureStyleElement;
  head: { appendChild(element: CaptureStyleElement): void } | null;
  getElementById(id: string): CaptureStyleElement | null;
};

declare function scrollTo(x: number, y: number): void;

export const FREEZE_ANIMATIONS_STYLE_ID = "mig-freeze-animations";

export async function preScrollPage(args: { stepPx: number; stepDelayMs: number; maxSteps: number }): Promise<void> {
  let y = 0;
  let steps = 0;
  while (y < document.documentElement.scrollHeight && steps < args.maxSteps) {
    scrollTo(0, y);
    await new Promise<void>((resolve) => setTimeout(resolve, args.stepDelayMs));
    y += args.stepPx;
    steps += 1;
  }
  scrollTo(0, document.documentElement.scrollHeight);
  await new Promise<void>((resolve) => setTimeout(resolve, args.stepDelayMs));
}

export function freezeAnimationsInPage(styleId: string): void {
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = "*, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; }";
  document.head?.appendChild(style);

  for (const animation of document.getAnimations()) {
    const timing = animation.effect?.getTiming();
    if (timing?.iterations !== Infinity) continue;
    animation.pause();
    animation.currentTime = 0;
  }
}

export function unfreezeAnimationsInPage(styleId: string): void {
  document.getElementById(styleId)?.remove();

  for (const animation of document.getAnimations()) {
    const timing = animation.effect?.getTiming();
    if (timing?.iterations !== Infinity) continue;
    animation.play();
  }
}
