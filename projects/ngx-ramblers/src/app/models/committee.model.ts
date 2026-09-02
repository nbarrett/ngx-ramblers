import { map } from "es-toolkit/compat";
import { addressOnDomain, emailDomain, emailLocalPart, fitEmailLocalPart, normaliseEmail, toDotCase, toKebabCase, validEmailLocalPart } from "../functions/strings";
import { DateRangeUnit } from "./search.model";
import { ApiResponse, Identifiable } from "./api-response.model";
import { FileNameData } from "./aws-object.model";
import { DateValue } from "./date.model";
import { NotificationConfig } from "./mail.model";
import { Link } from "./page.model";
import { Media } from "./ramblers-walks-manager";
import { VideoMeetingInviteRecipient, VideoMeetingRsvp } from "./video-meeting.model";

export interface GroupEventType {
  eventType: string;
  area: string;
  description: string;
}
export const DEFAULT_COST_PER_MILE = 0.28;

export const uploadGroupEventType: GroupEventType = {
  area: "upload",
  eventType: "Upload Date",
  description: "Upload Date"
};

export const GroupEventTypes: { [image: string]: GroupEventType } = {
  WALK: {
    area: "walks",
    eventType: "walk",
    description: "Walk"
  },
  SOCIAL: {
    area: "social",
    eventType: "socialEvent",
    description: "Social Event"
  },
  COMMITTEE: {
    area: "committee",
    eventType: "AGM & Committee",
    description: "Committee Event"
  }
};

export function groupEventTypeFor(item: string): GroupEventType {
  return map(GroupEventTypes, (item) => item).find((eventType: GroupEventType) => eventType.description === item || eventType.area === item || eventType.eventType === item);
}

export interface CommitteeFile extends Identifiable {
  eventDate?: number;
  createdDate?: number;
  postcode?: string;
  fileType: string;
  fileNameData?: FileNameData;
  document?: CommitteeDocument;
  meeting?: CommitteeFileMeeting;
}

export enum CommitteeMeetingFormat {
  IN_PERSON = "in-person",
  ONLINE = "online",
  HYBRID = "hybrid"
}

export interface CommitteeFileMeeting {
  format: CommitteeMeetingFormat;
  room?: string;
  location?: string;
  title?: string;
  inviteNote?: string;
  durationMinutes?: number;
  invited?: boolean;
  invitedMemberIds?: string[];
  invitedRecipients?: VideoMeetingInviteRecipient[];
  invitedListId?: number;
  rsvps?: VideoMeetingRsvp[];
  organiserEmail?: string;
  organiserName?: string;
  createdBy?: string;
  createdByName?: string;
  minutesEmailedAt?: number;
  startedAt?: number;
  endedAt?: number;
  committeePagePath?: string;
  minutesSummaryPending?: boolean;
}

export function meetingIsOnline(format: CommitteeMeetingFormat): boolean {
  return format === CommitteeMeetingFormat.ONLINE || format === CommitteeMeetingFormat.HYBRID;
}

export function meetingHasVenue(format: CommitteeMeetingFormat): boolean {
  return format === CommitteeMeetingFormat.IN_PERSON || format === CommitteeMeetingFormat.HYBRID;
}

export interface CommitteeDocument {
  title?: string;
  markdown?: string;
  templateId?: string;
}

export enum CommitteeFileKind {
  ATTACHMENT = "attachment",
  COMPOSED = "composed"
}

export enum CommitteeDocumentEditMode {
  EDIT = "edit",
  PREVIEW = "preview"
}

export enum CommitteeMemberTab {
  ROLE_DETAILS = "Role Details",
  OUTBOUND_EMAIL = "Outbound Email",
  INBOUND_FORWARDING = "Inbound Forwarding",
  CONTACT_US = "Contact Us",
  EMAIL_LOGS = "Email Logs"
}


export interface DocumentConversionResponse {
  markdown: string;
  suggestedTitle?: string;
}

export interface DocumentConversionApiResponse extends ApiResponse {
  request: any;
  response?: DocumentConversionResponse;
}

export interface CommitteeFileApiResponse extends ApiResponse {
  request: any;
  response?: CommitteeFile[] | CommitteeFile;
}

export interface GroupEventSummary extends Identifiable {
  ramblersEventType?: string;
  image?: string;
  media?: Media[];
  selectedMediaIndex?: number;
  slug: string;
  selected: boolean;
  eventType: GroupEventType;
  eventDate: number;
  eventTime?: string;
  distance?: string;
  location: string;
  postcode: string;
  title: string;
  description: string;
  contactName: string;
  contactPhone?: string;
  contactEmail: string;
  contactHref?: string;
  newSinceLastNewsletter?: boolean;
}

