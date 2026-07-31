import { Ai } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { aiProviderFor } from "./ai-provider-factory";
import { integrationWorkerConfigured, rewriteViaIntegrationWorker } from "./ai-worker-client";

export const MAX_GENERATED_TOKENS = 1024;

export async function generate(ai: Ai, systemPrompt: string, input: string): Promise<string> {
  return integrationWorkerConfigured()
    ? rewriteViaIntegrationWorker(ai, input, systemPrompt)
    : aiProviderFor(ai).generate({systemPrompt, input, maxTokens: MAX_GENERATED_TOKENS});
}
