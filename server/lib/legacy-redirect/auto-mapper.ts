import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { legacyUrlMapping } from "../mongo/models/legacy-url-mapping";
import { pageContent } from "../mongo/models/page-content";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { convertTitleToSlug } from "../mongo/controllers/extended-group-event";
import { lastItemFrom } from "../shared/string-utils";
import { dateTimeNowAsValue } from "../shared/dates";
import {
  AutoMapResult,
  RedirectConfidence,
  RedirectMatchMethod,
  RedirectMappingStatus
} from "../../../projects/ngx-ramblers/src/app/models/legacy-url-redirect.model";

const debugLog = debug(envConfig.logNamespace("auto-mapper"));

interface PathPatternMapping {
  pattern: RegExp;
  target: string;
}

const PATH_PATTERNS: PathPatternMapping[] = [
  { pattern: /^\/walks/i, target: "walks" },
  { pattern: /^\/programme/i, target: "walks" },
  { pattern: /^\/activities/i, target: "walks" },
  { pattern: /^\/gallery/i, target: "gallery" },
  { pattern: /^\/photos/i, target: "gallery" },
  { pattern: /^\/contact/i, target: "contact-us" },
  { pattern: /^\/about/i, target: "about-us" },
  { pattern: /^\/events/i, target: "social-events" },
  { pattern: /^\/social/i, target: "social-events" },
  { pattern: /^\/news/i, target: "news" },
  { pattern: /^\/join/i, target: "join-us" },
  { pattern: /^\/members/i, target: "members" },
];

function extractLastPathSegment(urlPath: string): string {
  const segments = urlPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "";
  }
  const lastSegment = segments[segments.length - 1];
  return lastSegment.replace(/\.[^.]+$/, "");
}

function tokenise(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(token => token.length > 2);
}

function tokenSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = tokensA.filter(token => setB.has(token));
  const union = new Set([...setA, ...setB]);
  return intersection.length / union.size;
}

export async function autoMapLegacyUrls(legacyDomain: string): Promise<AutoMapResult> {
  debugLog(`starting auto-map for domain: ${legacyDomain}`);
  const unmappedUrls = await legacyUrlMapping.find({
    legacyDomain,
    confidence: RedirectConfidence.UNMAPPED
  }).lean();

  if (unmappedUrls.length === 0) {
    debugLog("no unmapped URLs found");
    return { total: 0, high: 0, medium: 0, low: 0, unmapped: 0 };
  }

  const allPageContents = await pageContent.find({}, { path: 1 }).lean();
  const pagePaths: string[] = allPageContents
    .map((p: any) => p.path)
    .filter(Boolean);

  const allEvents = await extendedGroupEvent.find(
    { "groupEvent.url": { $exists: true, $ne: null } },
    { "groupEvent.url": 1, "groupEvent.title": 1 }
  ).lean();

  const eventUrls = new Map<string, string>();
  allEvents.forEach((event: any) => {
    const url = event.groupEvent?.url;
    const title = event.groupEvent?.title;
    if (url) {
      eventUrls.set(url.toLowerCase(), url);
      if (title) {
        eventUrls.set(convertTitleToSlug(title), url);
      }
    }
  });

  const pagePathSet = new Map<string, string>();
  pagePaths.forEach(p => {
    pagePathSet.set(p.toLowerCase(), p);
  });

  const result: AutoMapResult = { total: unmappedUrls.length, high: 0, medium: 0, low: 0, unmapped: 0 };
  const now = dateTimeNowAsValue();

  const bulkOps = unmappedUrls.map((mapping: any) => {
    const legacyPath = mapping.legacyPath || "";
    const lastSegment = extractLastPathSegment(legacyPath);
    const slug = convertTitleToSlug(lastSegment);

    let targetPath: string | null = null;
    let confidence = RedirectConfidence.UNMAPPED;
    let matchMethod: RedirectMatchMethod | null = null;

    const eventMatch = eventUrls.get(slug) || eventUrls.get(lastSegment.toLowerCase());
    if (eventMatch) {
      targetPath = `walks/${lastItemFrom(eventMatch)}`;
      confidence = RedirectConfidence.HIGH;
      matchMethod = RedirectMatchMethod.WALK_URL;
    }

    if (!targetPath && slug) {
      const pageMatch = pagePathSet.get(slug) || pagePathSet.get(lastSegment.toLowerCase());
      if (pageMatch) {
        targetPath = pageMatch.replace(/^\/+/, "");
        confidence = RedirectConfidence.HIGH;
        matchMethod = RedirectMatchMethod.SLUG;
      }
    }

    if (!targetPath && mapping.title) {
      const titleTokens = tokenise(mapping.title);
      let bestSimilarity = 0;
      let bestPath = "";

      pagePaths.forEach(p => {
        const pathTokens = tokenise(p.replace(/-/g, " "));
        const similarity = tokenSimilarity(titleTokens, pathTokens);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestPath = p;
        }
      });

      allEvents.forEach((event: any) => {
        const eventTitle = event.groupEvent?.title;
        if (eventTitle) {
          const eventTokens = tokenise(eventTitle);
          const similarity = tokenSimilarity(titleTokens, eventTokens);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestPath = `walks/${lastItemFrom(event.groupEvent.url) || convertTitleToSlug(eventTitle)}`;
          }
        }
      });

      if (bestSimilarity > 0.7) {
        targetPath = bestPath.replace(/^\/+/, "");
        confidence = RedirectConfidence.MEDIUM;
        matchMethod = RedirectMatchMethod.TITLE;
      }
    }

    if (!targetPath) {
      const patternMatch = PATH_PATTERNS.find(p => p.pattern.test(legacyPath));
      if (patternMatch) {
        targetPath = patternMatch.target;
        confidence = RedirectConfidence.MEDIUM;
        matchMethod = RedirectMatchMethod.PATTERN;
      }
    }

    if (confidence === RedirectConfidence.HIGH) {
      result.high += 1;
    } else if (confidence === RedirectConfidence.MEDIUM) {
      result.medium += 1;
    } else {
      result.unmapped += 1;
    }

    const updateFields: any = {
      confidence,
      updatedDate: now
    };
    if (targetPath) {
      updateFields.targetPath = targetPath;
    }
    if (matchMethod) {
      updateFields.matchMethod = matchMethod;
    }

    return {
      updateOne: {
        filter: { _id: mapping._id },
        update: { $set: updateFields }
      }
    };
  });

  if (bulkOps.length > 0) {
    await legacyUrlMapping.bulkWrite(bulkOps);
  }

  debugLog(`auto-map complete: ${JSON.stringify(result)}`);
  return result;
}
