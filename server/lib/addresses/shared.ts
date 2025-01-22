import {
  PostcodeLookupResponse,
  PostcodeLookupResult,
  PostcodeLookupServiceResponse
} from "../../../projects/ngx-ramblers/src/app/models/address-model";
import { isArray, padStart } from "lodash";
import debug from "debug";

export const ENDPOINT = "https://api.postcodes.io";

function toPostcodeLookupErrorResponse(result: PostcodeLookupServiceResponse): PostcodeLookupResponse {
  return {
    distance: null,
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

function toPostcodeLookupResponse(result: PostcodeLookupResult, debugLog?: debug.Debugger): PostcodeLookupResponse {
  const response: PostcodeLookupResponse = {
    distance: result.distance,
    description: [result.parish, result.nuts, result.pfa].filter(value => value && !value.includes("unparished")).join(", "),
    postcode: result.postcode,
    latitude: result.latitude,
    longitude: result.longitude,
    eastings: +padStart(result.eastings?.toString(), 6, "0"),
    northings: +padStart(result.northings?.toString(), 6, "0")
  };
  if (debugLog) {
    debugLog("toPostcodeLookupResponse:result:", result);
    debugLog("toPostcodeLookupResponse:response:", response);
  }
  return response;
}

export function postcodeLookupServiceResponseMapper(response: PostcodeLookupServiceResponse, debugLog: debug.Debugger): PostcodeLookupResponse {
  if (response.result) {
    if (isArray(response.result)) {
      debugLog("result was an array of length", response.result.length, "with values:", response.result.map(data => toPostcodeLookupResponse(data)));
      const postcodeLookupResult = response.result.sort((a, b) => a.distance - b.distance)[0];
      const returnedResponse = toPostcodeLookupResponse(postcodeLookupResult);
      debugLog("Based on distance from inputs, postcode was ", postcodeLookupResult.postcode, "with response", returnedResponse);
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

export function postcodeLookupServiceResponsesMapper(response: PostcodeLookupServiceResponse, debugLog: debug.Debugger): PostcodeLookupResponse[] {
  if (response.result) {
    if (isArray(response.result)) {
      const returnedResponse = response.result.map(data => toPostcodeLookupResponse(data));
      debugLog("result was an array of length", response.result.length, "with values:", returnedResponse);
      return returnedResponse;
    } else {
      const returnedResponse = toPostcodeLookupResponse(response.result);
      debugLog("result was single response - returning ", returnedResponse);
      return [returnedResponse];
    }
  } else {
    debugLog("result doesn't exist - returning entire response", response);
    return [toPostcodeLookupErrorResponse(response)];
  }
}
