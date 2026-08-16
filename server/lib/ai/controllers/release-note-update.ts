import { NextFunction, Request, Response } from "express";
import debugLib from "debug";
import { isArray, isBoolean, isNumber, isString, values } from "es-toolkit/compat";
import { envConfig } from "../../env-config/env-config";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { systemConfig } from "../../config/system-config";
import { publicSitePaths } from "../../mongo/controllers/site-search";
import { pageContent } from "../../mongo/models/page-content";
import { PageContent } from "../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { ReleaseNoteUpdateCandidate, ReleaseNoteUpdateDraftOutcome, ReleaseNoteUpdateRequest } from "../../../../projects/ngx-ramblers/src/app/models/ai.model";
import { ReleaseNoteUpdateCategory, ReleaseNoteUpdateCoverage, ReleaseNoteUpdateScope } from "../../../../projects/ngx-ramblers/src/app/models/email-composer.model";
import { defaultReleaseNoteUpdateDefaults } from "../../../../projects/ngx-ramblers/src/app/functions/email-composer";
import { absolutiseMarkdownLinks, publicImagesFromRows, publicMarkdownFromRows } from "../../content-export/content-export-renderer";
import {
  absoluteUrl,
  parseReleaseEntriesFromMarkdown,
  siteContentPaths
} from "../../content-export/ai-discovery";
import {
  isCuratedReleaseNote,
  isUnassignedCommitDump,
  releaseNoteDateFromPath,
  selectReleaseNoteUpdateCandidates
} from "../../../../projects/ngx-ramblers/src/app/functions/release-note-update-candidates";
import { dateTimeFromMillis, dateTimeNowAsValue, formatDateTime } from "../../shared/dates";
import { UIDateFormat } from "../../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { aiConfigFromEnvironment } from "../ai-config";
import { generate } from "../ai-generation";
import {
  buildReleaseNoteUpdateInput,
  buildReleaseNoteUpdateRetryInput,
  emptyReleaseNoteUpdateDraft,
  MAX_RELEASE_NOTE_UPDATE_GENERATED_TOKENS,
  RELEASE_NOTE_UPDATE_RETRY_PROMPT,
  RELEASE_NOTE_UPDATE_SYSTEM_PROMPT,
  parseReleaseNoteUpdateDraft,
  quietEmptyIntro,
  truncateExcerpt
} from "../release-note-update";

const debug = debugLib(envConfig.logNamespace("ai:release-note-update"));
debug.enabled = true;

export function requireReleaseNoteUpdatePlatformAdmin(_req: Request, res: Response, next: NextFunction): void {
  if (envConfig.booleanValue(Environment.PLATFORM_ADMIN_ENABLED)) {
    next();
  } else {
    res.status(404).json({request: {}, error: "Release note updates are only available on the platform admin site"});
  }
}

async function siteIdentity(): Promise<{ siteName: string; baseUrl: string } | null> {
  const config = await systemConfig();
  const baseUrl = (config?.group?.href || "").replace(/\/+$/, "");
  const siteName = config?.group?.longName || config?.group?.shortName;
  return baseUrl && siteName ? {siteName, baseUrl} : null;
}

async function pageMarkdownForPath(path: string, baseUrl: string): Promise<string> {
  const page = await pageForPath(path);
  return page ? absolutiseMarkdownLinks(publicMarkdownFromRows(page.rows), baseUrl) : "";
}

async function pageForPath(path: string): Promise<PageContent | null> {
  return await pageContent.findOne({path}).lean().exec() as PageContent
    || await pageContent.findOne({path: path.toLowerCase()}).lean().exec() as PageContent
    || null;
}

