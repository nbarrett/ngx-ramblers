import debug from "debug";
import first from "lodash/first";
import isEmpty from "lodash/isEmpty";
import moment from "moment-timezone";
import {
  ALL_EVENT_TYPES,
  Contact,
  DateFormat,
  EventsListRequest,
  RamblersEventsApiResponse,
  RamblersGroupEventsRawApiResponse,
  RamblersEventSummaryResponse,
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
import { lastItemFrom, pluraliseWithCount, toKebabCase } from "../shared/string-utils";
import { momentNow } from "../shared/dates";
import { GroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";

const debugLog = debug(envConfig.logNamespace("ramblers:walks-and-events"));
const noopDebugLog = debug(envConfig.logNamespace("ramblers:walks-and-events"));
noopDebugLog.enabled = false;
debugLog.enabled = true;

function identity(walkLeader: Contact): string {
  return walkLeader.id || walkLeader.telephone || walkLeader.name;
}

function toWalkLeaders(response: RamblersGroupEventsRawApiResponse): Contact[] {
  let unNamedIndex = 0;
  noopDebugLog("toWalkLeaders:", response);
  const filteredWalkLeaders: Contact[] = response.data.map((groupEvent: GroupEvent) => omit(groupEvent.walk_leader, ["email_form"])).filter(item => !isEmpty(identity(item)));
  const groupedWalkLeaders = groupBy(filteredWalkLeaders, (walkLeader => identity(walkLeader)));
  noopDebugLog("groupedWalkLeaders:", groupedWalkLeaders);
  return map(groupedWalkLeaders, (items, key) => {
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
  debugLog("walkLeaders:body:", body);
  systemConfig()
    .then((systemConfig: SystemConfig) => {
      const limit = body.limit;
      const date = dateParameter(body);
      const dateEnd = dateEndParameter(body);
      const defaultOptions = requestDefaults.createApiRequestOptions(systemConfig);
      debugLog("walkLeaders:defaultOptions:", defaultOptions);
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

function identifierLooksLikeASlug(body: EventsListRequest) {
  const value = body.ids?.[0] ?? "";
  const looksLikeASlug = /[\s-]/.test(value);
  debugLog("identifierLooksLikeASlug:", value, "returning:", looksLikeASlug);
  return looksLikeASlug;
}

export function listEvents(req: Request, res: Response): void {
  const body: EventsListRequest = req.body;
  const rawData: boolean = body.rawData;
  debugLog("listEvents:body:", body);
  const limit = body.limit;
  const ids = body.ids?.join(",");
  if (body.ids && body.ids.length === 1 && identifierLooksLikeASlug(body)) {
    req.query.slug = body.ids[0];
    return findEventsBySlug(req, res);
  } else {
    const sort = body.sort;
    const order = body.order;
    const date = dateParameter(body);
    const dateEnd = dateEndParameter(body);
    try {
      systemConfig()
        .then((systemConfig: SystemConfig) => {
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
            mapper: rawData ? null : transformEventsResponse(systemConfig)
          });
        })
        .then(response => {
          if (rawData) {
            const rawResponse = response as RamblersEventsApiResponse;
            debugLog("returned response summary:", rawResponse?.response?.summary);
          } else {
            const rawResponse = response as unknown as RamblersEventSummaryResponse[];
            debugLog("returned response summary:", rawResponse.length, "results");
          }
          return response;
        })
        .then(response => res.json(response))
        .catch(error => res.json(error));
    } catch (error) {
      debugLog("error:", error);
      res.json(error);
    }
  }
}

function findEventsBySlug(req: Request, res: Response): void {
  const slug = req.query.slug as string;
  if (!slug) {
    debugLog("findEventsBySlug: Missing slug in request body");
    res.status(400).json({error: "query parameter is required"});
  }
  debugLog("findEventsBySlug:slug:", slug);
  try {
    systemConfig()
      .then((systemConfig: SystemConfig) => {
        const groupCode = systemConfig?.group?.groupCode;
        if (!groupCode) {
          debugLog("findEventsBySlug: No group code configured");
          return Promise.reject({error: "No group code configured"});
        }

        const date = moment(WALKS_MANAGER_GO_LIVE_DATE).tz("Europe/London").startOf("day").format(DateFormat.WALKS_MANAGER_API);
        const dateEnd = momentNow().add(12, "month").format(DateFormat.WALKS_MANAGER_API);
        const limit = 300;
        const types = ALL_EVENT_TYPES;
        const defaultOptions = requestDefaults.createApiRequestOptions(systemConfig);
        debugLog("findEventsBySlug:defaultOptions:", defaultOptions);

        const optionalParameters = [
          optionalParameter("groups", groupCode),
          optionalParameter("types", types),
          optionalParameter("limit", limit),
          optionalParameter("date", date),
          optionalParameter("date_end", dateEnd)
        ].filter(item => !isEmpty(item)).join("&");

        debugLog("findEventsBySlug:optionalParameters:", optionalParameters);

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
          mapper: (response: RamblersGroupEventsRawApiResponse) => {
            debugLog("findEventsBySlug:response summary:", response.summary);
            const kebabCaseSlug = toKebabCase(slug);
            const filteredResponse = response.data.filter((event: GroupEvent) => {
              const kebabCaseTitle = toKebabCase(event.title);
              const urlPathLastSegment = lastItemFrom(event.url);
              const matched = urlPathLastSegment.includes(slug) || kebabCaseTitle === kebabCaseSlug;
              if (matched) {
                noopDebugLog("event:", event.url, "slug:", slug, "kebabCaseTitle:", kebabCaseTitle);
                noopDebugLog("findEventsBySlug: Found event:", event);
                return event;
              }
            });
            const mappedResponse: RamblersGroupEventsRawApiResponse = {...response, data: filteredResponse};
            debugLog("findEventsBySlug:filteredResponse length:", filteredResponse.length, "of", response.data.length, "for slug:", slug, "mappedResponse:", mappedResponse);
            return mappedResponse;
          }
        });
      })
      .then((response: any) => {
        if (!response.response) {
          debugLog("findEventsBySlug: No event found for slug:", slug);
          res.status(404).json({error: `Event not found for slug: ${slug}`});
        } else {
          debugLog("findEventsBySlug: event found for slug:", slug, response);
          res.json(response);
        }
      });
  } catch (error) {
    debugLog("findEventsBySlug:error:", error);
    res.status(500).json({error: "Internal server error"});
  }
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

function transformEventsResponse(systemConfig: SystemConfig): (response: RamblersGroupEventsRawApiResponse) => RamblersEventSummaryResponse[] {
  return (response: RamblersGroupEventsRawApiResponse): RamblersEventSummaryResponse[] => {
    debugLog("transformEventsResponse:", response);
    return response.data.map(event => {
      debugLog("transformEventsResponse:event:", event);
      const walkMoment = moment(event.start_date_time, moment.ISO_8601).tz("Europe/London");
      return {
        id: event.id,
        url: event.url,
        walksManagerUrl: event.url.replace(systemConfig.national.mainSite.href, systemConfig.national.walksManager.href),
        title: event.title,
        startDate: walkMoment.format("dddd, Do MMMM YYYY"),
        startDateValue: walkMoment.valueOf(),
        start_location: event.start_location,
        end_location: event.end_location,
        media: event.media
      };
    });
  };
}
