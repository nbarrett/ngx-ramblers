import { NextFunction, Request, Response } from "express";
import debug from "debug";
import { sendTransactionalMail } from "../brevo/transactional-mail/send-transactional-mail";
import * as config from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  CommitteeConfig,
  CommitteeMember,
  ForwardEmailTarget
} from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import {
  EmailAddress,
  SendSmtpEmailRequest
} from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { member } from "../mongo/models/member";
import { envConfig } from "../env-config/env-config";
import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";

const debugLog = debug(envConfig.logNamespace("contact-us:resolve-recipients"));
debugLog.enabled = false;

function findRoleByEmail(roles: CommitteeMember[], email: string): CommitteeMember | null {
  const target = normaliseEmail(email);
  if (!target) {
    return null;
  }
  return roles.find(role => normaliseEmail(role.email) === target) || null;
}

async function linkedMemberEmailFor(memberId: string): Promise<string | null> {
  if (!memberId) {
    return null;
  }
  try {
    const linked: any = await member.findById(memberId, { email: 1 }).lean().exec();
    return linked?.email || null;
  } catch (error: any) {
    debugLog("linkedMemberEmailFor:failed", memberId, error?.message || error);
    return null;
  }
}

function effectiveTarget(role: CommitteeMember): ForwardEmailTarget | undefined {
  return role.contactUsTarget ?? role.forwardEmailTarget;
}

function effectiveCustom(role: CommitteeMember): string {
  return role.contactUsCustom ?? role.forwardEmailCustom;
}

function effectiveRecipients(role: CommitteeMember): string[] {
  return (role.contactUsRecipients ?? role.forwardEmailRecipients) || [];
}

function nameFor(role: CommitteeMember): string {
  return role.contactUsLabel || role.fullName;
}

async function resolveOne(recipient: EmailAddress, roles: CommitteeMember[]): Promise<EmailAddress[]> {
  const role = findRoleByEmail(roles, recipient.email);
  if (!role) {
    return [recipient];
  }
  const target = effectiveTarget(role);
  const label = nameFor(role);
  switch (target) {
    case ForwardEmailTarget.CUSTOM: {
      const custom = effectiveCustom(role);
      if (custom) {
        debugLog("resolveOne:CUSTOM rewrote", recipient.email, "to", custom);
        return [{ name: label, email: custom }];
      }
      return [{ name: label, email: recipient.email }];
    }
    case ForwardEmailTarget.MULTIPLE: {
      const list = effectiveRecipients(role).filter(Boolean);
      if (list.length > 0) {
        debugLog("resolveOne:MULTIPLE rewrote", recipient.email, "to", list);
        return list.map(email => ({ name: label, email }));
      }
      return [{ name: label, email: recipient.email }];
    }
    case ForwardEmailTarget.NONE:
      debugLog("resolveOne:NONE dropping", recipient.email);
      return [];
    case ForwardEmailTarget.MEMBER_EMAIL:
    default: {
      if (!role.memberId) {
        return [{ name: label, email: recipient.email }];
      }
      const linkedEmail = await linkedMemberEmailFor(role.memberId);
      if (!linkedEmail) {
        return [{ name: label, email: recipient.email }];
      }
      debugLog("resolveOne:MEMBER_EMAIL rewrote", recipient.email, "to linked member", linkedEmail);
      return [{ name: label, email: linkedEmail }];
    }
  }
}

export async function resolveContactRecipients(to: EmailAddress[], roles: CommitteeMember[]): Promise<EmailAddress[]> {
  if (!to?.length || !roles?.length) {
    return to || [];
  }
  const resolved = await Promise.all(to.map(recipient => resolveOne(recipient, roles)));
  return resolved.flat();
}

export async function sendContactUsTransactionalMail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const emailRequest: SendSmtpEmailRequest = req.body;
    const committeeConfigDoc = await config.queryKey(ConfigKey.COMMITTEE);
    const committeeCfg: CommitteeConfig = committeeConfigDoc?.value;
    const roles: CommitteeMember[] = committeeCfg?.roles || [];
    emailRequest.to = await resolveContactRecipients(emailRequest.to || [], roles);
    debugLog("sendContactUsTransactionalMail:resolved to:", emailRequest.to);
    return sendTransactionalMail(req, res, next);
  } catch (error) {
    next(error);
  }
}
