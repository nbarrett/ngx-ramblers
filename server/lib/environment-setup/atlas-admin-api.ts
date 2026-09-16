import { createHash, randomBytes } from "crypto";
import { AtlasApiAccess, AtlasResponse } from "./atlas-admin-api.model";

const ATLAS_API = "https://cloud.mongodb.com/api/atlas/v2";
const ATLAS_MEDIA_TYPE = "application/vnd.atlas.2023-01-01+json";

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function challengeValue(challenge: string, name: string): string {
  return challenge.match(new RegExp(`${name}="([^"]*)"`))?.[1] || "";
}

export function atlasDigestAuthorisation(challenge: string, method: string, uri: string, atlas: AtlasApiAccess, cnonce: string): string {
  const realm = challengeValue(challenge, "realm");
  const nonce = challengeValue(challenge, "nonce");
  const opaque = challengeValue(challenge, "opaque");
  const qop = "auth";
  const nc = "00000001";
  const response = md5(`${md5(`${atlas.publicKey}:${realm}:${atlas.privateKey}`)}:${nonce}:${nc}:${cnonce}:${qop}:${md5(`${method}:${uri}`)}`);
  return [
    `Digest username="${atlas.publicKey}"`, `realm="${realm}"`, `nonce="${nonce}"`, `uri="${uri}"`, "algorithm=MD5",
    `qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`, `response="${response}"`, ...(opaque ? [`opaque="${opaque}"`] : [])
  ].join(", ");
}

export async function atlasRequest<T>(atlas: AtlasApiAccess, method: string, path: string, body?: unknown): Promise<AtlasResponse<T>> {
  const url = `${ATLAS_API}${path}`;
  const init = {method, headers: {Accept: ATLAS_MEDIA_TYPE, "Content-Type": ATLAS_MEDIA_TYPE}, body: body ? JSON.stringify(body) : undefined};
  const challenge = await fetch(url, init);
  const authenticateHeader = challenge.headers.get("www-authenticate") || "";
  const response = challenge.status === 401 && authenticateHeader.startsWith("Digest")
    ? await fetch(url, {...init, headers: {...init.headers, Authorization: atlasDigestAuthorisation(authenticateHeader, method, new URL(url).pathname, atlas, randomBytes(8).toString("hex"))}})
    : challenge;
  const text = await response.text();
  return {status: response.status, body: text ? JSON.parse(text) : null};
}
