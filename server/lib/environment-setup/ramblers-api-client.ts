import debug from "debug";
import https from "https";
import {
  MAXIMUM_PAGE_SIZE,
  RamblersGroupsApiResponse
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { envConfig } from "../env-config/env-config";
import { RamblersAreaLookup, RamblersGroupLookup, ValidationResult } from "./types";

const debugLog = debug(envConfig.logNamespace("environment-setup:ramblers-api"));
debugLog.enabled = true;

const WALKS_MANAGER_HOST = "walks-manager.ramblers.org.uk";
const WALKS_MANAGER_PROTOCOL = "https:";

interface RamblersApiRequestResult {
  response?: RamblersGroupsApiResponse[];
  error?: string;
}

function extractGroupsFromPayload(payload: unknown): RamblersGroupsApiResponse[] {
  if (Array.isArray(payload)) {
    return payload as RamblersGroupsApiResponse[];
  }

  const payloadWithResponse = payload as { response?: unknown };
  if (Array.isArray(payloadWithResponse?.response)) {
    return payloadWithResponse.response as RamblersGroupsApiResponse[];
  }

  const payloadWithData = payload as { data?: unknown };
  if (Array.isArray(payloadWithData?.data)) {
    return payloadWithData.data as RamblersGroupsApiResponse[];
  }

  return [];
}

async function makeRamblersApiRequest(path: string): Promise<RamblersApiRequestResult> {
  return new Promise((resolve) => {
    const options = {
      hostname: WALKS_MANAGER_HOST,
      protocol: WALKS_MANAGER_PROTOCOL,
      path,
      method: "GET",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      }
    };

    debugLog("Making Ramblers API request:", options.path);

    const request = https.request(options, (response) => {
      const chunks: Uint8Array[] = [];

      response.on("data", (chunk: Uint8Array) => {
        chunks.push(chunk);
      });

      response.on("end", () => {
        const rawData = Buffer.concat(chunks).toString();
        debugLog("Received response with status:", response.statusCode);

        if (response.statusCode !== 200) {
          resolve({ error: `API returned status ${response.statusCode}: ${rawData}` });
          return;
        }

        try {
          const parsedData = JSON.parse(rawData);
          const groups = extractGroupsFromPayload(parsedData);
          debugLog("Extracted", groups.length, "groups from response");
          resolve({ response: groups });
        } catch (err) {
          resolve({ error: `Failed to parse response: ${err.message}` });
        }
      });
    });

    request.on("error", (error) => {
      debugLog("Request error:", error.message);
      resolve({ error: `Request failed: ${error.message}` });
    });

    request.end();
  });
}

export async function listGroupsByAreaCode(lookup: RamblersAreaLookup): Promise<RamblersGroupsApiResponse[]> {
  if (!lookup.areaCode || !lookup.apiKey) {
    debugLog("Missing area code or API key");
    return [];
  }

  const path = `/api/volunteers/groups?limit=${MAXIMUM_PAGE_SIZE}&groups=${encodeURIComponent(lookup.areaCode)}&api-key=${encodeURIComponent(lookup.apiKey)}`;
  const result = await makeRamblersApiRequest(path);

  if (result.error) {
    debugLog("Error fetching groups by area:", result.error);
    return [];
  }

  return result.response || [];
}

export async function groupDetails(lookup: RamblersGroupLookup): Promise<RamblersGroupsApiResponse | null> {
  if (!lookup.groupCode || !lookup.apiKey) {
    debugLog("Missing group code or API key");
    return null;
  }

  const path = `/api/volunteers/groups?limit=${MAXIMUM_PAGE_SIZE}&groups=${encodeURIComponent(lookup.groupCode)}&api-key=${encodeURIComponent(lookup.apiKey)}`;
  const result = await makeRamblersApiRequest(path);

  if (result.error) {
    debugLog("Error fetching group details:", result.error);
    return null;
  }

  const groups = result.response || [];
  return groups.find(g => g.group_code === lookup.groupCode) || (groups.length > 0 ? groups[0] : null);
}

export async function validateRamblersApiKey(apiKey: string): Promise<ValidationResult> {
  if (!apiKey) {
    return { valid: false, message: "API key is required" };
  }

  const path = `/api/volunteers/groups?groups=KE&api-key=${encodeURIComponent(apiKey)}`;
  const result = await makeRamblersApiRequest(path);

  if (result.error) {
    if (result.error.includes("401") || result.error.includes("403") || result.error.includes("Unauthorized")) {
      return { valid: false, message: "Invalid API key" };
    }
    return { valid: false, message: result.error };
  }

  return { valid: true, message: "API key is valid" };
}

export function extractAreaCodeFromGroupCode(groupCode: string): string {
  if (!groupCode || groupCode.length < 2) {
    return "";
  }
  return groupCode.substring(0, 2);
}

export async function fetchAreaGroups(areaCode: string, apiKey: string): Promise<RamblersGroupsApiResponse[]> {
  return listGroupsByAreaCode({ areaCode, apiKey });
}

export async function fetchGroupWithAreaGroups(
  groupCode: string,
  apiKey: string
): Promise<{ group: RamblersGroupsApiResponse | null; areaGroups: RamblersGroupsApiResponse[] }> {
  const areaCode = extractAreaCodeFromGroupCode(groupCode);

  if (!areaCode) {
    return { group: null, areaGroups: [] };
  }

  const areaGroups = await listGroupsByAreaCode({ areaCode, apiKey });
  const group = areaGroups.find(g => g.group_code === groupCode) || null;

  return { group, areaGroups };
}
