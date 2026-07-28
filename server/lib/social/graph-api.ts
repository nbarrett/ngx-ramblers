import * as messageHandlers from "../shared/message-handlers";
import { isArray, toPairs } from "es-toolkit/compat";
import { GraphApiMethod } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";

export const GRAPH_API_VERSION = "v21.0";
export const GRAPH_API_HOST = "graph.facebook.com";

export interface GraphApiCall {
  method: GraphApiMethod;
  path: string;
  params?: Record<string, any>;
  debug: (...args: any) => void;
}

function queryString(params: Record<string, any>): string {
  return toPairs(params || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${encodeURIComponent(isArray(value) ? value.join(",") : value)}`)
    .join("&");
}

export async function graphApiRequest({method, path, params, debug}: GraphApiCall): Promise<any> {
  const query = queryString(params);
  const fullPath = `https://${GRAPH_API_HOST}/${GRAPH_API_VERSION}${path}${query ? `?${query}` : ""}`;
  const response: any = await messageHandlers.httpRequest({
    apiRequest: {
      hostname: GRAPH_API_HOST,
      protocol: "https:",
      headers: {"Content-Type": "application/json; charset=utf-8"},
      method,
      path: fullPath
    },
    successStatusCodes: [200, 201],
    debug
  });
  const body = response?.response;
  if (body?.error) {
    throw new Error(`${body.error.type || "GraphApiError"}: ${body.error.message} (code ${body.error.code})`);
  }
  return body;
}

export function delay(millis: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, millis));
}
