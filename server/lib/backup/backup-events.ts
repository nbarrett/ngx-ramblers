import { EventEmitter } from "events";
import { BackupSession } from "../mongo/models/backup-session";
import { S3BackupManifest } from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";

export interface BackupEventMap {
  "manifest-created": { manifest: S3BackupManifest };
  "manifest-deleted": { id: string };
  "session-updated": { session: BackupSession };
}

class BackupEventEmitter extends EventEmitter {
  emit<K extends keyof BackupEventMap>(event: K, payload: BackupEventMap[K]): boolean {
    return super.emit(event, payload);
  }
  on<K extends keyof BackupEventMap>(event: K, listener: (payload: BackupEventMap[K]) => void): this {
    return super.on(event, listener);
  }
  off<K extends keyof BackupEventMap>(event: K, listener: (payload: BackupEventMap[K]) => void): this {
    return super.off(event, listener);
  }
}

export const backupEvents = new BackupEventEmitter();
backupEvents.setMaxListeners(50);
