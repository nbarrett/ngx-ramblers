import { CommitteeMember } from "../../../models/committee.model";
import { BuiltInPath } from "../../../models/content-text.model";

export interface ContactUsLinkParts {
  role: string;
  redirect: string;
}

export function buildContactUsHref(roleType: string, redirectPath: string): string {
  const role = (roleType || "").trim();
  const redirect = (redirectPath || "").trim().replace(/^\/+/, "");
  return redirect && redirect !== BuiltInPath.HOME
    ? `?contact-us&role=${role}&redirect=${redirect}`
    : `?contact-us&role=${role}`;
}

export function parseContactUsHref(href: string): ContactUsLinkParts | null {
  const raw = (href || "").trim();
  let result: ContactUsLinkParts | null = null;
  if (raw && raw.includes("contact-us")) {
    const query = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : raw;
    const params = new URLSearchParams(query);
    const role = (params.get("role") || "").trim();
    if (role) {
      result = {
        role,
        redirect: (params.get("redirect") || "").trim()
      };
    }
  }
  return result;
}

export function isContactUsHref(href: string): boolean {
  return !!parseContactUsHref(href);
}

export function defaultContactUsLabel(member: CommitteeMember | null, firstNameFromFullName: (fullName: string) => string | null): string {
  let result: string;
  if (!member) {
    result = "Contact us";
  } else {
    const description = (member.description || "").trim().toLowerCase();
    const fullName = (member.fullName || "").trim().toLowerCase();
    const isGenericContactUs = description === "contact us" || fullName === "contact us" || member.type === "contact-us";
    if (isGenericContactUs && !member.contactUsLabel) {
      result = "Contact us";
    } else {
      const fromFullName = member.fullName ? firstNameFromFullName(member.fullName) : null;
      const name = (fromFullName || member.contactUsLabel || member.description || "us").trim();
      if (name.toLowerCase().startsWith("contact ")) {
        result = name;
      } else {
        result = `Contact ${name}`;
      }
    }
  }
  return result;
}

export function contactUsRoleOptionLabel(member: CommitteeMember): string {
  const description = (member.description || "").trim();
  const fullName = (member.fullName || "").trim();
  let result: string;
  if (description && fullName && description !== fullName) {
    result = `${description} (${fullName})`;
  } else {
    result = description || fullName || member.type;
  }
  return result;
}
