import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { handleError, successfulResponse } from "../common/messages";
import { queryTemplateContent } from "../transactional-mail/query-template-content";

const messageType = "brevo:query-template-content-route";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function queryTemplateContentRoute(req: Request, res: Response): Promise<void> {
  try {
    const templateId = Number(req.params["templateId"]);
    if (!Number.isFinite(templateId)) {
      res.status(400).json({ request: { messageType }, error: { message: "Invalid templateId" } });
      return;
    }
    const response = await queryTemplateContent(templateId);
    if (!response) {
      res.status(404).json({ request: { messageType }, error: { message: "Template not found" } });
      return;
    }
    successfulResponse({ req, res, response, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
