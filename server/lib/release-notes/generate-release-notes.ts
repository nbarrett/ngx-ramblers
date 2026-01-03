import { Command } from "commander";
import debug from "debug";
import inquirer from "inquirer";
import { execSync } from "child_process";
import * as cms from "./cms-client.js";
import { findWorkflowRunByCommit } from "./github-client.js";
import { Environment } from "../env-config/environment-model";
import { GitHubTokenProvider } from "../shared/github-token-provider.js";
import { pluraliseWithCount } from "../shared/string-utils";
import { commitsBetween, findCommitByHash, gitLog, gitLogSinceDate, latestTag } from "./commit-parser.js";
import {
  createReleaseNotesData,
  extractExistingBuildMetadata,
  formatDateForPath,
  generatePageContent,
  updateIndexPageContent
} from "./content-generator.js";
import type { CMSAuth, ConventionalCommit, GenerateOptions, ReleaseNotesConfig, ReleaseNotesData } from "./models.js";
import { dateTimeFromIso, dateTimeFromJsDate, dateTimeInTimezone } from "../shared/dates";
import { asNumber } from "../../../projects/ngx-ramblers/src/app/functions/numbers";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";

const debugLog = debug("release-notes");
debugLog.enabled = true;

const DEFAULT_CONFIG: ReleaseNotesConfig = {
  cmsUrl: process.env[Environment.CMS_URL] || "https://www.ngx-ramblers.org.uk",
  username: process.env[Environment.CMS_USERNAME] || "",
  password: process.env[Environment.CMS_PASSWORD] || "",
  githubRepo: "nbarrett/ngx-ramblers",
  githubToken: process.env[Environment.GITHUB_TOKEN] || process.env[Environment.GH_TOKEN] || process.env[Environment.GITHUB_PAT] || new GitHubTokenProvider().token(),
  indexPath: "how-to/committee/release-notes"
};

const DATE_INPUT_FORMATS: UIDateFormat[] = [
  UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED,
  UIDateFormat.DAY_MONTH_YEAR_WITH_SLASHES,
  UIDateFormat.DISPLAY_DATE_NO_DAY,
  UIDateFormat.DISPLAY_DATE,
  UIDateFormat.DISPLAY_DATE_TH,
  UIDateFormat.MONTH_YEAR_ABBREVIATED
];

function normalizeDateInput(input: string): string {
  const trimmed = input?.trim();
  if (!trimmed) {
    throw new Error("Date value is required");
  }

  const isoCandidate = dateTimeFromIso(trimmed);
  if (isoCandidate.isValid) {
    return isoCandidate.startOf("day").toISODate();
  }

  const matchingFormat = DATE_INPUT_FORMATS
    .map(format => dateTimeInTimezone(trimmed, format))
    .find(parsed => parsed.isValid);

  if (matchingFormat) {
    return matchingFormat.startOf("day").toISODate();
  }

  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) {
    return dateTimeFromJsDate(fallback).startOf("day").toISODate();
  }

  throw new Error(`Unable to parse date value: ${input}`);
}

function filterCommitsByDateRange(commits: ConventionalCommit[], sinceDate?: string | null, untilDate?: string | null): ConventionalCommit[] {
  return commits.filter(commit => {
    if (sinceDate && commit.date < sinceDate) {
      return false;
    } else return !(untilDate && commit.date > untilDate);
  });
}

function getCurrentBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

function getAllCommits(limit?: number): ConventionalCommit[] {
  if (limit) {
    return gitLog(`HEAD~${limit}`, "HEAD");
  }
  return gitLog();
}

function getRecentCommits(count: number = 50): ConventionalCommit[] {
  return gitLog(`HEAD~${count}`, "HEAD");
}

