import { uniq } from "es-toolkit/compat";
import { BrandingMode, MemberSelection, MergeFieldParamsGroup } from "../models/mail.model";
import { CommitteeMember, roleEmailAddresses } from "../models/committee.model";
import { Member } from "../models/member.model";
import { committeeAssignedEmailsForMemberId, memberHoldsCommitteeRole, outboundEmailForMember } from "./committee-members";
import { memberDisambiguatedLabel } from "./member-names";
import {
  AddresseeType,
  ArticleBlock,
  ArticleBlockImageAlignment,
  ArticleBlockPosition,
  ComposerExternalRecipient,
  ComposerFragment,
  ComposerFragmentKind,
  ComposerSenderIdentity,
  ComposerSenderKind,
  DEFAULT_COLUMN_GAP_PX,
  DEFAULT_NEWSLETTER_CADENCE,
  DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_AMOUNT,
  DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_UNIT,
  EmailComposerContextSource,
  EmailComposerFragmentOrderState,
  EmailComposerState,
  EmailCompositionKind,
  EventInclusionMode,
  NewsletterSettings,
  RecipientAddressMode,
  RecipientMode,
  ReleaseNoteUpdateCategory,
  ReleaseNoteUpdateConfiguration,
  ReleaseNoteUpdateCoverage,
  ReleaseNoteUpdateDefaults,
  ReleaseNoteUpdateProfile,
  ReleaseNoteUpdateScope,
  ReleaseNoteUpdateSettings,
  SECTION_DIVIDER_OPTIONS,
  SectionDividerStyle,
  SendingChannel
} from "../models/email-composer.model";
import { releaseNoteUpdatePeriodFromStored } from "./release-note-update-window";
import { ReleaseNoteUpdateDraft } from "../models/ai.model";
import { isArray, isNumber, isString, values } from "es-toolkit/compat";

export function dividerHtml(style: SectionDividerStyle, marginCss: string = "6px 0"): string {
  const option = SECTION_DIVIDER_OPTIONS.find(opt => opt.key === style);
  let result = "";
  if (option && option.key !== SectionDividerStyle.NONE) {
    const match = option.cssBorder.match(/^(\d+)px\s+(solid|dashed|dotted)\s+(#[0-9a-fA-F]{3,8})$/);
    const widthPx = match ? parseInt(match[1], 10) : 1;
    const lineStyle = match ? match[2] : "solid";
    const colour = match ? match[3] : "#222222";
    const heightPx = lineStyle === "solid" ? widthPx : Math.max(widthPx + 1, 2);
    const cellStyle = lineStyle === "solid"
      ? `height:${heightPx}px;line-height:${heightPx}px;font-size:0;background-color:${colour};mso-line-height-rule:exactly;`
      : `height:${heightPx}px;line-height:${heightPx}px;font-size:0;border-top:${widthPx}px ${lineStyle} ${colour};mso-line-height-rule:exactly;`;
    result = `<table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;margin:${marginCss};"><tr><td style="${cellStyle}">&nbsp;</td></tr></table>`;
  }
  return result;
}

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
  const found = new Set<string>();
  if (content) {
    RECYCLED_TRACKING_HOST_PATTERNS.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(url => found.add(url));
      }
    });
  }
  return Array.from(found);
}

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

export function buildDefaultFragmentOrder(
  state: EmailComposerFragmentOrderState,
  options?: { includeTemplateContent?: boolean; unbranded?: boolean }
): ComposerFragment[] {
  const above = (state.articleBlocks ?? [])
    .filter(b => b.position === ArticleBlockPosition.ABOVE_EVENTS)
    .sort((a, b) => a.order - b.order);
  const below = (state.articleBlocks ?? [])
    .filter(b => b.position === ArticleBlockPosition.BELOW_EVENTS)
    .sort((a, b) => a.order - b.order);
  const order: ComposerFragment[] = [];
  order.push({ kind: ComposerFragmentKind.INTRO, id: "intro", dividerAfter: state.introDividerAfter ?? SectionDividerStyle.NONE });
  if (!options?.unbranded) {
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
  }
  return order;
}

export function defaultNewsletterSettings(): NewsletterSettings {
  return {
    cadence: DEFAULT_NEWSLETTER_CADENCE,
    previousNewsletterId: null,
    previousSentAt: null,
    previousWindowEnd: null,
    previouslyAnnouncedEventIds: [],
    markNewEvents: true,
    guidance: null
  };
}

