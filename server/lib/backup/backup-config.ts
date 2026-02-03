import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  BackupConfig,
  EnvironmentBackupConfig
} from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";
import { EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import * as config from "../mongo/controllers/config";

export async function configuredBackup(): Promise<BackupConfig> {
  const envsConfigDoc: ConfigDocument = await config.queryKey(ConfigKey.ENVIRONMENTS);
  const envsConfig: EnvironmentsConfig = envsConfigDoc?.value;

  if (!envsConfig?.environments?.length) {
    throw new Error("No environments configured in ENVIRONMENTS config. Configure environments via the Settings page.");
  }

  return {
    environments: envsConfig.environments.map(env => ({
      environment: env.environment,
      aws: env.aws ? {
        bucket: env.aws.bucket,
        region: env.aws.region,
        accessKeyId: env.aws.accessKeyId,
        secretAccessKey: env.aws.secretAccessKey
      } : undefined,
      mongo: env.mongo ? {
        cluster: env.mongo.cluster,
        db: env.mongo.db,
        username: env.mongo.username,
        password: env.mongo.password
      } : undefined,
      flyio: env.flyio ? {
        apiKey: env.flyio.apiKey,
        appName: env.flyio.appName,
        memory: env.flyio.memory,
        scaleCount: env.flyio.scaleCount,
        organisation: env.flyio.organisation
      } : undefined
    })),
    aws: envsConfig.aws ? {
      bucket: envsConfig.aws.bucket,
      region: envsConfig.aws.region,
      accessKeyId: envsConfig.aws.accessKeyId,
      secretAccessKey: envsConfig.aws.secretAccessKey
    } : undefined
  };
}

export function environmentConfigFor(backupConfig: BackupConfig, environmentName: string): EnvironmentBackupConfig | undefined {
  return backupConfig.environments?.find(env => env.environment === environmentName);
}