async function removeLegacyReleasePages(
  auth: CMSAuth,
  releasePath: string,
  issueNumber: string | null,
  pathSuffix: string
): Promise<void> {
  if (pathSuffix) {
    return;
  }

  const legacyPaths: string[] = [];
  if (issueNumber) {
    legacyPaths.push(`${releasePath}-issue-${issueNumber}`);
  }
  legacyPaths.push(`${releasePath}-other`);

  await legacyPaths.reduce(async (previous, candidatePath) => {
    await previous;
    if (candidatePath === releasePath) {
      return;
    }
    const legacyPage = await cms.pageContent(auth, candidatePath);
    if (legacyPage?.id) {
      await cms.deletePageContent(auth, legacyPage.id);
      debugLog(`Removed legacy release page: ${candidatePath}`);
    }
  }, Promise.resolve());
}

function needsBuildMetadataRefresh(data: ReleaseNotesData): boolean {
  if (!data.buildNumber) {
    return true;
  } else if (!data.buildUrl) {
    return true;
  }
  const runIdMatch = data.buildUrl.match(/\/runs\/(\d+)/);
  if (!runIdMatch) {
    return true;
  } else if (data.buildNumber === runIdMatch[1]) {
    return true;
  }
  return false;
}

interface ReleaseGroup {
  date: string;
  issueNumber: string | null;
  commits: ConventionalCommit[];
  pathSuffix: string;
}

function assignFallbackIssues(commits: ConventionalCommit[]): Map<string, string | null> {
  const result = commits.reduce<{ assignments: Map<string, string | null>; lastIssue: string | null }>(
    (state, commit) => {
      const commitIssue = commit.issueReferences.length > 0 ? commit.issueReferences[0].issue : null;
      const resolvedIssue = commitIssue ?? state.lastIssue;
      state.assignments.set(commit.hash, resolvedIssue);
      return {
        assignments: state.assignments,
        lastIssue: commitIssue ?? state.lastIssue
      };
    },
    { assignments: new Map<string, string | null>(), lastIssue: null }
  );

  return result.assignments;
}

function groupCommitsByDateAndIssue(commits: ConventionalCommit[]): ReleaseGroup[] {
  const issueAssignments = assignFallbackIssues(commits);

  const grouped = commits.reduce(
    (state, commit) => {
      const assignedIssue = issueAssignments.get(commit.hash);

      if (assignedIssue) {
        const existingWithIssue = state.issueGroups.get(assignedIssue);
        const updatedWithIssue: ReleaseGroup = existingWithIssue
          ? {
              ...existingWithIssue,
              commits: existingWithIssue.commits.concat(commit)
            }
          : {
              date: existingWithIssue?.date ?? commit.date,
              issueNumber: assignedIssue,
              commits: [commit],
              pathSuffix: ""
            };

        state.issueGroups.set(assignedIssue, {
          ...updatedWithIssue,
          date: existingWithIssue?.date ?? commit.date
        });
        return state;
      }

      const key = commit.date;
      const existingUnassigned = state.unassignedGroups.get(key);
      const updatedUnassigned: ReleaseGroup = existingUnassigned
        ? {
            ...existingUnassigned,
            commits: existingUnassigned.commits.concat(commit)
          }
        : {
            date: key,
            issueNumber: null,
            commits: [commit],
            pathSuffix: ""
          };

      state.unassignedGroups.set(key, updatedUnassigned);
      return state;
    },
    {
      issueGroups: new Map<string, ReleaseGroup>(),
      unassignedGroups: new Map<string, ReleaseGroup>()
    }
  );

  const combinedGroups = [
    ...grouped.issueGroups.values(),
    ...grouped.unassignedGroups.values()
  ];

  const groupsByDate = combinedGroups.reduce((map, group) => {
    const current = map.get(group.date) || [];
    map.set(group.date, current.concat(group));
    return map;
  }, new Map<string, ReleaseGroup[]>());

  const normalizedGroups = Array.from(groupsByDate.entries()).flatMap(([date, dateGroups]) => {
    const withIssue = dateGroups.filter(group => group.issueNumber);
    const sortedIssues = [...withIssue].sort((a, b) => asNumber(b.issueNumber) - asNumber(a.issueNumber));
    const normalizedIssues = sortedIssues.map(group => ({
      ...group,
      pathSuffix: sortedIssues.length > 1 ? `-issue-${group.issueNumber}` : ""
    }));

    const withoutIssue = dateGroups.filter(group => !group.issueNumber);
    const normalizedWithoutIssue = withoutIssue.map(group => ({
      ...group,
      pathSuffix: withIssue.length > 0 ? "-other" : ""
    }));

    return [...normalizedIssues, ...normalizedWithoutIssue];
  });

  return normalizedGroups.sort((a, b) => {
    const dateComparison = b.date.localeCompare(a.date);
    if (dateComparison !== 0) {
      return dateComparison;
    }
    if (a.issueNumber && b.issueNumber) {
      return asNumber(b.issueNumber) - asNumber(a.issueNumber);
    }
    if (a.issueNumber) {
      return -1;
    }
    if (b.issueNumber) {
      return 1;
    }
    return 0;
  });
}

