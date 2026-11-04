import { simpleParser } from "mailparser";
import { isArray, omit } from "es-toolkit/compat";
import { CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import {
  InboxAddress,
  InboxMessage,
  InboxThread,
  InboxMessageDirection,
  InboxReaderProvider,
  InboxThreadFolder
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { derivedAliasForEmail } from "../inbox/inbox-aliases";
import { recordThreadDeletion, restoreDeletedThread } from "../inbox/inbox-deleted";
import { recordOutboundMessage, storeInboundMessage } from "../inbox/inbox-message-import";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { dateTimeNow } from "../shared/dates";
import { defaultTenantSlug } from "../inbox/inbox-aliases";
import { MailClientAppendResult, MailClientMailbox } from "./mail-client-imap.model";
import { storeMailClientAttachments } from "./mail-client-submit";
import { mailboxUidState, mailboxMessageUid, mailboxByName } from "./mail-client-imap-mailbox";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";

export async function appendMailClientRfc822(
  role: CommitteeMember,
  mailbox: MailClientMailbox,
  raw: Buffer,
  member: Member
): Promise<MailClientAppendResult> {
  const parsed = await simpleParser(raw, {skipImageLinks: true});
  const from = firstAddress(parsed.from) ?? {name: role.fullName || "", email: role.email};
  const to = addressesOf(parsed.to);
  const cc = addressesOf(parsed.cc);
  const messageId = parsed.messageId || `<imap-append-${dateTimeNow().toMillis()}@mail-client.example.invalid>`;
  const existingById = await inboxMessageModel.findOne({messageId}).lean() as InboxMessage | null;
  const existingThread = existingById?.threadId
    ? await inboxThreadModel.findById(existingById.threadId).select("roleType folder").lean() as InboxThread | null
    : null;
  const existing = existingThread?.roleType === role.type && existingThread.folder !== InboxThreadFolder.DELETED ? existingById : null;
  const alias = await derivedAliasForEmail(role.email);
  if (!alias) {
    throw new Error("That role address is not mapped in the committee inbox");
  } else {
    const outbound: InboxMessage = {
      threadId: existing?.threadId || "",
      mailboxConnectionId: alias.mailboxConnectionId ?? null,
      direction: InboxMessageDirection.OUTBOUND,
      messageId,
      inReplyTo: headerString(parsed.inReplyTo),
      references: referencesOf(parsed.references),
      from: {name: from.name, email: from.email},
      to,
      cc,
      deliveryRecipients: [...to, ...cc, ...addressesOf(parsed.bcc)],
      subject: parsed.subject || "(no subject)",
      bodyHtml: parsed.html ? String(parsed.html) : null,
      bodyText: parsed.text || null,
      receivedAt: mailbox.folder === InboxThreadFolder.INBOX ? dateTimeNow().toMillis() : null,
      sentAt: dateTimeNow().toMillis(),
      externalSource: InboxReaderProvider.MAIL_CLIENT,
      externalId: null,
      attachments: mailbox.folder !== InboxThreadFolder.DRAFTS && existingThread?.folder !== InboxThreadFolder.DRAFTS && existing ? existing.attachments : await storeMailClientAttachments(parsed.attachments ?? [])
    };
    if (mailbox.folder === InboxThreadFolder.DRAFTS) {
      const stored = await persistWithoutRecipients(alias.roleType, outbound, InboxThreadFolder.DRAFTS, null);
      if (existing?.threadId && existing.threadId !== stored.threadId) {
        await inboxMessageModel.deleteMany({threadId: existing.threadId});
        await inboxThreadModel.deleteMany({_id: existing.threadId});
      }
      return appendResult(role, mailbox, messageId, stored.id);
    } else {
      if (existing) {
        if (existingThread?.folder === InboxThreadFolder.DRAFTS
          || (existing.direction === InboxMessageDirection.INBOUND && sentCopyOnInbox(mailbox, outbound, role))) {
          await inboxMessageModel.updateOne(
            {threadId: existing.threadId, messageId},
            {$set: omit(outbound, ["id", "_id", "threadId"])}
          );
        }
        await placeExistingInMailbox(existing, mailbox, outbound, role);
      } else if (sentMailbox(mailbox) || sentCopyOnInbox(mailbox, outbound, role)) {
        if (outbound.deliveryRecipients?.length) {
          await recordOutboundMessage(alias, outbound);
        } else {
          await persistWithoutRecipients(alias.roleType, outbound, InboxThreadFolder.SENT, null);
        }
      } else if (mailbox.folder === InboxThreadFolder.INBOX) {
        await storeInboundMessage(alias, {...outbound, direction: InboxMessageDirection.INBOUND, receivedAt: dateTimeNow().toMillis()});
      } else if (mailbox.userFolderId) {
        const stored = outbound.deliveryRecipients?.length
          ? await recordOutboundMessage(alias, outbound)
          : await persistWithoutRecipients(alias.roleType, outbound, InboxThreadFolder.INBOX, mailbox.userFolderId);
        const threadId = stored?.threadId || stored?.id;
        if (threadId) {
          await inboxThreadModel.updateOne({_id: stored.threadId || threadId}, {$set: {userFolderId: mailbox.userFolderId}});
        }
      } else {
        await persistWithoutRecipients(alias.roleType, outbound, mailbox.folder ?? InboxThreadFolder.INBOX, mailbox.userFolderId);
      }
      return appendResult(role, mailbox, messageId, null, sentCopyOnInbox(mailbox, outbound, role));
    }
  }
}

export async function copyMailClientMessage(role: CommitteeMember, mailbox: MailClientMailbox, message: InboxMessage): Promise<MailClientAppendResult> {
  await fileThreadInMailbox(message.threadId, mailbox);
  return appendResult(role, mailbox, message.messageId, message.id);
}

export async function fileThreadInMailbox(threadId: string, mailbox: MailClientMailbox): Promise<void> {
  if (!threadId) {
    throw new Error("Message has no conversation");
  } else if (mailbox.folder === InboxThreadFolder.DELETED && !mailbox.userFolderId) {
    const thread = await inboxThreadModel.findById(threadId).lean() as InboxThread | null;
    const messages = thread ? await inboxMessageModel.find({threadId}).lean() as InboxMessage[] : [];
    if (!thread) {
      throw new Error("Message has no conversation");
    } else {
      await recordThreadDeletion(thread, messages, threadId);
    }
  } else {
    await restoreDeletedThread(threadId);
    if (mailbox.userFolderId) {
      await inboxThreadModel.updateOne({_id: threadId}, {$set: {userFolderId: mailbox.userFolderId, folder: InboxThreadFolder.INBOX}});
    } else if (mailbox.folder && mailbox.folder !== InboxThreadFolder.INBOX) {
      await inboxThreadModel.updateOne({_id: threadId}, {$set: {folder: mailbox.folder}, $unset: {userFolderId: 1}});
    }
  }
}

async function appendResult(role: CommitteeMember, mailbox: MailClientMailbox, messageId: string, documentId: string | null = null, redirectedToSent = false): Promise<MailClientAppendResult> {
  const uid = await mailboxMessageUid(role, mailbox, messageId, documentId);
  const state = await mailboxUidState(role, mailbox);
  if (!uid && !redirectedToSent) {
    throw new Error("Message was stored without an IMAP identifier");
  } else {
    return {uidValidity: state.uidValidity, uid};
  }
}

async function placeExistingInMailbox(existing: InboxMessage, mailbox: MailClientMailbox, outbound: InboxMessage, role: CommitteeMember): Promise<void> {
  if ((sentMailbox(mailbox) || sentCopyOnInbox(mailbox, outbound, role)) && existing.threadId) {
    const inboundCount = await inboxMessageModel.countDocuments({threadId: existing.threadId, direction: InboxMessageDirection.INBOUND});
    if (inboundCount === 0) {
      await inboxThreadModel.updateOne(
        {_id: existing.threadId, folder: {$in: [InboxThreadFolder.INBOX, InboxThreadFolder.DRAFTS]}, userFolderId: null},
        {$set: {folder: InboxThreadFolder.SENT}, $unset: {userFolderId: 1}}
      );
    }
  } else if (mailbox.userFolderId && existing.threadId) {
    await inboxThreadModel.updateOne({_id: existing.threadId}, {$set: {userFolderId: mailbox.userFolderId, folder: InboxThreadFolder.INBOX}});
  } else if (mailbox.folder === InboxThreadFolder.DRAFTS && existing.threadId) {
    await inboxThreadModel.updateOne({_id: existing.threadId}, {$set: {folder: InboxThreadFolder.DRAFTS}});
  }
}

function sentMailbox(mailbox: MailClientMailbox): boolean {
  return mailbox.folder === InboxThreadFolder.SENT
    || mailboxByName([{name: "Sent", folder: InboxThreadFolder.SENT, userFolderId: null}], mailbox.name) !== null;
}

function sentCopyOnInbox(mailbox: MailClientMailbox, outbound: InboxMessage, role: CommitteeMember): boolean {
  const from = (outbound.from?.email || "").trim().toLowerCase();
  const roleEmail = (role.email || "").trim().toLowerCase();
  return mailbox.folder === InboxThreadFolder.INBOX
    && !mailbox.userFolderId
    && Boolean(from)
    && from === roleEmail
    && (outbound.deliveryRecipients?.length ?? 0) > 0;
}

async function persistWithoutRecipients(roleType: string, outbound: InboxMessage, folder: InboxThreadFolder, userFolderId: string | null): Promise<InboxMessage> {
  const now = dateTimeNow().toMillis();
  const createdThread = await inboxThreadModel.create({
    tenantSlug: defaultTenantSlug(),
    roleType,
    folder,
    userFolderId,
    subject: outbound.subject,
    normalisedSubject: (outbound.subject || "").trim().toLowerCase(),
    slug: `imap-append-${now}`,
    firstSeenAt: now,
    lastSeenAt: now,
    lastDirection: outbound.direction,
    unread: false,
    messageIds: [outbound.messageId],
    sentFrom: outbound.from,
    externalAddress: outbound.to?.[0] || outbound.from
  });
  const threadId = createdThread.id ?? createdThread._id?.toString() ?? "";
  const created = await inboxMessageModel.create({...omit(outbound, ["id", "_id"]), threadId});
  return {...created.toObject(), id: created.id ?? created._id?.toString(), threadId};
}

function addressesOf(field: unknown): InboxAddress[] {
  if (!field) {
    return [];
  } else {
    const objects = isArray(field) ? field : [field];
    return objects.flatMap((object: {value?: {address?: string; name?: string}[]}) => (object.value ?? [])
      .filter(entry => Boolean(entry.address && entry.address.includes("@")))
      .map(entry => ({name: entry.name?.trim() ? entry.name.trim() : null, email: (entry.address ?? "").trim()})));
  }
}

function firstAddress(field: unknown): InboxAddress | null {
  return addressesOf(field)[0] ?? null;
}

function headerString(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  } else if (isArray(value)) {
    return value[0] ?? null;
  } else {
    return value;
  }
}

function referencesOf(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  } else if (isArray(value)) {
    return value;
  } else {
    return value.split(/\s+/).filter(Boolean);
  }
}
