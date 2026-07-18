import { Request, Response } from "express";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { CommitteeConfig } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { specialVisibilityGrants } from "./inbox-visibility-rules";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import * as config from "../mongo/controllers/config";
import { collaborativeRoleTypes, defaultTenantSlug } from "./inbox-aliases";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { inboxGeneralRoleTypeFor, InboxMailboxConnection, InboxPrivacyMode, InboxReaderProvider } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { systemConfig } from "../config/system-config";

function member(req: Request): Partial<MemberCookie> {
  return (req.user ?? {}) as Partial<MemberCookie>;
}

export function inboxConfigurationAdministrator(req: Request): boolean {
  return member(req).memberAdmin === true;
}

export function requireInboxConfigurationAdministrator(req: Request, res: Response): boolean {
  if (inboxConfigurationAdministrator(req)) {
    return true;
  }
  res.status(403).json({error: "Member administrator access is required to configure inbox aliases"});
  return false;
}

export async function permittedInboxRoleTypes(req: Request): Promise<string[]> {
  return permittedInboxRoleTypesForMember(member(req));
}

export async function assignedInboxRoleTypesForMember(authenticatedMember: Partial<MemberCookie>): Promise<string[]> {
  const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
  const committeeConfig: CommitteeConfig = committeeConfigDocument?.value;
  return (committeeConfig?.roles ?? [])
    .filter(role => role.memberId === authenticatedMember.memberId)
    .map(role => role.type);
}

export async function inboxPrivacyMode(): Promise<InboxPrivacyMode> {
  return (await systemConfig())?.inbox?.privacyMode ?? InboxPrivacyMode.CONFIGURABLE;
}

export async function permittedToReadJunk(req: Request): Promise<boolean> {
  if (await inboxPrivacyMode() === InboxPrivacyMode.PRIVATE) {
    return false;
  }
  const assignedRoleTypes = await assignedInboxRoleTypesForMember(member(req));
  const junkVisibility = (await systemConfig())?.inbox?.specialVisibility?.junk;
  return specialVisibilityGrants(junkVisibility, assignedRoleTypes);
}

export async function permittedInboxRoleTypesForMember(authenticatedMember: Partial<MemberCookie>): Promise<string[]> {
  const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
  const committeeConfig: CommitteeConfig = committeeConfigDocument?.value;
  const roles = committeeConfig?.roles ?? [];
  const assignedRoleTypes = await assignedInboxRoleTypesForMember(authenticatedMember);
  if (await inboxPrivacyMode() === InboxPrivacyMode.PRIVATE) {
    return assignedRoleTypes;
  }
  if (assignedRoleTypes.length === 0) {
    return [];
  }
  const generalRoleTypes = await generalInboxRoleTypes();
  const otherVisibility = (await systemConfig())?.inbox?.specialVisibility?.other;
  const otherGranted = specialVisibilityGrants(otherVisibility, assignedRoleTypes);
  const visibleToEveryoneRoleTypes = roles
    .filter(role => role.inboxVisibleToAllRoles !== false)
    .map(role => role.type);
  const sharedWithAssignedRoleTypes = roles
    .filter(role => (role.inboxVisibleToRoleTypes ?? []).some(roleType => assignedRoleTypes.includes(roleType)))
    .map(role => role.type);
  const restrictedRoleTypes = new Set(roles.filter(role => role.inboxVisibleToAllRoles === false).map(role => role.type));
  const collaborative = (await collaborativeRoleTypes(defaultTenantSlug())).filter(roleType => !restrictedRoleTypes.has(roleType));
  const accessibleRoleTypes = [...new Set([...assignedRoleTypes, ...visibleToEveryoneRoleTypes, ...sharedWithAssignedRoleTypes, ...collaborative])];
  return otherGranted ? [...new Set([...accessibleRoleTypes, ...generalRoleTypes])] : accessibleRoleTypes;
}

async function generalInboxRoleTypes(): Promise<string[]> {
  const connections = await inboxMailboxConnectionModel.find({
    tenantSlug: defaultTenantSlug(),
    $or: [
      {provider: InboxReaderProvider.GMAIL_API, importAllMessages: true},
      {provider: InboxReaderProvider.CLOUDFLARE_INGRESS}
    ],
    enabled: true
  }).select("_id").lean() as unknown as InboxMailboxConnection[];
  return connections.map(connection => inboxGeneralRoleTypeFor((connection as unknown as {_id: {toString(): string}})._id.toString()));
}

export async function requireInboxRoleAccess(req: Request, res: Response, roleType: string): Promise<boolean> {
  const roleTypes = await permittedInboxRoleTypes(req);
  if (roleTypes.includes(roleType)) {
    return true;
  }
  res.status(403).json({error: "You do not have access to this role mailbox"});
  return false;
}