function filterReleaseGroups(groups: ReleaseGroup[], includeUnassigned: boolean): ReleaseGroup[] {
  if (includeUnassigned) {
    return groups;
  }
  return groups.filter(group => Boolean(group.issueNumber));
}

function commitsFromGroups(groups: ReleaseGroup[]): ConventionalCommit[] {
  return groups.flatMap(group => group.commits);
}


async function promptForCredentials(config: ReleaseNotesConfig): Promise<ReleaseNotesConfig> {
  if (config.username && config.password) {
    return config;
  }

  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;

  if (!isInteractive) {
    const missingFields = [];
    if (!config.username) missingFields.push("CMS_USERNAME");
    if (!config.password) missingFields.push("CMS_PASSWORD");

    throw new Error(
      `Missing credentials in non-interactive environment.\n` +
      `Please set environment variables: ${missingFields.join(", ")}\n` +
      `Or use --username and --password options.`
    );
  }

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "username",
      message: "CMS Username:",
      default: config.username,
      when: !config.username,
      validate: input => input.trim() ? true : "Username is required"
    },
    {
      type: "password",
      name: "password",
      message: "CMS Password:",
      when: !config.password,
      validate: input => input.trim() ? true : "Password is required"
    }
  ]);

  return {
    ...config,
    username: answers.username || config.username,
    password: answers.password || config.password
  };
}

async function generateReleaseNote(
  data: ReleaseNotesData,
  auth: CMSAuth,
  config: ReleaseNotesConfig,
  pathSuffix: string,
  dryRun: boolean,
  allowUnassigned: boolean
): Promise<void> {
  const releasePath = `${config.indexPath}/${formatDateForPath(data.date)}${pathSuffix}`;

  const existingReleasePage = dryRun ? null : await cms.pageContent(auth, releasePath);

  if (!data.buildNumber && existingReleasePage) {
    const existingBuild = extractExistingBuildMetadata(existingReleasePage);
    if (existingBuild) {
      data.buildNumber = existingBuild.buildNumber;
      data.buildUrl = existingBuild.buildUrl;
      debugLog(`  Preserved build #${existingBuild.buildNumber}`);
    }
  }

  if (!dryRun && needsBuildMetadataRefresh(data)) {
    debugLog(`  Attempting GitHub build lookup for ${data.commitSha}`);
    const githubRun = await findWorkflowRunByCommit(config.githubRepo, data.commitSha, config.githubToken || null);
    if (githubRun) {
      const displayNumber = githubRun.number || githubRun.id;
      const resolvedUrl = githubRun.url || `https://github.com/${config.githubRepo}/actions/runs/${githubRun.id}`;
      data.buildNumber = displayNumber;
      data.buildUrl = resolvedUrl;
      debugLog(`  Resolved build #${displayNumber} (run id ${githubRun.id}) from GitHub: ${resolvedUrl}`);
    } else {
      debugLog("  GitHub build lookup returned no results");
    }
  } else if (data.buildNumber) {
    const existingUrl = data.buildUrl || "unknown URL";
    debugLog(`  Using existing build metadata #${data.buildNumber} (${existingUrl})`);
  }

  debugLog(`Generating release note for ${data.date}${pathSuffix}`);
  debugLog(`  Title: ${data.title}`);
  debugLog(`  Issue: ${data.issueNumber || "none"}`);
  debugLog(`  Commits: ${data.allCommits.length}`);
  debugLog(`  Path: ${releasePath}`);

  const pageContent = generatePageContent(data, config.githubRepo, releasePath);

  if (dryRun) {
    debugLog("DRY RUN - Would create/update page:");
    debugLog(JSON.stringify(pageContent, null, 2));
    return;
  }

  if (existingReleasePage) {
    await cms.updatePageContent(auth, existingReleasePage.id!, pageContent);
    debugLog(`Updated release note page: ${releasePath}`);
  } else {
    await cms.createPageContent(auth, pageContent);
    debugLog(`Created release note page: ${releasePath}`);
  }

  if (!dryRun) {
    await removeLegacyReleasePages(auth, releasePath, data.issueNumber, pathSuffix);
  }

  const indexPage = await cms.pageContent(auth, config.indexPath);

  if (!indexPage) {
    throw new Error(`Index page not found: ${config.indexPath}`);
  }

  const updatedIndex = updateIndexPageContent(
    indexPage,
    {
      date: data.date,
      title: data.title,
      path: releasePath,
      issueNumber: data.issueNumber
    },
    { allowUnassigned }
  );

  await cms.updatePageContent(auth, indexPage.id!, updatedIndex);
  debugLog(`Updated index page: ${config.indexPath}`);
}

