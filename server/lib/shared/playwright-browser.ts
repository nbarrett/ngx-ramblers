import type { Browser } from "playwright";
import { asBoolean } from "./string-utils";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";

const CHROMIUM_LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--disable-gpu"
];

const DEFAULT_HEADLESS = true;

export function resolveHeadless(): boolean {
  return asBoolean(process.env[Environment.PLAYWRIGHT_HEADLESS] || DEFAULT_HEADLESS);
}

export async function launchChromium(): Promise<Browser> {
  const { chromium } = await import("playwright");
  return chromium.launch({headless: resolveHeadless(), args: CHROMIUM_LAUNCH_ARGS});
}
