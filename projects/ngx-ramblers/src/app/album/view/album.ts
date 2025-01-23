import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import take from "lodash-es/take";
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

@Component({
  selector: "app-album",
  template: `
    <div class="row h-100">
      @if (album.allowSwitchView || preview) {
        <div class="col-sm-12">
          <div class="float-right mb-1">
            <ng-content/>
            @if (album.allowSwitchView) {
              <app-badge-button [tooltip]="'view as carousel'" [active]="albumView===AlbumView.CAROUSEL"
                                [icon]="faImage"
                                (click)="switchToView(AlbumView.CAROUSEL)" caption="carousel"/>
              <app-badge-button [tooltip]="'view as gallery'" [active]="albumView===AlbumView.GALLERY"
                                [icon]="faPhotoFilm"
                                (click)="switchToView(AlbumView.GALLERY)" caption="gallery"/>
              <app-badge-button [tooltip]="'view as grid'" [active]="albumView===AlbumView.GRID"
                                [icon]="faTableCells"
                                [noRightMargin]="albumView!==AlbumView.GRID"
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
      <div class="col-sm-12  my-auto">
        @if (noImages) {
          <div class="alert alert-warning">
            <fa-icon [icon]="faCircleInfo"/>
            <strong class="ml-1">No images exist in this album</strong>
            <div>Click the <strong>Edit images in album</strong> button to create new images in
            the {{ album.name }} album
          </div>
        </div>
        }
        @if (albumView === AlbumView.GALLERY) {
          <app-album-gallery
            [lazyLoadingMetadata]="lazyLoadingMetadata"
            [album]="album"
            [preview]="preview">
        </app-album-gallery>
        }
        @if (albumView === AlbumView.GRID) {
          <app-album-grid
            [lazyLoadingMetadata]="lazyLoadingMetadata"
            [album]="album"
            [preview]="preview"
            [gridViewOptions]="gridViewOptions">
        </app-album-grid>
        }
        @if (albumView === AlbumView.CAROUSEL) {
          <app-carousel
            [lazyLoadingMetadata]="lazyLoadingMetadata"
            [duplicateImages]="duplicateImages"
            [preview]="preview"
            [album]="album"
            [index]="index"></app-carousel>
        }
      </div>
    </div>
  `,
  standalone: false
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
      this.noImages = !allAndSelectedContentMetaData.contentMetadata;
      this.logger.info("in subscribe:album:", this.album, "allAndSelectedContentMetaData:", allAndSelectedContentMetaData);
    });
    this.broadcastService.on(NamedEventType.CONTENT_METADATA_CHANGED, (namedEvent: NamedEvent<ContentMetadata>) => {
      this.logger.info("received:", namedEvent);
      this.applyContentMetadata(namedEvent.data);
    });
  }

  private applyContentMetadata(contentMetadata: ContentMetadata) {
    this.duplicateImages = this.imageDuplicatesService.populateFrom(contentMetadata);
    this.lazyLoadingMetadata = this.lazyLoadingMetadataService.initialise(contentMetadata);
    this.lazyLoadingMetadataService.initialiseAvailableSlides(this.lazyLoadingMetadata, SlideInitialisation.COMPONENT_INIT, this.duplicateImages, ALL_PHOTOS, 10);
    this.noImages = !contentMetadata;
    this.lazyLoadingMetadataChange.emit(this.lazyLoadingMetadata);
    this.logger.info("initialised with", this?.lazyLoadingMetadata?.contentMetadata?.files?.length, "slides in total", "lazyLoadingMetadata:", this.lazyLoadingMetadata, "duplicateImages:", this.duplicateImages);
  }

  switchToView(albumView: AlbumView) {
    this.albumView = albumView;
    this.logger.info("switching to", albumView, "view");
  }

  toggleShowTitles() {
    this.gridViewOptions.showTitles = !this.gridViewOptions.showTitles;
  }
}