async function filterExistingReleaseNotes(
  groups: ReleaseGroup[],
  auth: CMSAuth,
  config: ReleaseNotesConfig
): Promise<{ new: ReleaseGroup[]; existing: ReleaseGroup[] }> {
  const newGroups: ReleaseGroup[] = [];
  const existingGroups: ReleaseGroup[] = [];

  for (const group of groups) {
    const releasePath = `${config.indexPath}/${formatDateForPath(group.date)}${group.pathSuffix}`;
    const exists = await cms.pageExists(auth, releasePath);

    if (exists) {
      existingGroups.push(group);
    } else {
      newGroups.push(group);
    }
  }

  return { new: newGroups, existing: existingGroups };
}

async function generateMultipleReleaseNotes(
  groups: ReleaseGroup[],
  auth: CMSAuth,
  config: ReleaseNotesConfig,
  buildNumber: string | null,
  dryRun: boolean,
  includeUnassigned: boolean
): Promise<void> {
  await groups.reduce(async (previous, group) => {
    await previous;
    const data = createReleaseNotesData(group.commits, buildNumber, config.githubRepo);
    if (group.issueNumber) {
      data.issueNumber = group.issueNumber;
      data.issueUrl = `https://github.com/${config.githubRepo}/issues/${group.issueNumber}`;
    }
    await generateReleaseNote(data, auth, config, group.pathSuffix, dryRun, includeUnassigned);
  }, Promise.resolve());
}

async function testAuthentication(config: ReleaseNotesConfig): Promise<void> {
  debugLog("\n=== Testing CMS Authentication ===\n");

  const configWithCreds = await promptForCredentials(config);

  debugLog(`CMS URL: ${configWithCreds.cmsUrl}`);
  debugLog(`Username: ${configWithCreds.username}`);
  debugLog("\nAttempting login...");

  try {
    const auth = await cms.login(configWithCreds.cmsUrl, configWithCreds.username, configWithCreds.password);
    debugLog("✓ Login successful");
    debugLog("✓ JWT token obtained");
    debugLog("✓ User has contentAdmin permission");

    debugLog("\nTesting API access...");

    const indexPage = await cms.pageContent(auth, configWithCreds.indexPath);

    if (indexPage) {
      debugLog(`✓ Successfully fetched index page: ${configWithCreds.indexPath}`);
      debugLog(`  Page ID: ${indexPage.id}`);
      debugLog(`  ${pluraliseWithCount(indexPage.rows?.length || 0, "row")}`);
    } else {
      debugLog(`✗ Index page not found: ${configWithCreds.indexPath}`);
      debugLog("  Make sure this page exists in the CMS");
      process.exit(1);
    }

    debugLog("\n=== Authentication Test Passed ===\n");
    debugLog("You can now use the release notes generator with these credentials.");

  } catch (error) {
    debugLog(`\n✗ Authentication failed: ${error}`);
    debugLog("\nPlease check:");
    debugLog("  1. CMS URL is correct");
    debugLog("  2. Username and password are correct");
    debugLog("  3. User has contentAdmin permission");
    debugLog("  4. CMS is accessible from this network");
    process.exit(1);
  }
}

