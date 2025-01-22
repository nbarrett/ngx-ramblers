import { LatLngLiteral } from "leaflet";
import * as messageHandlers from "../shared/message-handlers";
import { gridReference10From, gridReference6From, gridReference8From } from "./grid-reference";
import {
  GridReferenceLookupResponse,
  PostcodeLookupResponse,
  PostcodeLookupServiceResponse
} from "../../../projects/ngx-ramblers/src/app/models/address-model";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import { ENDPOINT, postcodeLookupServiceResponsesMapper } from "./shared";
import url = require("url");

export async function reverseGeocode(req, res) {
  const debugLog: debug.Debugger = debug(envConfig.logNamespace("reverse-gecode"));
  debugLog.enabled = true;

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

  function transformLatLongLookup(postcodeLookupResponse: PostcodeLookupResponse): GridReferenceLookupResponse {
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
      distance: postcodeLookupResponse.distance,
      postcode: postcodeLookupResponse.postcode,
      latlng: responseLatLng,
      description: postcodeLookupResponse.description,
      error: postcodeLookupResponse.error
    };
  }

  function toLatLngLiteral(latlng: PostcodeLookupResponse): LatLngLiteral {
    return {
      lat: latlng.latitude,
      lng: latlng.longitude
    };
  }

  function latLongMapper(response: PostcodeLookupServiceResponse): GridReferenceLookupResponse[] {
    try {
      const mappedResponse: PostcodeLookupResponse[] = postcodeLookupServiceResponsesMapper(response, debugLog);
      return mappedResponse.map(item => transformLatLongLookup(item));
    } catch (e) {
      debugLog("latLongMapper error", e);
      return [{
        description: "",
        error: e.message
      }];
    }
  }


}

