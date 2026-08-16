import { Member, MemberFilterSelection } from "./member.model";
import { BrandingMode, EmailAttachment, ListInfo, MemberSelection, NotificationConfig, NotificationConfigListing, SendSmtpEmailParams } from "./mail.model";
import { VolunteerAudienceCriteria } from "./volunteer-management.model";
import { ApiResponse } from "./api-response.model";
import { GroupEventSummary, GroupEventsFilter } from "./committee.model";
import { ExtendedGroupEvent } from "./group-event.model";
import { EM_DASH_WITH_SPACES } from "./content-text.model";
import { DateRangeUnit } from "./search.model";

export enum EmailComposerStepKey {
  RECIPIENTS = "recipients",
  TEMPLATE = "template",
  COMPOSE = "compose",
  EVENTS = "events",
  REVIEW = "review",
  SEND = "send"
}

export interface EmailComposerStep {
  key: EmailComposerStepKey;
  label: string;
  hint: string;
}

export enum RecipientMode {
  ENTIRE_LIST = "entire-list",
  SELECTED_MEMBERS = "selected-members"
}

export enum AddresseeType {
  FIRST_NAME = "first-name",
  HI_ALL = "hi-all",
  NONE = "none"
}

export enum EventInclusionMode {
  NONE = "none",
  AUTO_INCLUDE = "auto-include",
  SINGLE_EVENT = "single-event"
}

export enum EmailCompositionKind {
  STANDARD = "standard",
  NEWSLETTER = "newsletter",
  RELEASE_NOTE_UPDATE = "release-note-update"
}

export enum NewsletterCadence {
  WEEKLY = "weekly",
  FORTNIGHTLY = "fortnightly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  CUSTOM = "custom"
}

export interface NewsletterCadenceOption {
  key: NewsletterCadence;
  label: string;
  periodLabel: string;
  days: number | null;
}

export const NEWSLETTER_CADENCE_OPTIONS: NewsletterCadenceOption[] = [
  { key: NewsletterCadence.WEEKLY, label: "Weekly", periodLabel: "the next week", days: 7 },
  { key: NewsletterCadence.FORTNIGHTLY, label: "Fortnightly", periodLabel: "the next fortnight", days: 14 },
  { key: NewsletterCadence.MONTHLY, label: "Monthly", periodLabel: "the next month", days: 30 },
  { key: NewsletterCadence.QUARTERLY, label: "Quarterly", periodLabel: "the next quarter", days: 91 },
  { key: NewsletterCadence.CUSTOM, label: "Custom dates", periodLabel: "dates I choose", days: null }
];

export const DEFAULT_NEWSLETTER_CADENCE = NewsletterCadence.MONTHLY;

export const DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_AMOUNT = 1;
export const DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_UNIT = DateRangeUnit.MONTHS;

export enum NewsletterStartMode {
  PERIOD = "period",
  FREE_TEXT = "free-text"
}

export interface NewsletterSettings {
  cadence: NewsletterCadence;
  previousNewsletterId: string | null;
  previousSentAt: number | null;
  previousWindowEnd: number | null;
  previouslyAnnouncedEventIds: string[];
  markNewEvents: boolean;
  guidance: string | null;
}

export interface PreviousNewsletter {
  id: string;
  title: string;
  sentAt: number | null;
  windowEnd: number | null;
  announcedEventIds: string[];
  selectedListId: number | null;
  cadence: NewsletterCadence | null;
}

export interface NewsletterWindow {
  fromMillis: number;
  toMillis: number;
  continuesPreviousWindow: boolean;
}

export interface ReleaseNoteUpdateSettings {
  profileId: string | null;
  periodAmount: number;
  periodUnit: DateRangeUnit;
  previousDigestId: string | null;
  previousSentAt: number | null;
  previousWindowEnd: number | null;
  previouslyIncludedPaths: string[];
  excludePreviouslyIncluded: boolean;
  includedPaths: string[];
  fromMillis: number | null;
  toMillis: number | null;
  guidance: string | null;
  indexPath: string | null;
  categories: ReleaseNoteUpdateCategory[];
  coverage: ReleaseNoteUpdateCoverage;
  maximumThemes: number;
  maximumSourcesPerTheme: number;
  writingRules: string;
  includeTechnicalChanges: boolean;
  includeImages: boolean;
}

