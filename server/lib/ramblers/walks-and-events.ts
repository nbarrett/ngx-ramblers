import debug from "debug";
import moment from "moment-timezone";
import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { RamblersWalkResponse, RamblersWalksRawApiResponse, WalkListRequest } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { httpRequest } from "../shared/message-handlers";
import * as requestDefaults from "./request-defaults";

const debugLog = debug(envConfig.logNamespace("ramblers:walks-and-events"));
debugLog.enabled = true;

export function listWalks(req, res): void {
  config.queryKey(ConfigKey.SYSTEM)
    .then((configDocument: ConfigDocument) => {
      const systemConfig: SystemConfig = configDocument.value;
      const body: WalkListRequest = req.body;
      const limit = body.limit;
      const rawData: boolean = body.rawData;
      const defaultOptions = requestDefaults.createApiRequestOptions(systemConfig);
      debugLog("listWalks:defaultOptions:", defaultOptions);
      return httpRequest({
        apiRequest: {
          hostname: defaultOptions.hostname,
          protocol: defaultOptions.protocol,
          headers: defaultOptions.headers,
          method: "get",
          path: `/api/volunteers/walksevents?types=group-walk&limit=${limit}&groups=${systemConfig?.group?.groupCode}&api-key=${systemConfig?.national?.walksManager?.apiKey}`
        },
        debug: debugLog,
        res,
        req,
        mapper: rawData ? null : transformListWalksResponse(systemConfig)
      });
    })
    .then(response => res.json(response))
    .catch(error => res.json(error));
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
