import { Command } from "commander";
import debug from "debug";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { log, error as logError } from "../cli-logger";
import { dateTimeNow, dateTimeFromIso } from "../../shared/dates";
import { select, input, confirm, isQuit, isBack, handleQuit, PromptResult, checkbox } from "../cli-prompt";
import { envConfig } from "../../env-config/env-config";
import * as cms from "../../shared/cms-client";
import type { CMSAuth } from "../../shared/cms-client";
import type { PageContent, PageContentRow, PageContentColumn } from "../../../../projects/ngx-ramblers/src/app/models/content-text.model";
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

interface ApplyConfig extends ReconciliationConfig {
  authToken?: string;
}

interface WalkCategory {
  name: string;
  pattern: RegExp | ((walk: NgxWalk) => boolean);
  walks: NgxWalk[];
}

function textRow(markdown: string): PageContentRow {
  return {
    type: "text" as any,
    showSwiper: false,
    maxColumns: 12,
    columns: [{
      columns: 12,
      contentText: markdown,
      accessLevel: "public" as any
    }]
  };
}

function eventsRow(options: {
  fromDate?: number;
  toDate?: number;
  eventIds?: string[];
  sortOrder?: string;
}): PageContentRow {
  return {
    type: "events" as any,
    maxColumns: 2,
    showSwiper: false,
    columns: [{ columns: 12, accessLevel: "public" as any }],
    events: {
      fromDate: options.fromDate || null,
      toDate: options.toDate || null,
      filterCriteria: options.fromDate ? "DATE_RANGE" : "NONE",
      sortOrder: options.sortOrder || "DATE_ASCENDING",
      minColumns: 1,
      maxColumns: 2,
      eventTypes: ["group-walk"],
      eventIds: options.eventIds || [],
      allow: {
        quickSearch: false,
        pagination: false,
        alert: false,
        autoTitle: false,
        addNew: false
      }
    }
  } as any;
}

function actionButtonsRow(buttons: { title: string; href: string; description?: string }[]): PageContentRow {
  return {
    type: "action-buttons" as any,
    showSwiper: false,
    maxColumns: buttons.length,
    columns: buttons.map(btn => ({
      columns: Math.floor(12 / buttons.length),
      title: btn.title,
      href: btn.href,
      contentText: btn.description || "",
      accessLevel: "public" as any
    }))
  };
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

  doc.querySelectorAll("nav a, .nav a, .menu a, header a, .navbar a, #navbarNav a").forEach((el: Element) => {
    const href = (el as HTMLAnchorElement).getAttribute("href");
    if (href && href.startsWith(baseUrl)) {
      navLinks.add(href);
    } else if (href && !href.startsWith("http") && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("javascript:")) {
      navLinks.add(new URL(href, baseUrl).href);
    }
  });

  doc.querySelectorAll("a").forEach((el: Element) => {
    const href = (el as HTMLAnchorElement).getAttribute("href");
    if (href && (href.startsWith(baseUrl) || (!href.startsWith("http") && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("javascript:")))) {
      const fullUrl = href.startsWith("http") ? href : new URL(href, baseUrl).href;
      if (fullUrl.startsWith(baseUrl)) {
        navLinks.add(fullUrl);
      }
    }
  });

  log(`Found ${navLinks.size} links to scrape`);

  const urlsArray = Array.from(navLinks);
  await Promise.all(urlsArray.map(async (url, index) => {
    await new Promise(resolve => setTimeout(resolve, index * 100));

    try {
      log(`  [${index + 1}/${urlsArray.length}] Scraping: ${url}`);
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 NGX-Ramblers-Migration-Bot" }
      });
      if (!response.ok) {
        log(`  ⚠ Skipped ${url}: ${response.status}`);
        return;
      }

      const html = await response.text();
      const pageDom = new JSDOM(html);
      const pageDoc = pageDom.window.document;

      const mainContent = pageDoc.querySelector("main, article, .content, #content, .main-content, [role='main']") || pageDoc.body;
      const textContent = mainContent?.textContent?.trim() || "";
      const htmlContent = mainContent?.innerHTML || "";

      let markdown = "";
      try {
        markdown = turndown.turndown(htmlContent);
      } catch {
        markdown = textContent;
      }

      const images: string[] = [];
      mainContent?.querySelectorAll("img").forEach(img => {
        const src = img.getAttribute("src");
        if (src) {
          const fullSrc = src.startsWith("http") ? src : new URL(src, url).href;
          if (!images.includes(fullSrc)) {
            images.push(fullSrc);
          }
        }
      });

      const links: string[] = [];
      mainContent?.querySelectorAll("a").forEach(a => {
        const href = a.getAttribute("href");
        if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
          links.push(href);
        }
      });

      const path = url.replace(baseUrl, "").replace(/^\//, "").replace(/\.html?$/, "").replace(/\/$/, "") || "home";
      const title = pageDoc.querySelector("title")?.textContent?.trim() ||
                   pageDoc.querySelector("h1")?.textContent?.trim() ||
                   path;

      pages.push({
        path,
        url,
        title,
        type: detectPageType(path, title, textContent),
        textContent,
        markdown,
        images,
        links
      });
    } catch (err: any) {
      log(`  ⚠ Failed to scrape ${url}: ${err.message}`);
    }
  }));

  return pages;
}

