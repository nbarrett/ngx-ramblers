export interface ConventionalCommit {
  hash: string;
  shortHash: string;
  date: string;
  type: string;
  scope: string | null;
  subject: string;
  body: string;
  footer: string;
  issueReferences: IssueReference[];
  breakingChange: boolean;
}

export interface IssueReference {
  action: string | null;
  issue: string;
  raw: string;
}

export interface CommitGroup {
  type: string;
  title: string;
  commits: ConventionalCommit[];
}

export interface ReleaseNotesData {
  date: string;
  buildNumber: string | null;
  commitSha: string;
  commitHash: string;
  commitUrl: string;
  buildUrl: string | null;
  issueNumber: string | null;
  issueUrl: string | null;
  title: string;
  groups: CommitGroup[];
  allCommits: ConventionalCommit[];
}

export interface ReleaseNotesConfig {
  cmsUrl: string;
  username: string;
  password: string;
  githubRepo: string;
  githubToken: string | null;
  indexPath: string;
}

export interface GenerateOptions {
  since?: string;
  until?: string;
  sinceDate?: string;
  untilDate?: string;
  latest?: boolean;
  all?: boolean;
  dryRun?: boolean;
  buildNumber?: string;
  includeUnassigned?: boolean;
}

export interface CMSAuth {
  baseUrl: string;
  authToken: string;
}
