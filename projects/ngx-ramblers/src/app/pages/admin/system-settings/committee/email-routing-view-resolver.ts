import { CommitteeMember } from "../../../../models/committee.model";
import {
  DestinationAddress,
  DestinationVerificationDetail,
  DestinationVerificationStatus,
  EmailRoutingActionType,
  EmailRoutingMatcherField,
  EmailRoutingMatcherType,
  EmailRoutingRule
} from "../../../../models/cloudflare-email-routing.model";
import { normaliseEmail } from "../../../../functions/strings";

export enum RoutingResolution {
  WORKER = "WORKER",
  DIRECT = "DIRECT",
  CATCH_ALL = "CATCH_ALL",
  NONE = "NONE"
}

export interface ResolvedRouting {
  resolution: RoutingResolution;
  matchingRule: EmailRoutingRule | null;
  effectiveDestination: string | null;
  workerScriptName: string | null;
}

export function roleEmailFor(committeeMember: CommitteeMember | null, baseDomain: string): string | null {
  if (!committeeMember) {
    return null;
  }
  const candidate = committeeMember.email;
  if (candidate && baseDomain && candidate.endsWith(`@${baseDomain}`)) {
    return candidate;
  }
  if (committeeMember.type && baseDomain) {
    return `${committeeMember.type}@${baseDomain}`;
  }
  return null;
}

export function resolveRouting(input: {
  roleEmail: string | null;
  rules: EmailRoutingRule[];
  catchAllRule: EmailRoutingRule | null;
}): ResolvedRouting {
  const target = normaliseEmail(input.roleEmail);
  if (!target) {
    return {resolution: RoutingResolution.NONE, matchingRule: null, effectiveDestination: null, workerScriptName: null};
  }
  const matchingRule = (input.rules || []).find(rule =>
    rule.matchers?.some(m =>
      m.type === EmailRoutingMatcherType.LITERAL
      && m.field === EmailRoutingMatcherField.TO
      && normaliseEmail(m.value) === target
    )
  );
  if (matchingRule) {
    const workerAction = matchingRule.actions?.find(a => a.type === EmailRoutingActionType.WORKER);
    if (workerAction) {
      return {
        resolution: RoutingResolution.WORKER,
        matchingRule,
        effectiveDestination: null,
        workerScriptName: workerAction.value?.[0] || null
      };
    }
    const forwardAction = matchingRule.actions?.find(a => a.type === EmailRoutingActionType.FORWARD);
    return {
      resolution: RoutingResolution.DIRECT,
      matchingRule,
      effectiveDestination: forwardAction?.value?.[0] || null,
      workerScriptName: null
    };
  }
  if (input.catchAllRule?.enabled) {
    const catchAllForward = input.catchAllRule.actions?.find(a => a.type === EmailRoutingActionType.FORWARD);
    return {
      resolution: RoutingResolution.CATCH_ALL,
      matchingRule: null,
      effectiveDestination: catchAllForward?.value?.[0] || null,
      workerScriptName: null
    };
  }
  return {resolution: RoutingResolution.NONE, matchingRule: null, effectiveDestination: null, workerScriptName: null};
}

export function destinationVerificationStatusFor(email: string | null, destinationAddresses: DestinationAddress[]): DestinationVerificationStatus | null {
  const target = normaliseEmail(email);
  if (!target) {
    return null;
  }
  const matched = (destinationAddresses || []).find(addr => normaliseEmail(addr.email) === target);
  if (!matched) {
    return DestinationVerificationStatus.NOT_REGISTERED;
  }
  return matched.verified ? DestinationVerificationStatus.VERIFIED : DestinationVerificationStatus.PENDING;
}

export function multiRecipientVerificationDetails(emails: string[], destinationAddresses: DestinationAddress[]): DestinationVerificationDetail[] {
  return (emails || []).map(email => {
    const target = normaliseEmail(email);
    const matched = (destinationAddresses || []).find(addr => normaliseEmail(addr.email) === target);
    if (matched) {
      return {
        email,
        status: matched.verified ? DestinationVerificationStatus.VERIFIED : DestinationVerificationStatus.PENDING,
        destinationAddress: matched
      };
    }
    return {email, status: DestinationVerificationStatus.NOT_REGISTERED};
  });
}
