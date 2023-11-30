import { Component, Input, OnInit } from "@angular/core";
import { faChevronRight, faPencil } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import {
  AlbumData,
  AlbumView,
  DEFAULT_GALLERY_OPTIONS,
  PageContent,
  PageContentRow,
  View
} from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { GroupEvent, GroupEventType } from "../../../models/committee.model";
import { enumKeyValues, KeyValue } from "../../../services/enums";
import { LazyLoadingMetadata } from "../../../models/content-metadata.model";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-dynamic-content-site-edit-album",
  template: `
      <ng-container *ngIf="!actions.editActive(rowIndex)">
          <ng-container *ngIf="actions.isAlbum(row)">
              <div class="row">
                  <div class="col-sm-2">
                      <app-group-event-type-selector [dataSource]="row.carousel.eventType" label="Link to Event Type"
                                                     (eventChange)="eventTypeChange($event)"
                                                     (initialValue)="groupEventType=$event"/>
                  </div>
                  <div class="col-sm-10">
                      <app-group-event-selector *ngIf="groupEventType"
                                                [label]="'Link to ' + groupEventType?.description"
                                                [eventId]="row.carousel.eventId"
                                                [dataSource]="groupEventType?.area"
                                                (eventCleared)="eventCleared()"
                                                (eventChange)="eventChange(row.carousel, $event)"/>
                  </div>
              </div>
              <hr>
              <div class="row">
                  <div class="col-sm-12">
                      <div class="custom-control custom-checkbox">
                          <input [(ngModel)]="row.carousel.showTitle"
                                 type="checkbox" class="custom-control-input"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-titles')">
                          <label class="custom-control-label"
                                 [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-titles')">
                              Show Titles on this page</label>
                      </div>
                  </div>
              </div>
              <div class="row">
                  <div class="col-sm-12">
                      <label [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-album-title')">
                          Album Title</label>
                      <input [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-album-title')"
                             [(ngModel)]="row.carousel.title"
                             type="text" class="form-control">
                  </div>
              </div>
              <div class="row mt-2">
                  <div [ngClass]="row.carousel.eventId ? 'col-sm-6':'col-sm-12'">
                      <label [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-album-subtitle')">
                          Album Subtitle</label>
                      <input [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-album-subtitle')"
                             [(ngModel)]="row.carousel.subtitle"
                             type="text" class="form-control">
                  </div>
                  <div *ngIf="row.carousel.eventId" class="col-md-6">
                      <div class="form-group">
                          <label>Link Preview</label>
                          <div>
                              <a [href]="urlService.linkUrl({area: row.carousel.eventType, id: row.carousel.eventId })">{{row.carousel.eventDate | displayDay}}
                                  - {{row.carousel.subtitle}}</a>
                          </div>
                      </div>
                  </div>
              </div>
              <hr>
              <div class="row mt-2">
                  <div class="col-sm-12">
                      <div class="custom-control custom-checkbox">
                          <input [(ngModel)]="row.carousel.showCoverImageAndText"
                                 type="checkbox" class="custom-control-input"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-cover-image-and-text')">
                          <label class="custom-control-label"
                                 [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-cover-image-and-text')">
                              Show Cover Image and introductory text on this page</label>
                      </div>
                  </div>
              </div>
              <div class="row mt-2">
                  <div class="col-sm-12">
                      <label [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-pre-cover-text')">
                          Introductory Text</label>
                      <app-markdown-editor noSave [data]="{text: row.carousel.introductoryText}"
                                           [name]="'pre cover text'"
                                           [initialView]="initialViewFor(row.carousel.introductoryText)"
                                           (changed)="row.carousel.introductoryText=$event.text">
                      </app-markdown-editor>
                  </div>
              </div>
              <ng-container *ngIf="lazyLoadingMetadata?.contentMetadata?.coverImage">
                  <div class="row mt-2">
                      <div class="col-sm-6">
                          <div class="form-group">
                              <label [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-cover-image-height')">
                                  Cover Image Height</label>
                              <input [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-cover-image-height')"
                                     name="coverImageHeight"
                                     class="form-control"
                                     type="number"
                                     [(ngModel)]="row.carousel.coverImageHeight"/>

                          </div>
                      </div>
                      <div class="col-sm-6">
                          <div class="form-group">
                              <label
                                      [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-cover-image-border-radius')">
                                  Border Radius</label>
                              <input
                                      [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-cover-image-border-radius')"
                                      #coverImageBorderRadius
                                      (input)="row.carousel.coverImageBorderRadius=actions.constrainInput(coverImageBorderRadius, 0, 20)"
                                      [value]="row.carousel.coverImageBorderRadius"
                                      class="form-control"
                                      type="number">
                          </div>
                      </div>
                  </div>
                  <app-card-image [height]="row.carousel.coverImageHeight"
                                  [borderRadius]="row.carousel.coverImageBorderRadius"
                                  [imageSource]="urlService.imageSourceFor({image:lazyLoadingMetadata.contentMetadata.coverImage},
                                  lazyLoadingMetadata.contentMetadata)"/>
              </ng-container>
              <hr>
              <div class="row mt-2">
                  <div class="col-sm-12">
                      <div class="custom-control custom-checkbox">
                          <input [(ngModel)]="row.carousel.showPreAlbumText"
                                 type="checkbox" class="custom-control-input"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-pre-album-text')">
                          <label class="custom-control-label"
                                 [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-pre-album-text')">
                              Show pre-album text on this page</label>
                      </div>
                  </div>
                  <div class="col-sm-12">
                      <label [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-pre-album-text')">
                          Pre Album Text</label>
                      <app-markdown-editor noSave [data]="{text: row.carousel.preAlbumText, name:'cover image text'}"
                                           [initialView]="initialViewFor(row.carousel.preAlbumText)"
                                           (changed)="row.carousel.preAlbumText=$event.text">
                      </app-markdown-editor>
                  </div>
              </div>
              <hr>
          </ng-container>
          <div class="row mt-2">
              <div class="col-sm-6">
                  <div class="row">
                      <div class="col-sm-12">
                          <div class="mb-2">Album Settings</div>
                          <div class="custom-control custom-checkbox">
                              <input [(ngModel)]="row.carousel.showStoryNavigator"
                                     type="checkbox" class="custom-control-input"
                                     [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-story-navigator')">
                              <label class="custom-control-label"
                                     [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-story-navigator')">
                                  Show Story Navigator</label>
                          </div>
                      </div>
                      <div class="col-sm-6">
                          <div class="custom-control custom-checkbox">
                              <input [(ngModel)]="row.carousel.showIndicators"
                                     type="checkbox" class="custom-control-input"
                                     [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-story-indicators')">
                              <label class="custom-control-label"
                                     [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-story-indicators')">
                                  Show Indicators</label>
                          </div>
                      </div>
                      <div class="col-sm-6">
                          <div class="custom-control custom-checkbox">
                              <input [(ngModel)]="row.carousel.gridViewOptions.showTitles"
                                     type="checkbox" class="custom-control-input"
                                     [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-image-titles')">
                              <label class="custom-control-label"
                                     [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-image-titles')">
                                  Show Image Titles</label>
                          </div>
                      </div>
                      <div class="col-sm-6">
                          <div class="custom-control custom-checkbox">
                              <input [(ngModel)]="row.carousel.gridViewOptions.showDates"
                                     type="checkbox" class="custom-control-input"
                                     [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-image-dates')">
                              <label class="custom-control-label"
                                     [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-image-dates')">
                                  Show Image Dates</label>
                          </div>
                      </div>
                      <div *ngIf="actions.isAlbum(row)" class="col-sm-6">
                          <div class="custom-control custom-checkbox">
                              <input [(ngModel)]="row.carousel.allowSwitchView"
                                     type="checkbox" class="custom-control-input"
                                     [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-allow-switch-view')">
                              <label class="custom-control-label"
                                     [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-allow-switch-view')">
                                  Allow Switch View</label>
                          </div>
                      </div>
                  </div>
                  <div class="row">
                      <div *ngIf="actions.isAlbum(row)" class="col-auto">
                          <div class="form-group">
                              <label
                                      [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-album-view')">
                                  Album View</label>
                              <select class="form-control input-sm"
                                      [(ngModel)]="row.carousel.albumView"
                                      [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-album-view')">
                                  <option *ngFor="let type of enumKeyValuesForAlbumView"
                                          [ngValue]="type.value">{{stringUtils.asTitle(type.value)}}</option>
                              </select>
                          </div>
                      </div>
                      <div *ngIf="row.carousel.galleryViewOptions && row.carousel.allowSwitchView && actions.isAlbum(row)"
                           class="col-auto">
                          <div class="form-group">
                              <label
                                      [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-thumb-position')">
                                  Thumb Position</label>
                              <select class="form-control input-sm"
                                      [(ngModel)]="row.carousel.galleryViewOptions.thumbPosition"
                                      [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-thumb-position')">
                                  <option *ngFor="let thumbPosition of thumbPositions"
                                          [ngValue]="thumbPosition">{{stringUtils.asTitle(thumbPosition)}}</option>
                              </select>
                          </div>
                      </div>
                      <div class="col-auto">
                          <div class="form-group">
                              <label
                                      [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-slide-interval')">
                                  Slide interval in seconds</label>
                              <input
                                      [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-slide-interval')"
                                      #input
                                      (input)="row.carousel.slideInterval=actions.constrainInput(input, 0,30) * 1000"
                                      [value]="row.carousel.slideInterval/1000"
                                      autocomplete="columns"
                                      class="form-control interval-input"
                                      type="number">
                          </div>
                      </div>
                      <div class="col-auto" app-badge-button [icon]="faChevronRight"
                           (click)="actions.toggleEditMode(rowIndex)"
                           [caption]="'Edit images in album'" iconPositionRight alignRight>
                      </div>
                  </div>
              </div>
              <div class="col-sm-6">
                  <app-album preview *ngIf="actions.isCarouselOrAlbum(row)"
                             (lazyLoadingMetadataChange)="lazyLoadingMetadata=$event"
                             [album]="albumData(row)"
                             [index]="actions.carouselOrAlbumIndex(row, pageContent)"></app-album>
              </div>
          </div>
      </ng-container>
      <app-image-list-edit *ngIf="actions.editActive(rowIndex)" [name]="row?.carousel?.name"
                           (exit)="actions.toggleEditMode(rowIndex)"></app-image-list-edit>`,
  styleUrls: ["./dynamic-content.sass"],
})
export class DynamicContentSiteEditAlbumComponent implements OnInit {

