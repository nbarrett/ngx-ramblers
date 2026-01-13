import type {
  CommitGroup,
  ConventionalCommit,
  IssueReference,
  ReleaseNotesData
} from "./models.js";
import {
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentType
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { capitalise, joinWithAnd, pluralise, pluraliseWithCount, splitOnDashSegments, textBeforeSeparators, truncateWithEllipsis } from "../shared/string-utils";
import { dateTimeFromIso, dateTimeFromMillis, dateTimeInTimezone } from "../shared/dates";

const TYPE_TITLES: Record<string, string> = {
  feat: "New Features",
  fix: "Bug Fixes",
  refactor: "Refactoring",
  perf: "Performance Improvements",
  test: "Tests",
  docs: "Documentation",
  style: "Code Style",
  build: "Build System",
  ci: "Continuous Integration",
  chore: "Chores",
  revert: "Reverts",
  other: "Other Changes"
};

const TYPE_ORDER = [
  "feat",
  "fix",
  "perf",
  "refactor",
  "build",
  "ci",
  "test",
  "docs",
  "style",
  "chore",
  "revert",
  "other"
];

const TYPE_SUMMARIES: Record<string, { singular: string; plural?: string }> = {
  feat: { singular: "feature" },
  fix: { singular: "fix", plural: "fixes" },
  perf: { singular: "performance improvement" },
  refactor: { singular: "refactor" },
  build: { singular: "build change" },
  ci: { singular: "CI update" },
  test: { singular: "test" },
  docs: { singular: "documentation update" },
  style: { singular: "style change" },
  chore: { singular: "chore" },
  revert: { singular: "revert" },
  other: { singular: "change" }
};

const TITLE_MAX_LENGTH = 90;
const PAGE_TITLE_MAX_LENGTH = 200;
const entryLineRegex = /^-\s*\[(.+?)\]\((.+?)\)\s*$/;

export function groupCommitsByType(commits: ConventionalCommit[]): CommitGroup[] {
  const groups: Map<string, ConventionalCommit[]> = new Map();

  for (const commit of commits) {
    const type = commit.type || "other";
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type)!.push(commit);
  }

  const sortedGroups: CommitGroup[] = [];

  for (const type of TYPE_ORDER) {
    if (groups.has(type)) {
      sortedGroups.push({
        type,
        title: TYPE_TITLES[type] || type,
        commits: groups.get(type)!
      });
    }
  }

  for (const [type, commits] of groups) {
    if (!TYPE_ORDER.includes(type)) {
      sortedGroups.push({
        type,
        title: TYPE_TITLES[type] || type,
        commits
      });
    }
  }

  return sortedGroups;
}

export function generateTitle(commits: ConventionalCommit[]): string {
  if (commits.length === 0) {
    return "Release notes";
  }

  if (commits.length === 1) {
    return truncateWithEllipsis(commits[0].subject, TITLE_MAX_LENGTH);
  }

  const scopes = commits.map(c => c.scope).filter((s): s is string => Boolean(s));
  const uniqueScopes = Array.from(new Set(scopes));

  if (uniqueScopes.length === 1 && scopes.length === commits.length) {
    const primaryCommit = commits[0];
    let cleaned = primaryCommit.subject;
    cleaned = textBeforeSeparators(cleaned, [" - ", " — ", " (", " ["]);
    cleaned = textBeforeSeparators(cleaned, ["(", "["]);
    return `${uniqueScopes[0]}: ${cleaned}`;
  }

  const scopeSummary = summariseScopes(commits);
  const changeSummary = summariseChanges(commits);

  if (scopeSummary && changeSummary) {
    return `${scopeSummary}: ${changeSummary}`;
  }

  if (changeSummary) {
    return changeSummary;
  }

  return truncateWithEllipsis(commits[0].subject, TITLE_MAX_LENGTH);
}

export function formatDate(dateStr: string): string {
  return formatDisplayDateString(dateStr) || dateStr;
}

export function formatDateForPath(dateStr: string): string {
  return formatIsoDateString(dateStr) || dateStr;
}

