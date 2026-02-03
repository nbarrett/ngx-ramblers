import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import {
  ExternalAlbumImportRequest,
  ExternalAlbumMetadata,
  ExternalAlbumSource,
  ExternalAlbumSummary,
  ExternalBulkImportRequest,
  SystemConfig
} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { config } from "../mongo/models/config";
import * as transforms from "../mongo/controllers/transforms";
import {
  AlbumProviderConfig,
  createProviderRegistry,
  detectProviderFromUrl,
  ExternalAlbumProvider,
  providerFor,
  registerProvider
} from "./external-album-provider";
import { fetchUserAlbums, flickrProvider, parseUserAlbumsUrl } from "./flickr-provider";
import { buildSplitPreviewEntries, importExternalAlbum } from "./external-album-import-service";
import { pluraliseWithCount } from "../shared/string-utils";
import { toKebabCase } from "../../../projects/ngx-ramblers/src/app/functions/strings";

const debugLog = debug(envConfig.logNamespace("external-album-ws-handler"));
debugLog.enabled = true;

const providerRegistry = createProviderRegistry();
registerProvider(providerRegistry, flickrProvider);

function sendProgress(ws: WebSocket, message: string, data?: any): void {
  ws.send(JSON.stringify({
    type: MessageType.PROGRESS,
    data: { message, ...data }
  }));
}

function sendError(ws: WebSocket, message: string, data?: any): void {
  ws.send(JSON.stringify({
    type: MessageType.ERROR,
    data: { action: ApiAction.QUERY, message, ...data }
  }));
}

function sendComplete(ws: WebSocket, message: string, data?: any): void {
  ws.send(JSON.stringify({
    type: MessageType.COMPLETE,
    data: { action: ApiAction.UPDATE, message, ...data }
  }));
}

async function systemConfig(): Promise<SystemConfig | null> {
  const result = await config.findOne({}).exec();
  return result ? transforms.toObjectWithId(result) : null;
}

function providerConfigFor(systemConfig: SystemConfig, source: ExternalAlbumSource): AlbumProviderConfig {
  if (source === ExternalAlbumSource.FLICKR) {
    const flickrConfig = systemConfig.externalSystems?.flickr;
    return {
      apiKey: flickrConfig?.apiKey || "",
      userId: flickrConfig?.userId || ""
    };
  }
  return { apiKey: "", userId: "" };
}

