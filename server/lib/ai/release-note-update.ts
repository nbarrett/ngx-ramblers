import { isArray, isNumber, isString } from "es-toolkit/compat";
import { sortBy, uniq, uniqBy } from "es-toolkit";
import {
  ReleaseNoteUpdateCandidate,
  ReleaseNoteUpdateDraft,
  ReleaseNoteUpdateItem
} from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import { jsonObjectFrom } from "./newsletter-plan";
import { dateTimeFromMillis, formatDateTime } from "../shared/dates";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { ReleaseNoteUpdateCategory, ReleaseNoteUpdateCoverage, ReleaseNoteUpdateDefaults } from "../../../projects/ngx-ramblers/src/app/models/email-composer.model";

export const RELEASE_NOTE_UPDATE_SYSTEM_PROMPT = [
  "Write a short update email for chairs, webmasters and committee members who run groups on NGX.",
  "The source is the curated NGX release notes for the period, not the commit history. These changes are available across NGX websites: every group on NGX gets them.",
  "Rewrite them into warm, non-technical, benefit-led prose about what the change means for groups and their members.",
  "Write for a group volunteer who does not work in software. Assume they do not know or care how NGX is built.",
  "For every possible highlight, ask what a chair, webmaster, walk leader, committee member or ordinary member can now do more easily, safely or reliably. Write that outcome and leave out the mechanism.",
  "Determine whether each capability is new or changed before writing its title or body. Treat release-note wording such as introduces, adds, launches, is now available, can now or new as evidence that the capability is new in this reporting period.",
  "Call a capability improved, enhanced, easier or more flexible only when the supplied release notes explicitly establish that the capability existed before the reporting period and was changed during it. Never infer that history merely because several related release notes have been grouped together.",
  "Describe a newly introduced capability as new, including in the headline. If a broad subject contains both new capabilities and changes to existing ones, use a neutral factual subject heading and distinguish new features from subsequent refinements in the body.",
  "Choose and order items by user impact and benefit, not by which part of the system they touched.",
  "Give major new capabilities and substantial improvements more space and prominence than small fixes.",
  "Before writing, silently build a complete inventory of distinct user-facing capabilities across the selected period. Connect each capability's introduction to its later refinements even when they appear in separate release notes.",
  "Assess each capability by what changed for users: whether it created a new workflow, replaced or consolidated existing work, how many useful actions it enables, which audiences benefit, and how substantial the practical outcome is. Use that assessment to rank and allocate space; do not rank by release-note count, recency or technical size.",
  "Within every broad subject, identify the highest-impact capability before choosing the title. The title must lead with that capability and its main user outcome. Never headline a smaller convenience, search refinement or supporting fix when the same item contains a substantially more important new workflow or feature.",
  "Do not group changes merely because they touch the same screen, map or part of the website. Combine them only when they form one coherent user story. Treat a lower-impact change as supporting detail only when it genuinely helps that story; otherwise give it a separate lower-priority subject or omit it.",
  "Summarise each significant capability as one story: what was launched or changed, the important things people can do with it, and only the meaningful later refinements. Do not describe refinements while omitting the capability they belong to.",
  "Drop or skip internal, infrastructural and low-impact items such as dependency updates, lint, build, deploy plumbing, or anything a non-developer would not notice.",
  "Omit invisible engineering work entirely, including performance diagnostics, memory management, deployment, backups, migrations, authentication plumbing, schemas, contracts and server architecture, unless the source describes a direct user-visible outcome. If it does, mention only that outcome.",
  "Do not name suppliers, protocols, frameworks or internal systems such as Brevo, Salesforce, Cloudflare, DMARC, API, OpenAPI, Swagger, TipTap, TypeScript, Zod, CI, workers, beacons or environments unless the reader must recognise that name to use the feature. Prefer ordinary phrases such as email delivery, member records, site statistics or document editing.",
  "Treat the release notes as evidence, not as the structure of the email. Synthesise related changes into a small number of broad themes and benefits, for example keeping members informed, running walks, or getting set up.",
  "Each highlight title must name the most important functional area and user outcome represented by that item, while remaining broad enough to contain its genuinely related changes. Do not use the title of an individual release note as the highlight title.",
  "Write natural editorial headlines. Never prefix a title or sentence with labels such as New!, Improved!, Enhanced!, New: or Improved:. State naturally in the body when a capability is new.",
  "Give every capability one clear home in the email. Before writing, assign each capability to exactly one broad subject. Never repeat or paraphrase the same capability in another item, even when several release notes mention it.",
  "Write as a person on the team speaking to colleagues (we, our, us). Never present this as an automated system or a generated digest.",
  "A short opening of two or three sentences is enough. Follow it with substantial, consumer-friendly highlights grouped under broad subjects.",
  "Combine facts from several release notes wherever they support the same overall benefit. Do not produce one item per release note or narrate changes chronologically.",
  "Comprehensive coverage means covering all material capabilities in the prose. It never means citing every release note.",
  "Sources are representative evidence only. Keep every sources array within the requested maximum and never repeat a path.",
  "When suitable source images are listed, choose at most one imageId for each item from that item's supporting release notes. Select the image that best illustrates the item's main capability and user outcome. Use null when no supplied image is genuinely relevant. Never reuse an imageId or invent an image.",
  "Classify every item as exactly email, non-email or platform-management. Email includes inboxes, newsletters, subscriptions, sending, delivery and member communications. Non-email includes walks, events, website content, maps, images and social media. Platform-management is reserved for managing websites, environments, setup and administration across NGX. Never combine facts from different categories in one item.",
  "Social media belongs within the non-email category, but a category label or introductory sentence never counts as covering it. Inspect the release notes for material social publishing, sharing and integration capabilities. A substantial social-media workflow is a major user-facing capability and must receive a substantive item with its own meaningful title, body and supporting sourceIds whenever it exists in the selected period. Do not create a separate social-media category.",
  "Review the complete selected period from its earliest note to its latest before choosing themes. The summary must represent the whole period, not just the most recent weeks.",
  "Spread supporting references across the selected period where the source supports it. Do not select every reference from the newest month when relevant earlier work is available.",
  "Each body must read as a coherent summary, not a compressed inventory of feature names. Use two or three short sentences and no semicolon-separated or comma-heavy catalogue of changes.",
  "The intro and bodies must contain plain paragraphs only. Do not emit Markdown tables, headings, lists, labels or decorative formatting because the copy is loaded into a rich-text editor.",
  "Do not mention tickets, handover assets, technical readiness, implementation status or what another development team can inherit.",
  "A note without screenshots can still be important. Skip only internal, low-impact work, never because it lacks images.",
  "Each item is a sentence or two.",
  "When addressing the reader, say your website. Do not say the platform.",
  "Do not use jargon, issue numbers, ticket references, commit hashes, file names, API names or implementation detail.",
  "Use only the facts supplied. Do not invent features, dates, people or benefits that are not in the source.",
  "Write in British English, in the plain warm prose a volunteer would write.",
  "Do not use em dashes and do not use exclamation marks.",
  "Do not greet the reader and do not sign off, because both are added separately.",
  "Return a single JSON object and nothing else, with these keys:",
  "intro (the opening paragraphs as plain text, no heading),",
  "items (an array of the chosen highlights, each with sourceIds as an array of supporting numeric release-note ids used by no other item, imageId as one supplied image identifier from those supporting sources or null, category as exactly email, non-email or platform-management, title as a natural short benefit-led headline without a New or Improved label, body as a short plain-text paragraph that synthesises unique changes not mentioned by another item, and theme as a short benefit group such as Running walks).",
  "When the source has no usable changes, return an intro that says so plainly and an empty items array. Do not invent news.",
  "Return no explanation, no markdown code fence and no text outside the JSON object."
].join(" ");

