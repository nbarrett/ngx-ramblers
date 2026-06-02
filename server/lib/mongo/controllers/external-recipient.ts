import { Request, Response } from "express";
import debug from "debug";
import { createErrorDebugLog } from "../../shared/error-debug-log";
import { isString } from "es-toolkit/compat";
import { envConfig } from "../../env-config/env-config";
import { dateTimeNowAsValue } from "../../shared/dates";
import { externalRecipient, ExternalRecipientDocument } from "../models/external-recipient";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import * as transforms from "./transforms";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("database:external-recipient"));
debugLog.enabled = false;
const errorDebugLog = createErrorDebugLog("database:external-recipient");

interface AuthenticatedRequest extends Request {
  user?: { memberId?: string; userName?: string };
}

function memberIdFrom(req: AuthenticatedRequest): string | null {
  return req.user?.memberId ?? null;
}

function normalisedEmail(value: any): string | null {
  if (!isString(value)) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export async function list(req: AuthenticatedRequest, res: Response): Promise<void> {
  const memberId = memberIdFrom(req);
  if (!memberId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  try {
    const docs = await externalRecipient.find({}).sort({ lastUsedAt: -1, createdAt: -1 }).exec();
    res.status(200).json({
      action: ApiAction.QUERY,
      response: docs.map(d => transforms.toObjectWithId(d))
    });
  } catch (error) {
    errorDebugLog("list error:", error);
    res.status(500).json({ message: "external-recipient list failed", error: transforms.parseError(error) });
  }
}

export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  const memberId = memberIdFrom(req);
  if (!memberId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  const email = normalisedEmail(req.body?.email);
  if (!email) {
    res.status(400).json({ message: "email is required" });
    return;
  }
  try {
    const existing = await externalRecipient.findOne({ email }).exec();
    if (existing) {
      res.status(200).json({ action: ApiAction.QUERY, response: transforms.toObjectWithId(existing) });
      return;
    }
    const doc = await externalRecipient.create({
      email,
      name: req.body?.name?.toString().trim() || undefined,
      createdBy: memberId,
      createdAt: dateTimeNowAsValue()
    } as ExternalRecipientDocument);
    res.status(200).json({ action: ApiAction.CREATE, response: transforms.toObjectWithId(doc) });
  } catch (error) {
    errorDebugLog("create error:", error);
    res.status(500).json({ message: "external-recipient create failed", error: transforms.parseError(error) });
  }
}

export async function deleteOne(req: AuthenticatedRequest, res: Response): Promise<void> {
  const memberId = memberIdFrom(req);
  if (!memberId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  try {
    const removed = await externalRecipient.deleteOne({ _id: req.params.id }).exec();
    if (removed.deletedCount === 0) {
      res.status(404).json({ message: "External recipient not found", request: req.params.id });
      return;
    }
    res.status(200).json({ action: ApiAction.DELETE, response: { id: req.params.id } });
  } catch (error) {
    errorDebugLog("deleteOne error:", error);
    res.status(500).json({ message: "external-recipient delete failed", error: transforms.parseError(error) });
  }
}

export async function recordSendUsage(input: { email: string; name?: string; createdBy: string; saveForReuse: boolean }): Promise<void> {
  const email = normalisedEmail(input.email);
  if (!email) return;
  const now = dateTimeNowAsValue();
  try {
    const existing = await externalRecipient.findOne({ email }).exec();
    if (existing) {
      existing.lastUsedAt = now;
      existing.lastUsedBy = input.createdBy;
      if (input.name && !existing.name) existing.name = input.name;
      await existing.save();
      return;
    }
    if (!input.saveForReuse) return;
    await externalRecipient.create({
      email,
      name: input.name?.trim() || undefined,
      createdBy: input.createdBy,
      createdAt: now,
      lastUsedAt: now,
      lastUsedBy: input.createdBy
    } as ExternalRecipientDocument);
  } catch (error) {
    errorDebugLog("recordSendUsage failed for", email, error);
  }
}
