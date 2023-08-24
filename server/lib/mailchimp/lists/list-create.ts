import { Request, Response } from "express";
import { MailchimpApiError, MailchimpList, MailchimpListsMembersResponse } from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { envConfig } from "../../env-config/env-config";
import { MailchimpConfigData, MailchimpListCreateRequest, MailchimpListMembersRequest } from "../../shared/server-models";
import { configuredMailchimp } from "../mailchimp-config";
import * as messageProcessing from "../mailchimp-message-processing";
import debug from "debug";

const messageType = "mailchimp:lists:list-create";
const debugLog = debug(envConfig.logNamespace(messageType));

export function listCreate(req: Request, res: Response): Promise<void> {

  return configuredMailchimp().then((mailchimpConfigData: MailchimpConfigData) => {
    const mailchimpListMembersRequest: MailchimpListCreateRequest = req.body;

    return mailchimpConfigData.client.lists.createList(mailchimpListMembersRequest).then((responseData: MailchimpList) => {
      messageProcessing.successfulResponse(req, res, responseData, messageType, debugLog);
    });
  }).catch((error: MailchimpApiError) => {
    messageProcessing.unsuccessfulResponse(req, res, error, messageType, debugLog);
  });
}
