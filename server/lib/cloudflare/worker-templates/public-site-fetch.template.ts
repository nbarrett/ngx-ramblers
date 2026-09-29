import { PublicSiteFetchEnv } from "./types";

const MAX_REDIRECTS = 5;

function publicHttpUrl(value: string): URL {
  const url = new URL(value);
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
    throw new Error("Use the public HTTP or HTTPS address of your current website.");
  } else {
    return url;
  }
}

async function followPublicSite(url: string, headers: HeadersInit, redirectsLeft: number): Promise<{response: Response; url: string}> {
  const parsed = publicHttpUrl(url);
  const response = await fetch(parsed.href, {headers, redirect: "manual"});
  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location && redirectsLeft > 0) {
    return followPublicSite(new URL(location, parsed).href, headers, redirectsLeft - 1);
  } else {
    return {response, url: parsed.href};
  }
}

export default {
  async fetch(request: Request, env: PublicSiteFetchEnv): Promise<Response> {
    const secret = env.PUBLIC_SITE_FETCH_SECRET;
    const authorisation = request.headers.get("Authorization") || "";
    if (request.method !== "POST") {
      return new Response("Method not allowed", {status: 405});
    } else if (!secret || authorisation !== `Bearer ${secret}`) {
      return new Response("Unauthorised", {status: 401});
    } else {
      const payload = await request.json() as {url?: string; accept?: string; userAgent?: string; acceptLanguage?: string; maximumBytes?: number};
      const maximumBytes = Number(payload.maximumBytes) > 0 ? Number(payload.maximumBytes) : 5000000;
      try {
        const origin = await followPublicSite(String(payload.url || ""), {
          "User-Agent": payload.userAgent || "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
          Accept: payload.accept || "text/html",
          "Accept-Language": payload.acceptLanguage || "en-GB,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br"
        }, MAX_REDIRECTS);
        const announced = Number(origin.response.headers.get("content-length") || "0");
        if (announced > maximumBytes) {
          return new Response("The source resource exceeds the migration limit.", {status: 413});
        } else {
          const counted = {bytes: 0};
          const {readable, writable} = new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              counted.bytes += chunk.byteLength;
              if (counted.bytes > maximumBytes) {
                controller.error(new Error("The source resource exceeds the migration limit."));
              } else {
                controller.enqueue(chunk);
              }
            }
          });
          origin.response.body.pipeTo(writable).catch(() => undefined);
          return new Response(readable, {
            status: 200,
            headers: {
              "X-Public-Site-Status": String(origin.response.status),
              "X-Public-Site-Url": origin.url,
              "Content-Type": origin.response.headers.get("content-type") || "application/octet-stream"
            }
          });
        }
      } catch (error) {
        return new Response((error as Error).message || "The current website could not be read.", {status: 400});
      }
    }
  }
};
