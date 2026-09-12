import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("public-http-probe"));

const HTTP_PROBE_TIMEOUT_MS = 8000;

enum HttpProbeMethod {
  HEAD = "HEAD",
  GET = "GET"
}

export interface PublicHttpProbeResult {
  httpStatus: number;
  httpRedirectLocation: string;
}

function probeLooksSuccessful(httpStatus: number): boolean {
  return httpStatus >= 200 && httpStatus < 400;
}

async function probeOnce(hostname: string, method: HttpProbeMethod, signal: AbortSignal): Promise<PublicHttpProbeResult> {
  const response = await fetch(`https://${hostname}/`, { method, redirect: "manual", signal });
  return { httpStatus: response.status, httpRedirectLocation: response.headers.get("location") || "" };
}

export async function probeHttp(hostname: string): Promise<PublicHttpProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_PROBE_TIMEOUT_MS);
  try {
    const headResult = await probeOnce(hostname, HttpProbeMethod.HEAD, controller.signal);
    if (probeLooksSuccessful(headResult.httpStatus) || (headResult.httpStatus >= 300 && headResult.httpStatus < 400)) {
      return headResult;
    } else {
      debugLog("HEAD probe for %s returned %s - retrying with GET", hostname, headResult.httpStatus);
      return await probeOnce(hostname, HttpProbeMethod.GET, controller.signal);
    }
  } catch (error) {
    debugLog("HTTP probe failed for %s: %s", hostname, error instanceof Error ? error.message : String(error));
    try {
      return await probeOnce(hostname, HttpProbeMethod.GET, controller.signal);
    } catch (getError) {
      debugLog("GET probe failed for %s: %s", hostname, getError instanceof Error ? getError.message : String(getError));
      return { httpStatus: 0, httpRedirectLocation: "" };
    }
  } finally {
    clearTimeout(timeout);
  }
}
