import debug from "debug";
import first from "lodash/first";
import isEmpty from "lodash/isEmpty";
import moment from "moment-timezone";
import {
  Contact,
  DateFormat,
  EventsListRequest,
  GroupWalk,
  RamblersWalkResponse,
  RamblersWalksRawApiResponse,
  RamblersWalksRawApiResponseApiResponse,
  WALKS_MANAGER_GO_LIVE_DATE
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { envConfig } from "../env-config/env-config";
import { httpRequest, optionalParameter } from "../shared/message-handlers";
import * as requestDefaults from "./request-defaults";
import groupBy from "lodash/groupBy";
import map from "lodash/map";
import { systemConfig } from "../config/system-config";
import { Request, Response } from "express";
import { WalkLeadersApiResponse } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import omit from "lodash/omit";
import { pluraliseWithCount } from "../shared/string-utils";
import { momentNow } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("ramblers:walks-and-events"));
const noopDebugLog = debug(envConfig.logNamespace("ramblers:walks-and-events"));
noopDebugLog.enabled = false;
debugLog.enabled = false;


function identity(walkLeader: Contact) {
  return walkLeader.id || walkLeader.telephone || walkLeader.name;
}

function toWalkLeaders(response: RamblersWalksRawApiResponse): Contact[] {
  let unNamedIndex = 0;
  noopDebugLog("transformListWalksResponse:", response);
  const filteredWalkLeaders: Contact[] = response.data.map((walk: GroupWalk) => omit(walk.walk_leader, ["email_form"])).filter(item => !isEmpty(identity(item)));
  const groupedWalkLeaders = groupBy(filteredWalkLeaders, (walkLeader => identity(walkLeader)));
  noopDebugLog("groupedWalkLeaders:", groupedWalkLeaders);
  return map(groupedWalkLeaders, (items, key, index) => {
    const result: Contact = first(items.sort((a, b) => b.name.length - a.name.length));
    if (isEmpty(result.name)) {
      unNamedIndex++;
      result.name = `Unknown Leader ${unNamedIndex}`;
    }
    noopDebugLog("result:", result, "from items:", items, "key:", key);
    return result;
  });
}

export function walkLeaders(req: Request, res: Response): void {
  const body: EventsListRequest = req.body;
  debugLog("listEvents:body:", body);
  systemConfig()
    .then((systemConfig: SystemConfig) => {
      const limit = body.limit;
      const date = dateParameter(body);
      const dateEnd = dateEndParameter(body);
      const defaultOptions = requestDefaults.createApiRequestOptions(systemConfig);
      debugLog("listEvents:defaultOptions:", defaultOptions);
      const optionalParameters = [
        optionalParameter("groups", systemConfig?.group?.groupCode),
        optionalParameter("types", body.types),
        optionalParameter("limit", limit),
        optionalParameter("date", date),
        optionalParameter("date_end", dateEnd)]
        .filter(item => !isEmpty(item))
        .join("&");
      debugLog("optionalParameters:", optionalParameters);
      return httpRequest({
        apiRequest: {
          hostname: defaultOptions.hostname,
          protocol: defaultOptions.protocol,
          headers: defaultOptions.headers,
          method: "get",
          path: `/api/volunteers/walksevents?api-key=${systemConfig?.national?.walksManager?.apiKey}&${optionalParameters}`
        },
        debug: noopDebugLog,
        res,
        req,
        mapper: toWalkLeaders
      });
    })
    .then((response: WalkLeadersApiResponse) => {
      debugLog("returned:", pluraliseWithCount(response.response.length, "walk leader"));
      return response;
    })
    .then(response => res.json(response))
    .catch(error => res.json(error));
}

export function listEvents(req: Request, res: Response): void {
  const body: EventsListRequest = req.body;
  const rawData: boolean = body.rawData;
  debugLog("listEvents:body:", body);
  systemConfig()
    .then((systemConfig: SystemConfig) => {
      const limit = body.limit;
      const ids = body.ids?.join(",");
      const sort = body.sort;
      const order = body.order;
      const date = dateParameter(body);
      const dateEnd = dateEndParameter(body);
      const defaultOptions = requestDefaults.createApiRequestOptions(systemConfig);
      debugLog("listEvents:defaultOptions:", defaultOptions);
      const optionalParameters = [
        optionalParameter("groups", body.groupCode || systemConfig?.group?.groupCode),
        optionalParameter("types", body.types),
        optionalParameter("ids", ids),
        optionalParameter("limit", limit),
        optionalParameter("sort", sort),
        optionalParameter("order", order),
        optionalParameter("date", date),
        optionalParameter("date_end", dateEnd)]
        .filter(item => !isEmpty(item))
        .join("&");
      debugLog("optionalParameters:", optionalParameters);
      return httpRequest({
        apiRequest: {
          hostname: defaultOptions.hostname,
          protocol: defaultOptions.protocol,
          headers: defaultOptions.headers,
          method: "get",
          path: `/api/volunteers/walksevents?api-key=${systemConfig?.national?.walksManager?.apiKey}&${optionalParameters}`
        },
        debug: noopDebugLog,
        res,
        req,
        mapper: rawData ? null : transformListWalksResponse(systemConfig)
      });
    })
    .then(response => {
      if (rawData) {
        const rawResponse = response as RamblersWalksRawApiResponseApiResponse;
        debugLog("returned response summary:", rawResponse?.response?.summary);
      } else {
        const rawResponse = response as unknown as RamblersWalkResponse[];
        debugLog("returned response summary:", rawResponse.length, "results");
      }
      return response;
    })
    .then(response => res.json(response))
    .catch(error => res.json(error));
}

function dateParameter(body: EventsListRequest): string {
  if (body?.ids?.length > 0) {
    const dateParameter = moment(WALKS_MANAGER_GO_LIVE_DATE).tz("Europe/London").startOf("day").format(DateFormat.WALKS_MANAGER_API);
    debugLog("returning dateParameter:", dateParameter, "given id request:", body.ids, "and dateEnd:", body.date);
    return dateParameter;
  } else {
    debugLog("returning dateParameter:", body.date, "given id request:", body.ids);
    return body.date;
  }
}

function dateEndParameter(body: EventsListRequest): string {
  if (body?.ids?.length > 0) {
    const dateEndParameter = momentNow().add(12, "month").format(DateFormat.WALKS_MANAGER_API);
    debugLog("returning dateEndParameter:", dateEndParameter, "given id request:", body.ids, "and dateEnd:", body.dateEnd);
    return dateEndParameter;
  } else {
    debugLog("returning dateEndParameter:", body.dateEnd, "given id request:", body.ids);
    return body.dateEnd;
  }
}

function transformListWalksResponse(systemConfig: SystemConfig) {
  return function (response: RamblersWalksRawApiResponse): RamblersWalkResponse[] {
    debugLog("transformListWalksResponse:", response);
    return response.data.map(walk => {
      debugLog("transformListWalksResponse:walk:", response);
      const walkMoment = moment(walk.start_date_time, moment.ISO_8601).tz("Europe/London");
      return {
        id: walk.id,
        url: walk.url,
        walksManagerUrl: walk.url.replace(systemConfig.national.mainSite.href, systemConfig.national.walksManager.href),
        title: walk.title,
        startDate: walkMoment.format("dddd, Do MMMM YYYY"),
        startDateValue: walkMoment.valueOf(),
        start_location: walk.start_location,
        end_location: walk.end_location,
        media: walk.media
      };
    });
  };
}