function formatIsoDateString(dateStr: string): string | null {
  const trimmed = dateStr?.trim();
  if (!trimmed) {
    return null;
  }

  const isoParsed = dateTimeFromIso(trimmed);
  if (isoParsed.isValid) {
    return isoParsed.toISODate();
  }

  const shortMonthParsed = dateTimeInTimezone(trimmed, "d-MMM-yyyy");
  if (shortMonthParsed.isValid) {
    return shortMonthParsed.toISODate();
  }

  const fallbackMillis = Date.parse(trimmed);
  if (!Number.isNaN(fallbackMillis)) {
    const fallback = dateTimeFromMillis(fallbackMillis);
    if (fallback.isValid) {
      return fallback.toISODate();
    }
  }

  return null;
}

function formatDisplayDateString(dateStr: string): string | null {
  const iso = formatIsoDateString(dateStr);
  if (!iso) {
    return null;
  }
  const formatted = dateTimeFromIso(iso);
  if (!formatted.isValid) {
    return iso;
  }
  return formatted.toFormat("dd-MMM-yyyy");
}

export function generateMarkdown(data: ReleaseNotesData, githubRepo: string): string {
  const formattedDate = formatDate(data.date);
  const allTitleReferences = data.allCommits.flatMap(commit => commit.issueReferences);
  const titleReferences = Array.from(
    new Map(allTitleReferences.map(ref => [ref.issue, ref])).values()
  );
  const linkedTitle = linkIssueReferencesInText(data.title, titleReferences, githubRepo);
  const issueLink = data.issueNumber
    ? linkedTitle.linkedIssues.has(data.issueNumber)
      ? ""
      : ` [#${data.issueNumber}](https://github.com/${githubRepo}/issues/${data.issueNumber})`
    : "";

  const headerLines = [`# ${formattedDate} — ${linkedTitle.text}${issueLink}`];
  const buildLine = data.buildNumber
    ? data.buildUrl
      ? `## [GitHub #${data.buildNumber}](${data.buildUrl}) — [commit ${data.commitHash.substring(0, 7)}](${data.commitUrl})`
      : `## GitHub #${data.buildNumber} — [commit ${data.commitHash.substring(0, 7)}](${data.commitUrl})`
    : `## [Commit ${data.commitHash.substring(0, 7)}](${data.commitUrl})`;

  const commitSections = data.groups
    .flatMap(group => formatGroupCommits(group, githubRepo))
    .filter(section => section.length > 0);

  const sections = [
    ...headerLines,
    buildLine,
    "_____",
    ...commitSections
  ].filter(section => section.trim().length > 0);

  return sections.join("\n\n").trim();
}