export async function handleExternalAlbumFetch(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleExternalAlbumFetch: received request", data);

  try {
    const albumUrl = data?.albumUrl;
    const source = data?.source as ExternalAlbumSource | undefined;

    if (!albumUrl) {
      sendError(ws, "Album URL is required");
      return;
    }

    sendProgress(ws, "Looking up system configuration...");

    const sysConfig = await systemConfig();
    if (!sysConfig) {
      sendError(ws, "System configuration not found");
      return;
    }

    let provider: ExternalAlbumProvider | undefined;
    let detectedSource: ExternalAlbumSource | undefined;

    if (source) {
      provider = providerFor(providerRegistry, source);
      detectedSource = source;
    } else {
      provider = detectProviderFromUrl(providerRegistry, albumUrl);
      detectedSource = provider?.source;
    }

    if (!provider || !detectedSource) {
      sendError(ws, "Unable to detect album source from URL. Supported sources: Flickr");
      return;
    }

    const providerConfig = providerConfigFor(sysConfig, detectedSource);

    sendProgress(ws, `Detected ${detectedSource} album. Parsing URL...`);

    const parsedUrl = provider.parseAlbumUrl(albumUrl);
    if (!parsedUrl) {
      sendError(ws, `Invalid ${detectedSource} album URL format`);
      return;
    }

    sendProgress(ws, `Fetching album metadata from ${detectedSource}...`);

    const albumMetadata: ExternalAlbumMetadata = await provider.fetchAlbumMetadata(providerConfig, parsedUrl);

    debugLog("handleExternalAlbumFetch: fetched metadata for album", albumMetadata.title, "with", albumMetadata.photoCount, "photos");

    sendComplete(ws, `Found album "${albumMetadata.title}" with ${pluraliseWithCount(albumMetadata.photoCount, "photo")}`, {
      albumMetadata
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch album";
    debugLog("handleExternalAlbumFetch: error", message);
    sendError(ws, message);
  }
}

export async function handleExternalAlbumSplitPreview(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleExternalAlbumSplitPreview: received request", data);

  try {
    const source = data?.source as ExternalAlbumSource || ExternalAlbumSource.FLICKR;
    const userId = data?.userId || "";
    const albumId = data?.albumId || "";
    const targetPath = data?.targetPath || "";

    if (!userId || !albumId || !targetPath) {
      sendError(ws, "Split preview requires user ID, album ID, and target path", { context: "split-preview", albumId });
    } else {
      sendProgress(ws, `Preparing split preview for album "${albumId}"...`, { context: "split-preview", albumId });

      const sysConfig = await systemConfig();
      if (!sysConfig) {
        sendError(ws, "System configuration not found", { context: "split-preview", albumId });
      } else {
        const providerConfig = providerConfigFor(sysConfig, source);
        const provider = providerFor(providerRegistry, source);
        if (!provider) {
          sendError(ws, `Provider not found for ${source}`, { context: "split-preview", albumId });
        } else {
          const parsedUrl = {
            userId,
            albumId,
            originalUrl: "",
            expectedPhotoCount: undefined
          };

          const albumMetadata = await provider.fetchAlbumMetadata(providerConfig, parsedUrl, (progressMessage) => {
            sendProgress(ws, progressMessage, { context: "split-preview", albumId });
          });

          const splitPreview = buildSplitPreviewEntries(targetPath, albumMetadata);

          sendComplete(ws, `Split preview ready for "${albumMetadata.title}"`, {
            albumId,
            splitPreview
          });
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build split preview";
    debugLog("handleExternalAlbumSplitPreview: error", message);
    sendError(ws, message, { context: "split-preview", albumId: data?.albumId });
  }
}

export async function handleExternalAlbumImport(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleExternalAlbumImport: received request", data);

  try {
    const request: ExternalAlbumImportRequest = {
      source: data?.source || ExternalAlbumSource.FLICKR,
      albumUrl: data?.albumUrl || "",
      targetPath: data?.targetPath || "",
      albumTitle: data?.albumTitle,
      albumSubtitle: data?.albumSubtitle,
      splitByPhotoTitle: data?.splitByPhotoTitle,
      splitAlbumPaths: data?.splitAlbumPaths
    };

    const albumMetadata: ExternalAlbumMetadata | undefined = data?.albumMetadata;
    const createdBy: string = data?.createdBy || "unknown";

    if (!request.albumUrl) {
      sendError(ws, "Album URL is required");
      return;
    }

    if (!request.targetPath) {
      sendError(ws, "Target path is required");
      return;
    }

    if (!albumMetadata) {
      sendError(ws, "Album metadata is required. Please fetch the album first.");
      return;
    }

    sendProgress(ws, `Starting import of "${albumMetadata.title}" to "${request.targetPath}"...`);

    const result = await importExternalAlbum(request, albumMetadata, createdBy, (progress) => {
      sendProgress(ws, progress.message, { progress });
    });

    if (result.success) {
      debugLog("handleExternalAlbumImport: completed successfully", result);
      sendComplete(ws, `Successfully imported ${pluraliseWithCount(result.photoCount, "photo")} to "${result.albumName}"`, {
        importResult: result
      });
    } else {
      debugLog("handleExternalAlbumImport: failed", result.errorMessage);
      sendError(ws, result.errorMessage || "Import failed");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    debugLog("handleExternalAlbumImport: error", message);
    sendError(ws, message);
  }
}

export async function handleExternalUserAlbumsFetch(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleExternalUserAlbumsFetch: received request", data);

  try {
    const userAlbumsUrl = data?.userAlbumsUrl;
    const source = data?.source as ExternalAlbumSource || ExternalAlbumSource.FLICKR;

    if (!userAlbumsUrl) {
      sendError(ws, "User albums URL is required");
      return;
    }

    sendProgress(ws, "Looking up system configuration...");

    const sysConfig = await systemConfig();
    if (!sysConfig) {
      sendError(ws, "System configuration not found");
      return;
    }

    const providerConfig = providerConfigFor(sysConfig, source);

    sendProgress(ws, `Parsing ${source} user albums URL...`);

    const userId = parseUserAlbumsUrl(userAlbumsUrl);
    if (!userId) {
      sendError(ws, `Invalid ${source} user albums URL format. Expected: flickr.com/people/username or flickr.com/photos/username/albums`);
      return;
    }

    sendProgress(ws, `Fetching albums for user "${userId}" from ${source}...`);

    const userAlbumsMetadata = await fetchUserAlbums(providerConfig, userId);

    debugLog("handleExternalUserAlbumsFetch: fetched", userAlbumsMetadata.totalAlbums, "albums for user", userId);

    sendComplete(ws, `Found ${pluraliseWithCount(userAlbumsMetadata.totalAlbums, "album")} for user "${userAlbumsMetadata.username}"`, {
      userAlbumsMetadata
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch user albums";
    debugLog("handleExternalUserAlbumsFetch: error", message);
    sendError(ws, message);
  }
}

export async function handleExternalBulkAlbumImport(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleExternalBulkAlbumImport: received request", data);

  try {
    const request: ExternalBulkImportRequest = {
      source: data?.source || ExternalAlbumSource.FLICKR,
      userId: data?.userId || "",
      basePath: data?.basePath || "gallery",
      albums: data?.albums || [],
      useTemplate: data?.useTemplate || false,
      templatePath: data?.templatePath || undefined,
      splitByPhotoTitle: data?.splitByPhotoTitle
    };

    const createdBy: string = data?.createdBy || "unknown";

    if (!request.userId) {
      sendError(ws, "User ID is required");
      return;
    }

    if (request.albums.length === 0) {
      sendError(ws, "No albums selected for import");
      return;
    }

    sendProgress(ws, "Looking up system configuration...");

    const sysConfig = await systemConfig();
    if (!sysConfig) {
      sendError(ws, "System configuration not found");
      return;
    }

    const providerConfig = providerConfigFor(sysConfig, request.source);

    const provider = providerFor(providerRegistry, request.source);
    if (!provider) {
      sendError(ws, `Provider not found for ${request.source}`);
      return;
    }

    const results: { album: ExternalAlbumSummary; success: boolean; error?: string }[] = [];
    let successCount = 0;
    let failureCount = 0;

    const albumsToProcess = request.albums.filter(a => a.selected);
    const totalAlbums = albumsToProcess.length;

    sendProgress(ws, `Starting bulk import of ${pluraliseWithCount(totalAlbums, "album")}...`);

    const albumEntries = albumsToProcess.map((album, index) => ({ album, index }));

    const processPromises = albumEntries.map(async ({ album: albumSummary, index }) => {
      const targetPath = albumSummary.targetPath || `${request.basePath}/${toKebabCase(albumSummary.title)}`;

      sendProgress(ws, `Fetching album ${index + 1}/${totalAlbums}: "${albumSummary.title}"...`, {
        currentAlbum: index + 1,
        totalAlbums,
        percent: Math.round(((index) / totalAlbums) * 100)
      });

      const parsedUrl = {
        userId: request.userId,
        albumId: albumSummary.id,
        originalUrl: "",
        expectedPhotoCount: albumSummary.photoCount
      };

      const albumMetadata = await provider.fetchAlbumMetadata(providerConfig, parsedUrl, (progressMessage) => {
        sendProgress(ws, `[${albumSummary.title}] ${progressMessage}`, {
          currentAlbum: index + 1,
          totalAlbums
        });
      });

      const importRequest: ExternalAlbumImportRequest = {
        source: request.source,
        albumUrl: "",
        targetPath,
        albumTitle: albumSummary.title,
        useTemplate: request.useTemplate,
        templatePath: request.templatePath,
        splitByPhotoTitle: request.splitByPhotoTitle,
        splitAlbumPaths: albumSummary.splitAlbumPaths
      };

      const importResult = await importExternalAlbum(importRequest, albumMetadata, createdBy, (progress) => {
        sendProgress(ws, `[${albumSummary.title}] ${progress.message}`, {
          currentAlbum: index + 1,
          totalAlbums,
          percent: Math.round(((index + progress.percent / 100) / totalAlbums) * 100)
        });
      });

      return { albumSummary, importResult };
    });

    const processedResults = await Promise.allSettled(processPromises);

    processedResults.forEach((result, index) => {
      const albumSummary = albumsToProcess[index];
      if (result.status === "fulfilled") {
        const { importResult } = result.value;
        if (importResult.success) {
          successCount++;
          results.push({ album: albumSummary, success: true });
        } else {
          failureCount++;
          results.push({ album: albumSummary, success: false, error: importResult.errorMessage });
        }
      } else {
        failureCount++;
        results.push({ album: albumSummary, success: false, error: result.reason?.message || "Unknown error" });
      }
    });

    debugLog("handleExternalBulkAlbumImport: completed", successCount, "succeeded,", failureCount, "failed");

    sendComplete(ws, `Bulk import complete: ${successCount} succeeded, ${failureCount} failed`, {
      bulkImportResult: {
        successCount,
        failureCount,
        results
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk import failed";
    debugLog("handleExternalBulkAlbumImport: error", message);
    sendError(ws, message);
  }
}