export const MAX_EXCERPT_CHARS = 600;
export const MAX_GUIDANCE_CHARS = 500;
export const MAX_RETRY_DRAFT_CHARS = 12000;
export const MAX_RELEASE_NOTE_UPDATE_GENERATED_TOKENS = 8192;

export const RELEASE_NOTE_UPDATE_RETRY_PROMPT = `${RELEASE_NOTE_UPDATE_SYSTEM_PROMPT} Your previous response contained useful content but could not be read as the required JSON. Consolidate its broad subject coverage into the explicitly stated maximum number of items. Do not turn its individual bullets or release notes into separate items. Correct any wording that conflicts with these rules, attach only the most representative valid sourceIds from the compact source list, and return valid compact JSON matching the requested structure.`;

export function digestHighlightLimit(candidateCount: number, maximumThemes: number): number {
  return Math.min(candidateCount, Math.max(1, maximumThemes));
}

export function truncateExcerpt(text: string | undefined, maxChars: number = MAX_EXCERPT_CHARS): string {
  const trimmed = (text ?? "").replace(/\s+/g, " ").trim();
  return trimmed.length <= maxChars ? trimmed : `${trimmed.slice(0, maxChars).trimEnd()}…`;
}

export function describeCandidate(candidate: ReleaseNoteUpdateCandidate, sourceId: number | null = null): string {
  const images = (candidate.images ?? []).map((image, index) => `image ${sourceId}.${index + 1}: ${image.alt || "Screenshot from this release note"}`);
  return [
    candidate.dateMillis ? `date: ${formatDateTime(dateTimeFromMillis(candidate.dateMillis), UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES)}` : null,
    `title: ${candidate.title}`,
    candidate.excerpt ? `detail: ${truncateExcerpt(candidate.excerpt)}` : null,
    ...images
  ].filter(Boolean).join("\n");
}

