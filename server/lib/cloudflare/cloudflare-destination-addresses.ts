import debug from "debug";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { DestinationAddress } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { envConfig } from "../env-config/env-config";
import { HttpError } from "../shared/http-error";
import { cloudflareApi } from "./cloudflare.model";

const debugLog = debug(envConfig.logNamespace("cloudflare:destination-addresses"));
debugLog.enabled = true;

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
  return cloudflareApi.accountEmailDestinationAddresses(accountId);
}

function headers(apiToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  };
}

export async function listDestinationAddresses(cloudflareConfig: CloudflareConfig): Promise<DestinationAddress[]> {
  const perPage = 50;

  debugLog("Listing destination addresses for account:", cloudflareConfig.accountId);

  const collectPage = async (page: number, acc: DestinationAddress[]): Promise<DestinationAddress[]> => {
    const url = `${baseUrl(cloudflareConfig.accountId)}?page=${page}&per_page=${perPage}`;
    const response = await fetch(url, {
      headers: headers(cloudflareConfig.apiToken)
    });

    const data: CloudflarePaginatedResponse<DestinationAddress> = await response.json();

    if (!data.success) {
      const errorMsg = data.errors.map(e => e.message).join(", ");
      throw new Error(`Failed to list destination addresses: ${errorMsg}`);
    }

    const newAcc = [...acc, ...data.result];
    const hasMore = data.result_info ? page < data.result_info.total_pages : data.result.length === perPage;
    if (hasMore) return collectPage(page + 1, newAcc);
    return newAcc;
  };

  const allAddresses = await collectPage(1, []);
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

export async function ensureForwardDestinationVerified(cloudflareConfig: CloudflareConfig, email: string, registerIfMissing = true): Promise<void> {
  const normalisedEmail = email.trim().toLowerCase();
  const existing = (await listDestinationAddresses(cloudflareConfig))
    .find(a => a.email?.trim().toLowerCase() === normalisedEmail);
  if (existing?.verified) {
    debugLog("Forward destination is verified: %s", normalisedEmail);
  } else if (existing) {
    throw new HttpError(400, `${email} is registered as a Cloudflare destination but has not been verified yet. Open the verification email Cloudflare sent to ${email}, click the link, then try again.`, "DestinationNotVerified");
  } else if (!registerIfMissing) {
    throw new HttpError(400, "The inbox router fallback is not a verified Cloudflare destination. Verify it in Committee Settings before retrying the migration.", "RouterFallbackNotVerified");
  } else {
    try {
      await createDestinationAddress(cloudflareConfig, email);
    } catch (error) {
      if (/verification email has been sent too recently/i.test(error.message || "")) {
        throw new HttpError(429, `Cloudflare recently sent a verification email to ${email}. Check that inbox for the link, then try again in a few minutes.`, "RateLimited");
      }
      throw new HttpError(400, `Could not register ${email} as a Cloudflare destination address: ${error.message}`, "DestinationRegistrationFailed");
    }
    throw new HttpError(400, `A verification email has been sent to ${email}. Click the link Cloudflare sent to that inbox, then try again.`, "DestinationVerificationSent");
  }
}
