export interface EmptyCollectionCandidate {
  environment: string;
  cluster: string;
  database: string;
  collection: string;
  documentCount: number;
  indexCount: number;
}

export interface EmptyCollectionEnvironmentGroup {
  environment: string;
  cluster: string;
  database: string;
  collectionCount: number;
  contentCollectionCount: number;
  candidates: EmptyCollectionCandidate[];
}

export interface EnvironmentCollectionInventory {
  candidates: EmptyCollectionCandidate[];
  contentCollectionCount: number;
}

export interface EnvironmentContentCollectionCount {
  environment: string;
  count: number;
}

export interface EmptyCollectionCleanupPreview {
  cluster: string;
  candidates: EmptyCollectionCandidate[];
  contentCollectionCounts: EnvironmentContentCollectionCount[];
}

export interface EmptyCollectionCleanupResult {
  removed: EmptyCollectionCandidate[];
  skipped: EmptyCollectionCandidate[];
}
