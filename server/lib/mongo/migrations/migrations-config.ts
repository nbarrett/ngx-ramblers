import * as path from "path";

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
    url: process.env.MONGODB_URI || "mongodb://localhost:27017",
    options: {}
  },

  migrationsDir: path.resolve(__dirname, "database"),

  changelogCollectionName: "changelog",

  lockCollectionName: "changelog_lock",

  lockTtl: 300,

  migrationFileExtension: process.env.NODE_ENV === "production" ? ".js" : ".ts",

  useFileHash: false,

  moduleSystem: "esm",
};
