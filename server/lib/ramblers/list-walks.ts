import debug from "debug";
import { isEmpty } from "lodash";
import moment from "moment-timezone";
import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  RamblersWalkResponse,
  RamblersWalksRawApiResponse,
  RamblersWalksRawApiResponseApiResponse,
  WalkListRequest,
  WALKS_MANAGER_API_DATE_FORMAT,
  WALKS_MANAGER_GO_LIVE_DATE
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { httpRequest } from "../shared/message-handlers";
import * as requestDefaults from "./request-defaults";

const debugLog = debug(envConfig.logNamespace("ramblers:walks-and-events"));
const noopDebugLog = debug(envConfig.logNamespace("ramblers:walks-and-events"));
noopDebugLog.enabled = false;
debugLog.enabled = true;

export function listWalks(req, res): void {
  const body: WalkListRequest = req.body;
  const rawData: boolean = body.rawData;
  debugLog("listWalks:body:", body);
  config.queryKey(ConfigKey.SYSTEM)
    .then((configDocument: ConfigDocument) => {
      const systemConfig: SystemConfig = configDocument.value;
      const limit = body.limit;
      const ids = body.ids?.join(",");
      const sort = body.sort;
      const order = body.order;
      const date = dateParameter(body);
      const dateEnd = dateEndParameter(body);
      const defaultOptions = requestDefaults.createApiRequestOptions(systemConfig);
      debugLog("listWalks:defaultOptions:", defaultOptions);
      const optionalParameters = [
        optionalParameter("groups", systemConfig?.group?.groupCode),
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
          path: `/api/volunteers/walksevents?api-key=${systemConfig?.national?.walksManager?.apiKey}&types=group-walk&${optionalParameters}`
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
        const rawResponse = response as RamblersWalkResponse[];
        debugLog("returned response summary:", rawResponse.length, "results");
      }
      return response;
    })
    .then(response => res.json(response))
    .catch(error => res.json(error));
}

function optionalParameter(key: string, value: any): string {
  return key && value ? `${key}=${value}` : "";
}

function dateParameter(body: WalkListRequest): string {
  if (body?.ids?.length > 0) {
    const dateParameter = moment(WALKS_MANAGER_GO_LIVE_DATE).tz("Europe/London").startOf("day").format(WALKS_MANAGER_API_DATE_FORMAT);
    debugLog("returning dateParameter:", dateParameter, "given id request:", body.ids, "and dateEnd:", body.date);
    return dateParameter;
  } else {
    debugLog("returning dateParameter:", body.date, "given id request:", body.ids);
    return body.date;
  }
}

function dateEndParameter(body: WalkListRequest): string {
  if (body?.ids?.length > 0) {
    const dateEndParameter = moment().tz("Europe/London").add(2, "month").format(WALKS_MANAGER_API_DATE_FORMAT);
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
        startLocationW3w: walk.start_location.w3w
      };
    });
  };
}
