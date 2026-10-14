export interface CollectionIndexCache {
  collectionIdentity: string | null;
  building: boolean;
  pending: Promise<void>;
}
