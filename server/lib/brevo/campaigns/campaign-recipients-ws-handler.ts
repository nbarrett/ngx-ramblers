import {CampaignRecipientExportRequest} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import {Request} from "express";
import {memberFromRequest} from "../../auth/request-member";
import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { MessageType } from "../../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { recipientsReportFor } from "./campaign-recipients";

const debugLog = debug(envConfig.logNamespace("campaign-recipients-ws"));
debugLog.enabled = true;

export async function handleCampaignRecipientExport(ws: WebSocket, data: CampaignRecipientExportRequest, authToken: string | null = null): Promise<void> {
  const campaignId = Number(data?.campaignId);
  const type = String(data?.type || "");
  const send = (messageType: MessageType, payload: unknown) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({type: messageType, data: payload}));
    }
  };
  const authenticatedMember = memberFromRequest({headers: {authorization: authToken ? `Bearer ${authToken}` : ""}} as Request);
  if (!authenticatedMember) {
    send(MessageType.ERROR, {campaignId, type, message: "Sign in before loading campaign recipients"});
  } else if (!Number.isInteger(campaignId) || campaignId <= 0 || !type) {
    send(MessageType.ERROR, {campaignId, type, message: "campaignId and type are required"});
  } else {
    send(MessageType.PROGRESS, {campaignId, type, message: "Waiting for Brevo to finish the recipient export…", percent: 10});
    try {
      const report = await recipientsReportFor(campaignId, type);
      debugLog("export complete for campaign", campaignId, "type", type, "rows", report.recipients.length);
      send(MessageType.COMPLETE, {campaignId, type, ...report});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      debugLog("export failed for campaign", campaignId, message);
      send(MessageType.ERROR, {campaignId, type, message});
    }
  }
}
