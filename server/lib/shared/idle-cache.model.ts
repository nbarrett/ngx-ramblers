export interface IdleCached<T> {
  get(): Promise<T>;
  clear(): void;
}

export interface IdleCacheState<T> {
  value?: T;
  loadPromise?: Promise<T>;
  lastUsed: number;
  timer?: NodeJS.Timeout;
  generation: number;
}