export enum ReleaseNoteUpdateScope {
  BOTH = "both",
  EMAIL_ONLY = "email-only",
  NON_EMAIL_ONLY = "non-email-only"
}

export enum ReleaseNoteUpdateCoverage {
  COMPREHENSIVE = "comprehensive",
  HIGHLIGHTS = "highlights"
}

export enum ReleaseNoteUpdateCategory {
  EMAIL = "email",
  NON_EMAIL = "non-email",
  PLATFORM_MANAGEMENT = "platform-management"
}

export interface ReleaseNoteUpdateDefaults {
  categories: ReleaseNoteUpdateCategory[];
  coverage: ReleaseNoteUpdateCoverage;
  maximumThemes: number;
  maximumSourcesPerTheme: number;
  writingRules: string;
  includeTechnicalChanges: boolean;
  includeImages: boolean;
}

export interface ReleaseNoteUpdateProfile {
  id: string;
  name: string;
  periodAmount: number;
  periodUnit: DateRangeUnit;
  defaults: ReleaseNoteUpdateDefaults;
  recipientMode: RecipientMode;
  selectedListId: number | null;
}

export interface ReleaseNoteUpdateConfiguration {
  defaultProfileId: string;
  profiles: ReleaseNoteUpdateProfile[];
}

export interface ReleaseNoteUpdateOption<T> {
  value: T;
  label: string;
  hint: string;
}

export interface PreviousReleaseNoteUpdate {
  id: string;
  title: string;
  sentAt: number | null;
  windowEnd: number | null;
  includedPaths: string[];
  selectedListId: number | null;
  selectedMemberIds: string[];
  periodAmount: number | null;
  periodUnit: DateRangeUnit | null;
}

export interface ReleaseNoteUpdateWindow {
  fromMillis: number;
  toMillis: number;
  continuesPreviousWindow: boolean;
}

export enum SendingChannel {
  CAMPAIGN = "campaign",
  TRANSACTIONAL_BATCH = "transactional-batch"
}

export { BrandingMode };

export const BRANDING_MODE_OPTIONS: { key: BrandingMode; label: string; hint: string }[] = [
  { key: BrandingMode.BRANDED, label: "Branded", hint: `Full Ramblers template${EM_DASH_WITH_SPACES}banner, events, social links and footer` },
  { key: BrandingMode.UNBRANDED, label: "Unbranded", hint: `Plain rich-text${EM_DASH_WITH_SPACES}reads like a personal note, good for committee replies and one-to-few correspondence` }
];

export const UNBRANDED_HARD_CAP_RECIPIENTS = 50;
export const UNBRANDED_LONG_BODY_CHAR_THRESHOLD = 800;
export const REPLY_OR_FORWARD_SUBJECT_PATTERN = /^\s*(re|fwd?):/i;
export const PROMOTIONAL_LANGUAGE_PATTERN = /\b(donat\w*|fundrais\w*|charity|charities|appeal|raise[sd]?\s+(?:money|funds)|raising\s+(?:money|funds)|sponsor\w*|volunteer\w*|register\s+now|sign\s+up|register\s+(?:here|today)|join\s+us|support\s+(?:our|the)|in\s+aid\s+of|proceeds)\b/i;

export enum BatchSendStatus {
  IDLE = "idle",
  RUNNING = "running",
  COMPLETED = "completed",
  COMPLETED_WITH_ERRORS = "completed-with-errors",
  CANCELLED = "cancelled",
  FAILED = "failed"
}

export interface RecipientPreFilter {
  key: MemberSelection | null;
  label: string;
  hint?: string;
}

