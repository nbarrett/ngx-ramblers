type ProgressFn = (data: any) => void;

let progressSender: ProgressFn | null = null;
let errorSender: ProgressFn | null = null;
const cancellation = {reason: null as string | null};

export class MigrationCancelledError extends Error {}

export function cancelMigration(reason: string): void {
  cancellation.reason = reason;
}

export function resetMigrationCancellation(): void {
  cancellation.reason = null;
}

export function assertMigrationNotCancelled(): void {
  if (cancellation.reason) {
    throw new MigrationCancelledError(cancellation.reason);
  }
}

export function setProgressSender(fn: ProgressFn | null): void {
  progressSender = fn;
}

export function progress(message: string, extra?: any): void {
  assertMigrationNotCancelled();
  if (progressSender) {
    progressSender({ message, ...(extra || {}) });
  }
}

export function setErrorSender(fn: ProgressFn | null): void {
  errorSender = fn;
}

export function errorEvent(message: string, extra?: any): void {
  if (errorSender) {
    errorSender({ message, ...(extra || {}) });
  }
}
