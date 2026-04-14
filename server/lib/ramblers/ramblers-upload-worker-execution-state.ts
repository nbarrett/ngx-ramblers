import { RamblersUploadWorkerCallbackConfig } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-worker.model";

interface RemoteExecutionState {
  callback: RamblersUploadWorkerCallbackConfig;
  jobId: string;
  logStandardOut: boolean;
  sharedSecret: string;
}

let remoteExecutionState: RemoteExecutionState | null = null;

export function setRemoteRamblersUploadExecutionState(state: RemoteExecutionState): void {
  remoteExecutionState = state;
}

export function remoteRamblersUploadExecutionState(): RemoteExecutionState | null {
  return remoteExecutionState;
}

export function clearRemoteRamblersUploadExecutionState(): void {
  remoteExecutionState = null;
}

export function setRemoteRamblersUploadStandardOutLogging(enabled: boolean): void {
  if (remoteExecutionState) {
    remoteExecutionState = { ...remoteExecutionState, logStandardOut: enabled };
  }
}
