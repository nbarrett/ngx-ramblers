import { Member, MemberFilterSelection } from "./member.model";
import { BrandingMode, ListInfo, MemberSelection, NotificationConfig, NotificationConfigListing, SendSmtpEmailParams } from "./mail.model";
import { ApiResponse } from "./api-response.model";
import { GroupEventSummary, GroupEventsFilter } from "./committee.model";
import { ExtendedGroupEvent } from "./group-event.model";
import { EM_DASH_WITH_SPACES } from "./content-text.model";

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

export enum SendingChannel {
  CAMPAIGN = "campaign",
  TRANSACTIONAL_BATCH = "transactional-batch"
}

export { BrandingMode };

export const BRANDING_MODE_OPTIONS: { key: BrandingMode; label: string; hint: string }[] = [
  { key: BrandingMode.BRANDED, label: "Branded", hint: `Full Ramblers template${EM_DASH_WITH_SPACES}banner, events, social links and footer` },
  { key: BrandingMode.UNBRANDED, label: "Unbranded", hint: `Plain rich-text${EM_DASH_WITH_SPACES}reads like a personal note, good for committee replies and one-to-few correspondence` }
];

export const UNBRANDED_LIST_SEND_WARNING_THRESHOLD = 3;
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
  { key: MemberSelection.EXPIRED_MEMBERS, label: "Expired members" },
  { key: MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS, label: "Missing from bulk load" }
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

