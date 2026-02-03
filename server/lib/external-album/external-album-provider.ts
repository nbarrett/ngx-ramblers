import {
  ExternalAlbumMetadata,
  ExternalAlbumSource,
  ExternalPhoto
} from "../../../projects/ngx-ramblers/src/app/models/system.model";

export interface AlbumProviderConfig {
  apiKey?: string;
  userId?: string;
}

export type ProviderProgressCallback = (message: string) => void;

export interface ExternalAlbumProvider {
  source: ExternalAlbumSource;
  parseAlbumUrl(url: string): ParsedAlbumUrl | null;
  fetchAlbumMetadata(config: AlbumProviderConfig, parsedUrl: ParsedAlbumUrl, onProgress?: ProviderProgressCallback): Promise<ExternalAlbumMetadata>;
}

export interface ParsedAlbumUrl {
  userId: string;
  albumId: string;
  originalUrl: string;
  isShortUrl?: boolean;
  expectedPhotoCount?: number;
}

export function createProviderRegistry(): Map<ExternalAlbumSource, ExternalAlbumProvider> {
  return new Map();
}

export function registerProvider(
  registry: Map<ExternalAlbumSource, ExternalAlbumProvider>,
  provider: ExternalAlbumProvider
): void {
  registry.set(provider.source, provider);
}

export function providerFor(
  registry: Map<ExternalAlbumSource, ExternalAlbumProvider>,
  source: ExternalAlbumSource
): ExternalAlbumProvider | undefined {
  return registry.get(source);
}

export function detectProviderFromUrl(
  registry: Map<ExternalAlbumSource, ExternalAlbumProvider>,
  url: string
): ExternalAlbumProvider | undefined {
  const providers = Array.from(registry.values());
  return providers.find(provider => provider.parseAlbumUrl(url) !== null);
}