async function candidatesInWindow(fromMillis: number,
                                  toMillis: number,
                                  previouslyIncludedPaths: string[],
                                  includeImages: boolean): Promise<{
  identity: { siteName: string; baseUrl: string };
  indexPath: string;
  indexUrl: string;
  candidates: ReleaseNoteUpdateCandidate[];
} | { missing: string }> {
  const identity = await siteIdentity();
  if (!identity) {
    return {missing: "Site is not configured"};
  } else {
    const availablePaths = (await publicSitePaths()) || [];
    const content = siteContentPaths(availablePaths);
    if (!content.releaseNotesIndexPath) {
      return {missing: "Release notes are not published on this site"};
    } else {
      const listPath = content.releaseNotesIndexPath;
      const markdown = await pageMarkdownForPath(listPath, identity.baseUrl);
      const parsed = parseReleaseEntriesFromMarkdown(markdown, listPath);
      const dated = parsed.map(entry => ({
        title: entry.title,
        path: entry.path,
        url: absoluteUrl(identity.baseUrl, entry.path),
        dateMillis: releaseNoteDateFromPath(entry.path),
        excerpt: "",
        hasImages: entry.hasImages
      }));
      const inWindow = selectReleaseNoteUpdateCandidates(dated, fromMillis, toMillis, previouslyIncludedPaths)
        .filter(candidate => !isUnassignedCommitDump(candidate.path));
      const loaded = await Promise.all(inWindow.map(async candidate => {
        const page = await pageForPath(candidate.path);
        const markdown = page ? absolutiseMarkdownLinks(publicMarkdownFromRows(page.rows), identity.baseUrl) : "";
        const images = page ? publicImagesFromRows(page.rows, identity.baseUrl) : [];
        return {candidate, markdown, images};
      }));
      const selected = loaded
        .filter(item => isCuratedReleaseNote(item.candidate.path, item.markdown, item.candidate.hasImages === true))
        .map(item => ({
          ...item.candidate,
          excerpt: truncateExcerpt(item.markdown),
          images: includeImages ? item.images : []
        }));
      return {
        identity,
        indexPath: listPath,
        indexUrl: absoluteUrl(identity.baseUrl, listPath),
        candidates: selected
      };
    }
  }
}

function periodDescription(fromMillis: number, toMillis: number): string {
  return `${formatDateTime(dateTimeFromMillis(fromMillis), UIDateFormat.DISPLAY_DATE_NO_DAY)} to ${formatDateTime(dateTimeFromMillis(toMillis), UIDateFormat.DISPLAY_DATE_NO_DAY)}`;
}

