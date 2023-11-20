import { Component, Input, OnInit } from "@angular/core";
import { faChevronRight, faPencil } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import {
  AlbumData,
  AlbumView,
  DEFAULT_GALLERY_OPTIONS,
  PageContent,
  PageContentRow
} from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { GroupEvent, GroupEventType } from "../../../models/committee.model";
import { enumKeyValues, KeyValue } from "../../../services/enums";

@Component({
  selector: "app-dynamic-content-site-edit-album",
  template: `
    <ng-container *ngIf="!actions.editActive(rowIndex)">
      <div class="row">
        <div class="col-sm-2">
          <app-group-event-type-selector [dataSource]="row.carousel.eventType" label="Link to Event Type"
                                         (eventChange)="eventTypeChange($event)"
                                         (initialValue)="groupEventType=$event"/>
        </div>
        <div class="col-sm-10">
          <app-group-event-selector *ngIf="groupEventType" [label]="'Link to ' + groupEventType?.description"
                                    [eventId]="row.carousel.eventId"
                                    [dataSource]="groupEventType?.area"
                                    (eventCleared)="eventCleared()"
                                    (eventChange)="eventChange(row.carousel, $event)"/>
        </div>
      </div>
      <div class="row">
        <div class="col-sm-12">
          <div class="custom-control custom-checkbox">
            <input [(ngModel)]="row.carousel.showTitle"
                   type="checkbox" class="custom-control-input"
                   [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-titles')">
            <label class="custom-control-label"
                   [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-titles')">
              Show Title on this page</label>
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
        <div class="col-sm-12">
          <label [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-album-subtitle')">
            Album Subtitle</label>
          <input [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-album-subtitle')"
                 [(ngModel)]="row.carousel.subtitle"
                 type="text" class="form-control">
        </div>
      </div>
      <div class="row mt-3">
        <div class="col-sm-6">
          <div class="row mt-3">
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
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("DynamicContentSiteEditAlbumComponent", NgxLoggerLevel.DEBUG);
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
    carousel.title = groupEvent.title;
    carousel.eventType = groupEvent.eventType.area;
    carousel.eventDate = groupEvent.eventDate;
    this.logger.info("received groupEvent:", groupEvent, "carousel now:", carousel);
  }

  eventCleared() {
    this.row.carousel.eventId = null;
    this.row.carousel.eventDate = null;
  }
}