async function previewMissingReleaseNotes(includeUnassigned: boolean): Promise<void> {
  const recentCommits = getRecentCommits(100);

  if (recentCommits.length === 0) {
    debugLog("No commits found in recent history");
    return;
  }

  const releaseGroups = filterReleaseGroups(groupCommitsByDateAndIssue(recentCommits), includeUnassigned);

  debugLog(`\nPreview of release notes (recent 100 commits):`);
  debugLog(`Total commits: ${recentCommits.length}`);
  debugLog(`Release notes that would be created/updated: ${releaseGroups.length}\n`);

  releaseGroups.slice(0, 15).forEach(group => {
    const primaryCommit = group.commits[0];
    const issueRef = group.issueNumber ? ` (#${group.issueNumber})` : "";
    const suffix = group.pathSuffix ? ` [${group.pathSuffix}]` : "";
    debugLog(`  ${group.date}${suffix}: ${pluraliseWithCount(group.commits.length, "commit")} - ${primaryCommit.subject}${issueRef}`);
  });

  if (releaseGroups.length > 15) {
    debugLog(`  ... and ${pluraliseWithCount(releaseGroups.length - 15, "more release note")}`);
  }
  debugLog("");
}

async function mainMenu(config: ReleaseNotesConfig, includeUnassigned: boolean): Promise<void> {
  const mainAnswers = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Release Notes - What would you like to do?",
      choices: [
        { name: "Test authentication", value: "test-auth" },
        { name: "Preview release notes", value: "preview" },
        { name: "Generate release notes (interactive)", value: "interactive" },
        { name: "Generate latest (since last tag)", value: "latest" },
        { name: "Generate all", value: "all" },
        { name: "Exit", value: "exit" }
      ]
    }
  ]);

  if (mainAnswers.action === "exit") {
    debugLog("Done");
    return;
  }

  if (mainAnswers.action === "test-auth") {
    await testAuthentication(config);
    return mainMenu(config, includeUnassigned);
  }

  if (mainAnswers.action === "preview") {
    await previewMissingReleaseNotes(includeUnassigned);
    return mainMenu(config, includeUnassigned);
  }

  if (mainAnswers.action === "interactive") {
    await generateInteractiveMode(config, includeUnassigned);
    return mainMenu(config, includeUnassigned);
  }

  if (mainAnswers.action === "latest") {
    await commandLineMode({ latest: true, includeUnassigned }, config);
    return mainMenu(config, includeUnassigned);
  }

  if (mainAnswers.action === "all") {
    await commandLineMode({ all: true, includeUnassigned }, config);
    return mainMenu(config, includeUnassigned);
  }
}

async function interactiveMode(config: ReleaseNotesConfig, includeUnassigned: boolean): Promise<void> {
  await mainMenu(config, includeUnassigned);
}

