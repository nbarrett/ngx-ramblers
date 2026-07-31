import { BrandingMode } from "../models/mail.model";
import {
  AddresseeType,
  ArticleBlockPosition,
  ComposerFragment,
  ComposerFragmentKind,
  DEFAULT_COLUMN_GAP_PX,
  DEFAULT_NEWSLETTER_CADENCE,
  EmailComposerContextSource,
  EmailComposerFragmentOrderState,
  EmailComposerState,
  EmailCompositionKind,
  EventInclusionMode,
  NewsletterSettings,
  RecipientMode,
  SectionDividerStyle,
  SECTION_DIVIDER_OPTIONS,
  SendingChannel
} from "../models/email-composer.model";

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

export function defaultEmailComposerState(): EmailComposerState {
  return {
    context: { source: EmailComposerContextSource.ADMIN },
    compositionKind: EmailCompositionKind.STANDARD,
    newsletter: null,
    brandingMode: BrandingMode.BRANDED,
    unbrandedSenderRoleType: null,
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
