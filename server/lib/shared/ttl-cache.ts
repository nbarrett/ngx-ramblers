import { TtlCached, TtlCacheEntry } from "./ttl-cache.model";
import { dateTimeNowAsValue } from "./dates";

export function ttlCached<T>(ttlMs: number): TtlCached<T> {
  const entries = new Map<string, TtlCacheEntry<T>>();

  return {
    get(key: string, loader: () => Promise<T>): Promise<T> {
      const existing = entries.get(key);
      const now = dateTimeNowAsValue();
      if (existing?.loadPromise) {
        return existing.loadPromise;
      } else if (existing?.value !== undefined && existing.expiresAt > now) {
        return Promise.resolve(existing.value);
      } else {
        const loadPromise = loader()
          .then(value => {
            entries.set(key, {value, expiresAt: dateTimeNowAsValue() + ttlMs});
            return value;
          })
          .catch(error => {
            entries.delete(key);
            throw error;
          });
        entries.set(key, {loadPromise, expiresAt: now + ttlMs});
        return loadPromise;
      }
    },
    clear(): void {
      entries.clear();
    }
  };
}
