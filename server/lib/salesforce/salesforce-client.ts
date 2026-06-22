import { toPairs } from "es-toolkit/compat";
import axios, { AxiosError, AxiosInstance } from "axios";
import debug from "debug";
import {
  SalesforceConfig,
  SalesforceConsentUpdateRequest,
  SalesforceConsentUpdateResponse,
  SalesforceMemberListResponse
} from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { envConfig } from "../env-config/env-config";
import { dateTimeNowAsValue } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("salesforce-client"));
debugLog.enabled = false;

export interface SalesforceListOptions {
  groupCode: string;
  since?: string;
  includeExpired?: boolean;
}

export interface SalesforceErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export interface SalesforceClientResult<T> {
  status: number;
  data?: T;
  errorCode?: string;
  errorMessage?: string;
  latencyMs: number;
}

export function buildSalesforceClient(endpointBaseUrl: string, apiKey: string | undefined): AxiosInstance {
  if (!endpointBaseUrl) {
    throw new Error("Salesforce endpointBaseUrl is not configured");
  }
  const baseURL = endpointBaseUrl.replace(/\/+$/, "");
  return axios.create({
    baseURL,
    timeout: 60_000,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    validateStatus: () => true,
  });
}

export function tokenForGroupCode(salesforceConfig: SalesforceConfig, groupCode: string): string | undefined {
  return salesforceConfig?.apiKeysByGroupCode?.[groupCode];
}

export function firstConfiguredToken(salesforceConfig: SalesforceConfig): { groupCode: string; token: string } | null {
  const entries = toPairs(salesforceConfig?.apiKeysByGroupCode ?? {});
  const firstEntry = entries.find(([, token]) => !!token && token.length > 0);
  return firstEntry ? { groupCode: firstEntry[0], token: firstEntry[1] } : null;
}

export async function pingSalesforce(salesforceConfig: SalesforceConfig, groupCode: string): Promise<SalesforceClientResult<SalesforceMemberListResponse>> {
  const apiKey = tokenForGroupCode(salesforceConfig, groupCode);
  if (!apiKey) {
    return {
      status: 0,
      errorCode: "TOKEN_MISSING",
      errorMessage: `No API token configured for group ${groupCode}.`,
      latencyMs: 0,
    };
  }
  const client = buildSalesforceClient(salesforceConfig.endpointBaseUrl, apiKey);
  const startedAt = dateTimeNowAsValue();
  try {
    const response = await client.get<SalesforceMemberListResponse | SalesforceErrorBody>(`/api/groups/${encodeURIComponent(groupCode)}/members`, {
      params: { limit: 1 }
    });
    const latencyMs = dateTimeNowAsValue() - startedAt;
    if (response.status >= 200 && response.status < 300) {
      return { status: response.status, data: response.data as SalesforceMemberListResponse, latencyMs };
    }
    const errorBody = response.data as SalesforceErrorBody;
    return {
      status: response.status,
      errorCode: errorBody?.error?.code || `HTTP_${response.status}`,
      errorMessage: errorBody?.error?.message || `Unexpected status ${response.status}`,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = dateTimeNowAsValue() - startedAt;
    const axiosError = error as AxiosError;
    return {
      status: axiosError.response?.status || 0,
      errorCode: axiosError.code || "NETWORK_ERROR",
      errorMessage: axiosError.message || String(error),
      latencyMs,
    };
  }
}

export async function pushSalesforceConsent(salesforceConfig: SalesforceConfig, membershipNumber: string, request: SalesforceConsentUpdateRequest): Promise<SalesforceClientResult<SalesforceConsentUpdateResponse>> {
  const firstToken = firstConfiguredToken(salesforceConfig);
  if (!firstToken) {
    return {
      status: 0,
      errorCode: "TOKEN_MISSING",
      errorMessage: "No API token configured for any group.",
      latencyMs: 0,
    };
  }
  const client = buildSalesforceClient(salesforceConfig.endpointBaseUrl, firstToken.token);
  const startedAt = dateTimeNowAsValue();
  try {
    const response = await client.post<SalesforceConsentUpdateResponse | SalesforceErrorBody>(`/api/members/${encodeURIComponent(membershipNumber)}/consent`, request);
    const latencyMs = dateTimeNowAsValue() - startedAt;
    if (response.status >= 200 && response.status < 300) {
      return { status: response.status, data: response.data as SalesforceConsentUpdateResponse, latencyMs };
    }
    const errorBody = response.data as SalesforceErrorBody;
    return {
      status: response.status,
      errorCode: errorBody?.error?.code || `HTTP_${response.status}`,
      errorMessage: errorBody?.error?.message || `Unexpected status ${response.status}`,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = dateTimeNowAsValue() - startedAt;
    const axiosError = error as AxiosError;
    return {
      status: axiosError.response?.status || 0,
      errorCode: axiosError.code || "NETWORK_ERROR",
      errorMessage: axiosError.message || String(error),
      latencyMs,
    };
  }
}

export async function fetchSalesforceMembers(salesforceConfig: SalesforceConfig, options: SalesforceListOptions): Promise<SalesforceClientResult<SalesforceMemberListResponse>> {
  const apiKey = tokenForGroupCode(salesforceConfig, options.groupCode);
  if (!apiKey) {
    return {
      status: 0,
      errorCode: "TOKEN_MISSING",
      errorMessage: `No API token configured for group ${options.groupCode}.`,
      latencyMs: 0,
    };
  }
  const client = buildSalesforceClient(salesforceConfig.endpointBaseUrl, apiKey);
  const startedAt = dateTimeNowAsValue();
  const params: Record<string, string | boolean> = {};
  if (options.since) {
    params.since = options.since;
  }
  if (options.includeExpired !== undefined) {
    params.includeExpired = options.includeExpired;
  }
  try {
    const response = await client.get<SalesforceMemberListResponse | SalesforceErrorBody>(`/api/groups/${encodeURIComponent(options.groupCode)}/members`, { params });
    const latencyMs = dateTimeNowAsValue() - startedAt;
    if (response.status >= 200 && response.status < 300) {
      return { status: response.status, data: response.data as SalesforceMemberListResponse, latencyMs };
    }
    const errorBody = response.data as SalesforceErrorBody;
    return {
      status: response.status,
      errorCode: errorBody?.error?.code || `HTTP_${response.status}`,
      errorMessage: errorBody?.error?.message || `Unexpected status ${response.status}`,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = dateTimeNowAsValue() - startedAt;
    const axiosError = error as AxiosError;
    return {
      status: axiosError.response?.status || 0,
      errorCode: axiosError.code || "NETWORK_ERROR",
      errorMessage: axiosError.message || String(error),
      latencyMs,
    };
  }
}