interface NotificationImage {
  src: string;
  alt: string;
  link: Link;
}

export interface NotificationItem extends Identifiable {
  callToAction: Link;
  text: string;
  subject: string;
  image: NotificationImage;
}

export enum RoleType {
  COMMITTEE_MEMBER = "COMMITTEE_MEMBER",
  GROUP_MEMBER = "GROUP_MEMBER",
  SYSTEM_ROLE = "SYSTEM_ROLE"
}

export enum BuiltInRole {
  WALKS_CO_ORDINATOR = "WALKS_CO_ORDINATOR",
  SOCIAL_CO_ORDINATOR = "SOCIAL_CO_ORDINATOR",
  TREASURER = "TREASURER",
  CONTACT_US = "CONTACT_US"
}

export const CONTACT_US_TYPE = "contact-us";
export const CONTACT_US_LABEL = "Contact Us";

export enum ForwardEmailTarget {
  MEMBER_EMAIL = "MEMBER_EMAIL",
  ROLE_EMAIL = "ROLE_EMAIL",
  CUSTOM = "CUSTOM",
  MULTIPLE = "MULTIPLE",
  CATCHALL = "CATCHALL",
  NONE = "NONE"
}

export enum EmailDerivation {
  ROLE = "ROLE",
  FULL_NAME = "FULL_NAME"
}

export interface InboxRoleRecipient {
  memberId: string | null;
  email: string | null;
  notify: boolean;
}

export interface CommitteeMember {
  description: string;
  email: string;
  fullName: string;
  memberId?: string;
  nameAndDescription?: string;
  type: string;
  vacant?: boolean;
  roleType: RoleType;
  builtInRoleMapping?: BuiltInRole;
  emailDerivation?: EmailDerivation;
  additionalEmails?: string[];
  forwardEmailTarget?: ForwardEmailTarget;
  forwardEmailCustom?: string;
  forwardEmailRecipients?: string[];
  contactUsLabel?: string;
  contactUsTarget?: ForwardEmailTarget;
  contactUsCustom?: string;
  contactUsRecipients?: string[];
  inboxMessageNotifications?: boolean;
  inboxNotificationEmail?: string;
  inboxRecipients?: InboxRoleRecipient[];
  inboxRecipientsFromRoleType?: string;
  inboxVisibleToAllRoles?: boolean;
  inboxVisibleToRoleTypes?: string[];
}

export function roleAddressDomain(role: CommitteeMember, domain?: string | null): string {
  return (domain || emailDomain(role.email) || "").toLowerCase();
}

const ROLE_DESCRIPTION_CLAUSE_SEPARATORS = [",", ";", ":", " & ", " / "];

export function firstRoleDescriptionClause(description: string): string {
  const text = (description || "").trim();
  const cut = ROLE_DESCRIPTION_CLAUSE_SEPARATORS.reduce((earliest, separator) => {
    const index = text.indexOf(separator);
    if (index >= 0 && (earliest < 0 || index < earliest)) {
      return index;
    } else {
      return earliest;
    }
  }, -1);
  if (cut >= 0) {
    return text.slice(0, cut).trim();
  } else {
    return text;
  }
}

export function committeeRoleTypeFromDescription(description: string): string {
  return fitEmailLocalPart(toKebabCase(firstRoleDescriptionClause(description)));
}

export function preferredCommitteeRoleType(role: CommitteeMember): string {
  const existing = (role.type || "").trim();
  const fromDescription = committeeRoleTypeFromDescription(role.description || "");
  if (validEmailLocalPart(existing)) {
    return existing;
  } else if (fromDescription) {
    return fromDescription;
  } else {
    return fitEmailLocalPart(existing);
  }
}

export function derivedRoleTypeAddress(role: CommitteeMember, domain?: string | null): string | null {
  return addressOnDomain(preferredCommitteeRoleType(role), roleAddressDomain(role, domain));
}

export function derivedFullNameAddress(role: CommitteeMember, domain?: string | null): string | null {
  const localPart = role.vacant ? "" : toDotCase(role.fullName || "");
  return addressOnDomain(localPart, roleAddressDomain(role, domain));
}

export function roleEmailAddresses(role: CommitteeMember, domain?: string | null): string[] {
  const addresses = [role.email, derivedRoleTypeAddress(role, domain), derivedFullNameAddress(role, domain), ...(role.additionalEmails ?? [])]
    .map(address => (address ?? "").trim())
    .filter(address => address.length > 0 && validEmailLocalPart(emailLocalPart(address)));
  return addresses.reduce<string[]>((unique, address) => unique.some(existing => existing.toLowerCase() === address.toLowerCase()) ? unique : unique.concat(address), []);
}

