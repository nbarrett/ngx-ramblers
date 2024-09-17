import * as url from "url";
import { Meetup } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { HTTPRequestOptions } from "./models";

export function createApiRequestOptions(meetupConfig: Meetup): HTTPRequestOptions {
  const successStatusCodes = [409, 410, 200, 201, 202, 204, 304];
  const meetupApiUrl = url.parse(meetupConfig.apiUrl, false);
  const headers = {};

  return {
    successStatusCodes,
    hostname: meetupApiUrl.host,
    protocol: meetupApiUrl.protocol,
    headers
  };

}
