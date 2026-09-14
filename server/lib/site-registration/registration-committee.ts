import {Db} from "mongodb";
import {isArray, isString, mapValues} from "es-toolkit/compat";
import {CommitteeConfig, CommitteeMember, RoleType, committeeRoleTypeFromDescription, uniqueCommitteeRoleType} from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import {PageContent, PageContentRow} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {Member} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import {RegistrationCommitteeCandidate, StoredSiteRegistration} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import {Ai} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {generate} from "../ai/ai-generation";
import {ConfigKey} from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {dateTimeNowAsValue} from "../shared/dates";
import {generateUid} from "../shared/string-utils";

const COMMITTEE_ROLE_PATTERN = "chair(?:man|person)?|secretary|treasurer|membership secretary|walks? co-ordinator|walks? coordinator|social secretary|publicity officer|webmaster|committee member";
const COMMITTEE_EXTRACTION_PROMPT = [
  "Extract only explicitly named committee members from this imported walking-group website content.",
  "Return a JSON array whose objects contain role, name and email string fields.",
  "Copy each value exactly from the supplied content. Use an empty email when none is shown.",
  "Do not infer people, roles or addresses. Exclude vacancies and generic contact labels.",
  "Return only JSON."
].join(" ");

function textValues(rows: PageContentRow[]): string[] {
  return rows.flatMap(row => (row.columns || []).flatMap(column => [column.contentText || "", ...textValues(column.rows || [])])).filter(Boolean);
}

function committeeSource(pages: PageContent[]): string {
  return pages.filter(page => /committee|contact/i.test(page.path)).flatMap(page => textValues(page.rows || [])).join("\n");
}

function cleanMarkdown(value: string): string {
  return value.replace(/[*_#`]/g, "").replace(/\[([^\]]+)]\([^)]+\)/g, "$1").trim();
}

function heuristicCandidates(source: string): RegistrationCommitteeCandidate[] {
  const roleFirst = new RegExp(`^(${COMMITTEE_ROLE_PATTERN})\\s*[:–-]\\s*([^|]{2,80})$`, "i");
  const nameFirst = new RegExp(`^([^|]{2,80})\\s*[,–-]\\s*(${COMMITTEE_ROLE_PATTERN})$`, "i");
  return source.split("\n").map(cleanMarkdown).flatMap(line => {
    const email = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const withoutEmail = line.replace(email, "").replace(/[()<>]/g, "").trim();
    const first = withoutEmail.match(roleFirst);
    const second = withoutEmail.match(nameFirst);
    if (first) {
      return [{role: first[1].trim(), name: first[2].trim(), email}];
    } else if (second) {
      return [{role: second[2].trim(), name: second[1].trim(), email}];
    } else {
      return [];
    }
  });
}

function parsedCandidates(value: string): RegistrationCommitteeCandidate[] {
  try {
    const parsed = JSON.parse(value.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    return isArray(parsed) ? parsed.filter(item => isString(item?.role) && isString(item?.name)).map(item => ({
      role: item.role.trim(), name: item.name.trim(), email: isString(item.email) ? item.email.trim() : ""
    })) : [];
  } catch (error) {
    return [];
  }
}

function authenticCandidates(source: string, candidates: RegistrationCommitteeCandidate[]): RegistrationCommitteeCandidate[] {
  const normalised = source.toLowerCase();
  return candidates.filter(candidate => candidate.role && candidate.name && normalised.includes(candidate.role.toLowerCase()) && normalised.includes(candidate.name.toLowerCase()) &&
    (!candidate.email || normalised.includes(candidate.email.toLowerCase())))
    .reduce((found, candidate) => found.some(existing => existing.role.toLowerCase() === candidate.role.toLowerCase() && existing.name.toLowerCase() === candidate.name.toLowerCase()) ? found : [...found, candidate], [] as RegistrationCommitteeCandidate[]);
}

export async function registrationCommitteeCandidates(pages: PageContent[], ai: Ai): Promise<RegistrationCommitteeCandidate[]> {
  const source = committeeSource(pages);
  if (!source) {
    return [];
  } else if (ai?.enabled) {
    const generated = await generate(ai, COMMITTEE_EXTRACTION_PROMPT, source, 2048).catch(() => "[]");
    const extracted = authenticCandidates(source, parsedCandidates(generated));
    return extracted.length > 0 ? extracted : authenticCandidates(source, heuristicCandidates(source));
  } else {
    return authenticCandidates(source, heuristicCandidates(source));
  }
}

function memberFrom(candidate: RegistrationCommitteeCandidate): Member {
  const names = candidate.name.trim().split(/\s+/);
  const createdAt = dateTimeNowAsValue();
  const firstName = names[0];
  const lastName = names.slice(1).join(" ") || names[0];
  const memberId = generateUid();
  return {
    memberId, userName: candidate.email.toLowerCase() || `migration-${memberId}`, email: candidate.email.toLowerCase(), firstName, lastName,
    displayName: candidate.name, groupMember: true, committee: true, revoked: false, createdDate: createdAt, createdBy: "site-registration",
    updatedDate: createdAt, updatedBy: "site-registration"
  };
}

function assignedRole(candidate: RegistrationCommitteeCandidate, memberId: string, roles: CommitteeMember[]): CommitteeMember {
  const preferredType = committeeRoleTypeFromDescription(candidate.role);
  const existing = roles.find(role => role.type === preferredType || role.description.toLowerCase() === candidate.role.toLowerCase());
  return {
    ...(existing || {type: uniqueCommitteeRoleType(preferredType, roles.map(role => role.type), candidate.email), roleType: RoleType.COMMITTEE_MEMBER}),
    description: candidate.role, fullName: candidate.name, nameAndDescription: `${candidate.name} - ${candidate.role}`,
    email: candidate.email.toLowerCase(), memberId, vacant: false
  };
}

export async function importRegistrationCommittee(db: Db, pages: PageContent[], registration: StoredSiteRegistration, ai: Ai): Promise<number> {
  const candidates = await registrationCommitteeCandidates(pages, ai);
  const committeeDocument = await db.collection<{key: string; value: CommitteeConfig}>("config").findOne({key: ConfigKey.COMMITTEE});
  if (!committeeDocument?.value || candidates.length === 0) {
    return 0;
  } else {
    const assignments: CommitteeMember[] = [];
    for (const candidate of candidates) {
      const member = memberFrom(candidate);
      const query = candidate.email ? {email: candidate.email.toLowerCase()} : {firstName: member.firstName, lastName: member.lastName};
      const stored = await db.collection<Member>("members").findOneAndUpdate(query, {$set: {committee: true, groupMember: true, updatedDate: member.updatedDate, updatedBy: member.updatedBy}, $setOnInsert: member}, {upsert: true, returnDocument: "after"});
      assignments.push(assignedRole(candidate, stored.memberId || stored._id.toString(), [...committeeDocument.value.roles, ...assignments]));
    }
    const assignedTypes = new Map(assignments.map(role => [role.type, role]));
    const roles = committeeDocument.value.roles.map(role => assignments.find(assignment => assignment.type === role.type) || role)
      .concat(assignments.filter(assignment => !committeeDocument.value.roles.some(role => role.type === assignment.type)));
    const currentContactUs = (committeeDocument.value.contactUs || {}) as Record<string, CommitteeMember>;
    const contactUs = mapValues(currentContactUs, (role: CommitteeMember) => assignedTypes.get(role.type) || role) as CommitteeConfig["contactUs"];
    await db.collection("config").updateOne({key: ConfigKey.COMMITTEE}, {$set: {"value.roles": roles, "value.contactUs": contactUs}});
    return candidates.length;
  }
}
