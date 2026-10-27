import { Request, Response } from "express";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { errorResponse } from "../shared/error-response";
import { requestMember } from "../inbox/inbox-access";
import { createCredential, listActiveCredentials, revokeCredential } from "./mail-client-credentials";
import { connectionSettingsFor, mailClientAccessEnabled } from "./mail-client-auth";
import { member as memberModel } from "../mongo/models/member";
import * as transforms from "../mongo/controllers/transforms";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { MailClientCreateCredentialRequest } from "../../../projects/ngx-ramblers/src/app/models/mail-client.model";

const messageType = "mail-client";
const errorDebugLog = createErrorDebugLog(messageType);

export async function readMailClientSettings(req: Request, res: Response): Promise<void> {
  try {
    const member = await loadedMember(req, res);
    if (member) {
      res.json({request: {messageType}, response: await connectionSettingsFor(member)});
    }
  } catch (error) {
    errorDebugLog("read settings failed", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}

export async function listMailClientCredentials(req: Request, res: Response): Promise<void> {
  try {
    const member = await loadedMember(req, res);
    if (member) {
      res.json({request: {messageType}, response: await listActiveCredentials(member.id ?? "")});
    }
  } catch (error) {
    errorDebugLog("list credentials failed", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}

export async function createMailClientCredential(req: Request, res: Response): Promise<void> {
  try {
    const member = await loadedMember(req, res);
    if (member) {
      if (!(await mailClientAccessEnabled())) {
        res.status(403).json({request: {messageType}, error: "Mail application access is switched off in Mail Settings"});
      } else {
        const body = req.body as MailClientCreateCredentialRequest;
        const created = await createCredential(member.id ?? "", body?.label ?? null);
        res.json({request: {messageType}, response: created});
      }
    }
  } catch (error) {
    errorDebugLog("create credential failed", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}

export async function revokeMailClientCredential(req: Request, res: Response): Promise<void> {
  try {
    const member = await loadedMember(req, res);
    if (member) {
      const revoked = await revokeCredential(member.id ?? "", req.params.id);
      if (revoked) {
        res.json({request: {messageType}, response: {revoked: true}});
      } else {
        res.status(404).json({request: {messageType}, error: "Application password not found"});
      }
    }
  } catch (error) {
    errorDebugLog("revoke credential failed", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}

async function loadedMember(req: Request, res: Response): Promise<Member | null> {
  const memberId = requestMember(req).memberId;
  if (!memberId) {
    res.status(401).json({request: {messageType}, error: "Sign in to manage mail application passwords"});
    return null;
  } else {
    const document = await memberModel.findById(memberId).lean();
    if (!document) {
      res.status(404).json({request: {messageType}, error: "Member not found"});
      return null;
    } else {
      return transforms.toObjectWithId(document) as Member;
    }
  }
}
