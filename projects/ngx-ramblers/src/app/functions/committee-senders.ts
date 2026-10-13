import { CommitteeConfig, CommitteeMember, roleEmailAddresses } from "../models/committee.model";
import { isHostUnderDomain } from "./hosts";
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

export function sendingDomainAuthenticated(host: string, domains: { domainName: string; authenticated?: boolean }[]): boolean {
  const wanted = (host || "").trim().toLowerCase();
  return (domains || []).some(domain => domain.authenticated && isHostUnderDomain(wanted, domain.domainName));
}

export function unregisteredCommitteeSenders(committee: CommitteeConfig, domain: string, existingEmails: string[]): CommitteeSenderPlan[] {
  const host = (domain || "").trim().toLowerCase();
  const existing = new Set((existingEmails || []).map(email => normaliseEmail(email)).filter(Boolean));
  const seen = new Set<string>();
  return (committee?.roles || []).reduce<CommitteeSenderPlan[]>((plans, role) => {
    if (role.vacant) {
      return plans;
    } else {
      const addresses = roleEmailAddresses(role, host).filter(email => emailIsOnDomain(email, host));
      const alreadyRegistered = addresses.some(email => existing.has(normaliseEmail(email)));
      const primary = addresses.find(email => normaliseEmail(email) === normaliseEmail(role.email)) || addresses[0];
      const key = normaliseEmail(primary);
      if (!alreadyRegistered && key && !seen.has(key)) {
        seen.add(key);
        plans.push({ email: primary, name: committeeSenderDisplayName(role) || primary });
      }
      return plans;
    }
  }, []);
}