export async function draftReleaseNoteUpdate(req: Request, res: Response): Promise<void> {
  const defaults = defaultReleaseNoteUpdateDefaults();
  const requestedCategories = isArray(req.body?.categories)
    ? req.body.categories.filter(category => values(ReleaseNoteUpdateCategory).includes(category))
    : req.body?.scope === ReleaseNoteUpdateScope.EMAIL_ONLY
      ? [ReleaseNoteUpdateCategory.EMAIL]
      : req.body?.scope === ReleaseNoteUpdateScope.NON_EMAIL_ONLY
        ? [ReleaseNoteUpdateCategory.NON_EMAIL]
        : defaults.categories;
  const request: ReleaseNoteUpdateRequest = {
    fromMillis: isNumber(req.body?.fromMillis) ? req.body.fromMillis : dateTimeNowAsValue(),
    toMillis: isNumber(req.body?.toMillis) ? req.body.toMillis : dateTimeNowAsValue(),
    previouslyIncludedPaths: isArray(req.body?.previouslyIncludedPaths) ? req.body.previouslyIncludedPaths : [],
    guidance: req.body?.guidance,
    groupName: req.body?.groupName,
    categories: requestedCategories.length > 0 ? requestedCategories : defaults.categories,
    coverage: values(ReleaseNoteUpdateCoverage).includes(req.body?.coverage) ? req.body.coverage : defaults.coverage,
    maximumThemes: isNumber(req.body?.maximumThemes) && req.body.maximumThemes > 0 ? Math.min(req.body.maximumThemes, 20) : defaults.maximumThemes,
    maximumSourcesPerTheme: isNumber(req.body?.maximumSourcesPerTheme) && req.body.maximumSourcesPerTheme > 0 ? Math.min(req.body.maximumSourcesPerTheme, 30) : defaults.maximumSourcesPerTheme,
    writingRules: isString(req.body?.writingRules) && req.body.writingRules.trim() ? req.body.writingRules.trim() : defaults.writingRules,
    includeTechnicalChanges: isBoolean(req.body?.includeTechnicalChanges) ? req.body.includeTechnicalChanges : defaults.includeTechnicalChanges,
    includeImages: isBoolean(req.body?.includeImages) ? req.body.includeImages : defaults.includeImages
  };
  try {
    const assembled = await candidatesInWindow(request.fromMillis, request.toMillis, request.previouslyIncludedPaths ?? [], request.includeImages);
    if ("missing" in assembled) {
      res.status(404).json({request: {}, error: assembled.missing});
    } else {
      debug("release-note images", {
        enabled: request.includeImages,
        releaseNotes: assembled.candidates.length,
        releaseNotesWithImages: assembled.candidates.filter(candidate => (candidate.images ?? []).length > 0).length,
        images: assembled.candidates.reduce((count, candidate) => count + (candidate.images ?? []).length, 0)
      });
      const emptyWindow = assembled.candidates.length === 0;
      const ai = aiConfigFromEnvironment();
      if (emptyWindow) {
        res.json({
          request: {},
          response: {
            candidates: assembled.candidates,
            draft: emptyReleaseNoteUpdateDraft(assembled.indexPath, assembled.indexUrl, quietEmptyIntro()),
            emptyWindow,
            drafted: false,
            draftOutcome: ReleaseNoteUpdateDraftOutcome.GENERATED
          }
        });
      } else if (!ai.enabled) {
        res.status(503).json({request: {}, error: "AI drafting is not enabled for this environment. The update has been left unchanged."});
      } else {
        try {
          const input = buildReleaseNoteUpdateInput(
            assembled.candidates,
            periodDescription(request.fromMillis, request.toMillis),
            request.groupName ?? assembled.identity.siteName,
            request.guidance ?? null,
            request
          );
          const output = await generate(ai, RELEASE_NOTE_UPDATE_SYSTEM_PROMPT, input, MAX_RELEASE_NOTE_UPDATE_GENERATED_TOKENS);
          const firstDraft = parseReleaseNoteUpdateDraft(output, assembled.candidates, assembled.indexPath, assembled.indexUrl, request.maximumThemes, request.maximumSourcesPerTheme, request.categories);
          if (!firstDraft) {
            debug("first response could not be parsed:", output);
          }
          const retryOutput = firstDraft
            ? null
            : await generate(ai, RELEASE_NOTE_UPDATE_RETRY_PROMPT, buildReleaseNoteUpdateRetryInput(
              assembled.candidates,
              periodDescription(request.fromMillis, request.toMillis),
              output,
              request.maximumThemes,
              request.maximumSourcesPerTheme
            ), MAX_RELEASE_NOTE_UPDATE_GENERATED_TOKENS);
          const draft = firstDraft ?? parseReleaseNoteUpdateDraft(retryOutput ?? "", assembled.candidates, assembled.indexPath, assembled.indexUrl, request.maximumThemes, request.maximumSourcesPerTheme, request.categories);
          if (!draft && retryOutput) {
            debug("retry response could not be parsed:", retryOutput);
          }
          if (draft) {
            debug("draft images", {items: draft.items.length, itemsWithImages: draft.items.filter(item => !!item.image).length});
            res.json({
              request: {},
              response: {
                candidates: assembled.candidates,
                draft,
                emptyWindow,
                drafted: true,
                draftOutcome: ReleaseNoteUpdateDraftOutcome.GENERATED
              }
            });
          } else {
            res.status(502).json({request: {}, error: "The drafting service returned an unreadable response twice. The update has been left unchanged."});
          }
        } catch (error) {
          debug("release-note-update error:", error);
          res.status(502).json({request: {}, error: error?.message || String(error)});
        }
      }
    }
  } catch (error) {
    debug("release-note-update load error:", error);
    res.status(500).json({request: {}, error: error?.message || String(error)});
  }
}