export function releaseNotesForPrompt(candidates: ReleaseNoteUpdateCandidate[]): ReleaseNoteUpdateCandidate[] {
  return sortBy(candidates ?? [], [(candidate: ReleaseNoteUpdateCandidate) => candidate.dateMillis ?? Number.MAX_SAFE_INTEGER]);
}

export function buildReleaseNoteUpdateInput(candidates: ReleaseNoteUpdateCandidate[],
                                         periodDescription: string | null,
                                         groupName: string | null,
                                         guidance: string | null,
                                         rules: ReleaseNoteUpdateDefaults): string {
  const listed = releaseNotesForPrompt(candidates);
  const trimmedGuidance = truncateExcerpt(guidance ?? "", MAX_GUIDANCE_CHARS);
  const heading = [
    groupName ? `Group: ${groupName}` : null,
    periodDescription ? `Period covered: ${periodDescription}` : null,
    trimmedGuidance ? `Guidance from the sender: ${trimmedGuidance}` : null,
    `Curated release notes in the period: ${listed.length}`,
    `Content categories: ${categoryInstruction(rules.categories)}`,
    `Coverage: ${coverageInstruction(rules.coverage)}`,
    `Technical changes: ${rules.includeTechnicalChanges ? "include only when they have a clear practical consequence for users" : "exclude technical fixes, infrastructure, maintenance and internal engineering entirely"}.`,
    `Images: ${rules.includeImages ? "choose a suitable supplied release-note image for each subject when one is genuinely relevant" : "do not select or include images"}.`,
    `Use no more than ${digestHighlightLimit(listed.length, rules.maximumThemes)} broad subjects.`,
    `Hard limit: use no more than ${rules.maximumSourcesPerTheme} representative supporting release notes for each subject. Do not list every matching release note.`,
    `Editable writing rules: ${truncateExcerpt(rules.writingRules, MAX_GUIDANCE_CHARS * 4)}`
  ].filter(Boolean).join("\n");
  const body = listed.length
    ? listed.map((candidate, index) => `Release note id ${index + 1}:\n${describeCandidate(candidate, index + 1)}`)
      .join("\n\n")
    : "There are no curated release notes in this period.";
  return [heading, body].join("\n\n");
}

export function buildReleaseNoteUpdateRetryInput(candidates: ReleaseNoteUpdateCandidate[],
                                                periodDescription: string,
                                                previousOutput: string,
                                                maximumThemes: number,
                                                maximumSourcesPerTheme: number): string {
  const compactSources = releaseNotesForPrompt(candidates)
    .map((candidate, index) => `${index + 1}: ${candidate.dateMillis ? formatDateTime(dateTimeFromMillis(candidate.dateMillis), UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES) : "undated"} | ${truncateExcerpt(candidate.title, 160)}${(candidate.images ?? []).length > 0 ? ` | images: ${(candidate.images ?? []).map((_image, imageIndex) => `${index + 1}.${imageIndex + 1}`).join(", ")}` : ""}`)
    .join("\n");
  return [
    `Period covered: ${periodDescription}`,
    `Return no more than ${digestHighlightLimit(candidates.length, maximumThemes)} aggregated items in total. This is an absolute limit.`,
    `Use no more than ${maximumSourcesPerTheme} sourceIds per item.`,
    "Compact source id, date and release-note title list:",
    compactSources,
    "Previous draft to repair without losing its coverage:",
    previousOutput.slice(0, MAX_RETRY_DRAFT_CHARS),
    `Return one complete JSON object with no more than ${digestHighlightLimit(candidates.length, maximumThemes)} items. Aggregate the previous draft's details inside those broad items. Do not emit one item per bullet or release note.`
  ].join("\n\n");
}

