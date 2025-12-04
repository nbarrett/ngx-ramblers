import { LatLngLiteral } from "leaflet";
import * as messageHandlers from "../shared/message-handlers";
import { gridReference10From, gridReference6From, gridReference8From } from "./grid-reference";
import {
  GridReferenceLookupApiResponse,
  GridReferenceLookupResponse,
  PostcodeLookupResponse,
  PostcodeLookupServiceResponse
} from "../../../projects/ngx-ramblers/src/app/models/address-model";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import { ENDPOINT, postcodeLookupServiceResponsesMapper } from "./shared";
import url = require("url");

const defaultDebugLog: debug.Debugger = debug(envConfig.logNamespace("reverse-gecode"));
defaultDebugLog.enabled = false;
const baseUrl = url.parse(ENDPOINT, false);

function toLatLngLiteral(latlng: PostcodeLookupResponse): LatLngLiteral {
  return {
    lat: latlng.latitude,
    lng: latlng.longitude
  };
}

function deriveGridReferences(postcodeLookupResponse: PostcodeLookupResponse) {
  if (postcodeLookupResponse.error || !Number.isFinite(postcodeLookupResponse?.eastings) || !Number.isFinite(postcodeLookupResponse?.northings)) {
    return {gridReference6: null, gridReference8: null, gridReference10: null};
  }
  return {
    gridReference6: gridReference6From(postcodeLookupResponse.eastings, postcodeLookupResponse.northings),
    gridReference8: gridReference8From(postcodeLookupResponse.eastings, postcodeLookupResponse.northings),
    gridReference10: gridReference10From(postcodeLookupResponse.eastings, postcodeLookupResponse.northings)
  };
}

function withCoordinateDefaults(postcodeLookupResponse: PostcodeLookupResponse): PostcodeLookupResponse {
  const eastingsValid = Number.isFinite(postcodeLookupResponse?.eastings);
  const northingsValid = Number.isFinite(postcodeLookupResponse?.northings);
  if (eastingsValid && northingsValid) {
    return postcodeLookupResponse;
  }
  return {
    ...postcodeLookupResponse,
    eastings: eastingsValid ? postcodeLookupResponse.eastings : 0,
    northings: northingsValid ? postcodeLookupResponse.northings : 0
  };
}

function transformLatLongLookup(postcodeLookupResponse: PostcodeLookupResponse, debugLog: debug.Debugger): GridReferenceLookupResponse {
  const {gridReference6, gridReference8, gridReference10} = deriveGridReferences(withCoordinateDefaults(postcodeLookupResponse));
  const responseLatLng: LatLngLiteral = toLatLngLiteral(postcodeLookupResponse);
  debugLog("gridReferenceLookup:response latlng:", responseLatLng, "gridReferences:", {
    gridReference6,
    gridReference8,
    gridReference10
  });
  return {
    gridReference6,
    gridReference8,
    gridReference10,
    distance: postcodeLookupResponse.distance,
    postcode: postcodeLookupResponse.postcode,
    latlng: responseLatLng,
    description: postcodeLookupResponse.description,
    error: postcodeLookupResponse.error
  };
}

function latLongMapper(response: PostcodeLookupServiceResponse, debugLog: debug.Debugger): GridReferenceLookupResponse[] {
  try {
    const mappedResponse: PostcodeLookupResponse[] = postcodeLookupServiceResponsesMapper(response, debugLog);
    return mappedResponse.map(item => transformLatLongLookup(item, debugLog));
  } catch (e: any) {
    debugLog("latLongMapper error", e);
    return [{
      description: "",
      error: e.message
    }];
  }
}

export function gridReferenceLookupFromLatLng(body: LatLngLiteral, res?, req?, debugLog: debug.Debugger = defaultDebugLog): Promise<GridReferenceLookupApiResponse> {
  return messageHandlers.httpRequest({
    apiRequest: {
      hostname: baseUrl.hostname,
      protocol: baseUrl.protocol,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      method: "get",
      path: `/postcodes?lon=${body.lng}&lat=${body.lat}&radius=900`
    },
    mapper: (response: PostcodeLookupServiceResponse) => latLongMapper(response, debugLog),
    successStatusCodes: [200, 404],
    res,
    req,
    debug: debugLog
  }) as Promise<GridReferenceLookupApiResponse>;
}

export async function reverseGeocode(req, res) {
  try {
    const response = await gridReferenceLookupFromLatLng(req.body, res, req);
    return res.json(response);
  } catch (error) {
    defaultDebugLog("error", error);
    return res.json(error);
  }
}
