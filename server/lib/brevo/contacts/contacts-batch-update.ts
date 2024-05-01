import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { configuredBrevo } from "../brevo-config";
import { CreateContactRequestWithObjectAttributes } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import http from "http";
import { handleError, mapStatusMappedResponseMultipleInputs, successfulResponse } from "../common/messages";
import { UpdateBatchContacts } from "@getbrevo/brevo/model/updateBatchContacts";

const messageType = "brevo:contacts:batch-update";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

export async function contactsBatchUpdate(req: Request, res: Response): Promise<any> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.ContactsApi();
    const updateBatchContacts: UpdateBatchContacts = new SibApiV3Sdk.UpdateBatchContacts();
    const createContactRequests: CreateContactRequestWithObjectAttributes[] = req.body;
    debugLog("createContactRequests received:", createContactRequests);
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    updateBatchContacts.contacts = createContactRequests;
    debugLog("updateBatchContacts:", updateBatchContacts.contacts);
    const response: {
      response: http.IncomingMessage,
      body?: any
    } = await apiInstance.updateBatchContacts(updateBatchContacts);
    successfulResponse({
      req,
      res,
      response: mapStatusMappedResponseMultipleInputs(createContactRequests.map(item => item.extId), response, 204),
      messageType,
      debugLog
    });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
