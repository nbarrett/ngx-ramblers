import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { take } from "es-toolkit/compat";
import {
  faCircleInfo,
  faImage,
  faImages,
  faPhotoFilm,
  faRectangleAd,
  faSearch,
  faTableCells
} from "@fortawesome/free-solid-svg-icons";
import { AlbumData, AlbumView, GridViewOptions } from "../../models/content-text.model";
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
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { AlbumGalleryComponent } from "./album-gallery";
import { AlbumGridComponent } from "./album-grid";
import { CarouselComponent } from "../../carousel/view/carousel";

@Component({
    selector: "app-album",
    template: `
      <div class="row h-100">
        @if (album.allowSwitchView || preview) {
          <div class="col-sm-12">
            <div class="d-flex gap-1 justify-content-end mb-1">
              <ng-content/>
              @if (album.allowSwitchView) {
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
                  <app-badge-button [tooltip]="'show titles'"
                                    [active]="gridViewOptions?.showTitles" [icon]="faRectangleAd"
                                    noRightMargin
                                    (click)="toggleShowTitles()"
                                    [caption]="gridViewOptions?.showTitles? 'hide titles':'show titles'"/>
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
                            [gridViewOptions]="gridViewOptions"/>
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
    imports: [BadgeButtonComponent, TooltipDirective, FontAwesomeModule, AlbumGalleryComponent, AlbumGridComponent, CarouselComponent]
})
export class AlbumComponent implements OnInit {

  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public lazyLoadingMetadataService: LazyLoadingMetadataService = inject(LazyLoadingMetadataService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private imageDuplicatesService: ImageDuplicatesService = inject(ImageDuplicatesService);
  private broadcastService: BroadcastService<ContentMetadata> = inject(BroadcastService);
  private logger = this.loggerFactory.createLogger("AlbumComponent", NgxLoggerLevel.ERROR);
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
  protected readonly AlbumView = AlbumView;
  protected readonly faCircleInfo = faCircleInfo;

  ngOnInit() {
    this.logger.info("ngOnInit:album:", this.album);
    this.gridViewOptions = this.album.gridViewOptions || {showTitles: true, showDates: true};
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
  }

  toggleShowTitles() {
    this.gridViewOptions.showTitles = !this.gridViewOptions.showTitles;
  }
}
