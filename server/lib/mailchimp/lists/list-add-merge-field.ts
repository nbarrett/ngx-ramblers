import { lists } from "@mailchimp/mailchimp_marketing";
import { Request, Response } from "express";
import { MailchimpApiError, MailchimpList, MailchimpListsMembersResponse, MergeFieldAddResponse } from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { envConfig } from "../../env-config/env-config";
import { MailchimpConfigData, MailchimpListCreateRequest, MailchimpListMembersRequest } from "../../../../projects/ngx-ramblers/src/app/models/server-models";
import { configuredMailchimp } from "../mailchimp-config";
import * as messageProcessing from "../mailchimp-message-processing";
import debug from "debug";
import MergeField = lists.MergeField;

const messageType = "mailchimp:lists:add-merge-field";
const debugLog = debug(envConfig.logNamespace(messageType));

export function addMergeField(req: Request, res: Response): Promise<void> {

  return configuredMailchimp().then((mailchimpConfigData: MailchimpConfigData) => {
    const mergeField: MergeField = req.body;
    const listId = messageProcessing.listTypeToId(req, debugLog, mailchimpConfigData.config);
    return mailchimpConfigData.client.lists.addListMergeField(listId, mergeField)
      .then((responseData: MergeFieldAddResponse) => {
        messageProcessing.successfulResponse(req, res, responseData, messageType, debugLog);
      });
  }).catch((error: MailchimpApiError) => {
    messageProcessing.unsuccessfulResponse(req, res, error, messageType, debugLog);
  });
}
