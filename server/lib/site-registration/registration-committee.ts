import {Db, UpdateFilter} from "mongodb";
import {isArray, isString, mapValues} from "es-toolkit/compat";
import {CommitteeConfig, CommitteeMember, CONTACT_US_TYPE, RoleType, committeeRoleTypeFromDescription, uniqueCommitteeRoleType} from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import {DEFAULT_MIGRATION_NOTE_LABEL, PageContent, PageContentColumn, PageContentRow, PageContentType} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {AccessLevel} from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import {Member} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import {RegistrationCommitteeCandidate, RegistrationMigrationTemplate, RegistrationNavbarPath, RegistrationPageType, StoredSiteRegistration} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import {Ai, TextStyle} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {generate} from "../ai/ai-generation";
import {ConfigKey} from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {dateTimeNowAsValue} from "../shared/dates";
import {generateUid} from "../shared/string-utils";

const COMMITTEE_ROLE_PATTERN = "chair(?:man|person)?|secretary|treasurer|membership secretary|walks? co-ordinator|walks? coordinator|social secretary|publicity officer|webmaster|committee member|footpath secretary|programme secretary|social media editor";
const ROLE_HEADING = new RegExp(`^(${COMMITTEE_ROLE_PATTERN})$`, "i");
const PHONE_PATTERN = /(?:Call|Phone|Tel)?\s*:?\s*(\+?\d[\d\s]{8,15}\d)/i;
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

function committeePages(pages: PageContent[]): PageContent[] {
  return pages.filter(page => /(^|\/)(contact-us|contact|committee)(\/|$)/.test((page.path || "").toLowerCase()));
}

function committeeSource(pages: PageContent[]): string {
  return committeePages(pages).flatMap(page => textValues(page.rows || [])).join("\n");
}

