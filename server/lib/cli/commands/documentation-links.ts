import { Command } from "commander";
import { writeFileSync } from "fs";
import mongoose from "mongoose";
import { isArray, isObject, isString, isEqual, toPairs } from "es-toolkit/compat";
import { PageContent, PageContentPatch } from "../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { DocumentationLinkChange, DocumentationLinkSweepOptions, DocumentationSweepReport } from "../../../../projects/ngx-ramblers/src/app/models/documentation-links.model";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { documentationSiteOrigin } from "../../../../projects/ngx-ramblers/src/app/functions/documentation-links";
import { fetchAllPages, login, queryPages, updatePageContent } from "../../shared/cms-client";
import { documentationFeaturePath, documentationMenuLinks, sweepDocumentationPage } from "../../documentation/documentation-link-sweep";
import { publicDocumentationSites } from "../../documentation/documentation-sites";
import { connect } from "../../mongo/mongoose-client";
import { dateTimeNow } from "../../shared/dates";
import { UIDateFormat } from "../../../../projects/ngx-ramblers/src/app/models/date-format.model";

function fragmentIds(value: unknown): string[] {
  if (isArray(value)) {
    return value.flatMap(fragmentIds);
  } else if (isObject(value)) {
    return toPairs(value).flatMap(([key, child]) => key === "pageContentId" && isString(child) ? [child] : fragmentIds(child));
  } else {
    return [];
  }
}

export function documentationPages(pages: PageContent[]): PageContent[] {
  const selected = new Set(pages.filter(page => page.path === "how-to" || page.path.startsWith("how-to/")).map(page => page.id));
  const addFragments = (page: PageContent): void => {
    fragmentIds(page).forEach(id => {
      const fragment = pages.find(candidate => candidate.id === id);
      if (fragment && !selected.has(id)) {
        selected.add(id);
        addFragments(fragment);
      }
    });
  };
  pages.filter(page => selected.has(page.id)).forEach(addFragments);
  return pages.filter(page => selected.has(page.id));
}

export async function sweepCmsDocumentation(options: DocumentationLinkSweepOptions): Promise<DocumentationSweepReport> {
  const auth = await login(options.url, process.env[Environment.CMS_USERNAME], process.env[Environment.CMS_PASSWORD]);
  const pages = await fetchAllPages(auth);
  await connect();
  const sites = await publicDocumentationSites();
  const context = {origins: [documentationSiteOrigin(options.url), ...sites.map(site => site.url)].filter(Boolean), menuLinks: documentationMenuLinks(pages)};
  const docs = documentationPages(pages);
  const proposed = docs.map(page => {
    const changes: DocumentationLinkChange[] = [];
    const updated = sweepDocumentationPage(page, context, changes);
    return {page, updated, changes};
  }).filter(item => item.changes.length);
  const unresolved = proposed.flatMap(item => item.changes.flatMap(change => {
    const candidates: string[] = change.after.match(/`[^`\n]*(?:\/admin\/|→)[^`\n]*`|\*\*[^*\n]*→[^*\n]*\*\*/g) || [];
    return candidates.filter(candidate => !documentationFeaturePath(candidate.replace(/^`|`$/g, ""), context))
      .map(candidate => ({field: `${item.page.path}:${change.field}`, before: candidate, after: candidate}));
  }));
  const report: DocumentationSweepReport = {
    url: options.url,
    pagesScanned: docs.length,
    changes: proposed.map(item => ({id: item.page.id, path: item.page.path, changes: item.changes})),
    unresolved
  };
  writeFileSync(options.report, JSON.stringify(report, null, 2));
  writeFileSync(`${options.report}.backup.json`, JSON.stringify(proposed.map(item => item.page), null, 2));
  proposed.forEach(item => {
    process.stdout.write(`\n${item.page.path}\n`);
    item.changes.forEach(change => process.stdout.write(`${change.field}\n- ${change.before}\n+ ${change.after}\n`));
  });
  process.stdout.write(`\nScanned ${docs.length} documentation pages; ${proposed.length} pages need updates. Report: ${options.report}\n`);
  if (options.apply) {
    for (const item of proposed) {
      const currentPages = await queryPages(auth, {criteria: {path: {$eq: item.page.path}}});
      const current = currentPages.find(page => page.id === item.page.id);
      if (!isEqual(current, item.page)) {
        throw new Error(`Content changed during the sweep: ${item.page.path}. Re-run the preview before applying.`);
      } else {
        const patch: PageContentPatch = item.changes.reduce((fields, change) => ({...fields, [change.field.replace(/\[(\d+)\]/g, ".$1")]: change.after}), {path: item.page.path});
        await updatePageContent(auth, item.page.id, patch);
        const savedPages = await queryPages(auth, {criteria: {path: {$eq: item.page.path}}});
        const saved = savedPages.find(page => page.id === item.page.id);
        if (!isEqual(saved?.rows, item.updated.rows)) {
          throw new Error(`Saved content did not match the proposed update: ${item.page.path}`);
        }
        process.stdout.write(`Updated and verified ${item.page.path}\n`);
      }
    }
  }
  return report;
}

export function createDocumentationLinksCommand(): Command {
  return new Command("documentation-links")
    .description("Preview or apply website-aware links throughout CMS documentation and its shared fragments")
    .requiredOption("--url <url>", "CMS website to audit")
    .option("--report <file>", "JSON report and original page backup", `documentation-links-${dateTimeNow().toFormat(UIDateFormat.FILE_TIMESTAMP_COMPACT)}.json`)
    .option("--apply", "apply changes with valid fallback destinations and a backup of the original pages", false)
    .action(async (options: DocumentationLinkSweepOptions) => {
      try {
        await sweepCmsDocumentation(options);
      } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
      } finally {
        await mongoose.connection.close();
      }
    });
}
