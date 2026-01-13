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
  manualMigrations?: string[];
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
  manualMigrations: [
    "20251118000000-set-status-on-migrated-walks.js",
    "20251118010000-enrich-migrated-walk-locations.js",
    "20260113000000-reverse-geocode-missing-postcodes.js",
    "20260113000001-geocode-from-title-description.js"
  ]
};
