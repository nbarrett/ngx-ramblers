import { inject, Injectable } from "@angular/core";
import { escapeRegExp, uniqBy } from "es-toolkit/compat";
import { CmsImagePickerImage, CmsImagePickerPage } from "../models/cms-image-picker.model";
import { PageContent } from "../models/content-text.model";
import { LocationExtractionService } from "./location-extraction.service";
import { PageContentService } from "./page-content.service";
import { StringUtilsService } from "./string-utils.service";
import { UrlService } from "./url.service";

@Injectable({providedIn: "root"})
export class CmsPageImageService {
  private pageContentService = inject(PageContentService);
  private locationExtractionService = inject(LocationExtractionService);
  private stringUtils = inject(StringUtilsService);
  private urlService = inject(UrlService);

  async pagesNear(startingPagePaths: string[]): Promise<CmsImagePickerPage[]> {
    const normalisedPaths = uniqBy((startingPagePaths ?? []).filter(Boolean), path => path);
    const startingPages = await Promise.all(normalisedPaths.map(path => this.pageContentService.findByPath(path)));
    const anchorPath = normalisedPaths[0] ?? "";
    const parentPath = anchorPath.split("/").slice(0, -1).join("/");
    const pathPrefix = `^${escapeRegExp(parentPath)}/`;
    const nearbyPages = parentPath
      ? await this.pageContentService.all({criteria: {path: {$regex: pathPrefix}}, sort: {path: -1}, limit: 0})
      : [];
    const startingPageOrder = new Map(normalisedPaths.map((path, index) => [path, index]));
    return uniqBy([...startingPages, ...nearbyPages].filter(Boolean), page => page.path)
      .map(page => this.pageWithImages(page))
      .filter(page => page.images.length > 0)
      .sort((left, right) => {
        const leftRank = startingPageOrder.get(left.path) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = startingPageOrder.get(right.path) ?? Number.MAX_SAFE_INTEGER;
        return leftRank === rightRank ? right.path.localeCompare(left.path) : leftRank - rightRank;
      });
  }

  imagesFromPage(page: PageContent): CmsImagePickerImage[] {
    const pageLabel = this.pageLabel(page.path);
    return uniqBy(this.locationExtractionService.findAllImagesInPage(page), src => src).map(src => ({
      src,
      resolvedSrc: this.urlService.isRemoteUrl(src) ? src : this.urlService.imageSource(src.replace(/^\/+/, ""), true),
      alt: pageLabel,
      pagePath: page.path
    }));
  }

  private pageWithImages(page: PageContent): CmsImagePickerPage {
    return {path: page.path, label: this.pageLabel(page.path), title: this.pageTitle(page), images: this.imagesFromPage(page)};
  }

  private pageTitle(page: PageContent): string {
    const albumTitle = page.rows?.find(row => row.carousel?.title)?.carousel?.title;
    const heading = page.rows
      ?.flatMap(row => row.columns ?? [])
      .map(column => column.contentText?.match(/^#\s+(.+)$/m)?.[1]?.trim())
      .find(Boolean);
    return this.stringUtils.stripMarkdown(albumTitle || heading || this.pageLabel(page.path));
  }

  private pageLabel(path: string): string {
    return path.split("/").filter(Boolean).join(" › ");
  }
}
