import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { mailSendRefusal } from "../mongo/models/mail-send-refusal";
import { toObjectWithId } from "../mongo/controllers/transforms";
import { sendStatus } from "./send-permission";
import { errorResponse } from "../shared/error-response";

const messageType = "brevo:send-refusals";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export async function sendRefusals(req: Request, res: Response): Promise<void> {
  try {
    const requested = parseInt(req.query.limit as string, 10);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_LIMIT) : DEFAULT_LIMIT;
    const documents = await mailSendRefusal.find({}).sort({refusedAt: -1}).limit(limit).lean();
    res.status(200).json({request: {messageType}, response: documents.map(document => toObjectWithId(document))});
  } catch (error) {
    debugLog("failed to list send refusals:", error);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}

export async function sendStatusRoute(req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json({request: {messageType}, response: await sendStatus()});
  } catch (error) {
    debugLog("failed to resolve send status:", error);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}
