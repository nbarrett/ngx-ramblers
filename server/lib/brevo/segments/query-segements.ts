import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { brevoClient } from "../brevo-config";
import {
  DEFAULT_REQUEST_OPTIONS,
  OptionalRequestOptions,
  SegmentsResponse
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { handleError, successfulResponse } from "../common/messages";
import { scheduleBrevo } from "../common/rate-limiting";

const messageType = "brevo:segments:query";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function querySegments(req: Request, res: Response): Promise<any> {
  try {
    const client = await brevoClient();
    const requestOptions: OptionalRequestOptions = req.body || DEFAULT_REQUEST_OPTIONS;
    debugLog("about to query with requestOptions:", requestOptions);
    const apiResponse = await scheduleBrevo(() => client.contacts.getSegments({limit: requestOptions.limit, offset: requestOptions.offset, sort: requestOptions.sort}));
    const response: SegmentsResponse = {
      count: apiResponse.count ?? 0,
      segments: (apiResponse.segments ?? []).map(segment => ({
        id: segment.id,
        segmentName: segment.segmentName,
        categoryName: segment.categoryName,
        updatedAt: segment.updatedAt ?? ""
      }))
    };
    debugLog("apiResponse:", apiResponse, "response:", response);
    successfulResponse({req, res, response, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
