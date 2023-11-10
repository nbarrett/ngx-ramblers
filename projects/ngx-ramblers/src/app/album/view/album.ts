import { Component, inject, Input, OnInit } from "@angular/core";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import take from "lodash-es/take";
import {
  faImage,
  faImages,
  faPhotoFilm,
  faRectangleAd,
  faSearch,
  faTableCells
} from "@fortawesome/free-solid-svg-icons";
import { AlbumData, AlbumView, GridViewOptions } from "../../models/content-text.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

@Component({
  selector: "app-album",
  template: `
    <div class="row">
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
                            [active]="gridViewOptions.showTitles" [icon]="faRectangleAd"
                            noRightMargin
                            (click)="toggleShowTitles()"
                            [caption]="gridViewOptions.showTitles? 'hide titles':'show titles'"/>
        </div>
      </div>
      <div class="col-sm-12">
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
                      [album]="album"
                      [index]="index"></app-carousel>
      </div>
    </div>
  `
})
export class AlbumComponent implements OnInit {
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AlbumComponent", NgxLoggerLevel.INFO);

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
  public gridViewOptions: GridViewOptions = {showTitles: true, showDates: true};
  protected readonly AlbumView = AlbumView;

  ngOnInit() {
    this.logger.info("ngOnInit:album:", this.album);
    this.switchToView(this.album.albumView || AlbumView.GRID);
  }

  switchToView(albumView: AlbumView) {
    this.albumView = albumView;
    this.logger.info("switching to", albumView, "view");
  }

  toggleShowTitles() {
    this.gridViewOptions.showTitles = !this.gridViewOptions.showTitles;
  }

}
