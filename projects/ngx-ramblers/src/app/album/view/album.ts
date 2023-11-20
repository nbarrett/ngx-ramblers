import { Component, inject, Input, OnInit } from "@angular/core";
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

@Component({
  selector: "app-album",
  template: `
    <div class="row h-100">
      <div *ngIf="album.allowSwitchView" class="col-sm-12">
        <div class="float-right mb-1">
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
          <app-badge-button *ngIf="albumView===AlbumView.GRID" [tooltip]="'show titles'"
                            [active]="gridViewOptions?.showTitles" [icon]="faRectangleAd"
                            noRightMargin
                            (click)="toggleShowTitles()"
                            [caption]="gridViewOptions?.showTitles? 'hide titles':'show titles'"/>
        </div>
      </div>
      <div class="col-sm-12  my-auto">
        <div class="alert alert-warning" *ngIf="noImages">
          <fa-icon [icon]="faCircleInfo"/>
          <strong class="ml-1">No images exist in this album</strong>
          <div>Click the <strong>Edit images in album</strong> button on the left to create new images in the {{album.name}} album</div>
        </div>
        <app-album-gallery *ngIf="albumView===AlbumView.GALLERY"
                           [album]="album"
                           [preview]="preview">
        </app-album-gallery>
        <app-album-grid *ngIf="albumView===AlbumView.GRID"
                        [album]="album"
                        [preview]="preview"
                        [gridViewOptions]="gridViewOptions">
        </app-album-grid>
        <app-carousel *ngIf="albumView===AlbumView.CAROUSEL"
                      [preview]="preview"
                      [album]="album"
                      [index]="index"></app-carousel>
      </div>
    </div>
  `
})
export class AlbumComponent implements OnInit {

  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AlbumComponent", NgxLoggerLevel.OFF);
  public noImages: boolean;

  @Input("preview") set previewValue(value: boolean) {
    this.preview = coerceBooleanProperty(value);
    this.logger.info("preview:", this.preview);
  }

  @Input()
  public index: number;
  @Input()
  album: AlbumData;

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
    this.switchToView(this.album.albumView || AlbumView.GRID);
    this.contentMetadataService.contentMetadataNotifications().subscribe(metadataResponses => {
      const allAndSelectedContentMetaData = this.contentMetadataService.selectMetadataBasedOn(this.album?.name, metadataResponses);
      this.noImages = !allAndSelectedContentMetaData.contentMetadata;
    });

  }

  switchToView(albumView: AlbumView) {
    this.albumView = albumView;
    this.logger.info("switching to", albumView, "view");
  }

  toggleShowTitles() {
    this.gridViewOptions.showTitles = !this.gridViewOptions.showTitles;
  }
}
