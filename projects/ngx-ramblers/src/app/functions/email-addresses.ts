import { ParsedMailbox, RecipientDraftOutcome, RecipientDraftOutcomeKind } from "../models/email-composer.model";

const MAILBOX_IN_BRACKETS = /^(.*?)<\s*([^>\s]+@[^>\s]+)\s*>\s*$/;
const INLINE_EMAIL = /([^\s<>"',;]+@[^\s<>"',;]+)/;

export function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

export function capitalisePersonName(value: string): string {
  return (value || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(word => word ? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}` : word)
    .join(" ");
}

export function looksLikePersonName(value: string): boolean {
  const trimmed = (value || "").trim();
  return !!trimmed && !trimmed.includes("@") && /[A-Za-z]/.test(trimmed);
}

export function interpretRecipientDraft(raw: string, saved: {name?: string; email: string}[]): RecipientDraftOutcome {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return {kind: RecipientDraftOutcomeKind.EMPTY};
  } else {
    const parsed = parseEmailAddressList(trimmed);
    if (parsed.length === 0) {
      if (looksLikePersonName(trimmed)) {
        const name = capitalisePersonName(trimmed);
        const matches = saved.filter(item => (item.name || "").trim().toLowerCase() === name.toLowerCase());
        const email = matches.length === 1 ? matches[0].email : "";
        return {kind: RecipientDraftOutcomeKind.PENDING_NAME, name, email};
      } else {
        return {kind: RecipientDraftOutcomeKind.INVALID};
      }
    } else {
      return {kind: RecipientDraftOutcomeKind.ADD, mailboxes: parsed};
    }
  }
}

export function parseEmailAddress(input: string): ParsedMailbox | null {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return null;
  } else {
    const bracket = trimmed.match(MAILBOX_IN_BRACKETS);
    if (bracket) {
      const name = capitalisePersonName(bracket[1].replace(/[*_`"']/g, ""));
      return {name, email: bracket[2].trim()};
    } else {
      const inlineEmail = trimmed.match(INLINE_EMAIL);
      if (inlineEmail) {
        const email = inlineEmail[1].replace(/^[<\[]+|[>\]]+$/g, "");
        const name = capitalisePersonName(trimmed.replace(inlineEmail[0], "").replace(/[*_`"'<>\[\]()]/g, ""));
        return {name, email};
      } else {
        return null;
      }
    }
  }
}

const MAILBOX_GLOBAL = /(?:"([^"]+)"|([^<,;\n]+?))?\s*<\s*([^\s<>]+@[^\s<>]+)\s*>/g;

function normaliseAddressList(input: string): string {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[＜‹«]/g, "<")
    .replace(/[＞›»]/g, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/；/g, ";")
    .replace(/，/g, ",")
    .replace(/\[([^\]]+)\]\(mailto:([^)]+)\)/gi, (_match, text: string, email: string) => {
      const cleanedText = text.trim();
      const cleanedEmail = email.trim();
      return cleanedText.toLowerCase() === cleanedEmail.toLowerCase() ? `<${cleanedEmail}>` : `${cleanedText} <${cleanedEmail}>`;
    });
}

function mailboxName(quoted: string, plain: string): string {
  return (quoted || plain || "").replace(/[*_`']/g, "").trim();
}

export function parseEmailAddressList(input: string): ParsedMailbox[] {
  if (!input) {
    return [];
  } else {
    const normalised = normaliseAddressList(input);
    const fromBrackets = [...normalised.matchAll(MAILBOX_GLOBAL)]
      .map(match => ({name: capitalisePersonName(mailboxName(match[1], match[2])), email: (match[3] || "").trim()}))
      .filter(item => isValidEmailAddress(item.email));
    const remainder = normalised.replace(MAILBOX_GLOBAL, " ");
    const fromRemainder = splitAddressList(remainder)
      .map(part => parseEmailAddress(part))
      .filter((item): item is ParsedMailbox => !!item && isValidEmailAddress(item.email));
    const seen = new Set<string>();
    return [...fromBrackets, ...fromRemainder].filter(item => {
      const key = item.email.toLowerCase();
      if (seen.has(key)) {
        return false;
      } else {
        seen.add(key);
        return true;
      }
    });
  }
}

function splitAddressList(input: string): string[] {
  const state = {current: "", inQuotes: false, angle: 0};
  const parts: string[] = [];
  [...input].forEach(char => {
    if (char === "\"" && state.angle === 0) {
      state.inQuotes = !state.inQuotes;
      state.current += char;
    } else if (char === "<" && !state.inQuotes) {
      state.angle += 1;
      state.current += char;
    } else if (char === ">" && !state.inQuotes && state.angle > 0) {
      state.angle -= 1;
      state.current += char;
    } else if ((char === "," || char === ";" || char === "\n" || char === "\r") && !state.inQuotes && state.angle === 0) {
      if (state.current.trim()) {
        parts.push(state.current.trim());
      }
      state.current = "";
    } else {
      state.current += char;
    }
  });
  if (state.current.trim()) {
    parts.push(state.current.trim());
  }
  return parts;
}
