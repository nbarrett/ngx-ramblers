import { lookup } from "dns/promises";
import { isArray } from "es-toolkit/compat";
import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { BlockList, isIP } from "net";
import { HttpError } from "../shared/http-error";
import { sourceSiteLimiter } from "./source-site-limiter";
import { dateTimeNowAsValue } from "../shared/dates";

const excludedNetworks = new BlockList();
["0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.168.0.0/16", "198.18.0.0/15", "224.0.0.0/4", "240.0.0.0/4"].forEach(network => {
  const [address, prefix] = network.split("/");
  excludedNetworks.addSubnet(address, Number(prefix), "ipv4");
});

const UNRESOLVABLE_HOST_CODES = ["ENOTFOUND", "ENODATA"];

export const PUBLIC_SITE_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 NGX-Ramblers-Registration";

export function sourceUnavailable(error: unknown): boolean {
  const code = (error as {code?: string})?.code;
  return (error instanceof HttpError && error.status >= 400 && error.status < 500) || UNRESOLVABLE_HOST_CODES.includes(code);
}

export function retryAfterSeconds(header: string | string[] | undefined): number {
  const value = isArray(header) ? header[0] : header;
  const seconds = Number(value);
  if (!value) {
    return 0;
  } else if (Number.isFinite(seconds)) {
    return Math.max(0, seconds);
  } else {
    const retryAt = Date.parse(value);
    return Number.isFinite(retryAt) ? Math.max(0, Math.round((retryAt - dateTimeNowAsValue()) / 1000)) : 0;
  }
}

export function withoutQuery(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch (error) {
    return value;
  }
}

export function publicSiteUrl(value: string): URL {
  const trimmed = (value || "").trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : trimmed.includes(".") ? `https://${trimmed}` : trimmed;
  if (!withProtocol) {
    throw new Error("Use the public HTTP or HTTPS address of your current website.");
  }
  try {
    const url = new URL(withProtocol);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      (url.port && !["80", "443"].includes(url.port)) || isIP(url.hostname.replace(/^\[|\]$/g, ""))) {
      throw new Error("Use the public HTTP or HTTPS address of your current website.");
    } else {
      return url;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Use the public HTTP or HTTPS address of your current website.") {
      throw error;
    } else {
      throw new Error("Use the public HTTP or HTTPS address of your current website.");
    }
  }
}

function fetchPublicSiteBody(value: string, redirects: number, accept: string, expectedContentType: string, maximumBytes: number): Promise<Buffer> {
  return sourceSiteLimiter.request(value, () => requestPublicSiteBody(value, redirects, accept, expectedContentType, maximumBytes));
}

async function requestPublicSiteBody(value: string, redirects: number, accept: string, expectedContentType: string, maximumBytes: number): Promise<Buffer> {
  const url = publicSiteUrl(value);
  const addresses = await lookup(url.hostname, {all: true, family: 4});
  if (redirects > 5 || !addresses.length || addresses.some(address => excludedNetworks.check(address.address, "ipv4"))) {
    throw new Error("The website must resolve to a public internet address.");
  }
  return new Promise<Buffer>((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      lookup: (_hostname, _options, callback) => callback(null, addresses),
      headers: {"User-Agent": PUBLIC_SITE_USER_AGENT, Accept: accept}, timeout: 20000
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        requestPublicSiteBody(new URL(response.headers.location, url).href, redirects + 1, accept, expectedContentType, maximumBytes).then(resolve, reject);
      } else if (response.statusCode !== 200) {
        response.resume();
        reject(Object.assign(new HttpError(response.statusCode, `${withoutQuery(url.href)} returned HTTP ${response.statusCode} (${response.headers["content-type"] || "no content type"}).`), {retryAfterSeconds: retryAfterSeconds(response.headers["retry-after"])}));
      } else if (expectedContentType && response.headers["content-type"] && !response.headers["content-type"].includes(expectedContentType) && !response.headers["content-type"].includes("octet-stream") && !response.headers["content-type"].includes("binary")) {
        response.resume();
        reject(new Error(`${url.href} returned HTTP ${response.statusCode} (${response.headers["content-type"] || "no content type"}).`));
      } else {
        const chunks: Uint8Array[] = [];
        const size = {bytes: 0};
        response.on("data", chunk => {
          const buffer = new Uint8Array(chunk);
          size.bytes += buffer.length;
          if (size.bytes > maximumBytes) {
            request.destroy(new Error(`The source resource exceeds the ${Math.round(maximumBytes / 1000000)} MB migration limit.`));
          } else {
            chunks.push(buffer);
          }
        });
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      }
    });
    request.on("timeout", () => request.destroy(Object.assign(new Error("The website did not respond in time."), {code: "ETIMEDOUT"})));
    request.on("error", reject);
    request.end();
  });
}

export async function fetchPublicSiteHtml(value: string, redirects = 0): Promise<string> {
  return (await fetchPublicSiteBody(value, redirects, "text/html", "text/html", 5000000)).toString("utf8");
}

export async function fetchPublicSiteImage(value: string): Promise<Buffer> {
  return fetchPublicSiteBody(value, 0, "image/*", "image/", 20000000);
}

export async function fetchPublicSiteDocument(value: string): Promise<Buffer> {
  return fetchPublicSiteBody(value, 0, "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream,*/*", "", 30000000);
}
