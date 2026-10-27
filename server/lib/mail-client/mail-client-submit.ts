import {mailClientSubmission} from "../mongo/models/mail-client-submission";
import {MailClientSubmissionStatus} from "../../../projects/ngx-ramblers/src/app/models/mail-client-submission.model";
import {createHash, randomUUID} from "crypto";
import {AddressObject, Attachment, ParsedMail, simpleParser} from "mailparser";
import {isArray} from "es-toolkit/compat";
import debug from "debug";
import {envConfig} from "../env-config/env-config";
import {dateTimeNow} from "../shared/dates";
import {Member} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import {
  BrandingMode,
  EmailAddress,
  emailAttachmentSupported,
  SendPurpose,
  SendSmtpEmailRequest
} from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import {
  InboxAddress,
  InboxAttachment,
  InboxMessage,
  InboxMessageDirection,
  InboxReaderProvider
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import {MAIL_CLIENT_MAX_ATTACHMENT_BYTES, MAIL_CLIENT_MAX_RECIPIENTS} from "../../../projects/ngx-ramblers/src/app/models/mail-client.model";
import {S3_BASE_URL} from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import {normaliseEmail, stripTrailingSlash} from "../../../projects/ngx-ramblers/src/app/functions/strings";
import {formatEmailComposerHtml} from "../../../projects/ngx-ramblers/src/app/functions/email-composer-markdown";
import {normaliseUnbrandedEmailContent} from "../brevo/templates/unbranded-email-layout";
import {sendTransactionalEmailRequest} from "../brevo/transactional-mail/send-transactional-mail";
import {recordOutboundMessage} from "../inbox/inbox-message-import";
import {derivedAliasForEmail, internalEmailsForConnection} from "../inbox/inbox-aliases";
import {storeInboxAttachmentBuffer} from "../inbox/inbox-attachment-store";
import {inboxMailboxConnection as inboxMailboxConnectionModel} from "../mongo/models/inbox-mailbox-connection";
import {systemConfig} from "../config/system-config";
import {allowedFromAddresses, committeeRolesForMember, mailClientAccessEnabled, roleMatchingFrom} from "./mail-client-auth";
import {mailClientSendAllowed, recordMailClientSend} from "./mail-client-rate-limit";

const debugLog = debug(envConfig.logNamespace("mail-client:submit"));
const activeSubmissions = new Set<string>();
const SUBMISSION_LEASE_MILLIS = 2 * 60 * 1000;
const recovery = {timer: null as ReturnType<typeof setInterval> | null};

export class MailClientSubmitError extends Error {
  constructor(readonly smtpCode: number, message: string) {
    super(message);
    this.name = "MailClientSubmitError";
  }
}

export async function submitMailClientMessage(member: Member, raw: Buffer): Promise<void> {
  if (!(await mailClientAccessEnabled())) {
    throw new MailClientSubmitError(550, "Mail application access is switched off in Mail Settings");
  } else if (!mailClientSendAllowed(member.id ?? "")) {
    throw new MailClientSubmitError(450, "Too many messages in the last hour");
  } else {
    const parsed = await simpleParser(raw, {skipImageLinks: true});
    await deliverParsedMessage(member, parsed, createHash("sha256").update(new Uint8Array(raw)).digest("hex"));
  }
}

async function deliverParsedMessage(member: Member, parsed: ParsedMail, payloadHash: string): Promise<void> {
  const roles = await committeeRolesForMember(member);
  const from = firstAddress(parsed.from);
  const to = addressesOf(parsed.to);
  const cc = addressesOf(parsed.cc);
  const bcc = addressesOf(parsed.bcc);
  const recipients = [...to, ...cc, ...bcc];
  const role = from?.email ? roleMatchingFrom(roles, from.email) : null;
  const attachmentBytes = (parsed.attachments ?? []).reduce((total, attachment) => total + (attachment.size || attachment.content?.length || 0), 0);
  if (!role) {
    throw new MailClientSubmitError(550, `From must be a committee role address you are allowed to use (${allowedFromAddresses(roles).join(", ") || "none assigned"})`);
  } else if (recipients.length === 0) {
    throw new MailClientSubmitError(550, "A message needs at least one recipient");
  } else if (recipients.length > MAIL_CLIENT_MAX_RECIPIENTS) {
    throw new MailClientSubmitError(552, `Mail applications can send to at most ${MAIL_CLIENT_MAX_RECIPIENTS} recipients`);
  } else if (attachmentBytes > MAIL_CLIENT_MAX_ATTACHMENT_BYTES) {
    throw new MailClientSubmitError(552, "Attachments are larger than the 10 MB limit");
  } else {
    const senderEmail = normaliseEmail(from.email);
    const alias = await derivedAliasForEmail(senderEmail);
    if (!alias) {
      throw new MailClientSubmitError(550, "That role address is not mapped in the committee inbox");
    }
    const messageId = parsed.messageId || `<${payloadHash}@mail-client.example.invalid>`;
    const submissionId = createHash("sha256").update(`${member.id}:${messageId}`).digest("hex");
    const now = dateTimeNow().toMillis();
    const claimed = await mailClientSubmission.findOneAndUpdate(
      {_id: submissionId},
      {$setOnInsert: {_id: submissionId, memberId: member.id, messageId, payloadHash, providerKey: randomUUID(), status: MailClientSubmissionStatus.PREPARING, createdAt: now, updatedAt: now}},
      {upsert: true, returnDocument: "before"}
    ).lean();
    const preparationExpired = Boolean(claimed && claimed.status === MailClientSubmissionStatus.PREPARING && claimed.updatedAt <= now - SUBMISSION_LEASE_MILLIS);
    if (claimed && claimed.payloadHash !== payloadHash) {
      throw new MailClientSubmitError(550, "Message-ID has already been used for different content");
    } else if (claimed && activeSubmissions.has(submissionId)) {
      throw new MailClientSubmitError(450, "This message is already being submitted");
    } else if (claimed && claimed.status === MailClientSubmissionStatus.PREPARING && !preparationExpired) {
      throw new MailClientSubmitError(450, "This message is already being prepared");
    } else if (claimed && claimed.status === MailClientSubmissionStatus.COMPLETED) {
      debugLog("Submission already completed", submissionId);
    } else if (claimed && (claimed.status === MailClientSubmissionStatus.DELIVERED || (claimed.status === MailClientSubmissionStatus.RECORDING && claimed.updatedAt <= now - SUBMISSION_LEASE_MILLIS)) && claimed.alias && claimed.outbound) {
      if (claimed.status === MailClientSubmissionStatus.RECORDING) {
        await mailClientSubmission.updateOne({_id: submissionId, status: MailClientSubmissionStatus.RECORDING}, {$set: {status: MailClientSubmissionStatus.DELIVERED, updatedAt: now}});
      }
      await finishSubmission(submissionId, claimed.alias, claimed.outbound, new Set(claimed.internalEmails ?? []));
    } else if (claimed && claimed.status !== MailClientSubmissionStatus.FAILED && !preparationExpired) {
      debugLog("Submission retained without retrying delivery", submissionId, claimed.status);
      throw new MailClientSubmitError(450, "This message may already have been accepted by the delivery provider. It has been kept and will not be sent again automatically.");
    } else if (claimed) {
      const retry = await mailClientSubmission.updateOne(
        {_id: submissionId, status: preparationExpired ? MailClientSubmissionStatus.PREPARING : MailClientSubmissionStatus.FAILED, ...(preparationExpired ? {updatedAt: claimed.updatedAt} : {})},
        {$set: {status: MailClientSubmissionStatus.PREPARING, error: null, updatedAt: now}}
      );
      if (!retry.modifiedCount) {
        throw new MailClientSubmitError(450, "This message is already being retried");
      }
    }
    if (!claimed || claimed.status === MailClientSubmissionStatus.FAILED || preparationExpired) {
      activeSubmissions.add(submissionId);
      const delivery = {started: false, accepted: false};
      try {
        const submission = await mailClientSubmission.findById(submissionId).lean();
        const storedAttachments = await storeAttachments(parsed.attachments ?? []);
        if (storedAttachments.some(attachment => !attachment.s3Key)) {
          throw new Error("An attachment could not be stored");
        }
        const publicUrl = await siteBaseUrl();
        const html = htmlBody(parsed, storedAttachments, publicUrl);
        const sender: EmailAddress = {name: role.fullName || from?.name || "", email: normaliseEmail(from.email)};
        const emailRequest: SendSmtpEmailRequest = {
          sender,
          replyTo: sender,
          subject: parsed.subject || "(no subject)",
          to: to.map(toEmailAddress),
          cc: cc.map(toEmailAddress),
          bcc: bcc.map(toEmailAddress),
          htmlContent: html,
          brandingMode: BrandingMode.UNBRANDED,
          headers: {"Message-ID": messageId, ...(parsed.inReplyTo ? {"In-Reply-To": headerString(parsed.inReplyTo)} : {}), ...(parsed.references ? {"References": referencesOf(parsed.references).join(" ")} : {}), "IdempotencyKey": submission.providerKey},
          params: {
            messageMergeFields: {subject: parsed.subject || "(no subject)"} as SendSmtpEmailRequest["params"]["messageMergeFields"],
            memberMergeFields: {} as SendSmtpEmailRequest["params"]["memberMergeFields"],
            systemMergeFields: {APP_URL: publicUrl} as SendSmtpEmailRequest["params"]["systemMergeFields"],
            accountMergeFields: {} as SendSmtpEmailRequest["params"]["accountMergeFields"]
          },
          attachments: storedAttachments
            .filter(attachment => emailAttachmentSupported(attachment.filename) && attachment.s3Key)
            .map(attachment => ({name: attachment.filename, url: publicAttachmentUrl(attachment.s3Key), sizeBytes: attachment.sizeBytes}))
        };
        emailRequest.attachments = emailRequest.attachments?.map(attachment => ({
          ...attachment,
          url: attachment.url.startsWith("http") ? attachment.url : `${publicUrl}/${attachment.url.replace(/^\//, "")}`
        }));
        const mailboxConnectionId = alias.mailboxConnectionId ?? null;
        const mailboxConnection = mailboxConnectionId
          ? await inboxMailboxConnectionModel.findById(mailboxConnectionId).lean()
          : null;
        const outboundMessage: InboxMessage = {
          threadId: "",
          mailboxConnectionId,
          direction: InboxMessageDirection.OUTBOUND,
          messageId,
          inReplyTo: headerString(parsed.inReplyTo),
          references: referencesOf(parsed.references),
          from: {name: sender.name, email: sender.email},
          to: to,
          cc: cc,
          deliveryRecipients: recipients,
          subject: emailRequest.subject,
          bodyHtml: html,
          bodyText: parsed.text || null,
          receivedAt: null,
          sentAt: dateTimeNow().toMillis(),
          externalSource: InboxReaderProvider.MAIL_CLIENT,
          externalId: null,
          attachments: storedAttachments
        };
        const internalEmails = mailboxConnection ? await internalEmailsForConnection(mailboxConnection) : undefined;
        await mailClientSubmission.updateOne({_id: submissionId}, {$set: {status: MailClientSubmissionStatus.SENDING, request: emailRequest, alias, outbound: outboundMessage, internalEmails: [...(internalEmails ?? [])], updatedAt: dateTimeNow().toMillis()}});
        delivery.started = true;
        const sent = await sendTransactionalEmailRequest(emailRequest, debugLog, publicUrl, SendPurpose.MAIL_CLIENT);
        delivery.accepted = true;
        outboundMessage.bodyHtml = sent.renderedHtmlContent || html;
        await mailClientSubmission.updateOne({_id: submissionId}, {$set: {status: MailClientSubmissionStatus.DELIVERED, outbound: outboundMessage, updatedAt: dateTimeNow().toMillis()}});
        recordMailClientSend(member.id ?? "");
        await finishSubmission(submissionId, alias, outboundMessage, internalEmails);
      } catch (error) {
        const providerStatus = error?.statusCode ?? error?.status;
        const duplicate = error?.body?.code === "duplicate_parameter";
        const refused = delivery.started && !delivery.accepted && !duplicate && providerStatus >= 400 && providerStatus < 500;
        const safeToRetry = !delivery.started || refused;
        try {
          await mailClientSubmission.updateOne({_id: submissionId}, {$set: {status: delivery.accepted ? MailClientSubmissionStatus.DELIVERED : safeToRetry ? MailClientSubmissionStatus.FAILED : MailClientSubmissionStatus.UNCERTAIN, error: error?.message || "Submission failed", updatedAt: dateTimeNow().toMillis()}});
        } catch (persistenceError) {
          debugLog("Unable to update durable submission outcome", submissionId, persistenceError);
        }
        if (safeToRetry) {
          throw new MailClientSubmitError(refused && providerStatus !== 408 && providerStatus !== 429 ? 550 : 450, refused && providerStatus !== 408 && providerStatus !== 429 ? "Message was refused by the delivery provider" : "Message was not sent; please retry later");
        } else {
          debugLog("Submission retained without retrying delivery", submissionId, error);
        }
      } finally {
        activeSubmissions.delete(submissionId);
      }
    }
  }
}

export async function recoverMailClientSubmissions(): Promise<void> {
  const cutoff = dateTimeNow().toMillis() - SUBMISSION_LEASE_MILLIS;
  const released = await mailClientSubmission.updateMany(
    {status: MailClientSubmissionStatus.PREPARING, updatedAt: {$lt: cutoff}},
    {$set: {status: MailClientSubmissionStatus.FAILED, error: "Preparation did not finish", updatedAt: dateTimeNow().toMillis()}}
  );
  debugLog("Released unfinished mail submissions", released.modifiedCount ?? 0);
  const repairable = await mailClientSubmission.find({
    status: {$in: [MailClientSubmissionStatus.DELIVERED, MailClientSubmissionStatus.RECORDING]},
    updatedAt: {$lt: cutoff}
  }).lean();
  await repairable.reduce<Promise<void>>(async (previous, submission) => {
    await previous;
    const submissionId = String(submission._id);
    if (submission.alias && submission.outbound) {
      if (submission.status === MailClientSubmissionStatus.RECORDING) {
        await mailClientSubmission.updateOne({_id: submissionId, status: MailClientSubmissionStatus.RECORDING}, {$set: {status: MailClientSubmissionStatus.DELIVERED, updatedAt: dateTimeNow().toMillis()}});
      }
      await finishSubmission(submissionId, submission.alias, submission.outbound, new Set(submission.internalEmails ?? []));
    } else {
      debugLog("Delivered submission is missing the sent record", submissionId);
    }
  }, Promise.resolve());
}

export function startMailClientSubmissionRecovery(): void {
  recoverMailClientSubmissions().catch(error => debugLog("Mail submission recovery failed", error));
  if (!recovery.timer) {
    recovery.timer = setInterval(() => {
      recoverMailClientSubmissions().catch(error => debugLog("Mail submission recovery failed", error));
    }, SUBMISSION_LEASE_MILLIS);
    recovery.timer.unref();
  }
}

async function finishSubmission(submissionId: string, alias: Parameters<typeof recordOutboundMessage>[0], outbound: InboxMessage, internalEmails?: Set<string>): Promise<void> {
  try {
    const claim = await mailClientSubmission.updateOne({_id: submissionId, status: MailClientSubmissionStatus.DELIVERED}, {$set: {status: MailClientSubmissionStatus.RECORDING, updatedAt: dateTimeNow().toMillis()}});
    if (claim.modifiedCount) {
      await recordOutboundMessage(alias, outbound, internalEmails);
      await mailClientSubmission.updateOne({_id: submissionId}, {$set: {status: MailClientSubmissionStatus.COMPLETED, updatedAt: dateTimeNow().toMillis()}});
    }
  } catch (error) {
    debugLog("Delivered submission awaits Sent recording", submissionId, error);
    try {
      await mailClientSubmission.updateOne({_id: submissionId, status: MailClientSubmissionStatus.RECORDING}, {$set: {status: MailClientSubmissionStatus.DELIVERED, error: error?.message, updatedAt: dateTimeNow().toMillis()}});
    } catch (persistenceError) {
      debugLog("Unable to release Sent recording claim", submissionId, persistenceError);
    }
  }
}

function publicAttachmentUrl(s3Key: string): string {
  return `${S3_BASE_URL}/${s3Key}`.replace(/\/+/g, "/");
}

async function siteBaseUrl(): Promise<string> {
  const href = ((await systemConfig())?.group?.href || "").trim();
  return stripTrailingSlash(href);
}

async function storeAttachments(attachments: Attachment[]): Promise<InboxAttachment[]> {
  return attachments.reduce<Promise<InboxAttachment[]>>(async (accumulatorPromise, attachment) => {
    const accumulator = await accumulatorPromise;
    const stored = await storeInboxAttachmentBuffer(
      attachment.filename ?? "attachment",
      attachment.contentType ?? "application/octet-stream",
      attachment.content,
      attachment.cid ?? null,
      attachment.size
    );
    return accumulator.concat(stored);
  }, Promise.resolve([]));
}

function htmlBody(parsed: ParsedMail, attachments: InboxAttachment[], publicUrl: string): string {
  if (parsed.html) {
    const inlineImages = new Map(attachments.filter(attachment => attachment.contentId && attachment.s3Key)
      .map(attachment => [attachment.contentId.replace(/^<|>$/g, "").toLowerCase(), `${publicUrl}/${publicAttachmentUrl(attachment.s3Key)}`]));
    const resolvedHtml = String(parsed.html).replace(/(\bsrc\s*=\s*)(?:(["'])cid:([^"']+)\2|cid:([^\s>]+))/gi, (_match, prefix, quote, quotedId, unquotedId) => {
      const contentId = quotedId || unquotedId;
      const url = inlineImages.get(contentId.replace(/^<|>$/g, "").toLowerCase());
      if (url) {
        return `${prefix}${quote || "\""}${url}${quote || "\""}`;
      } else {
        throw new Error("An inline image could not be resolved");
      }
    });
    return formatEmailComposerHtml(normaliseUnbrandedEmailContent(resolvedHtml));
  } else {
    const text = parsed.text || "";
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<div>${escaped.replace(/\n/g, "<br>")}</div>`;
  }
}

function addressesOf(field: AddressObject | AddressObject[] | undefined): InboxAddress[] {
  if (!field) {
    return [];
  } else {
    const objects = isArray(field) ? field : [field];
    return objects.flatMap(object => (object.value ?? [])
      .filter(entry => Boolean(entry.address && entry.address.includes("@")))
      .map(entry => ({name: entry.name?.trim() ? entry.name.trim() : null, email: (entry.address ?? "").trim()})));
  }
}

function firstAddress(field: AddressObject | AddressObject[] | undefined): InboxAddress | null {
  return addressesOf(field)[0] ?? null;
}

function toEmailAddress(address: InboxAddress): EmailAddress {
  return {name: address.name || "", email: address.email};
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
  } else {
    const values = isArray(value) ? value : value.split(/\s+/);
    return values.map(item => item.trim()).filter(item => item.length > 0);
  }
}
