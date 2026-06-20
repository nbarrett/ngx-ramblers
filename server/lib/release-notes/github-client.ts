import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("release-notes:github"));
debugLog.enabled = true;

interface WorkflowRunResult {
  id: string;
  url: string | null;
  number: string | null;
}

const WORKFLOW_FILE = "build-push-and-deploy-ngx-ramblers-docker-image.yml";

function githubHeaders(token: string) {
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json"
  };
}

export async function findWorkflowRunByCommit(repo: string, commitSha: string, token: string | null): Promise<WorkflowRunResult | null> {
  let workflow: WorkflowRunResult | null = null;

  if (!token) {
    debugLog(`GitHub token not provided; skipping build lookup for ${commitSha}`);
  } else {
    const searchParams = new URLSearchParams({
      head_sha: commitSha,
      per_page: "1"
    });

    const url = `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?${searchParams.toString()}`;

    try {
      debugLog(`Looking up workflow run for ${commitSha} via ${WORKFLOW_FILE}`);
      const response = await fetch(url, { headers: githubHeaders(token) });
      if (response.ok) {
        const payload = await response.json();
        const run = payload?.workflow_runs?.[0];

        if (run) {
          workflow = {
            id: String(run.id),
            url: run.html_url || null,
            number: run.run_number ? String(run.run_number) : null
          };
          const displayNumber = workflow.number || workflow.id;
          debugLog(`Resolved workflow run ${displayNumber} (id ${workflow.id}) for ${commitSha}`);
        } else {
          debugLog(`No workflow runs found for ${commitSha}`);
        }
      } else {
        const errorBody = await response.text();
        debugLog(`GitHub run lookup failed: ${response.status} ${response.statusText} - ${errorBody}`);
      }
    } catch (error) {
      debugLog(`GitHub run lookup error: ${error}`);
    }
  }

  return workflow;
}

// Build a run-number -> run-URL map for the build/deploy workflow. Release-note headings carry the
// GitHub run number (e.g. #706), but sibling pages from the same push share that number while only the
// push tip is any run's head_sha - so a commit-SHA lookup misses them. Listing the workflow's runs and
// keying by run_number resolves every page. Pages newest-first; stops once every needed number is found.
export async function fetchWorkflowRunNumberMap(repo: string, neededNumbers: Set<string>, token: string | null): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!token || neededNumbers.size === 0) {
    if (!token) {
      debugLog("GitHub token not provided; skipping run-number map");
    }
    return map;
  }

  const remaining = new Set(neededNumbers);
  const maxPages = 30;

  const fetchPage = async (page: number): Promise<void> => {
    if (page > maxPages || remaining.size === 0) {
      return;
    }
    const searchParams = new URLSearchParams({ per_page: "100", page: String(page) });
    const url = `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?${searchParams.toString()}`;
    try {
      const response = await fetch(url, { headers: githubHeaders(token) });
      if (!response.ok) {
        debugLog(`GitHub run list failed on page ${page}: ${response.status} ${response.statusText}`);
        return;
      }
      const payload = await response.json();
      const runs = payload?.workflow_runs || [];
      if (runs.length === 0) {
        return;
      }
      runs.forEach((run: { run_number?: number; html_url?: string }) => {
        const runNumber = run.run_number ? String(run.run_number) : null;
        if (runNumber && run.html_url && remaining.has(runNumber)) {
          map.set(runNumber, run.html_url);
          remaining.delete(runNumber);
        }
      });
      await fetchPage(page + 1);
    } catch (error) {
      debugLog(`GitHub run list error on page ${page}: ${error}`);
    }
  };

  await fetchPage(1);

  debugLog(`Resolved ${map.size} of ${neededNumbers.size} requested run numbers`);
  return map;
}