export function categoryInstruction(categories: ReleaseNoteUpdateCategory[]): string {
  const descriptions = categories.map(category => category === ReleaseNoteUpdateCategory.EMAIL
    ? "email features"
    : category === ReleaseNoteUpdateCategory.PLATFORM_MANAGEMENT
      ? "platform management"
      : "non-email features, including social media");
  return `${descriptions.join(", ")} only; organise each selected category under its own top-level group and exclude unselected categories`;
}

export function coverageInstruction(coverage: ReleaseNoteUpdateCoverage): string {
  return coverage === ReleaseNoteUpdateCoverage.COMPREHENSIVE
    ? "cover every material consumer-facing capability, aggregating related facts without omitting important features"
    : "select only the changes most likely to matter to volunteers and members";
}

export function releaseNoteDescription(title: string): string {
  const parts = title.split(/\s+—\s+/);
  const hasReleaseMetadata = parts.length >= 4 && /^build\s+\d+/i.test(parts[1]) && /^#\d+/.test(parts[2]);
  return (hasReleaseMetadata ? parts.slice(3).join(" — ") : title).trim();
}

function textFrom(value: unknown): string | null {
  const trimmed = isString(value) ? value.trim() : "";
  return trimmed ? trimmed : null;
}

export function cleanGeneratedProse(value: unknown): string | null {
  const cleaned = isString(value) ? value
    .split("\n")
    .filter(line => !/^\s*\|.*\|\s*$/.test(line))
    .map(line => line.replace(/^\s*#{1,6}\s+/, "").replace(/^\s*[-*+]\s+/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() : "";
  return cleaned ? cleaned : null;
}

export function cleanGeneratedTitle(value: unknown): string | null {
  const cleaned = cleanGeneratedProse(value)?.replace(/^(?:new|improved|enhanced)\s*[!:–—-]+\s*/i, "").trim() ?? "";
  return cleaned ? cleaned : null;
}

export function releaseNoteImagesFromMarkdown(markdown: string): {url: string; alt: string}[] {
  return uniqBy(Array.from(markdown.matchAll(/!\[([^\]]*)]\(([^\s)]+)(?:\s+["'][^"']*["'])?\)/g))
    .map(match => ({url: match[2].trim(), alt: match[1].trim()}))
    .filter(image => /^https?:\/\//i.test(image.url)), image => image.url);
}

function sourceIdFrom(value: unknown): number | null {
  if (isNumber(value) && Number.isInteger(value)) {
    return value;
  } else if (isString(value) && /^\d+$/.test(value.trim())) {
    return parseInt(value.trim(), 10);
  } else {
    return null;
  }
}

function itemFrom(raw: any,
                  candidatesByPath: Map<string, ReleaseNoteUpdateCandidate>,
                  candidatesById: Map<number, ReleaseNoteUpdateCandidate>,
                  categories: ReleaseNoteUpdateCategory[],
                  indexUrl: string | null,
                  claimedImageUrls: string[]): ReleaseNoteUpdateItem | null {
  const rawSources = isArray(raw?.sources)
    ? raw.sources
    : isArray(raw?.sourcePaths)
      ? raw.sourcePaths
      : isArray(raw?.paths) ? raw.paths : [];
  const requestedPaths: string[] = rawSources.map(source => textFrom(isString(source) ? source : source?.path))
    .filter((path): path is string => !!path);
  const rawSourceIds = isArray(raw?.sourceIds)
    ? raw.sourceIds
    : isArray(raw?.source_ids)
      ? raw.source_ids
      : rawSources;
  const requestedIdPaths: string[] = rawSourceIds
    .map(source => sourceIdFrom(isNumber(source) || isString(source) ? source : source?.id))
    .map(sourceId => sourceId ? candidatesById.get(sourceId)?.path ?? null : null)
    .filter((path): path is string => !!path);
  const legacyPath = textFrom(raw?.path);
  const suppliedPaths = requestedIdPaths.length > 0 ? requestedIdPaths : requestedPaths.length > 0 ? requestedPaths : [legacyPath];
  const validatedSourcePaths = uniq(suppliedPaths
    .filter((path): path is string => !!path && candidatesByPath.has(path)));
  const candidate = validatedSourcePaths.length > 0 ? candidatesByPath.get(validatedSourcePaths[0]) : null;
  const supportingCandidates = sortBy(
    validatedSourcePaths.map(path => candidatesByPath.get(path)).filter((source): source is ReleaseNoteUpdateCandidate => !!source),
    [(source: ReleaseNoteUpdateCandidate) => -(source.dateMillis ?? 0)]
  );
  const sourcePaths = supportingCandidates.map(source => source.path);
  const sourceNotes = supportingCandidates.map(source => ({
      description: releaseNoteDescription(source.title),
      url: source.url,
      date: source.dateMillis ? formatDateTime(dateTimeFromMillis(source.dateMillis), UIDateFormat.DISPLAY_DATE_NO_DAY) : null
    }));
  const title = cleanGeneratedTitle(raw?.title) ?? candidate?.title ?? null;
  const body = cleanGeneratedProse(raw?.body);
  const category = categoryFrom(raw?.category, categories);
  const image = imageFrom(raw?.imageId ?? raw?.image_id, candidatesById, sourcePaths, `${title || ""} ${body || ""}`, claimedImageUrls);
  if (!candidate || !title || !body || !category) {
    return null;
  } else {
    return {
      path: candidate.path,
      sourcePaths,
      sourceNotes,
      url: indexUrl ?? candidate.url,
      title,
      body,
      theme: textFrom(raw?.theme),
      category,
      ...(image ? {image} : {})
    };
  }
}

function imageFrom(raw: unknown,
                   candidatesById: Map<number, ReleaseNoteUpdateCandidate>,
                   sourcePaths: string[],
                   subject: string,
                   claimedImageUrls: string[]): {url: string; alt: string} | null {
  const identifier = isNumber(raw) ? raw.toString() : textFrom(raw);
  const match = identifier?.match(/^(\d+)\.(\d+)$/);
  const source = match ? candidatesById.get(parseInt(match[1], 10)) : null;
  const requestedImage = source && sourcePaths.includes(source.path) ? (source.images ?? [])[parseInt(match![2], 10) - 1] : null;
  const subjectTerms = meaningfulTerms(subject);
  const requestedImageRelevance = requestedImage ? sharedTermCount(subjectTerms, meaningfulTerms(requestedImage.alt)) : 0;
  const selectedImage = requestedImage && requestedImageRelevance > 0 && !claimedImageUrls.includes(requestedImage.url) ? requestedImage : null;
  const rankedImages = Array.from(candidatesById.values()).flatMap(candidate => (candidate.images ?? []).filter(image => !claimedImageUrls.includes(image.url)).map(image => {
    const imageRelevance = sharedTermCount(subjectTerms, meaningfulTerms(image.alt));
    const candidateRelevance = sharedTermCount(subjectTerms, meaningfulTerms(`${candidate.title} ${candidate.excerpt}`));
    const supportingSource = sourcePaths.includes(candidate.path);
    return {image, imageRelevance, score: imageRelevance * 20 + candidateRelevance + (supportingSource ? 10 : 0)};
  })).filter(candidate => candidate.imageRelevance > 0 && candidate.score >= 20)
    .sort((left, right) => right.score - left.score);
  const fallbackImage = rankedImages[0]?.image ?? null;
  return selectedImage ?? fallbackImage;
}

function meaningfulTerms(value: string): string[] {
  const ignored = ["about", "after", "again", "also", "been", "being", "better", "changes", "feature", "features", "from", "have", "improved", "into", "more", "other", "their", "there", "these", "this", "through", "using", "website", "with", "your"];
  return uniq((value.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter(term => term.length >= 4 && !ignored.includes(term))
    .map(term => term.endsWith("ies")
      ? `${term.slice(0, -3)}y`
      : term.endsWith("ing")
        ? term.slice(0, -3)
        : term.endsWith("ed")
          ? term.slice(0, -2)
          : term.endsWith("s")
            ? term.slice(0, -1)
            : term));
}

function sharedTermCount(left: string[], right: string[]): number {
  return left.filter(term => right.includes(term)).length;
}

export function uniqueSourcesAcrossItems(items: ReleaseNoteUpdateItem[]): ReleaseNoteUpdateItem[] {
  return items.reduce((result: {items: ReleaseNoteUpdateItem[]; claimedPaths: string[]}, item) => {
    const uniqueSources = item.sourcePaths
      .map((path, index) => ({path, note: item.sourceNotes[index]}))
      .filter(source => !result.claimedPaths.includes(source.path));
    const uniqueItem = uniqueSources.length > 0 ? {
      ...item,
      path: uniqueSources[0].path,
      sourcePaths: uniqueSources.map(source => source.path),
      sourceNotes: uniqueSources.map(source => source.note).filter(note => !!note)
    } : null;
    return uniqueItem ? {
      items: result.items.concat([uniqueItem]),
      claimedPaths: result.claimedPaths.concat(uniqueItem.sourcePaths)
    } : result;
  }, {items: [], claimedPaths: []}).items;
}

export function representativeItemSources(item: ReleaseNoteUpdateItem, maximumSources: number): ReleaseNoteUpdateItem {
  const sourcePairs = item.sourcePaths.map((path, index) => ({path, note: item.sourceNotes[index]}));
  const selectedIndexes = sourcePairs.length <= maximumSources
    ? sourcePairs.map((_source, index) => index)
    : maximumSources === 1
      ? [sourcePairs.length - 1]
      : Array.from({length: maximumSources}, (_value, index) => Math.round(index * (sourcePairs.length - 1) / (maximumSources - 1)));
  const selected = uniq(selectedIndexes).map(index => sourcePairs[index]);
  return {
    ...item,
    sourcePaths: selected.map(source => source.path),
    sourceNotes: selected.map(source => source.note).filter(note => !!note)
  };
}

function categoryFrom(raw: unknown, categories: ReleaseNoteUpdateCategory[]): ReleaseNoteUpdateCategory | null {
  const selectedCategory = categories.length === 1 ? categories[0] : null;
  return selectedCategory ?? (categories.includes(raw as ReleaseNoteUpdateCategory) ? raw as ReleaseNoteUpdateCategory : null);
}

export function emptyReleaseNoteUpdateDraft(indexPath: string | null, indexUrl: string | null, quietIntro: string): ReleaseNoteUpdateDraft {
  return {
    intro: quietIntro,
    items: [],
    indexPath,
    indexUrl
  };
}

export function handComposableDraft(candidates: ReleaseNoteUpdateCandidate[],
                                    indexPath: string | null,
                                    indexUrl: string | null,
                                    intro: string): ReleaseNoteUpdateDraft {
  return {
    intro,
    items: candidates.map(candidate => ({
      path: candidate.path,
      sourcePaths: [candidate.path],
      sourceNotes: [{
        description: candidate.title,
        url: candidate.url,
        date: candidate.dateMillis ? formatDateTime(dateTimeFromMillis(candidate.dateMillis), UIDateFormat.DISPLAY_DATE_NO_DAY) : null
      }],
      url: candidate.url,
      title: candidate.title,
      body: "",
      theme: null,
      category: ReleaseNoteUpdateCategory.NON_EMAIL
    })),
    indexPath,
    indexUrl
  };
}

export function parseReleaseNoteUpdateDraft(raw: string,
                                         candidates: ReleaseNoteUpdateCandidate[],
                                         indexPath: string | null,
                                         indexUrl: string | null,
                                         maximumThemes: number,
                                         maximumSourcesPerTheme: number,
                                         categories: ReleaseNoteUpdateCategory[] = [ReleaseNoteUpdateCategory.NON_EMAIL]): ReleaseNoteUpdateDraft | null {
  const parsed = jsonObjectFrom(raw);
  if (!parsed) {
    return null;
  } else {
    const candidatesByPath = new Map(candidates.map(candidate => [candidate.path, candidate]));
    const candidatesById = new Map(releaseNotesForPrompt(candidates).map((candidate, index) => [index + 1, candidate]));
    const generatedItems = (isArray(parsed.items) ? parsed.items : []).reduce((result: {items: ReleaseNoteUpdateItem[]; claimedImageUrls: string[]}, rawItem) => {
      const item = itemFrom(rawItem, candidatesByPath, candidatesById, categories, indexUrl, result.claimedImageUrls);
      return item ? {
        items: result.items.concat([item]),
        claimedImageUrls: item.image ? result.claimedImageUrls.concat([item.image.url]) : result.claimedImageUrls
      } : result;
    }, {items: [], claimedImageUrls: []});
    const items = uniqueSourcesAcrossItems(generatedItems.items)
      .map(item => representativeItemSources(item, maximumSourcesPerTheme))
      .slice(0, digestHighlightLimit(candidates.length, maximumThemes));
    const intro = cleanGeneratedProse(parsed.intro) ?? "";
    const usableItems = candidates.length === 0 || items.length > 0;
    return usableItems ? {
      intro,
      items,
      indexPath,
      indexUrl
    } : null;
  }
}

export function quietEmptyIntro(): string {
  return "Nothing new has shipped on NGX in this period. The next update will pick up from here.";
}

export function handComposableIntro(candidateCount: number): string {
  return candidateCount === 0
    ? quietEmptyIntro()
    : "Here is what has shipped since the last update. Edit the items below so they read as you would put them, then send when you are happy.";
}
