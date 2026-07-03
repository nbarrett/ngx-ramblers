import { GridReferenceLookupApiResponse } from "../../../projects/ngx-ramblers/src/app/models/address-model";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { ApiRequest } from "../../../projects/ngx-ramblers/src/app/models/api-request.model";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import { nominatimGridReferenceLookup } from "./nominatim-lookup";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("geocode-from-text"));
debugLog.enabled = false;

export async function geocodeFromText(req, res) {
  const query = (req.query.query || "").toString().trim();
  const preferredCounty = (req.query.preferredCounty || "").toString().trim();
  const apiRequest: ApiRequest = {
    parameters: {query, preferredCounty},
    url: req.url,
    body: {}
  };
  if (!query) {
    res.status(400);
    return res.json({
      request: apiRequest,
      action: ApiAction.QUERY,
      response: {error: "Query is required"}
    });
  }
  debugLog(`geocodeFromText: query="${query}"${preferredCounty ? `, preferredCounty="${preferredCounty}"` : ""}`);
  try {
    const result = await nominatimGridReferenceLookup({
      query,
      preferredCounty: preferredCounty || undefined,
      userAgent: "ngx-ramblers-geocode-from-text/1.0",
      logPrefix: "geocodeFromText",
      debugLog
    });
    if (!result.response) {
      return res.json({
        request: apiRequest,
        action: ApiAction.QUERY,
        response: {error: `No places found for "${query}"`}
      });
    }
    const response: GridReferenceLookupApiResponse = {
      apiStatusCode: result.apiStatusCode,
      request: apiRequest,
      action: ApiAction.QUERY,
      response: result.response
    };
    return res.json(response);
  } catch (error: any) {
    debugLog("geocodeFromText error", error);
    res.status(500);
    return res.json({
      request: apiRequest,
      action: ApiAction.QUERY,
      response: {error: error?.message || "Geocode from text failed"}
    });
  }
}
