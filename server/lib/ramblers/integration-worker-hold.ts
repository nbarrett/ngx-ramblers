const HOLD_ARRIVAL_WAIT_MS = 10 * 1000;

const waiters: Array<(arrived: boolean) => void> = [];

export function notifyWorkerHoldArrived(): void {
  waiters.splice(0).forEach(resolve => resolve(true));
}

export function waitForWorkerHoldArrival(timeoutMs = HOLD_ARRIVAL_WAIT_MS): Promise<boolean> {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      const index = waiters.indexOf(onArrive);
      if (index >= 0) {
        waiters.splice(index, 1);
      }
      resolve(false);
    }, timeoutMs);
    const onArrive = (arrived: boolean) => {
      clearTimeout(timer);
      resolve(arrived);
    };
    waiters.push(onArrive);
  });
}
