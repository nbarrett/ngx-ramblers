import { createHash } from "crypto";
import MailComposer from "nodemailer/lib/mail-composer";
import { parseHeaderValue } from "nodemailer/lib/mime-funcs";
import { isNumber, toPairs } from "es-toolkit/compat";
import { InboxAddress, InboxMessage } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { objectBufferForKey, objectSizeForKey } from "../aws/aws-controllers";
import { dateTimeFromMillis } from "../shared/dates";
import { rfc822ForMessage, rfc822MessageId } from "./mail-client-rfc822";
import { MailClientMessageMetadata, MailClientMimeFetch, MailClientMimeHeader, MailClientMimeMessage, MailClientMimePart } from "./mail-client-mime.model";

export function mailClientListingMime(message: MailClientMessageMetadata): MailClientMimeMessage {
  const mime = mailClientMimeFromBuffer(Buffer.from(rfc822ForMessage({...message, bodyHtml: null, bodyText: null}), "utf8"));
  const bodyBytes = isNumber(message.bodySizeBytes) ? message.bodySizeBytes : 0;
  const encodedBodySize = bodyBytes > 0 ? encodedBase64Bytes(bodyBytes) + 2 : 0;
  return {...mime, size: mime.raw.length + encodedBodySize,
    root: {...mime.root, bodySize: encodedBodySize, bodyLines: bodyBytes > 0 ? Math.ceil(Math.ceil(bodyBytes / 3) * 4 / 76) : 0}};
}

export async function mailClientMimeForMessage(message: MailClientMessageMetadata, metadataOnly = false): Promise<MailClientMimeMessage> {
  if (!(message.attachments ?? []).length) {
    const virtualBody = metadataOnly && isNumber(message.bodySizeBytes);
    const mime = virtualBody ? mailClientListingMime(message) : mailClientMimeFromBuffer(Buffer.from(rfc822ForMessage(message), "utf8"));
    return mime;
  } else {
    const attachmentSizes = metadataOnly ? await Promise.all(message.attachments.map(attachment => attachment.s3Key
      ? attachment.sizeBytes > 0 ? attachment.sizeBytes : objectSizeForKey(attachment.s3Key)
      : null)) : [];
    const attachments = await Promise.all(message.attachments.map(async attachment => {
      if (!attachment.s3Key) {
        return {
          filename: `${attachment.filename || "attachment"}.unavailable.txt`,
          contentType: "text/plain",
          content: Buffer.from(`The original attachment "${attachment.filename || "attachment"}" has no stored content and cannot be downloaded. The rest of this message is available.`, "utf8"),
          contentDisposition: "attachment"
        };
      } else {
        return {
          filename: attachment.filename || "attachment",
          contentType: attachment.contentType || "application/octet-stream",
          content: metadataOnly ? Buffer.alloc(0) : await objectBufferForKey(attachment.s3Key),
          ...(attachment.contentId ? {cid: attachment.contentId.replace(/^<|>$/g, ""), contentDisposition: "inline"} : {contentDisposition: "attachment"})
        };
      }
    }));
    const options = {
      from: mailAddress(message.from),
      to: (message.to ?? []).map(mailAddress),
      cc: (message.cc ?? []).map(mailAddress),
      replyTo: mailAddress(message.replyTo ?? message.from),
      subject: message.subject || "",
      messageId: rfc822MessageId(message),
      inReplyTo: message.inReplyTo || null,
      references: message.references ?? [],
      date: dateTimeFromMillis(message.sentAt ?? message.receivedAt ?? 0).toJSDate(),
      html: message.bodyHtml || null,
      text: message.bodyText || (!message.bodyHtml ? " " : null),
      attachments,
      baseBoundary: createHash("sha256").update(message.id || message.messageId).digest("hex").slice(0, 16),
      disableFileAccess: true,
      disableUrlAccess: true,
      newline: "windows"
    };
    const raw = await new MailComposer(options).compile().build();
    const mime = mailClientMimeFromBuffer(raw);
    return metadataOnly ? withAttachmentSizes(mime, message, attachmentSizes) : mime;
  }
}

