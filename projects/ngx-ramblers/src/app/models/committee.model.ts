import { map } from "es-toolkit/compat";
import { emailDomain, normaliseEmail, toDotCase, toKebabCase } from "../functions/strings";
import { DateRangeUnit } from "./search.model";
import { ApiResponse, Identifiable } from "./api-response.model";
import { FileNameData } from "./aws-object.model";
import { DateValue } from "./date.model";
import { NotificationConfig } from "./mail.model";
import { Link } from "./page.model";
import { Media } from "./ramblers-walks-manager";
import { VideoMeetingInviteRecipient } from "./video-meeting.model";

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
  durationMinutes?: number;
  invited?: boolean;
  invitedMemberIds?: string[];
  invitedRecipients?: VideoMeetingInviteRecipient[];
  invitedListId?: number;
  createdBy?: string;
  createdByName?: string;
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

export function derivedRoleTypeAddress(role: CommitteeMember, domain?: string | null): string | null {
  const resolvedDomain = roleAddressDomain(role, domain);
  const localPart = (role.type || "").trim().toLowerCase();
  if (!resolvedDomain || !localPart) {
    return null;
  } else {
    return `${localPart}@${resolvedDomain}`;
  }
}

export function derivedFullNameAddress(role: CommitteeMember, domain?: string | null): string | null {
  const resolvedDomain = roleAddressDomain(role, domain);
  const localPart = role.vacant ? "" : toDotCase(role.fullName || "");
  if (!resolvedDomain || !localPart) {
    return null;
  } else {
    return `${localPart}@${resolvedDomain}`;
  }
}

export function roleEmailAddresses(role: CommitteeMember, domain?: string | null): string[] {
  const addresses = [role.email, derivedRoleTypeAddress(role, domain), derivedFullNameAddress(role, domain), ...(role.additionalEmails ?? [])]
    .map(address => (address ?? "").trim())
    .filter(address => address.length > 0);
  return addresses.reduce<string[]>((unique, address) => unique.some(existing => existing.toLowerCase() === address.toLowerCase()) ? unique : unique.concat(address), []);
}

export function roleMatchesEmail(role: CommitteeMember, email: string, domain?: string | null): boolean {
  const wanted = normaliseEmail(email);
  return Boolean(wanted) && roleEmailAddresses(role, domain).some(address => normaliseEmail(address) === wanted);
}

export function committeeRoleMatchingEmail(roles: CommitteeMember[], email: string, domain?: string | null): CommitteeMember | null {
  return (roles ?? []).find(role => roleMatchesEmail(role, email, domain)) ?? null;
}

export function additionalEmailsFromMailboxList(addresses: string[], defaultEmail: string | null): string[] {
  const defaultNormalised = normaliseEmail(defaultEmail ?? "");
  return addresses.filter(address => {
    const normalised = normaliseEmail(address);
    return Boolean(normalised) && normalised !== defaultNormalised;
  });
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
    const preferred = (role.type || toKebabCase(role.description || "")).trim();
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
