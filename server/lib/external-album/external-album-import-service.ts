import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { groupBy } from "es-toolkit/compat";
import { contentMetadata } from "../mongo/models/content-metadata";
import { pageContent } from "../mongo/models/page-content";
import * as transforms from "../mongo/controllers/transforms";
import { dateTimeNowAsValue } from "../shared/dates";
import { pluraliseWithCount } from "../shared/string-utils";
import { toKebabCase } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import {
  ExternalAlbumImportRequest,
  ExternalAlbumImportResult,
  ExternalAlbumMetadata,
  ExternalPhoto,
  RootFolder,
  SplitAlbumPreviewEntry
} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  ContentMetadata,
  ContentMetadataItem,
  RECENT_PHOTOS
} from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import {
  AlbumData,
  AlbumView,
  DEFAULT_GALLERY_OPTIONS,
  GridLayoutMode,
  GridViewOptions,
  ImageFit,
  IndexContentType,
  IndexRenderMode,
  PageContent,
  PageContentRow,
  PageContentType,
  StringMatch
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";

const debugLog = debug(envConfig.logNamespace("external-album-import-service"));
debugLog.enabled = true;

function photosToContentMetadataItems(photos: ExternalPhoto[]): ContentMetadataItem[] {
  return photos.map(photo => ({
    date: photo.dateTaken,
    image: photo.url,
    originalFileName: photo.title || photo.id,
    text: photo.title || ""
  }));
}

const EXTERNAL_ALBUM_GRID_OPTIONS: GridViewOptions = {
  showTitles: true,
  showDates: true,
  minColumns: 1,
  maxColumns: 2,
  layoutMode: GridLayoutMode.MASONRY,
  imageFit: ImageFit.CONTAIN,
  gap: 0
};

function createAlbumData(
  albumName: string,
  title: string,
  subtitle: string,
  coverPhotoUrl: string | undefined,
  createdBy: string
): AlbumData {
  const now = dateTimeNowAsValue();
  return {
    name: albumName,
    title,
    subtitle,
    showTitle: true,
    showCoverImageAndText: !!coverPhotoUrl,
    introductoryText: "",
    coverImageHeight: 300,
    coverImageVerticalPosition: 50,
    coverImageCropperPosition: null,
    coverImageFocalPoint: null,
    coverImageFocalPointTarget: undefined,
    coverImageBorderRadius: 0,
    showPreAlbumText: false,
    preAlbumText: "",
    albumView: AlbumView.GRID,
    gridViewOptions: { ...EXTERNAL_ALBUM_GRID_OPTIONS },
    galleryViewOptions: { ...DEFAULT_GALLERY_OPTIONS },
    allowSwitchView: true,
    eventId: "",
    eventDate: now,
    eventType: "",
    createdAt: now,
    createdBy,
    slideInterval: 5000,
    showIndicators: true,
    showStoryNavigator: true,
    height: 400
  };
}

function createAlbumRow(albumData: AlbumData): PageContentRow {
  return {
    type: PageContentType.ALBUM,
    showSwiper: false,
    columns: [],
    maxColumns: 1,
    carousel: albumData
  };
}

function createAlbumIndexRow(basePath: string): PageContentRow {
  return {
    type: PageContentType.ALBUM_INDEX,
    showSwiper: false,
    columns: [],
    maxColumns: 1,
    albumIndex: {
      contentPaths: [{
        contentPath: basePath,
        stringMatch: StringMatch.STARTS_WITH
      }],
      contentTypes: [IndexContentType.ALBUMS],
      renderModes: [IndexRenderMode.ACTION_BUTTONS]
    }
  };
}

function splitPhotosByTitle(photos: ExternalPhoto[]): { title: string; photos: ExternalPhoto[] }[] {
  const grouped = groupBy(photos, photo => (photo.title || "").trim() || "Untitled");
  const order = photos.reduce((acc, photo) => {
    const title = (photo.title || "").trim() || "Untitled";
    return acc.includes(title) ? acc : acc.concat(title);
  }, [] as string[]);

  return order.map(title => ({
    title,
    photos: grouped[title] || []
  }));
}

function buildSplitEntries(basePath: string, groups: { title: string; photos: ExternalPhoto[] }[]): { title: string; photos: ExternalPhoto[]; path: string }[] {
  const initial = { paths: [] as string[], entries: [] as { title: string; photos: ExternalPhoto[]; path: string }[] };
  const result = groups.reduce((acc, group) => {
    const slug = toKebabCase(group.title);
    const base = slug ? `${basePath}/${slug}` : `${basePath}/untitled`;
    const matching = acc.paths.filter(path => path === base || path.startsWith(`${base}-`)).length;
    const path = matching > 0 ? `${base}-${matching + 1}` : base;
    return {
      paths: acc.paths.concat(path),
      entries: acc.entries.concat({ title: group.title, photos: group.photos, path })
    };
  }, initial);

  return result.entries;
}

async function createOrUpdateAlbumIndexPage(path: string): Promise<PageContent> {
  const existingPage = await pageContent.findOne({ path }).exec();
  const indexRow = createAlbumIndexRow(path);

  if (existingPage) {
    existingPage.rows = existingPage.rows || [];
    const existingIndexRowIndex = existingPage.rows.findIndex(
      (row: PageContentRow) => row.type === PageContentType.ALBUM_INDEX
    );
    if (existingIndexRowIndex >= 0) {
      existingPage.rows[existingIndexRowIndex] = indexRow;
    } else {
      existingPage.rows.push(indexRow);
    }
    const updatedPage = await existingPage.save();
    return transforms.toObjectWithId(updatedPage);
  }

  const pageDoc: Partial<PageContent> = {
    path,
    rows: [indexRow]
  };
  const createdPage = await pageContent.create(pageDoc);
  return transforms.toObjectWithId(createdPage);
}

async function importExternalAlbumSingle(
  request: ExternalAlbumImportRequest,
  albumMetadata: ExternalAlbumMetadata,
  createdBy: string,
  onProgress?: ProgressCallback
): Promise<ExternalAlbumImportResult> {
  const albumName = request.targetPath;
  const title = request.albumTitle || albumMetadata.title;
  const subtitle = request.albumSubtitle || "";

  debugLog("importExternalAlbum: starting import for", albumName);

  const sendProgress = (stage: string, percent: number, message: string) => {
    if (onProgress) {
      onProgress({ stage, percent, message });
    }
  };

  try {
    sendProgress("checking", 10, `Checking if album "${albumName}" already exists...`);
    const existingMetadata = await contentMetadata.findOne({ name: albumName, rootFolder: RootFolder.carousels }).exec();

    let metadataResult: ContentMetadata;

    if (existingMetadata) {
      sendProgress("updating-metadata", 30, `Updating existing album with ${pluraliseWithCount(albumMetadata.photoCount, "photo")}...`);
      existingMetadata.files = photosToContentMetadataItems(albumMetadata.photos);
      existingMetadata.coverImage = albumMetadata.coverPhotoUrl;
      const updatedMetadata = await existingMetadata.save();
      metadataResult = transforms.toObjectWithId(updatedMetadata);
      debugLog("importExternalAlbum: updated existing metadata", metadataResult.id);
    } else {
      sendProgress("creating-metadata", 30, `Creating album metadata with ${pluraliseWithCount(albumMetadata.photoCount, "photo")}...`);

      const metadataDoc: Partial<ContentMetadata> = {
        rootFolder: RootFolder.carousels,
        name: albumName,
        files: photosToContentMetadataItems(albumMetadata.photos),
        coverImage: albumMetadata.coverPhotoUrl,
        imageTags: [RECENT_PHOTOS]
      };

      const createdMetadata = await contentMetadata.create(metadataDoc);
      metadataResult = transforms.toObjectWithId(createdMetadata);
      debugLog("importExternalAlbum: created metadata", metadataResult.id);
    }

    sendProgress("checking-page", 50, `Checking if page "${albumName}" already exists...`);

    const existingPage = await pageContent.findOne({ path: albumName }).exec();

    let pageResult: PageContent;
    const albumData = createAlbumData(albumName, title, subtitle, albumMetadata.coverPhotoUrl, createdBy);
    const albumRow = createAlbumRow(albumData);

    if (existingPage) {
      sendProgress("updating-page", 70, `Updating existing page with album data...`);
      existingPage.rows = existingPage.rows || [];
      const existingAlbumRowIndex = existingPage.rows.findIndex(
        (row: PageContentRow) => row.type === PageContentType.ALBUM && row.carousel?.name === albumName
      );
      if (existingAlbumRowIndex >= 0) {
        existingPage.rows[existingAlbumRowIndex] = albumRow;
        debugLog("importExternalAlbum: replaced existing album row at index", existingAlbumRowIndex);
      } else {
        existingPage.rows.push(albumRow);
        debugLog("importExternalAlbum: added new album row to existing page");
      }
      const updatedPage = await existingPage.save();
      pageResult = transforms.toObjectWithId(updatedPage);
      debugLog("importExternalAlbum: updated existing page", pageResult.id);
    } else if (request.useTemplate && request.templatePath) {
      sendProgress("loading-template", 60, `Loading template from "${request.templatePath}"...`);
      const templatePage = await pageContent.findOne({ path: request.templatePath }).exec();

      if (templatePage) {
        sendProgress("creating-page", 70, `Creating page from template at path "${albumName}"...`);
        const templateData = transforms.toObjectWithId(templatePage);
        delete (templateData as any).id;
        delete (templateData as any)._id;
        templateData.path = albumName;

        const hasAlbumRow = (templateData.rows || []).some((row: PageContentRow) => row.type === PageContentType.ALBUM);
        if (hasAlbumRow) {
          templateData.rows = (templateData.rows || []).map((row: PageContentRow) => {
            if (row.type === PageContentType.ALBUM && row.carousel) {
              return { ...row, carousel: { ...row.carousel, ...albumData, name: albumName } };
            }
            return row;
          });
        } else {
          templateData.rows = [...(templateData.rows || []), albumRow];
        }

        const createdPage = await pageContent.create(templateData);
        pageResult = transforms.toObjectWithId(createdPage);
        debugLog("importExternalAlbum: created page from template", pageResult.id);
      } else {
        sendProgress("creating-page", 70, `Template not found, creating default page at path "${albumName}"...`);
        const pageDoc: Partial<PageContent> = {
          path: albumName,
          rows: [albumRow]
        };
        const createdPage = await pageContent.create(pageDoc);
        pageResult = transforms.toObjectWithId(createdPage);
        debugLog("importExternalAlbum: template not found, created default page", pageResult.id);
      }
    } else {
      sendProgress("creating-page", 70, `Creating page at path "${albumName}"...`);
      const pageDoc: Partial<PageContent> = {
        path: albumName,
        rows: [albumRow]
      };
      const createdPage = await pageContent.create(pageDoc);
      pageResult = transforms.toObjectWithId(createdPage);
      debugLog("importExternalAlbum: created new page", pageResult.id);
    }

    sendProgress("complete", 100, `Successfully imported ${pluraliseWithCount(albumMetadata.photoCount, "photo")} from ${albumMetadata.source}`);

    return {
      success: true,
      source: albumMetadata.source,
      albumName,
      pageContentPath: albumName,
      contentMetadataId: metadataResult.id,
      pageContentId: pageResult.id || "",
      photoCount: albumMetadata.photoCount
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Import failed";
    debugLog("importExternalAlbum: error", errorMessage);
    return {
      success: false,
      source: albumMetadata.source,
      albumName,
      pageContentPath: "",
      contentMetadataId: "",
      pageContentId: "",
      photoCount: 0,
      errorMessage
    };
  }
}

export interface ImportProgress {
  stage: string;
  percent: number;
  message: string;
}

export type ProgressCallback = (progress: ImportProgress) => void;

export async function importExternalAlbum(
  request: ExternalAlbumImportRequest,
  albumMetadata: ExternalAlbumMetadata,
  createdBy: string,
  onProgress?: ProgressCallback
): Promise<ExternalAlbumImportResult> {
  if (!request.splitByPhotoTitle) {
    return importExternalAlbumSingle(request, albumMetadata, createdBy, onProgress);
  }

  const groups = splitPhotosByTitle(albumMetadata.photos);
  if (groups.length <= 1) {
    return importExternalAlbumSingle(request, albumMetadata, createdBy, onProgress);
  }

  const sendProgress = (stage: string, percent: number, message: string) => {
    if (onProgress) {
      onProgress({ stage, percent, message });
    }
  };

  sendProgress("splitting", 5, `Splitting album into ${pluraliseWithCount(groups.length, "section")} by photo title...`);

  const splitEntries = buildSplitEntries(request.targetPath, groups);
  const selectedPaths = request.splitAlbumPaths && request.splitAlbumPaths.length > 0
    ? request.splitAlbumPaths
    : [];
  const selectedEntries = selectedPaths.length > 0
    ? splitEntries.filter(entry => selectedPaths.includes(entry.path))
    : splitEntries;
  const totalPhotos = albumMetadata.photos.length;

  if (selectedEntries.length === 0) {
    return {
      success: false,
      source: albumMetadata.source,
      albumName: request.targetPath,
      pageContentPath: "",
      contentMetadataId: "",
      pageContentId: "",
      photoCount: 0,
      errorMessage: "No album sections selected for import"
    };
  }

  const results = await selectedEntries.reduce(async (promise, entry, index) => {
    const acc = await promise;
    sendProgress("importing", Math.round((index / selectedEntries.length) * 100), `Importing "${entry.title}" (${pluraliseWithCount(entry.photos.length, "photo")})...`);

    const groupMetadata: ExternalAlbumMetadata = {
      ...albumMetadata,
      title: entry.title,
      photoCount: entry.photos.length,
      photos: entry.photos,
      coverPhotoUrl: entry.photos[0]?.url || albumMetadata.coverPhotoUrl
    };

    const groupRequest: ExternalAlbumImportRequest = {
      ...request,
      targetPath: entry.path,
      albumTitle: entry.title,
      splitByPhotoTitle: false
    };

    const result = await importExternalAlbumSingle(groupRequest, groupMetadata, createdBy, onProgress);
    return acc.concat({ entry, result });
  }, Promise.resolve([] as Array<{ entry: { title: string; photos: ExternalPhoto[]; path: string }; result: ExternalAlbumImportResult }>));

  const successful = results.filter(item => item.result.success);
  const failed = results.filter(item => !item.result.success);
  if (successful.length === 0) {
    return {
      success: false,
      source: albumMetadata.source,
      albumName: request.targetPath,
      pageContentPath: "",
      contentMetadataId: "",
      pageContentId: "",
      photoCount: 0,
      errorMessage: "No album sections were created"
    };
  }

  const indexPage = await createOrUpdateAlbumIndexPage(request.targetPath);

  if (failed.length > 0) {
    return {
      success: false,
      source: albumMetadata.source,
      albumName: request.targetPath,
      pageContentPath: indexPage.path || request.targetPath,
      contentMetadataId: successful[0].result.contentMetadataId,
      pageContentId: indexPage.id || "",
      photoCount: totalPhotos,
      errorMessage: `${failed.length} album sections failed to import`
    };
  }

  sendProgress("complete", 100, `Successfully imported ${pluraliseWithCount(totalPhotos, "photo")} into ${pluraliseWithCount(successful.length, "section")}`);

  return {
    success: true,
    source: albumMetadata.source,
    albumName: request.targetPath,
    pageContentPath: indexPage.path || request.targetPath,
    contentMetadataId: successful[0].result.contentMetadataId,
    pageContentId: indexPage.id || "",
    photoCount: totalPhotos
  };
}

export function buildSplitPreviewEntries(basePath: string, albumMetadata: ExternalAlbumMetadata): SplitAlbumPreviewEntry[] {
  const grouped = groupBy(albumMetadata.photos, photo => (photo.title || "").trim() || "Untitled");
  const order = albumMetadata.photos.reduce((acc, photo) => {
    const title = (photo.title || "").trim() || "Untitled";
    return acc.includes(title) ? acc : acc.concat(title);
  }, [] as string[]);

  const initial = { paths: [] as string[], previews: [] as SplitAlbumPreviewEntry[] };
  const result = order.reduce((acc, title) => {
    const slug = toKebabCase(title);
    const base = slug ? `${basePath}/${slug}` : `${basePath}/untitled`;
    const matching = acc.paths.filter(path => path === base || path.startsWith(`${base}-`)).length;
    const path = matching > 0 ? `${base}-${matching + 1}` : base;
    const preview: SplitAlbumPreviewEntry = {
      title,
      path,
      count: grouped[title]?.length || 0,
      included: true,
      previewPhotos: (grouped[title] || []).slice(0, 12)
    };
    return {
      paths: acc.paths.concat(path),
      previews: acc.previews.concat(preview)
    };
  }, initial);

  return result.previews;
}
