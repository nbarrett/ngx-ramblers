import { Request, Response } from "express";
import debug from "debug";
import { isBoolean, isString } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { connectToEnvironmentMongo, EnvironmentNotFoundError, loadEnvironmentContext } from "./environment-context";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { PlatformSendControl, PlatformSendControlRequest } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { dateTimeNow } from "../shared/dates";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";

const debugLog = debug(envConfig.logNamespace("environment-send-control"));
const errorDebugLog = createErrorDebugLog(envConfig.logNamespace("environment-send-control"));

const NOT_SUSPENDED: PlatformSendControl = {sendingSuspended: false};

async function readSendControl(environmentName: string): Promise<PlatformSendControl> {
  const {envConfigData} = await loadEnvironmentContext(environmentName);
  const {client, db} = await connectToEnvironmentMongo(envConfigData);
  try {
    const document = await db.collection("config").findOne({key: ConfigKey.PLATFORM_SEND_CONTROL});
    return (document?.value as PlatformSendControl) || NOT_SUSPENDED;
  } finally {
    await client.close();
  }
}

async function writeSendControl(environmentName: string, control: PlatformSendControl): Promise<PlatformSendControl> {
  const {envConfigData} = await loadEnvironmentContext(environmentName);
  const {client, db} = await connectToEnvironmentMongo(envConfigData);
  try {
    await db.collection("config").updateOne(
      {key: ConfigKey.PLATFORM_SEND_CONTROL},
      {$set: {key: ConfigKey.PLATFORM_SEND_CONTROL, value: control}},
      {upsert: true}
    );
    return control;
  } finally {
    await client.close();
  }
}

function respondToError(res: Response, error: Error, action: string): void {
  if (error instanceof EnvironmentNotFoundError) {
    res.status(404).json({success: false, message: error.message});
  } else {
    errorDebugLog(`Error ${action} send control:`, error.message);
    res.status(500).json({success: false, message: error.message});
  }
}

export async function environmentSendControl(req: Request, res: Response): Promise<void> {
  try {
    const {environmentName} = req.params;
    debugLog("Send control request for:", environmentName);
    res.json({success: true, control: await readSendControl(environmentName)});
  } catch (error) {
    respondToError(res, error, "reading");
  }
}

export async function updateEnvironmentSendControl(req: Request, res: Response): Promise<void> {
  try {
    const {environmentName} = req.params;
    const request: PlatformSendControlRequest = req.body || {};
    if (!isBoolean(request.sendingSuspended)) {
      res.status(400).json({success: false, message: "sendingSuspended must be true or false"});
    } else {
      const user = req.user as Partial<MemberCookie> | undefined;
      const changedBy = user?.userName || user?.memberId || "platform-admin";
      const control: PlatformSendControl = {
        sendingSuspended: request.sendingSuspended,
        reason: isString(request.reason) && request.reason.trim() ? request.reason.trim() : undefined,
        changedAt: dateTimeNow().toMillis(),
        changedBy
      };
      debugLog("Updating send control for:", environmentName, control);
      const saved = await writeSendControl(environmentName, control);
      res.json({
        success: true,
        control: saved,
        message: saved.sendingSuspended ? `Email sending suspended on ${environmentName}` : `Email sending resumed on ${environmentName}`
      });
    }
  } catch (error) {
    respondToError(res, error, "updating");
  }
}
