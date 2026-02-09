import debug from "debug";
import { startCase } from "es-toolkit/compat";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import {
  EmailRoutingLogEntry,
  EmailRoutingLogsRequest,
  WorkerInvocationSummary,
  WorkerLogsRequest
} from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("cloudflare:analytics"));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace("cloudflare:analytics"));
errorDebugLog.enabled = true;

const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

function humaniseStatus(status: string): string {
  if (!status) {
    return "";
  }
  return startCase(status);
}

function headers(apiToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  };
}

interface GraphQLResponse<T> {
  data: T;
  errors?: { message: string }[];
}

interface EmailRoutingGraphQLData {
  viewer: {
    zones: {
      emailRoutingAdaptive: {
        datetime: string;
        sessionId: string;
        from: string;
        to: string;
        status: string;
        spf: string;
        dkim: string;
        dmarc: string;
        errorDetail: string;
      }[];
    }[];
  };
}

interface WorkerInvocationsGraphQLData {
  viewer: {
    accounts: {
      workersInvocationsAdaptive: {
        sum: {
          requests: number;
          errors: number;
          subrequests: number;
        };
        dimensions: {
          datetime: string;
          scriptName: string;
          status: string;
        };
      }[];
    }[];
  };
}

export async function queryEmailRoutingLogs(cloudflareConfig: CloudflareConfig, request: EmailRoutingLogsRequest): Promise<EmailRoutingLogEntry[]> {
  const limit = request.limit || 100;
  const filterParts = [
    `datetime_geq: "${request.startDate}"`,
    `datetime_leq: "${request.endDate}"`
  ];
  if (request.recipientEmail) {
    filterParts.push(`to: "${request.recipientEmail}"`);
  }

  const query = `query {
  viewer {
    zones(filter: {zoneTag: "${cloudflareConfig.zoneId}"}) {
      emailRoutingAdaptive(
        limit: ${limit},
        filter: {${filterParts.join(", ")}},
        orderBy: [datetime_DESC]
      ) {
        datetime
        sessionId
        from
        to
        status
        spf
        dkim
        dmarc
        errorDetail
      }
    }
  }
}`;

  debugLog("Querying email routing logs with filter:", filterParts.join(", "));

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: headers(cloudflareConfig.apiToken),
    body: JSON.stringify({query})
  });

  const data: GraphQLResponse<EmailRoutingGraphQLData> = await response.json();
  debugLog("Email routing logs response status: %d, has errors: %s", response.status, !!(data.errors?.length));

  if (data.errors?.length) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    errorDebugLog("Failed to query email routing logs: %s, full response: %o", errorMsg, data);
    throw new Error(`Failed to query email routing logs: ${errorMsg}`);
  }

  if (!data.data) {
    errorDebugLog("Email routing logs response has no data field. Full response: %o", data);
    throw new Error("Email routing logs response has no data field");
  }

  const zones = data.data?.viewer?.zones || [];
  const entries = zones[0]?.emailRoutingAdaptive || [];
  debugLog("Found %d email routing log entries", entries.length);

  return entries.map(entry => ({
    datetime: entry.datetime,
    sessionId: entry.sessionId,
    from: entry.from,
    to: entry.to,
    status: humaniseStatus(entry.status),
    spf: entry.spf,
    dkim: entry.dkim,
    dmarc: entry.dmarc,
    errorDetail: entry.errorDetail
  }));
}

export async function queryWorkerInvocationLogs(cloudflareConfig: CloudflareConfig, request: WorkerLogsRequest): Promise<WorkerInvocationSummary[]> {
  const limit = request.limit || 100;
  const filterParts = [
    `datetime_geq: "${request.startDate}"`,
    `datetime_leq: "${request.endDate}"`
  ];
  if (request.scriptName) {
    filterParts.push(`scriptName: "${request.scriptName}"`);
  }

  const query = `query {
  viewer {
    accounts(filter: {accountTag: "${cloudflareConfig.accountId}"}) {
      workersInvocationsAdaptive(
        limit: ${limit},
        filter: {${filterParts.join(", ")}},
        orderBy: [datetime_DESC]
      ) {
        sum {
          requests
          errors
          subrequests
        }
        dimensions {
          datetime
          scriptName
          status
        }
      }
    }
  }
}`;

  debugLog("Querying worker invocation logs with filter:", filterParts.join(", "));

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: headers(cloudflareConfig.apiToken),
    body: JSON.stringify({query})
  });

  const data: GraphQLResponse<WorkerInvocationsGraphQLData> = await response.json();
  debugLog("Worker invocation logs response status: %d, has errors: %s", response.status, !!(data.errors?.length));

  if (data.errors?.length) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    errorDebugLog("Failed to query worker invocation logs: %s, full response: %o", errorMsg, data);
    throw new Error(`Failed to query worker invocation logs: ${errorMsg}`);
  }

  if (!data.data) {
    errorDebugLog("Worker invocation logs response has no data field. Full response: %o", data);
    throw new Error("Worker invocation logs response has no data field");
  }

  const accounts = data.data?.viewer?.accounts || [];
  const invocations = accounts[0]?.workersInvocationsAdaptive || [];
  debugLog("Found %d worker invocation entries", invocations.length);

  return invocations.map(entry => ({
    datetime: entry.dimensions.datetime,
    scriptName: entry.dimensions.scriptName,
    status: entry.dimensions.status,
    requests: entry.sum.requests,
    errors: entry.sum.errors,
    subrequests: entry.sum.subrequests
  }));
}
