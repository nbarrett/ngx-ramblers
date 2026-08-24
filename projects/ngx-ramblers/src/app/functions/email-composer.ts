import { BrandingMode } from "../models/mail.model";
import {
  AddresseeType,
  ArticleBlock,
  ArticleBlockImageAlignment,
  ArticleBlockPosition,
  ComposerFragment,
  ComposerFragmentKind,
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

export function defaultEmailComposerState(): EmailComposerState {
  return {
    context: { source: EmailComposerContextSource.ADMIN },
    compositionKind: EmailCompositionKind.STANDARD,
    newsletter: null,
    releaseNoteUpdate: null,
    brandingMode: BrandingMode.BRANDED,
    unbrandedSenderRoleType: null,
    unbrandedSenderEmail: null,
    recipientMode: RecipientMode.ENTIRE_LIST,
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
    fragmentOrder: []
  };
}