export const RECIPIENT_PRE_FILTERS: RecipientPreFilter[] = [
  { key: null, label: "All with email" },
  { key: MemberSelection.RECENTLY_ADDED, label: "Recently added" },
  { key: MemberSelection.ADDED_IN_LAST_BULK_LOAD_MEMBERS, label: "Added in last bulk load" },
  { key: MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS, label: "Missing from bulk load" },
  { key: MemberSelection.EXPIRED_MEMBERS, label: "Expired members" }
];

export interface ArticleBlockImage {
  src: string;
  alt: string;
  width?: number;
  alignment: ArticleBlockImageAlignment;
  cropperPosition?: any;
}

export enum ArticleBlockImageAlignment {
  LEFT = "left",
  RIGHT = "right",
  CENTER = "center",
  FULL = "full"
}

export enum ArticleBlockPosition {
  ABOVE_EVENTS = "above-events",
  BELOW_EVENTS = "below-events"
}

export interface ValidationErrorWithLink {
  before: string;
  linkText: string;
  linkRouterLink: string;
  linkQueryParams: Record<string, string>;
  linkTarget?: string;
  after?: string;
}

export type ValidationError = string | ValidationErrorWithLink;

export interface ArticleBlock {
  id: string;
  position: ArticleBlockPosition;
  order: number;
  title?: string;
  markdown: string;
  image?: ArticleBlockImage;
  buttonText?: string;
  buttonUrl?: string;
  dividerAfter?: SectionDividerStyle;
  sourcePagePaths?: string[];
}

export enum SectionDividerStyle {
  NONE = "none",
  THIN_YELLOW = "thin-yellow",
  THICK_YELLOW = "thick-yellow",
  THIN_MINTCAKE = "thin-mintcake",
  THICK_MINTCAKE = "thick-mintcake",
  THIN_ROSYCHEEKS = "thin-rosycheeks",
  THICK_ROSYCHEEKS = "thick-rosycheeks",
  THIN_GRANITE = "thin-granite",
  DASHED_GREY = "dashed-grey"
}

export interface SectionDividerOption {
  key: SectionDividerStyle;
  label: string;
  cssBorder: string;
}

export const SECTION_DIVIDER_OPTIONS: SectionDividerOption[] = [
  { key: SectionDividerStyle.NONE, label: "None", cssBorder: "none" },
  { key: SectionDividerStyle.THIN_YELLOW, label: "Thin yellow", cssBorder: "1px solid #F9B104" },
  { key: SectionDividerStyle.THICK_YELLOW, label: "Thick yellow", cssBorder: "3px solid #F9B104" },
  { key: SectionDividerStyle.THIN_MINTCAKE, label: "Thin mintcake", cssBorder: "1px solid #9BC8AB" },
  { key: SectionDividerStyle.THICK_MINTCAKE, label: "Thick mintcake", cssBorder: "3px solid #9BC8AB" },
  { key: SectionDividerStyle.THIN_ROSYCHEEKS, label: "Thin rosycheeks", cssBorder: "1px solid #F6B09D" },
  { key: SectionDividerStyle.THICK_ROSYCHEEKS, label: "Thick rosycheeks", cssBorder: "3px solid #F6B09D" },
  { key: SectionDividerStyle.THIN_GRANITE, label: "Thin granite", cssBorder: "1px solid #1f2933" },
  { key: SectionDividerStyle.DASHED_GREY, label: "Dashed grey", cssBorder: "1px dashed #9ca3af" }
];

export interface RecipientFilterDecision {
  member: Member;
  reason?: string;
  filteredOut: boolean;
}

export interface PriorSendExclusion {
  member: Member;
  sentAt: number;
}

export enum EmailComposerContextSource {
  COMMITTEE = "committee",
  GROUP_EVENT = "group-event",
  ADMIN = "admin",
  VOLUNTEER = "volunteer"
}

