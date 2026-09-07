import type { BrowserContext } from "playwright";

export async function installEvaluateShim(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const scope = globalThis as { __name?: (value: unknown) => unknown };
    scope.__name ??= (value: unknown) => value;
  });
}
