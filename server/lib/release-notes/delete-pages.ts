import type { CMSAuth, PageToDelete } from "./models.js";
import { DEFAULT_CMS_BASE_URL } from "./models.js";
import * as cms from "./cms-client.js";
import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("release-notes:delete"));
debugLog.enabled = true;

const CMS_URL = process.env.CMS_URL || DEFAULT_CMS_BASE_URL;
const USERNAME = process.env.CMS_USERNAME || "";
const PASSWORD = process.env.CMS_PASSWORD || "";
const INDEX_PATH = "how-to/committee/release-notes";

const PAGES_TO_DELETE: PageToDelete[] = [
  {
    path: "how-to/committee/release-notes/2025-12-11",
    description: "11-Dec-2025 — #102 — Migration: 4 features"
  },
  {
    path: "how-to/committee/release-notes/2025-12-13",
    description: "13-Dec-2025 — #102 — improve loading UX, control toggles, and boolean handling"
  }
];

async function deletePage(auth: CMSAuth, pagePath: string): Promise<boolean> {
  try {
    const existing = await cms.pageContent(auth, pagePath);

    if (!existing || !existing.id) {
      debugLog(`Page not found: ${pagePath}`);
      return false;
    }

    debugLog(`Deleting page: ${pagePath} (id: ${existing.id})`);
    await cms.deletePageContent(auth, existing.id);
    debugLog(`Successfully deleted: ${pagePath}`);
    return true;
  } catch (error) {
    debugLog(`Error deleting ${pagePath}:`, error);
    return false;
  }
}

async function removeFromIndex(auth: CMSAuth, pathsToRemove: string[]): Promise<void> {
  try {
    const indexPage = await cms.pageContent(auth, INDEX_PATH);

    if (!indexPage || !indexPage.rows || indexPage.rows.length === 0) {
      debugLog("Index page not found or empty");
      return;
    }

    const textRow = indexPage.rows.find(row => row.type === "text");
    if (!textRow || !textRow.columns || textRow.columns.length === 0) {
      debugLog("No text row found in index page");
      return;
    }

    const column = textRow.columns[0];
    const currentContent = column.contentText || "";
    const lines = currentContent.split("\n");

    const filteredLines = lines.filter(line => {
      const match = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!match) {
        return true;
      }
      const path = match[2];
      const shouldRemove = pathsToRemove.some(toRemove => path.includes(toRemove));
      if (shouldRemove) {
        debugLog(`Removing from index: ${line.trim()}`);
      }
      return !shouldRemove;
    });

    column.contentText = filteredLines.join("\n");

    debugLog(`Updating index page...`);
    await cms.updatePageContent(auth, indexPage.id!, indexPage);
    debugLog(`Index page updated successfully`);
  } catch (error) {
    debugLog("Error updating index page:", error);
    throw error;
  }
}

async function main(): Promise<void> {
  if (!USERNAME || !PASSWORD) {
    throw new Error("Missing CMS_USERNAME or CMS_PASSWORD environment variables");
  }

  debugLog("Logging in to CMS...");
  const auth = await cms.login(CMS_URL, USERNAME, PASSWORD);
  debugLog("Login successful");

  debugLog(`\nDeleting ${PAGES_TO_DELETE.length} pages...`);

  const deletedPaths: string[] = [];
  for (const page of PAGES_TO_DELETE) {
    debugLog(`\n${page.description}`);
    debugLog(`  Path: ${page.path}`);
    const deleted = await deletePage(auth, page.path);
    if (deleted) {
      deletedPaths.push(page.path);
    }
  }

  if (deletedPaths.length > 0) {
    debugLog(`\nRemoving ${deletedPaths.length} entries from index page...`);
    await removeFromIndex(auth, deletedPaths);
  }

  debugLog(`\nDone! Deleted ${deletedPaths.length} of ${PAGES_TO_DELETE.length} pages`);
}

main().catch(error => {
  debugLog("Fatal error:", error);
  process.exit(1);
});