export interface EmailComposerContext {
  source?: EmailComposerContextSource;
  committeeFileSlug?: string;
  sourcePagePath?: string;
  sourcePageTitle?: string;
  groupEventId?: string;
  prefilledTitle?: string;
  prefilledBody?: string;
  volunteerAudience?: VolunteerAudienceCriteria;
}

export interface EmailComposerState {
  context: EmailComposerContext;
  compositionKind: EmailCompositionKind;
  newsletter: NewsletterSettings | null;
  releaseNoteUpdate: ReleaseNoteUpdateSettings | null;
  brandingMode: BrandingMode;
  unbrandedSenderRoleType: string | null;
  recipientMode: RecipientMode;
  selectedListId: number | null;
  narrowListId: number | null;
  selectedMemberIds: string[];
  externalRecipients: ComposerExternalRecipient[];
  ccRecipients: ComposerExternalRecipient[];
  bccRecipients: ComposerExternalRecipient[];
  preFilterKey: MemberSelection | null;
  notificationConfig: NotificationConfig | null;
  notificationConfigListing: NotificationConfigListing | null;
  bannerId: string | null;
  subject: string;
  addresseeType: AddresseeType;
  introMarkdown: string;
  signoffTextMarkdown: string;
  signoffRoles: string[];
  articleBlocks: ArticleBlock[];
  attachmentUrl: string | null;
  attachmentFilename: string | null;
  attachments: EmailAttachment[];
  sendingChannel: SendingChannel;
  eventInclusion: EventInclusionMode;
  groupEventsFilter: GroupEventsFilter | null;
  groupEvents: GroupEventSummary[];
  singleEvent: ExtendedGroupEvent | null;
  introDividerAfter: SectionDividerStyle;
  eventsDividerAfter: SectionDividerStyle;
  signoffDividerAfter: SectionDividerStyle;
  betweenArticlesDivider: SectionDividerStyle;
  betweenEventsDivider: SectionDividerStyle;
  fragmentOrder: ComposerFragment[];
}

export enum EmailComposerFragmentOrderField {
  ARTICLE_BLOCKS = "articleBlocks",
  INTRO_DIVIDER_AFTER = "introDividerAfter",
  EVENTS_DIVIDER_AFTER = "eventsDividerAfter",
  SIGNOFF_DIVIDER_AFTER = "signoffDividerAfter",
  BETWEEN_ARTICLES_DIVIDER = "betweenArticlesDivider"
}

export type EmailComposerFragmentOrderState = Pick<EmailComposerState, EmailComposerFragmentOrderField>;

export enum ComposerFragmentKind {
  INTRO = "intro",
  ARTICLE = "article",
  EVENTS = "events",
  SIGNOFF = "signoff",
  TEMPLATE_CONTENT = "template-content",
  MULTI_COLUMN = "multi-column",
  DIVIDER = "divider",
  COMMITTEE_FILE = "committee-file"
}

export const EXPANDABLE_FRAGMENT_KINDS: ReadonlySet<ComposerFragmentKind> = new Set([
  ComposerFragmentKind.INTRO,
  ComposerFragmentKind.SIGNOFF,
  ComposerFragmentKind.ARTICLE,
  ComposerFragmentKind.MULTI_COLUMN,
  ComposerFragmentKind.EVENTS,
  ComposerFragmentKind.TEMPLATE_CONTENT,
  ComposerFragmentKind.COMMITTEE_FILE
]);

export interface ComposerFragment {
  kind: ComposerFragmentKind;
  id: string;
  dividerAfter: SectionDividerStyle;
  columns?: ComposerFragment[][];
  columnGapPx?: number;
  committeeFileIds?: string[];
}

export const DEFAULT_COLUMN_GAP_PX = 16;

export interface ComposerExternalRecipient {
  email: string;
  name?: string;
  existingId?: string;
  saveForReuse?: boolean;
}

export interface ParsedMailbox {
  name: string;
  email: string;
}

export enum RecipientDraftOutcomeKind {
  EMPTY = "empty",
  INVALID = "invalid",
  PENDING_NAME = "pending-name",
  ADD = "add"
}

