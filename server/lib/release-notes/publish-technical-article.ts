#!/usr/bin/env tsx
import debug from "debug";
import * as fs from "fs";
import * as path from "path";
import { envConfig } from "../env-config/env-config";
import { dateTimeFromObject } from "../shared/dates";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { login, createOrUpdatePageContent, pageContent } from "./cms-client.js";
import { DEFAULT_CMS_BASE_URL } from "./models.js";
import { PageContent, PageContentType, PageContentColumn } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";

const debugLog = debug(envConfig.logNamespace("release-notes:publish-article"));
debugLog.enabled = true;

const INDEX_PATH = "how-to/technical-articles";

function extractInfoFromFilename(filename: string): { slug: string; formattedDate: string } | null {
  const basename = path.basename(filename, path.extname(filename));
  const dateMatch = basename.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!dateMatch) {
    return null;
  }

  const [, year, month, day] = dateMatch;
  const date = dateTimeFromObject({ year: parseInt(year, 10), month: parseInt(month, 10), day: parseInt(day, 10) });
  const formattedDate = date.toFormat(UIDateFormat.DAY_MONTH_YEAR_DASHED);

  return { slug: basename, formattedDate };
}

function extractTitleFromMarkdown(content: string): string | null {
  const headingMatch = content.match(/^#\s+(.+?)(?:\s*\[|$)/m);
  if (headingMatch) {
    return headingMatch[1].replace(/^\d{1,2}-[A-Za-z]{3}-\d{4}\s*[—–-]\s*/, "").trim();
  }
  return null;
}

async function main() {
  const markdownFile = process.argv[2];

  if (!markdownFile) {
    debugLog("Error: Markdown file path is required");
    debugLog("Usage: npx tsx lib/release-notes/publish-technical-article.ts <markdown-file>");
    debugLog("Example: npx tsx lib/release-notes/publish-technical-article.ts ../non-vcs/technical-articles/2026-01-29-article.md");
    process.exit(1);
  }

  const cmsUrl = process.env.CMS_URL || DEFAULT_CMS_BASE_URL;
  const username = process.env.CMS_USERNAME;
  const password = process.env.CMS_PASSWORD;

  if (!username || !password) {
    debugLog("Error: CMS_USERNAME and CMS_PASSWORD environment variables are required");
    debugLog("Usage: CMS_USERNAME=user CMS_PASSWORD=pass npx tsx lib/release-notes/publish-technical-article.ts <file>");
    process.exit(1);
  }

  const resolvedPath = path.resolve(markdownFile);
  if (!fs.existsSync(resolvedPath)) {
    debugLog(`Error: File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const markdownContent = fs.readFileSync(resolvedPath, "utf-8");
  const fileInfo = extractInfoFromFilename(markdownFile);

  if (!fileInfo) {
    debugLog("Error: Filename must start with a date in YYYY-MM-DD format");
    debugLog("Example: 2026-01-29-my-article.md");
    process.exit(1);
  }

  const articleTitle = extractTitleFromMarkdown(markdownContent);
  if (!articleTitle) {
    debugLog("Error: Could not extract title from markdown. Ensure it starts with a # heading");
    process.exit(1);
  }

  const articlePath = `${INDEX_PATH}/${fileInfo.slug}`;

  debugLog(`Article: ${articleTitle}`);
  debugLog(`Date: ${fileInfo.formattedDate}`);
  debugLog(`Path: ${articlePath}`);

  debugLog(`Logging into CMS at ${cmsUrl}...`);
  const auth = await login(cmsUrl, username, password);
  debugLog("Login successful");

  const articlePage: PageContent = {
    path: articlePath,
    rows: [
      {
        type: PageContentType.TEXT,
        showSwiper: false,
        maxColumns: 1,
        columns: [
          {
            contentText: markdownContent,
            columns: 12
          } as PageContentColumn
        ]
      }
    ]
  };

  debugLog(`Publishing article to ${articlePath}...`);
  await createOrUpdatePageContent(auth, articlePage);
  debugLog("Article published successfully");

  debugLog(`Updating index page at ${INDEX_PATH}...`);
  const indexPage = await pageContent(auth, INDEX_PATH);

  if (indexPage && indexPage.rows?.length > 0) {
    const textRow = indexPage.rows.find(row => row.type === PageContentType.TEXT);
    if (textRow && textRow.columns?.length > 0) {
      const column = textRow.columns[0];
      const currentContent = column.contentText || "";

      const newEntry = `- [${fileInfo.formattedDate} — ${articleTitle}](/${articlePath})`;

      if (!currentContent.includes(articlePath)) {
        const lines = currentContent.split("\n");
        const firstEntryIndex = lines.findIndex(line => line.trim().startsWith("- ["));

        if (firstEntryIndex >= 0) {
          lines.splice(firstEntryIndex, 0, newEntry);
          column.contentText = lines.join("\n");
        } else {
          column.contentText = currentContent + "\n\n" + newEntry;
        }

        await createOrUpdatePageContent(auth, indexPage);
        debugLog("Index page updated");
      } else {
        debugLog("Article already in index");
      }
    }
  }

  console.log(`Published: ${cmsUrl}/${articlePath}`);
}

main().catch(error => {
  debugLog("Error:", error.message);
  process.exit(1);
});