function detectPageType(path: string, title: string, content?: string): string {
  const combined = `${path} ${title} ${content || ""}`.toLowerCase();
  if (path === "home" || path === "" || path === "index" || path === "index.html") return "home";
  if (combined.includes("about") && !combined.includes("walk")) return "about";
  if (combined.includes("news") || combined.includes("whats-new")) return "news";
  if (combined.includes("programme") || combined.includes("walk") || combined.includes("ramble")) return "walks";
  if (combined.includes("gallery") || combined.includes("photo") || combined.includes("album") || combined.includes("picture")) return "gallery";
  if (combined.includes("contact")) return "contact";
  if (combined.includes("footpath") || combined.includes("maintenance") || combined.includes("path")) return "footpath";
  if (combined.includes("member") || combined.includes("join")) return "membership";
  if (combined.includes("committee") || combined.includes("agm")) return "committee";
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
    eventDate: w.groupEvent?.start_date_time || w.eventDate || "",
    briefDescriptionAndStartPoint: w.briefDescriptionAndStartPoint,
    groupEvent: w.groupEvent
  }));
}

function categorizeWalks(walks: NgxWalk[]): WalkCategory[] {
  const categories: WalkCategory[] = [
    {
      name: "Longer Walks",
      pattern: (w) => {
        const title = (w.title || "").toLowerCase();
        const distance = w.groupEvent?.distance_miles || 0;
        return distance >= 8 || title.includes("longer") || title.includes("full day");
      },
      walks: []
    },
    {
      name: "Shorter Walks",
      pattern: (w) => {
        const title = (w.title || "").toLowerCase();
        const distance = w.groupEvent?.distance_miles || 0;
        return distance > 0 && distance < 8 || title.includes("shorter") || title.includes("short");
      },
      walks: []
    },
    {
      name: "Weekend Walks",
      pattern: (w) => {
        const weekday = dateTimeFromIso(w.eventDate).weekday;
        return weekday === 6 || weekday === 7;
      },
      walks: []
    },
    {
      name: "Midweek Walks",
      pattern: (w) => {
        const weekday = dateTimeFromIso(w.eventDate).weekday;
        return weekday >= 1 && weekday <= 5;
      },
      walks: []
    }
  ];

  walks.forEach(walk => {
    categories.forEach(cat => {
      if (typeof cat.pattern === "function" && cat.pattern(walk)) {
        cat.walks.push(walk);
      }
    });
  });

  return categories.filter(c => c.walks.length > 0);
}

