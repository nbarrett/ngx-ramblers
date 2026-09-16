export async function runWithRetries<T>(action: () => Promise<T>, attempts: number, backoffMs: number, onRetry: (attempt: number, error: Error) => void, attempt = 1): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (attempt < attempts) {
      onRetry(attempt, error as Error);
      await new Promise(resolve => setTimeout(resolve, backoffMs * attempt));
      return runWithRetries(action, attempts, backoffMs, onRetry, attempt + 1);
    } else {
      throw error;
    }
  }
}
