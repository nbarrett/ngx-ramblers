import debug from "debug";
import isEmpty from "lodash/isEmpty";
import moment from "moment-timezone";
import {
  EventsListRequest,
  RamblersEventsApiResponse,
  RamblersEventSummaryResponse,
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

const debugLog = debug(envConfig.logNamespace("ramblers:walks-and-events"));
const noopDebugLog = debug(envConfig.logNamespace("ramblers:walks-and-events"));
noopDebugLog.enabled = false;
debugLog.enabled = false;

function identifierLooksLikeASlug(body: EventsListRequest) {
  const value = body.ids?.[0] ?? "";
  const looksLikeASlug = /[\s-]/.test(value);
  debugLog("identifierLooksLikeASlug:", value, "returning:", looksLikeASlug);
  return looksLikeASlug;
}

export async function listEvents(req: Request, res: Response): Promise<void> {
  const body: EventsListRequest = req.body;
  const rawData: boolean = body.rawData;
  debugLog("listEvents:body:", body);
  const limit = limitFor(req.body);
  const ids = body.ids?.join(",");
  if (body.ids && body.ids.length === 1 && identifierLooksLikeASlug(body)) {
    req.query.slug = body.ids[0];
    await listEventsBySlug(req, res);
  } else {
    const sort = body.sort;
    const order = body.order;
    const date = dateParameter(body, debugLog);
    const dateEnd = dateEndParameter(body, debugLog);
    try {
      const config: SystemConfig = await systemConfig();
      const defaultOptions = requestDefaults.createApiRequestOptions(config);
      debugLog("listEvents:defaultOptions:", defaultOptions);
      const optionalParameters = [
        optionalParameter("groups", body.groupCode || config?.group?.groupCode),
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
      const response = await httpRequest({
        apiRequest: {
          hostname: defaultOptions.hostname,
          protocol: defaultOptions.protocol,
          headers: defaultOptions.headers,
          method: "get",
          path: `/api/volunteers/walksevents?api-key=${config?.national?.walksManager?.apiKey}&${optionalParameters}`
        },
        debug: noopDebugLog,
        res,
        req,
        mapper: rawData ? null : transformEventsResponse(config)
      });
      if (rawData) {
        const rawResponse = response as RamblersEventsApiResponse;
        debugLog("returned response summary:", rawResponse?.response?.summary);
      } else {
        const rawResponse = response as unknown as RamblersEventSummaryResponse[];
        debugLog("returned response summary:", rawResponse.length, "results");
      }
      res.json(response);
    } catch (error) {
      debugLog("listEvents:error:", error);
      res.json(error);
    }
  }
}

function transformEventsResponse(config: SystemConfig): (response: RamblersGroupEventsRawApiResponse) => RamblersEventSummaryResponse[] {
  return (response: RamblersGroupEventsRawApiResponse): RamblersEventSummaryResponse[] => {
    debugLog("transformEventsResponse:", response);
    return response.data.map(event => {
      debugLog("transformEventsResponse:event:", event);
      const walkMoment = moment(event.start_date_time, moment.ISO_8601).tz("Europe/London");
      return {
        id: event.id,
        url: event.url,
        walksManagerUrl: event.url.replace(config.national.mainSite.href, config.national.walksManager.href),
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