function withAttachmentSizes(mime: MailClientMimeMessage, message: InboxMessage, sizes: (number | null)[]): MailClientMimeMessage {
  const remaining = {indices: message.attachments.map((_attachment, index) => index)};
  const extraBytes = leafParts(mime.root).reduce((extra, part) => {
    const disposition = parseHeaderValue(headerValue(part.headers, "content-disposition") || "").value;
    const contentId = (headerValue(part.headers, "content-id") || "").replace(/^<|>$/g, "") || null;
    const filename = parseHeaderValue(headerValue(part.headers, "content-disposition") || "").params.filename || null;
    const index = remaining.indices.find(candidate => {
      const attachment = message.attachments[candidate];
      const attachmentId = attachment.s3Key ? (attachment.contentId?.replace(/^<|>$/g, "") || null) : null;
      const sameContent = attachmentId !== null && contentId !== null && attachmentId === contentId;
      const sameFile = (disposition === "attachment" || disposition === "inline") && filename !== null && attachment.filename === filename;
      return sameContent || sameFile;
    });
    if ((disposition === "attachment" || disposition === "inline") && index !== null && index !== undefined) {
      remaining.indices = remaining.indices.filter(candidate => candidate !== index);
      const size = sizes[index];
      if (size !== null) {
        part.bodySize = encodedBase64Bytes(size);
        part.bodyLines = part.bodySize > 0 ? Math.floor((Math.ceil(size / 3) * 4 - 1) / 76) + 1 : 0;
        return extra + part.bodySize - part.body.length;
      } else {
        return extra;
      }
    } else {
      return extra;
    }
  }, 0);
  return {...mime, size: mime.raw.length + extraBytes};
}

function encodedBase64Bytes(size: number): number {
  const characters = Math.ceil(size / 3) * 4;
  const breaks = characters > 0 ? Math.floor((characters - 1) / 76) : 0;
  return characters + breaks * 2;
}

function leafParts(part: MailClientMimePart): MailClientMimePart[] {
  return part.children.length ? part.children.flatMap(leafParts) : [part];
}

export function mailClientMimeFromBuffer(raw: Buffer): MailClientMimeMessage {
  return {raw, root: mimePartFromBuffer(raw)};
}

export function mailClientBodyStructure(message: MailClientMimeMessage, extended = true): string {
  return bodyStructureForPart(message.root, extended);
}

export function mailClientBodySection(message: MailClientMimeMessage, section: string): Buffer | null {
  const normalised = section.trim().toUpperCase();
  const numbered = normalised.match(/^(\d+(?:\.\d+)*)(?:\.(MIME|TEXT|HEADER(?:\.FIELDS(?:\.NOT)?\s+\([^)]*\))?))?$/);
  if (!normalised) {
    return message.raw;
  } else if (numbered) {
    const part = partForNumbers(message.root, numbered[1].split(".").map(Number));
    if (!part) {
      return null;
    } else if (numbered[2] === "MIME") {
      return headerBuffer(part.headers.filter(header => /^content-/i.test(header.name)));
    } else if (numbered[2] === "TEXT" || !numbered[2]) {
      return part.body;
    } else if (numbered[2].startsWith("HEADER")) {
      return selectedHeaders(part.headers, numbered[2]);
    } else {
      return null;
    }
  } else if (normalised === "TEXT") {
    return message.root.body;
  } else if (normalised === "HEADER" || /^HEADER\.FIELDS(?:\.NOT)?\s+\([^)]*\)$/.test(normalised)) {
    return selectedHeaders(message.root.headers, normalised);
  } else {
    return null;
  }
}

export function mailClientBodyFetches(message: MailClientMimeMessage, items: string): MailClientMimeFetch[] {
  return Array.from(items.matchAll(/\bBODY(?:\.PEEK)?\[([^\]]*)\](?:<(\d+)\.(\d+)>)?|\bRFC822(?:\.HEADER|\.TEXT)?(?=[ )]|$)/gi))
    .map(match => {
      const bodySection = match[1] != null;
      const rfc822 = match[0].toUpperCase();
      const section = bodySection ? match[1] : rfc822 === "RFC822.HEADER" ? "HEADER" : rfc822 === "RFC822.TEXT" ? "TEXT" : "";
      const content = mailClientBodySection(message, section);
      const partial = bodySection && match[2] != null;
      const offset = partial ? Number(match[2]) : 0;
      const requested = partial ? Number(match[3]) : 0;
      const slice = content && partial ? content.subarray(offset, offset + requested) : content;
      return {
        label: bodySection ? `BODY[${section}]${partial ? `<${offset}>` : ""}` : rfc822,
        content: slice
      };
    });
}

