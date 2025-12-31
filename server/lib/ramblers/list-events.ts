import debug from "debug";
import { isEmpty } from "es-toolkit/compat";
import {
  ALL_EVENT_TYPES,
  DateFormat,
  EventsListRequest,
  MAXIMUM_PAGE_SIZE,
  RamblersEventsApiResponse,
  RamblersEventSummaryApiResponse,
  RamblersEventSummaryResponse,
  RamblersEventType,
  RamblersGroupEventsRawApiResponse
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { envConfig } from "../env-config/env-config";
import { httpRequest, optionalParameter } from "../shared/message-handlers";
import * as requestDefaults from "./request-defaults";
import { Request, Response } from "express";
import { systemConfig } from "../config/system-config";
import { listEventsBySlug } from "./list-events-by-slug";
import { dateEndParameter, dateParameter, limitFor } from "./parameters";
import { lastItemFrom, pluraliseWithCount, toKebabCase } from "../shared/string-utils";
import {
  ExtendedGroupEvent,
  GroupEvent,
  InputSource
} from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import {
  findBySlug,
  identifierCanBeConvertedToSlug,
  identifierMatchesSlugFormat
} from "../mongo/controllers/extended-group-event";
import { dateTimeFromIso } from "../shared/dates";
import { DateTime } from "luxon";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { cacheEventIfNotFound, cacheEventsWithStats, mapToExtendedGroupEvent } from "../walks/walks-manager-cache";

const debugLog = debug(envConfig.logNamespace("ramblers:list-events"));
const noopDebugLog = debug(envConfig.logNamespace("ramblers:list-events-no-op"));
noopDebugLog.enabled = false;
debugLog.enabled = false;

export async function listEvents(req: Request, res: Response): Promise<void> {
  const body: EventsListRequest = req.body;
  const rawData: boolean = body.rawData;
  const sort = body.sort;
  const order = body.order;
  debugLog("listEvents:body:", body);
  const limit = limitFor(req.body);
  const ids = body.ids?.join(",");
  const inputSource = body.inputSource as InputSource || InputSource.URL_TO_ID_LOOKUP;

  const singleIdentifier = body?.ids?.length === 1 ? body.ids[0] : null;
  if (singleIdentifier && (identifierMatchesSlugFormat(singleIdentifier) || identifierCanBeConvertedToSlug(singleIdentifier))) {
    const slug = singleIdentifier;
    debugLog("slug request received:", slug);
    try {
      const config: SystemConfig = await systemConfig();
      const result = await findBySlug(slug);
      debugLog("findBySlug returned slug:", result?.slug, "id:", result?.document?.id, "url:", result?.document?.groupEvent?.url);
      const groupEvent: ExtendedGroupEvent = result.document;
      if (groupEvent) {
        if (groupEvent.groupEvent?.id) {
          const response: RamblersEventsApiResponse = await queryBasedOnExistingEvent(groupEvent, body, config);
          debugLog("Found cached event for slug:", slug, "groupEvent:", groupEvent, "response:", response);
          res.json(response);
        } else {
          debugLog("Slug matched local event without Ramblers id; returning cached event only");
          const response: RamblersEventsApiResponse = {
            request: {},
            action: ApiAction.QUERY,
            apiStatusCode: 200,
            response: {
              summary: {count: 1, offset: 0, limit: 1, total: 1},
              data: [groupEvent.groupEvent]
            }
          };
          res.json(response);
        }
      } else {
        debugLog("No cached event found for slug:", slug, "querying and saving data");
        const apiResponse: RamblersEventsApiResponse = await listEventsBySlug(req, slug);
        if (!body.suppressEventLinking) {
          if (apiResponse?.response?.data?.length === 1) {
            const event: GroupEvent = apiResponse.response.data[0];
            const kebabCaseSlug = toKebabCase(slug);
            const urlPathLastSegment = lastItemFrom(event.url);
            if (urlPathLastSegment === slug || toKebabCase(event.title) === kebabCaseSlug) {
              await cacheEventIfNotFound(config, event, inputSource);
            } else {
              debugLog("Event URL or title mismatch with slug:", { urlPathLastSegment, kebabCaseSlug, event });
            }
          } else {
            debugLog("listEventsBySlug cannot be cached as there were", pluraliseWithCount(apiResponse?.response?.data?.length, "event"), "returned:", apiResponse?.response?.data);
          }
        }
        res.json(apiResponse);
      }
    } catch (error) {
      const message = `Error processing slug query for ${slug}`;
      debugLog(message, error);
      res.status(500).json({error: message});
    }
  } else {
    try {
      const config: SystemConfig = await systemConfig();
      const defaultOptions = requestDefaults.createApiRequestOptions(config);

      const buildParameters = (offset?: number) => [
        optionalParameter("groups", [body.groupCode, config?.group?.groupCode].filter(Boolean).join(",")),
        optionalParameter("types", body.types || ALL_EVENT_TYPES),
        optionalParameter("ids", ids),
        optionalParameter("limit", limit),
        optionalParameter("offset", offset),
        optionalParameter("sort", sort),
        optionalParameter("order", order),
        optionalParameter("date", dateParameter(body, debugLog)),
        optionalParameter("date_end", dateEndParameter(body, debugLog))
      ].filter(item => !isEmpty(item)).join("&");

      const fetchPage = async (parameters: string) => await httpRequest({
        apiRequest: {
          hostname: defaultOptions.hostname,
          protocol: defaultOptions.protocol,
          headers: defaultOptions.headers,
          method: "get",
          path: `/api/volunteers/walksevents?api-key=${config?.national?.walksManager?.apiKey}&${parameters}`
        },
        debug: noopDebugLog,
        res,
        req
      }) as RamblersEventsApiResponse;

      const cacheEvents = async (events: GroupEvent[]) => {
        if (!body.suppressEventLinking) {
          const {added, updated} = await cacheEventsWithStats(config, events, inputSource);
          debugLog("Cached", pluraliseWithCount(added, "new event"), "and updated",
            pluraliseWithCount(updated, "existing event"), "from",
            pluraliseWithCount(events.length, "event"));
        }
      };

      if (rawData && !ids) {
        let offset = 0;
        const allEvents: GroupEvent[] = [];
        let totalEvents = 0;

        while (true) {
          debugLog(`Fetching page at offset ${offset}, limit ${limit}`);
          const pageResponse = await fetchPage(buildParameters(offset));
          const {data, summary} = pageResponse.response;
          allEvents.push(...data);
          totalEvents = summary.total;
          debugLog(`Fetched ${data.length} events, total so far: ${allEvents.length} of ${totalEvents}`);

          offset += limit;
          if (offset >= totalEvents) {
            debugLog(`Finished pagination: fetched all ${allEvents.length} events`);
            break;
          }
        }

        await cacheEvents(allEvents);

        res.json({
          request: {},
          action: "query" as any,
          apiStatusCode: 200,
          response: {
            summary: {
              count: allEvents.length,
              offset: 0,
              limit: allEvents.length,
              total: totalEvents
            },
            data: allEvents
          }
        });
      } else {
        const response = await httpRequest({
          apiRequest: {
            hostname: defaultOptions.hostname,
            protocol: defaultOptions.protocol,
            headers: defaultOptions.headers,
            method: "get",
            path: `/api/volunteers/walksevents?api-key=${config?.national?.walksManager?.apiKey}&${buildParameters()}`
          },
          debug: noopDebugLog,
          res,
          req,
          mapper: rawData ? null : transformEventsResponse(config)
        });

        if (rawData) {
          const rawResponse = response as RamblersEventsApiResponse;
          await cacheEvents(rawResponse.response.data);
        } else {
          const summaryResponse = response as RamblersEventSummaryApiResponse;
          debugLog("returned response summary:", summaryResponse?.response?.length, "results");
        }

        res.json(response);
      }
    } catch (error) {
      debugLog("listEvents:error:", error);
      if (error.name === "ValidationError") {
        debugLog("Validation error details:", error.errors);
        res.status(500).json({
          message: "Failed to cache events due to duplicate data. Please check the event uniqueness constraints",
          error
        });
      } else {
        debugLog("listEvents:error:", error);
        res.status(500).json(error);
      }
    }
  }
}


export async function fetchMappedEvents(config: SystemConfig, fromDate: number, toDate: number): Promise<ExtendedGroupEvent[]> {
  const defaultOptions = requestDefaults.createApiRequestOptions(config);
  const params = [
    optionalParameter("groups", [config?.group?.groupCode].filter(Boolean).join(",")),
    optionalParameter("types", [RamblersEventType.GROUP_WALK, RamblersEventType.GROUP_EVENT].join(",")),
    optionalParameter("date", DateTime.fromMillis(fromDate).toFormat(DateFormat.WALKS_MANAGER_API)),
    optionalParameter("date_end", DateTime.fromMillis(toDate).toFormat(DateFormat.WALKS_MANAGER_API)),
    optionalParameter("limit", MAXIMUM_PAGE_SIZE)
  ].filter(item => !isEmpty(item)).join("&");

  const response = await httpRequest({
    apiRequest: {
      hostname: defaultOptions.hostname,
      protocol: defaultOptions.protocol,
      headers: defaultOptions.headers,
      method: "get",
      path: `/api/volunteers/walksevents?api-key=${config?.national?.walksManager?.apiKey}&${params}`
    },
    debug: debugLog,
  }) as RamblersEventsApiResponse;

  const events = response.response?.data || [];
  return events.map(event => mapToExtendedGroupEvent(config, event));
}

async function queryBasedOnExistingEvent(existingEvent: ExtendedGroupEvent, body: EventsListRequest, config: SystemConfig): Promise<RamblersEventsApiResponse> {
  const defaultOptions = requestDefaults.createApiRequestOptions(config);
  const parameters = [
    optionalParameter("groups", [existingEvent?.groupEvent?.group_code, config?.group?.groupCode].filter(Boolean).join(",")),
    optionalParameter("date", dateParameter(body, debugLog)),
    optionalParameter("date_end", dateEndParameter(body, debugLog)),
    optionalParameter("types", ALL_EVENT_TYPES),
    optionalParameter("ids", existingEvent.groupEvent.id)
  ].filter(item => !isEmpty(item)).join("&");
  debugLog("queryBasedOnExistingEvent:parameters:", parameters);
  return await httpRequest({
    apiRequest: {
      hostname: defaultOptions.hostname,
      protocol: defaultOptions.protocol,
      headers: defaultOptions.headers,
      method: "get",
      path: `/api/volunteers/walksevents?api-key=${config?.national?.walksManager?.apiKey}&${parameters}`
    },
    debug: debugLog,
  }) as RamblersEventsApiResponse;
}

function transformEventsResponse(config: SystemConfig): (response: RamblersGroupEventsRawApiResponse) => RamblersEventSummaryResponse[] {
  return (response: RamblersGroupEventsRawApiResponse): RamblersEventSummaryResponse[] => {
    debugLog("transformEventsResponse:", response);
    if (!response.data || !Array.isArray(response.data)) {
      debugLog("Warning: response.data is undefined or not an array, returning empty array");
      return [];
    }
    return response.data.map(event => {
      const walkDateTime = dateTimeFromIso(event.start_date_time);
      const transformedEvent = {
        id: event.id,
        url: event.url,
        walksManagerUrl: event.url.replace(config.national.mainSite.href, config.national.walksManager.href),
        title: event.title,
        startDate: walkDateTime.toFormat(DateFormat.DISPLAY_DATE_FULL),
        startDateValue: walkDateTime.toMillis(),
        start_location: event.start_location,
        end_location: event.end_location,
        media: event.media,
        status: event.status,
        cancellation_reason: event.cancellation_reason
      };
      debugLog("transformedEvent:", transformedEvent);
      return transformedEvent;
    });
  };
}