function reconcile(oldPages: ReconciliationPage[], newPages: NgxPage[], walks: NgxWalk[]): ReconciliationResult {
  const gaps: ReconciliationGap[] = [];
  const suggestions: ReconciliationSuggestion[] = [];
  const newPaths = new Set(newPages.map(p => p.path.toLowerCase()));

  const pageTypeMapping: Record<string, string[]> = {
    home: ["home", "#home-content"],
    about: ["about-us", "about"],
    news: ["news"],
    walks: ["walks", "walks/information", "programme"],
    gallery: ["gallery"],
    contact: ["contact-us", "about-us/contact-us", "contact"],
    footpath: ["footpath-maintenance", "about-us/footpath-maintenance"],
    membership: ["membership", "join", "about-us/membership"],
    committee: ["committee", "about-us/committee"]
  };

  oldPages.forEach(oldPage => {
    const possiblePaths = pageTypeMapping[oldPage.type] || [oldPage.path.toLowerCase()];
    const found = possiblePaths.some(p => newPaths.has(p));

    if (!found && oldPage.type !== "other") {
      gaps.push({
        type: "page",
        oldPath: oldPage.path,
        description: `${oldPage.type} page "${oldPage.title}" not found on new site`,
        priority: oldPage.type === "home" || oldPage.type === "about" || oldPage.type === "walks" ? "high" : "medium"
      });

      const suggestedPath = possiblePaths[0] || oldPage.path.toLowerCase().replace(/\.html?$/, "");
      suggestions.push({
        action: "create",
        path: suggestedPath,
        description: `Create ${oldPage.type} page from "${oldPage.title}"`,
        content: {
          path: suggestedPath,
          oldPage
        }
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

      suggestions.push({
        action: "create",
        path: `gallery/${page.path.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
        description: `Create album from ${page.images.length} images on "${page.title}"`
      });
    }
  });

  if (walks.length > 0) {
    const hasWalksProgramme = newPages.some(p =>
      p.path.startsWith("walks/") &&
      p.rows.some(r => r.type === "events")
    );

    if (!hasWalksProgramme) {
      gaps.push({
        type: "page",
        oldPath: "walks",
        description: `${walks.length} walks found but no walk programme pages exist`,
        priority: "high"
      });

      suggestions.push({
        action: "create",
        path: "walks/programme",
        description: `Create walk programme page for ${walks.length} walks`
      });
    }
  }

  return { oldPages, newPages, walks, gaps, suggestions };
}

function printReport(result: ReconciliationResult): void {
  log("\n" + "=".repeat(60));
  log("SITE RECONCILIATION REPORT");
  log("=".repeat(60));

  log(`\nOld site pages scraped: ${result.oldPages.length}`);
  const byType: Record<string, ReconciliationPage[]> = {};
  result.oldPages.forEach(p => {
    byType[p.type] = byType[p.type] || [];
    byType[p.type].push(p);
  });
  Object.entries(byType).forEach(([type, pages]) => {
    log(`  ${type}: ${pages.length} pages`);
    pages.slice(0, 3).forEach(p => log(`    - ${p.path}`));
    if (pages.length > 3) log(`    ... and ${pages.length - 3} more`);
  });

  log(`\nNew site pages: ${result.newPages.length}`);
  log(`New site walks: ${result.walks.length}`);

  if (result.walks.length > 0) {
    const categories = categorizeWalks(result.walks);
    log("\nWalk categories:");
    categories.forEach(cat => {
      log(`  ${cat.name}: ${cat.walks.length} walks`);
    });
  }

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

async function applyChanges(
  auth: CMSAuth,
  result: ReconciliationResult,
  selectedSuggestions: ReconciliationSuggestion[]
): Promise<void> {
  log(`\nApplying ${selectedSuggestions.length} changes...`);

  const appliedCount = { created: 0, updated: 0, failed: 0 };

  for (const suggestion of selectedSuggestions) {
    try {
      log(`\n→ ${suggestion.action}: ${suggestion.path}`);

      if (suggestion.path.includes("programme") || suggestion.path.includes("walks/")) {
        const pageContent = await createWalkProgrammePage(suggestion.path, result.walks);
        await cms.createOrUpdatePageContent(auth, pageContent);
        appliedCount.created++;
        log(`  ✓ Created walk programme page: ${suggestion.path}`);
      } else if (suggestion.content?.oldPage) {
        const oldPage = suggestion.content.oldPage as ReconciliationPage;
        const pageContent = createPageFromScrapedContent(suggestion.path, oldPage);
        await cms.createOrUpdatePageContent(auth, pageContent);
        appliedCount.created++;
        log(`  ✓ Created page: ${suggestion.path}`);
      } else {
        const pageContent: PageContent = {
          path: suggestion.path,
          rows: [textRow(`# ${suggestion.description}\n\nThis page was created during migration and needs content.`)]
        };
        await cms.createOrUpdatePageContent(auth, pageContent);
        appliedCount.created++;
        log(`  ✓ Created placeholder page: ${suggestion.path}`);
      }
    } catch (err: any) {
      appliedCount.failed++;
      log(`  ✗ Failed: ${err.message}`);
    }
  }

  log(`\n✓ Applied changes: ${appliedCount.created} created, ${appliedCount.updated} updated, ${appliedCount.failed} failed`);
}

function createPageFromScrapedContent(path: string, oldPage: ReconciliationPage): PageContent {
  const cleanMarkdown = oldPage.markdown
    .replace(/\[.*?\]\(javascript:.*?\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const rows: PageContentRow[] = [];

  if (!cleanMarkdown.startsWith("#")) {
    rows.push(textRow(`# ${oldPage.title}\n\n${cleanMarkdown}`));
  } else {
    rows.push(textRow(cleanMarkdown));
  }

  return {
    path,
    rows
  };
}

async function createWalkProgrammePage(path: string, walks: NgxWalk[]): Promise<PageContent> {
  const now = dateTimeNow();
  const futureWalks = walks.filter(w => dateTimeFromIso(w.eventDate) >= now);
  const sortedWalks = futureWalks.sort((a, b) =>
    dateTimeFromIso(a.eventDate).toMillis() - dateTimeFromIso(b.eventDate).toMillis()
  );

  const threeMonthsFromNow = now.plus({months: 3});

  const rows: PageContentRow[] = [
    textRow(`# Walk Programme\n\nUpcoming walks for our group. Click on any walk for more details.`),
    eventsRow({
      fromDate: now.toMillis(),
      toDate: threeMonthsFromNow.toMillis(),
      sortOrder: "DATE_ASCENDING"
    })
  ];

  return {
    path,
    rows
  };
}

async function runReconcile(config: ReconciliationConfig): Promise<ReconciliationResult | null> {
  try {
    const oldPages = await fetchOldSite(config.oldSiteUrl);
    const newPages = await fetchNewSitePages(config.newSiteUrl);
    const walks = await fetchNewSiteWalks(config.newSiteUrl);

    const result = reconcile(oldPages, newPages, walks);
    printReport(result);

    return result;
  } catch (err: any) {
    logError(`Migration failed: ${err.message}`);
    throw err;
  }
}

async function runApply(config: ReconciliationConfig): Promise<void> {
  try {
    if (!config.username || !config.password) {
      throw new Error("Username and password required for apply");
    }

    log("\nLogging in to CMS...");
    const auth = await cms.login(config.newSiteUrl, config.username, config.password);
    log("✓ Logged in successfully");

    const result = await runReconcile({ ...config, dryRun: true });
    if (!result) return;

    if (result.suggestions.length === 0) {
      log("\n✓ No changes to apply - sites are in sync!");
      return;
    }

    if (config.dryRun) {
      log("\n[DRY RUN] Would apply the following changes:");
      result.suggestions.forEach((s, i) => {
        log(`  ${i + 1}. ${s.action}: ${s.path}`);
      });
      return;
    }

    const selectedIndices = await checkbox({
      message: "Select changes to apply:",
      choices: result.suggestions.map((s, i) => ({
        name: `${s.action}: ${s.path} - ${s.description}`,
        value: i,
        checked: s.action === "create" && (
          s.path.includes("programme") ||
          s.path.includes("walks")
        )
      }))
    });

    if (isQuit(selectedIndices) || isBack(selectedIndices)) {
      return handleQuit();
    }

    if (selectedIndices.length === 0) {
      log("\nNo changes selected. Exiting.");
      return;
    }

    const selectedSuggestions = selectedIndices.map(i => result.suggestions[i]);

    const shouldApply = await confirm(`Apply ${selectedSuggestions.length} changes?`);
    if (isQuit(shouldApply) || isBack(shouldApply) || !shouldApply) {
      log("\nCancelled.");
      return;
    }

    await applyChanges(auth, result, selectedSuggestions);

  } catch (err: any) {
    logError(`Apply failed: ${err.message}`);
    throw err;
  }
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

    await runApply(config);
  } else {
    await runReconcile(config);
  }
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
      await runApply({
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
