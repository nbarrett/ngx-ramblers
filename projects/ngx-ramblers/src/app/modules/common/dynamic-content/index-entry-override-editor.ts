import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { NgStyle } from "@angular/common";
import { NgxLoggerLevel } from "ngx-logger";
import { keys } from "es-toolkit/compat";
import {
  ContentPathMatchConfigs,
  FocalPointTarget,
  IndexColumnOverride,
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentType
} from "../../../models/content-text.model";
import { ContentMetadata, ContentMetadataItem } from "../../../models/content-metadata.model";
import { FocalPoint, FocalPointPickerComponent } from "../focal-point-picker/focal-point-picker";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { PageContentService } from "../../../services/page-content.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { UrlService } from "../../../services/url.service";
import { LocationExtractionService } from "../../../services/location-extraction.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronRight, faImage, faStar, faUndo } from "@fortawesome/free-solid-svg-icons";

interface ExpandedEntry {
  column: PageContentColumn;
  metadata: ContentMetadata;
  images: { image: string; imageSource: string }[];
  defaultCoverImage: string;
  fromPageContent: boolean;
}

@Component({
  selector: "app-index-entry-override-editor",
  template: `
    @if (columns().length > 0) {
      <div class="accordion mb-3" id="coverImageOverridesAccordion">
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button"
                    (click)="accordionOpen = !accordionOpen"
                    [class.collapsed]="!accordionOpen"
                    [attr.aria-expanded]="accordionOpen">
              <span class="flex-grow-1">Overrides</span>
              <small class="text-muted me-3">{{ overrideCount() }} customised</small>
            </button>
          </h2>
          <div class="accordion-collapse collapse" [class.show]="accordionOpen">
            <div class="accordion-body p-0">
          @for (column of columns(); track column.href) {
            <div class="border-bottom">
              <div class="d-flex align-items-center p-2 entry-header"
                   (click)="toggleExpand(column)">
                <div class="me-2 flex-shrink-0" [ngStyle]="thumbnailStyle(column)"></div>
                <div class="flex-grow-1 min-width-0">
                  <div class="fw-semibold text-truncate">{{ column.title }}</div>
                  <small class="text-muted text-truncate d-block">{{ column.href }}</small>
                </div>
                @if (hasOverride(column)) {
                  <span class="badge bg-primary me-2">Customised</span>
                  <app-badge-button class="me-1"
                    [icon]="faUndo"
                    caption="Reset to default"
                    (click)="$event.stopPropagation(); resetOverride(column)"/>
                } @else {
                  <span class="badge border text-muted me-2">Default</span>
                }
                <app-badge-button
                  [icon]="expandedHref === column.href ? faChevronDown : faChevronRight"
                  [caption]="expandedHref === column.href ? 'Collapse' : 'Edit image'"
                  (click)="$event.stopPropagation(); toggleExpand(column)"/>
              </div>
              <div class="d-flex gap-2 px-2 pb-2">
                <div class="flex-grow-1">
                  <small class="text-muted">Title</small>
                  <input type="text" class="form-control form-control-sm"
                         [placeholder]="column.title || ''"
                         [value]="columnOverrideTitleFor(column)"
                         (input)="onColumnTitleChanged(column, $event)">
                </div>
                <div class="flex-grow-1">
                  <small class="text-muted">Subtitle</small>
                  <input type="text" class="form-control form-control-sm"
                         [placeholder]="column.contentText || ''"
                         [value]="columnOverrideContentTextFor(column)"
                         (input)="onColumnContentTextChanged(column, $event)">
                </div>
              </div>
              @if (expandedHref === column.href) {
                <div class="p-3 bg-light">
                  @if (loadingMetadata || !expandedEntry) {
                    <div class="d-flex justify-content-center p-3">
                      <div class="spinner-border spinner-border-sm text-secondary" role="status">
                        <span class="visually-hidden">Loading…</span>
                      </div>
                    </div>
                  } @else if (expandedEntry.images.length === 0 && !column.imageSource) {
                    <div class="alert alert-warning mb-0">No images found for this entry.</div>
                  } @else if (expandedEntry.images.length === 0 && column.imageSource) {
                    <div class="mb-3">
                      <small class="text-muted d-block mb-2">No image catalogue available for this entry. You can adjust the focal point of the current cover image below.</small>
                      <label class="form-label">Focal point</label>
                      <app-focal-point-picker
                        [imageSrc]="resolvedImageSource(column.imageSource)"
                        [focalPoint]="effectiveFocalPoint(column)"
                        [height]="200"
                        [resizable]="true"
                        (focalPointChange)="onFocalPointChange(column, $event)"/>
                    </div>
                    @if (hasOverride(column)) {
                      <div class="d-flex justify-content-end">
                        <app-badge-button
                          [icon]="faUndo"
                          caption="Reset to default"
                          (click)="resetOverride(column)"/>
                      </div>
                    }
                  } @else {
                    <div class="mb-3">
                      <label class="form-label">Select cover image</label>
                      <div class="image-grid">
                        @for (img of expandedEntry.images; track img.image) {
                          <div class="image-grid-item"
                               [class.selected]="isEffectiveImage(column, img.image)"
                               [class.album-default]="!expandedEntry.fromPageContent && isAlbumDefault(img.image) && !isEffectiveImage(column, img.image)"
                               (click)="selectCoverImage(column, img.image)">
                            <img [src]="img.imageSource" [alt]="img.image" loading="lazy"/>
                            @if (!expandedEntry.fromPageContent && isAlbumDefault(img.image)) {
                              <div class="default-overlay" [class.selected-default]="isEffectiveImage(column, img.image)">
                                <fa-icon [icon]="faStar"></fa-icon>
                              </div>
                            }
                            @if (isEffectiveImage(column, img.image) && hasOverride(column)) {
                              <div class="selected-overlay">
                                <fa-icon [icon]="faImage"></fa-icon>
                              </div>
                            }
                          </div>
                        }
                      </div>
                      @if (!expandedEntry.fromPageContent) {
                        <small class="text-muted mt-1 d-block">
                          <fa-icon [icon]="faStar" class="text-warning me-1"></fa-icon>Album default cover image
                        </small>
                      }
                    </div>
                    @if (effectiveImageSource(column)) {
                      <div class="mb-3">
                        <label class="form-label">Focal point</label>
                        <app-focal-point-picker
                          [imageSrc]="effectiveImageSource(column)"
                          [focalPoint]="effectiveFocalPoint(column)"
                          [height]="200"
                          [resizable]="true"
                          (focalPointChange)="onFocalPointChange(column, $event)"/>
                      </div>
                    }
                    @if (hasOverride(column)) {
                      <div class="d-flex justify-content-end">
                        <app-badge-button
                          [icon]="faUndo"
                          caption="Reset to default"
                          (click)="resetOverride(column)"/>
                      </div>
                    }
                  }
                </div>
              }
            </div>
          }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host ::ng-deep .accordion-button:not(.collapsed)
      background-color: #f0faf5
      color: inherit
      box-shadow: none
    :host ::ng-deep .accordion-button:focus
      box-shadow: none
      border-color: rgba(0, 0, 0, 0.125)

    .entry-header
      cursor: pointer
      &:hover
        background-color: rgba(0, 0, 0, 0.03)

    .image-grid
      display: grid
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr))
      gap: 6px

    .image-grid-item
      position: relative
      aspect-ratio: 1
      overflow: hidden
      border-radius: 4px
      cursor: pointer
      border: 2px solid transparent
      &:hover
        border-color: rgb(240, 128, 80)
      &.selected
        border-color: rgb(240, 128, 80)
        box-shadow: 0 0 0 2px rgb(240, 128, 80)
      &.album-default
        border-color: var(--ramblers-colour-sunrise)
      img
        width: 100%
        height: 100%
        object-fit: cover

    .selected-overlay
      position: absolute
      top: 4px
      right: 4px
      background: rgb(240, 128, 80)
      color: white
      border-radius: 50%
      width: 22px
      height: 22px
      display: flex
      align-items: center
      justify-content: center
      font-size: 0.7rem

    .default-overlay
      position: absolute
      top: 4px
      left: 4px
      background: var(--ramblers-colour-sunrise)
      color: white
      border-radius: 50%
      width: 22px
      height: 22px
      display: flex
      align-items: center
      justify-content: center
      font-size: 0.7rem
      &.selected-default
        background: rgb(240, 128, 80)

    .min-width-0
      min-width: 0
  `],
  imports: [NgStyle, FocalPointPickerComponent, BadgeButtonComponent, FontAwesomeModule],
  standalone: true
})
export class IndexEntryOverrideEditor {
  @Input() row: PageContentRow;
  @Input() indexPageContent: PageContent;
  @Output() overridesChanged = new EventEmitter<void>();
  @Output() expandedHrefChanged = new EventEmitter<string>();

