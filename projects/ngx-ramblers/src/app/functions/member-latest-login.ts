import { isNumber } from "es-toolkit/compat";
import { Member, MemberLatestLogin, MemberLoginAuditSource } from "../models/member.model";

export interface LastLoginIndex {
  byMemberId: Map<string, number>;
  byUserName: Map<string, number>;
}

export function emptyLastLoginIndex(): LastLoginIndex {
  return {byMemberId: new Map<string, number>(), byUserName: new Map<string, number>()};
}

export function latestLoginsFromAudits(audits: MemberLoginAuditSource[]): MemberLatestLogin[] {
  const latest = (audits ?? []).reduce((byKey, audit) => {
    const loginTime = audit?.loginTime;
    const memberId = audit?.member?.memberId ? audit.member.memberId : null;
    const userName = audit?.userName?.trim() ? audit.userName.trim() : null;
    const key = memberId ? `id:${memberId}` : userName ? `user:${userName.toLowerCase()}` : null;
    const existing = key ? byKey.get(key) : null;
    if (isNumber(loginTime) && key && (!existing || loginTime > existing.loginTime)) {
      byKey.set(key, {memberId, userName, loginTime});
    }
    return byKey;
  }, new Map<string, MemberLatestLogin>());
  return Array.from(latest.values());
}

export function lastLoginIndex(logins: MemberLatestLogin[]): LastLoginIndex {
  return (logins ?? []).reduce((index, login) => {
    if (login.memberId) {
      const current = index.byMemberId.get(login.memberId);
      if (!isNumber(current) || login.loginTime > current) {
        index.byMemberId.set(login.memberId, login.loginTime);
      }
    }
    if (login.userName) {
      const key = login.userName.toLowerCase();
      const current = index.byUserName.get(key);
      if (!isNumber(current) || login.loginTime > current) {
        index.byUserName.set(key, login.loginTime);
      }
    }
    return index;
  }, emptyLastLoginIndex());
}

export function lastLoginTimeFor(member: Pick<Member, "id" | "userName">, index: LastLoginIndex): number | null {
  const byId = member?.id ? index.byMemberId.get(member.id) : null;
  const byName = member?.userName ? index.byUserName.get(member.userName.toLowerCase()) : null;
  const times = [byId, byName].filter(isNumber);
  return times.length ? Math.max(...times) : null;
}

export function memberHasLoggedIn(member: Pick<Member, "id" | "userName">, index: LastLoginIndex): boolean {
  return lastLoginTimeFor(member, index) !== null;
}

export function memberProfileConfirmed(member: Pick<Member, "profileSettingsConfirmed">): boolean {
  return !!member?.profileSettingsConfirmed;
}
