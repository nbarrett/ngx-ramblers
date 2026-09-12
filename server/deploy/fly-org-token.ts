import { EnvironmentsConfig } from "../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { Environment } from "../../projects/ngx-ramblers/src/app/models/environment.model";

export function applyFlyOrganisationToken(dbConfig: EnvironmentsConfig): void {
  const token = dbConfig?.uploadWorker?.apiKey || dbConfig?.environments?.find(env => env.flyio?.apiKey)?.flyio?.apiKey;
  if (token) {
    process.env[Environment.FLY_API_TOKEN] = token;
  }
}
