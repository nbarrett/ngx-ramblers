import { gridReference10From, gridReference6From, gridReference8From } from "./grid-reference";
import { isArray, padStart } from "lodash";
import {
  GridReferenceLookupResponse,
  PostcodeLookupResponse,
  PostcodeLookupResult,
  PostcodeLookupServiceResponse
} from "../../../projects/ngx-ramblers/src/app/models/address-model";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import * as messageHandlers from "../shared/message-handlers";
import { LatLngLiteral } from "leaflet";
import querystring = require("querystring");
import url = require("url");

const debugLog: debug.Debugger = debug(envConfig.logNamespace("postcodes"));
debugLog.enabled = false;
export const postcodes = {postcodeLookup, reverseGeocode};
const ENDPOINT = "https://api.postcodes.io";

function toLatLngLiteral(latlng: PostcodeLookupResponse): LatLngLiteral {
  return {
    lat: latlng.latitude,
    lng: latlng.longitude
  };
}

function transformPostcodeLookup(postcodeLookupResponse: PostcodeLookupResponse) {
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

function transformLatLongLookup(postcodeLookupResponse: PostcodeLookupResponse) {
  const gridReference6 = postcodeLookupResponse.error ? null : gridReference6From(postcodeLookupResponse?.eastings, postcodeLookupResponse?.northings);
  const gridReference8 = postcodeLookupResponse.error ? null : gridReference8From(postcodeLookupResponse?.eastings, postcodeLookupResponse?.northings);
  const gridReference10 = postcodeLookupResponse.error ? null : gridReference10From(postcodeLookupResponse?.eastings, postcodeLookupResponse?.northings);
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
    postcode: postcodeLookupResponse.postcode,
    latlng: responseLatLng,
    description: postcodeLookupResponse.description,
    error: postcodeLookupResponse.error
  };
}

function toPostcodeLookupErrorResponse(result: PostcodeLookupServiceResponse): PostcodeLookupResponse {
  return {
    postcode: null,
    eastings: null,
    northings: null,
    longitude: null,
    latitude: null,
    description: null,
    status: null,
    error: result.error
  };
}

function toPostcodeLookupResponse(result: PostcodeLookupResult): PostcodeLookupResponse {
  const response: PostcodeLookupResponse = {
    description: [result.parish, result.nuts, result.pfa].filter(value => value && !value.includes("unparished")).join(", "),
    postcode: result.postcode,
    latitude: result.latitude,
    longitude: result.longitude,
    eastings: +padStart(result.eastings?.toString(), 6, "0"),
    northings: +padStart(result.northings?.toString(), 6, "0")
  };
  debugLog("toPostcodeLookupResponse:result:", result);
  debugLog("toPostcodeLookupResponse:response:", response);
  return response;
}

function postCodeMapper(response: PostcodeLookupServiceResponse): GridReferenceLookupResponse {
  try {
    const mappedResponse: PostcodeLookupResponse = mapper(response);
    return transformPostcodeLookup(mappedResponse);
  } catch (e) {
    debugLog("postCodeMapper error", e);
    return {
      description: "",
      error: e.message
    };
  }
}

function latLongMapper(response: PostcodeLookupServiceResponse): GridReferenceLookupResponse {
  try {
    const mappedResponse: PostcodeLookupResponse = mapper(response);
    return transformLatLongLookup(mappedResponse);
  } catch (e) {
    debugLog("latLongMapper error", e);
    return {
      description: "",
      error: e.message
    };
  }
}

function mapper(response: PostcodeLookupServiceResponse): PostcodeLookupResponse {
  if (response.result) {
    if (isArray(response.result)) {
      const postcodeLookupResult = response.result.sort((a, b) => a.distance - b.distance)[0];
      const returnedResponse = toPostcodeLookupResponse(postcodeLookupResult);
      debugLog("result was an array of length",
        response.result.length, "with distance",
        response.result.map(a => a.distance).join(", "),
        "returning distance:",
        postcodeLookupResult.distance,
        "response", returnedResponse);
      return returnedResponse;
    } else {
      const returnedResponse = toPostcodeLookupResponse(response.result);
      debugLog("result was single response - returning ", returnedResponse);
      return returnedResponse;
    }
  } else {
    debugLog("result doesn't exist - returning entire response", response);
    return toPostcodeLookupErrorResponse(response);
  }
}

async function postcodeLookup(req, res) {
  const baseUrl = url.parse(ENDPOINT, false);
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
    mapper: postCodeMapper,
    successStatusCodes: [200, 404],
    res,
    req,
    debug: debugLog
  }).then((response: any) => res.json(response))
    .catch(error => {
      debugLog("error", error);
      return res.json(error);
    });
}

async function reverseGeocode(req, res) {
  const baseUrl = url.parse(ENDPOINT, false);
  const body: LatLngLiteral = req.body;
  messageHandlers.httpRequest({
    apiRequest: {
      hostname: baseUrl.hostname,
      protocol: baseUrl.protocol,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      method: "get",
      path: `/postcodes?lon=${body.lng}&lat=${body.lat}&radius=900`
    },
    mapper: latLongMapper,
    successStatusCodes: [200, 404],
    res,
    req,
    debug: debugLog
  }).then((response: any) => res.json(response))
    .catch(error => {
      debugLog("error", error);
      return res.json(error);
    });
}