  constructor(
    public stringUtils: StringUtilsService,
    public actions: PageContentActionsService,
    public urlService: UrlService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("DynamicContentSiteEditAlbumComponent", NgxLoggerLevel.OFF);
  }

  @Input()
  public row: PageContentRow;
  @Input()
  public rowIndex: number;
  @Input()
  public pageContent: PageContent;
  enumKeyValuesForAlbumView: KeyValue<string>[] = enumKeyValues(AlbumView);
  thumbPositions: string[] = ["top", "left", "right", "bottom"];
  private logger: Logger;
  faPencil = faPencil;
  groupEventType: GroupEventType;

  protected readonly faChevronRight = faChevronRight;

  protected readonly View = View;
  public lazyLoadingMetadata: LazyLoadingMetadata;

  ngOnInit() {
    if (!this.row?.carousel?.galleryViewOptions) {
      this.row.carousel.galleryViewOptions = DEFAULT_GALLERY_OPTIONS;
    }
  }

  albumData(row: PageContentRow): AlbumData {
    this.logger.off("carouselData:", row.carousel);
    return row?.carousel;
  }

  eventTypeChange(groupEventType: GroupEventType) {
    this.groupEventType = groupEventType;
  }

  eventChange(carousel: AlbumData, groupEvent: GroupEvent) {
    carousel.eventId = groupEvent.id;
    carousel.subtitle = groupEvent.title;
    carousel.eventType = groupEvent.eventType.area;
    carousel.eventDate = groupEvent.eventDate;
    this.logger.info("received groupEvent:", groupEvent, "carousel now:", carousel);
  }

  eventCleared() {
    this.row.carousel.eventId = null;
    this.row.carousel.eventDate = null;
  }

  initialViewFor(text: string): View {
    return View.EDIT;
  }
}
