import { lookup } from "dns/promises";
import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { BlockList, isIP } from "net";

const excludedNetworks = new BlockList();
["0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.168.0.0/16", "198.18.0.0/15", "224.0.0.0/4", "240.0.0.0/4"].forEach(network => {
  const [address, prefix] = network.split("/");
  excludedNetworks.addSubnet(address, Number(prefix), "ipv4");
});

export function publicSiteUrl(value: string): URL {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
    (url.port && !["80", "443"].includes(url.port)) || isIP(url.hostname.replace(/^\[|\]$/g, ""))) {
    throw new Error("Use the public HTTP or HTTPS address of your current website.");
  }
  return url;
}

async function fetchPublicSiteBody(value: string, redirects: number, accept: string, expectedContentType: string, maximumBytes: number): Promise<Buffer> {
  const url = publicSiteUrl(value);
  const addresses = await lookup(url.hostname, {all: true, family: 4});
  if (redirects > 5 || !addresses.length || addresses.some(address => excludedNetworks.check(address.address, "ipv4"))) {
    throw new Error("The website must resolve to a public internet address.");
  }
  return new Promise<Buffer>((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      lookup: (_hostname, _options, callback) => callback(null, addresses),
      headers: {"User-Agent": "NGX-Ramblers-Registration", Accept: accept}, timeout: 20000
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        fetchPublicSiteBody(new URL(response.headers.location, url).href, redirects + 1, accept, expectedContentType, maximumBytes).then(resolve, reject);
      } else if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`${url.href} returned HTTP ${response.statusCode} (${response.headers["content-type"] || "no content type"}).`));
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
    request.on("timeout", () => request.destroy(new Error("The website did not respond in time.")));
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
