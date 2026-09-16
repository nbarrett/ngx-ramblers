export interface TtlCached<T> {
  get(key: string, loader: () => Promise<T>): Promise<T>;
  clear(): void;
}

export interface TtlCacheEntry<T> {
  value?: T;
  loadPromise?: Promise<T>;
  expiresAt: number;
}
