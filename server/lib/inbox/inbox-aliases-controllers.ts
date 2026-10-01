import { connectionForAlias } from "./inbox-thread-context";
import { Request, Response } from "express";
import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { isArray, isBoolean, isString } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { errorResponse } from "../shared/error-response";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { InboxAliasConfig, InboxAliasConfigView, InboxMailboxConnection, InboxRoleNotificationSetting, isInboxGeneralRoleType } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { normaliseEmail, validEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { canUpdateInboxRoleNotifications, inboxConfigurationAdministrator, permittedInboxRoleTypes, permittedToReadJunk, requestMember, requireCanUpdateInboxRoleNotifications } from "./inbox-access";
import { defaultTenantSlug, connectionIdentifier as connectionId, assignedMembersByMemberId, clearDerivedAliasCache, derivedAliasForRoleType, derivedAliases } from "./inbox-aliases";
import * as config from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig, CommitteeMember, InboxRoleRecipient } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { sanitiseConnection } from "./inbox-connections-controllers";
const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);
export async function listInboxAliases(req: Request, res: Response): Promise<void> {
  try {
    const isConfigAdministrator = inboxConfigurationAdministrator(req);
    const forConfiguration = req.query.forConfiguration === "true";
    const forMyAssignments = req.query.forMyAssignments === "true";
    if (forConfiguration && !isConfigAdministrator) {
      res.status(403).json({ request: { messageType }, error: "Member administrator access is required to configure inbox aliases" });
    }
    else {
      const aliases = await derivedAliases();
      let visibleAliases: InboxAliasConfig[];
      if (forConfiguration) {
        visibleAliases = aliases;
      }
      else if (forMyAssignments) {
        const memberId = requestMember(req)?.memberId;
        visibleAliases = aliases.filter(alias => Boolean(memberId)
          && (alias.recipients ?? []).some(recipient => recipient.memberId === memberId)
          && !isInboxGeneralRoleType(alias.roleType));
      }
      else {
        const allowedRoleTypes = await permittedInboxRoleTypes(req);
        visibleAliases = aliases.filter(alias => allowedRoleTypes.includes(alias.roleType));
      }
      const connections = await inboxMailboxConnectionModel.find({ tenantSlug: defaultTenantSlug() }).lean() as InboxMailboxConnection[];
      const views = visibleAliases.map(alias => {
        const connection = connections.find(candidate => connectionId(candidate) === alias.mailboxConnectionId) ?? null;
        const visibleConnection = connection && !isConfigAdministrator ? { ...connection, gmailAccountEmail: null } : connection;
        return sanitiseAlias(alias, visibleConnection);
      });
      res.json({ request: { messageType }, response: await withAssignedMemberNames(views), configuredAliasCount: aliases.length });
    }
  }
  catch (error) {
    errorDebugLog("Error listing inbox aliases:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function readJunkAccess(req: Request, res: Response): Promise<void> {
  try {
    res.json({ request: { messageType }, response: { canReadJunk: await permittedToReadJunk(req) } });
  }
  catch (error) {
    errorDebugLog("Error checking inbox junk access:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function updateRoleNotifications(req: Request, res: Response): Promise<void> {
  try {
    const enabled = req.body?.enabled;
    if (!isBoolean(enabled)) {
      res.status(400).json({ request: { messageType }, error: "enabled must be true or false" });
    }
    else {
      const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
      const committeeConfiguration: CommitteeConfig = committeeConfigDocument?.value;
      const roles: CommitteeMember[] = committeeConfiguration?.roles ?? [];
      const role = roles.find(candidate => candidate.type === req.params.roleType);
      if (requireCanUpdateInboxRoleNotifications(req, res, role, req.params.roleType)) {
        role.inboxMessageNotifications = enabled;
        await config.createOrUpdateKey(ConfigKey.COMMITTEE, committeeConfiguration);
        clearDerivedAliasCache();
        const alias = await derivedAliasForRoleType(req.params.roleType);
        if (!alias) {
          res.status(404).json({ request: { messageType }, error: `No role mailbox found for ${req.params.roleType}` });
        }
        else {
          const connection = await connectionForAlias(alias);
          const [view] = await withAssignedMemberNames([sanitiseAlias(alias, connection)]);
          res.json({ request: { messageType }, response: view });
        }
      }
    }
  }
  catch (error) {
    errorDebugLog("Error updating inbox role notifications:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function updateRoleNotificationEmail(req: Request, res: Response): Promise<void> {
  try {
    const email = req.body?.email;
    if (email !== null && email !== undefined && !isString(email)) {
      res.status(400).json({ request: { messageType }, error: "email must be a string or null" });
    }
    else {
      const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
      const committeeConfiguration: CommitteeConfig = committeeConfigDocument?.value;
      const roles: CommitteeMember[] = committeeConfiguration?.roles ?? [];
      const role = roles.find(candidate => candidate.type === req.params.roleType);
      if (requireCanUpdateInboxRoleNotifications(req, res, role, req.params.roleType)) {
        role.inboxNotificationEmail = isString(email) && email.trim().length > 0 ? email.trim() : undefined;
        await config.createOrUpdateKey(ConfigKey.COMMITTEE, committeeConfiguration);
        clearDerivedAliasCache();
        const alias = await derivedAliasForRoleType(req.params.roleType);
        if (!alias) {
          res.status(404).json({ request: { messageType }, error: `No role mailbox found for ${req.params.roleType}` });
        }
        else {
          const connection = await connectionForAlias(alias);
          const [view] = await withAssignedMemberNames([sanitiseAlias(alias, connection)]);
          res.json({ request: { messageType }, response: view });
        }
      }
    }
  }
  catch (error) {
    errorDebugLog("Error updating inbox role notification email:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function updateAliasNotifications(req: Request, res: Response): Promise<void> {
  try {
    const changes = req.body?.changes;
    if (!isArray(changes)) {
      res.status(400).json({ request: { messageType }, error: "changes must be an array" });
    }
    else {
      const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
      const committeeConfiguration: CommitteeConfig = committeeConfigDocument?.value;
      const roles: CommitteeMember[] = committeeConfiguration?.roles ?? [];
      const typedChanges = changes as InboxRoleNotificationSetting[];
      const isAdmin = inboxConfigurationAdministrator(req);
      const requesterId = requestMember(req)?.memberId;
      const disallowed = typedChanges.find(change => {
        const role = roleForNotificationChange(roles, change);
        const permitted = Boolean(role) && (isAdmin || (Boolean(requesterId) && !roleReferenceAssignment(change) && change.memberId === requesterId && change.remove !== true && canUpdateInboxRoleNotifications(req, role)));
        return !permitted;
      });
      if (disallowed) {
        res.status(403).json({ request: { messageType }, error: "You can only change notification settings for roles assigned to you" });
      }
      else {
        const invalidAddress = typedChanges.find(change => !roleReferenceAssignment(change) && !change.memberId && change.remove !== true && !validEmail((change.email ?? "").trim()));
        if (invalidAddress) {
          res.status(400).json({ request: { messageType }, error: `${invalidAddress.email || "(empty)"} is not a valid email address` });
        }
        else {
          typedChanges.forEach(change => {
            const role = roleForNotificationChange(roles, change);
            if (role) {
              applyNotificationChange(role, change);
            }
          });
          await config.createOrUpdateKey(ConfigKey.COMMITTEE, committeeConfiguration);
          clearDerivedAliasCache();
          res.json({ request: { messageType }, response: { updated: typedChanges.length } });
        }
      }
    }
  }
  catch (error) {
    errorDebugLog("Error updating inbox role notifications:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
function sanitiseAlias(record: InboxAliasConfig, connection: InboxMailboxConnection | null): InboxAliasConfigView {
  return {
    ...record,
    mailboxConnection: connection ? sanitiseConnection(connection) : null,
    assignedMemberName: null,
    assignedMemberEmail: null,
    recipients: (record.recipients ?? []).map(recipient => ({ ...recipient, memberName: null, memberEmail: null }))
  };
}
async function withAssignedMemberNames(views: InboxAliasConfigView[]): Promise<InboxAliasConfigView[]> {
  const memberIds = views.flatMap(view => [view.memberId, ...view.recipients.map(recipient => recipient.memberId)]);
  const membersByMemberId = await assignedMembersByMemberId(memberIds);
  return views.map(view => {
    const assigned = view.memberId ? membersByMemberId.get(view.memberId) ?? null : null;
    const recipients = view.recipients.map(recipient => {
      const recipientMember = recipient.memberId ? membersByMemberId.get(recipient.memberId) ?? null : null;
      return { ...recipient, memberName: recipientMember?.name ?? null, memberEmail: recipientMember?.email ?? null };
    });
    return { ...view, assignedMemberName: assigned?.name ?? null, assignedMemberEmail: assigned?.email ?? null, recipients };
  });
}
function sameRecipientIdentity(recipient: InboxRoleRecipient, change: InboxRoleNotificationSetting): boolean {
  if (change.memberId) {
    return recipient.memberId === change.memberId;
  }
  else {
    return !recipient.memberId && normaliseEmail(recipient.email ?? "") === normaliseEmail(change.email ?? "");
  }
}
function roleReferenceAssignment(change: InboxRoleNotificationSetting): boolean {
  return change.recipientsFromRoleType !== undefined;
}
function roleForNotificationChange(roles: CommitteeMember[], change: InboxRoleNotificationSetting): CommitteeMember | null {
  const ofType = roles.filter(candidate => candidate.type === change.roleType);
  const wantedEmail = change.roleEmail ? normaliseEmail(change.roleEmail) : null;
  const matched = wantedEmail
    ? ofType.find(candidate => normaliseEmail(candidate.email) === wantedEmail)
    : null;
  return matched ?? ofType[0] ?? null;
}
function applyNotificationChange(role: CommitteeMember, change: InboxRoleNotificationSetting): void {
  const overrideEmail = isString(change.notificationEmail) && change.notificationEmail.trim().length > 0 ? change.notificationEmail.trim() : null;
  if (roleReferenceAssignment(change)) {
    role.inboxRecipientsFromRoleType = change.recipientsFromRoleType?.trim() || undefined;
  }
  else if (change.memberId && change.memberId === role.memberId) {
    role.inboxMessageNotifications = change.notify === true;
    role.inboxNotificationEmail = change.notify === true && overrideEmail ? overrideEmail : undefined;
    role.inboxRecipients = (role.inboxRecipients ?? []).filter(recipient => recipient.memberId !== change.memberId);
  }
  else {
    const configured = role.inboxRecipients ?? [];
    if (change.remove === true) {
      role.inboxRecipients = configured.filter(recipient => !sameRecipientIdentity(recipient, change));
    }
    else {
      const entry: InboxRoleRecipient = change.memberId
        ? { memberId: change.memberId, email: overrideEmail, notify: change.notify === true }
        : { memberId: null, email: (change.email ?? "").trim(), notify: change.notify === true };
      const exists = configured.some(recipient => sameRecipientIdentity(recipient, change));
      role.inboxRecipients = exists
        ? configured.map(recipient => sameRecipientIdentity(recipient, change) ? entry : recipient)
        : configured.concat(entry);
    }
  }
}
