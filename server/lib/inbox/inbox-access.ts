import { Request, Response } from "express";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { CommitteeConfig, CommitteeMember, roleRecipientMemberIds } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { specialVisibilityGrants } from "./inbox-visibility-rules";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import * as config from "../mongo/controllers/config";
import { collaborativeRoleTypes, defaultTenantSlug } from "./inbox-aliases";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { inboxGeneralRoleTypeFor, InboxMailboxConnection, InboxPrivacyMode, InboxReaderProvider } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { systemConfig } from "../config/system-config";

type AuthedRequest = Request & { user?: Partial<MemberCookie> };

export function requestMember(req: Request): Partial<MemberCookie> {
  return ((req as AuthedRequest).user ?? {}) as Partial<MemberCookie>;
}

export function inboxConfigurationAdministrator(req: Request): boolean {
  return requestMember(req).memberAdmin === true;
}

export function requireInboxConfigurationAdministrator(req: Request, res: Response): boolean {
  if (inboxConfigurationAdministrator(req)) {
    return true;
  }
  res.status(403).json({error: "Member administrator access is required to configure inbox aliases"});
  return false;
}

export function canUpdateInboxRoleNotifications(req: Request, role: CommitteeMember): boolean {
  if (inboxConfigurationAdministrator(req)) {
    return true;
  }
  const memberId = requestMember(req).memberId;
  return Boolean(memberId && roleRecipientMemberIds(role).includes(memberId));
}

export function requireCanUpdateInboxRoleNotifications(req: Request, res: Response, role: CommitteeMember | undefined, roleType: string): boolean {
  if (!role) {
    res.status(404).json({error: `No committee role found for ${roleType}`});
    return false;
  }
  if (canUpdateInboxRoleNotifications(req, role)) {
    return true;
  }
  res.status(403).json({error: "You can only change notification settings for roles assigned to you"});
  return false;
}

export async function permittedInboxRoleTypes(req: Request): Promise<string[]> {
  return permittedInboxRoleTypesForMember(requestMember(req));
}

function assignedRoleTypesFromCommittee(authenticatedMember: Partial<MemberCookie>, committeeConfig: CommitteeConfig | undefined): string[] {
  return (committeeConfig?.roles ?? [])
    .filter(role => Boolean(authenticatedMember.memberId) && roleRecipientMemberIds(role).includes(authenticatedMember.memberId))
    .map(role => role.type);
}

export async function assignedInboxRoleTypesForMember(authenticatedMember: Partial<MemberCookie>): Promise<string[]> {
  const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
  const committeeConfig: CommitteeConfig = committeeConfigDocument?.value;
  return assignedRoleTypesFromCommittee(authenticatedMember, committeeConfig);
}

export async function inboxPrivacyMode(): Promise<InboxPrivacyMode> {
  return (await systemConfig())?.inbox?.privacyMode ?? InboxPrivacyMode.CONFIGURABLE;
}

export async function permittedToReadJunk(req: Request): Promise<boolean> {
  const access = await inboxAccessForMember(requestMember(req));
  return access.junkAllowed;
}

export async function permittedInboxRoleTypesForMember(authenticatedMember: Partial<MemberCookie>): Promise<string[]> {
  const access = await inboxAccessForMember(authenticatedMember);
  return access.roleTypes;
}

export async function inboxAccessForMember(authenticatedMember: Partial<MemberCookie>): Promise<{
  assignedRoleTypes: string[];
  roleTypes: string[];
  junkAllowed: boolean;
}> {
  const [committeeConfigDocument, configValue, generalRoleTypes, collaborative] = await Promise.all([
    config.queryKey(ConfigKey.COMMITTEE),
    systemConfig(),
    generalInboxRoleTypes(),
    collaborativeRoleTypes(defaultTenantSlug())
  ]);
  const committeeConfig: CommitteeConfig = committeeConfigDocument?.value;
  const roles = committeeConfig?.roles ?? [];
  const assignedRoleTypes = assignedRoleTypesFromCommittee(authenticatedMember, committeeConfig);
  const privacyMode = configValue?.inbox?.privacyMode ?? InboxPrivacyMode.CONFIGURABLE;
  if (privacyMode === InboxPrivacyMode.PRIVATE) {
    return {assignedRoleTypes, roleTypes: assignedRoleTypes, junkAllowed: false};
  } else if (assignedRoleTypes.length === 0) {
    return {assignedRoleTypes, roleTypes: [], junkAllowed: false};
  } else {
    const junkAllowed = specialVisibilityGrants(configValue?.inbox?.specialVisibility?.junk, assignedRoleTypes);
    const otherGranted = specialVisibilityGrants(configValue?.inbox?.specialVisibility?.other, assignedRoleTypes);
    const visibleToEveryoneRoleTypes = roles
      .filter(role => role.inboxVisibleToAllRoles !== false)
      .map(role => role.type);
    const sharedWithAssignedRoleTypes = roles
      .filter(role => (role.inboxVisibleToRoleTypes ?? []).some(roleType => assignedRoleTypes.includes(roleType)))
      .map(role => role.type);
    const restrictedRoleTypes = new Set(roles.filter(role => role.inboxVisibleToAllRoles === false).map(role => role.type));
    const collaborativeVisible = collaborative.filter(roleType => !restrictedRoleTypes.has(roleType));
    const accessibleRoleTypes = [...new Set([...assignedRoleTypes, ...visibleToEveryoneRoleTypes, ...sharedWithAssignedRoleTypes, ...collaborativeVisible])];
    const roleTypes = otherGranted ? [...new Set([...accessibleRoleTypes, ...generalRoleTypes])] : accessibleRoleTypes;
    return {assignedRoleTypes, roleTypes, junkAllowed};
  }
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

export function requestingMemberId(req: Request): string | null {
  return requestMember(req).memberId ?? null;
}
