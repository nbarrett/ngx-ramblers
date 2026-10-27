import { InboxAddress, InboxMessage } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { dateTimeFromMillis } from "../shared/dates";

export function rfc822ForMessage(message: InboxMessage): string {
  const from = formatAddress(message.from);
  const to = (message.to ?? []).map(formatAddress).join(", ");
  const cc = (message.cc ?? []).map(formatAddress).join(", ");
  const dateMillis = message.sentAt ?? message.receivedAt ?? 0;
  const body = message.bodyHtml || (message.bodyText ? `<pre>${escapeHtml(message.bodyText)}</pre>` : "");
  const headers = [
    `From: ${from}`,
    to ? `To: ${to}` : "",
    cc ? `Cc: ${cc}` : "",
    `Subject: ${message.subject || ""}`,
    dateMillis ? `Date: ${dateTimeFromMillis(dateMillis).toUTC().toRFC2822()}` : "",
    `Message-ID: ${message.messageId}`,
    message.inReplyTo ? `In-Reply-To: ${message.inReplyTo}` : "",
    (message.references ?? []).length ? `References: ${message.references.join(" ")}` : "",
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit"
  ];
  return headers.filter(Boolean).concat("", body).join("\r\n");
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
    imapString(message.subject),
    from,
    from,
    imapAddresses([message.replyTo ?? message.from]),
    imapAddresses(message.to ?? []),
    imapAddresses(message.cc ?? []),
    "NIL",
    imapString(message.inReplyTo),
    imapString(message.messageId)
  ].join(" ")})`;
}

function imapAddresses(addresses: InboxAddress[]): string {
  const values = addresses.filter(address => address?.email).map(address => {
    const separator = address.email.lastIndexOf("@");
    return `(${imapString(address.name)} NIL ${imapString(address.email.slice(0, separator))} ${imapString(address.email.slice(separator + 1))})`;
  });
  return values.length ? `(${values.join(" ")})` : "NIL";
}

function imapString(value: string | null): string {
  return value ? `"${value.replace(/[\r\n]/g, " ").replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"` : "NIL";
}

function formatAddress(address: InboxAddress | null | undefined): string {
  if (!address?.email) {
    return "";
  } else if (address.name) {
    return `"${address.name.replace(/"/g, "")}" <${address.email}>`;
  } else {
    return address.email;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function hashString(value: string): number {
  return Array.from(value).reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0);
}
