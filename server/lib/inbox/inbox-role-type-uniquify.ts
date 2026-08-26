import { CommitteeMember, roleEmailAddresses, uniqueCommitteeRoleTypes } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { InboxAddress } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";

export interface CommitteeRoleTypeChange {
  from: string;
  to: string;
  emails: string[];
  remapAllThreads: boolean;
}

export interface InboxThreadRoleHint {
  roleType: string;
  deliveredTo?: InboxAddress | null;
  sentFrom?: InboxAddress | null;
}

export function committeeRoleTypeChanges(roles: CommitteeMember[]): CommitteeRoleTypeChange[] {
  const uniqued = uniqueCommitteeRoleTypes(roles);
  const countByType = roles.reduce<Record<string, number>>((counts, role) => {
    counts[role.type] = (counts[role.type] ?? 0) + 1;
    return counts;
  }, {});
  return roles.reduce<CommitteeRoleTypeChange[]>((changes, role, index) => {
    const to = uniqued[index]?.type;
    if (!to || to === role.type) {
      return changes;
    } else {
      return changes.concat({
        from: role.type,
        to,
        emails: roleEmailAddresses(uniqued[index]).map(normaliseEmail).filter(Boolean),
        remapAllThreads: (countByType[role.type] ?? 0) === 1
      });
    }
  }, []);
}

export function committeeRolesWithUniqueTypes(roles: CommitteeMember[]): CommitteeMember[] {
  const uniqued = uniqueCommitteeRoleTypes(roles);
  const exclusiveRenames = committeeRoleTypeChanges(roles)
    .filter(change => change.remapAllThreads)
    .reduce<Record<string, string>>((map, change) => {
      map[change.from] = change.to;
      return map;
    }, {});
  return uniqued.map(role => {
    const referenced = role.inboxRecipientsFromRoleType?.trim() || "";
    const rewritten = exclusiveRenames[referenced];
    return rewritten ? {...role, inboxRecipientsFromRoleType: rewritten} : role;
  });
}

export function threadMatchesRoleTypeChange(thread: InboxThreadRoleHint, messageEmails: string[], change: CommitteeRoleTypeChange): boolean {
  if (thread.roleType !== change.from) {
    return false;
  } else if (change.remapAllThreads) {
    return true;
  } else {
    const roleEmails = new Set(change.emails);
    const addresses = [thread.deliveredTo?.email, thread.sentFrom?.email, ...messageEmails]
      .map(email => normaliseEmail(email ?? ""))
      .filter(Boolean);
    return addresses.some(email => roleEmails.has(email));
  }
}
