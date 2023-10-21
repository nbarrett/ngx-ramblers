import debug from "debug";
import { Request, Response } from "express";
import {
  MailchimpApiError,
  MailchimpBatchSegmentAddOrRemoveRequest,
  MailchimpListSegmentAddOrRemoveMembersRequest,
  MailchimpListSegmentBatchAddOrRemoveMembersResponse,
  SubscriptionRequest
} from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { envConfig } from "../../env-config/env-config";
import { MailchimpConfigData } from "../../../../projects/ngx-ramblers/src/app/models/server-models";
import { configuredMailchimp } from "../mailchimp-config";
import * as messageProcessing from "../mailchimp-message-processing";

const messageType = "mailchimp:lists:segment-members-add-or-remove";
const debugLog = debug(envConfig.logNamespace(messageType));

export function listsSegmentMembersAddOrRemove(req: Request, res: Response): Promise<void> {

  function formatMembers(membersToAdd: SubscriptionRequest[]) {
    return membersToAdd.map(item => item.email);
  }

  return configuredMailchimp().then((mailchimpConfigData: MailchimpConfigData) => {
    const clientRequest: MailchimpListSegmentAddOrRemoveMembersRequest = req.body;
    const listId = messageProcessing.listTypeToId(req, debugLog, mailchimpConfigData.config);
    const bodyParameters: MailchimpBatchSegmentAddOrRemoveRequest = {
      members_to_add: formatMembers(clientRequest.membersToAdd),
      members_to_remove: formatMembers(clientRequest.membersToRemove),
    };
    debugLog("listId:", listId, "segmentId:", clientRequest.segmentId, "bodyParameters:", JSON.stringify(bodyParameters));
    return mailchimpConfigData.client.lists.batchSegmentMembers(bodyParameters, listId, clientRequest.segmentId)
      .then((responseData: MailchimpListSegmentBatchAddOrRemoveMembersResponse) => {
        messageProcessing.successfulResponse(req, res, responseData, messageType, debugLog);
      });
  }).catch((error: MailchimpApiError) => {
    messageProcessing.unsuccessfulResponse(req, res, error, messageType, debugLog);
  });
}