export function releaseNoteUpdateArticlesFrom(draft: ReleaseNoteUpdateDraft): ArticleBlock[] {
  const items = draft?.items ?? [];
  const categories = [ReleaseNoteUpdateCategory.EMAIL, ReleaseNoteUpdateCategory.NON_EMAIL, ReleaseNoteUpdateCategory.PLATFORM_MANAGEMENT]
    .filter(category => items.some(item => item.category === category));
  const categorisedItems = categories.flatMap(category => items.filter(item => item.category === category));
  const showCategoryHeadings = categories.length > 1;
  const highlights: ArticleBlock[] = categorisedItems.flatMap((item, index) => {
    const firstInCategory = categorisedItems.findIndex(candidate => candidate.category === item.category) === index;
    const categoryHeading: ArticleBlock[] = showCategoryHeadings && firstInCategory ? [{
      id: `release-note-category-${item.category}`,
      position: ArticleBlockPosition.ABOVE_EVENTS,
      order: index,
      title: item.category === ReleaseNoteUpdateCategory.EMAIL
        ? "Email features"
        : item.category === ReleaseNoteUpdateCategory.PLATFORM_MANAGEMENT
          ? "Platform management"
          : "Non-email features",
      markdown: item.category === ReleaseNoteUpdateCategory.EMAIL
        ? "Changes to email, inboxes, newsletters and member communications."
        : item.category === ReleaseNoteUpdateCategory.PLATFORM_MANAGEMENT
          ? "Changes to managing websites, setup and administration across NGX."
          : "Changes to the other features available on your website.",
      image: null,
      dividerAfter: SectionDividerStyle.THIN_YELLOW
    }] : [];
    const highlight: ArticleBlock = {
    id: `digest-item-${index}-${item.path}`,
    position: ArticleBlockPosition.ABOVE_EVENTS,
    order: index,
    title: item.title,
    markdown: [
      item.body,
      item.sourceNotes.length > 0 ? "**Related release notes**" : null,
      ...item.sourceNotes.map(note => note.date
        ? `On [${note.date}](${note.url}), ${lowercaseFirst(note.description)}.`
        : `[Read the release note](${note.url}) about ${lowercaseFirst(note.description)}.`)
    ].filter((value): value is string => !!value).join("\n\n"),
    image: item.image ? {
      src: item.image.url,
      alt: item.image.alt || item.title,
      alignment: ArticleBlockImageAlignment.FULL
    } : null,
    sourcePagePaths: item.sourcePaths,
    dividerAfter: SectionDividerStyle.THIN_YELLOW
    };
    return [...categoryHeading, highlight];
  }).map((article, order) => ({...article, order}));
  return draft?.indexUrl
    ? highlights.concat([{
      id: "digest-release-notes-index",
      position: ArticleBlockPosition.ABOVE_EVENTS,
      order: highlights.length,
      title: "Read the full notes",
      markdown: "If you want the complete write-up of everything that shipped, the release notes are on the website.",
      image: null,
      buttonText: "Open the release notes",
      buttonUrl: draft.indexUrl,
      dividerAfter: SectionDividerStyle.THIN_YELLOW
    }])
    : highlights;
}

function lowercaseFirst(value: string): string {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1).replace(/[.]$/, "")}` : "the change";
}

export function releaseNoteUpdateFragmentOrder(articles: ArticleBlock[]): ComposerFragment[] {
  return [
    {kind: ComposerFragmentKind.INTRO, id: "intro", dividerAfter: SectionDividerStyle.THIN_YELLOW},
    ...articles.map(article => ({
      kind: ComposerFragmentKind.ARTICLE,
      id: article.id,
      dividerAfter: article.dividerAfter ?? SectionDividerStyle.THIN_YELLOW
    })),
    {kind: ComposerFragmentKind.SIGNOFF, id: "signoff", dividerAfter: SectionDividerStyle.THIN_YELLOW}
  ];
}

export function releaseNoteUpdateSubject(currentSubject: string | null,
                                      templateSubject: string | null,
                                      period: string | null): string {
  const current = currentSubject?.trim() ?? "";
  const template = templateSubject?.trim() ?? "";
  return period && (!current || current === template) ? `What's new in NGX: ${period}` : currentSubject ?? "";
}

export function defaultReleaseNoteUpdateSettings(): ReleaseNoteUpdateSettings {
  const editorialDefaults = defaultReleaseNoteUpdateDefaults();
  return {
    profileId: null,
    periodAmount: DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_AMOUNT,
    periodUnit: DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_UNIT,
    previousDigestId: null,
    previousSentAt: null,
    previousWindowEnd: null,
    previouslyIncludedPaths: [],
    excludePreviouslyIncluded: true,
    includedPaths: [],
    fromMillis: null,
    toMillis: null,
    guidance: null,
    indexPath: null,
    ...editorialDefaults
  };
}

export function defaultReleaseNoteUpdateDefaults(): ReleaseNoteUpdateDefaults {
  return {
    categories: values(ReleaseNoteUpdateCategory),
    coverage: ReleaseNoteUpdateCoverage.COMPREHENSIVE,
    maximumThemes: 16,
    maximumSourcesPerTheme: 12,
    includeTechnicalChanges: false,
    includeImages: true,
    writingRules: "Write for group volunteers in warm, plain British English. Cover the whole selected period. First identify the distinct user-facing capabilities, connect each introduction to its later refinements, and prioritise them by the practical change and breadth of benefit for users rather than release count, recency or technical size. Group only genuinely related changes under broad consumer-friendly subjects and give every capability one unique home. Centre each subject and its title on the most important functional capability it contains, never on a smaller convenience or supporting fix. Never repeat a feature in another subject. Describe capabilities introduced during the period as new features, using natural prose rather than labels such as New! or Improved!. Only say improved, enhanced, easier or more flexible when the release notes explicitly show that the capability already existed. Use a neutral heading when a subject contains both new features and updates. Write plain paragraphs for the rich-text editor, with no Markdown tables, headings or lists. Explain what people can do on their website and avoid technical implementation detail and supplier names. Say ‘your website’, not ‘the platform’. Do not greet or sign off."
  };
}

