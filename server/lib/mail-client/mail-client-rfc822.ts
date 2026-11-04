import { encodeWords } from "nodemailer/lib/mime-funcs";
import { encode, wrap } from "nodemailer/lib/base64";
import { InboxAddress, InboxMessage } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { dateTimeFromMillis } from "../shared/dates";
import {toPairs} from "es-toolkit/compat";
import {RFC822_BODY_ESCAPES} from "./mail-client-mime.model";

export function rfc822ForMessage(message: InboxMessage): string {
  const from = formatAddress(message.from) || "unknown@localhost";
  const to = (message.to ?? []).map(formatAddress).join(", ");
  const cc = (message.cc ?? []).map(formatAddress).join(", ");
  const dateMillis = message.sentAt ?? message.receivedAt ?? 0;
  const body = message.bodyHtml || (message.bodyText ? `<pre>${escapeHtml(message.bodyText)}</pre>` : "");
  const messageId = rfc822MessageId(message);
  const headers = [
    `From: ${from}`,
    to ? `To: ${to}` : "",
    cc ? `Cc: ${cc}` : "",
    `Subject: ${encodedHeader(message.subject)}`,
    dateMillis ? `Date: ${dateTimeFromMillis(dateMillis).toUTC().toRFC2822()}` : "",
    `Message-ID: ${messageId}`,
    message.inReplyTo ? `In-Reply-To: ${message.inReplyTo}` : "",
    (message.references ?? []).length ? `References: ${message.references.join(" ")}` : "",
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64"
  ];
  return headers.filter(Boolean).concat("", body ? `${wrap(encode(body), 76)}\r\n` : "").join("\r\n");
}

export function rfc822MessageId(message: InboxMessage): string {
  const raw = (message.messageId || (message.id ? `${message.id}@localhost` : "unknown@localhost")).trim();
  return raw.startsWith("<") ? raw : `<${raw}>`;
}

export function imapUidFor(message: InboxMessage): number {
  const id = message.id || message.messageId || "";
  const hex = id.replace(/[^0-9a-fA-F]/g, "").slice(-8);
  const parsed = parseInt(hex, 16);
  return Number.isFinite(parsed) && parsed > 0 ? parsed % 2147483647 : Math.abs(hashString(id)) % 2147483647 || 1;
}

export function imapEnvelopeFor(message: InboxMessage): string {
  const date = dateTimeFromMillis(message.sentAt ?? message.receivedAt ?? 0).toUTC().toRFC2822();
  const from = imapAddresses([message.from]);
  return `(${[
    imapString(date),
    imapString(encodedHeader(message.subject)),
    from,
    from,
    imapAddresses([message.replyTo ?? message.from]),
    imapAddresses(message.to ?? []),
    imapAddresses(message.cc ?? []),
    "NIL",
    imapString(message.inReplyTo),
    imapString(rfc822MessageId(message))
  ].join(" ")})`;
}

function imapAddresses(addresses: InboxAddress[]): string {
  const values = addresses.filter(address => address?.email).map(address => {
    const separator = address.email.lastIndexOf("@");
    return `(${imapString(encodedHeader(address.name))} NIL ${imapString(address.email.slice(0, separator))} ${imapString(address.email.slice(separator + 1))})`;
  });
  return values.length ? `(${values.join(" ")})` : "NIL";
}

function imapString(value: string | null): string {
  return value ? `"${value.replace(/[\r\n]/g, " ").replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"` : "NIL";
}

function encodedHeader(value: string | null): string {
  return encodeWords((value || "").replace(/[\r\n]/g, " "), "Q", 52);
}

function formatAddress(address: InboxAddress | null | undefined): string {
  if (!address?.email) {
    return "";
  } else if (address.name) {
    return `"${encodedHeader(address.name).replace(/"/g, "")}" <${address.email}>`;
  } else {
    return address.email;
  }
}

function escapeHtml(value: string): string {
  return toPairs(RFC822_BODY_ESCAPES).reduce((text, [find, replacement]) => text.replaceAll(find, replacement), value);
}

function hashString(value: string): number {
  return Array.from(value).reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0);
}