  private contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  private pageContentService: PageContentService = inject(PageContentService);
  private locationExtractionService: LocationExtractionService = inject(LocationExtractionService);
  private actions: PageContentActionsService = inject(PageContentActionsService);
  private urlService: UrlService = inject(UrlService);
  private loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("IndexEntryOverrideEditor", NgxLoggerLevel.ERROR);
  private metadataCache = new Map<string, ContentMetadata[]>();

  accordionOpen = false;
  expandedHref: string = null;
  expandedEntry: ExpandedEntry = null;
  loadingMetadata = false;
  faChevronDown = faChevronDown;
  faChevronRight = faChevronRight;
  faImage = faImage;
  faStar = faStar;
  faUndo = faUndo;

  columns(): PageContentColumn[] {
    const allColumns = this.indexPageContent?.rows?.[0]?.columns || [];
    if (this.expandedHref) {
      return allColumns.filter(c => c.href === this.expandedHref);
    }
    return allColumns;
  }


  overrideCount(): number {
    const hrefs = new Set<string>();
    const entryOverrides = this.row?.albumIndex?.entryOverrides;
    if (entryOverrides) {
      keys(entryOverrides).forEach(href => hrefs.add(href));
    }
    (this.row?.albumIndex?.columnOverrides || []).forEach(o => hrefs.add(o.href));
    return hrefs.size;
  }