export function defaultReleaseNoteUpdateConfiguration(): ReleaseNoteUpdateConfiguration {
  const profile = defaultReleaseNoteUpdateProfile();
  return {defaultProfileId: profile.id, profiles: [profile]};
}

export function defaultReleaseNoteUpdateProfile(): ReleaseNoteUpdateProfile {
  return {
    id: "default",
    name: "General update",
    periodAmount: DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_AMOUNT,
    periodUnit: DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_UNIT,
    defaults: defaultReleaseNoteUpdateDefaults(),
    recipientMode: RecipientMode.SELECTED_MEMBERS,
    selectedListId: null
  };
}

export function releaseNoteUpdateConfigurationFrom(raw: any): ReleaseNoteUpdateConfiguration {
  const defaults = defaultReleaseNoteUpdateConfiguration();
  const profiles = isArray(raw?.profiles) ? raw.profiles.map((profile, index) => releaseNoteUpdateProfileFrom(profile, index)).filter((profile): profile is ReleaseNoteUpdateProfile => !!profile) : [];
  const migratedProfiles = profiles.length > 0 ? profiles : [{...defaults.profiles[0], defaults: releaseNoteUpdateDefaultsFrom(raw)}];
  const requestedDefaultId = isString(raw?.defaultProfileId) ? raw.defaultProfileId : defaults.defaultProfileId;
  const defaultProfileId = migratedProfiles.some(profile => profile.id === requestedDefaultId) ? requestedDefaultId : migratedProfiles[0].id;
  return {defaultProfileId, profiles: migratedProfiles};
}

function releaseNoteUpdateProfileFrom(raw: any, index: number): ReleaseNoteUpdateProfile | null {
  const id = isString(raw?.id) && raw.id.trim() ? raw.id.trim() : `profile-${index + 1}`;
  const name = isString(raw?.name) && raw.name.trim() ? raw.name.trim() : null;
  const period = releaseNoteUpdatePeriodFromStored(raw);
  const recipientMode = values(RecipientMode).includes(raw?.recipientMode) ? raw.recipientMode : RecipientMode.SELECTED_MEMBERS;
  const selectedListId = isNumber(raw?.selectedListId) ? raw.selectedListId : null;
  return name ? {id, name, periodAmount: period.amount, periodUnit: period.unit, defaults: releaseNoteUpdateDefaultsFrom(raw?.defaults ?? raw), recipientMode, selectedListId} : null;
}

export function releaseNoteUpdateDefaultsFrom(raw: any): ReleaseNoteUpdateDefaults {
  const defaults = defaultReleaseNoteUpdateDefaults();
  const storedCategories = isArray(raw?.categories)
    ? raw.categories.filter(category => values(ReleaseNoteUpdateCategory).includes(category))
    : raw?.scope === ReleaseNoteUpdateScope.EMAIL_ONLY
      ? [ReleaseNoteUpdateCategory.EMAIL]
      : raw?.scope === ReleaseNoteUpdateScope.NON_EMAIL_ONLY
        ? [ReleaseNoteUpdateCategory.NON_EMAIL]
        : defaults.categories;
  return {
    categories: storedCategories.length > 0 ? storedCategories : defaults.categories,
    coverage: values(ReleaseNoteUpdateCoverage).includes(raw?.coverage) ? raw.coverage : defaults.coverage,
    maximumThemes: isNumber(raw?.maximumThemes) && raw.maximumThemes > 0 ? raw.maximumThemes : defaults.maximumThemes,
    maximumSourcesPerTheme: isNumber(raw?.maximumSourcesPerTheme) && raw.maximumSourcesPerTheme > 0 ? raw.maximumSourcesPerTheme : defaults.maximumSourcesPerTheme,
    includeTechnicalChanges: raw?.includeTechnicalChanges === true,
    includeImages: raw?.includeImages !== false,
    writingRules: isString(raw?.writingRules) && raw.writingRules.trim() ? raw.writingRules.trim() : defaults.writingRules
  };
}

