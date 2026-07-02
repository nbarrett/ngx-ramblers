import { IdleCached, IdleCacheState } from "./idle-cache.model";
import { dateTimeNowAsValue } from "./dates";

export function idleCached<T>(loader: () => Promise<T>, idleMs: number): IdleCached<T> {
  const state: IdleCacheState<T> = {lastUsed: 0, generation: 0};

  const scheduleEviction = () => {
    if (state.timer) {
      clearTimeout(state.timer);
    }
    const timer = setTimeout(() => {
      delete state.timer;
      if (dateTimeNowAsValue() - state.lastUsed >= idleMs) {
        delete state.value;
      } else {
        scheduleEviction();
      }
    }, idleMs);
    timer.unref();
    state.timer = timer;
  };

  return {
    get(): Promise<T> {
      state.lastUsed = dateTimeNowAsValue();
      if (state.value !== undefined) {
        scheduleEviction();
        return Promise.resolve(state.value);
      }
      if (!state.loadPromise) {
        const generation = state.generation;
        const loadPromise = loader()
          .then(value => {
            if (generation === state.generation) {
              state.value = value;
              scheduleEviction();
            }
            return value;
          })
          .finally(() => {
            if (state.loadPromise === loadPromise) {
              delete state.loadPromise;
            }
          });
        state.loadPromise = loadPromise;
      }
      return state.loadPromise;
    },
    clear(): void {
      state.generation += 1;
      if (state.timer) {
        clearTimeout(state.timer);
        delete state.timer;
      }
      delete state.value;
      delete state.loadPromise;
    }
  };
}
