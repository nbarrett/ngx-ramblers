type ProgressFn = (data: any) => void;

let progressSender: ProgressFn | null = null;
let errorSender: ProgressFn | null = null;

export function setProgressSender(fn: ProgressFn | null): void {
  progressSender = fn;
}

export function progress(message: string, extra?: any): void {
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
