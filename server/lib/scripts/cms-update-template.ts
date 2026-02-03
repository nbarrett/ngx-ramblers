import debug from "debug";
import * as cmsClient from "../release-notes/cms-client";
import type { PageContent, PageContentRow, PageContentColumn } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("cms-update"));
debugLog.enabled = true;

interface UpdateConfig {
  paths?: string[];
  pathPattern?: string;
  dryRun?: boolean;
  baseUrl?: string;
}

interface TransformResult {
  modified: boolean;
  changes: string[];
}

async function updatePages(
  config: UpdateConfig,
  transformPage: (pageContent: PageContent) => Promise<TransformResult>
) {
  const baseUrl = config.baseUrl || process.env.CMS_BASE_URL || "http://localhost:5001";
  const username = process.env.CMS_USERNAME;
  const password = process.env.CMS_PASSWORD;

  if (!username || !password) {
    debugLog("CMS_USERNAME and CMS_PASSWORD environment variables must be set");
    process.exit(1);
  }

  try {
    const auth = await cmsClient.login(baseUrl, username, password);
    debugLog("✓ Authenticated with CMS");

    const paths = config.paths || [];
    let totalUpdated = 0;

    for (const path of paths) {
      debugLog(`\nProcessing: ${path}`);

      const pageContent = await cmsClient.pageContent(auth, path);

      if (!pageContent) {
        debugLog(`  ✗ Page not found: ${path}`);
        continue;
      }

      debugLog(`  ✓ Found page (${pageContent.rows?.length || 0} rows)`);

      const result = await transformPage(pageContent);

      if (result.modified) {
        debugLog(`  Changes detected:`);
        result.changes.forEach(change => debugLog(`    - ${change}`));

        if (config.dryRun) {
          debugLog(`  [DRY RUN] Would update page`);
        } else {
          await cmsClient.updatePageContent(auth, pageContent.id!, pageContent);
          debugLog(`  ✓ Updated page`);
          totalUpdated++;
        }
      } else {
        debugLog(`  No changes needed`);
      }
    }

    debugLog(`\n${config.dryRun ? "[DRY RUN] " : ""}Summary: ${totalUpdated}/${paths.length} pages updated`);

  } catch (error: any) {
    debugLog(`✗ Error: ${error.message}`);
    process.exit(1);
  }
}

function forEachColumn(
  pageContent: PageContent,
  callback: (column: PageContentColumn, row: PageContentRow, rowIndex: number, columnIndex: number) => void
): void {
  pageContent.rows?.forEach((row, rowIndex) => {
    row.columns?.forEach((column, columnIndex) => {
      callback(column, row, rowIndex, columnIndex);

      if (column.rows) {
        column.rows.forEach(nestedRow => {
          nestedRow.columns?.forEach(nestedColumn => {
            callback(nestedColumn, nestedRow, rowIndex, columnIndex);
          });
        });
      }
    });
  });
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function replaceMarkdownLinks(
  text: string,
  replacer: (linkText: string, url: string) => { newText: string; transformed: boolean }
): { result: string; replacements: number } {
  let result = text;
  let replacements = 0;

  const linkMatches = Array.from(text.matchAll(/\[([^\]]+)\]\(([^\)]+)\)/g));

  for (const match of linkMatches) {
    const [fullMatch, linkText, url] = match;
    const replacement = replacer(linkText, url);

    if (replacement.transformed) {
      result = result.replace(fullMatch, replacement.newText);
      replacements++;
    }
  }

  return { result, replacements };
}

export {
  updatePages,
  forEachColumn,
  extractYouTubeId,
  replaceMarkdownLinks,
  TransformResult,
  UpdateConfig,
  PageContent,
  PageContentRow,
  PageContentColumn
};