export function releaseNoteUpdateSettingsFrom(raw: any): ReleaseNoteUpdateSettings {
  const defaults = defaultReleaseNoteUpdateSettings();
  const merged = {...defaults, ...(raw ?? {})};
  const period = releaseNoteUpdatePeriodFromStored(merged);
  const editorialDefaults = releaseNoteUpdateDefaultsFrom(raw ?? {});
  return {
    profileId: merged.profileId ?? null,
    periodAmount: period.amount,
    periodUnit: period.unit,
    previousDigestId: merged.previousDigestId ?? null,
    previousSentAt: merged.previousSentAt ?? null,
    previousWindowEnd: merged.previousWindowEnd ?? null,
    previouslyIncludedPaths: merged.previouslyIncludedPaths ?? [],
    excludePreviouslyIncluded: merged.excludePreviouslyIncluded !== false,
    includedPaths: merged.includedPaths ?? [],
    fromMillis: merged.fromMillis ?? null,
    toMillis: merged.toMillis ?? null,
    guidance: merged.guidance ?? null,
    indexPath: merged.indexPath ?? null,
    ...editorialDefaults
  };
}

export function composerSenderIdentities(options: {
  contactEmail: string | null;
  contactName: string;
  roles: CommitteeMember[];
  memberId: string | null;
  allCommitteeMembers?: boolean;
}): ComposerSenderIdentity[] {
  const assignedCommitteeEmails = options.allCommitteeMembers
    ? (options.roles ?? [])
      .filter(role => !role.vacant && !!role.email)
      .map(role => ({
        email: role.email,
        roleDescription: role.description || role.type,
        roleType: role.type,
        fullName: role.fullName || "",
        senderName: role.fullName || ""
      }))
    : committeeAssignedEmailsForMemberId(options.roles, options.memberId)
      .map(entry => ({...entry, fullName: "", senderName: options.contactName}));
  return assignedCommitteeEmails.map(entry => ({
    kind: ComposerSenderKind.COMMITTEE_ROLE,
    email: entry.email,
    name: entry.senderName,
    label: `${entry.roleDescription}${entry.fullName ? ` - ${entry.fullName}` : ""} <${entry.email}>`,
    roleType: entry.roleType
  })).reduce<ComposerSenderIdentity[]>((identities, identity) =>
    identities.some(existing => existing.email.toLowerCase() === identity.email.toLowerCase())
      ? identities
      : identities.concat(identity), []);
}

export function defaultBrandedSenderEmail(
  identities: ComposerSenderIdentity[],
  options: { chosenEmail?: string | null; preferredRoleType?: string | null } = {}
): string {
  const committeeIdentities = identities.filter(identity => identity.kind === ComposerSenderKind.COMMITTEE_ROLE);
  const chosen = (options.chosenEmail ?? "").trim().toLowerCase();
  const matchedChosen = chosen ? committeeIdentities.find(identity => identity.email.toLowerCase() === chosen) : undefined;
  const roleType = (options.preferredRoleType ?? "").trim().toLowerCase();
  const byRole = roleType
    ? committeeIdentities.find(identity => (identity.roleType ?? "").toLowerCase() === roleType)
    : undefined;
  return matchedChosen?.email ?? byRole?.email ?? committeeIdentities[0]?.email ?? "";
}

export function syncedRecipientAddressMode(options: {
  committeeRoleSendOffered: boolean;
  preselectCommitteeRole: boolean;
  current: RecipientAddressMode;
}): RecipientAddressMode {
  if (!options.committeeRoleSendOffered) {
    return RecipientAddressMode.PERSONAL;
  } else if (options.preselectCommitteeRole) {
    return RecipientAddressMode.COMMITTEE_ROLE;
  } else {
    return options.current;
  }
}

export function unbrandedCommitteeSharedTo(options: {
  brandingMode: BrandingMode;
  recipientMode: RecipientMode;
  allMembersHoldCommitteeRoles: boolean;
  memberCount: number;
  externalToCount: number;
}): boolean {
  if (options.brandingMode !== BrandingMode.UNBRANDED) {
    return false;
  } else if (options.recipientMode === RecipientMode.ENTIRE_LIST) {
    return false;
  } else if (options.memberCount === 0 || !options.allMembersHoldCommitteeRoles) {
    return false;
  } else {
    return options.memberCount + options.externalToCount > 1;
  }
}

export function composerContentHasPersonalisation(
  parts: (string | null | undefined)[],
  addresseeType?: AddresseeType | null
): boolean {
  if (addresseeType === AddresseeType.FIRST_NAME) {
    return true;
  } else {
    return parts.filter(Boolean).some(value => {
      const text = String(value);
      return text.includes(MergeFieldParamsGroup.MEMBER) || text.includes(MergeFieldParamsGroup.VOLUNTEER);
    });
  }
}

export function composerApiErrorMessage(error: unknown): string {
  if (isString(error)) {
    return error;
  } else {
    const details = error as {error?: unknown; message?: string};
    const nested = nestedApiErrorMessage(details?.error);
    if (nested) {
      return nested;
    } else if (isString(details?.message)) {
      return details.message;
    } else {
      return "An unknown error occurred";
    }
  }
}

function nestedApiErrorMessage(value: unknown): string | null {
  if (isString(value)) {
    return value;
  } else {
    const record = value as {error?: {message?: string} | string; message?: string} | null;
    if (!record) {
      return null;
    } else if (isString(record.message)) {
      return record.message;
    } else if (isString(record.error)) {
      return record.error;
    } else if (isString(record.error?.message)) {
      return record.error.message;
    } else {
      return null;
    }
  }
}

