import { chromium, type Browser } from "playwright";

export function launchBrowser(): Promise<Browser> {
  return chromium.launch({ args: ["--force-color-profile=srgb", "--disable-lcd-text"] });
}
