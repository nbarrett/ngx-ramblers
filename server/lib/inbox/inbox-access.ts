import { Request, Response } from "express";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { CommitteeConfig } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import * as config from "../mongo/controllers/config";
import { collaborativeRoleTypes, defaultTenantSlug } from "./inbox-aliases";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { inboxGeneralRoleTypeFor, InboxMailboxConnection, InboxReaderProvider } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";

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

export async function permittedInboxRoleTypesForMember(authenticatedMember: Partial<MemberCookie>): Promise<string[]> {
  const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
  const committeeConfig: CommitteeConfig = committeeConfigDocument?.value;
  const roles = committeeConfig?.roles ?? [];
  if (authenticatedMember.memberAdmin === true) {
    const generalRoleTypes = await generalInboxRoleTypes();
    return [...new Set([...roles.map(role => role.type), ...generalRoleTypes])];
  }
  const assignedRoleTypes = await assignedInboxRoleTypesForMember(authenticatedMember);
  if (assignedRoleTypes.length === 0) {
    return [];
  }
  const collaborative = await collaborativeRoleTypes(defaultTenantSlug());
  return [...new Set(assignedRoleTypes.concat(collaborative))];
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