export function roleMatchesEmail(role: CommitteeMember, email: string, domain?: string | null): boolean {
  const wanted = normaliseEmail(email);
  return Boolean(wanted) && roleEmailAddresses(role, domain).some(address => normaliseEmail(address) === wanted);
}

export function committeeRoleMatchingEmail(roles: CommitteeMember[], email: string, domain?: string | null): CommitteeMember | null {
  return (roles ?? []).find(role => roleMatchesEmail(role, email, domain)) ?? null;
}

export function additionalEmailsFromMailboxList(addresses: string[], defaultEmail: string | null, excludedEmails: string[] = []): string[] {
  const excluded = [defaultEmail, ...(excludedEmails ?? [])]
    .map(address => normaliseEmail(address ?? ""))
    .filter(Boolean);
  return addresses.filter(address => {
    const normalised = normaliseEmail(address);
    return Boolean(normalised) && !excluded.includes(normalised);
  });
}

export enum CommitteeMailboxKind {
  DEFAULT_SENDER = "default-sender",
  ROLE_NAME = "role-name",
  MEMBER_NAME = "member-name",
  EXTRA = "extra"
}

export interface CommitteeMailboxAddress {
  email: string;
  kind: CommitteeMailboxKind;
  generated: boolean;
}

export interface CommitteeAssignedMailboxGroup {
  roleType: string;
  roleDescription: string;
  fullName: string;
  addresses: CommitteeMailboxAddress[];
}

export interface CommitteeAssignedEmail {
  email: string;
  roleDescription: string;
  roleType: string;
}

export interface CommitteeMailboxDefaultChange {
  roleType: string;
  email: string;
}

export function committeeMailboxKind(role: CommitteeMember, email: string, domain?: string | null): CommitteeMailboxKind {
  const wanted = normaliseEmail(email);
  const roleName = normaliseEmail(derivedRoleTypeAddress(role, domain) || "");
  const memberName = normaliseEmail(derivedFullNameAddress(role, domain) || "");
  if (wanted && wanted === normaliseEmail(role.email)) {
    return CommitteeMailboxKind.DEFAULT_SENDER;
  } else if (wanted && wanted === roleName) {
    return CommitteeMailboxKind.ROLE_NAME;
  } else if (wanted && wanted === memberName) {
    return CommitteeMailboxKind.MEMBER_NAME;
  } else {
    return CommitteeMailboxKind.EXTRA;
  }
}

export function committeeMailboxAddresses(role: CommitteeMember, emails?: string[], domain?: string | null): CommitteeMailboxAddress[] {
  const generated = generatedRoleMailboxAddresses(role, domain).map(address => normaliseEmail(address));
  return (emails ?? roleEmailAddresses(role, domain)).map(email => ({
    email,
    kind: committeeMailboxKind(role, email, domain),
    generated: generated.includes(normaliseEmail(email))
  }));
}

export function generatedRoleMailboxAddresses(role: CommitteeMember, domain?: string | null): string[] {
  return [derivedRoleTypeAddress(role, domain), derivedFullNameAddress(role, domain)]
    .filter((address): address is string => Boolean(address))
    .reduce<string[]>((unique, address) => unique.some(existing => existing.toLowerCase() === address.toLowerCase()) ? unique : unique.concat(address), []);
}

export function isObsoleteGeneratedRoleLocalPart(local: string, role: CommitteeMember): boolean {
  const wanted = (local || "").trim().toLowerCase();
  const current = preferredCommitteeRoleType(role);
  if (!wanted || wanted === current) {
    return false;
  } else {
    const descriptionKebab = toKebabCase(role.description || "");
    const first = committeeRoleTypeFromDescription(role.description || "");
    const fullFit = fitEmailLocalPart(descriptionKebab);
    if (wanted === fullFit && fullFit !== current) {
      return true;
    } else {
      return Boolean(first && wanted.startsWith(`${first}-`) && (descriptionKebab === wanted || descriptionKebab.startsWith(`${wanted}-`)));
    }
  }
}

export function roleMailboxExtras(role: CommitteeMember, domain?: string | null): string[] {
  const generated = generatedRoleMailboxAddresses(role, domain);
  const obsolete = (role.additionalEmails ?? []).filter(address => isObsoleteGeneratedRoleLocalPart(emailLocalPart(address), role));
  return additionalEmailsFromMailboxList(roleEmailAddresses(role, domain), role.email, generated.concat(obsolete));
}

