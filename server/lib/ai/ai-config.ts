import { Ai, AiProviderType } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";

export function aiConfigFromEnvironment(): Ai {
  return {
    enabled: envConfig.booleanValue(Environment.AI_ENABLED),
    provider: (envConfig.value(Environment.AI_PROVIDER) as AiProviderType) || AiProviderType.OPENAI_COMPATIBLE,
    baseUrl: envConfig.value(Environment.AI_BASE_URL),
    model: envConfig.value(Environment.AI_MODEL),
    apiKey: envConfig.value(Environment.AI_API_KEY)
  };
}
