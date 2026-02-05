import { Command } from "commander";
import debug from "debug";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { log, error as logError } from "../cli-logger";
import { select, input, confirm, isQuit, isBack, handleQuit, PromptResult } from "../cli-prompt";
import { envConfig } from "../../env-config/env-config";
import {
  ReconciliationConfig,
  ReconciliationPage,
  NgxPage,
  NgxWalk,
  ReconciliationGap,
  ReconciliationResult,
  ReconciliationSuggestion
} from "../../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";

const debugLog = debug(envConfig.logNamespace("cli:migrate"));

const turndown = new TurndownService({ headingStyle: "atx" });

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/database/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: username, password })
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data.tokens?.auth) {
    throw new Error("No auth token in response");
  }

  return data.tokens.auth;
}

async function fetchOldSite(baseUrl: string): Promise<ReconciliationPage[]> {
  log(`Scraping old site: ${baseUrl}`);
  const pages: ReconciliationPage[] = [];

  const homeResponse = await fetch(baseUrl);
  if (!homeResponse.ok) {
    throw new Error(`Failed to fetch ${baseUrl}: ${homeResponse.status}`);
  }

  const homeHtml = await homeResponse.text();
  const dom = new JSDOM(homeHtml);
  const doc = dom.window.document;

  const navLinks = new Set<string>();
  navLinks.add(baseUrl);

  doc.querySelectorAll("nav a, .nav a, .menu a, header a").forEach((el: Element) => {
    const href = (el as HTMLAnchorElement).href;
    if (href && href.startsWith(baseUrl)) {
      navLinks.add(href);
    } else if (href && !href.startsWith("http") && !href.startsWith("#") && !href.startsWith("mailto:")) {
      navLinks.add(new URL(href, baseUrl).href);
    }
  });

  log(`Found ${navLinks.size} navigation links`);

  for (const url of navLinks) {
    try {
      log(`  Scraping: ${url}`);
      const response = await fetch(url);
      if (!response.ok) continue;

      const html = await response.text();
      const pageDom = new JSDOM(html);
      const pageDoc = pageDom.window.document;

      const mainContent = pageDoc.querySelector("main, article, .content, #content, body");
      const textContent = mainContent?.textContent?.trim() || "";
      const htmlContent = mainContent?.innerHTML || "";

      let markdown = "";
      try {
        markdown = turndown.turndown(htmlContent);
      } catch (e) {
        markdown = textContent;
      }

      const images: string[] = [];
      mainContent?.querySelectorAll("img").forEach(img => {
        const src = img.getAttribute("src");
        if (src) images.push(src.startsWith("http") ? src : new URL(src, url).href);
      });

      const links: string[] = [];
      mainContent?.querySelectorAll("a").forEach(a => {
        const href = a.getAttribute("href");
        if (href && !href.startsWith("#")) links.push(href);
      });

      const path = url.replace(baseUrl, "").replace(/^\//, "") || "home";
      const title = pageDoc.querySelector("title")?.textContent?.trim() || path;

      pages.push({
        path,
        url,
        title,
        type: detectPageType(path, title),
        textContent,
        markdown,
        images,
        links
      });
    } catch (err: any) {
      log(`  ⚠ Failed to scrape ${url}: ${err.message}`);
    }
  }

  return pages;
}

function detectPageType(path: string, title: string): string {
  const combined = `${path} ${title}`.toLowerCase();
  if (path === "home" || path === "" || path === "index.html") return "home";
  if (combined.includes("about")) return "about";
  if (combined.includes("news")) return "news";
  if (combined.includes("walk") || combined.includes("ramble")) return "walks";
  if (combined.includes("gallery") || combined.includes("photo") || combined.includes("album")) return "gallery";
  if (combined.includes("contact")) return "contact";
  if (combined.includes("footpath") || combined.includes("maintenance")) return "footpath";
  return "other";
}

async function fetchNewSitePages(baseUrl: string): Promise<NgxPage[]> {
  log(`Fetching pages from new site: ${baseUrl}`);

  const response = await fetch(`${baseUrl}/api/database/page-content/all`, {
    headers: { "Content-Type": "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pages: ${response.status}`);
  }

  const data = await response.json();
  const pages = data.response || data || [];

  log(`Found ${pages.length} pages on new site`);
  return pages.map((p: any) => ({
    id: p.id || p._id,
    path: p.path,
    rows: p.rows || []
  }));
}

async function fetchNewSiteWalks(baseUrl: string): Promise<NgxWalk[]> {
  log(`Fetching walks from new site`);

  const response = await fetch(`${baseUrl}/api/database/group-event/all`, {
    headers: { "Content-Type": "application/json" }
  });

  if (!response.ok) {
    log(`⚠ Failed to fetch walks: ${response.status}`);
    return [];
  }

  const data = await response.json();
  const walks = data.response || data || [];

  log(`Found ${walks.length} walks`);
  return walks.map((w: any) => ({
    id: w.id || w._id,
    title: w.groupEvent?.title || w.title || "",
    eventDate: w.groupEvent?.start_date_time || w.eventDate || ""
  }));
}

function reconcile(oldPages: ReconciliationPage[], newPages: NgxPage[], walks: NgxWalk[]): ReconciliationResult {
  const gaps: ReconciliationGap[] = [];
  const suggestions: ReconciliationSuggestion[] = [];
  const newPaths = new Set(newPages.map(p => p.path.toLowerCase()));

  const pageTypeMapping: Record<string, string[]> = {
    home: ["home", "#home-content"],
    about: ["about-us", "about"],
    news: ["news"],
    walks: ["walks", "walks/information"],
    gallery: ["gallery"],
    contact: ["contact-us", "about-us/contact-us", "contact"],
    footpath: ["footpath-maintenance", "about-us/footpath-maintenance"]
  };

  oldPages.forEach(oldPage => {
    const possiblePaths = pageTypeMapping[oldPage.type] || [oldPage.path.toLowerCase()];
    const found = possiblePaths.some(p => newPaths.has(p));

    if (!found) {
      gaps.push({
        type: "page",
        oldPath: oldPage.path,
        description: `${oldPage.type} page "${oldPage.title}" not found on new site`,
        priority: oldPage.type === "home" || oldPage.type === "about" ? "high" : "medium"
      });

      const suggestedPath = possiblePaths[0] || oldPage.path.toLowerCase().replace(/\.html?$/, "");
      suggestions.push({
        action: "create",
        path: suggestedPath,
        description: `Create ${oldPage.type} page from "${oldPage.title}"`
      });
    }
  });

  const oldWithGallery = oldPages.filter(p => p.type === "gallery" || p.images.length > 5);
  oldWithGallery.forEach(page => {
    const hasAlbum = newPages.some(np => np.path.startsWith("gallery/") && np.rows.some(r => r.type === "album"));
    if (!hasAlbum && page.images.length > 3) {
      gaps.push({
        type: "album",
        oldPath: page.path,
        description: `${page.images.length} images detected that could be an album`,
        priority: "low"
      });
    }
  });

  return { oldPages, newPages, walks, gaps, suggestions };
}

function printReport(result: ReconciliationResult): void {
  log("\n" + "=".repeat(60));
  log("SITE RECONCILIATION REPORT");
  log("=".repeat(60));

  log(`\nOld site pages scraped: ${result.oldPages.length}`);
  result.oldPages.forEach(p => {
    log(`  - ${p.path} (${p.type})`);
  });

  log(`\nNew site pages: ${result.newPages.length}`);
  log(`New site walks: ${result.walks.length}`);

  if (result.gaps.length === 0) {
    log("\n✓ No gaps found - sites appear to be in sync!");
  } else {
    log(`\n⚠ Found ${result.gaps.length} gaps:`);
    result.gaps.forEach(gap => {
      const icon = gap.priority === "high" ? "🔴" : gap.priority === "medium" ? "🟡" : "🟢";
      log(`  ${icon} [${gap.type}] ${gap.description}`);
    });
  }

  if (result.suggestions.length > 0) {
    log("\nSuggestions:");
    result.suggestions.forEach((s, i) => {
      log(`  ${i + 1}. ${s.action.toUpperCase()}: ${s.path} - ${s.description}`);
    });
  }

  log("\n" + "=".repeat(60));
}

async function runReconcile(config: ReconciliationConfig): Promise<void> {
  try {
    const oldPages = await fetchOldSite(config.oldSiteUrl);
    const newPages = await fetchNewSitePages(config.newSiteUrl);
    const walks = await fetchNewSiteWalks(config.newSiteUrl);

    const result = reconcile(oldPages, newPages, walks);
    printReport(result);

    if (!config.dryRun && result.suggestions.length > 0 && config.username && config.password) {
      const shouldApply = await confirm("Would you like to apply the suggested changes?");
      if (isQuit(shouldApply) || isBack(shouldApply)) return;
      if (shouldApply) {
        log("\nApplying changes...");
        const authToken = await login(config.newSiteUrl, config.username, config.password);
        log("✓ Logged in successfully");
        log("TODO: Implement apply logic");
      }
    }
  } catch (err: any) {
    logError(`Migration failed: ${err.message}`);
    throw err;
  }
}

function extractStringResult(result: PromptResult<string>): string | null {
  if (isQuit(result) || isBack(result)) {
    return null;
  }
  return result;
}

async function runInteractive(): Promise<void> {
  log("\n🚀 NGX Ramblers Site Migration Tool\n");

  const oldSiteUrlResult = await input("Enter the old site URL:");
  if (isQuit(oldSiteUrlResult) || isBack(oldSiteUrlResult)) return handleQuit();
  const oldSiteUrl = oldSiteUrlResult;

  const newSiteUrlResult = await input("Enter the new NGX Ramblers site URL:");
  if (isQuit(newSiteUrlResult) || isBack(newSiteUrlResult)) return handleQuit();
  const newSiteUrl = newSiteUrlResult;

  const action = await select({
    message: "What would you like to do?",
    choices: [
      { name: "Reconcile - Compare sites and report gaps", value: "reconcile" },
      { name: "Apply - Create missing content (requires login)", value: "apply" }
    ]
  });
  if (isQuit(action) || isBack(action)) return handleQuit();

  const config: ReconciliationConfig = {
    oldSiteUrl: oldSiteUrl.replace(/\/$/, ""),
    newSiteUrl: newSiteUrl.replace(/\/$/, ""),
    dryRun: action === "reconcile"
  };

  if (action === "apply") {
    const usernameResult = await input("Username:");
    if (isQuit(usernameResult) || isBack(usernameResult)) return handleQuit();
    config.username = usernameResult;

    const passwordResult = await input("Password:");
    if (isQuit(passwordResult) || isBack(passwordResult)) return handleQuit();
    config.password = passwordResult;

    config.dryRun = false;
  }

  await runReconcile(config);
}

export function createMigrateCommand(): Command {
  const migrate = new Command("migrate")
    .description("Migrate content from an old site to NGX Ramblers");

  migrate
    .command("reconcile")
    .description("Compare old and new sites, report gaps")
    .requiredOption("--old <url>", "Old site URL")
    .requiredOption("--new <url>", "New NGX Ramblers site URL")
    .action(async (opts) => {
      await runReconcile({
        oldSiteUrl: opts.old.replace(/\/$/, ""),
        newSiteUrl: opts.new.replace(/\/$/, ""),
        dryRun: true
      });
    });

  migrate
    .command("apply")
    .description("Apply migration changes to new site")
    .requiredOption("--old <url>", "Old site URL")
    .requiredOption("--new <url>", "New NGX Ramblers site URL")
    .requiredOption("--username <user>", "CMS username")
    .requiredOption("--password <pass>", "CMS password")
    .option("--dry-run", "Preview changes without applying", false)
    .action(async (opts) => {
      await runReconcile({
        oldSiteUrl: opts.old.replace(/\/$/, ""),
        newSiteUrl: opts.new.replace(/\/$/, ""),
        username: opts.username,
        password: opts.password,
        dryRun: opts.dryRun
      });
    });

  migrate
    .command("interactive")
    .description("Run migration wizard interactively")
    .action(runInteractive);

  return migrate;
}
