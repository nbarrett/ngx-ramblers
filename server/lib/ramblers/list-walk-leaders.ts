import {
  Contact,
  EventsListRequest,
  RamblersGroupEventsRawApiResponse
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { GroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { omit, isEmpty, groupBy, map, first } from "es-toolkit/compat";
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

function identity(walkLeader: Contact): string {
  return walkLeader.id || walkLeader.telephone || walkLeader.name;
}

function toWalkLeaders(response: RamblersGroupEventsRawApiResponse): Contact[] {
  let unNamedIndex = 0;
  debugLog("toWalkLeaders:", response);
  const filteredWalkLeaders: Contact[] = response.data.map((groupEvent: GroupEvent) => omit(groupEvent.walk_leader, ["email_form"])).filter(item => !isEmpty(identity(item)));
  const groupedWalkLeaders = groupBy(filteredWalkLeaders, (walkLeader => identity(walkLeader)));
  debugLog("groupedWalkLeaders:", groupedWalkLeaders);
  return map(groupedWalkLeaders, (items, key) => {
    const result: Contact = first(items.sort((a, b) => b.name.length - a.name.length));
    if (isEmpty(result.name)) {
      unNamedIndex++;
      result.name = `Unknown Leader ${unNamedIndex}`;
    }
    debugLog("result:", result, "from items:", items, "key:", key);
    return result;
  });
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
    mapper: toWalkLeaders
  })
    .then((response: WalkLeadersApiResponse) => {
      debugLog("returned:", pluraliseWithCount(response.response.length, "walk leader"));
      return response;
    })
    .then(response => res.json(response))
    .catch(error => res.json(error));
}