export type RecipientDraftOutcome =
  | {kind: RecipientDraftOutcomeKind.EMPTY}
  | {kind: RecipientDraftOutcomeKind.INVALID}
  | {kind: RecipientDraftOutcomeKind.PENDING_NAME; name: string; email: string}
  | {kind: RecipientDraftOutcomeKind.ADD; mailboxes: ParsedMailbox[]};

export enum RecipientField {
  TO = "to",
  CC = "cc",
  BCC = "bcc"
}

export interface RecipientFieldConfig {
  key: RecipientField;
  label: string;
  hint: string;
}

export interface BatchTransactionalSendRequest {
  notificationConfigId?: string;
  bannerId: string | null;
  subject: string;
  addresseeType: AddresseeType;
  signoffRoles: string[];
  htmlBody: string;
  htmlBodyTop?: string;
  htmlBodyBottom?: string;
  attachmentUrl?: string;
  attachments?: EmailAttachment[];
  memberIds: string[];
  narrowListId?: number | null;
  externalRecipients?: ComposerExternalRecipient[];
  ccRecipients?: ComposerExternalRecipient[];
  bccRecipients?: ComposerExternalRecipient[];
  senderRoleOverride?: string;
  replyToRoleOverride?: string;
  bccRolesOverride?: string[];
  brandingMode?: BrandingMode;
  unbrandedSenderRoleType?: string;
  inboxReplyContext?: InboxReplyOutboundContextLike;
}

export interface InboxReplyOutboundContextLike {
  threadId: string;
  aliasId: string;
  mailboxConnectionId: string;
  inboxMessageId: string;
  inReplyTo: string;
  references: string[];
}

export enum BatchSendEntryStatus {
  Pending = "pending",
  Sent = "sent",
  Failed = "failed",
  Skipped = "skipped",
}

export interface BatchSendProgressEntry {
  memberId: string;
  email: string;
  fullName: string;
  status: BatchSendEntryStatus;
  errorMessage?: string;
  note?: string;
  sentAt?: number;
  notEmailable?: boolean;
}

export interface BatchSendProgress {
  jobId: string;
  status: BatchSendStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt: number;
  completedAt?: number;
  entries: BatchSendProgressEntry[];
  errorMessage?: string;
}

export interface BatchSendStartResponse {
  jobId: string;
  totalRecipients: number;
}

export interface BatchSendStatusResponse extends BatchSendProgress {}

export interface BatchSendApiResponse extends ApiResponse {
  request: any;
  response: BatchSendProgress | BatchSendStartResponse;
}

export interface RenderedMemberSelections {
  selections: MemberFilterSelection[];
  filteredOut: RecipientFilterDecision[];
}

export interface RenderedListPreview {
  list: ListInfo;
  total: number;
}

export const ADDRESSEE_OPTIONS: { key: AddresseeType; label: string; placeholder: string }[] = [
  { key: AddresseeType.FIRST_NAME, label: "Hi {{firstName}},", placeholder: "Hi {{params.memberMergeFields.FNAME}}," },
  { key: AddresseeType.HI_ALL, label: "Hi all,", placeholder: "Hi all," },
  { key: AddresseeType.NONE, label: "No greeting", placeholder: "" }
];

export interface ComposerPreviewRequest {
  templateId?: number;
  bannerId: string | null;
  subject: string;
  addresseeType: AddresseeType;
  signoffRoles: string[];
  bodyContentHtml: string;
}

export interface MemberMergeFieldHint {
  token: string;
  label: string;
}

export const MERGE_FIELD_HINTS: MemberMergeFieldHint[] = [
  { token: "{{params.memberMergeFields.FNAME}}", label: "First name" },
  { token: "{{params.memberMergeFields.LNAME}}", label: "Last name" },
  { token: "{{params.memberMergeFields.FULL_NAME}}", label: "Full name" },
  { token: "{{params.memberMergeFields.EMAIL}}", label: "Email" },
  { token: "{{params.memberMergeFields.MEMBER_NUM}}", label: "Membership number" },
  { token: "{{params.systemMergeFields.APP_SHORTNAME}}", label: "Group short name" },
  { token: "{{params.systemMergeFields.APP_LONGNAME}}", label: "Group long name" }
];

