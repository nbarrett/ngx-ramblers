import debug from "debug";
import { GroupListRequest } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { envConfig } from "../env-config/env-config";
import { httpRequest } from "../shared/message-handlers";
import * as requestDefaults from "./request-defaults";
import { systemConfig } from "../config/system-config";

const debugLog = debug(envConfig.logNamespace("ramblers:groups"));
debugLog.enabled = true;

export function listGroups(req, res): void {
  systemConfig()
    .then((systemConfig: SystemConfig) => {
      const body: GroupListRequest = req.body;
      const limit = body.limit;
      const groups = body.groups.join(",");
      const defaultOptions = requestDefaults.createApiRequestOptions(systemConfig);
      debugLog("listGroups:defaultOptions:", defaultOptions, "groups:", groups, "limit:", limit);
      return httpRequest({
        apiRequest: {
          hostname: defaultOptions.hostname,
          protocol: defaultOptions.protocol,
          headers: defaultOptions.headers,
          method: "get",
          path: `/api/volunteers/groups?limit=${limit}&groups=${groups}&api-key=${systemConfig?.national?.walksManager?.apiKey}`
        },
        debug: debugLog,
        res,
        req,
      });
    })
    .then(response => res.json(response))
    .catch(error => res.json(error));
}

