import Bottleneck from "bottleneck";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("brevo:rate-limiting"));
debugLog.enabled = true;

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

function statusCodeOf(error: any): number {
  return error?.statusCode ?? error?.response?.statusCode;
}

function retryAfterMsOf(error: any): number | null {
  const header = error?.response?.headers?.["retry-after"] ?? error?.response?.header?.["retry-after"];
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

export function createBottleneckWithRatePerSecond(ratePerSecond: number): Bottleneck {
  const limiter = new Bottleneck({minTime: 1000 / ratePerSecond, maxConcurrent: ratePerSecond});
  limiter.on("failed", async (error: any, jobInfo: { retryCount: number }) => {
    if (statusCodeOf(error) === 429) {
      if (jobInfo.retryCount < MAX_RETRIES) {
        const backoff = Math.min(BASE_RETRY_DELAY_MS * 2 ** jobInfo.retryCount, MAX_RETRY_DELAY_MS);
        const delay = (retryAfterMsOf(error) ?? backoff) + Math.floor(Math.random() * 250);
        debugLog("Brevo rate limit (429); retry", jobInfo.retryCount + 1, "of", MAX_RETRIES, "in", delay, "ms");
        return delay;
      }
      debugLog("Brevo rate limit (429); giving up after", MAX_RETRIES, "retries");
    }
    return undefined;
  });
  return limiter;
}

const BREVO_RATE_PER_SECOND = 10;
const brevoLimiter = createBottleneckWithRatePerSecond(BREVO_RATE_PER_SECOND);

export function scheduleBrevo<T>(task: () => Promise<T>): Promise<T> {
  return brevoLimiter.schedule(task);
}
