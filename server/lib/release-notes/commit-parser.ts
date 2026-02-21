import { execSync } from "child_process";
import type { ConventionalCommit, IssueReference } from "./models.js";

const CONVENTIONAL_COMMIT_REGEX = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
const KEYWORD_ISSUE_REGEX = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|ref(?:erence)?(?:s)?|see):?\s*(?:#|https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/)(\d+)/gi;
const STANDALONE_ISSUE_REGEX = /(?:^|[\s(])#(\d+)(?=[\s).,;:]|$)/gm;

export function parseCommit(raw: string): ConventionalCommit | null {
  const lines = raw.split("\n");
  if (lines.length < 4) {
    return null;
  }

  const hash = lines[0].trim();
  const shortHash = lines[1].trim();
  const date = lines[2].trim();
  const rawMessageLines = lines.slice(3);
  const subject = (rawMessageLines.shift() || "").trim();
  const firstNonEmpty = rawMessageLines.findIndex(l => l.trim());
  const trimmedMessageLines = firstNonEmpty >= 0 ? rawMessageLines.slice(firstNonEmpty) : [];

  const footerStartIdx = trimmedMessageLines.findIndex(line => /^[A-Z][a-z-]+:/.test(line));
  const effectiveFooterStart = footerStartIdx >= 0 ? footerStartIdx : trimmedMessageLines.length;
  const body = trimmedMessageLines.slice(0, effectiveFooterStart).join("\n").trim();
  const footer = trimmedMessageLines.slice(effectiveFooterStart).join("\n").trim();

  const match = subject.match(CONVENTIONAL_COMMIT_REGEX);
  if (!match) {
    return {
      hash,
      shortHash,
      date,
      type: "other",
      scope: null,
      subject,
      body,
      footer,
      issueReferences: extractIssueReferences(subject + "\n" + body + "\n" + footer),
      breakingChange: subject.includes("BREAKING CHANGE") || body.includes("BREAKING CHANGE") || footer.includes("BREAKING CHANGE")
    };
  }

  const [, type, scope, breakingMarker, description] = match;

  return {
    hash,
    shortHash,
    date,
    type: type.toLowerCase(),
    scope: scope || null,
    subject: description,
    body,
    footer,
    issueReferences: extractIssueReferences(subject + "\n" + body + "\n" + footer),
    breakingChange: breakingMarker === "!" || subject.includes("BREAKING CHANGE") || body.includes("BREAKING CHANGE") || footer.includes("BREAKING CHANGE")
  };
}

function extractIssueReferences(text: string): IssueReference[] {
  const references: IssueReference[] = [];
  const seenIssues = new Set<string>();

  const keywordMatches = text.matchAll(KEYWORD_ISSUE_REGEX);
  Array.from(keywordMatches).forEach(match => {
    const action = match[0].split(/\s+/)[0].toLowerCase();
    const issue = match[1];
    if (!seenIssues.has(issue)) {
      seenIssues.add(issue);
      references.push({
        action: action !== "see" && action !== "ref" && action !== "reference" && action !== "references" ? action : null,
        issue,
        raw: match[0]
      });
    }
  });

  const standaloneMatches = text.matchAll(STANDALONE_ISSUE_REGEX);
  Array.from(standaloneMatches).forEach(match => {
    const issue = match[1];
    if (!seenIssues.has(issue)) {
      seenIssues.add(issue);
      references.push({
        action: null,
        issue,
        raw: `#${issue}`
      });
    }
  });

  return references;
}

export function gitLog(since?: string, until: string = "HEAD"): ConventionalCommit[] {
  const COMMIT_SEPARATOR = "---COMMIT-SEPARATOR---";
  const format = `${COMMIT_SEPARATOR}%n%H%n%h%n%cd%n%B`;
  const dateFormat = "--date=format:%Y-%m-%d";

  let command = `git log ${dateFormat} --format="${format}" --no-merges`;

  if (since) {
    command += ` ${since}..${until}`;
  } else {
    command += ` ${until}`;
  }

  try {
    const output = execSync(command, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024
    });

    const commits: ConventionalCommit[] = [];
    const rawCommits = output
      .split(COMMIT_SEPARATOR)
      .filter(c => c.trim())
      .map(c => c.trim());

    for (const rawCommit of rawCommits) {
      const parsed = parseCommit(rawCommit);
      if (parsed) {
        commits.push(parsed);
      }
    }

    return commits;
  } catch (error) {
    throw new Error(`Failed to fetch git log: ${error}`);
  }
}

export function gitLogSinceDate(date: string, until: string = "HEAD"): ConventionalCommit[] {
  const COMMIT_SEPARATOR = "---COMMIT-SEPARATOR---";
  const format = `${COMMIT_SEPARATOR}%n%H%n%h%n%cd%n%B`;
  const dateFormat = "--date=format:%Y-%m-%d";
  const command = `git log ${dateFormat} --format="${format}" --no-merges --since="${date}" ${until}`;

  try {
    const output = execSync(command, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024
    });

    const commits: ConventionalCommit[] = [];
    const rawCommits = output
      .split(COMMIT_SEPARATOR)
      .filter(c => c.trim())
      .map(c => c.trim());

    for (const rawCommit of rawCommits) {
      const parsed = parseCommit(rawCommit);
      if (parsed) {
        commits.push(parsed);
      }
    }

    return commits;
  } catch (error) {
    throw new Error(`Failed to fetch git log since date: ${error}`);
  }
}

export function findCommitByHash(hash: string): ConventionalCommit | null {
  const format = "%H%n%h%n%cd%n%B";
  const dateFormat = "--date=format:%Y-%m-%d";

  try {
    const output = execSync(
      `git log ${dateFormat} --format="${format}" -n 1 ${hash}`,
      { encoding: "utf-8" }
    );

    const trimmed = output.trim();
    if (!trimmed) {
      return null;
    }

    return parseCommit(trimmed);
  } catch (error) {
    return null;
  }
}

export function findCommitsSinceTag(tag: string): ConventionalCommit[] {
  try {
    execSync(`git rev-parse ${tag}`, { encoding: "utf-8", stdio: "pipe" });
    return gitLog(`${tag}..HEAD`);
  } catch {
    return gitLog();
  }
}

export function latestTag(): string | null {
  try {
    const output = execSync("git describe --tags --abbrev=0", {
      encoding: "utf-8",
      stdio: "pipe"
    });
    return output.trim();
  } catch {
    return null;
  }
}

export function commitsBetween(from: string, to: string = "HEAD"): ConventionalCommit[] {
  return gitLog(from, to);
}
