import * as messageHandlers from "../shared/message-handlers";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import url from "url";
import querystring from "querystring";
import {
  GridReferenceLookupResponse,
  GridReferenceLookupApiResponse,
  PostcodeLookupResponse,
  PostcodeLookupServiceResponse
} from "../../../projects/ngx-ramblers/src/app/models/address-model";
import { gridReference10From, gridReference6From, gridReference8From } from "./grid-reference";
import { ENDPOINT, normalisePostcode, postcodeLookupServiceResponseMapper } from "./shared";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("postcode-lookup"));
debugLog.enabled = false;

function transformPostcodeLookup(postcodeLookupResponse: PostcodeLookupResponse): GridReferenceLookupResponse {
  const gridReference6 = postcodeLookupResponse.error ? null : gridReference6From(postcodeLookupResponse?.eastings, postcodeLookupResponse?.northings);
  const gridReference8 = postcodeLookupResponse.error ? null : gridReference8From(postcodeLookupResponse?.eastings, postcodeLookupResponse?.northings);
  const gridReference10 = postcodeLookupResponse.error ? null : gridReference10From(postcodeLookupResponse?.eastings, postcodeLookupResponse?.northings);
  debugLog("gridReferenceLookup:postcode", postcodeLookupResponse.postcode, "gridReferences:", {
    gridReference6,
    gridReference8,
    gridReference10
  });
  return {
    gridReference6,
    gridReference8,
    gridReference10,
    postcode: postcodeLookupResponse.postcode,
    latlng: {lat: postcodeLookupResponse.latitude, lng: postcodeLookupResponse.longitude},
    description: postcodeLookupResponse.description,
    error: postcodeLookupResponse.error
  };
}

function postCodeMapper(response: PostcodeLookupServiceResponse): GridReferenceLookupResponse {
  try {
    const mappedResponse: PostcodeLookupResponse = postcodeLookupServiceResponseMapper(response, debugLog);
    return transformPostcodeLookup(mappedResponse);
  } catch (e: any) {
    debugLog("postCodeMapper error", e);
    return {
      description: "",
      error: e.message
    };
  }
}

export async function postcodeLookupFromPostcodesIo(postcode: string): Promise<GridReferenceLookupApiResponse> {
  const trimmed = normalisePostcode(postcode || "");
  const baseUrl = url.parse(ENDPOINT, false);
  return messageHandlers.httpRequest({
    apiRequest: {
      hostname: baseUrl.hostname,
      protocol: baseUrl.protocol,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      method: "get",
      path: `/postcodes/${querystring.escape(trimmed)}`
    },
    mapper: postCodeMapper,
    successStatusCodes: [200, 404],
    res: undefined,
    req: undefined,
    debug: debugLog
  }) as Promise<GridReferenceLookupApiResponse>;
}

export async function postcodeLookup(req, res) {
  try {
    const response = await postcodeLookupFromPostcodesIo(req.query.postcode);
    return res.json(response);
  } catch (error) {
    debugLog("error", error);
    return res.json(error);
  }
}
