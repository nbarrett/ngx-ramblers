import { CommitteeConfig, CommitteeMember, roleEmailAddresses } from "../models/committee.model";
import { emailIsOnDomain, normaliseEmail } from "./strings";

export interface CommitteeSenderPlan {
  name: string;
  email: string;
}

export function committeeSenderDisplayName(role: CommitteeMember): string {
  const description = (role.description || "").trim();
  const fullName = (role.fullName || "").trim();
  if (description && fullName && description.toLowerCase() !== fullName.toLowerCase()) {
    const fullNameAlreadyBracketed = fullName.startsWith("(") && fullName.endsWith(")");
    return fullNameAlreadyBracketed ? `${description} ${fullName}` : `${description} (${fullName})`;
  } else {
    return description || fullName;
  }
}

export function committeeSenderPlans(committee: CommitteeConfig, domain: string): CommitteeSenderPlan[] {
  const roles: CommitteeMember[] = committee?.roles || [];
  const host = (domain || "").trim().toLowerCase();
  const seen = new Set<string>();
  return roles.reduce<CommitteeSenderPlan[]>((plans, role) => {
    const name = committeeSenderDisplayName(role);
    roleEmailAddresses(role, host).forEach(email => {
      const key = normaliseEmail(email);
      if (key && emailIsOnDomain(email, host) && !seen.has(key)) {
        seen.add(key);
        plans.push({ email, name: name || email });
      }
    });
    return plans;
  }, []);
}

export function missingCommitteeSenders(plans: CommitteeSenderPlan[], existingEmails: string[]): CommitteeSenderPlan[] {
  const existing = new Set((existingEmails || []).map(email => normaliseEmail(email)).filter(Boolean));
  return (plans || []).filter(plan => !existing.has(normaliseEmail(plan.email)));
}