export function batchSendJobWasLost(error: unknown): boolean {
  const status = (error as {status?: number})?.status;
  if (status === 404) {
    return true;
  } else {
    const message = composerApiErrorMessage(error).toLowerCase();
    return message.includes("job not found") || message.includes("no longer on the server");
  }
}

export function composerCampaignListId(options: {
  recipientMode: RecipientMode;
  selectedListId: number | null;
  narrowListId: number | null;
}): number | null {
  if (options.recipientMode === RecipientMode.ENTIRE_LIST) {
    return options.selectedListId;
  } else {
    return options.narrowListId ?? options.selectedListId;
  }
}

export function composerWholeMailingListSelected(options: {
  listId: number | null;
  preFilterKey: string | null;
  selectedMemberIds: string[];
  subscribedMemberIds: string[];
  toRecipients: ComposerExternalRecipient[];
}): boolean {
  if (options.listId === null || options.preFilterKey || options.subscribedMemberIds.length === 0) {
    return false;
  } else {
    const subscribed = new Set(options.subscribedMemberIds);
    const selectedOnList = options.selectedMemberIds.filter(id => subscribed.has(id));
    const extraPeople = options.toRecipients.some(recipient =>
      recipient.listId !== options.listId
      && !composerRecipientIsExpandableSet(recipient)
      && !subscribed.has(recipient.memberId ?? "")
    );
    if (extraPeople) {
      return false;
    } else if (options.selectedMemberIds.length === 0) {
      return options.toRecipients.some(recipient => recipient.listId === options.listId);
    } else {
      return selectedOnList.length === subscribed.size && selectedOnList.length === options.selectedMemberIds.length;
    }
  }
}

export function composerSendsAsCampaign(
  recipientMode: RecipientMode,
  brandingMode: BrandingMode,
  committeeOnlyAudience = false,
  wholeMailingListSelected = false
): boolean {
  if (brandingMode === BrandingMode.UNBRANDED || committeeOnlyAudience) {
    return false;
  } else if (recipientMode === RecipientMode.ENTIRE_LIST) {
    return true;
  } else {
    return wholeMailingListSelected;
  }
}

export function composerSendProgressDescription(options: {
  sendingAsCampaign: boolean;
  oneCombinedEmail: boolean;
  hasBatchProgress: boolean;
  totalRecipients: number;
  processedCount: number;
  currentRecipientLabel: string | null;
}): string {
  if (!options.hasBatchProgress) {
    if (options.sendingAsCampaign) {
      return "Preparing campaign for Brevo…";
    } else if (options.oneCombinedEmail) {
      return "Preparing one email…";
    } else {
      return "Preparing personalised emails…";
    }
  } else if (options.oneCombinedEmail) {
    const recipientWord = options.totalRecipients === 1 ? "recipient" : "recipients";
    return `Sending one email to ${options.totalRecipients} ${recipientWord}`;
  } else {
    const currentNumber = Math.min(options.processedCount + 1, options.totalRecipients);
    const recipient = options.currentRecipientLabel || "recipient";
    return `Sending ${currentNumber} of ${options.totalRecipients} - ${recipient}`;
  }
}

export function composerRecipientAddressesArePrivate(
  recipientCount: number,
  committeeOnlyAudience: boolean
): boolean {
  return recipientCount > 1 && !committeeOnlyAudience;
}

export function composerSelectedMembersAreCommitteeAudience(
  members: {committee?: boolean}[],
  totalRecipientCount: number,
  committeeRoleChipCount = 0
): boolean {
  const committeeMembers = members.filter(member => !!member.committee);
  const accounted = committeeMembers.length + committeeRoleChipCount;
  return totalRecipientCount > 0
    && accounted === totalRecipientCount
    && committeeMembers.length === members.length;
}

export function composerMemberForRecipient(
  recipient: ComposerExternalRecipient,
  members: Member[],
  roles: CommitteeMember[]
): Member | null {
  if (recipient.memberId) {
    return (members ?? []).find(member => member.id === recipient.memberId) ?? null;
  } else {
    const wanted = (recipient.email || "").trim().toLowerCase();
    if (!wanted) {
      return null;
    } else {
      return (members ?? []).find(member => (member.email || "").toLowerCase() === wanted)
        ?? (members ?? []).find(member =>
          committeeAssignedEmailsForMemberId(roles, member.id ?? null)
            .some(entry => (entry.email || "").toLowerCase() === wanted))
        ?? null;
    }
  }
}

export function composerCommitteeRoleSendOffered(options: {
  recipients: ComposerExternalRecipient[];
  members: Member[];
  roles: CommitteeMember[];
  committeeOnlyAudience: boolean;
  recipientCount: number;
}): boolean {
  const chosen = (options.recipients ?? []).filter(recipient =>
    !!(recipient.email || "").trim()
    && !recipient.listId
    && !recipient.filterKey
    && recipient.email !== COMPOSER_EVERYONE_FILTER_EMAIL
  );
  if (chosen.length === 0) {
    return options.committeeOnlyAudience && options.recipientCount > 0;
  } else {
    return chosen.every(recipient => {
      const member = composerMemberForRecipient(recipient, options.members, options.roles);
      return !!member && memberHoldsCommitteeRole(member, options.roles);
    });
  }
}

