import { EnvironmentConfig, EnvironmentsConfig } from "../../projects/ngx-ramblers/src/app/models/environment-config.model";

export const PRE_MAIN_AUTO_DEPLOY_TARGET = "staging";

export function autoDeployTargetFrom(dbTarget: string | undefined): string | undefined {
  return dbTarget || (process.env.GITHUB_REF_NAME === "pre-main" ? PRE_MAIN_AUTO_DEPLOY_TARGET : undefined);
}

export function autoDeployEnvFrom(dbConfig: EnvironmentsConfig | undefined): EnvironmentConfig | undefined {
  const target = autoDeployTargetFrom(dbConfig?.autoDeployTarget);
  return target ? (dbConfig?.environments || []).find(env => env.environment === target) : undefined;
}
