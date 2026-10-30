import { createHash } from "crypto";
import MailComposer from "nodemailer/lib/mail-composer";
import { parseHeaderValue } from "nodemailer/lib/mime-funcs";
import { toPairs } from "es-toolkit/compat";
import { InboxAddress, InboxMessage } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { objectBufferForKey } from "../aws/aws-controllers";
import { dateTimeFromMillis } from "../shared/dates";
import { rfc822ForMessage } from "./mail-client-rfc822";
import { MailClientMimeFetch, MailClientMimeHeader, MailClientMimeMessage, MailClientMimePart } from "./mail-client-mime.model";

export async function mailClientMimeForMessage(message: InboxMessage, metadataOnly = false): Promise<MailClientMimeMessage> {
  if (!(message.attachments ?? []).length) {
    return mailClientMimeFromBuffer(Buffer.from(rfc822ForMessage(message), "utf8"));
  } else {
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
          content: metadataOnly && attachment.sizeBytes > 0 ? Buffer.alloc(attachment.sizeBytes) : await objectBufferForKey(attachment.s3Key),
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
      messageId: message.messageId,
      inReplyTo: message.inReplyTo || null,
      references: message.references ?? [],
      date: dateTimeFromMillis(message.sentAt ?? message.receivedAt ?? 0).toJSDate(),
      html: message.bodyHtml || null,
      text: message.bodyText || (!message.bodyHtml ? " " : null),
      attachments,
      baseBoundary: createHash("sha256").update(message.id || message.messageId).digest("hex"),
      disableFileAccess: true,
      disableUrlAccess: true,
      newline: "windows"
    };
    const raw = await new MailComposer(options).compile().build();
    return mailClientMimeFromBuffer(raw);
  }
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
      return {
        label: bodySection ? `BODY[${section}]${partial ? `<${offset}>` : ""}` : rfc822,
        content: content && partial ? content.subarray(offset, offset + Number(match[3])) : content
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
    const fields = [imapString(part.type), imapString(part.subtype), imapParameters(part.parameters), imapString(headerValue(part.headers, "content-id")), imapString(headerValue(part.headers, "content-description")), imapString(encoding.toUpperCase()), part.body.length];
    const textLines = part.type === "TEXT" ? ` ${lineCount(part.body)}` : "";
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
