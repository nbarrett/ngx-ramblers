import { Request } from "express";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";
import { DateTime } from "luxon";
import {
  ALL_EVENT_TYPES,
  DateFormat,
  RamblersEventsApiResponse,
  RamblersGroupEventsRawApiResponse,
  WALKS_MANAGER_GO_LIVE_DATE
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { dateTimeNow } from "../shared/dates";
import * as requestDefaults from "./request-defaults";
import { lastItemFrom, pluraliseWithCount, toKebabCase } from "../shared/string-utils";
import { httpRequest, optionalParameter } from "../shared/message-handlers";
import isEmpty from "lodash/isEmpty";
import { GroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { limitFor } from "./parameters";

const debugLog = debug(envConfig.logNamespace("ramblers:list-events-by-slug"));
const noopDebugLog = debug(envConfig.logNamespace("ramblers:list-events-by-slug-noop"));
noopDebugLog.enabled = false;
debugLog.enabled = true;

export async function listEventsBySlug(req: Request, suppliedSlug?: string): Promise<RamblersEventsApiResponse> {
  const slug = suppliedSlug || req.query.slug as string;
  if (!slug) {
    noopDebugLog("listEventsBySlug: Missing slug in request body");
    throw new Error("No slug provided");
  }
  noopDebugLog("listEventsBySlug:slug:", slug);

  const config: SystemConfig = await systemConfig();
  const groupCode = config?.group?.groupCode;
  if (!groupCode) {
    noopDebugLog("listEventsBySlug: No group code configured");
    throw new Error("No group code configured");
  }
  const date = DateTime.fromISO(WALKS_MANAGER_GO_LIVE_DATE).setZone("Europe/London").startOf("day").toFormat(DateFormat.WALKS_MANAGER_API);
  const dateEnd = dateTimeNow().plus({ months: 12 }).toFormat(DateFormat.WALKS_MANAGER_API);
  const limit = limitFor(req.body);
  const types = ALL_EVENT_TYPES;
  const defaultOptions = requestDefaults.createApiRequestOptions(config);
  noopDebugLog("listEventsBySlug:defaultOptions:", defaultOptions);

  let offset = 0;
  const kebabCaseSlug = toKebabCase(slug);

  while (true) {
    const parameters = [
      optionalParameter("groups", [req.body.groupCode, groupCode].filter(Boolean).join(",")),
      optionalParameter("types", types),
      optionalParameter("limit", limit),
      optionalParameter("offset", offset),
      optionalParameter("date", date),
      optionalParameter("date_end", dateEnd)
    ].filter(item => !isEmpty(item)).join("&");

    noopDebugLog("listEventsBySlug:parameters:", parameters);

    const response: RamblersEventsApiResponse = await httpRequest({
      apiRequest: {
        hostname: defaultOptions.hostname,
        protocol: defaultOptions.protocol,
        headers: defaultOptions.headers,
        method: "get",
        path: `/api/volunteers/walksevents?api-key=${config?.national?.walksManager?.apiKey}&${parameters}`
      },
      debug: noopDebugLog,
      mapper: (rawResponse: RamblersGroupEventsRawApiResponse): RamblersGroupEventsRawApiResponse => {
        noopDebugLog("listEventsBySlug:raw response:", JSON.stringify(rawResponse, null, 2));
        if (!rawResponse || !rawResponse.data || !rawResponse.summary) {
          debugLog("listEventsBySlug: Invalid response structure:", rawResponse);
          throw new Error("Invalid API response structure");
        }
        const filteredResponse = rawResponse.data.filter((event: GroupEvent) => {
          const kebabCaseTitle = toKebabCase(event.title);
          const urlPathLastSegment = lastItemFrom(event.url);
          const matched = urlPathLastSegment.includes(slug) || kebabCaseTitle === kebabCaseSlug;
          if (matched) {
              noopDebugLog("event:", event.url, "slug:", slug, "kebabCaseTitle:", kebabCaseTitle);
              debugLog("listEventsBySlug: Found event:", event);
          }
          return matched;
        });
        debugLog("listEventsBySlug:filteredResponse length:", filteredResponse.length, "of", rawResponse.data.length, "for slug:", slug);
        return {...rawResponse, data: filteredResponse};
      }
    }) as RamblersEventsApiResponse;

    noopDebugLog("listEventsBySlug:processed response:", JSON.stringify(response, null, 2));

    const {data, summary} = response.response;

    if (data.length > 0) {
      debugLog("listEventsBySlug: event found for slug:", slug, pluraliseWithCount(data.length, "response"));
      return response;
    } else {
      const {total, limit: responseLimit} = summary;
      offset += responseLimit;
      if (offset >= total) {
        noopDebugLog("listEventsBySlug: No event found for slug:", slug, "in queried", pluraliseWithCount(total, "event"));
        return response;
      } else {
        noopDebugLog("listEventsBySlug: No event found matching", slug, "on current page - increasing offset to", offset);
      }
    }
  }
}
