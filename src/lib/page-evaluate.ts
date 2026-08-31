import type { BrowserContext } from "playwright";

// esbuild (tsx) compiles inner function expressions to __name(fn, "fn"), a helper that lives in the
// bundler prelude. page.evaluate ships only the function body, so the page must provide the helper.
export async function installEvaluateShim(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const scope = globalThis as { __name?: (value: unknown) => unknown };
    scope.__name ??= (value: unknown) => value;
  });
}