function mimePartFromBuffer(raw: Buffer): MailClientMimePart {
  const separator = raw.indexOf("\r\n\r\n");
  const headerText = raw.subarray(0, separator < 0 ? raw.length : separator).toString("utf8");
  const body = separator < 0 ? Buffer.alloc(0) : raw.subarray(separator + 4);
  const headers = headerText.split(/\r\n(?![ \t])/).filter(Boolean).map(line => {
    const colon = line.indexOf(":");
    return {name: line.slice(0, colon).toLowerCase(), value: line.slice(colon + 1).replace(/\r\n[ \t]+/g, " ").trim(), raw: line};
  });
  const contentType = parseHeaderValue(headerValue(headers, "content-type") || "text/plain");
  const [type, subtype] = contentType.value.toUpperCase().split("/");
  const parameters = contentType.params;
  const children = type === "MULTIPART" && parameters.boundary ? multipartChildren(body, parameters.boundary) : [];
  return {raw, body, headers, type, subtype: subtype || "PLAIN", parameters, children};
}

function multipartChildren(body: Buffer, boundary: string): MailClientMimePart[] {
  const text = body.toString("latin1");
  const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundaries = Array.from(text.matchAll(new RegExp(`(?:^|\\r\\n)--${escapedBoundary}(--)?[ \\t]*(?:\\r\\n|$)`, "g")));
  return boundaries.filter((match, index) => !match[1] && index < boundaries.length - 1)
    .map(match => {
      const index = boundaries.indexOf(match);
      const start = match.index + match[0].length;
      return mimePartFromBuffer(body.subarray(start, boundaries[index + 1].index));
    });
}

function bodyStructureForPart(part: MailClientMimePart, extended: boolean): string {
  if (part.type === "MULTIPART") {
    const children = part.children.map(child => bodyStructureForPart(child, extended)).join(" ");
    const extensions = extended ? ` ${imapParameters(part.parameters)} ${imapDisposition(part)} NIL NIL` : "";
    return `(${children} ${imapString(part.subtype)}${extensions})`;
  } else {
    const encoding = headerValue(part.headers, "content-transfer-encoding") || "7BIT";
    const fields = [imapString(part.type), imapString(part.subtype), imapParameters(part.parameters), imapString(headerValue(part.headers, "content-id")), imapString(headerValue(part.headers, "content-description")), imapString(encoding.toUpperCase()), part.bodySize ?? part.body.length];
    const textLines = part.type === "TEXT" ? ` ${part.bodyLines ?? lineCount(part.body)}` : "";
    const extensions = extended ? ` NIL ${imapDisposition(part)} NIL NIL` : "";
    return `(${fields.join(" ")}${textLines}${extensions})`;
  }
}

function partForNumbers(root: MailClientMimePart, numbers: number[]): MailClientMimePart | null {
  return numbers.reduce<MailClientMimePart | null>((part, number, index) => {
    if (part?.type === "MULTIPART") {
      return part.children[number - 1] ?? null;
    } else if (index === 0 && number === 1) {
      return part;
    } else {
      return null;
    }
  }, root);
}

function selectedHeaders(headers: MailClientMimeHeader[], section: string): Buffer {
  const fields = section.match(/^HEADER\.FIELDS(\.NOT)?\s+\(([^)]*)\)$/);
  const selected = fields
    ? headers.filter(header => fields[2].toLowerCase().split(/\s+/).includes(header.name) !== !!fields[1])
    : headers;
  return headerBuffer(selected);
}

function headerBuffer(headers: MailClientMimeHeader[]): Buffer {
  return Buffer.from(headers.length ? headers.map(header => header.raw).join("\r\n") + "\r\n\r\n" : "\r\n", "utf8");
}

function headerValue(headers: MailClientMimeHeader[], name: string): string | null {
  return headers.find(header => header.name === name)?.value ?? null;
}

function imapParameters(parameters: Record<string, string>): string {
  const pairs = toPairs(parameters);
  return pairs.length ? `(${pairs.map(([name, value]) => `${imapString(name.toUpperCase())} ${imapString(value)}`).join(" ")})` : "NIL";
}

function imapDisposition(part: MailClientMimePart): string {
  const value = headerValue(part.headers, "content-disposition");
  if (value) {
    const disposition = parseHeaderValue(value);
    return `(${imapString(disposition.value.toUpperCase())} ${imapParameters(disposition.params)})`;
  } else {
    return "NIL";
  }
}

function imapString(value: string | null): string {
  return value ? `"${value.replace(/[\r\n]/g, " ").replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"` : "NIL";
}

function lineCount(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  return Array.from(text.matchAll(/\r\n/g)).length + (text && !text.endsWith("\r\n") ? 1 : 0);
}

function mailAddress(address: InboxAddress) {
  return {name: address.name || "", address: address.email};
}
