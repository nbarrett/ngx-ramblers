import { Ai, AiProviderType } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { TextGenerationProvider } from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import { openAiCompatibleProvider } from "./openai-compatible-provider";

export function aiProviderFor(config: Ai): TextGenerationProvider {
  if (!config?.enabled) {
    throw new Error("AI text generation is not enabled");
  }
  if (!config?.baseUrl || !config?.model) {
    throw new Error("Configure an AI base URL and model in System Settings first");
  }
  switch (config.provider) {
    case AiProviderType.OPENAI_COMPATIBLE:
    default:
      return openAiCompatibleProvider(config);
  }
}