function formatGroupCommits(group: CommitGroup, githubRepo: string): string[] {
  if (group.commits.length === 0) {
    return [];
  }

  const scopes = group.commits.map(c => c.scope).filter((s): s is string => Boolean(s));
  const uniqueScopes = Array.from(new Set(scopes));

  if (uniqueScopes.length === 1 && group.commits.length > 1) {
    const allIssueRefs = group.commits.flatMap(c => c.issueReferences);
    const uniqueIssues = Array.from(new Set(allIssueRefs.map(ref => ref.issue)));
    const subjects = group.commits.map(c => {
      let cleaned = c.subject;
      cleaned = textBeforeSeparators(cleaned, [" - ", " — ", " (", " ["]);
      cleaned = textBeforeSeparators(cleaned, ["(", "["]);
      return cleaned;
    });
    const combinedSubject = joinWithAnd(subjects);
    const scope = uniqueScopes[0];
    const issueSuffix = uniqueIssues.length > 0
      ? ` (${uniqueIssues.map(issue => `[#${issue}](https://github.com/${githubRepo}/issues/${issue})`).join(", ")})`
      : "";
    const heading = `### **${scope}**: ${combinedSubject}${issueSuffix}`;

    const allBodies = group.commits
      .map(c => formatCommitBody(c.body || ""))
      .filter(body => body.length > 0);

    if (allBodies.length > 0) {
      return [`${heading}\n\n${allBodies.join("\n\n")}`];
    }
    return [heading];
  }

  return group.commits
    .map(commit => formatCommitSection(commit, githubRepo))
    .filter(section => section.trim().length > 0);
}

function formatCommitSection(commit: ConventionalCommit, githubRepo: string): string {
  const scope = commit.scope ? `**${commit.scope}**: ` : "";
  const summarySubject = textBeforeSeparators(commit.subject, [" - ", " — ", " ("]);
  const subjectWithLinks = linkIssueReferencesInText(summarySubject, commit.issueReferences, githubRepo);
  const uniqueRemainingIssues = Array.from(
    new Set(
      commit.issueReferences
        .filter(ref => !subjectWithLinks.linkedIssues.has(ref.issue))
        .map(ref => ref.issue)
    )
  );
  const remainingIssues = uniqueRemainingIssues
    .map(issue => `[#${issue}](https://github.com/${githubRepo}/issues/${issue})`)
    .join(", ");
  const issueSuffix = remainingIssues ? ` (${remainingIssues})` : "";
  const heading = `### ${scope}${subjectWithLinks.text}${issueSuffix}`;
  const body = formatCommitBody(commit.body || "");

  return body.length > 0 ? `${heading}\n\n${body}` : heading;
}

function formatCommitBody(body: string): string {
  if (!body) {
    return "";
  }

  const bodyLines = body
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (bodyLines.length === 0) {
    return "";
  }

  const formattedLines = bodyLines.flatMap(line => formatBodyLine(line));
  return formattedLines.join("\n");
}

function formatBodyLine(line: string): string[] {
  if (line.startsWith("- ") || line.startsWith("* ")) {
    const stripped = line.replace(/^[-*]\s+/, "");
    return splitOnDashSegments(stripped).map(segment => `- ${segment}`);
  }
  return [line];
}

function linkIssueReferencesInText(text: string, references: IssueReference[], githubRepo: string): { text: string; linkedIssues: Set<string> } {
  let updated = text;
  const linkedIssues = new Set<string>();

  for (const reference of references) {
    const issueUrl = `https://github.com/${githubRepo}/issues/${reference.issue}`;
    const parenPattern = new RegExp(`\\(([^)]*#${reference.issue}[^)]*)\\)`);
    const parenMatch = updated.match(parenPattern);

    if (parenMatch) {
      const label = parenMatch[1].trim();
      const issuesInLabel = label.match(/#\d+/g) || [];
      if (issuesInLabel.length === 1) {
        updated = updated.replace(parenMatch[0], `[${label}](${issueUrl})`);
        linkedIssues.add(reference.issue);
        continue;
      }
    }

    const raw = reference.raw?.trim();
    if (raw && updated.includes(raw)) {
      updated = updated.replace(raw, `[${raw}](${issueUrl})`);
      linkedIssues.add(reference.issue);
      continue;
    }

    const hashPattern = new RegExp(`#${reference.issue}(?!\\])`);
    if (hashPattern.test(updated)) {
      updated = updated.replace(hashPattern, `[#${reference.issue}](${issueUrl})`);
      linkedIssues.add(reference.issue);
    }
  }

  return { text: updated, linkedIssues };
}

function summariseScopes(commits: ConventionalCommit[]): string | null {
  const scopes = commits
    .map(commit => commit.scope)
    .filter((scope): scope is string => Boolean(scope));

  if (scopes.length === 0) {
    return null;
  }

  const unique = Array.from(new Set(scopes));

  if (unique.length === 1) {
    return capitalise(unique[0]);
  }

  if (unique.length === 2) {
    return `${capitalise(unique[0])} and ${capitalise(unique[1])}`;
  }

  return `${capitalise(unique[0])}, ${capitalise(unique[1])} and ${unique.length - 2} more areas`;
}

function summariseChanges(commits: ConventionalCommit[]): string | null {
  if (commits.length === 0) {
    return null;
  }

  const typeCounts: Record<string, number> = {};
  for (const commit of commits) {
    const type = commit.type || "other";
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }

  const summaries: string[] = [];

  for (const type of TYPE_ORDER) {
    const count = typeCounts[type];
    if (!count) {
      continue;
    }
    const descriptor = TYPE_SUMMARIES[type] || { singular: "change" };
    summaries.push(pluraliseWithCount(count, descriptor.singular, descriptor.plural));
  }

  if (summaries.length === 0) {
    return pluraliseWithCount(commits.length, "change");
  }

  return joinWithAnd(summaries);
}

interface IndexEntry {
  path: string;
  date: string | null;
  displayDate: string;
  remainder: string;
  originalLabel: string;
  issueNumber: string | null;
}


function parseIndexLine(line: string): IndexEntry | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(entryLineRegex);
  if (!match) {
    return null;
  }

  const [, label, path] = match;
  const [dateSegment, ...rest] = label.split(" — ");
  const remainder = rest.join(" — ").trim();
  const issueNumberFromLabel = remainder.match(/^#(\d+)\b/)?.[1] || null;
  const issueNumberFromPath = path.match(/-issue-(\d+)$/)?.[1] || null;
  const issueNumber = issueNumberFromLabel || issueNumberFromPath;
  const isoFromPath = extractDateFromPath(path);
  const isoFromLabel = dateSegment ? formatIsoDateString(dateSegment.trim()) : null;
  const baseDisplay = dateSegment ? dateSegment.trim() : (isoFromPath ? isoFromPath : label.trim());
  const displayDate = formatDisplayDateString(baseDisplay) || baseDisplay;

  return {
    path,
    date: isoFromPath || isoFromLabel,
    displayDate,
    remainder,
    originalLabel: label.trim(),
    issueNumber
  };
}

function formatIndexLine(entry: IndexEntry): string {
  const label = buildIndexLabel(entry);
  return `- [${label}](${entry.path})`;
}

function buildIndexLabel(entry: IndexEntry): string {
  const display = entry.displayDate || entry.date || entry.originalLabel;
  if (entry.remainder) {
    return `${display} — ${entry.remainder}`;
  }
  return display;
}

function compareIndexEntries(a: IndexEntry, b: IndexEntry): number {
  if (a.date && b.date) {
    const comparison = b.date.localeCompare(a.date);
    if (comparison !== 0) {
      return comparison;
    }
  } else if (a.date) {
    return -1;
  } else if (b.date) {
    return 1;
  }

  return b.path.localeCompare(a.path);
}

function extractDateFromPath(path: string): string | null {
  const match = path.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function indexEntryKey(entry: IndexEntry): string {
  const basePath = entry.path.replace(/(-issue-\d+|-other)$/, "");
  if (entry.issueNumber) {
    return `${basePath}::issue::${entry.issueNumber}`;
  }
  return `${basePath}::unassigned`;
}

export function generatePageContent(data: ReleaseNotesData, githubRepo: string, path: string): PageContent {
  const markdown = generateMarkdown(data, githubRepo);

  const rows: PageContentRow[] = [
    {
      type: PageContentType.TEXT,
      showSwiper: false,
      maxColumns: 1,
      columns: [
        {
          contentText: markdown,
          columns: 12
        } satisfies PageContentColumn
      ]
    }
  ];

  return {
    path,
    rows
  };
}

export function updateIndexPageContent(
  existingContent: PageContent,
  newEntry: { date: string; title: string; path: string; issueNumber: string | null },
  options?: { allowUnassigned?: boolean }
): PageContent {
  const allowUnassigned = Boolean(options?.allowUnassigned);
  const isoDate = formatIsoDateString(newEntry.date);
  const displayDate = formatDisplayDateString(newEntry.date) || newEntry.date;
  const remainderText = (newEntry.issueNumber ? `#${newEntry.issueNumber} — ${newEntry.title}` : newEntry.title).trim();
  const baseLabel = remainderText.length > 0 ? `${displayDate} — ${remainderText}` : displayDate;
  const newIndexEntry: IndexEntry = {
    path: newEntry.path,
    date: isoDate,
    displayDate,
    remainder: remainderText,
    originalLabel: baseLabel,
    issueNumber: newEntry.issueNumber
  };

  if (!existingContent.rows || existingContent.rows.length === 0) {
    const newLink = formatIndexLine(newIndexEntry);
    const initialContent = `# Release Notes\n\nWelcome to the release notes page where you can see all [NGX-Ramblers](https://ngx-ramblers.org.uk/) releases along with documented notes about how to use the new or changed features. Click on any of the links below👇 (most recent first) to see what's been going on with the project!\n\n${newLink}`;

    return {
      ...existingContent,
      rows: [
        {
          type: PageContentType.TEXT,
          showSwiper: false,
          maxColumns: 1,
          columns: [
            {
              contentText: initialContent,
              columns: 12
            } satisfies PageContentColumn
          ]
        }
      ]
    };
  }

  const textRow = existingContent.rows.find(row => row.type === PageContentType.TEXT);
  if (!textRow || !textRow.columns || textRow.columns.length === 0) {
    return existingContent;
  }

  const column = textRow.columns[0];
  const currentContent = column.contentText || "";
  const lines = currentContent.split("\n");
  const firstEntryIndex = lines.findIndex(line => entryLineRegex.test(line.trim()));
  const preambleLines = firstEntryIndex === -1 ? lines : lines.slice(0, firstEntryIndex);
  const entryLines = firstEntryIndex === -1 ? [] : lines.slice(firstEntryIndex);

  const parsedEntries = entryLines
    .map(line => parseIndexLine(line))
    .filter((entry): entry is IndexEntry => Boolean(entry))
    .filter(entry => allowUnassigned || !entry.path.endsWith("-other"));
  const entries = new Map<string, IndexEntry>(parsedEntries.map(entry => [indexEntryKey(entry), entry]));

  entries.set(indexEntryKey(newIndexEntry), newIndexEntry);

  const sortedEntries = Array.from(entries.values()).sort(compareIndexEntries);
  const listLines = sortedEntries.map(formatIndexLine);
  const preambleText = preambleLines.join("\n").replace(/\s+$/, "");

  const sections: string[] = [];
  if (preambleText.trim().length > 0) {
    sections.push(preambleText.trim());
  }
  if (listLines.length > 0) {
    sections.push(listLines.join("\n"));
  }

  column.contentText = sections.join("\n\n");

  return existingContent;
}

export function extractExistingBuildMetadata(page: PageContent | null): { buildNumber: string; buildUrl: string | null } | null {
  let metadata: { buildNumber: string; buildUrl: string | null } | null = null;

  if (page && page.rows?.length) {
    const textColumns = page.rows
      .filter(row => row.type === PageContentType.TEXT)
      .flatMap(row => row.columns || []);

    const contentText = textColumns
      .map(column => column.contentText || "")
      .find(text => text.includes("Build #") || text.includes("GitHub #") || text.includes("## [#") || text.includes("## #"));

    if (contentText) {
      const buildLine = contentText
        .split("\n")
        .map(line => line.trim())
        .find(line => line.startsWith("## [Build #") || line.startsWith("## [#") || line.startsWith("## #") || line.startsWith("## [GitHub #") || line.startsWith("## GitHub #"));

      if (buildLine) {
        const linkedMatch = buildLine.match(/## \[(?:GitHub |Build )?#(\d+)\]\(([^)]+)\)/);
        if (linkedMatch) {
          metadata = {
            buildNumber: linkedMatch[1],
            buildUrl: linkedMatch[2] || null
          };
        } else {
          const plainMatch = buildLine.match(/## (?:GitHub )?#(\d+)/);
          if (plainMatch) {
            metadata = {
              buildNumber: plainMatch[1],
              buildUrl: null
            };
          }
        }
      }
    }
  }

  return metadata;
}

export function extractPrimaryIssue(commits: ConventionalCommit[]): string | null {
  for (const commit of commits) {
    if (commit.issueReferences.length > 0) {
      return commit.issueReferences[0].issue;
    }
  }
  return null;
}

export function createReleaseNotesData(
  commits: ConventionalCommit[],
  buildNumber: string | null,
  githubRepo: string
): ReleaseNotesData {
  const latestCommit = commits[0];
  const groups = groupCommitsByType(commits);
  const title = generateTitle(commits);
  const issueNumber = extractPrimaryIssue(commits);

  return {
    date: latestCommit.date,
    buildNumber,
    commitSha: latestCommit.hash,
    commitHash: latestCommit.shortHash,
    commitUrl: `https://github.com/${githubRepo}/commit/${latestCommit.hash}`,
    buildUrl: null,
    issueNumber,
    issueUrl: issueNumber ? `https://github.com/${githubRepo}/issues/${issueNumber}` : null,
    title,
    groups,
    allCommits: commits
  };
}