export interface MergeFieldGroup {
  group: string;
  fields: MemberMergeFieldHint[];
}

export const LINK_DESTINATIONS: MemberMergeFieldHint[] = [
  { token: "{{params.systemMergeFields.APP_URL}}", label: "Website home" },
  { token: "{{params.systemMergeFields.PW_RESET_LINK}}", label: "Account activation link" },
  { token: "{{params.systemMergeFields.FACEBOOK_URL}}", label: "Facebook page" },
  { token: "{{params.systemMergeFields.TWITTER_URL}}", label: "Twitter / X page" },
  { token: "{{params.systemMergeFields.INSTAGRAM_URL}}", label: "Instagram page" }
];

export const MERGE_FIELD_CATALOGUE: MergeFieldGroup[] = [
  {
    group: "Member details",
    fields: [
      { token: "{{params.memberMergeFields.FNAME}}", label: "First name" },
      { token: "{{params.memberMergeFields.LNAME}}", label: "Last name" },
      { token: "{{params.memberMergeFields.FULL_NAME}}", label: "Full name" },
      { token: "{{params.memberMergeFields.EMAIL}}", label: "Email address" },
      { token: "{{params.memberMergeFields.MEMBER_NUM}}", label: "Membership number" },
      { token: "{{params.memberMergeFields.USERNAME}}", label: "Username" },
      { token: "{{params.memberMergeFields.MEMBER_EXP}}", label: "Membership expiry date" }
    ]
  },
  {
    group: "Member address",
    fields: [
      { token: "{{params.accountMergeFields.STREET}}", label: "Street" },
      { token: "{{params.accountMergeFields.TOWN}}", label: "Town" },
      { token: "{{params.accountMergeFields.POSTCODE}}", label: "Postcode" }
    ]
  },
  {
    group: "Group & website",
    fields: [
      { token: "{{params.systemMergeFields.APP_SHORTNAME}}", label: "Group short name" },
      { token: "{{params.systemMergeFields.APP_LONGNAME}}", label: "Group long name" },
      { token: "{{params.systemMergeFields.APP_URL}}", label: "Website address" },
      { token: "{{params.systemMergeFields.PW_RESET_LINK}}", label: "Account activation link" },
      { token: "{{params.systemMergeFields.FACEBOOK_URL}}", label: "Facebook page" },
      { token: "{{params.systemMergeFields.TWITTER_URL}}", label: "Twitter / X page" },
      { token: "{{params.systemMergeFields.INSTAGRAM_URL}}", label: "Instagram page" }
    ]
  }
];

export const VOLUNTEER_MERGE_FIELD_CATALOGUE: MergeFieldGroup[] = [
  {
    group: "Volunteer assignments",
    fields: [
      { token: "{{params.volunteerMergeFields.ROLES}}", label: "Roles held" },
      { token: "{{params.volunteerMergeFields.PARISH_COUNT}}", label: "Number of parishes" },
      { token: "{{params.volunteerMergeFields.PARISH_NAMES}}", label: "Parish names" },
      { token: "{{params.volunteerMergeFields.PARISH_TABLE}}", label: "Assigned parishes table" },
      { token: "{{params.volunteerMergeFields.COUNTERPART_TABLE}}", label: "Counterpart officers table" },
      { token: "{{params.volunteerMergeFields.AUTHORITIES}}", label: "Local authorities" },
      { token: "{{params.volunteerMergeFields.SECTORS}}", label: "Sectors" },
      { token: "{{params.volunteerMergeFields.ROW_GROUPS}}", label: "Rights-of-way groups" },
      { token: "{{params.volunteerMergeFields.COVER}}", label: "Cover type" },
      { token: "{{params.volunteerMergeFields.EARLIEST_START}}", label: "Earliest assignment start date" }
    ]
  }
];

