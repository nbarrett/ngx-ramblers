import { Request, Response } from "express";
import debug from "debug";
import { createErrorDebugLog } from "../../shared/error-debug-log";
import { envConfig } from "../../env-config/env-config";
import { emailComposition } from "../models/email-composition";
import { EmailCompositionDocument, EmailCompositionStatus } from "../../../../projects/ngx-ramblers/src/app/models/email-composer.model";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import * as transforms from "./transforms";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("database:email-composition"));
debugLog.enabled = false;
const errorDebugLog = createErrorDebugLog("database:email-composition");

interface AuthenticatedRequest extends Request {
  user?: { memberId?: string; userName?: string };
}

function memberIdFrom(req: AuthenticatedRequest): string | null {
  return req.user?.memberId ?? null;
}

function statusFromQuery(req: Request): EmailCompositionStatus | null {
  const raw = (req.query?.status ?? "").toString().toLowerCase();
  if (raw === EmailCompositionStatus.Draft || raw === EmailCompositionStatus.Sent) return raw as EmailCompositionStatus;
  return null;
}

function summaryFromQuery(req: Request): boolean {
  return (req.query?.summary ?? "").toString().toLowerCase() === "true";
}

export async function listForCurrentMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  const memberId = memberIdFrom(req);
  if (!memberId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  try {
    const filter: any = { $or: [{ ownerMemberId: memberId }, { shared: true }] };
    const status = statusFromQuery(req);
    if (status) filter.status = status;
    const query = summaryFromQuery(req)
      ? emailComposition.find(filter).select("-state").sort({ updatedAt: -1 }).lean()
      : emailComposition.find(filter).sort({ updatedAt: -1 });
    const docs = await query.exec();
    res.status(200).json({
      action: ApiAction.QUERY,
      response: docs.map(d => transforms.toObjectWithId(d))
    });
  } catch (error) {
    errorDebugLog("listForCurrentMember error:", error);
    res.status(500).json({ message: "email-composition list failed", error: transforms.parseError(error) });
  }
}

export async function findById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const memberId = memberIdFrom(req);
  if (!memberId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  try {
    const doc = await emailComposition.findById(req.params.id).exec();
    if (!doc) {
      res.status(404).json({ message: "Composition not found", request: req.params.id });
      return;
    }
    if (doc.ownerMemberId !== memberId && !doc.shared) {
      res.status(403).json({ message: "Not allowed to access this composition" });
      return;
    }
    res.status(200).json({ action: ApiAction.QUERY, response: transforms.toObjectWithId(doc) });
  } catch (error) {
    errorDebugLog("findById error:", error);
    res.status(500).json({ message: "email-composition fetch failed", error: transforms.parseError(error) });
  }
}

export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  const memberId = memberIdFrom(req);
  if (!memberId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  const now = Date.now();
  try {
    const body = req.body ?? {};
    const doc = await emailComposition.create({
      ownerMemberId: memberId,
      status: body.status === "sent" ? "sent" : "draft",
      shared: body.shared === true,
      title: body.title ?? "Untitled draft",
      state: body.state ?? {},
      createdAt: now,
      updatedAt: now,
      updatedBy: memberId,
      sentAt: body.status === "sent" ? now : undefined,
      sentRecipientCount: body.sentRecipientCount
    } as EmailCompositionDocument);
    res.status(200).json({ action: ApiAction.CREATE, response: transforms.toObjectWithId(doc) });
  } catch (error) {
    errorDebugLog("create error:", error);
    res.status(500).json({ message: "email-composition create failed", error: transforms.parseError(error) });
  }
}

export async function update(req: AuthenticatedRequest, res: Response): Promise<void> {
  const memberId = memberIdFrom(req);
  if (!memberId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  try {
    const existing = await emailComposition.findById(req.params.id).exec();
    if (!existing) {
      res.status(404).json({ message: "Composition not found", request: req.params.id });
      return;
    }
    if (existing.ownerMemberId !== memberId && !existing.shared) {
      res.status(403).json({ message: "Not allowed to update this composition" });
      return;
    }
    const body = req.body ?? {};
    if (body.title !== undefined) existing.title = body.title;
    if (body.state !== undefined) existing.state = body.state;
    if (body.shared !== undefined) existing.shared = body.shared === true;
    if (body.status === EmailCompositionStatus.Sent && existing.status !== EmailCompositionStatus.Sent) {
      existing.status = EmailCompositionStatus.Sent;
      existing.sentAt = Date.now();
      if (body.sentRecipientCount !== undefined) existing.sentRecipientCount = body.sentRecipientCount;
    }
    existing.updatedAt = Date.now();
    existing.updatedBy = memberId;
    await existing.save();
    res.status(200).json({ action: ApiAction.UPDATE, response: transforms.toObjectWithId(existing) });
  } catch (error) {
    errorDebugLog("update error:", error);
    res.status(500).json({ message: "email-composition update failed", error: transforms.parseError(error) });
  }
}

export async function deleteOne(req: AuthenticatedRequest, res: Response): Promise<void> {
  const memberId = memberIdFrom(req);
  if (!memberId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  try {
    const existing = await emailComposition.findById(req.params.id).exec();
    if (!existing) {
      res.status(404).json({ message: "Composition not found", request: req.params.id });
      return;
    }
    if (existing.ownerMemberId !== memberId && !existing.shared) {
      res.status(403).json({ message: "Not allowed to delete this composition" });
      return;
    }
    await emailComposition.deleteOne({ _id: req.params.id }).exec();
    res.status(200).json({ action: ApiAction.DELETE, response: { id: req.params.id } });
  } catch (error) {
    errorDebugLog("deleteOne error:", error);
    res.status(500).json({ message: "email-composition delete failed", error: transforms.parseError(error) });
  }
}
