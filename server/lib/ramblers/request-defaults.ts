import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import url = require("url");

export function createApiRequestOptions(systemConfig: SystemConfig) {
  const ramblersUrl = url.parse(systemConfig.national.walksManager.href);
  return {
    hostname: ramblersUrl.host,
    protocol: ramblersUrl.protocol,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  };
}