function isPlausiblePersonName(name: string): boolean {
  const cleaned = name.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(" ");
  if (!cleaned || parts.length < 2 || /[\[\]<>()]/.test(cleaned) || /email address|walk leader|your name|insert name|\btbc\b|\btba\b|\bvacant\b|\bn\/a\b/i.test(cleaned) || ROLE_HEADING.test(cleaned)) {
    return false;
  } else {
    return parts.every(part => /^[A-Za-z][A-Za-z'-]*$/.test(part));
  }
}

function firstNamesAreTheSamePerson(left: string, right: string): boolean {
  if (left === right || left.startsWith(right) || right.startsWith(left)) {
    return true;
  } else {
    const pairs = [["andy", "andrew"], ["bob", "robert"], ["liz", "elizabeth"], ["bill", "william"], ["jim", "james"]];
    return pairs.some(pair => (pair[0] === left && pair[1] === right) || (pair[1] === left && pair[0] === right));
  }
}

function cleanMarkdown(value: string): string {
  return value.replace(/[*_#`]/g, "").replace(/\[([^\]]+)]\([^)]+\)/g, "$1").trim();
}

function lineEmail(line: string): string {
  return line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

function linePhone(line: string): string {
  const match = line.match(PHONE_PATTERN);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function heuristicCandidates(source: string): RegistrationCommitteeCandidate[] {
  const roleFirst = new RegExp(`^(${COMMITTEE_ROLE_PATTERN})\\s*[:–-]\\s*([^|]{2,80})$`, "i");
  const nameFirst = new RegExp(`^([^|]{2,80})\\s*[,–-]\\s*(${COMMITTEE_ROLE_PATTERN})$`, "i");
  return source.split("\n").reduce<{candidates: RegistrationCommitteeCandidate[]; pendingRole: string | null}>((state, raw) => {
    const email = lineEmail(raw);
    const phone = linePhone(raw);
    const withoutEmail = cleanMarkdown(raw).replace(email, "").replace(/[()<>]/g, "").trim();
    const first = withoutEmail.match(roleFirst);
    const second = withoutEmail.match(nameFirst);
    const heading = withoutEmail.match(ROLE_HEADING);
    const last = state.candidates[state.candidates.length - 1];
    const withPhone = (candidate: RegistrationCommitteeCandidate) => phone ? {...candidate, phone} : candidate;
    if (first) {
      return {candidates: state.candidates.concat([withPhone({role: first[1].trim(), name: first[2].trim(), email})]), pendingRole: null};
    } else if (second) {
      return {candidates: state.candidates.concat([withPhone({role: second[2].trim(), name: second[1].trim(), email})]), pendingRole: null};
    } else if (heading) {
      return {candidates: state.candidates, pendingRole: heading[1].trim()};
    } else if (phone && last && !last.phone) {
      return {candidates: state.candidates.slice(0, -1).concat([{...last, phone}]), pendingRole: state.pendingRole};
    } else if (state.pendingRole && withoutEmail && !/^note:/i.test(withoutEmail) && !/^please do not/i.test(withoutEmail)) {
      return {candidates: state.candidates.concat([withPhone({role: state.pendingRole, name: withoutEmail, email})]), pendingRole: null};
    } else {
      return state;
    }
  }, {candidates: [], pendingRole: null}).candidates;
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
  return candidates.filter(candidate => candidate.role && isPlausiblePersonName(candidate.name) && normalised.includes(candidate.role.toLowerCase()) && normalised.includes(candidate.name.toLowerCase()) &&
    (!candidate.email || normalised.includes(candidate.email.toLowerCase())))
    .reduce((found, candidate) => found.some(existing => existing.role.toLowerCase() === candidate.role.toLowerCase() && existing.name.toLowerCase() === candidate.name.toLowerCase()) ? found : [...found, candidate], [] as RegistrationCommitteeCandidate[]);
}

export function registrationCommitteeCandidatesFromMarkdown(source: string): RegistrationCommitteeCandidate[] {
  return authenticCandidates(source, heuristicCandidates(source));
}

export function committeeMembersFromCandidates(candidates: RegistrationCommitteeCandidate[]): CommitteeMember[] {
  return candidates.reduce<CommitteeMember[]>((roles, candidate) => roles.concat(assignedRole(candidate, "", roles)), []);
}

export async function registrationCommitteeCandidates(pages: PageContent[], ai: Ai): Promise<RegistrationCommitteeCandidate[]> {
  const source = committeeSource(pages);
  if (!source) {
    return [];
  } else if (ai?.enabled) {
    const generated = await generate(ai, COMMITTEE_EXTRACTION_PROMPT, source, 2048).catch(() => "[]");
    const extracted = authenticCandidates(source, parsedCandidates(generated));
    return extracted.length > 0 ? extracted : registrationCommitteeCandidatesFromMarkdown(source);
  } else {
    return registrationCommitteeCandidatesFromMarkdown(source);
  }
}

function memberFrom(candidate: RegistrationCommitteeCandidate): Member {
  const names = candidate.name.trim().split(/\s+/);
  const createdAt = dateTimeNowAsValue();
  const firstName = names[0];
  const lastName = names.slice(1).join(" ") || names[0];
  const generatedUserName = `migration-${generateUid()}`;
  return {
    userName: candidate.email.toLowerCase() || generatedUserName, email: candidate.email.toLowerCase(), firstName, lastName,
    displayName: candidate.name, groupMember: true, committee: true, revoked: false, createdDate: createdAt, createdBy: "site-registration",
    updatedDate: createdAt, updatedBy: "site-registration"
  };
}

export function committeeMemberUpsert(member: Member): UpdateFilter<Member> {
  const {committee, groupMember, updatedDate, updatedBy, ...insertOnly} = member;
  return {$set: {committee, groupMember, updatedDate, updatedBy}, $setOnInsert: insertOnly};
}

function comparableRole(value: string): string {
  return value.toLowerCase().replace(/chairman|chairperson/g, "chair").replace(/coordinator/g, "co-ordinator").replace(/walks/g, "walk").replace(/[^a-z0-9]+/g, " ").trim();
}

function assignedRole(candidate: RegistrationCommitteeCandidate, memberId: string, roles: CommitteeMember[]): CommitteeMember {
  const preferredType = committeeRoleTypeFromDescription(candidate.role);
  const candidateRole = comparableRole(candidate.role);
  const existing = roles.find(role => role.type === preferredType || comparableRole(role.description) === candidateRole || comparableRole(role.type) === candidateRole);
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
    const members = db.collection<Member>("members");
    for (const candidate of candidates) {
      const member = memberFrom(candidate);
      const similar = (await members.find({lastName: member.lastName}).toArray()).find(item => firstNamesAreTheSamePerson((item.firstName || "").toLowerCase(), member.firstName.toLowerCase()));
      const query = candidate.email ? {email: candidate.email.toLowerCase()} : similar ? {_id: similar._id} : {firstName: member.firstName, lastName: member.lastName};
      const stored = await members.findOneAndUpdate(query, committeeMemberUpsert(member), {upsert: true, returnDocument: "after"});
      assignments.push(assignedRole(candidate, stored.memberId || stored._id.toString(), [...committeeDocument.value.roles, ...assignments]));
    }
    const assignedTypes = new Map(assignments.map(role => [role.type, role]));
    const roles = committeeDocument.value.roles.map(role => assignments.find(assignment => assignment.type === role.type) || role)
      .concat(assignments.filter(assignment => !committeeDocument.value.roles.some(role => role.type === assignment.type)));
    const currentContactUs = (committeeDocument.value.contactUs || {}) as Record<string, CommitteeMember>;
    const contactUs = {
      ...mapValues(currentContactUs, (role: CommitteeMember) => assignedTypes.get(role.type) || role),
      ...Object.fromEntries(assignments.map(role => [role.type, role]))
    } as CommitteeConfig["contactUs"];
    await db.collection("config").updateOne({key: ConfigKey.COMMITTEE}, {$set: {"value.roles": roles, "value.contactUs": contactUs}});
    const contactTemplate = await db.collection<PageContent>("pageContent").findOne({path: RegistrationMigrationTemplate.CONTACT});
    await db.collection("pageContent").updateOne({path: RegistrationNavbarPath.CONTACT_US}, {$set: {rows: registrationContactUsRows(assignments, candidates, committeeSource(pages), contactTemplate, contactSourceUrl(registration))}});
    return candidates.length;
  }
}

function contactGivenName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function contactCardHeading(role: CommitteeMember): string {
  return `## ${role.fullName}\n### ${role.description}\n\n[Contact ${contactGivenName(role.fullName)}](?contact-us&role=${role.type}&redirect=${RegistrationNavbarPath.CONTACT_US})`;
}

function contactProfileColumn(role: CommitteeMember, imageSource = ""): PageContentColumn {
  return {
    columns: 6,
    accessLevel: AccessLevel.PUBLIC,
    rows: [{
      type: PageContentType.TEXT,
      maxColumns: 2,
      showSwiper: false,
      columns: [{
        columns: 6,
        accessLevel: AccessLevel.PUBLIC,
        contentText: contactCardHeading(role),
        styles: {class: TextStyle.AS_BUTTON}
      }, {
        columns: 6,
        accessLevel: AccessLevel.PUBLIC,
        imageSource,
        imageBorderRadius: 6,
        showPlaceholderImage: true,
        imageAspectRatio: {width: 4, height: 3, description: "Default"}
      }]
    }, {
      type: PageContentType.TEXT,
      maxColumns: 1,
      showSwiper: false,
      marginTop: 3,
      columns: [{
        columns: 12,
        accessLevel: AccessLevel.PUBLIC,
        contentText: "Profile to follow...."
      }]
    }]
  };
}

function isContactCardPrototypeRow(row: PageContentRow): boolean {
  return (row.maxColumns === 2 || row.maxColumns === 3) && (row.columns || []).some(column => /contact-us&role=/i.test(JSON.stringify(column)));
}

function isEmptyMigrationNoteRow(row: PageContentRow): boolean {
  return (row.columns || []).length === 1 && !row.columns[0].contentText && !row.columns[0].rows?.length && !row.columns[0].imageSource;
}

function contactUsRoleGroups(roles: CommitteeMember[]): CommitteeMember[][] {
  return roles.reduce<CommitteeMember[][]>((groups, role) => {
    const current = groups[groups.length - 1];
    if (!current || current.length === 2) {
      return groups.concat([[role]]);
    } else {
      return groups.slice(0, -1).concat([current.concat(role)]);
    }
  }, []);
}

function contactSourceUrl(registration: StoredSiteRegistration): string {
  const pages = registration.pages || [];
  const contact = pages.find(page => page.path === RegistrationNavbarPath.CONTACT_US && page.url && !page.proposed)
    || pages.find(page => page.type === RegistrationPageType.CONTACT && page.url && !page.proposed);
  return contact?.url || "";
}

function contactMigrationNote(sourceUrl: string): PageContentRow {
  return {
    type: PageContentType.MIGRATION_NOTE,
    maxColumns: 1,
    showSwiper: false,
    columns: [],
    migrationNote: {label: DEFAULT_MIGRATION_NOTE_LABEL, sourceUrl, migratedAt: dateTimeNowAsValue()}
  };
}

export function registrationContactUsRows(roles: CommitteeMember[], candidates: RegistrationCommitteeCandidate[], source = "", template: PageContent = null, sourceUrl = ""): PageContentRow[] {
  const filled = roles.filter(role => !role.vacant && role.type !== CONTACT_US_TYPE);
  const templateRows = template?.rows || [];
  const heading: PageContentRow = {
    type: PageContentType.TEXT,
    maxColumns: 1,
    showSwiper: false,
    columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC, contentText: "# Contact Us"}]
  };
  const chrome = templateRows.filter(row => !isContactCardPrototypeRow(row) && !isEmptyMigrationNoteRow(row));
  const cards = contactUsRoleGroups(filled).map((group, index) => ({
    type: PageContentType.TEXT,
    maxColumns: 2,
    showSwiper: false,
    ...(index === 0 ? {} : {marginTop: 3}),
    columns: group.map(role => contactProfileColumn(role))
  }));
  const leftover = leftoverContactProse(source, candidates);
  const notes = leftover ? [{
    type: PageContentType.TEXT,
    maxColumns: 12,
    showSwiper: false,
    marginTop: 2,
    columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC, contentText: leftover}]
  }] : [];
  const prefix = chrome.length > 0 ? chrome : [heading];
  const built = [...prefix, ...cards, ...notes].filter(row => row.type !== PageContentType.MIGRATION_NOTE);
  return sourceUrl ? [...built, contactMigrationNote(sourceUrl)] : built;
}

function withoutCommentForm(source: string): string {
  const marker = source.search(/(^|\n)\s*(leave a reply|cancel reply|your email address will not be published|save my name, email)\b/i);
  return marker >= 0 ? source.slice(0, marker) : source;
}

function leftoverContactProse(source: string, candidates: RegistrationCommitteeCandidate[]): string {
  return withoutCommentForm(source).split("\n").map(line => cleanMarkdown(line)).filter(line => {
    if (!line || ROLE_HEADING.test(line) || /^#+\s/.test(line) || /^contacts?$/i.test(line) || PHONE_PATTERN.test(line)
      || /^each button opens a secure form/i.test(line) || /^profile to follow/i.test(line) || /^contact\s+[a-z]/i.test(line)
      || /fill in the form/i.test(line)) {
      return false;
    } else {
      return !candidates.some(candidate => {
        const lower = line.toLowerCase();
        return lower === candidate.name.toLowerCase() || (candidate.email && lower.includes(candidate.email.toLowerCase()));
      });
    }
  }).join("\n\n").trim();
}
