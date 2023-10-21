import { Request, Response } from "express";
import { MailchimpApiError, MailchimpList, MailchimpListsMembersResponse } from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { envConfig } from "../../env-config/env-config";
import { MailchimpConfigData, MailchimpListCreateRequest, MailchimpListMembersRequest } from "../../../../projects/ngx-ramblers/src/app/models/server-models";
import { configuredMailchimp } from "../mailchimp-config";
import * as messageProcessing from "../mailchimp-message-processing";
import debug from "debug";

const messageType = "mailchimp:lists:list-delete";
const debugLog = debug(envConfig.logNamespace(messageType));

export function listDelete(req: Request, res: Response): Promise<void> {

  return configuredMailchimp().then((mailchimpConfigData: MailchimpConfigData) => {
    const listId = messageProcessing.listTypeToId(req, debugLog, mailchimpConfigData.config);
    return mailchimpConfigData.client.lists.deleteList(listId).then((responseData: any) => {
      messageProcessing.successfulResponse(req, res, {status: "list deleted successfully", id: listId}, messageType, debugLog);
    });
  }).catch((error: MailchimpApiError) => {
    messageProcessing.unsuccessfulResponse(req, res, error, messageType, debugLog);
  });
}