  hasOverride(column: PageContentColumn): boolean {
    const hasEntryOverride = !!this.row?.albumIndex?.entryOverrides?.[column.href];
    const hasColumnOverride = (this.row?.albumIndex?.columnOverrides || []).some(o => o.href === column.href);
    return hasEntryOverride || hasColumnOverride;
  }

  thumbnailStyle(column: PageContentColumn): Record<string, string> {
    return {
      width: "40px",
      height: "40px",
      "border-radius": "4px",
      "background-size": "cover",
      "background-position": "center",
      "background-color": "#e9ecef",
      "background-image": column.imageSource ? `url(${this.resolvedImageSource(column.imageSource)})` : "none"
    };
  }

  async toggleExpand(column: PageContentColumn) {
    this.logger.info("toggleExpand called for:", column.title, "href:", column.href, "albumName:", column.albumName, "currently expanded:", this.expandedHref);
    if (this.expandedHref === column.href) {
      this.logger.info("Collapsing:", column.href);
      this.expandedHref = null;
      this.expandedEntry = null;
      this.expandedHrefChanged.emit(null);
      return;
    }
    this.expandedHref = column.href;
    this.expandedHrefChanged.emit(column.href);
    this.expandedEntry = null;
    this.loadingMetadata = true;

    const lookupNames = [column.albumName, column.href].filter(n => !!n);
    if (lookupNames.length === 0) {
      this.logger.warn("No albumName or href for column");
      this.loadingMetadata = false;
      this.expandedEntry = {column, metadata: null, images: [], defaultCoverImage: null, fromPageContent: false};
      return;
    }

    try {
      const cacheKey = lookupNames.join("|");
      let allMetadata = this.metadataCache.get(cacheKey);
      if (!allMetadata) {
        this.logger.info("Fetching metadata for names:", lookupNames);
        const results = await this.contentMetadataService.all({criteria: {name: {$in: lookupNames}}});
        this.logger.info("Metadata results for", lookupNames, ":", results?.length, "records");
        if (results?.length > 0) {
          allMetadata = results;
        } else if (column.href) {
          this.logger.info("No direct metadata, looking up child albums for:", column.href);
          allMetadata = await this.findChildAlbumMetadata(column.href);
        }
        allMetadata = allMetadata || [];
        if (allMetadata.length > 0) {
          this.metadataCache.set(cacheKey, allMetadata);
        }
      }

      let images = allMetadata.flatMap(m =>
        (m.files || [])
          .filter((file: ContentMetadataItem) => !!file.image)
          .map((file: ContentMetadataItem) => ({
            image: file.image,
            imageSource: this.urlService.imageSourceFor({image: file.image}, m)
          }))
          .filter(img => img.imageSource && img.imageSource !== "null")
      );
      let fromPageContent = false;
      if (images.length === 0 && column.href) {
        images = await this.extractPageImages(column.href);
        fromPageContent = images.length > 0;
      }
      const primaryMetadata = allMetadata[0] || null;
      const defaultCoverImage = fromPageContent ? null : (primaryMetadata?.coverImage || images[0]?.image || null);
      this.logger.info("toggleExpand:", lookupNames, "allMetadata:", allMetadata.length, "images:", images.length, "fromPageContent:", fromPageContent, "defaultCoverImage:", defaultCoverImage);
      this.expandedEntry = {column, metadata: primaryMetadata, images, defaultCoverImage, fromPageContent};
    } catch (error) {
      this.logger.error("Failed to fetch metadata for:", lookupNames, error);
      this.expandedEntry = {column, metadata: null, images: [], defaultCoverImage: null, fromPageContent: false};
    }

    this.loadingMetadata = false;
  }

