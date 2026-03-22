import { Component, inject, Input, OnInit } from "@angular/core";
import { isEqual, kebabCase } from "es-toolkit/compat";
import { faPencil, faRemove } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import {
  AlbumData,
  AlbumEditTab,
  AlbumView,
  ContentText,
  DEFAULT_GALLERY_OPTIONS,
  DEFAULT_GRID_OPTIONS,
  FocalPointTarget,
  GridLayoutMode,
  ImageFit,
  PageContent,
  PageContentRow,
  PageContentType,
  ThumbPosition,
  View
} from "../../../models/content-text.model";
import { AccessLevel } from "../../../models/member-resource.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { GroupEventSummary, GroupEventType } from "../../../models/committee.model";
import { enumKeyValues, enumValueForKey, KeyValue } from "../../../functions/enums";
import { LazyLoadingMetadata } from "../../../models/content-metadata.model";
import { UrlService } from "../../../services/url.service";
import { StoredValue } from "../../../models/ui-actions";
import { ActivatedRoute, Router } from "@angular/router";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FormsModule } from "@angular/forms";
import { AlbumComponent } from "../../../album/view/album";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { GroupEventTypeSelectorComponent } from "../../../group-events-selector/group-event-type-selector";
import { GroupEventSelectorComponent } from "../../../group-events-selector/group-event-selector";
import { DecimalPipe, Location, NgClass } from "@angular/common";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { ImageListEditComponent } from "../../../carousel/edit/image-list-edit/image-list-edit";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Image } from "../../../models/system.model";
import { NgSelectComponent } from "@ng-select/ng-select";
import { ColourSelectorComponent } from "../../../pages/banner/colour-selector";
import { DisplayDayPipe } from "../../../pipes/display-day.pipe";
import { ActionButtons } from "../action-buttons/action-buttons";
import { FocalPoint, FocalPointPickerComponent } from "../focal-point-picker/focal-point-picker";
import { rangeSliderStyles } from "../../../components/range-slider.styles";
import { RangeSliderComponent } from "../../../components/range-slider";

function scaleOptions(...entries: [number, string][]): { value: number; label: string }[] {
  return entries.map(([value, name]) => ({value, label: `${name} (${value}x)`}));
}

