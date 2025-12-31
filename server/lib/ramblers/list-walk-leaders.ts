import {
  Contact,
  WalkLeaderContact,
  EventsListRequest,
  RamblersGroupEventsRawApiResponse
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { GroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { omit, isEmpty, groupBy, map, first, kebabCase } from "es-toolkit/compat";
import { Request, Response } from "express";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";
import * as requestDefaults from "./request-defaults";
import { httpRequest, optionalParameter } from "../shared/message-handlers";
import { WalkLeadersApiResponse } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { pluraliseWithCount } from "../shared/string-utils";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { dateEndParameter, dateParameter, limitFor } from "./parameters";

const debugLog = debug(envConfig.logNamespace("ramblers:list-walk-leaders"));
debugLog.enabled = false;

interface WalkLeaderWithGroup extends WalkLeaderContact {
  groupCode?: string;
  groupName?: string;
}

function removeTrailingDot(name: string): string {
  return (name || "").replace(/\.$/, "").trim();
}

function groupPrefix(groupCode?: string): string {
  if (!groupCode) {
    return "";
  }
  const trimmed = groupCode.trim().toLowerCase();
  const match = trimmed.match(/^([a-z]+)(\d.*)$/i);
  if (match) {
    return `${match[1].toLowerCase()}-${match[2].toLowerCase()}`;
  }
  return trimmed;
}

function identity(walkLeader: WalkLeaderWithGroup): string {
  const prefix = groupPrefix(walkLeader.groupCode);
  const baseName = removeTrailingDot(walkLeader.name);
  if (baseName) {
    return prefix ? `${prefix} ${baseName}` : baseName;
  }
  if (walkLeader.telephone) {
    return prefix ? `${prefix} ${walkLeader.telephone}` : walkLeader.telephone;
  }
  if (walkLeader.id) {
    return prefix ? `${prefix} ${walkLeader.id}` : walkLeader.id;
  }
  return prefix;
}

function toWalkLeadersWithConfig(config: SystemConfig) {
  const configuredGroupCode = config?.group?.groupCode || "";
  const isAreaMode = configuredGroupCode.length === 2;
  const hasMultipleGroups = configuredGroupCode.includes(",");
  const showGroupName = isAreaMode || hasMultipleGroups;

  return function toWalkLeaders(response: RamblersGroupEventsRawApiResponse): WalkLeaderContact[] {
    let unNamedIndex = 0;
    debugLog("toWalkLeaders:", response);
    const filteredWalkLeaders: WalkLeaderWithGroup[] = response.data
      .map((groupEvent: GroupEvent) => ({
        ...omit(groupEvent.walk_leader, ["email_form"]),
        groupCode: groupEvent.group_code,
        groupName: groupEvent.group_name
      }))
      .filter(item => !isEmpty(identity(item)));
    const groupedWalkLeaders = groupBy(filteredWalkLeaders, (walkLeader => identity(walkLeader)));
    debugLog("groupedWalkLeaders:", groupedWalkLeaders);
    return map(groupedWalkLeaders, (items, key) => {
      const sortedItems = items.sort((a, b) => (b.name || "").length - (a.name || "").length);
      const firstItem = first(sortedItems);
      const cleanedName = removeTrailingDot(firstItem.name);
      const displayName = showGroupName && firstItem.groupName
        ? `${cleanedName} (${firstItem.groupName})`
        : cleanedName;
      const slug = kebabCase(key);
      const contactId = firstItem.id || slug;
      const result: WalkLeaderContact = {
        ...firstItem,
        name: displayName,
        id: contactId,
        slug
      };
      if (isEmpty(cleanedName)) {
        unNamedIndex++;
        result.name = `Unknown Leader ${unNamedIndex}`;
      }
      debugLog("result:", result, "from items:", items, "key:", key);
      return result;
    });
  };
}

export async function walkLeaders(req: Request, res: Response): Promise<void> {
  const body: EventsListRequest = req.body;
  debugLog("walkLeaders:body:", body);
  const config: SystemConfig = await systemConfig();
  const limit = limitFor(req.body);
  const date = dateParameter(body, debugLog);
  const dateEnd = dateEndParameter(body, debugLog);
  const defaultOptions = requestDefaults.createApiRequestOptions(config);
  debugLog("walkLeaders:defaultOptions:", defaultOptions);
  const optionalParameters = [
    optionalParameter("groups", config?.group?.groupCode),
    optionalParameter("types", body.types),
    optionalParameter("limit", limit),
    optionalParameter("date", date),
    optionalParameter("date_end", dateEnd)]
    .filter(item => !isEmpty(item))
    .join("&");
  debugLog("optionalParameters:", optionalParameters);
  httpRequest({
    apiRequest: {
      hostname: defaultOptions.hostname,
      protocol: defaultOptions.protocol,
      headers: defaultOptions.headers,
      method: "get",
      path: `/api/volunteers/walksevents?api-key=${config?.national?.walksManager?.apiKey}&${optionalParameters}`
    },
    debug: debugLog,
    res,
    req,
    mapper: toWalkLeadersWithConfig(config)
  })
    .then((response: WalkLeadersApiResponse) => {
      debugLog("returned:", pluraliseWithCount(response.response.length, "walk leader"));
      return response;
    })
    .then(response => res.json(response))
    .catch(error => res.json(error));
}