  isAlbumDefault(image: string): boolean {
    return this.expandedEntry?.defaultCoverImage === image;
  }

  isEffectiveImage(column: PageContentColumn, image: string): boolean {
    const override = this.row?.albumIndex?.entryOverrides?.[column.href];
    if (override?.coverImage) {
      return override.coverImage === image;
    }
    return this.expandedEntry?.defaultCoverImage === image;
  }

  selectCoverImage(column: PageContentColumn, image: string) {
    if (image === this.expandedEntry?.defaultCoverImage && !this.hasOverride(column)) {
      return;
    }
    if (image === this.expandedEntry?.defaultCoverImage) {
      this.resetOverride(column);
      return;
    }
    this.ensureOverrides();
    const href = column.href;
    const existing = this.row.albumIndex.entryOverrides[href];
    if (existing?.coverImage === image) {
      return;
    }
    this.row.albumIndex.entryOverrides[href] = {
      ...existing,
      coverImage: image,
      albumName: column.albumName
    };
    const imgEntry = this.expandedEntry?.images.find(img => img.image === image);
    if (imgEntry) {
      this.updatePreviewColumn(column, {imageSource: imgEntry.imageSource});
    }
    this.logger.info("Selected cover image override:", image, "for:", href);
    this.overridesChanged.emit();
  }

  effectiveImageSource(column: PageContentColumn): string {
    const override = this.row?.albumIndex?.entryOverrides?.[column.href];
    if (override?.coverImage && this.expandedEntry?.images?.length > 0) {
      const imgEntry = this.expandedEntry.images.find(img => img.image === override.coverImage);
      if (imgEntry) {
        return imgEntry.imageSource;
      }
    }
    return this.resolvedImageSource(column.imageSource);
  }

  effectiveFocalPoint(column: PageContentColumn): FocalPoint {
    const override = this.row?.albumIndex?.entryOverrides?.[column.href];
    if (override?.coverImageFocalPoint) {
      return override.coverImageFocalPoint;
    }
    return this.albumDefaultFocalPoint(column);
  }

  onFocalPointChange(column: PageContentColumn, focalPoint: FocalPoint) {
    this.ensureOverrides();
    const href = column.href;
    const existing = this.row.albumIndex.entryOverrides[href];
    this.row.albumIndex.entryOverrides[href] = {
      ...existing,
      coverImageFocalPoint: focalPoint,
      albumName: column.albumName
    };
    this.updatePreviewColumn(column, {imageFocalPoint: focalPoint});
    this.logger.info("Focal point changed for:", href, "to:", focalPoint);
  }

  resetOverride(column: PageContentColumn) {
    if (this.row?.albumIndex?.entryOverrides?.[column.href]) {
      delete this.row.albumIndex.entryOverrides[column.href];
    }
    if (this.row?.albumIndex?.columnOverrides) {
      this.row.albumIndex.columnOverrides = this.row.albumIndex.columnOverrides.filter(o => o.href !== column.href);
    }
    this.logger.info("Reset override for:", column.href);
    this.overridesChanged.emit();
  }

  columnOverrideTitleFor(column: PageContentColumn): string {
    return (this.row?.albumIndex?.columnOverrides || []).find(o => o.href === column.href)?.title || "";
  }

  columnOverrideContentTextFor(column: PageContentColumn): string {
    return (this.row?.albumIndex?.columnOverrides || []).find(o => o.href === column.href)?.contentText || "";
  }

  onColumnTitleChanged(column: PageContentColumn, event: Event) {
    const value = (event.target as HTMLInputElement).value?.trim() || null;
    const override = this.ensureColumnOverride(column);
    override.title = value;
    this.cleanupEmptyColumnOverrides();
  }

  onColumnContentTextChanged(column: PageContentColumn, event: Event) {
    const value = (event.target as HTMLInputElement).value?.trim() || null;
    const override = this.ensureColumnOverride(column);
    override.contentText = value;
    this.cleanupEmptyColumnOverrides();
  }

  private albumDefaultFocalPoint(column: PageContentColumn): FocalPoint {
    const carouselRow = this.findCarouselRowForColumn(column);
    if (carouselRow) {
      const focalPointTarget = carouselRow.carousel?.coverImageFocalPointTarget || FocalPointTarget.BOTH;
      const applyToIndex = [FocalPointTarget.INDEX_PREVIEW, FocalPointTarget.BOTH].includes(focalPointTarget);
      if (applyToIndex && carouselRow.carousel?.coverImageFocalPoint) {
        return carouselRow.carousel.coverImageFocalPoint;
      }
    }
    return {x: 50, y: 50, zoom: 1};
  }

