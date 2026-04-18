import type { Reporter, TestCase, TestResult, TestStep } from "@playwright/test/reporter";
import debug from "debug";
import { DateTime } from "luxon";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { IntegrationWorkerEventType } from "../../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { signRamblersUploadBody } from "../../ramblers/integration-worker-crypto";

const debugLog = debug("ngx-ramblers:realtime-step-reporter");
debugLog.enabled = true;

const SUCCESS_OUTCOME_CODE = 64;
const FAILED_OUTCOME_CODE = 2;

export default class RealtimeStepReporter implements Reporter {

  private readonly callbackBaseUrl = process.env[Environment.INTEGRATION_WORKER_CALLBACK_BASE_URL];
  private readonly callbackProgressPath = process.env[Environment.INTEGRATION_WORKER_CALLBACK_PROGRESS_PATH];
  private readonly sharedSecret = process.env[Environment.INTEGRATION_WORKER_CALLBACK_SECRET];
  private readonly jobId = process.env[Environment.INTEGRATION_WORKER_JOB_ID];
  private readonly configured: boolean;
  private readonly pendingPosts: Promise<unknown>[] = [];

  constructor() {
    this.configured = Boolean(this.callbackBaseUrl && this.callbackProgressPath && this.sharedSecret && this.jobId);
    if (!this.configured) {
      debugLog(`disabled: callback env not set (baseUrl=${!!this.callbackBaseUrl} path=${!!this.callbackProgressPath} secret=${!!this.sharedSecret} jobId=${!!this.jobId})`);
    } else {
      debugLog(`enabled: will POST each test.step as it completes to ${this.callbackBaseUrl}${this.callbackProgressPath}`);
    }
  }

  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (!this.configured) {
      return;
    }
    if (step.category !== "test.step") {
      return;
    }
    const timestamp = DateTime.fromMillis(step.startTime.getTime() + (step.duration || 0)).toUTC().toISO() ?? "";
    const payload = {
      eventData: {
        timestamp,
        details: { name: step.title },
        outcome: step.error
          ? { code: FAILED_OUTCOME_CODE, error: { message: step.error.message || String(step.error), stack: step.error.stack } }
          : { code: SUCCESS_OUTCOME_CODE }
      },
      finished: false
    };
    this.pendingPosts.push(this.post(payload));
  }

  async onEnd(): Promise<void> {
    if (this.pendingPosts.length > 0) {
      await Promise.allSettled(this.pendingPosts);
    }
  }

  private async post(payload: unknown): Promise<void> {
    const url = `${this.callbackBaseUrl}${this.callbackProgressPath}`;
    const body = JSON.stringify({
      jobId: this.jobId,
      type: IntegrationWorkerEventType.TEST_STEP,
      payload: JSON.stringify(payload)
    });
    const signature = signRamblersUploadBody(body, this.sharedSecret!);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-ramblers-upload-signature": signature },
        body
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        debugLog(`POST failed status=${response.status} body=${text.slice(0, 200)}`);
      }
    } catch (error) {
      debugLog(`POST error: ${(error as Error).message}`);
    }
  }
}