async function generateInteractiveMode(config: ReleaseNotesConfig, includeUnassigned: boolean): Promise<void> {
  const scopeAnswers = await inquirer.prompt([
    {
      type: "list",
      name: "scope",
      message: "What scope do you want to work with?",
      choices: [
        { name: "Recent commits (last 50)", value: "recent" },
        { name: "Recent commits (last 100)", value: "recent-100" },
        { name: "All commits in repository", value: "all" },
        { name: "← Back to main menu", value: "back" }
      ]
    }
  ]);

  if (scopeAnswers.scope === "back") {
    return;
  }

  let allCommits: ConventionalCommit[];
  if (scopeAnswers.scope === "recent") {
    allCommits = getRecentCommits(50);
  } else if (scopeAnswers.scope === "recent-100") {
    allCommits = getRecentCommits(100);
  } else {
    allCommits = getAllCommits();
  }

  if (allCommits.length === 0) {
    debugLog("No commits found in selected scope");
    return;
  }

  const releaseGroups = filterReleaseGroups(groupCommitsByDateAndIssue(allCommits), includeUnassigned);

  if (releaseGroups.length === 0) {
    debugLog("No release notes to generate for the selected scope (commits lack issue references). Use --include-unassigned to include them.");
    return;
  }

  debugLog(`Found ${allCommits.length} commits`);
  debugLog(`Will create/update ${releaseGroups.length} release note pages\n`);

  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: `Generate all release notes (${releaseGroups.length} pages)`, value: "all" },
        { name: "Select specific release notes to generate", value: "select" },
        { name: "Generate for a specific commit range", value: "range" },
        { name: "← Back to scope selection", value: "back" }
      ]
    }
  ]);

  if (answers.action === "back") {
    return generateInteractiveMode(config, includeUnassigned);
  }

  const configWithCreds = await promptForCredentials(config);
  const auth = await cms.login(configWithCreds.cmsUrl, configWithCreds.username, configWithCreds.password);

  if (answers.action === "all") {
    await generateMultipleReleaseNotes(releaseGroups, auth, configWithCreds, null, false, includeUnassigned);
    debugLog(`Generated ${releaseGroups.length} release notes`);
  } else if (answers.action === "select") {
    const groupAnswers = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedGroups",
        message: "Select release notes to generate:",
        choices: releaseGroups.map((group, index) => {
          const primaryCommit = group.commits[0];
          const issueRef = group.issueNumber ? ` #${group.issueNumber}` : "";
          const suffix = group.pathSuffix ? ` [${group.pathSuffix}]` : "";
          return {
            name: `${group.date}${suffix}:${issueRef} ${primaryCommit.subject} (${pluraliseWithCount(group.commits.length, "commit")})`,
            value: index
          };
        })
      }
    ]);

    const selectedGroups = groupAnswers.selectedGroups.map((index: number) => releaseGroups[index]);

    await generateMultipleReleaseNotes(selectedGroups, auth, configWithCreds, null, false, includeUnassigned);
    debugLog(`Generated ${selectedGroups.length} release notes`);
  } else if (answers.action === "range") {
    const rangeAnswers = await inquirer.prompt([
      {
        type: "input",
        name: "since",
        message: "Start commit (hash or ref):",
        validate: input => {
          if (!input.trim()) {
            return "Start commit is required";
          }
          const commit = findCommitByHash(input.trim());
          return commit ? true : "Commit not found";
        }
      },
      {
        type: "input",
        name: "until",
        message: "End commit (hash or ref, default: HEAD):",
        default: "HEAD"
      }
    ]);

    const commits = commitsBetween(rangeAnswers.since, rangeAnswers.until);
    const groups = filterReleaseGroups(groupCommitsByDateAndIssue(commits), includeUnassigned);

    if (groups.length === 0) {
      debugLog("No release notes to generate for that range (commits lack issue references). Use --include-unassigned to include them.");
      return;
    }

    await generateMultipleReleaseNotes(groups, auth, configWithCreds, null, false, includeUnassigned);
    debugLog(`Generated ${pluraliseWithCount(groups.length, "release note")} for commit range`);
  }
}

