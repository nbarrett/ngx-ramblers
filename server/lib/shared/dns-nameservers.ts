import dns from "dns/promises";
import { candidateZoneNames } from "../cloudflare/cloudflare-dns";

const PUBLIC_SUFFIXES = new Set(["org.uk", "co.uk", "ac.uk", "gov.uk", "me.uk", "com", "org", "net", "uk"]);

export function nameserverLookupCandidates(hostname: string): string[] {
  return candidateZoneNames(hostname).filter(candidate => !PUBLIC_SUFFIXES.has(candidate.toLowerCase()));
}

export async function nameserversForHostname(hostname: string): Promise<string[]> {
  return nameserverLookupCandidates(hostname).reduce(async (resolved, candidate) => {
    const found = await resolved;
    if (found.length > 0) {
      return found;
    } else {
      try {
        const records = await dns.resolveNs(candidate);
        return records.length > 0
          ? records.map(record => record.replace(/\.$/, "").toLowerCase()).sort()
          : found;
      } catch {
        return found;
      }
    }
  }, Promise.resolve([] as string[]));
}

export async function publicAddressRecord(hostname: string): Promise<{ type: string; content: string } | null> {
  try {
    const cname = await dns.resolveCname(hostname);
    if (cname[0]) {
      return { type: "CNAME", content: cname[0].replace(/\.$/, "") };
    } else {
      return await publicAOrAaaa(hostname);
    }
  } catch {
    return publicAOrAaaa(hostname);
  }
}

async function publicAOrAaaa(hostname: string): Promise<{ type: string; content: string } | null> {
  try {
    const addresses = await dns.resolve4(hostname);
    if (addresses[0]) {
      return { type: "A", content: addresses[0] };
    } else {
      return await publicAaaa(hostname);
    }
  } catch {
    return publicAaaa(hostname);
  }
}

async function publicAaaa(hostname: string): Promise<{ type: string; content: string } | null> {
  try {
    const addresses = await dns.resolve6(hostname);
    if (addresses[0]) {
      return { type: "AAAA", content: addresses[0] };
    } else {
      return null;
    }
  } catch {
    return null;
  }
}