@Component({
    selector: "app-dynamic-content-site-edit-album",
    template: `
      @if (!actions.editActive(rowIndex)) {
        @if (actions.isAlbum(row)) {
          <tabset class="custom-tabset">
            <tab heading="{{enumValueForKey(AlbumEditTab, AlbumEditTab.ALBUM_SETTINGS)}}"
                 [active]="tabActive(AlbumEditTab.ALBUM_SETTINGS)"
                 (selectTab)="selectTab(AlbumEditTab.ALBUM_SETTINGS)">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row mt-2">
                  <div class="col-sm-12">
                    <div class="row">
                      <div class="col-sm-6">
                        <div class="form-check mb-0">
                          <input [(ngModel)]="row.carousel.showStoryNavigator"
                                 type="checkbox" class="form-check-input"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-story-navigator')">
                          <label class="form-check-label"
                                 [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-story-navigator')">
                            Show Story Navigator</label>
                        </div>
                      </div>
                      <div class="col-sm-6">
                        <div class="form-check mb-0">
                          <input [(ngModel)]="row.carousel.showIndicators"
                                 type="checkbox" class="form-check-input"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-story-indicators')">
                          <label class="form-check-label"
                                 [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-story-indicators')">
                            Show Indicators</label>
                        </div>
                      </div>
                      <div class="col-sm-6">
                        <div class="form-check mb-0">
                          <input [(ngModel)]="row.carousel.gridViewOptions.showTitles"
                                 type="checkbox" class="form-check-input"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-image-titles')">
                          <label class="form-check-label"
                                 [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-image-titles')">
                            Show Image Titles</label>
                        </div>
                      </div>
                      <div class="col-sm-6">
                        <div class="form-check mb-0">
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
                              Allow View To Be Changed In Presentation Mode</label>
                          </div>
                        </div>
                      }
                    </div>
                    <div class="d-flex flex-wrap gap-3 mt-3">
                      @if ((row.carousel.galleryViewOptions || row.carousel.allowSwitchView) && actions.isAlbum(row)) {
                        <div class="form-group flex-fill">
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
                      }
                      <div class="form-group flex-fill">
                        <label
                          [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-slide-interval')">
                          Slide interval in seconds</label>
                        <input
                          [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-slide-interval')"
                          #input
                          (input)="row.carousel.slideInterval=actions.constrainInput(input, 0,30) * 1000"
                          [value]="row.carousel.slideInterval/1000"
                          autocomplete="columns"
                          class="form-control"
                          type="number">
                      </div>
                      <div class="form-group flex-fill">
                        <label [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-height')">
                          Carousel Height</label>
                        <input [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-height')"
                               name="coverImageHeight"
                               class="form-control"
                               type="number"
                               [(ngModel)]="row.carousel.height"/>
                      </div>
                      <div class="form-group flex-fill">
                        <label [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-border-radius')">
                          Border Radius</label>
                        <input [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-border-radius')"
                               class="form-control"
                               type="number"
                               min="0"
                               max="20"
                               [(ngModel)]="row.carousel.gridViewOptions.borderRadius"/>
                      </div>
                    </div>
                  </div>
                  @if (row?.carousel?.albumView === AlbumView.BACKGROUNDS) {
                    <div class="col-sm-12 mt-3">
                      <div class="row">
                        <div class="col-md-4">
                          <app-colour-selector label="Title Colour"
                                               [itemWithClassOrColour]="titleColourWrapper"/>
                        </div>
                        <div class="col-md-4">
                          <label>Title Scale</label>
                          <ng-select [items]="titleScaleOptions"
                                     bindLabel="label"
                                     bindValue="value"
                                     [clearable]="false"
                                     [(ngModel)]="row.carousel.backgroundsOverlay.titleScale">
                          </ng-select>
                        </div>
                        <div class="col-md-4">
                          <app-colour-selector label="Text Colour"
                                               [itemWithClassOrColour]="textColourWrapper"/>
                        </div>
                      </div>
                      <div class="row mt-2">
                        <div class="col-md-4">
                          <label>Text Scale</label>
                          <ng-select [items]="textScaleOptions"
                                     bindLabel="label"
                                     bindValue="value"
                                     [clearable]="false"
                                     [(ngModel)]="row.carousel.backgroundsOverlay.textScale">
                          </ng-select>
                        </div>
                      </div>
                      <div class="row mt-2">
                        <div class="col-md-4">
                          <app-range-slider label="Padding Top" [min]="0" [max]="300" [step]="5"
                                            [(value)]="row.carousel.backgroundsOverlay.paddingTop"/>
                        </div>
                        <div class="col-md-4">
                          <app-range-slider label="Padding Left" [min]="0" [max]="300" [step]="5"
                                            [(value)]="row.carousel.backgroundsOverlay.paddingLeft"/>
                        </div>
                        <div class="col-md-4">
                          <app-range-slider label="Photo Offset" [min]="0" [max]="400" [step]="10"
                                            [(value)]="row.carousel.backgroundsOverlay.photoOffsetPercent"/>
                        </div>
                      </div>
                      <div class="row mt-2 align-items-end">
                        <div class="col-md-3">
                          <div class="form-check mb-2">
                            <input [(ngModel)]="row.carousel.backgroundsOverlay.showEventLink"
                                   type="checkbox" class="form-check-input"
                                   [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-event-link')">
                            <label class="form-check-label"
                                   [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-event-link')">
                              Show Event Link</label>
                          </div>
                        </div>
                        <div class="col-md-3">
                          <div class="form-check mb-2">
                            <input [(ngModel)]="row.carousel.backgroundsOverlay.showEventDate"
                                   type="checkbox" class="form-check-input"
                                   [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-event-date')">
                            <label class="form-check-label"
                                   [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-show-event-date')">
                              Show Event Date</label>
                          </div>
                        </div>
                        @if (row.carousel.backgroundsOverlay.showEventLink || row.carousel.backgroundsOverlay.showEventDate) {
                          <div class="col-md-3">
                            <label>Event Scale</label>
                            <ng-select [items]="eventLinkScaleOptions"
                                       bindLabel="label"
                                       bindValue="value"
                                       [clearable]="false"
                                       [(ngModel)]="row.carousel.backgroundsOverlay.eventLinkScale">
                            </ng-select>
                          </div>
                        }
                      </div>
                      <div class="row mt-3">
                        <div class="col-md-12">
                          <div class="form-group">
                            <label>Background Images ({{ row.carousel.backgroundImageNames?.length || 0 }} of {{ availableBackgrounds.length }} selected)</label>
                            <ng-select [items]="availableBackgrounds"
                                       bindLabel="originalFileName"
                                       bindValue="originalFileName"
                                       [multiple]="true"
                                       [searchable]="true"
                                       [clearable]="true"
                                       placeholder="Select background images..."
                                       [(ngModel)]="row.carousel.backgroundImageNames">
                            </ng-select>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </tab>
            <tab heading="{{enumValueForKey(AlbumEditTab, AlbumEditTab.TITLES_AND_EVENT_LINKING)}}"
                 [active]="tabActive(AlbumEditTab.TITLES_AND_EVENT_LINKING)"
                 (selectTab)="selectTab(AlbumEditTab.TITLES_AND_EVENT_LINKING)">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row">
                  <div class="col-sm-12">
                    <div class="form-check mb-0">
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
                    <label
                      [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-album-subtitle')">
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
            <tab heading="{{enumValueForKey(AlbumEditTab, AlbumEditTab.COVER_IMAGE_AND_INTRODUCTORY_TEXT)}}"
                 [active]="tabActive(AlbumEditTab.COVER_IMAGE_AND_INTRODUCTORY_TEXT)"
                 (selectTab)="selectTab(AlbumEditTab.COVER_IMAGE_AND_INTRODUCTORY_TEXT)">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row mt-2 mb-3 thumbnail-heading-frame">
                  <div class="thumbnail-heading">Cover Page On Album</div>
                  <div class="col-sm-12">
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
                        <label
                          [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-pre-cover-text')">
                          Introductory Text</label>
                        <app-markdown-editor [data]="{text: row.carousel.introductoryText}"
                                             [styles]="row.carousel.introductoryTextStyles"
                                             [name]="'pre cover text'"
                                             [initialView]="initialViewFor(row.carousel.introductoryText)"
                                             (changed)="introductoryTextChanged($event)"/>
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
                      <div class="row mt-2">
                        <div class="col-sm-12">
                          <p class="small text-muted mb-2">Click on the image to set the focal point for index
                            previews.</p>
                          <app-focal-point-picker
                            [imageSrc]="coverImageSource()"
                            [height]="row.carousel.coverImageHeight"
                            [borderRadius]="row.carousel.coverImageBorderRadius"
                            [focalPoint]="row.carousel.coverImageFocalPoint || {x: 50, y: 50}"
                            [showZoomSlider]="false"
                            (focalPointChange)="coverImageFocalPointChange($event)"/>
                        </div>
                      </div>
                    }
                  </div>
                </div>
                @if (lazyLoadingMetadata?.contentMetadata?.coverImage) {
                  <div class="row mt-2 mb-3 thumbnail-heading-frame">
                    <div class="thumbnail-heading">Index Preview</div>
                    <div class="col-sm-12">
                      <div class="row mt-3">
                        <div class="col-sm-12">
                          <div class="d-flex justify-content-between align-items-center mb-1">
                            <label class="form-label mb-0">Zoom</label>
                            <span class="zoom-value">{{ focalPointZoom() | number:'1.1-1' }}x</span>
                          </div>
                          <div class="range-slider-row">
                            <span class="range-edge text-start">1x</span>
                            <div class="slider-wrapper">
                              <input type="range"
                                     class="range-slider range-high"
                                     min="1"
                                     max="10"
                                     step="0.1"
                                     [ngModel]="focalPointZoom()"
                                     (ngModelChange)="onZoomChange($event)"/>
                              <div class="slider-track">
                                <div class="slider-fill" [style.left.%]="0" [style.width.%]="zoomFillWidth()"></div>
                              </div>
                            </div>
                            <span class="range-edge text-end">10x</span>
                          </div>
                          <div class="small text-muted mt-1">Use mouse wheel over image above or drag slider</div>
                        </div>
                      </div>
                      <div class="row mt-3 align-items-center">
                        @if (row.carousel.coverImageFocalPoint) {
                          <div class="col-auto">
                            <app-badge-button [icon]="faRemove"
                                              caption="Reset focal point"
                                              (click)="resetFocalPoint()"/>
                          </div>
                        }
                        <div class="col-auto">
                          <div class="d-flex align-items-center gap-2">
                            <label class="mb-0"
                                   [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-focal-point-target')">
                              Apply to</label>
                            <select class="form-select form-select" style="width: auto"
                                    [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-focal-point-target')"
                                    [(ngModel)]="row.carousel.coverImageFocalPointTarget"
                                    (ngModelChange)="updateActionButtonPreview()">
                              @for (target of focalPointTargetValues; track target.value) {
                                <option [ngValue]="target.value">{{ stringUtils.asTitle(target.value) }}</option>
                              }
                            </select>
                          </div>
                        </div>
                        <div class="col-auto">
                          <div class="d-flex align-items-center gap-2">
                            <label class="mb-0"
                              [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-cover-image-preview-columns')">
                              Preview columns</label>
                            <div class="btn-group album-preview-toggle-group" role="group"
                                 aria-label="Action button preview columns">
                              @for (count of actionButtonPreviewOptions; track count) {
                                <button type="button"
                                        class="btn btn-sm preset-btn"
                                        [class.active]="actionButtonPreviewColumns === count"
                                        [attr.aria-pressed]="actionButtonPreviewColumns === count"
                                        (click)="actionButtonPreviewColumnsChanged(count)">
                                  {{ count }}
                                </button>
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="row mt-3">
                        <div class="col-sm-12">
                          @if (previewPageContent) {
                            <app-action-buttons [pageContent]="previewPageContent"
                                                [rowIndex]="0"
                                                presentationMode/>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                } @else {
                  <div class="row mt-2">
                    <div class="col-sm-12">
                      <div class="alert alert-warning">
                        No cover image has been selected for this album. To set a cover image, go to the Album Settings
                        tab, click "Edit images in album", and mark one of the images as the cover image.
                      </div>
                    </div>
                  </div>
                }
              </div>
            </tab>
            <tab heading="{{enumValueForKey(AlbumEditTab, AlbumEditTab.PRE_ALBUM_TEXT)}}"
                 [active]="tabActive(AlbumEditTab.PRE_ALBUM_TEXT)"
                 (selectTab)="selectTab(AlbumEditTab.PRE_ALBUM_TEXT)">
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
                    <label
                      [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.pageContent.path + '-pre-album-text')">
                      Pre Album Text</label>
                    <app-markdown-editor [data]="{text: row.carousel.preAlbumText, name:'cover image text'}"
                                         [initialView]="initialViewFor(row.carousel.preAlbumText)"
                                         (changed)="row.carousel.preAlbumText=$event.text"/>
                  </div>
                </div>
              </div>
            </tab>
          </tabset>
          @if (actions.isCarouselOrAlbum(row)) {
            <div class="mt-3">
              <app-album preview
                         (lazyLoadingMetadataChange)="lazyLoadingMetadataUpdated($event)"
                         [album]="row?.carousel"
                         [albumView]="row?.carousel?.albumView"
                         [index]="actions.carouselOrAlbumIndex(row, pageContent)">
                <app-badge-button [icon]="faPencil"
                                  (click)="actions.toggleEditMode(rowIndex)"
                                  [caption]="'Edit images in album'" noRightMargin>
                </app-badge-button>
              </app-album>
            </div>
          }
        }
      }
      @if (actions.editActive(rowIndex)) {
        <app-image-list-edit [name]="row?.carousel?.name"
                             (exit)="actions.toggleEditMode(rowIndex)"/>
      }`,
    styleUrls: ["./dynamic-content.sass"],
  styles: [`
    .zoom-value
      font-size: 0.85rem
      color: #6c757d

    ${rangeSliderStyles}
  `],
  imports: [TabsetComponent, TabDirective, FormsModule, AlbumComponent, BadgeButtonComponent, GroupEventTypeSelectorComponent, GroupEventSelectorComponent, NgClass, MarkdownEditorComponent, ImageListEditComponent, DisplayDayPipe, DecimalPipe, ActionButtons, FocalPointPickerComponent, NgSelectComponent, ColourSelectorComponent, RangeSliderComponent]
})
export class DynamicContentSiteEditAlbumComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditAlbumComponent", NgxLoggerLevel.ERROR);
  private activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private location: Location = inject(Location);
  stringUtils = inject(StringUtilsService);
  actions = inject(PageContentActionsService);
  urlService = inject(UrlService);
  public row: PageContentRow;

  @Input("row") set rowValue(row: PageContentRow) {
    this.logger.info("row changed:", row);
    this.row = row;
    this.updateActionButtonPreview();
  }
  @Input()
  public rowIndex: number;
  @Input()
  public pageContent: PageContent;
  enumKeyValuesForAlbumView: KeyValue<string>[] = enumKeyValues(AlbumView);
  enumKeyValuesForGridLayoutMode: KeyValue<string>[] = enumKeyValues(GridLayoutMode);
  enumKeyValuesForImageFit: KeyValue<string>[] = enumKeyValues(ImageFit);
  thumbPositions: ThumbPosition[] = [ThumbPosition.TOP, ThumbPosition.LEFT, ThumbPosition.RIGHT, ThumbPosition.BOTTOM];
  protected readonly GridLayoutMode = GridLayoutMode;
  faRemove = faRemove;
  groupEventType: GroupEventType;
  protected readonly faPencil = faPencil;

  protected readonly View = View;
  protected readonly AlbumEditTab = AlbumEditTab;
  protected readonly enumValueForKey = enumValueForKey;
  public lazyLoadingMetadata: LazyLoadingMetadata;
  private tab: AlbumEditTab = AlbumEditTab.ALBUM_SETTINGS;
  public actionButtonPreviewColumns = 2;
  public actionButtonPreviewOptions = [1, 2, 3, 4];
  public focalPointTargetValues: KeyValue<string>[] = enumKeyValues(FocalPointTarget);
  public previewPageContent: PageContent | null = null;
  protected readonly AlbumView = AlbumView;
  public titleColourWrapper: { class: string } = {class: "colour-cloudy"};
  public textColourWrapper: { class: string } = {class: "colour-cloudy"};
  private systemConfigService = inject(SystemConfigService);
  public availableBackgrounds: Image[] = [];
  public titleScaleOptions = scaleOptions([1, "Small"], [1.5, "Medium"], [2, "Large"], [3, "Extra Large"], [4, "Huge"], [5, "Massive"], [6, "Giant"], [8, "Colossal"], [10, "Logo"]);
  public textScaleOptions = scaleOptions([0.75, "Small"], [1, "Normal"], [1.25, "Medium"], [1.5, "Large"], [2, "Extra Large"], [2.5, "Huge"]);
  public eventLinkScaleOptions = scaleOptions([0.75, "Small"], [1, "Normal"], [1.25, "Medium"], [1.5, "Large"], [2, "Extra Large"]);

  ngOnInit() {
    const defaultValue = kebabCase(AlbumEditTab.ALBUM_SETTINGS);
    const urlParams = new URLSearchParams(window.location.search);
    const tabParameter = urlParams.get(StoredValue.ALBUM_TAB);
    this.tab = (tabParameter || defaultValue) as AlbumEditTab;
    this.logger.info("initialised with tab:", this.tab, "from URL param:", tabParameter);

    if (!this.row?.carousel?.galleryViewOptions) {
      this.row.carousel.galleryViewOptions = DEFAULT_GALLERY_OPTIONS;
    }
    if (this.row?.carousel) {
      this.row.carousel.gridViewOptions = {...DEFAULT_GRID_OPTIONS, ...this.row.carousel.gridViewOptions};
    }
    if (!this.row?.carousel?.coverImageFocalPointTarget) {
      this.row.carousel.coverImageFocalPointTarget = FocalPointTarget.BOTH;
    }
    if (!this.row?.carousel?.backgroundsOverlay) {
      this.row.carousel.backgroundsOverlay = {
        titleColourClass: "colour-cloudy",
        titleScale: 3,
        textColourClass: "colour-cloudy",
        paddingTop: 40,
        paddingLeft: 40
      };
    } else {
      const overlay: any = this.row.carousel.backgroundsOverlay;
      if (!overlay.titleColourClass) {
        overlay.titleColourClass = overlay.titleColour?.class || "colour-cloudy";
      }
      if (!overlay.textColourClass) {
        overlay.textColourClass = overlay.textColour?.class || "colour-cloudy";
      }
      delete overlay.titleColour;
      delete overlay.textColour;
    }
    this.initColourWrappers();
    this.updateActionButtonPreview();
    this.systemConfigService.events().subscribe(systemConfig => {
      if (systemConfig?.backgrounds?.images) {
        this.availableBackgrounds = systemConfig.backgrounds.images.filter(img => img.awsFileName);
      }
    });
  }

  selectTab(tab: AlbumEditTab) {
    const kebabTab = kebabCase(tab);
    if (kebabCase(this.tab) !== kebabTab) {
      this.tab = kebabTab as AlbumEditTab;
      const urlTree = this.router.createUrlTree([], {
        queryParams: {[StoredValue.ALBUM_TAB]: kebabTab},
        queryParamsHandling: "merge",
        fragment: this.activatedRoute.snapshot.fragment
      });
      this.location.replaceState(this.router.serializeUrl(urlTree));
    }
  }

  tabActive(tab: AlbumEditTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
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

  introductoryTextChanged(event: ContentText) {
    this.row.carousel.introductoryText = event.text;
    this.row.carousel.introductoryTextStyles = event.styles;
  }

  initialViewFor(text: string): View {
    return text ? View.VIEW : View.EDIT;
  }

  lazyLoadingMetadataUpdated(metadata: LazyLoadingMetadata) {
    this.lazyLoadingMetadata = metadata;
    this.updateActionButtonPreview();
  }

  actionButtonPreviewColumnsChanged(value: number) {
    this.actionButtonPreviewColumns = value;
    this.logger.info("actionButtonPreviewColumnsChanged with value:", value);
    this.updateActionButtonPreview();
  }

  coverImageSource(): string {
    if (!this.lazyLoadingMetadata?.contentMetadata) {
      return null;
    }
    return this.urlService.imageSourceFor({image: this.lazyLoadingMetadata.contentMetadata.coverImage}, this.lazyLoadingMetadata.contentMetadata);
  }

  focalPointZoom(): number {
    return this.row?.carousel?.coverImageFocalPoint?.zoom ?? 1;
  }

  zoomFillWidth(): number {
    return ((this.focalPointZoom() - 1) / (10 - 1)) * 100;
  }

  onZoomChange(zoom: number) {
    if (this.row?.carousel) {
      const currentFocalPoint = this.row.carousel.coverImageFocalPoint || {x: 50, y: 50};
      this.row.carousel.coverImageFocalPoint = {...currentFocalPoint, zoom};
      this.updateActionButtonPreview();
    }
  }

  coverImageFocalPointChange(focalPoint: FocalPoint) {
    if (this.row?.carousel) {
      this.row.carousel.coverImageFocalPoint = focalPoint;
      this.updateActionButtonPreview();
    }
  }

  resetFocalPoint() {
    if (this.row?.carousel) {
      this.row.carousel.coverImageFocalPoint = null;
      this.updateActionButtonPreview();
    }
  }

  private initColourWrappers() {
    const overlay = this.row.carousel.backgroundsOverlay;
    this.titleColourWrapper = Object.defineProperty({}, "class", {
      get: () => overlay.titleColourClass,
      set: (v: string) => overlay.titleColourClass = v,
      enumerable: true
    }) as { class: string };
    this.textColourWrapper = Object.defineProperty({}, "class", {
      get: () => overlay.textColourClass,
      set: (v: string) => overlay.textColourClass = v,
      enumerable: true
    }) as { class: string };
  }


  updateActionButtonPreview() {
    if (!this.row?.carousel) {
      if (this.previewPageContent) {
        this.previewPageContent = null;
      }
    } else {
      const coverImage = this.lazyLoadingMetadata?.contentMetadata?.coverImage;
      const imageSource = coverImage ? this.urlService.imageSourceFor({image: coverImage}, this.lazyLoadingMetadata.contentMetadata) : null;
      const previewCount = this.actionButtonPreviewColumns || Math.max(...this.actionButtonPreviewOptions);
      const previewSubtitle = this.row.carousel.subtitle || this.row.carousel.introductoryText || this.row.carousel.preAlbumText;
      const contentText = this.stringUtils.stripMarkdown(previewSubtitle || "No description available");
      const focalPointTarget = this.row.carousel.coverImageFocalPointTarget || FocalPointTarget.BOTH;
      const applyFocalPointToIndex = [FocalPointTarget.INDEX_PREVIEW, FocalPointTarget.BOTH].includes(focalPointTarget);
      const columns = [{
        accessLevel: AccessLevel.PUBLIC,
        title: this.row.carousel.title,
        contentText,
        imageSource,
        imageBorderRadius: this.row.carousel.coverImageBorderRadius,
        imageFocalPoint: applyFocalPointToIndex ? this.row.carousel.coverImageFocalPoint : null,
        showPlaceholderImage: !imageSource,
        href: this.pageContent?.path || this.row.carousel.name
      }];
      const previewCarousel = {
        ...this.row.carousel,
        coverImageHeight: null
      };
      const nextPreviewPageContent = {
        path: this.pageContent?.path || "action-button-preview",
        rows: [{
          type: PageContentType.ACTION_BUTTONS,
          maxColumns: previewCount,
          showSwiper: false,
          columns,
          carousel: previewCarousel
        }]
      };
      if (!isEqual(this.previewPageContent, nextPreviewPageContent)) {
        this.logger.info("rendering preview page nextPreviewPageContent:", nextPreviewPageContent);
        this.previewPageContent = nextPreviewPageContent;
      }
    }
  }

}
