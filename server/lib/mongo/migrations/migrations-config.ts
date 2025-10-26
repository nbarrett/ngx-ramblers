import * as path from "path";
import { envConfig } from "../../env-config/env-config";

export interface MigrateMongoConfig {
  mongodb: {
    url: string;
    options: Record<string, any>;
  };
  migrationsDir: string;
  changelogCollectionName: string;
  lockCollectionName: string;
  lockTtl: number;
  migrationFileExtension: string;
  useFileHash: boolean;
  moduleSystem: string;
}

export const migrateMongoConfig: MigrateMongoConfig = {
  mongodb: {
    url: envConfig.mongo.uri,
    options: {}
  },

  migrationsDir: path.resolve(__dirname, "database"),

  changelogCollectionName: "changelog",

  lockCollectionName: "changelog_lock",

  lockTtl: 300,

  migrationFileExtension: ".js",

  useFileHash: false,

  moduleSystem: "esm",
};
