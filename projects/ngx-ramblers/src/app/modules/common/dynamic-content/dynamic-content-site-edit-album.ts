import { Component, inject, Input, OnInit } from "@angular/core";
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
import { GroupEventSummary, GroupEventType } from "../../../models/committee.model";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { LazyLoadingMetadata } from "../../../models/content-metadata.model";
import { UrlService } from "../../../services/url.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FormsModule } from "@angular/forms";
import { AlbumComponent } from "../../../album/view/album";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { GroupEventTypeSelectorComponent } from "../../../group-events-selector/group-event-type-selector";
import { GroupEventSelectorComponent } from "../../../group-events-selector/group-event-selector";
import { NgClass } from "@angular/common";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { CardImageComponent } from "../card/image/card-image";
import { ImageListEditComponent } from "../../../carousel/edit/image-list-edit/image-list-edit";
import { DisplayDayPipe } from "../../../pipes/display-day.pipe";

@Component({
    selector: "app-dynamic-content-site-edit-album",
    template: `
    @if (!actions.editActive(rowIndex)) {
      @if (actions.isAlbum(row)) {
        <tabset class="custom-tabset">
          <tab heading="Album Settings" [active]="lastSelectedTabIndex === 3"
               (selectTab)="onTabSelect(3)">
            <div class="img-thumbnail thumbnail-admin-edit">
              <div class="row mt-2">
                <div class="col-sm-12">
                  <div class="row">
                    <div class="col-sm-6">
                      <div class="form-check">
                        <input [(ngModel)]="row.carousel.showStoryNavigator"
                               type="checkbox" class="form-check-input"
                               [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-story-navigator')">
                        <label class="form-check-label"
                               [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-story-navigator')">
                          Show Story Navigator</label>
                      </div>
                    </div>
                    <div class="col-sm-6">
                      <div class="form-check">
                        <input [(ngModel)]="row.carousel.showIndicators"
                               type="checkbox" class="form-check-input"
                               [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-story-indicators')">
                        <label class="form-check-label"
                               [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-story-indicators')">
                          Show Indicators</label>
                      </div>
                    </div>
                    <div class="col-sm-6">
                      <div class="form-check">
                        <input [(ngModel)]="row.carousel.gridViewOptions.showTitles"
                               type="checkbox" class="form-check-input"
                               [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-image-titles')">
                        <label class="form-check-label"
                               [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-image-titles')">
                          Show Image Titles</label>
                      </div>
                    </div>
                    <div class="col-sm-6">
                      <div class="form-check">
                        <input [(ngModel)]="row.carousel.galleryViewOptions.thumb"
                               type="checkbox" class="form-check-input"
                               [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-hide-thumbnail-selector')">
                        <label class="form-check-label"
                               [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-hide-thumbnail-selector')">
                          Hide Thumbnail Selector</label>
                      </div>
                    </div>
                    <div class="col-sm-6">
                      <div class="form-check">
                        <input [(ngModel)]="row.carousel.gridViewOptions.showDates"
                               type="checkbox" class="form-check-input"
                               [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-image-dates')">
                        <label class="form-check-label"
                               [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-image-dates')">
                          Show Image Dates</label>
                      </div>
                    </div>
                    @if (actions.isAlbum(row)) {
                      <div class="col-sm-6">
                        <div class="form-check">
                          <input [(ngModel)]="row.carousel.allowSwitchView"
                                 type="checkbox" class="form-check-input"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-allow-switch-view')">
                          <label class="form-check-label"
                                 [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-allow-switch-view')">
                          Allow Switch View</label>
                        </div>
                      </div>
                    }
                  </div>
                  <div class="row">
                    @if (actions.isAlbum(row)) {
                      <div class="col-auto">
                        <div class="form-group">
                          <label
                            [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-album-view')">
                          Album View</label>
                          <select class="form-control input-sm"
                                  [(ngModel)]="row.carousel.albumView"
                                  [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-album-view')">
                            @for (type of enumKeyValuesForAlbumView; track type) {
                              <option
                                [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                              </option>
                            }
                          </select>
                        </div>
                      </div>
                    }
                    @if ((row.carousel.galleryViewOptions || row.carousel.allowSwitchView) && actions.isAlbum(row)) {
                      <div
                        class="col-auto">
                        <div class="form-group">
                          <label
                            [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-thumb-position')">
                          Thumb Position</label>
                          <select class="form-control input-sm"
                                  [disabled]="row.carousel.galleryViewOptions.thumb"
                                  [(ngModel)]="row.carousel.galleryViewOptions.thumbPosition"
                                  [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-thumb-position')">
                            @for (thumbPosition of thumbPositions; track thumbPosition) {
                              <option
                                [ngValue]="thumbPosition">{{ stringUtils.asTitle(thumbPosition) }}
                              </option>
                            }
                          </select>
                        </div>
                      </div>
                    }
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
                    <div class="col-auto">
                      <div class="form-group">
                        <label [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-height')">
                          Carousel Height</label>
                        <input [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-height')"
                               name="coverImageHeight"
                               class="form-control"
                               type="number"
                               [(ngModel)]="row.carousel.height"/>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="col-sm-12">
                  @if (actions.isCarouselOrAlbum(row)) {
                    <app-album preview
                               (lazyLoadingMetadataChange)="lazyLoadingMetadata=$event"
                               [album]="row?.carousel"
                               [albumView]="row?.carousel?.albumView"
                               [index]="actions.carouselOrAlbumIndex(row, pageContent)">
                      <app-badge-button [icon]="faChevronRight"
                                        (click)="actions.toggleEditMode(rowIndex)"
                                        [caption]="'Edit images in album'" iconPositionRight noRightMargin>
                      </app-badge-button>
                    </app-album>
                  }
                </div>
              </div>
            </div>
          </tab>
          <tab heading="Titles and Event Linking" [active]="lastSelectedTabIndex === 0"
               (selectTab)="onTabSelect(0)">
            <div class="img-thumbnail thumbnail-admin-edit">
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-check">
                    <input [(ngModel)]="row.carousel.showTitle"
                           type="checkbox" class="form-check-input"
                           [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-titles')">
                    <label class="form-check-label"
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
                <div class="col-sm-2">
                  <app-group-event-type-selector [dataSource]="row.carousel.eventType"
                                                 label="Link to Event Type"
                                                 (eventChange)="eventTypeChange($event)"
                                                 (initialValue)="groupEventType=$event"/>
                </div>
                <div class="col-sm-10">
                  @if (groupEventType) {
                    <app-group-event-selector
                      [label]="'Link to ' + groupEventType?.description"
                      [eventId]="row.carousel.eventId"
                      [dataSource]="groupEventType?.area"
                      (eventCleared)="eventCleared()"
                      (eventChange)="eventChange(row.carousel, $event)"/>
                  }
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
                @if (row.carousel.eventId) {
                  <div class="col-md-6">
                    <div class="form-group">
                      <label>Link Preview</label>
                      <div>
                        <a
                          [href]="urlService.linkUrl({area: row.carousel.eventType, id: row.carousel.eventId })">{{ row.carousel.eventDate | displayDay }}
                        - {{ row.carousel.subtitle }}</a>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </tab>
          <tab heading="Cover Image and introductory text"
               [active]="lastSelectedTabIndex === 1"
               (selectTab)="onTabSelect(1)">
            <div class="img-thumbnail thumbnail-admin-edit">
              <div class="row mt-2">
                <div class="col-sm-12">
                  <div class="form-check">
                    <input [(ngModel)]="row.carousel.showCoverImageAndText"
                           type="checkbox" class="form-check-input"
                           [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-cover-image-and-text')">
                    <label class="form-check-label"
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
              @if (lazyLoadingMetadata?.contentMetadata?.coverImage) {
                <div class="row mt-2">
                  <div class="col-sm-6">
                    <div class="form-group">
                      <label
                        [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-cover-image-height')">
                        Cover Image Height</label>
                      <input
                        [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-cover-image-height')"
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
              }
            </div>
          </tab>
          <tab heading="Pre-Album Text" [active]="lastSelectedTabIndex === 2"
               (selectTab)="onTabSelect(2)">
            <div class="img-thumbnail thumbnail-admin-edit">
              <div class="row mt-2">
                <div class="col-sm-12">
                  <div class="form-check">
                    <input [(ngModel)]="row.carousel.showPreAlbumText"
                           type="checkbox" class="form-check-input"
                           [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-pre-album-text')">
                    <label class="form-check-label"
                           [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-pre-album-text')">
                      Show pre-album text on this page</label>
                  </div>
                </div>
                <div class="col-sm-12">
                  <label [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-pre-album-text')">
                    Pre Album Text</label>
                  <app-markdown-editor noSave
                                       [data]="{text: row.carousel.preAlbumText, name:'cover image text'}"
                                       [initialView]="initialViewFor(row.carousel.preAlbumText)"
                                       (changed)="row.carousel.preAlbumText=$event.text">
                  </app-markdown-editor>
                </div>
              </div>
            </div>
          </tab>
        </tabset>
      }
    }
    @if (actions.editActive(rowIndex)) {
      <app-image-list-edit [name]="row?.carousel?.name"
                           (exit)="actions.toggleEditMode(rowIndex)"/>
    }`,
    styleUrls: ["./dynamic-content.sass"],
    imports: [TabsetComponent, TabDirective, FormsModule, AlbumComponent, BadgeButtonComponent, GroupEventTypeSelectorComponent, GroupEventSelectorComponent, NgClass, MarkdownEditorComponent, CardImageComponent, ImageListEditComponent, DisplayDayPipe]
})
export class DynamicContentSiteEditAlbumComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditAlbumComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  actions = inject(PageContentActionsService);
  urlService = inject(UrlService);
  uiActionsService = inject(UiActionsService);
  public row: PageContentRow;

  @Input("row") set rowValue(row: PageContentRow) {
    this.logger.info("row changed:", row);
    this.row = row
  }
  @Input()
  public rowIndex: number;
  @Input()
  public pageContent: PageContent;
  enumKeyValuesForAlbumView: KeyValue<string>[] = enumKeyValues(AlbumView);
  thumbPositions: string[] = ["top", "left", "right", "bottom"];
  faPencil = faPencil;
  groupEventType: GroupEventType;
  protected readonly faChevronRight = faChevronRight;

  protected readonly View = View;
  public lazyLoadingMetadata: LazyLoadingMetadata;
  public lastSelectedTabIndex: number;

  ngOnInit() {
    this.lastSelectedTabIndex = +this.uiActionsService.initialValueFor(StoredValue.ALBUM_TAB, 0);

    if (!this.row?.carousel?.galleryViewOptions) {
      this.row.carousel.galleryViewOptions = DEFAULT_GALLERY_OPTIONS;
    }
  }

  onTabSelect(index: number) {
    this.logger.info("onTabSelect:", index);
    this.lastSelectedTabIndex = index;
    this.uiActionsService.saveValueFor(StoredValue.ALBUM_TAB, this.lastSelectedTabIndex);
  }

  eventTypeChange(groupEventType: GroupEventType) {
    this.groupEventType = groupEventType;
  }

  eventChange(carousel: AlbumData, groupEvent: GroupEventSummary) {
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
    return text ? View.VIEW : View.EDIT;
  }
}