export function applyCommitteeRoleDefaultSender(role: CommitteeMember, address: string, domain?: string | null): CommitteeMember {
  const local = emailLocalPart(address).toLowerCase();
  const roleLocal = (role.type || "").toLowerCase();
  const nameLocal = toDotCase(role.fullName || "").toLowerCase();
  const emailDerivation = local && roleLocal && local === roleLocal
    ? EmailDerivation.ROLE
    : local && nameLocal && local === nameLocal
      ? EmailDerivation.FULL_NAME
      : role.emailDerivation;
  const updated = {
    ...role,
    email: address,
    emailDerivation,
    additionalEmails: roleEmailAddresses(role, domain)
  };
  return {...updated, additionalEmails: roleMailboxExtras(updated, domain)};
}

export function roleNotificationRecipients(role: CommitteeMember): InboxRoleRecipient[] {
  const configured = role.inboxRecipients ?? [];
  const primaryConfigured = Boolean(role.memberId) && configured.some(recipient => recipient.memberId === role.memberId);
  const primary: InboxRoleRecipient[] = role.memberId && !primaryConfigured
    ? [{memberId: role.memberId, email: role.inboxNotificationEmail?.trim() || null, notify: role.inboxMessageNotifications === true}]
    : [];
  return primary.concat(configured);
}

export function roleRecipientMemberIds(role: CommitteeMember): string[] {
  return roleNotificationRecipients(role)
    .map(recipient => recipient.memberId)
    .filter((memberId): memberId is string => Boolean(memberId));
}

export function reusableNotificationRecipients(role: CommitteeMember): InboxRoleRecipient[] {
  return roleNotificationRecipients(role)
    .filter(recipient => recipient.notify)
    .filter(recipient => !(role.memberId && recipient.memberId === role.memberId));
}

export function committeeRolesByType(roles: CommitteeMember[]): Map<string, CommitteeMember> {
  return (roles ?? []).reduce<Map<string, CommitteeMember>>((map, role) => {
    map.set(role.type, role);
    return map;
  }, new Map());
}

export function uniqueCommitteeRoleType(preferred: string, takenTypes: string[], email?: string | null): string {
  const taken = (takenTypes || []).filter(Boolean);
  if (!preferred || !taken.includes(preferred)) {
    return preferred;
  } else {
    const localPart = (email || "").split("@")[0];
    const fromEmail = localPart ? toKebabCase(localPart) : "";
    const withEmail = fromEmail ? `${preferred}-${fromEmail}` : "";
    if (withEmail && !taken.includes(withEmail)) {
      return withEmail;
    } else {
      const numbered = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
        .map(n => `${preferred}-${n}`)
        .find(candidate => !taken.includes(candidate));
      return numbered ?? `${preferred}-${taken.length + 1}`;
    }
  }
}

export function uniqueCommitteeRoleTypes(roles: CommitteeMember[]): CommitteeMember[] {
  return (roles ?? []).reduce<CommitteeMember[]>((assigned, role) => {
    const preferred = preferredCommitteeRoleType(role);
    const taken = assigned.map(existing => existing.type);
    return assigned.concat({...role, type: uniqueCommitteeRoleType(preferred, taken, role.email)});
  }, []);
}

export function notifiedRecipientsForRole(role: CommitteeMember, rolesByType: Map<string, CommitteeMember>): InboxRoleRecipient[] {
  const referencedRoleType = role.inboxRecipientsFromRoleType?.trim();
  const referencedRole = referencedRoleType ? rolesByType.get(referencedRoleType) : null;
  if (referencedRole) {
    return reusableNotificationRecipients(referencedRole);
  } else {
    return roleNotificationRecipients(role).filter(recipient => recipient.notify);
  }
}

export interface CommitteeRecipientOption {
  label: string;
  email: string;
}

export interface CommitteeRolesChangeEvent {
  committeeMember: CommitteeMember;
  roles: string[];
}

export enum CommitteeFileMeetingRole {
  AGENDA = "agenda",
  MINUTES = "minutes"
}

export const OTHER_MEETING_CATEGORY = "Other";

export interface CommitteeFileType {
  description: string;
  public?: boolean;
  meetingRole?: CommitteeFileMeetingRole;
  meetingCategory?: string;
}

export interface CommitteeMeetingType {
  description: string;
  agendaFileType?: string;
  minutesFileType?: string;
}