export const BOOKING_MERGE_FIELD_CATALOGUE: MergeFieldGroup[] = [
  {
    group: "Booking",
    fields: [
      { token: "{{params.bookingMergeFields.ATTENDEE_NAME}}", label: "Attendee name" },
      { token: "{{params.bookingMergeFields.EVENT_TITLE}}", label: "Event title" },
      { token: "{{params.bookingMergeFields.EVENT_DATE}}", label: "Event date" },
      { token: "{{params.bookingMergeFields.EVENT_LINK}}", label: "Event page link" },
      { token: "{{params.bookingMergeFields.ATTENDEE_LIST}}", label: "Attendee list" },
      { token: "{{params.bookingMergeFields.PLACES_COUNT}}", label: "Places count" }
    ]
  }
];

export interface ComposerEmailRequestBuild {
  subject: string;
  htmlBody: string;
  signoffRoles: string[];
  params?: SendSmtpEmailParams;
}

export const EMAIL_COMPOSER_STEPS: EmailComposerStep[] = [
  { key: EmailComposerStepKey.TEMPLATE, label: "Sender & Template", hint: "Choose who it's from and the visual template" },
  { key: EmailComposerStepKey.RECIPIENTS, label: "Recipients", hint: "Choose who receives this email" },
  { key: EmailComposerStepKey.COMPOSE, label: "Compose", hint: "Write the message and add article blocks" },
  { key: EmailComposerStepKey.EVENTS, label: "Events", hint: "Attach upcoming events or a single event" },
  { key: EmailComposerStepKey.REVIEW, label: "Preview & Review", hint: "Check the email before sending" },
  { key: EmailComposerStepKey.SEND, label: "Send", hint: "Send and track delivery progress" }
];

export enum EmailCompositionStatus {
  Draft = "draft",
  Sent = "sent",
}

export interface EmailCompositionDocument {
  id?: string;
  ownerMemberId: string;
  status: EmailCompositionStatus;
  kind: EmailCompositionKind;
  shared: boolean;
  title: string;
  state: any;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
  sentAt?: number;
  sentRecipientCount?: number;
}

export interface EmailCompositionSummary {
  id: string;
  ownerMemberId: string;
  status: EmailCompositionStatus;
  kind: EmailCompositionKind;
  shared: boolean;
  title: string;
  savedAt: number;
  sentAt?: number;
  sentRecipientCount?: number;
}

export interface EmailComposition extends EmailCompositionSummary {
  state: EmailComposerState;
}

export interface EmailCompositionDocumentDto {
  id: string;
  ownerMemberId: string;
  status: EmailCompositionStatus;
  kind: EmailCompositionKind;
  shared: boolean;
  title: string;
  state: EmailComposerState;
  createdAt: number;
  updatedAt: number;
  sentAt?: number;
  sentRecipientCount?: number;
}

export interface EmailCompositionSummaryDto {
  id: string;
  ownerMemberId: string;
  status: EmailCompositionStatus;
  kind: EmailCompositionKind;
  shared: boolean;
  title: string;
  createdAt: number;
  updatedAt: number;
  sentAt?: number;
  sentRecipientCount?: number;
}

export interface EmailCompositionListResponse extends ApiResponse {
  response: EmailCompositionDocumentDto[];
}

export interface EmailCompositionSingleResponse extends ApiResponse {
  response: EmailCompositionDocumentDto;
}

export interface EmailCompositionSummaryListResponse extends ApiResponse {
  response: EmailCompositionSummaryDto[];
}

export enum DateInputMode {
  Slider = "slider",
  Pickers = "pickers"
}

export enum DragHoverPosition {
  Before = "before",
  After = "after"
}

export enum PreviewStepDirection {
  First = "first",
  Prev = "prev",
  Next = "next",
  Last = "last"
}

export enum SideImagePlacement {
  Left = "left",
  Right = "right"
}
