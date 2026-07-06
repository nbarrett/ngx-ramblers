import { randomUUID } from "crypto";
import debug from "debug";
import { Request, Response } from "express";
import { AddressObject, Attachment, ParsedMail, simpleParser } from "mailparser";
import { isArray } from "es-toolkit/compat";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { envConfig } from "../env-config/env-config";
import { dateTimeNow } from "../shared/dates";
import {
  InboxAddress,
  InboxAttachment,
  InboxMessage,
  InboxMessageDirection,
  InboxReaderProvider
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { storeInboundMessage } from "../inbox/inbox-message-import";
import { storeInboxAttachmentBuffer } from "../inbox/inbox-attachment-store";
import {
  cloudflareIngressAliasesForMessage,
  connectionIdentifier,
  messageRecipientEmails
} from "../inbox/inbox-aliases";
import { ensureCloudflareIngressConnection } from "./cloudflare-ingress-connection";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { inboundWebhookSecret, verifyHmac } from "./inbound-signature";

const messageType = "cloudflare:inbound-inbox";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);

interface InboundInboxPayload {
  rawMimeBase64: string;
  envelopeTo?: string;
  envelopeFrom?: string;
}

function toInboxAddresses(field: AddressObject | AddressObject[] | undefined): InboxAddress[] {
  if (!field) {
    return [];
  }
  const objects = isArray(field) ? field : [field];
  return objects.flatMap(object => (object.value ?? [])
    .filter(entry => Boolean(entry.address))
    .map(entry => ({name: entry.name?.trim() ? entry.name.trim() : null, email: (entry.address ?? "").trim()})));
}

function firstInboxAddress(field: AddressObject | AddressObject[] | undefined): InboxAddress {
  return toInboxAddresses(field)[0] ?? {name: null, email: ""};
}

function normaliseReferences(references: string | string[] | undefined): string[] {
  if (!references) {
    return [];
  }
  const values = isArray(references) ? references : references.split(/\s+/);
  return values.map(value => value.trim()).filter(value => value.length > 0);
}

async function uploadAttachments(attachments: Attachment[]): Promise<InboxAttachment[]> {
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

async function parsedToInboxMessage(parsed: ParsedMail): Promise<InboxMessage> {
  const attachments = await uploadAttachments(parsed.attachments ?? []);
  const receivedAt = parsed.date ? parsed.date.getTime() : dateTimeNow().toMillis();
  return {
    threadId: "",
    mailboxConnectionId: null,
    direction: InboxMessageDirection.INBOUND,
    messageId: parsed.messageId ?? `<cf-${randomUUID()}@ngx-inbox>`,
    inReplyTo: parsed.inReplyTo ?? null,
    references: normaliseReferences(parsed.references),
    from: firstInboxAddress(parsed.from),
    to: toInboxAddresses(parsed.to),
    cc: toInboxAddresses(parsed.cc),
    subject: parsed.subject ?? "",
    bodyHtml: parsed.html || null,
    bodyText: parsed.text ?? null,
    receivedAt,
    sentAt: null,
    externalSource: InboxReaderProvider.CLOUDFLARE_INGRESS,
    externalId: parsed.messageId ?? null,
    attachments
  };
}

function withEnvelopeRecipient(message: InboxMessage, envelopeTo: string | undefined): InboxMessage {
  const address = (envelopeTo ?? "").trim();
  if (!address) {
    return message;
  }
  const alreadyPresent = messageRecipientEmails(message).includes(address.toLowerCase());
  return alreadyPresent ? message : {...message, to: message.to.concat({name: null, email: address})};
}

export async function handleInboundInbox(req: Request, res: Response): Promise<void> {
  const rawBody = (req as Request & { rawBody?: string }).rawBody;
  if (!rawBody) {
    errorDebugLog("rawBody missing on request; bodyParser.json verify may not be configured");
    res.status(500).json({request: {messageType}, error: {message: "Raw body not captured"}});
    return;
  }
  try {
    const routerSecret = envConfig.value(Environment.NGX_INBOUND_ROUTER_SECRET)?.trim() || null;
    const secret = routerSecret || await inboundWebhookSecret();
    if (!secret) {
      errorDebugLog("no shared router secret or per-site inbound webhook secret configured");
      res.status(500).json({request: {messageType}, error: {message: "Inbound webhook secret not configured on server"}});
      return;
    }
    const signatureHeader = req.header("X-NGX-Signature");
    if (!verifyHmac(rawBody, signatureHeader, secret)) {
      errorDebugLog("HMAC signature verification failed");
      res.status(401).json({request: {messageType}, error: {message: "Signature verification failed"}});
      return;
    }
    const payload = JSON.parse(rawBody) as InboundInboxPayload;
    if (!payload.rawMimeBase64) {
      res.status(400).json({request: {messageType}, error: {message: "Missing required field: rawMimeBase64"}});
      return;
    }
    const parsed = await simpleParser(Buffer.from(payload.rawMimeBase64, "base64"));
    const message = withEnvelopeRecipient(await parsedToInboxMessage(parsed), payload.envelopeTo);
    const connection = await ensureCloudflareIngressConnection();
    const aliases = await cloudflareIngressAliasesForMessage(message, connectionIdentifier(connection));
    if (aliases.length === 0) {
      debugLog("No committee role matched recipients %o for message %s; nothing stored", messageRecipientEmails(message), message.messageId);
      res.status(200).json({request: {messageType}, response: {stored: 0, matched: 0}});
      return;
    }
    await Promise.all(aliases.map(alias => storeInboundMessage(alias, message)));
    debugLog("Stored inbound message %s under %d role(s): %o", message.messageId, aliases.length, aliases.map(alias => alias.roleType));
    res.status(200).json({request: {messageType}, response: {stored: aliases.length, roleTypes: aliases.map(alias => alias.roleType)}});
  } catch (error) {
    const messageText = (error as Error).message || String(error);
    errorDebugLog("Unhandled inbound-inbox error: %s", messageText);
    res.status(500).json({request: {messageType}, error: {message: messageText}});
  }
}