export function committeeMeetingTypesFromFileTypes(fileTypes: CommitteeFileType[]): CommitteeMeetingType[] {
  const byCategory = new Map<string, CommitteeMeetingType>();
  (fileTypes || []).forEach(fileType => {
    if (fileType.meetingRole && fileType.meetingCategory) {
      const meetingType = byCategory.get(fileType.meetingCategory)
        || {description: fileType.meetingCategory, agendaFileType: null, minutesFileType: null};
      if (fileType.meetingRole === CommitteeFileMeetingRole.AGENDA) {
        meetingType.agendaFileType = fileType.description;
      } else if (fileType.meetingRole === CommitteeFileMeetingRole.MINUTES) {
        meetingType.minutesFileType = fileType.description;
      }
      byCategory.set(fileType.meetingCategory, meetingType);
    }
  });
  return [...byCategory.values(), {description: OTHER_MEETING_CATEGORY, agendaFileType: null, minutesFileType: null}];
}

export function meetingFileTypes(fileTypes: CommitteeFileType[]): CommitteeFileType[] {
  return (fileTypes || []).filter(fileType => !!fileType.meetingRole);
}

export function isMeetingFileType(fileType: string, fileTypes: CommitteeFileType[]): boolean {
  return (fileTypes || []).some(candidate => candidate.description === fileType && !!candidate.meetingRole);
}

export function isAgendaFileType(fileType: string, fileTypes: CommitteeFileType[]): boolean {
  return (fileTypes || []).some(candidate => candidate.description === fileType && candidate.meetingRole === CommitteeFileMeetingRole.AGENDA);
}

export function isBookedMeetingFile(file: Pick<CommitteeFile, "fileType" | "meeting">, fileTypes: CommitteeFileType[]): boolean {
  if (isAgendaFileType(file?.fileType, fileTypes)) {
    return true;
  } else if (file?.fileType === OTHER_MEETING_CATEGORY && !!file?.meeting) {
    return true;
  } else {
    return false;
  }
}

export function isAdHocVideoCall(file: Pick<CommitteeFile, "fileType" | "meeting">): boolean {
  return !file?.fileType && !!file?.meeting?.room;
}

export interface ExpensesConfig {
  costPerMile: number;
}

export interface CommitteeConfig {
  roles: CommitteeMember[],
  contactUs?: {
    chairman: CommitteeMember;
    secretary: CommitteeMember;
    treasurer: CommitteeMember;
    membership: CommitteeMember;
    social: CommitteeMember;
    walks: CommitteeMember;
    support: CommitteeMember;
  };
  fileTypes: CommitteeFileType [];
  meetingTypes?: CommitteeMeetingType[];
  documentsPagePath?: string | null;
  expenses: ExpensesConfig;
  meetingFrequencyAmount?: number;
  meetingFrequencyUnit?: DateRangeUnit;
}

export interface GroupEventsFilter {
  includeImage: boolean;
  selectAll: boolean;
  eventIds?: string[];
  search: string;
  fromDate: DateValue;
  toDate: DateValue;
  includeContact: boolean;
  includeDescription: boolean;
  includeLocation: boolean;
  includeWalks: boolean;
  includeSocialEvents: boolean;
  includeCommitteeEvents: boolean;
  sortBy?: string;
}

export interface IncludedStringValue {
  include?: boolean;
  value?: string;
}

export interface IncludedStringValues {
  include?: boolean;
  value?: string[];
}

export interface NotificationContent {
  notificationConfig: NotificationConfig;
  addresseeType?: string;
  attachment?: IncludedStringValue;
  customCampaignType?: string;
  description?: IncludedStringValue;
  listId?: number;
  includeDownloadInformation?: boolean;
  attendees?: { include?: boolean };
  eventDetails?: IncludedStringValue;
  replyTo?: IncludedStringValue;
  selectedMemberIds?: string[];
  signoffAs?: IncludedStringValue;
  signoffText?: IncludedStringValue;
  text?: IncludedStringValue;
  title?: IncludedStringValue;
}

export interface Notification {
  cancelled?: boolean;
  content?: NotificationContent;
  groupEventsFilter?: GroupEventsFilter;
  groupEvents?: GroupEventSummary[];
}

export interface CommitteeYear {
  year: number;
  latestYear: boolean;
}

export interface ContactFormDetails {
  timestamp: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  sendCopy: boolean;
  anonymous?: boolean;
}

export interface ValidateTokenRequest {
  captchaToken: string;
}

export interface ValidateTokenResponse {
  message: string;
}

export interface ValidateTokenApiResponse extends ApiResponse {
  response?: ValidateTokenResponse;
}
