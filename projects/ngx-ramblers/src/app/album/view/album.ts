import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Location } from "@angular/common";
import { StoredValue } from "../../models/ui-actions";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { take } from "es-toolkit/compat";
import {
  faArrowsLeftRightToLine,
  faCircleInfo,
  faGripVertical,
  faImage,
  faImages,
  faPhotoFilm,
  faRectangleAd,
  faSearch,
  faTableCells,
  faTableCellsLarge,
  faTableColumns
} from "@fortawesome/free-solid-svg-icons";
import { AlbumData, AlbumView, DEFAULT_GRID_OPTIONS, GridLayoutMode, GridViewOptions } from "../../models/content-text.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { RootFolder } from "../../models/system.model";
import {
  ALL_PHOTOS,
  ContentMetadata,
  DuplicateImages,
  LazyLoadingMetadata,
  SlideInitialisation
} from "../../models/content-metadata.model";
import { LazyLoadingMetadataService } from "../../services/lazy-loading-metadata.service";
import { ImageDuplicatesService } from "../../services/image-duplicates-service";
import { BroadcastService } from "../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../models/broadcast.model";
import { BadgeButtonComponent } from "../../modules/common/badge-button/badge-button";
import { BadgeStepperComponent } from "../../modules/common/badge-button/badge-stepper";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { AlbumGalleryComponent } from "./album-gallery";
import { AlbumGridComponent } from "./album-grid";
import { CarouselComponent } from "../../carousel/view/carousel";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-album",
    template: `
      <div class="row h-100">
        @if (album.allowSwitchView || preview) {
          <div class="col-sm-12">
            <div class="d-flex flex-wrap gap-1 justify-content-end mb-1">
              <ng-content/>
              @if (album.allowSwitchView || preview) {
                <app-badge-button [tooltip]="'view as carousel'" [active]="albumView===AlbumView.CAROUSEL"
                                  [icon]="faImage" noRightMargin
                                  (click)="switchToView(AlbumView.CAROUSEL)" caption="carousel"/>
                <app-badge-button [tooltip]="'view as gallery'" [active]="albumView===AlbumView.GALLERY"
                                  [icon]="faPhotoFilm" noRightMargin
                                  (click)="switchToView(AlbumView.GALLERY)" caption="gallery"/>
                <app-badge-button [tooltip]="'view as grid'" [active]="albumView===AlbumView.GRID"
                                  [icon]="faTableCells" noRightMargin
                                  (click)="switchToView(AlbumView.GRID)" caption="grid"/>
                @if (albumView === AlbumView.GRID) {
                  <app-badge-button [tooltip]="'toggle titles'"
                                    [active]="gridViewOptions?.showTitles" [icon]="faRectangleAd"
                                    noRightMargin
                                    (click)="toggleShowTitles()"
                                    [caption]="gridViewOptions?.showTitles? 'hide titles':'show titles'"/>
                  <app-badge-button [tooltip]="isMasonryLayout() ? 'switch to fixed aspect' : 'switch to masonry'"
                                    [active]="isMasonryLayout()"
                                    [icon]="isMasonryLayout() ? faGripVertical : faTableCellsLarge"
                                    noRightMargin
                                    (click)="toggleLayoutMode()"
                                    [caption]="isMasonryLayout() ? 'masonry' : 'fixed'"/>
                  <app-badge-stepper [tooltip]="'adjust columns'"
                                     [icon]="faTableColumns"
                                     [value]="effectiveColumns()"
                                     [min]="1"
                                     [max]="6"
                                     unit="col"
                                     noRightMargin
                                     (valueChange)="columnsChanged($event)"/>
                  <app-badge-stepper [tooltip]="'adjust gap between photos'"
                                     [icon]="faArrowsLeftRightToLine"
                                     [value]="effectiveGap()"
                                     [min]="0"
                                     [max]="1.75"
                                     [step]="0.25"
                                     [labels]="gapLabels"
                                     noRightMargin
                                     (valueChange)="gapChanged($event)"/>
                }
              }
            </div>
          </div>
        }
        <div class="col-sm-12 my-auto">
          @if (noImages) {
            <div class="alert alert-warning">
              <fa-icon [icon]="faCircleInfo"/>
              <strong class="ms-1">No content exists in this album</strong>
              <div>Click the <strong>Edit images in album</strong> button to add images or videos to
                the {{ album.name }} album
              </div>
            </div>
          }
          @if (albumView === AlbumView.GALLERY) {
            <app-album-gallery [lazyLoadingMetadata]="lazyLoadingMetadata"
                               [album]="album"
                               [preview]="preview"/>
          }
          @if (albumView === AlbumView.GRID) {
            <app-album-grid [lazyLoadingMetadata]="lazyLoadingMetadata"
                            [album]="album"
                            [preview]="preview"
                            [gridViewOptions]="gridViewOptions"
                            [runtimeColumns]="runtimeColumns"
                            [runtimeGap]="runtimeGap"/>
          }
          @if (albumView === AlbumView.CAROUSEL) {
            <app-carousel [lazyLoadingMetadata]="lazyLoadingMetadata"
                          [duplicateImages]="duplicateImages"
                          [preview]="preview"
                          [album]="album"
                          [index]="index"/>
          }
        </div>
      </div>
    `,
  imports: [BadgeButtonComponent, BadgeStepperComponent, TooltipDirective, AlbumGalleryComponent, AlbumGridComponent, CarouselComponent, FontAwesomeModule]
})
export class AlbumComponent implements OnInit {

  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public lazyLoadingMetadataService: LazyLoadingMetadataService = inject(LazyLoadingMetadataService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private imageDuplicatesService: ImageDuplicatesService = inject(ImageDuplicatesService);
  private broadcastService: BroadcastService<ContentMetadata> = inject(BroadcastService);
  private logger = this.loggerFactory.createLogger("AlbumComponent", NgxLoggerLevel.ERROR);
  private router: Router = inject(Router);
  private activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  private location: Location = inject(Location);
  public noImages: boolean;
  public lazyLoadingMetadata: LazyLoadingMetadata;
  public duplicateImages: DuplicateImages;

  @Input("preview") set previewValue(value: boolean) {
    this.preview = coerceBooleanProperty(value);
    this.logger.info("preview:", this.preview);
  }

  @Input("album") set albumValue(album: AlbumData) {
    this.album = album;
    this.logger.info("album:", album);
    this.switchToView(this.album.albumView || AlbumView.GRID);
  }

  @Input("albumView") set albumViewValue(albumView: AlbumView) {
    this.albumView = albumView;
  }

  @Input()
  public index: number;

  @Output() lazyLoadingMetadataChange: EventEmitter<LazyLoadingMetadata> = new EventEmitter();

  public album: AlbumData;
  public preview: boolean;
  public albumView: AlbumView;
  protected readonly take = take;
  protected readonly faPhotoFilm = faPhotoFilm;
  protected readonly faImages = faImages;
  protected readonly faImage = faImage;
  protected readonly faRectangleAd = faRectangleAd;
  protected readonly faTableCells = faTableCells;
  protected readonly faSearch = faSearch;
  public gridViewOptions: GridViewOptions;
  public runtimeColumns: number | null = null;
  public runtimeGap: number | null = null;
  protected readonly AlbumView = AlbumView;
  protected readonly faCircleInfo = faCircleInfo;
  protected readonly faGripVertical = faGripVertical;
  protected readonly faTableCellsLarge = faTableCellsLarge;
  protected readonly faTableColumns = faTableColumns;
  protected readonly faArrowsLeftRightToLine = faArrowsLeftRightToLine;
  protected readonly gapLabels: Record<number, string> = {
    0: "none",
    0.25: "small",
    0.5: "medium",
    0.75: "normal",
    1: "large",
    1.25: "bigger",
    1.5: "huge",
    1.75: "massive",
    2: "extreme"
  };

  ngOnInit() {
    this.logger.info("ngOnInit:album:", this.album);
    if (!this.album.gridViewOptions) {
      this.album.gridViewOptions = {...DEFAULT_GRID_OPTIONS};
    }
    this.gridViewOptions = {...DEFAULT_GRID_OPTIONS, ...this.album.gridViewOptions};
    this.initFromUrlParams();
    this.logger.info("ngOnInit:querying metadata service with root folder", RootFolder.carousels, "album name:", this.album?.name);
    this.contentMetadataService.items(RootFolder.carousels, this.album?.name)
      .then(contentMetadata => {
        this.applyContentMetadata(contentMetadata);
      });

    this.contentMetadataService.contentMetadataNotifications().subscribe(metadataResponses => {
      const allAndSelectedContentMetaData = this.contentMetadataService.selectMetadataBasedOn(this.album?.name, metadataResponses);
      this.noImages = !allAndSelectedContentMetaData.contentMetadata || !allAndSelectedContentMetaData.contentMetadata.files || allAndSelectedContentMetaData.contentMetadata.files.length === 0;
      this.logger.info("in subscribe:album:", this.album, "allAndSelectedContentMetaData:", allAndSelectedContentMetaData);
    });
    this.broadcastService.on(NamedEventType.CONTENT_METADATA_CHANGED, (namedEvent: NamedEvent<ContentMetadata>) => {
      const incomingName = (namedEvent?.data as any)?.name;
      if (!incomingName || incomingName !== this.album?.name) {
        this.logger.info("ignoring CONTENT_METADATA_CHANGED", {incomingName, currentAlbum: this.album?.name});
      } else {
        this.logger.info("received CONTENT_METADATA_CHANGED for album", incomingName, namedEvent);
        this.applyContentMetadata(namedEvent.data);
      }
    });
  }

  private applyContentMetadata(contentMetadata: ContentMetadata) {
    this.duplicateImages = this.imageDuplicatesService.populateFrom(contentMetadata);
    this.lazyLoadingMetadata = this.lazyLoadingMetadataService.initialise(contentMetadata);
    const slideCount = this.albumView === AlbumView.GRID ? this.lazyLoadingMetadata?.contentMetadata?.files?.length : 10;
    this.lazyLoadingMetadataService.initialiseAvailableSlides(this.lazyLoadingMetadata, SlideInitialisation.COMPONENT_INIT, this.duplicateImages, ALL_PHOTOS, slideCount);
    this.noImages = !contentMetadata || !contentMetadata.files || contentMetadata.files.length === 0;
    this.lazyLoadingMetadataChange.emit(this.lazyLoadingMetadata);
    this.logger.info("initialised with", slideCount, "slides in total", "lazyLoadingMetadata:", this.lazyLoadingMetadata, "duplicateImages:", this.duplicateImages);
  }

  switchToView(albumView: AlbumView) {
    this.albumView = albumView;
    this.logger.info("switching to", albumView, "view");
    if (this.preview) {
      this.album.albumView = albumView;
    }
    this.updateUrlParams();
  }

  toggleShowTitles() {
    this.gridViewOptions.showTitles = !this.gridViewOptions.showTitles;
    if (this.preview) {
      this.album.gridViewOptions.showTitles = this.gridViewOptions.showTitles;
    }
    this.updateUrlParams();
  }

  isMasonryLayout(): boolean {
    return this.gridViewOptions?.layoutMode === GridLayoutMode.MASONRY;
  }

  toggleLayoutMode() {
    if (this.gridViewOptions) {
      this.gridViewOptions.layoutMode = this.isMasonryLayout()
        ? GridLayoutMode.FIXED_ASPECT
        : GridLayoutMode.MASONRY;
      if (this.preview) {
        this.album.gridViewOptions.layoutMode = this.gridViewOptions.layoutMode;
      }
      this.updateUrlParams();
    }
  }

  effectiveColumns(): number {
    if (this.runtimeColumns !== null) {
      return this.runtimeColumns;
    }
    return this.gridViewOptions?.maxColumns || DEFAULT_GRID_OPTIONS.maxColumns;
  }

  minColumns(): number {
    return this.gridViewOptions?.minColumns || DEFAULT_GRID_OPTIONS.minColumns;
  }

  maxColumns(): number {
    return this.gridViewOptions?.maxColumns || DEFAULT_GRID_OPTIONS.maxColumns;
  }

  columnsChanged(value: number) {
    this.runtimeColumns = value;
    this.gridViewOptions.maxColumns = value;
    if (this.preview && this.album.gridViewOptions) {
      this.album.gridViewOptions.maxColumns = value;
    }
    this.updateUrlParams();
  }

  effectiveGap(): number {
    if (this.runtimeGap !== null) {
      return this.runtimeGap;
    }
    return this.gridViewOptions?.gap ?? DEFAULT_GRID_OPTIONS.gap;
  }

  gapChanged(value: number) {
    this.runtimeGap = value;
    this.gridViewOptions.gap = value;
    if (this.preview && this.album.gridViewOptions) {
      this.album.gridViewOptions.gap = value;
    }
    this.updateUrlParams();
  }

  private initFromUrlParams() {
    if (!this.preview) {
      const urlParams = new URLSearchParams(window.location.search);
      const columns = urlParams.get(StoredValue.GRID_COLUMNS);
      const gap = urlParams.get(StoredValue.GRID_GAP);
      const layoutMode = urlParams.get(StoredValue.GRID_LAYOUT_MODE);
      const showTitles = urlParams.get(StoredValue.GRID_SHOW_TITLES);
      const albumViewParam = urlParams.get(StoredValue.ALBUM_VIEW);

      if (columns) {
        this.runtimeColumns = parseInt(columns, 10);
      }
      if (gap) {
        this.runtimeGap = parseFloat(gap);
      }
      if (layoutMode) {
        this.gridViewOptions.layoutMode = layoutMode as GridLayoutMode;
      }
      if (showTitles !== null) {
        this.gridViewOptions.showTitles = showTitles === "true";
      }
      if (albumViewParam) {
        this.albumView = albumViewParam as AlbumView;
      }
    }
  }

  private updateUrlParams() {
    if (!this.preview) {
      const queryParams: Record<string, string | null> = {};

      queryParams[StoredValue.ALBUM_VIEW] = this.albumView;
      if (this.runtimeColumns !== null) {
        queryParams[StoredValue.GRID_COLUMNS] = this.runtimeColumns.toString();
      }
      if (this.runtimeGap !== null) {
        queryParams[StoredValue.GRID_GAP] = this.runtimeGap.toString();
      }
      if (this.gridViewOptions?.layoutMode) {
        queryParams[StoredValue.GRID_LAYOUT_MODE] = this.gridViewOptions.layoutMode;
      }
      queryParams[StoredValue.GRID_SHOW_TITLES] = this.gridViewOptions?.showTitles?.toString() || "false";

      const urlTree = this.router.createUrlTree([], {
        queryParams,
        queryParamsHandling: "merge",
        fragment: this.activatedRoute.snapshot.fragment
      });
      this.location.replaceState(this.router.serializeUrl(urlTree));
    }
  }
}
