import { Request, Response } from "express";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";
import moment from "moment-timezone";
import {
  ALL_EVENT_TYPES,
  DateFormat,
  RamblersGroupEventsRawApiResponse,
  WALKS_MANAGER_GO_LIVE_DATE
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { momentNow } from "../shared/dates";
import * as requestDefaults from "./request-defaults";
import { lastItemFrom, toKebabCase } from "../shared/string-utils";
import { httpRequest, optionalParameter } from "../shared/message-handlers";
import isEmpty from "lodash/isEmpty";
import { GroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { limitFor } from "./parameters";

const debugLog = debug(envConfig.logNamespace("ramblers:list-events-by-slug"));
const noopDebugLog = debug(envConfig.logNamespace("ramblers:list-events-by-slug"));
noopDebugLog.enabled = true;
debugLog.enabled = false;

export async function listEventsBySlug(req: Request, res: Response): Promise<void> {
  const slug = req.query.slug as string;
  if (!slug) {
    noopDebugLog("listEventsBySlug: Missing slug in request body");
    res.status(400).json({error: "query parameter is required"});
    return;
  }
  noopDebugLog("listEventsBySlug:slug:", slug);

  try {
    const config: SystemConfig = await systemConfig();
    const groupCode = config?.group?.groupCode;
    if (!groupCode) {
      noopDebugLog("listEventsBySlug: No group code configured");
      res.status(400).json({error: "No group code configured"});
      return;
    }

    const date = moment(WALKS_MANAGER_GO_LIVE_DATE).tz("Europe/London").startOf("day").format(DateFormat.WALKS_MANAGER_API);
    const dateEnd = momentNow().add(12, "month").format(DateFormat.WALKS_MANAGER_API);
    const limit = limitFor(req.body);
    const types = ALL_EVENT_TYPES;
    const defaultOptions = requestDefaults.createApiRequestOptions(config);
    noopDebugLog("listEventsBySlug:defaultOptions:", defaultOptions);

    let offset = 0;
    const kebabCaseSlug = toKebabCase(slug);

    while (true) {
      const parameters = [
        optionalParameter("groups", groupCode),
        optionalParameter("types", types),
        optionalParameter("limit", limit),
        optionalParameter("offset", offset),
        optionalParameter("date", date),
        optionalParameter("date_end", dateEnd)
      ].filter(item => !isEmpty(item)).join("&");

      noopDebugLog("listEventsBySlug:parameters:", parameters);

      const response: any = await httpRequest({
        apiRequest: {
          hostname: defaultOptions.hostname,
          protocol: defaultOptions.protocol,
          headers: defaultOptions.headers,
          method: "get",
          path: `/api/volunteers/walksevents?api-key=${config?.national?.walksManager?.apiKey}&${parameters}`
        },
        debug: debugLog,
        res,
        req,
        mapper: (rawResponse: RamblersGroupEventsRawApiResponse): RamblersGroupEventsRawApiResponse => {
          debugLog("listEventsBySlug:raw response:", JSON.stringify(rawResponse, null, 2));
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
      });

      debugLog("listEventsBySlug:processed response:", JSON.stringify(response, null, 2));

      if (!response || !response.response || !response.response.data || !response.response.summary) {
        debugLog("listEventsBySlug: Invalid processed response structure:", response);
        res.status(500).json({error: "Invalid API response structure"});
        break;
      }

      const {data, summary} = response.response as RamblersGroupEventsRawApiResponse;

      if (data.length > 0) {
        debugLog("listEventsBySlug: event found for slug:", slug, "response:", response);
        res.json(response);
        break;
      } else {
        const {total, limit: responseLimit} = summary;
        offset += responseLimit;
        if (offset >= total) {
          noopDebugLog("listEventsBySlug: No event found for slug:", slug, "in queried", total, "events");
          res.json(response);
          break;
        }
        noopDebugLog("listEventsBySlug: No event found matching", slug, "on current page - increasing offset to", offset);
      }
    }
  } catch (error) {
    noopDebugLog("listEventsBySlug:error:", error);
    res.status(500).json({error: "Internal server error"});
  }
}
