import { Command } from "commander";
import debug from "debug";
import mongoose from "mongoose";
import * as cms from "./cms-client.js";
import { fetchWorkflowRunNumberMap } from "./github-client.js";
import { extractPlaintextBuildRef, linkPlaintextBuildLine } from "./content-generator.js";
import { PageContentColumn } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { envConfig } from "../env-config/env-config";
import { GitHubTokenProvider } from "../shared/github-token-provider.js";
import { DEFAULT_CMS_BASE_URL } from "./models.js";
import { PageContent, PageContentType } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";

const debugLog = debug(envConfig.logNamespace("refresh-build-links"));
debugLog.enabled = true;

const INDEX_PATH = "how-to/committee/release-notes";
const RELEASE_NOTE_PATH_PREFIX = `${INDEX_PATH}/`;
const ALREADY_LINKED_HEADING = /^##\s+\[(?:GitHub |Build )?#\d+]/m;

interface CliOptions {
  githubRepo: string;
  githubToken: string;
  dryRun: boolean;
}

// A store abstracts where release-note pages are read from and written to, so the same linking logic
// runs either through the CMS HTTP API (needs a CMS login) or directly against MongoDB (needs MONGODB_URI).
interface PageStore {
  releaseNotePages(): Promise<PageContent[]>;
  save(page: PageContent): Promise<void>;
  close(): Promise<void>;
}

async function cmsStore(cmsUrl: string, username: string, password: string): Promise<PageStore> {
  const auth = await cms.login(cmsUrl, username, password);
  return {
    async releaseNotePages() {
      const pages = await cms.fetchAllPages(auth);
      return pages.filter(page => page.path?.startsWith(RELEASE_NOTE_PATH_PREFIX));
    },
    async save(page) {
      await cms.updatePageContent(auth, page.id!, page);
    },
    async close() {
    }
  };
}

async function mongoStore(uri: string): Promise<PageStore> {
  await mongoose.connect(uri);
  const collection = mongoose.connection.db!.collection<PageContent>("pageContent");
  return {
    async releaseNotePages() {
      return collection.find({ path: { $regex: `^${RELEASE_NOTE_PATH_PREFIX}` } }).toArray() as unknown as PageContent[];
    },
    async save(page) {
      await collection.updateOne({ _id: (page as any)._id }, { $set: { rows: page.rows } });
    },
    async close() {
      await mongoose.disconnect();
    }
  };
}

interface PlaintextTarget {
  page: PageContent;
  column: PageContentColumn;
  buildNumber: string;
}

async function run(store: PageStore, options: CliOptions): Promise<void> {
  const pages = await store.releaseNotePages();
  debugLog(`Scanning ${pages.length} release-note pages under ${RELEASE_NOTE_PATH_PREFIX}`);

  const targets: PlaintextTarget[] = [];
  let alreadyLinked = 0;

  for (const page of pages) {
    const textColumns = (page.rows || [])
      .filter(row => row.type === PageContentType.TEXT)
      .flatMap(row => row.columns || []);

    let pageHasPlaintext = false;
    for (const column of textColumns) {
      const ref = extractPlaintextBuildRef(column.contentText);
      if (ref) {
        targets.push({ page, column, buildNumber: ref.buildNumber });
        pageHasPlaintext = true;
      }
    }
    if (!pageHasPlaintext && textColumns.some(column => ALREADY_LINKED_HEADING.test(column.contentText || ""))) {
      alreadyLinked++;
    }
  }

  const neededNumbers = new Set(targets.map(target => target.buildNumber));
  const runUrlByNumber = await fetchWorkflowRunNumberMap(options.githubRepo, neededNumbers, options.githubToken);

  const changedPages = new Set<PageContent>();
  let linked = 0;
  let unresolved = 0;

  for (const target of targets) {
    const buildUrl = runUrlByNumber.get(target.buildNumber);
    if (!buildUrl) {
      unresolved++;
      debugLog(`  ${target.page.path}: no workflow run found for GitHub #${target.buildNumber}; leaving as plain text`);
      continue;
    }
    target.column.contentText = linkPlaintextBuildLine(target.column.contentText!, buildUrl);
    changedPages.add(target.page);
    linked++;
    debugLog(`  ${target.page.path}: GitHub #${target.buildNumber} -> ${buildUrl}`);
  }

  for (const page of changedPages) {
    if (options.dryRun) {
      debugLog(`  DRY RUN - would update ${page.path}`);
    } else {
      await store.save(page);
      debugLog(`  Updated ${page.path}`);
    }
  }

  debugLog(`Done. Pages updated: ${changedPages.size}, headings linked: ${linked}, already linked: ${alreadyLinked}, unresolved (no run found): ${unresolved}.${options.dryRun ? " (dry run - nothing saved)" : ""}`);
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("refresh-build-links")
    .description("Turn plain-text `GitHub #NNN` build headings in published release notes into links to the GitHub Actions run")
    .option("--mongo-uri <uri>", "Connect directly to MongoDB instead of the CMS API (defaults to MONGODB_URI when --via-mongo is set)")
    .option("--via-mongo", "Use the MONGODB_URI environment variable to connect directly to MongoDB", false)
    .option("--cms-url <url>", "CMS base URL", process.env[Environment.CMS_URL] || DEFAULT_CMS_BASE_URL)
    .option("--username <username>", "CMS username")
    .option("--password <password>", "CMS password")
    .option("--github-repo <repo>", "GitHub repository (owner/name)", "nbarrett/ngx-ramblers")
    .option("--github-token <token>", "GitHub token for workflow-run lookups")
    .option("--dry-run", "Preview changes without saving", false);

  program.parse(process.argv);

  const opts = program.opts() as {
    mongoUri?: string;
    viaMongo?: boolean;
    cmsUrl: string;
    username?: string;
    password?: string;
    githubRepo: string;
    githubToken?: string;
    dryRun?: boolean;
  };

  const githubToken = opts.githubToken
    || process.env[Environment.GITHUB_TOKEN]
    || process.env[Environment.GH_TOKEN]
    || process.env[Environment.GITHUB_PAT]
    || new GitHubTokenProvider().token();

  if (!githubToken) {
    console.error("A GitHub token is required to look up workflow runs. Provide --github-token or set GITHUB_TOKEN.");
    process.exit(1);
  }

  const mongoUri = opts.mongoUri || (opts.viaMongo ? process.env[Environment.MONGODB_URI] : undefined);

  let store: PageStore;
  if (mongoUri) {
    debugLog("Using direct MongoDB connection");
    store = await mongoStore(mongoUri);
  } else {
    const username = opts.username || process.env[Environment.CMS_USERNAME];
    const password = opts.password || process.env[Environment.CMS_PASSWORD];
    if (!username || !password) {
      console.error("CMS username and password are required (or pass --via-mongo / --mongo-uri). Provide --username/--password or set CMS_USERNAME/CMS_PASSWORD.");
      process.exit(1);
    }
    store = await cmsStore(opts.cmsUrl, username, password);
  }

  try {
    await run(store, {
      githubRepo: opts.githubRepo,
      githubToken,
      dryRun: Boolean(opts.dryRun)
    });
  } finally {
    await store.close();
  }
}

main().catch(err => {
  console.error("refresh-build-links failed:", err);
  process.exit(1);
});
