import { CommitteeFile } from "../models/committee.model";
import { CommitteeFileEmailInclude } from "../models/email-composer.model";
import { renderEmailComposerMarkdown } from "./email-composer-markdown";

export interface CommitteeFileEmailLink {
  href: string;
  label: string;
}

export interface CommitteeFileEmailSourcePage {
  href: string;
  groupName: string;
  pageTitle: string;
}

export function hasCommitteeDocumentContent(file: Pick<CommitteeFile, "document">): boolean {
  return !!(file?.document?.markdown || "").trim();
}

export function committeeMarkdownForEmail(markdown: string): string {
  if (!markdown) {
    return "";
  } else {
    return markdown.replace(/^[ \t]*PAGEBREAK[ \t]*$/gmi, "");
  }
}

export function resolvedCommitteeFileEmailInclude(
  file: Pick<CommitteeFile, "document">,
  include: CommitteeFileEmailInclude | null
): CommitteeFileEmailInclude {
  if (!hasCommitteeDocumentContent(file)) {
    return CommitteeFileEmailInclude.LINK;
  } else if (include === CommitteeFileEmailInclude.LINK
    || include === CommitteeFileEmailInclude.CONTENT
    || include === CommitteeFileEmailInclude.BOTH) {
    return include;
  } else {
    return CommitteeFileEmailInclude.CONTENT;
  }
}

export function committeeFileEmailSendsLink(include: CommitteeFileEmailInclude): boolean {
  return include === CommitteeFileEmailInclude.LINK || include === CommitteeFileEmailInclude.BOTH;
}

export function committeeFileEmailSendsContent(include: CommitteeFileEmailInclude): boolean {
  return include === CommitteeFileEmailInclude.CONTENT || include === CommitteeFileEmailInclude.BOTH;
}

export function committeeFileEmailHtml(options: {
  subject: string;
  markdown: string;
  link: CommitteeFileEmailLink | null;
  sourcePage: CommitteeFileEmailSourcePage | null;
  include: CommitteeFileEmailInclude;
}): string {
  const resolved = resolvedCommitteeFileEmailInclude({document: {markdown: options.markdown}}, options.include);
  const markdownHtml = committeeFileEmailSendsContent(resolved)
    ? renderEmailComposerMarkdown(committeeMarkdownForEmail(options.markdown))
    : "";
  const pageHtml = sourcePageHtml(options.sourcePage);
  const buttonHtml = committeeFileEmailSendsLink(resolved) ? ctaButtonHtml(options.link) : "";
  const inner = [markdownHtml, pageHtml, buttonHtml].filter(part => !!part).join("\n");
  return messageItemHtml(options.subject, inner);
}

function messageItemHtml(subject: string, innerHtml: string): string {
  const heading = subject
    ? `<h3 style="margin-top:0;">${escapeHtml(subject)}</h3>`
    : "";
  return `<table align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;mso-table-lspace: 0pt;mso-table-rspace: 0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;width:100%;" width="100%"><tbody><tr><td style="font-family: Helvetica, Arial, sans-serif;font-size: 16px;line-height: 150%;color: #222222;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;word-break: break-word;" valign="top">${heading}<div style="margin: 10px 0;padding: 0;font-family: Helvetica, Arial, sans-serif;font-size: 16px;line-height: 150%;color: #222222;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;">${innerHtml}</div></td></tr></tbody></table>`;
}

function sourcePageHtml(sourcePage: CommitteeFileEmailSourcePage | null): string {
  if (!sourcePage?.href) {
    return "";
  } else {
    return `<p style="margin: 4px 0 0 0;">Also available on our ${escapeHtml(sourcePage.groupName)} <a href="${escapeAttr(sourcePage.href)}">${escapeHtml(sourcePage.pageTitle)}</a> page.</p>`;
  }
}

function ctaButtonHtml(link: CommitteeFileEmailLink | null): string {
  if (!link?.href) {
    return "";
  } else {
    const label = escapeHtml(link.label);
    const href = escapeAttr(link.href);
    return `<table align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;width:100%;margin-top:12px;" width="100%"><tbody><tr><td align="center" style="padding-top: 0;padding-bottom: 18px;" valign="top"><table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate !important;border-radius: 0px;background-color: #F9B104;" width="100%"><tbody><tr><td align="center" style="font-family: Arial;font-size: 16px;padding: 12px;" valign="middle"><a href="${href}" title="${label}" style="font-weight:bold;letter-spacing:normal;line-height:100%;text-align:center;text-decoration:none;color:#222222;display:block;">${label}</a></td></tr></tbody></table></td></tr></tbody></table>`;
  }
}

function escapeHtml(value: string): string {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}