export const COMPOSER_VISIBLE_RECIPIENT_CHIP_LIMIT = 10;
export const COMPOSER_EVERYONE_FILTER_EMAIL = "filter-everyone-with-email@list.internal";

export function composerRecipientCount(recipients: ComposerExternalRecipient[]): number {
  return recipients.reduce((count, recipient) => count + (recipient.listCount ?? 1), 0);
}

export function composerListToken(listId: number, listName: string, count: number): ComposerExternalRecipient {
  return {
    email: `list-${listId}@list.internal`,
    name: listName,
    saveForReuse: false,
    listId,
    listCount: count
  };
}

export function composerFilterToken(filterKey: MemberSelection, label: string, count: number): ComposerExternalRecipient {
  return {
    email: `filter-${filterKey}@list.internal`,
    name: label,
    saveForReuse: false,
    filterKey,
    listCount: count
  };
}

export function composerEveryoneFilterToken(label: string, count: number): ComposerExternalRecipient {
  return {
    email: COMPOSER_EVERYONE_FILTER_EMAIL,
    name: label,
    saveForReuse: false,
    listCount: count
  };
}

export function composerRecipientIsExpandableSet(recipient: ComposerExternalRecipient): boolean {
  return !!recipient.listId || !!recipient.filterKey || recipient.email === COMPOSER_EVERYONE_FILTER_EMAIL;
}

export function memberIsCoveredByComposerHeaders(
  member: Member,
  headers: ComposerExternalRecipient[],
  roles: CommitteeMember[]
): boolean {
  const emails = new Set((headers ?? []).map(header => (header.email || "").toLowerCase()).filter(Boolean));
  const memberIds = new Set((headers ?? []).map(header => header.memberId).filter((id): id is string => !!id));
  if (member.id && memberIds.has(member.id)) {
    return true;
  } else if (member.email && emails.has(member.email.toLowerCase())) {
    return true;
  } else {
    return (roles ?? [])
      .filter(role => role.memberId === member.id)
      .some(role => roleEmailAddresses(role).some(address => emails.has(address.toLowerCase())));
  }
}

export function composerRecipientFromMember(member: Member): ComposerExternalRecipient | null {
  const email = (member.email || "").trim();
  if (!email) {
    return null;
  } else {
    return {email, name: memberDisambiguatedLabel(member) || undefined, saveForReuse: false, memberId: member.id || undefined};
  }
}

export function composerRecipientIsSamePerson(left: {email: string; memberId?: string}, right: {email: string; memberId?: string}): boolean {
  if (left.memberId && right.memberId) {
    return left.memberId === right.memberId;
  } else {
    return (left.email || "").toLowerCase() === (right.email || "").toLowerCase();
  }
}

export function composerRecipientMatchesQuery(item: {email: string; name?: string; searchText?: string; committeeRoleLabel?: string}, query: string): boolean {
  const needle = (query || "").trim().toLowerCase();
  if (!needle) {
    return true;
  } else {
    return item.email.toLowerCase().includes(needle)
      || (item.name || "").toLowerCase().includes(needle)
      || (item.committeeRoleLabel || "").toLowerCase().includes(needle)
      || (item.searchText || "").includes(needle);
  }
}

export function composerSuggestionShowsEmail(item: ComposerExternalRecipient): boolean {
  if (item.memberId || item.committeeRoleType || item.listId || item.filterKey) {
    return false;
  } else {
    return true;
  }
}

export function composerRecipientFromSuggestion(recipient: ComposerExternalRecipient, existingId?: string): ComposerExternalRecipient {
  return {
    email: recipient.email,
    name: recipient.name,
    existingId,
    saveForReuse: false,
    memberId: recipient.memberId,
    listId: recipient.listId,
    listCount: recipient.listCount,
    filterKey: recipient.filterKey,
    committeeRoleType: recipient.committeeRoleType,
    committeeRoleLabel: recipient.committeeRoleLabel
  };
}

export function composerCcFieldAvailable(options: {inboxReply: boolean; committeeOnlyAudience: boolean}): boolean {
  return options.inboxReply || options.committeeOnlyAudience;
}

export function composerRecipientLacksMarketingConsent(options: {
  requireConsent: boolean;
  recipient: ComposerExternalRecipient;
  member?: Member | null;
}): boolean {
  if (!options.requireConsent || options.recipient.listId || options.recipient.filterKey) {
    return false;
  } else {
    return options.member?.emailMarketingConsent === false;
  }
}

