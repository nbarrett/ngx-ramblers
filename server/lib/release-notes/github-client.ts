import debug from "debug";

const debugLog = debug("release-notes:github");
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
