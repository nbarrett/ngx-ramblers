import { envConfig } from "../env-config/env-config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig, CommitteeMember, ForwardEmailTarget } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { InboxAccessMode, InboxAliasConfig, inboxGeneralRoleTypeFor, InboxMailboxConnection, isInboxGeneralRoleType } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import * as config from "../mongo/controllers/config";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";

export function defaultTenantSlug(): string {
  return envConfig.value("APP_NAME" as never) ?? "default";
}

export function connectionIdentifier(connection: InboxMailboxConnection): string {
  return (connection.id ?? (connection as unknown as {_id: {toString(): string}})._id?.toString() ?? "").toString();
}

async function committeeRoles(): Promise<CommitteeMember[]> {
  const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
  const committeeConfig: CommitteeConfig = committeeConfigDocument?.value;
  return (committeeConfig?.roles ?? []).filter(role => !role.vacant && Boolean(role.email));
}

function backingConnectionEmail(role: CommitteeMember): string | null {
  if (role.forwardEmailTarget === ForwardEmailTarget.CUSTOM && role.forwardEmailCustom) {
    return normaliseEmail(role.forwardEmailCustom);
  }
  if (role.forwardEmailTarget === ForwardEmailTarget.MULTIPLE) {
    return (role.forwardEmailRecipients ?? []).map(normaliseEmail).find(Boolean) ?? null;
  }
  return null;
}

function catchAllConnection(connections: InboxMailboxConnection[]): InboxMailboxConnection | null {
  return connections.length === 1 ? connections[0] : null;
}

function connectionForRole(role: CommitteeMember, connectionsByEmail: Map<string, InboxMailboxConnection>, catchAll: InboxMailboxConnection | null): InboxMailboxConnection | null {
  if (role.forwardEmailTarget === ForwardEmailTarget.CATCHALL) {
    return catchAll;
  }
  const targetEmail = backingConnectionEmail(role);
  return targetEmail ? connectionsByEmail.get(targetEmail) ?? null : null;
}

function generalAliasFor(connection: InboxMailboxConnection, tenantSlug: string): InboxAliasConfig {
  const connectionId = connectionIdentifier(connection);
  return {
    id: inboxGeneralRoleTypeFor(connectionId),
    tenantSlug,
    roleType: inboxGeneralRoleTypeFor(connectionId),
    roleEmail: connection.gmailAccountEmail ?? "",
    mailboxConnectionId: connectionId,
    enabled: true
  };
}

function aliasFor(role: CommitteeMember, connection: InboxMailboxConnection, tenantSlug: string): InboxAliasConfig {
  return {
    id: role.type,
    tenantSlug,
    roleType: role.type,
    roleEmail: role.email,
    mailboxConnectionId: connectionIdentifier(connection),
    enabled: true
  };
}

async function connectedMailboxesByEmail(tenantSlug: string): Promise<Map<string, InboxMailboxConnection>> {
  const connections = await inboxMailboxConnectionModel.find({
    tenantSlug,
    enabled: true,
    gmailAccountEmail: {$ne: null}
  }).lean() as InboxMailboxConnection[];
  return connections.reduce((map, connection) => {
    map.set(normaliseEmail(connection.gmailAccountEmail), connection);
    return map;
  }, new Map<string, InboxMailboxConnection>());
}

export async function derivedAliases(): Promise<InboxAliasConfig[]> {
  const tenantSlug = defaultTenantSlug();
  const connectionsByEmail = await connectedMailboxesByEmail(tenantSlug);
  const catchAll = catchAllConnection(Array.from(connectionsByEmail.values()));
  const roles = await committeeRoles();
  const roleAliases = roles.reduce<InboxAliasConfig[]>((aliases, role) => {
    const connection = connectionForRole(role, connectionsByEmail, catchAll);
    return connection ? aliases.concat(aliasFor(role, connection, tenantSlug)) : aliases;
  }, []);
  const generalAliases = Array.from(connectionsByEmail.values())
    .filter(connection => connection.importAllMessages)
    .map(connection => generalAliasFor(connection, tenantSlug));
  return roleAliases.concat(generalAliases);
}

export async function derivedAliasForRoleType(roleType: string): Promise<InboxAliasConfig | null> {
  if (isInboxGeneralRoleType(roleType)) {
    const tenantSlug = defaultTenantSlug();
    const connectionsByEmail = await connectedMailboxesByEmail(tenantSlug);
    const ownerConnection = Array.from(connectionsByEmail.values())
      .find(connection => connection.importAllMessages && inboxGeneralRoleTypeFor(connectionIdentifier(connection)) === roleType);
    return ownerConnection ? generalAliasFor(ownerConnection, tenantSlug) : null;
  }
  const aliases = await derivedAliases();
  return aliases.find(alias => alias.roleType === roleType) ?? null;
}

export async function derivedAliasesForConnection(connection: InboxMailboxConnection): Promise<InboxAliasConfig[]> {
  const tenantSlug = defaultTenantSlug();
  if (!connection.gmailAccountEmail) {
    return [];
  }
  const connectionsByEmail = await connectedMailboxesByEmail(tenantSlug);
  const catchAll = catchAllConnection(Array.from(connectionsByEmail.values()));
  const connectionId = connectionIdentifier(connection);
  const roles = await committeeRoles();
  const roleAliases = roles.reduce<InboxAliasConfig[]>((aliases, role) => {
    const resolved = connectionForRole(role, connectionsByEmail, catchAll);
    return resolved && connectionIdentifier(resolved) === connectionId ? aliases.concat(aliasFor(role, connection, tenantSlug)) : aliases;
  }, []);
  return connection.importAllMessages ? roleAliases.concat(generalAliasFor(connection, tenantSlug)) : roleAliases;
}

export async function catchAllConnectionEmail(tenantSlug: string): Promise<string | null> {
  const connectionsByEmail = await connectedMailboxesByEmail(tenantSlug);
  const catchAll = catchAllConnection(Array.from(connectionsByEmail.values()));
  return catchAll?.gmailAccountEmail ?? null;
}

export async function collaborativeRoleTypes(tenantSlug: string): Promise<string[]> {
  const connectionsByEmail = await connectedMailboxesByEmail(tenantSlug);
  const collaborativeConnectionIds = new Set(Array.from(connectionsByEmail.values())
    .filter(connection => connection.accessMode === InboxAccessMode.ALL_COMMITTEE_ROLES)
    .map(connectionIdentifier));
  const aliases = await derivedAliases();
  return aliases
    .filter(alias => alias.mailboxConnectionId && collaborativeConnectionIds.has(alias.mailboxConnectionId))
    .map(alias => alias.roleType);
}