  private findCarouselRowForColumn(column: PageContentColumn): PageContentRow {
    const pages = this.indexPageContent?.rows?.[0]?.columns;
    if (!pages || !column.albumName) {
      return null;
    }
    return null;
  }

  private async extractPageImages(href: string): Promise<{ image: string; imageSource: string }[]> {
    const pages = await this.pageContentService.all({criteria: {path: href}});
    const page = pages?.[0];
    if (!page) {
      this.logger.info("extractPageImages: no page found for:", href);
      return [];
    }
    const rawImages = this.locationExtractionService.findAllImagesInPage(page);
    this.logger.info("extractPageImages:", href, "found", rawImages.length, "images");
    return rawImages.map(image => ({image, imageSource: this.urlService.imageSource(image)}));
  }

  private async findChildAlbumMetadata(href: string): Promise<ContentMetadata[]> {
    const pages = await this.pageContentService.all({criteria: {path: href}});
    const page = pages?.[0];
    if (!page) {
      this.logger.info("findChildAlbumMetadata: no page found for:", href);
      return [];
    }
    const directCarouselNames = (page.rows || [])
      .filter(row => this.actions.isCarouselOrAlbum(row))
      .map(row => row.carousel.name);

    if (directCarouselNames.length > 0) {
      this.logger.info("findChildAlbumMetadata: page", href, "has direct carousel names:", directCarouselNames);
      const metadataResults = await this.contentMetadataService.all({criteria: {name: {$in: directCarouselNames}}});
      this.logger.info("findChildAlbumMetadata: found", metadataResults?.length, "metadata records for", directCarouselNames);
      return metadataResults || [];
    }

    const indexRow = (page.rows || []).find(row =>
      row.type === PageContentType.ALBUM_INDEX && row.albumIndex?.contentPaths?.length > 0
    );
    if (!indexRow) {
      this.logger.info("findChildAlbumMetadata: no carousel or albumIndex found for:", href);
      return [];
    }

    const contentPathRegex = indexRow.albumIndex.contentPaths.map(cp => ({
      path: ContentPathMatchConfigs[cp.stringMatch].mongoRegex(cp.contentPath)
    }));
    const childPages = await this.pageContentService.all({criteria: {$or: contentPathRegex}});
    const childCarouselNames = childPages.flatMap(childPage =>
      (childPage.rows || [])
        .filter(row => this.actions.isCarouselOrAlbum(row))
        .map(row => row.carousel.name)
    ).filter(name => !!name);
    const uniqueNames = [...new Set(childCarouselNames)];
    this.logger.info("findChildAlbumMetadata: found", uniqueNames.length, "carousel names from", childPages.length, "child pages via albumIndex for:", href);

    if (uniqueNames.length === 0) {
      return [];
    }
    const metadataResults = await this.contentMetadataService.all({criteria: {name: {$in: uniqueNames}}});
    this.logger.info("findChildAlbumMetadata: found", metadataResults?.length, "metadata records for", uniqueNames);
    return metadataResults || [];
  }

  private updatePreviewColumn(column: PageContentColumn, updates: Partial<PageContentColumn>) {
    const columns = this.indexPageContent?.rows?.[0]?.columns;
    if (!columns) {
      return;
    }
    const previewColumn = columns.find(c => c.href === column.href);
    if (previewColumn) {
      if (updates.imageFocalPoint !== undefined) {
        previewColumn.imageFocalPoint = updates.imageFocalPoint;
      }
      if (updates.imageSource !== undefined) {
        previewColumn.imageSource = updates.imageSource;
      }
    }
  }

  private ensureColumnOverride(column: PageContentColumn): IndexColumnOverride {
    if (!this.row.albumIndex.columnOverrides) {
      this.row.albumIndex.columnOverrides = [];
    }
    let override = this.row.albumIndex.columnOverrides.find(o => o.href === column.href);
    if (!override) {
      override = {href: column.href};
      this.row.albumIndex.columnOverrides.push(override);
    }
    return override;
  }

  private cleanupEmptyColumnOverrides() {
    this.row.albumIndex.columnOverrides = (this.row.albumIndex.columnOverrides || [])
      .filter(o => o.title || o.contentText);
  }

  resolvedImageSource(imageSource: string): string {
    return this.urlService.imageSource(imageSource);
  }

  private ensureOverrides() {
    if (!this.row.albumIndex.entryOverrides) {
      this.row.albumIndex.entryOverrides = {};
    }
  }
}
