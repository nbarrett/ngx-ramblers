import debug from "debug";

const createMigrationLogger = (migrationName: string) => {
  const debugLog = debug(`ngx-ramblers:migration:${migrationName}`);
  debugLog.enabled = true;
  return debugLog;
};

export default createMigrationLogger;