export function dividerHtml(style: SectionDividerStyle, marginCss: string = "6px 0"): string {
  const option = SECTION_DIVIDER_OPTIONS.find(opt => opt.key === style);
  if (!option || option.key === SectionDividerStyle.NONE) return "";
  const match = option.cssBorder.match(/^(\d+)px\s+(solid|dashed|dotted)\s+(#[0-9a-fA-F]{3,8})$/);
  const widthPx = match ? parseInt(match[1], 10) : 1;
  const lineStyle = match ? match[2] : "solid";
  const colour = match ? match[3] : "#222222";
  const heightPx = lineStyle === "solid" ? widthPx : Math.max(widthPx + 1, 2);
  const cellStyle = lineStyle === "solid"
    ? `height:${heightPx}px;line-height:${heightPx}px;font-size:0;background-color:${colour};mso-line-height-rule:exactly;`
    : `height:${heightPx}px;line-height:${heightPx}px;font-size:0;border-top:${widthPx}px ${lineStyle} ${colour};mso-line-height-rule:exactly;`;
  return `<table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;margin:${marginCss};"><tr><td style="${cellStyle}">&nbsp;</td></tr></table>`;
}

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
  ADMIN = "admin"
}

export interface EmailComposerContext {
  source?: EmailComposerContextSource;
  committeeFileSlug?: string;
  sourcePagePath?: string;
  sourcePageTitle?: string;
  groupEventId?: string;
  prefilledTitle?: string;
  prefilledBody?: string;
}

export interface EmailComposerState {
  context: EmailComposerContext;
  brandingMode: BrandingMode;
  unbrandedSenderRoleType: string | null;
  recipientMode: RecipientMode;
  selectedListId: number | null;
  narrowListId: number | null;
  selectedMemberIds: string[];
  externalRecipients: ComposerExternalRecipient[];
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

const RECYCLED_TRACKING_HOST_PATTERNS = [
  /https?:\/\/[^\s"')<>]*\.sendibt2\.com\/[^\s"')<>]+/gi,
  /https?:\/\/[^\s"')<>]*\.sendinblue\.com\/[^\s"')<>]+/gi,
  /https?:\/\/[^\s"')<>]*\.brevo\.com\/tr\/[^\s"')<>]+/gi,
  /https?:\/\/link\.mailinblue\.com\/[^\s"')<>]+/gi,
  /https?:\/\/[^\s"')<>]*\.list-manage\.com\/[^\s"')<>]+/gi,
  /https?:\/\/mailchi\.mp\/[^\s"')<>]+/gi,
  /https?:\/\/[^\s"')<>]*\.campaign-archive\.com\/[^\s"')<>]+/gi
];

export function findRecycledTrackingUrls(content: string | null | undefined): string[] {
  if (!content) return [];
  const found = new Set<string>();
  for (const pattern of RECYCLED_TRACKING_HOST_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(url => found.add(url));
    }
  }
  return Array.from(found);
}

export interface ComposerFragment {
  kind: ComposerFragmentKind;
  id: string;
  dividerAfter: SectionDividerStyle;
  columns?: ComposerFragment[][];
  columnGapPx?: number;
  committeeFileIds?: string[];
}

export const DEFAULT_COLUMN_GAP_PX = 16;

export function newDividerFragment(style: SectionDividerStyle = SectionDividerStyle.THIN_ROSYCHEEKS): ComposerFragment {
  return {
    kind: ComposerFragmentKind.DIVIDER,
    id: `divider-${Math.random().toString(36).slice(2, 10)}`,
    dividerAfter: style
  };
}

export function newMultiColumnFragment(numColumns: number, dividerAfter: SectionDividerStyle): ComposerFragment {
  const columns: ComposerFragment[][] = Array.from({ length: numColumns }, () => []);
  return {
    kind: ComposerFragmentKind.MULTI_COLUMN,
    id: `multi-column-${Math.random().toString(36).slice(2, 10)}`,
    dividerAfter,
    columns,
    columnGapPx: DEFAULT_COLUMN_GAP_PX
  };
}

export function buildDefaultFragmentOrder(state: Pick<EmailComposerState, "articleBlocks" | "introDividerAfter" | "eventsDividerAfter" | "signoffDividerAfter" | "betweenArticlesDivider">, options?: { includeTemplateContent?: boolean; unbranded?: boolean }): ComposerFragment[] {
  const above = (state.articleBlocks ?? [])
    .filter(b => b.position === ArticleBlockPosition.ABOVE_EVENTS)
    .sort((a, b) => a.order - b.order);
  const below = (state.articleBlocks ?? [])
    .filter(b => b.position === ArticleBlockPosition.BELOW_EVENTS)
    .sort((a, b) => a.order - b.order);
  const order: ComposerFragment[] = [];
  order.push({ kind: ComposerFragmentKind.INTRO, id: "intro", dividerAfter: state.introDividerAfter ?? SectionDividerStyle.NONE });
  if (options?.unbranded) {
    return order;
  }
  if (options?.includeTemplateContent) {
    order.push({ kind: ComposerFragmentKind.TEMPLATE_CONTENT, id: "template-content", dividerAfter: SectionDividerStyle.THIN_YELLOW });
  }
  above.forEach((block, idx) => {
    const isLast = idx === above.length - 1;
    order.push({
      kind: ComposerFragmentKind.ARTICLE,
      id: block.id,
      dividerAfter: isLast ? (block.dividerAfter ?? SectionDividerStyle.THIN_YELLOW) : (state.betweenArticlesDivider ?? SectionDividerStyle.THIN_YELLOW)
    });
  });
  order.push({ kind: ComposerFragmentKind.EVENTS, id: "events", dividerAfter: state.eventsDividerAfter ?? SectionDividerStyle.THIN_YELLOW });
  below.forEach((block, idx) => {
    const isLast = idx === below.length - 1;
    order.push({
      kind: ComposerFragmentKind.ARTICLE,
      id: block.id,
      dividerAfter: isLast ? (block.dividerAfter ?? SectionDividerStyle.THIN_YELLOW) : (state.betweenArticlesDivider ?? SectionDividerStyle.THIN_YELLOW)
    });
  });
  order.push({ kind: ComposerFragmentKind.SIGNOFF, id: "signoff", dividerAfter: state.signoffDividerAfter ?? SectionDividerStyle.THIN_YELLOW });
  return order;
}

export interface ComposerExternalRecipient {
  email: string;
  name?: string;
  existingId?: string;
  saveForReuse?: boolean;
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
  memberIds: string[];
  narrowListId?: number | null;
  externalRecipients?: ComposerExternalRecipient[];
  senderRoleOverride?: string;
  replyToRoleOverride?: string;
  bccRolesOverride?: string[];
  brandingMode?: BrandingMode;
  unbrandedSenderRoleType?: string;
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
  sentAt?: number;
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

export function defaultEmailComposerState(): EmailComposerState {
  return {
    context: { source: EmailComposerContextSource.ADMIN },
    brandingMode: BrandingMode.BRANDED,
    unbrandedSenderRoleType: null,
    recipientMode: RecipientMode.ENTIRE_LIST,
    selectedListId: null,
    narrowListId: null,
    selectedMemberIds: [],
    externalRecipients: [],
    preFilterKey: null,
    notificationConfig: null,
    notificationConfigListing: null,
    bannerId: null,
    subject: "",
    addresseeType: AddresseeType.FIRST_NAME,
    introMarkdown: "",
    signoffTextMarkdown: "If you have any questions about the above, please don't hesitate to contact me.\n\nBest regards,",
    signoffRoles: [],
    articleBlocks: [],
    attachmentUrl: null,
    attachmentFilename: null,
    sendingChannel: SendingChannel.CAMPAIGN,
    eventInclusion: EventInclusionMode.NONE,
    groupEventsFilter: null,
    groupEvents: [],
    singleEvent: null,
    introDividerAfter: SectionDividerStyle.THIN_YELLOW,
    eventsDividerAfter: SectionDividerStyle.THIN_YELLOW,
    signoffDividerAfter: SectionDividerStyle.THIN_YELLOW,
    betweenArticlesDivider: SectionDividerStyle.THIN_YELLOW,
    betweenEventsDivider: SectionDividerStyle.THIN_YELLOW,
    fragmentOrder: []
  };
}

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
  shared: boolean;
  title: string;
  state: any;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
  sentAt?: number;
  sentRecipientCount?: number;
}

export interface EmailComposition {
  id: string;
  ownerMemberId: string;
  status: EmailCompositionStatus;
  shared: boolean;
  title: string;
  savedAt: number;
  sentAt?: number;
  sentRecipientCount?: number;
  state: EmailComposerState;
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
