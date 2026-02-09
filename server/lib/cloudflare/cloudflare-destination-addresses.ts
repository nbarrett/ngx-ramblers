import debug from "debug";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { DestinationAddress } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("cloudflare:destination-addresses"));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace("cloudflare:destination-addresses"));
errorDebugLog.enabled = true;

interface CloudflarePaginatedResponse<T> {
  success: boolean;
  errors: { code: number; message: string }[];
  result: T[];
  result_info?: {
    page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
}

interface CloudflareSingleResponse<T> {
  success: boolean;
  errors: { code: number; message: string }[];
  result: T;
}

function baseUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routing/addresses`;
}

function headers(apiToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  };
}

export async function listDestinationAddresses(cloudflareConfig: CloudflareConfig): Promise<DestinationAddress[]> {
  const allAddresses: DestinationAddress[] = [];
  let page = 1;
  const perPage = 50;
  let hasMore = true;

  debugLog("Listing destination addresses for account:", cloudflareConfig.accountId);

  do {
    const url = `${baseUrl(cloudflareConfig.accountId)}?page=${page}&per_page=${perPage}`;
    const response = await fetch(url, {
      headers: headers(cloudflareConfig.apiToken)
    });

    const data: CloudflarePaginatedResponse<DestinationAddress> = await response.json();

    if (!data.success) {
      const errorMsg = data.errors.map(e => e.message).join(", ");
      throw new Error(`Failed to list destination addresses: ${errorMsg}`);
    }

    allAddresses.push(...data.result);

    if (data.result_info) {
      hasMore = page < data.result_info.total_pages;
    } else {
      hasMore = data.result.length === perPage;
    }
    page++;
  } while (hasMore);

  debugLog("Found %d destination addresses", allAddresses.length);
  return allAddresses;
}

export async function createDestinationAddress(cloudflareConfig: CloudflareConfig, email: string): Promise<DestinationAddress> {
  const url = baseUrl(cloudflareConfig.accountId);
  debugLog("Creating destination address: %s", email);

  const response = await fetch(url, {
    method: "POST",
    headers: headers(cloudflareConfig.apiToken),
    body: JSON.stringify({email})
  });

  const data: CloudflareSingleResponse<DestinationAddress> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to create destination address: ${errorMsg}`);
  }

  debugLog("Destination address created: %s", data.result.id);
  return data.result;
}

export async function deleteDestinationAddress(cloudflareConfig: CloudflareConfig, addressId: string): Promise<void> {
  const url = `${baseUrl(cloudflareConfig.accountId)}/${addressId}`;
  debugLog("Deleting destination address: %s", addressId);

  const response = await fetch(url, {
    method: "DELETE",
    headers: headers(cloudflareConfig.apiToken)
  });

  const data: CloudflareSingleResponse<{ id: string }> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to delete destination address: ${errorMsg}`);
  }

  debugLog("Destination address deleted: %s", addressId);
}
