import { padStart } from "lodash";
import { PostcodeLookupResponse, PostcodeLookupServiceResponse } from "../../../projects/ngx-ramblers/src/app/models/address-model";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import querystring = require("querystring");
import url = require("url");
import * as messageHandlers from "../shared/message-handlers";

const debugLog = debug(envConfig.logNamespace("postcodes"));

export const postcodes = {postcodeLookup};

function mapper(response: PostcodeLookupServiceResponse) {
  if (response.result) {
    const returnedResponse: PostcodeLookupResponse = {
      eastings: padStart(response.result.eastings.toString(), 6, "0"),
      northings: padStart(response.result.northings.toString(), 6, "0")
    };
    debugLog("result exists - returning ", returnedResponse);
    return returnedResponse;
  } else {
    debugLog("result doesnt exist - returning entire response", response);
    return response;
  }
}

async function postcodeLookup(req, res) {
  const baseUrl = url.parse("https://api.postcodes.io");
  messageHandlers.httpRequest({
    apiRequest: {
      hostname: baseUrl.hostname,
      protocol: baseUrl.protocol,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      method: "get",
      path: `/postcodes/${(querystring.escape(req.query.postcode))}`
    },
    mapper,
    successStatusCodes: [200, 404],
    res,
    req,
    debug: debugLog
  }).then((response: PostcodeLookupServiceResponse) => res.json(response))
    .catch(error => res.json(error));
}
