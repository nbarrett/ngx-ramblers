import debug from "debug";
import { GroupListRequest, RamblersGroupsApiResponse } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { envConfig } from "../env-config/env-config";
import { httpRequest } from "../shared/message-handlers";
import * as requestDefaults from "./request-defaults";
import { systemConfig } from "../config/system-config";
import { limitFor } from "./parameters";
import { isArray } from "es-toolkit/compat";
import { Request, Response } from "express";

const debugLog = debug(envConfig.logNamespace("ramblers:list-groups"));
debugLog.enabled = false;

function extractGroupsFromPayload(payload: any): RamblersGroupsApiResponse[] {
  if (Array.isArray(payload)) {
    return payload as RamblersGroupsApiResponse[];
  }

  if (Array.isArray(payload?.response)) {
    return payload.response as RamblersGroupsApiResponse[];
  }

  if (Array.isArray(payload?.data)) {
    return payload.data as RamblersGroupsApiResponse[];
  }

  return [];
}

async function requestRamblersGroups(groups: string[], req?: Request, res?: Response) {
  const config: SystemConfig = await systemConfig();

  const body: GroupListRequest = {
    groups,
    limit: limitFor({ groups } as GroupListRequest)
  };

  const joinedGroups = body.groups.join(",");
  const defaultOptions = requestDefaults.createApiRequestOptions(config);
  debugLog("listGroups:defaultOptions:", defaultOptions, "groups:", joinedGroups, "limit:", body.limit);

  return httpRequest({
    apiRequest: {
      hostname: defaultOptions.hostname,
      protocol: defaultOptions.protocol,
      headers: defaultOptions.headers,
      method: "get",
      path: `/api/volunteers/groups?limit=${body.limit}&groups=${encodeURIComponent(joinedGroups)}&api-key=${encodeURIComponent(config?.national?.walksManager?.apiKey)}`
    },
    debug: debugLog,
    res,
    req,
    successStatusCodes: [200]
  });
}

export async function fetchRamblersGroupsFromApi(groups: string[]): Promise<RamblersGroupsApiResponse[]> {
  if (!groups || groups.length === 0) {
    return [];
  }

  const response = await requestRamblersGroups(groups);
  return extractGroupsFromPayload((response as any)?.response);
}

export function listGroups(req, res): void {
  const groups: string[] = isArray(req.body?.groups) ? req.body.groups : [];
  requestRamblersGroups(groups, req, res)
    .then(response => res.json(response))
    .catch(error => res.json(error));
}
