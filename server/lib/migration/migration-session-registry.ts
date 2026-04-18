import WebSocket from "ws";

export interface MigrationSession {
  jobId: string;
  ws: WebSocket;
  siteIdentifier: string;
  siteName: string;
  historyId: string;
  startedAt: number;
}

const activeMigrationSessions = new Map<string, MigrationSession>();

export function registerMigrationSession(session: MigrationSession): void {
  activeMigrationSessions.set(session.jobId, session);
}

export function currentMigrationSession(jobId: string | undefined): MigrationSession | undefined {
  if (!jobId) {
    return undefined;
  }
  return activeMigrationSessions.get(jobId);
}

export function completeMigrationSession(jobId: string): void {
  activeMigrationSessions.delete(jobId);
}

export function activeMigrationJobIds(): string[] {
  return Array.from(activeMigrationSessions.keys());
}