async function commandLineMode(options: GenerateOptions, config: ReleaseNotesConfig): Promise<void> {
  let configWithCreds = config;
  let auth: CMSAuth | null = null;
  const includeUnassigned = Boolean(options.includeUnassigned);

  if (!options.dryRun) {
    configWithCreds = await promptForCredentials(config);
    auth = await cms.login(configWithCreds.cmsUrl, configWithCreds.username, configWithCreds.password);
  } else {
    debugLog("DRY RUN MODE - Skipping authentication");
  }

  if (options.all) {
    const allCommits = getAllCommits();
    const releaseGroups = filterReleaseGroups(groupCommitsByDateAndIssue(allCommits), includeUnassigned);

    if (releaseGroups.length === 0) {
      debugLog("No release notes to generate (commits lack issue references). Use --include-unassigned to include them.");
    } else {
      if (auth) {
        const filtered = await filterExistingReleaseNotes(releaseGroups, auth, configWithCreds);
        const newCount = filtered.new.length;
        const existingCount = filtered.existing.length;

        if (newCount > 0 && existingCount > 0) {
          debugLog(`Found ${releaseGroups.length} release notes: ${newCount} new, ${existingCount} existing (will update all)`);
        } else if (existingCount > 0) {
          debugLog(`Found ${releaseGroups.length} existing release notes (will update all)`);
        } else {
          debugLog(`Found ${newCount} new release notes`);
        }
      }

      await generateMultipleReleaseNotes(releaseGroups, auth!, configWithCreds, options.buildNumber || null, options.dryRun || false, includeUnassigned);
      debugLog(`Generated ${releaseGroups.length} release notes`);
    }
  } else if (options.latest) {
    const tag = latestTag();
    const commits = tag ? commitsBetween(tag, "HEAD") : gitLog("HEAD~10", "HEAD");

    if (commits.length === 0) {
      debugLog("No new commits since last tag");
    } else {
      const releaseGroups = filterReleaseGroups(groupCommitsByDateAndIssue(commits), includeUnassigned);

      if (releaseGroups.length === 0) {
        debugLog("No release notes to generate for latest commits (commits lack issue references). Use --include-unassigned to include them.");
      } else {
        if (auth) {
          const filtered = await filterExistingReleaseNotes(releaseGroups, auth, configWithCreds);
          const newCount = filtered.new.length;
          const existingCount = filtered.existing.length;

          if (newCount > 0 && existingCount > 0) {
            debugLog(`Found ${releaseGroups.length} release notes: ${newCount} new, ${existingCount} existing (will update all)`);
          } else if (existingCount > 0) {
            debugLog(`Found ${releaseGroups.length} existing release notes (will update all)`);
          } else {
            debugLog(`Found ${newCount} new release notes`);
          }
        }

        await generateMultipleReleaseNotes(releaseGroups, auth!, configWithCreds, options.buildNumber || null, options.dryRun || false, includeUnassigned);
        debugLog(`Generated ${pluraliseWithCount(releaseGroups.length, "release note")} for latest commits`);
      }
    }
  } else if (options.since) {
    const until = options.until || "HEAD";
    const commits = commitsBetween(options.since, until);

    if (commits.length === 0) {
      debugLog(`No commits between ${options.since} and ${until}`);
    } else {
      const releaseGroups = filterReleaseGroups(groupCommitsByDateAndIssue(commits), includeUnassigned);

      if (releaseGroups.length === 0) {
        debugLog("No release notes to generate for that range (commits lack issue references). Use --include-unassigned to include them.");
      } else {
        if (auth) {
          const filtered = await filterExistingReleaseNotes(releaseGroups, auth, configWithCreds);
          const newCount = filtered.new.length;
          const existingCount = filtered.existing.length;

          if (newCount > 0 && existingCount > 0) {
            debugLog(`Found ${releaseGroups.length} release notes: ${newCount} new, ${existingCount} existing (will update all)`);
          } else if (existingCount > 0) {
            debugLog(`Found ${releaseGroups.length} existing release notes (will update all)`);
          } else {
            debugLog(`Found ${newCount} new release notes`);
          }
        }

        await generateMultipleReleaseNotes(releaseGroups, auth!, configWithCreds, options.buildNumber || null, options.dryRun || false, includeUnassigned);
        debugLog(`Generated ${pluraliseWithCount(releaseGroups.length, "release note")} for commit range`);
      }
    }
  } else if (options.sinceDate) {
    let normalizedSince: string;
    let normalizedUntilDate: string | null = null;

    try {
      normalizedSince = normalizeDateInput(options.sinceDate);
      if (options.untilDate) {
        normalizedUntilDate = normalizeDateInput(options.untilDate);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      debugLog(`Invalid date input: ${message}`);
      process.exit(1);
    }

    const untilRef = options.until || "HEAD";
    const commits = gitLogSinceDate(normalizedSince, untilRef);
    const filteredCommits = filterCommitsByDateRange(commits, normalizedSince, normalizedUntilDate);

    if (filteredCommits.length === 0) {
      debugLog(`No commits found on or after ${normalizedSince}${normalizedUntilDate ? ` and before ${normalizedUntilDate}` : ""}`);
    } else {
      const releaseGroups = filterReleaseGroups(groupCommitsByDateAndIssue(filteredCommits), includeUnassigned);

      if (releaseGroups.length === 0) {
        debugLog("No release notes to generate for that date range (commits lack issue references). Use --include-unassigned to include them.");
      } else {
        if (auth) {
          const filtered = await filterExistingReleaseNotes(releaseGroups, auth, configWithCreds);
          const newCount = filtered.new.length;
          const existingCount = filtered.existing.length;

          if (newCount > 0 && existingCount > 0) {
            debugLog(`Found ${releaseGroups.length} release notes: ${newCount} new, ${existingCount} existing (will update all)`);
          } else if (existingCount > 0) {
            debugLog(`Found ${releaseGroups.length} existing release notes (will update all)`);
          } else {
            debugLog(`Found ${newCount} new release notes`);
          }
        }

        await generateMultipleReleaseNotes(releaseGroups, auth!, configWithCreds, options.buildNumber || null, options.dryRun || false, includeUnassigned);
        debugLog(`Generated ${pluraliseWithCount(releaseGroups.length, "release note")} for commits since ${normalizedSince}`);
      }
    }
  } else {
    debugLog("No generation option specified. Use --latest, --all, --since, or --since-date");
  }
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("generate-release-notes")
    .description("Generate and publish release notes to the CMS")
    .version("1.0.0");

  program
    .option("--latest", "Generate release notes for commits since the last tag")
    .option("--all", "Generate release notes for all commits")
    .option("--since <commit>", "Generate release notes since this commit/tag")
    .option("--since-date <date>", "Generate release notes for commits on or after this date (e.g. 2025-11-19 or 19-Nov-2025)")
    .option("--until-date <date>", "Generate release notes until this calendar date (inclusive)")
    .option("--until <commit>", "Generate release notes until this commit (default: HEAD)")
    .option("--build-number <number>", "GitHub Actions build/run number")
    .option("--include-unassigned", "Include commits without issue references when generating release notes")
    .option("--dry-run", "Preview changes without publishing to CMS")
    .option("--preview", "Preview release notes without generating")
    .option("--test-auth", "Test CMS authentication and permissions")
    .option("--cms-url <url>", "CMS base URL", DEFAULT_CONFIG.cmsUrl)
    .option("--username <username>", "CMS username")
    .option("--password <password>", "CMS password")
    .option("--interactive", "Run in interactive mode");

  program.parse(process.argv);

  const options = program.opts<GenerateOptions & { interactive?: boolean; preview?: boolean; testAuth?: boolean; cmsUrl?: string; username?: string; password?: string }>();

  const config: ReleaseNotesConfig = {
    ...DEFAULT_CONFIG,
    cmsUrl: options.cmsUrl || DEFAULT_CONFIG.cmsUrl,
    username: options.username || DEFAULT_CONFIG.username,
    password: options.password || DEFAULT_CONFIG.password
  };
  const includeUnassignedFlag = Boolean(options.includeUnassigned);

  const branch = getCurrentBranch();
  debugLog(`Current branch: ${branch}`);
  debugLog(`CMS URL: ${config.cmsUrl}`);

  if (options.testAuth) {
    await testAuthentication(config);
  } else if (options.preview) {
    await previewMissingReleaseNotes(includeUnassignedFlag);
  } else if (options.interactive || (!options.latest && !options.all && !options.since && !options.sinceDate)) {
    await interactiveMode(config, includeUnassignedFlag);
  } else {
    await commandLineMode(options, config);
  }

  debugLog("Done");
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
