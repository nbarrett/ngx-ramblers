import debug from "debug";
import { Request, Response } from "express";
import { MailchimpApiError, MailchimpSegmentUpdateResponse, MailchimpUpdateSegmentRequest } from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { envConfig } from "../../env-config/env-config";
import { MailchimpConfigData, MailchimpUpdateSegmentBodyParameters } from "../../../../projects/ngx-ramblers/src/app/models/server-models";
import { configuredMailchimp } from "../mailchimp-config";
import * as messageProcessing from "../mailchimp-message-processing";

const messageType = "mailchimp:lists:segment-update";
const debugLog = debug(envConfig.logNamespace(messageType));

export function listsSegmentUpdate(req: Request, res: Response): Promise<void> {

  return configuredMailchimp().then((mailchimpConfigData: MailchimpConfigData) => {
    const listId = messageProcessing.listTypeToId(req, debugLog, mailchimpConfigData.config);
    const request: MailchimpUpdateSegmentRequest = req.body;
    const segmentId = request.segmentId;
    const clientRequest: MailchimpUpdateSegmentBodyParameters = {
      name: request.segmentName,
    };
    if (request.resetSegmentMembers) {
      clientRequest.static_segment = [];
    }

    debugLog("listId:", listId, "segmentId:", segmentId, "bodyParameters:", JSON.stringify(clientRequest));

    return mailchimpConfigData.client.lists.updateSegment(listId, segmentId, clientRequest)
      .then((responseData: MailchimpSegmentUpdateResponse) => {
        messageProcessing.successfulResponse(req, res, responseData, messageType, debugLog);
      });
  }).catch((error: MailchimpApiError) => {
    messageProcessing.unsuccessfulResponse(req, res, error, messageType, debugLog);
  });
}