export function composerMemberIdentityRecipients(options: {
  members: Member[];
  committeeAddresses: ComposerExternalRecipient[];
  listRecipients?: ComposerExternalRecipient[];
}): ComposerExternalRecipient[] {
  const listEntries = (options.listRecipients ?? []).reduce((list, recipient) => {
    if (list.some(item => item.email.toLowerCase() === recipient.email.toLowerCase())) {
      return list;
    } else {
      return [...list, recipient];
    }
  }, [] as ComposerExternalRecipient[]);
  const uniqueMembers = (options.members ?? []).reduce((list, member) => {
    if (member.id && list.some(existing => existing.id === member.id)) {
      return list;
    } else {
      return [...list, member];
    }
  }, [] as Member[]);
  const memberIds = new Set(uniqueMembers.map(member => member.id).filter((id): id is string => !!id));
  const memberEmails = new Set(uniqueMembers.map(member => (member.email || "").trim().toLowerCase()).filter(email => !!email));
  const rolesByMemberId = (options.committeeAddresses ?? []).reduce((map, address) => {
    if (address.memberId && memberIds.has(address.memberId)) {
      const current = map.get(address.memberId) ?? [];
      return new Map(map).set(address.memberId, [...current, address]);
    } else {
      return map;
    }
  }, new Map<string, ComposerExternalRecipient[]>());
  const memberEntries = uniqueMembers.reduce((list, member) => {
    const roles = (member.id ? rolesByMemberId.get(member.id) : undefined) ?? [];
    const identity = composerRecipientFromMember(member) ?? (roles[0]
      ? {
        email: roles[0].email,
        name: memberDisambiguatedLabel(member) || roles[0].name,
        saveForReuse: false,
        memberId: member.id || undefined
      }
      : null);
    if (!identity) {
      return list;
    } else {
      const identityName = (identity.name || "").trim().toLowerCase();
      const roleNames = uniq(roles.map(role => (role.name || "").trim()).filter(name => !!name && name.toLowerCase() !== identityName));
      const searchText = [identity.name, identity.email, ...roles.flatMap(role => [role.name, role.email])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const already = list.some(item => composerRecipientIsSamePerson(item, identity)
        || (!!identityName && (item.name || "").trim().toLowerCase() === identityName));
      return already ? list : [...list, {
        ...identity,
        searchText,
        committeeRoleLabel: roleNames.length ? roleNames.join(", ") : undefined
      }];
    }
  }, [] as ComposerExternalRecipient[]);
  const heldEmails = new Set([
    ...memberEmails,
    ...memberEntries.map(item => item.email.toLowerCase()),
    ...[...rolesByMemberId.values()].flat().map(role => (role.email || "").toLowerCase())
  ]);
  const roleEntries = (options.committeeAddresses ?? []).reduce((list, address) => {
    const email = (address.email || "").trim().toLowerCase();
    const roleType = (address.committeeRoleType || "").trim().toLowerCase();
    const roleName = (address.name || "").trim().toLowerCase();
    const heldByListedMember = !!address.memberId && memberIds.has(address.memberId);
    const already = list.some(item => item.email.toLowerCase() === email
      || (!!roleType && (item.committeeRoleType || "").trim().toLowerCase() === roleType)
      || (!!roleName && (item.name || "").trim().toLowerCase() === roleName));
    if (!email || heldByListedMember || heldEmails.has(email) || already) {
      return list;
    } else {
      return [...list, {
        ...address,
        saveForReuse: false,
        searchText: [address.name, address.email].filter(Boolean).join(" ").toLowerCase()
      }];
    }
  }, [] as ComposerExternalRecipient[]);
  return [...listEntries, ...memberEntries, ...roleEntries];
}

export function composerRecipientsForAddressMode(
  recipients: ComposerExternalRecipient[],
  members: Member[],
  roles: CommitteeMember[],
  mode: RecipientAddressMode
): ComposerExternalRecipient[] {
  const byId = new Map((members ?? []).filter(member => member.id).map(member => [member.id as string, member]));
  return (recipients ?? []).map(recipient => {
    if (recipient.committeeRoleType || composerRecipientIsExpandableSet(recipient)) {
      return recipient;
    } else {
      const member = (recipient.memberId && byId.get(recipient.memberId))
        || (members ?? []).find(item => (item.email || "").toLowerCase() === (recipient.email || "").toLowerCase());
      if (!member) {
        return recipient;
      } else {
        const email = mode === RecipientAddressMode.COMMITTEE_ROLE
          ? (outboundEmailForMember(member, roles) || member.email || recipient.email)
          : (member.email || recipient.email);
        if ((email || "").toLowerCase() === (recipient.email || "").toLowerCase()) {
          return recipient;
        } else {
          return {...recipient, email, memberId: member.id || recipient.memberId};
        }
      }
    }
  });
}

export function composerRecipientKeepsRoleMailbox(recipient: ComposerExternalRecipient): boolean {
  return !!recipient.committeeRoleType;
}

export function batchSendRecipientSplit(toRecipients: ComposerExternalRecipient[]): {memberIds: string[]; externalRecipients: ComposerExternalRecipient[]} {
  const rows = toRecipients ?? [];
  return {
    memberIds: uniq(rows.filter(recipient => recipient.memberId && !composerRecipientKeepsRoleMailbox(recipient)).map(recipient => recipient.memberId).filter((id): id is string => !!id)),
    externalRecipients: rows.filter(recipient => !recipient.memberId || composerRecipientKeepsRoleMailbox(recipient))
  };
}

export function composerCommitteeRecipients(roles: CommitteeMember[]): ComposerExternalRecipient[] {
  return (roles ?? []).reduce((list: ComposerExternalRecipient[], role) => {
    return roleEmailAddresses(role).reduce((acc, address) => {
      const email = (address || "").trim();
      if (!email || acc.some(item => item.email.toLowerCase() === email.toLowerCase())) {
        return acc;
      } else {
        return [...acc, {
          email,
          name: role.description || role.fullName || email,
          saveForReuse: false,
          memberId: role.memberId || undefined,
          committeeRoleType: role.type
        }];
      }
    }, list);
  }, []);
}

export function appendUniqueRecipients(list: ComposerExternalRecipient[], additions: ComposerExternalRecipient[]): ComposerExternalRecipient[] {
  return (additions ?? []).reduce((acc, item) => {
    const email = (item.email || "").trim().toLowerCase();
    if (!email || acc.some(existing => composerRecipientIsSamePerson(existing, item))) {
      return acc;
    } else {
      return [...acc, item];
    }
  }, list ?? []);
}

export function recipientsWithoutEmails(list: ComposerExternalRecipient[], emails: Set<string>): ComposerExternalRecipient[] {
  return (list ?? []).filter(item => !emails.has(item.email.toLowerCase()));
}

export function defaultAddresseeTypeForBranding(mode: BrandingMode): AddresseeType {
  return mode === BrandingMode.UNBRANDED ? AddresseeType.NONE : AddresseeType.FIRST_NAME;
}

export function defaultEmailComposerState(): EmailComposerState {
  return {
    context: { source: EmailComposerContextSource.ADMIN },
    compositionKind: EmailCompositionKind.STANDARD,
    newsletter: null,
    releaseNoteUpdate: null,
    brandingMode: BrandingMode.BRANDED,
    unbrandedSenderRoleType: null,
    unbrandedSenderEmail: null,
    brandedSenderEmail: null,
    recipientMode: RecipientMode.ENTIRE_LIST,
    recipientAddressMode: RecipientAddressMode.PERSONAL,
    selectedListId: null,
    narrowListId: null,
    selectedMemberIds: [],
    externalRecipients: [],
    ccRecipients: [],
    bccRecipients: [],
    preFilterKey: null,
    notificationConfig: null,
    notificationConfigListing: null,
    bannerId: null,
    subject: "",
    showTitle: true,
    addresseeType: AddresseeType.FIRST_NAME,
    introMarkdown: "",
    signoffTextMarkdown: "If you have any questions about the above, please don't hesitate to contact me.\n\nBest regards,",
    signoffRoles: [],
    articleBlocks: [],
    attachmentUrl: null,
    attachmentFilename: null,
    attachments: [],
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
    fragmentOrder: [],
    inboxReplyContext: null
  };
}

function collectFragments(list: ComposerFragment[]): ComposerFragment[] {
  return list.flatMap(fragment => {
    if (fragment.kind === ComposerFragmentKind.MULTI_COLUMN) {
      return [fragment, ...(fragment.columns ?? []).flatMap(column => collectFragments(column))];
    } else {
      return [fragment];
    }
  });
}

export function fragmentHasContent(fragment: ComposerFragment, state: EmailComposerState): boolean {
  if (fragment.kind === ComposerFragmentKind.INTRO) {
    return !!(state.introMarkdown ?? "").trim();
  } else if (fragment.kind === ComposerFragmentKind.SIGNOFF) {
    return !!(state.signoffTextMarkdown ?? "").trim();
  } else if (fragment.kind === ComposerFragmentKind.ARTICLE) {
    const block = (state.articleBlocks ?? []).find(article => article.id === fragment.id) ?? null;
    return !!block && (!!(block.title ?? "").trim() || !!(block.markdown ?? "").trim() || !!block.image);
  } else if (fragment.kind === ComposerFragmentKind.EVENTS) {
    if (state.eventInclusion === EventInclusionMode.SINGLE_EVENT) {
      return !!(state.singleEvent?.groupEvent?.title);
    } else if (state.eventInclusion === EventInclusionMode.AUTO_INCLUDE) {
      return (state.groupEvents ?? []).some(event => event.selected);
    } else {
      return false;
    }
  } else if (fragment.kind === ComposerFragmentKind.COMMITTEE_FILE) {
    return (fragment.committeeFileIds ?? []).length > 0;
  } else if (fragment.kind === ComposerFragmentKind.MULTI_COLUMN) {
    return (fragment.columns ?? []).some(column => column.some(child => fragmentHasContent(child, state)));
  } else {
    return false;
  }
}

export function fragmentIdsWithContent(state: EmailComposerState): string[] {
  return collectFragments(state.fragmentOrder ?? [])
    .filter(fragment => fragmentHasContent(fragment, state))
    .map(fragment => fragment.id);
}
