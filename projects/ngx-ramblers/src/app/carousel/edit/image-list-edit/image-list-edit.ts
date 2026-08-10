import { NgTemplateOutlet } from "@angular/common";
import { HttpClient, HttpErrorResponse, HttpStatusCode } from "@angular/common/http";
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { isEmpty, isString, keys, min } from "es-toolkit/compat";
import { range } from "es-toolkit";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { PageChangedEvent, PaginationComponent } from "ngx-bootstrap/pagination";
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from "@angular/cdk/drag-drop";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  faAdd,
  faArrowsUpDown,
  faBookOpen,
  faCamera,
  faCircleCheck,
  faCircleInfo,
  faCloudArrowUp,
  faCompress,
  faEraser,
  faFile,
  faImages,
  faPencil,
  faRemove,
  faSave,
  faSortNumericDown,
  faSortNumericUp,
  faSpinner,
  faTableCells,
  faTags,
  faUndo
} from "@fortawesome/free-solid-svg-icons";

import {
  ALL_PHOTOS,
  Base64File,
  CheckedImage,
  ContentMetadata,
  ContentMetadataCopyImageRequest,
  ContentMetadataItem,
  ContentMetadataResizeRequest,
  DuplicateImages,
  IMAGE_HEIC,
  ImageFilterType,
  ImageTag,
  RECENT_PHOTOS,
  S3Metadata
} from "../../../models/content-metadata.model";
import { Tag } from "../../../models/tag.model";
import { MemberResourcesPermissions } from "../../../models/member-resource.model";
import { Confirm, StoredValue } from "../../../models/ui-actions";
import { move, sortBy } from "../../../functions/arrays";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { CreateWalkAlbumService } from "../../../services/walks/create-walk-album.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { ImageDuplicatesService } from "../../../services/image-duplicates-service";
import { ImageTagDataService } from "../../../services/image-tag-data-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { RootFolder, SystemConfig } from "../../../models/system.model";
import {
  AwsFileUploadResponse,
  AwsFileUploadResponseData,
  DescribedDimensions
} from "../../../models/aws-object.model";
import { FileUtilsService } from "../../../file-utils.service";
import { base64ToFile } from "ngx-image-cropper";
import { BadgeButtonComponent } from "../../../modules/common/badge-button/badge-button";
import { NgClass, NgStyle } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TagManagerComponent } from "../../../pages/tag/tag-manager.component";
import { FormsModule } from "@angular/forms";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { AspectRatioSelectorComponent } from "../aspect-ratio-selector/aspect-ratio-selector";
import { ImageEditComponent } from "../image-edit/image-edit";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FileSizeSelectorComponent } from "../file-size-selector/file-size-selector";

import { SystemConfigService } from "../../../services/system/system-config.service";
import { PageContentService } from "../../../services/page-content.service";
import { isUndefined } from "es-toolkit/compat";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { ApiResponse } from "../../../models/api-response.model";
import { isArray } from "es-toolkit/compat";
import { EventType, MessageType, ProgressResponse } from "../../../models/websocket.model";
import { uploadGroupEventType } from "../../../models/committee.model";

@Component({
  selector: "app-image-list-edit",
  styles: [`
    .horizontal
      display: flex

    .tags-input
      max-width: 100%
      line-height: 22px
      overflow-y: scroll
      overflow-x: scroll
      height: 65px
      cursor: text

    .no-right-padding
      padding-right: 0

    .no-left-padding
      padding-left: 0

    .visible-viewport
      height: 10000px
      width: auto

    .right-justify-ellipsis
      text-align: right
      direction: rtl
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap

    .album-upload-zone
      border: 2px dashed var(--ramblers-colour-mintcake, rgb(155, 200, 171))
      border-radius: 16px
      background: linear-gradient(180deg, rgba(155, 200, 171, 0.16) 0%, rgba(255, 255, 255, 0.95) 70%)
      min-height: 168px
      padding: 1.25rem 1rem
      text-align: center
      cursor: pointer
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease
      display: flex
      flex-direction: column
      align-items: center
      justify-content: center
      gap: 0.35rem
      touch-action: manipulation
      -webkit-tap-highlight-color: transparent

    .album-upload-zone:hover:not(.disabled),
    .album-upload-zone:focus-visible:not(.disabled)
      border-color: var(--ramblers-colour-sunrise, rgb(249, 177, 4))
      box-shadow: 0 0 0 3px rgba(249, 177, 4, 0.22)
      outline: none

    .album-upload-zone.file-over:not(.disabled)
      border-color: var(--ramblers-colour-sunrise, rgb(249, 177, 4))
      border-style: solid
      box-shadow: 0 0 0 4px rgba(249, 177, 4, 0.28)
      transform: scale(1.01)

    .album-upload-zone.highlight:not(.disabled)
      animation: album-upload-pulse 1.4s ease-in-out 3

    .album-upload-zone.disabled
      opacity: 0.55
      cursor: not-allowed

    .album-upload-icon
      font-size: 2rem
      color: var(--ramblers-colour-sunrise, rgb(249, 177, 4))
      line-height: 1

    .album-upload-zone.working
      cursor: wait

    .album-upload-title
      font-size: 1.15rem
      font-weight: 700
      margin: 0
      color: rgb(64, 65, 65)

    .album-upload-subtitle
      margin: 0
      max-width: 28rem
      color: rgb(110, 112, 115)
      font-size: 0.95rem
      line-height: 1.35

    .album-upload-hint
      margin: 0.15rem 0 0
      font-size: 0.85rem
      color: rgb(110, 112, 115)

    .album-upload-actions
      display: grid
      grid-template-columns: 1fr 1fr
      gap: 0.75rem
      width: 100%
      max-width: 28rem
      margin-top: 0.65rem

    .album-upload-action
      -webkit-appearance: none
      appearance: none
      min-height: 48px
      border-radius: 12px
      border: 1px solid rgb(222, 226, 230)
      background: rgb(222, 226, 230)
      color: rgb(33, 37, 41)
      font-weight: 600
      display: inline-flex
      align-items: center
      justify-content: center
      gap: 0.5rem
      padding: 0.65rem 0.85rem
      touch-action: manipulation
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease

    .album-upload-action fa-icon,
    .album-upload-action ::ng-deep svg
      color: inherit

    .album-upload-action:not(:disabled):hover,
    .album-upload-action:not(:disabled):focus
      color: rgb(33, 37, 41)
      background: var(--ramblers-colour-sunrise, rgb(249, 177, 4))
      border-color: var(--ramblers-colour-sunrise, rgb(249, 177, 4))

    .album-upload-action.primary
      background: var(--ramblers-colour-sunrise, rgb(249, 177, 4))
      border-color: transparent
      color: #fff

    .album-upload-action.primary fa-icon,
    .album-upload-action.primary ::ng-deep svg
      color: #fff

    .album-upload-action.primary:not(:disabled):hover,
    .album-upload-action.primary:not(:disabled):focus
      background: rgb(211, 150, 3)
      border-color: rgb(211, 150, 3)
      color: #fff

    .album-upload-action:disabled
      opacity: 0.55

    .album-sticky-bar
      position: sticky
      bottom: 0
      z-index: 20
      display: grid
      grid-template-columns: 1fr 1fr
      gap: 0.5rem
      padding: 0.75rem 0.25rem calc(0.75rem + env(safe-area-inset-bottom, 0px))
      margin: 0.75rem -0.25rem 0
      background: rgba(255, 255, 255, 0.96)
      border-top: 1px solid rgba(64, 65, 65, 0.1)
      backdrop-filter: blur(8px)

    .album-sticky-bar .album-upload-action
      max-width: none
      width: 100%

    .album-sticky-bar.workflow
      grid-template-columns: 1fr 1fr
      position: fixed
      left: 0
      right: 0
      bottom: 0
      margin: 0
      padding: 0.65rem 0.75rem calc(0.65rem + env(safe-area-inset-bottom, 0px))
      box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.08)

    .album-sticky-bar.workflow .album-upload-action.done
      grid-column: 1 / -1
      min-height: 52px
      font-size: 1rem

    .album-sticky-bar.workflow .album-upload-action.secondary-exit
      grid-column: 1 / -1
      min-height: 44px
      background: transparent
      border-color: transparent
      color: rgb(110, 112, 115)
      font-weight: 600

    :host.workflow-mode
      display: block
      padding-bottom: calc(8.5rem + env(safe-area-inset-bottom, 0px))

    @keyframes album-upload-pulse
      0%, 100%
        box-shadow: 0 0 0 0 rgba(249, 177, 4, 0)
      50%
        box-shadow: 0 0 0 8px rgba(249, 177, 4, 0.22)

    .image-list-pagination
      display: flex
      flex-direction: column
      align-items: stretch
      gap: 0.75rem
      margin-top: 1rem
      margin-bottom: 0.75rem

    .sticky-toolbar
      isolation: isolate
      padding-left: var(--space-2, 8px)
      padding-right: var(--space-2, 8px)
      background: var(--rsm-panel-bg, rgb(255, 255, 255))

    .image-list-pagination-alert
      width: 100%
      min-width: 0
      line-height: 1.35
      margin: 0

    .reorder-view-switch
      display: flex
      flex-wrap: wrap
      align-items: center
      gap: var(--space-3, 12px)
      margin: 0 0 var(--space-3, 12px)

    .reorder-view-switch span
      color: var(--rsm-muted, rgb(110, 112, 115))
      font-size: 0.85rem

    .copy-image-backdrop
      position: fixed
      inset: 0
      z-index: 1050
      display: flex
      align-items: center
      justify-content: center
      padding: var(--space-3, 12px)
      background: rgba(15, 23, 42, 0.48)

    .copy-image-panel
      width: min(720px, 100%)
      max-height: calc(100vh - 24px)
      overflow-y: auto
      padding: var(--space-3, 12px)
      border: 1px solid var(--ramblers-colour-mintcake, rgb(155, 200, 171))
      border-radius: var(--radius-3, 8px)
      background: rgb(255, 255, 255)
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.28)

    .copy-image-introduction
      display: grid
      grid-template-columns: minmax(0, 120px) minmax(0, 1fr)
      gap: var(--space-3, 12px)
      align-items: start

    .copy-image-introduction img
      width: 100%
      aspect-ratio: 4 / 3
      object-fit: cover
      border-radius: var(--radius-2, 6px)

    .copy-image-form
      margin-top: var(--space-3, 12px)

    .copy-image-actions
      display: flex
      flex-wrap: wrap
      gap: var(--space-2, 8px)
      margin-top: var(--space-2, 8px)

    .image-reorder-workspace
      display: grid
      gap: var(--space-4, 16px)
      margin-bottom: var(--space-4, 16px)

    .image-reorder-pagination
      margin: 0

    .image-reorder-boundary
      display: flex
      align-items: center
      justify-content: center
      min-height: 52px
      padding: var(--space-2, 8px)
      border: 2px dashed var(--ramblers-colour-mintcake, rgb(155, 200, 171))
      border-radius: var(--radius-2, 6px)
      background: rgba(155, 200, 171, 0.12)
      color: rgb(33, 37, 41)
      font-weight: 700

    .image-reorder-boundary.cdk-drop-list-dragging
      background: rgba(155, 200, 171, 0.3)

    .cover-drop-zone
      display: grid
      grid-template-columns: minmax(0, 180px) minmax(0, 1fr)
      align-items: center
      gap: var(--space-3, 12px)
      min-height: 150px
      padding: var(--space-3, 12px)
      border: 2px dashed var(--ramblers-colour-sunrise, rgb(249, 177, 4))
      border-radius: var(--radius-3, 8px)
      background: rgba(249, 177, 4, 0.08)

    .cover-drop-zone.cdk-drop-list-dragging
      background: rgba(249, 177, 4, 0.2)

    .cover-drop-preview
      width: 100%
      aspect-ratio: 16 / 9
      border-radius: var(--radius-2, 6px)
      overflow: hidden
      background: rgba(15, 23, 42, 0.08)

    .cover-drop-preview img
      width: 100%
      height: 100%
      object-fit: cover

    .cover-drop-placeholder
      display: flex
      align-items: center
      justify-content: center
      height: 100%
      color: var(--rsm-muted, rgb(110, 112, 115))
      font-size: 2rem

    .cover-drop-copy
      min-width: 0

    .cover-drop-copy p
      margin: 0.25rem 0 0.75rem
      color: var(--rsm-muted, rgb(110, 112, 115))

    .album-compact-action
      width: fit-content
      min-height: 40px
      padding: 0 0.65rem
      font-size: 0.85rem

    .image-reorder-grid
      display: grid
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))
      gap: var(--space-3, 12px)

    .image-reorder-item
      position: relative
      min-width: 0
      border: 1px solid var(--rsm-border, rgba(15, 23, 42, 0.15))
      border-radius: var(--radius-2, 6px)
      background: var(--rsm-panel-bg, #fff)
      overflow: hidden
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12)
      cursor: grab
      touch-action: none

    .image-reorder-item:active
      cursor: grabbing

    .image-reorder-item.cdk-drag-placeholder
      opacity: 0.25

    .image-reorder-item img
      display: block
      width: 100%
      aspect-ratio: 4 / 3
      object-fit: cover

    .image-reorder-details
      display: flex
      align-items: center
      gap: var(--space-2, 8px)
      min-height: 40px
      padding: 4px 8px

    .image-reorder-name
      min-width: 0
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap
      font-size: 0.8rem
      font-weight: 600

    .image-reorder-cover-badge
      position: absolute
      top: 6px
      right: 6px
      display: inline-flex
      align-items: center
      gap: 4px
      padding: 3px 6px
      border-radius: 999px
      background: var(--ramblers-colour-sunrise, rgb(249, 177, 4))
      color: rgb(33, 37, 41)
      font-size: 0.7rem
      font-weight: 700

    :host ::ng-deep .image-list-pagination
      pagination, .pagination
        width: 100%
        display: flex
        gap: 0.5rem
        margin-bottom: 0

      .page-item
        flex: 1 1 0
        margin-right: 0

      .page-link
        width: 100%
        text-align: center
        color: rgb(33, 37, 41)
        background-color: rgb(222, 226, 230)
        border: 1px solid rgb(222, 226, 230)
        border-radius: 6px
        font-weight: 600

      .page-item:not(.disabled):not(.active) .page-link:hover,
      .page-item:not(.disabled):not(.active) .page-link:focus
        color: rgb(33, 37, 41)
        background-color: var(--ramblers-colour-sunrise, rgb(249, 177, 4))
        border-color: var(--ramblers-colour-sunrise, rgb(249, 177, 4))

      .page-item.active .page-link
        color: rgb(33, 37, 41)
        background-color: var(--ramblers-colour-sunrise, rgb(249, 177, 4))
        border-color: var(--ramblers-colour-sunrise, rgb(249, 177, 4))
        font-weight: 700

      .page-item.disabled .page-link
        color: rgba(33, 37, 41, 0.4)
        background-color: rgb(236, 238, 240)
        border-color: rgb(236, 238, 240)
        opacity: 0.7
        cursor: not-allowed
        pointer-events: none
        box-shadow: none

        &:hover, &:focus
          color: rgba(33, 37, 41, 0.4)
          background-color: rgb(236, 238, 240)
          border-color: rgb(236, 238, 240)

    @media (min-width: 768px)
      .album-sticky-bar
        display: none

      .album-sticky-bar.workflow
        display: none

      :host.workflow-mode
        padding-bottom: 0

      .album-upload-zone
        min-height: 140px

      .image-list-pagination
        flex-direction: row
        flex-wrap: wrap
        align-items: flex-start
        gap: 0.5rem

      .image-list-pagination-alert
        flex: 1 1 auto
        width: auto

      :host ::ng-deep .image-list-pagination
        pagination, .pagination
          width: auto

        .page-item
          flex: 0 0 auto

        .page-link
          width: auto

    @media (max-width: 575.98px)
      .copy-image-introduction
        grid-template-columns: 1fr

      .copy-image-introduction img
        width: 120px

      .cover-drop-zone
        grid-template-columns: 1fr

      .image-reorder-grid
        grid-template-columns: repeat(2, minmax(0, 1fr))
  `],
  template: `
    @if (allow.edit && contentMetadata) {
      @if (!workflowMode) {
        <div class="row mb-4 px-1">
          <div class="col-sm-12">
            <div class="form-group">
              <label for="name">Album Named</label>
              <input [delay]="1000"
                     [tooltip]="imagesExist() ? 'Album name cannot be changed after images have been created in it':''"
                     [disabled]="imagesExist()" type="text" [ngModel]="contentMetadata.name" id="name"
                     (ngModelChange)="albumNameChange($event)"
                     class="form-control">
            </div>
          </div>
          <div class="col-sm-6">
            <app-aspect-ratio-selector label="Default Aspect Ratio"
                                       [dimensionsDescription]="contentMetadata.aspectRatio"
                                       (dimensionsChanged)="dimensionsChanged($event)"/>
          </div>
          <div class="col-sm-6">
            <app-file-size-selector label="Auto-resize New Images To Maximum Size"
                                    [fileSize]="contentMetadata.maxImageSize"
                                    (fileSizeChanged)="contentMetadata.maxImageSize=$event"/>
          </div>
        </div>
        <div class="row mb-2 px-1">
          <div class="col-sm-12 d-flex align-items-baseline flex-wrap gap-2">
            <span>{{ stringUtils.pluraliseWithCount(pageUsages.length, "usage") }}:</span>
            @if (pageUsages.length === 0) {
              <span class="text-muted small">This image list is not used on any pages</span>
            } @else {
              @for (u of pageUsages; track u) {
                <a class="rams-text-decoration-pink" [href]="'/' + u" target="_blank" rel="noopener noreferrer">{{ u }}</a>
              }
            }
          </div>
        </div>
      }
      <input #photosInput class="d-none" type="file" ng2FileSelect multiple
             accept="image/*,image/heic,image/heif,.heic,.heif"
             (onFileSelected)="onFileSelectOrDropped($event)"
             [uploader]="uploader">
      <input #cameraInput class="d-none" type="file" ng2FileSelect
             accept="image/*"
             capture="environment"
             (onFileSelected)="onFileSelectOrDropped($event)"
             [uploader]="uploader">
      <div class="row mb-3">
        <div class="col-12">
          <div #uploadZone
               ng2FileDrop
               role="button"
               tabindex="0"
               [attr.aria-label]="imagesExist() ? 'Add more photos to this album' : 'Add photos to this album'"
               [ngClass]="{
                 'file-over': !photosWorking() && hasFileOver,
                 'disabled': disabled() || photosWorking(),
                 'highlight': highlightUploadZone,
                 'working': photosWorking()
               }"
               (fileOver)="fileOver($event)"
               (onFileDrop)="onFileSelectOrDropped($event)"
               (click)="onUploadZoneClick(photosInput)"
               (keydown.enter)="onUploadZoneClick(photosInput)"
               (keydown.space)="$event.preventDefault(); onUploadZoneClick(photosInput)"
               class="album-upload-zone">
            @if (photosWorking()) {
              <fa-icon class="album-upload-icon" [icon]="faSpinner" animation="spin"/>
            } @else {
              <fa-icon class="album-upload-icon" [icon]="faCloudArrowUp"/>
            }
            <p class="album-upload-title">
              {{ albumUploadTitle() }}
            </p>
            <p class="album-upload-subtitle d-md-none">
              @if (photosWorking()) {
                {{ albumUploadWorkingSubtitle() }}
              } @else if (imagesExist()) {
                Use Photo library for several from your camera roll, or Take photo for a new shot.
              } @else {
                Use Photo library for a set from your camera roll, or Take photo to capture now. They stay on your site.
              }
            </p>
            <p class="album-upload-subtitle d-none d-md-block">
              @if (photosWorking()) {
                {{ albumUploadWorkingSubtitle() }}
              } @else if (imagesExist()) {
                Drag and drop more images here, or click to browse.
              } @else {
                Drag and drop images here, or click to browse. They stay on your site.
              }
            </p>
            <div class="album-upload-actions d-md-none" (click)="$event.stopPropagation()">
              <button type="button" class="album-upload-action primary"
                      [disabled]="disabled() || photosWorking()"
                      (click)="browseToFile(photosInput)">
                <fa-icon [icon]="faImages"/>
                Photo library
              </button>
              <button type="button" class="album-upload-action"
                      [disabled]="disabled() || photosWorking()"
                      (click)="browseToFile(cameraInput)">
                <fa-icon [icon]="faCamera"/>
                Take photo
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="album-toolbar d-none d-md-flex w-100 gap-2">
        <app-badge-button fullWidth [icon]="faSave" [caption]="saveAndExitCaption()"
                          (click)="requestSaveChangesAndExit()"
                          [disabled]="disabled()"/>
        @if (!workflowMode) {
          <app-badge-button fullWidth [icon]="faSave" caption="Save" (click)="requestSaveChanges()"
                            [disabled]="disabled()"/>
        }
        <app-badge-button fullWidth [icon]="faUndo" [caption]="exitWithoutSavingCaption()"
                          [disabled]="disabled()"
                          (click)="exitBackWithoutSaving()"/>
        @if (!workflowMode) {
          <app-badge-button fullWidth [icon]="faUndo" [caption]="'Undo'" (click)="undoChanges()"
                            [disabled]="disabled()"/>
        }
        @if (!workflowMode) {
        <div class="btn-group" dropdown>
          <button [disabled]="imageActionsDisabled()" aria-controls="dropdown-animated"
                  class="dropdown-toggle badge-button w-100 border-0"
                  [ngClass]="{'disabled': imageActionsDisabled()}"
                  dropdownToggle
                  type="button">
            <fa-icon [icon]="faTableCells"/>
            <span class="ms-2">Image Actions</span><span class="caret"></span>
          </button>
          <ul *dropdownMenu class="dropdown-menu" role="menu">
            @if (imagesExist()) {
              @if (contentMetadata?.maxImageSize > 0) {
                <li role="menuitem">
                  <a (click)="resizeSavedImages()" class="dropdown-item" [ngClass]="{'disabled': resizeInProgress}">
                    <fa-icon [icon]="faCompress"/>
                    {{ resizeInProgress ? resizeActionCaption() : "Resize Existing Images To " + numberUtils.humanFileSize(contentMetadata.maxImageSize) }}
                  </a>
                </li>
              }
              <li role="menuitem">
                <a (click)="sortByDate()" class="dropdown-item">
                  <fa-icon [icon]="faSortNumericDown"/>
                  Sort by image date
                </a>
              </li>
              <li role="menuitem">
                <a (click)="reverseSortOrder()" class="dropdown-item">
                  <fa-icon [icon]="faSortNumericUp"/>
                  Reverse sort order
                </a>
              </li>
              <li role="menuitem">
                <a (click)="clearImages()" class="dropdown-item">
                  <fa-icon [icon]="faEraser"/>
                  Clear images
                </a>
              </li>
            } @else {
              <li role="menuitem">
                <a (click)="insertToEmptyList()" class="dropdown-item">
                  <fa-icon [icon]="faAdd"/>
                  Create First Image
                </a>
              </li>
            }
            @if (contentMetadata?.imageTags?.length > 0) {
              <li role="menuitem">
                <a (click)="toggleManageTags()" class="dropdown-item">
                  <fa-icon [icon]="faTags"/>
                  {{ manageTags ? "Close Tags" : "Manage Tags" }}
                </a>
              </li>
            }
          </ul>
        </div>
        }
      </div>
      <div class="row mt-2">
        @if (progressResponse) {
          <div class="col-sm-12 mt-2">
            <div class="alert mb-2" [ngClass]="progressResponse.queued ? 'alert-warning' : 'alert-success'">
              <fa-icon [icon]="progressResponse.queued ? faCircleInfo : faCircleCheck"/>
              <strong>{{ progressResponse.queued ? "Resize queued" : "Resizing images" }}: </strong>
              {{ progressResponse.message }}
            </div>
            <div class="progress">
              <div class="progress-bar" role="progressbar" [ngStyle]="{ 'width': progressPercent() + '%' }">
                {{ progressResponse.queued ? "Queued" : progressPercent() + "%" }}
              </div>
            </div>
          </div>
        }
        @if (uploader?.isUploading) {
          <div class="col-sm-12 mb-2 mt-2">
            <div class="alert alert-success mb-2">
              <fa-icon [icon]="faCloudArrowUp"/>
              <strong> Uploading photos to your site</strong>
              - keep this page open until the bar reaches 100%.
            </div>
            <div class="progress" style="height: 1.25rem;">
              <div class="progress-bar" role="progressbar" [ngStyle]="{ 'width': uploader.progress + '%' }">
                {{ uploader.progress }} %
              </div>
            </div>
          </div>
        }
        <div class="col-sm-12 mt-4">
          @if (warningTarget.showAlert) {
            <div class="flex-grow-1 alert {{warningTarget.alertClass}}">
              <fa-icon [icon]="warningTarget.alert.icon"></fa-icon>
              @if (warningTarget.alertTitle) {
                <strong>
                  {{ warningTarget.alertTitle }}: </strong>
              } {{ warningTarget.alertMessage }}
            </div>
          }
        </div>
      </div>
      @if (imagesExist()) {
        <div class="reorder-view-switch">
          <button type="button" class="btn btn-quiet album-compact-action"
                  [disabled]="disabled() || photosWorking()"
                  (click)="toggleReorderMode()">
            <fa-icon [icon]="reorderMode ? faPencil : faArrowsUpDown"/>
            {{ reorderMode ? "Return to image details" : "Reorder images" }}
          </button>
          <span>{{ reorderMode ? "Drag photos into order or onto the album cover area." : "Use a visual drag-and-drop view to arrange the whole album." }}</span>
        </div>
      }
      @if (copySourceItem) {
        <div class="copy-image-backdrop" role="presentation">
          <section class="copy-image-panel" role="dialog" aria-modal="true" aria-labelledby="copy-image-title">
            <div class="copy-image-introduction">
              <img [src]="urlService.imageSourceFor(copySourceItem, contentMetadata)" [alt]="copySourceItem.text || copySourceItem.image">
              <div>
                <strong id="copy-image-title" class="d-block">Add a copy to another album</strong>
                <p class="mb-0">The original photo and this album will not be changed. The destination receives its own image file and a copy of the title, date, event link and matching tags.</p>
              </div>
            </div>
            <div class="copy-image-form">
              @if (copyCompleted) {
                <div class="alert alert-success d-flex align-items-start" role="status">
                  <fa-icon class="me-2" [icon]="faCircleCheck"/>
                  <div>
                    <strong class="d-block">Copy added</strong>
                    A separate copy was added to {{ contentMetadataService.contentMetadataName({name: copyDestinationAlbumName}) }}.
                  </div>
                </div>
                <button type="button" class="btn btn-primary" (click)="cancelCopyToAlbum()">
                  <fa-icon [icon]="faRemove"/>
                  Close
                </button>
              } @else {
                <label for="copy-destination-album">Destination album</label>
                <select id="copy-destination-album" class="form-control" [(ngModel)]="copyDestinationAlbumName"
                        [disabled]="copyInProgress || copyDestinationAlbums.length === 0">
                  <option [ngValue]="null">{{ copyDestinationAlbumsLoading ? "Loading albums…" : "Choose an album" }}</option>
                  @for (album of copyDestinationAlbums; track album.name) {
                    <option [ngValue]="album.name">{{ contentMetadataService.contentMetadataName(album) }}</option>
                  }
                </select>
                <small class="text-muted d-block mt-1">Any fixed shape on the destination is applied by that album’s presentation. The copied file keeps the source pixels intact.</small>
                <div class="copy-image-actions">
                  <button type="button" class="btn btn-primary" [disabled]="!copyDestinationAlbumName || copyInProgress"
                          (click)="confirmCopyToAlbum()">
                    <fa-icon [icon]="copyInProgress ? faSpinner : faAdd" [animation]="copyInProgress ? 'spin' : null"/>
                    {{ copyInProgress ? "Adding copy" : "Add copy" }}
                  </button>
                  <button type="button" class="btn btn-quiet" [disabled]="copyInProgress" (click)="cancelCopyToAlbum()">
                    <fa-icon [icon]="faRemove"/>
                    Cancel
                  </button>
                </div>
              }
            </div>
          </section>
        </div>
      }
      @if (reorderMode) {
        <div class="image-reorder-workspace" cdkDropListGroup>
          <div class="sticky-toolbar image-reorder-pagination">
            <pagination class="pagination rounded" [boundaryLinks]="true" [directionLinks]="true" [rotate]="true"
                        [maxSize]="5"
                        [itemsPerPage]="reorderPageSize"
                        [totalItems]="contentMetadata.files.length"
                        [(ngModel)]="reorderPageNumber"
                        [disabled]="disabled()"
                        (pageChanged)="reorderPageChanged($event)"/>
            <span>{{ reorderRangeDescription() }}</span>
          </div>
          <section class="cover-drop-zone"
                   cdkDropList
                   [cdkDropListData]="coverDropItems"
                   [cdkDropListSortingDisabled]="true"
                   (cdkDropListDropped)="coverImageDropped($event)">
            <div class="cover-drop-preview">
              @if (coverImageItem(); as coverImage) {
                <img [src]="urlService.imageSourceFor(coverImage, contentMetadata)" [alt]="coverImage.text || 'Album cover'">
              } @else {
                <div class="cover-drop-placeholder"><fa-icon [icon]="faBookOpen"/></div>
              }
            </div>
            <div class="cover-drop-copy">
              <strong class="d-block">Album cover</strong>
              <p>Drag any photo here to use it as the album cover. It will remain in the album order below.</p>
              @if (contentMetadata.coverImage) {
                <button type="button" class="btn btn-quiet album-compact-action" (click)="clearCoverImage()">
                  <fa-icon [icon]="faRemove"/>
                  Clear cover
                </button>
              }
            </div>
          </section>
          @if (reorderPageNumber > 1) {
            <div class="image-reorder-boundary"
                 cdkDropList
                 [cdkDropListData]="reorderBoundaryDropItems"
                 [cdkDropListSortingDisabled]="true"
                 (cdkDropListDropped)="moveImageToStart($event)">
              Drag here to move a photo to the beginning
            </div>
            <div class="image-reorder-boundary"
                 cdkDropList
                 [cdkDropListData]="reorderBoundaryDropItems"
                 [cdkDropListSortingDisabled]="true"
                 (cdkDropListDropped)="moveImageToPreviousReorderPage($event)">
              Drag here to move a photo to the previous section
            </div>
          }
          <div class="image-reorder-grid"
               cdkDropList
               cdkDropListOrientation="mixed"
               [cdkDropListData]="reorderPageImages"
               (cdkDropListDropped)="imageOrderDropped($event)">
            @for (item of reorderPageImages; track metadataItemTracker($index, item); let index = $index) {
              <article class="image-reorder-item" cdkDrag [cdkDragData]="item"
                       [attr.aria-label]="'Drag image ' + reorderImageNumber(index)">
                <img [src]="urlService.imageSourceFor(item, contentMetadata)" [alt]="item.text || item.image">
                @if (item.image === contentMetadata.coverImage) {
                  <span class="image-reorder-cover-badge"><fa-icon [icon]="faBookOpen"/> Cover</span>
                }
                <div class="image-reorder-details">
                  <span class="image-reorder-name">Image {{ reorderImageNumber(index) }}{{ item.text ? " — " + item.text : "" }}</span>
                </div>
              </article>
            }
          </div>
          @if (reorderPageNumber < reorderPageCount()) {
            <div class="image-reorder-boundary"
                 cdkDropList
                 [cdkDropListData]="reorderBoundaryDropItems"
                 [cdkDropListSortingDisabled]="true"
                 (cdkDropListDropped)="moveImageToNextReorderPage($event)">
              Drag here to move a photo to the next section
            </div>
          }
        </div>
      } @else {
      @if (!workflowMode) {
        @if (manageTags) {
          <div class="row mb-2">
            <div class="col-sm-12">
              <h6>Tag Management</h6>
              <app-tag-manager [tags]="contentMetadata.imageTags"
                               [imageMode]="true"
                               [usageCount]="filesTaggedWith"/>
            </div>
          </div>
        }
        <h6>Image Filtering</h6>
        <div class="form-check form-check-inline">
          <input [disabled]="disabled()" id="recent-photos-filter"
                 type="radio"
                 class="form-check-input"
                 [(ngModel)]="filterType"
                 (ngModelChange)="filterFor('recent')"
                 value="recent"/>
          <label class="form-check-label" for="recent-photos-filter">Show recent photos</label>
        </div>
        <div class="form-check form-check-inline">
          <input [disabled]="disabled()" id="all-photos-filter"
                 type="radio"
                 class="form-check-input"
                 [(ngModel)]="filterType"
                 (ngModelChange)="filterFor('all')"
                 value="all"/>
          <label class="form-check-label" for="all-photos-filter">Show all photos</label>
        </div>
        @if (selectableTags()?.length > 0) {
          <div class="form-check form-check-inline">
            <input [disabled]="disabled()" id="tag-filter"
                   type="radio"
                   class="form-check-input"
                   [(ngModel)]="filterType"
                   (ngModelChange)="filterFor('tag')"
                   value="tag"/>
            <label class="form-check-label" for="tag-filter">Show images tagged with:</label>
          </div>
          <div class="ms-2 d-inline-block">
            <select [compareWith]="imageTagComparer" [disabled]="filterType !== 'tag'"
                    [(ngModel)]="activeTag"
                    id="filterByTag"
                    class="form-control"
                    (ngModelChange)="filterByTag($event)">
              @for (imageTag of selectableTags(); track tagTracker($index, imageTag)) {
                <option
                  [ngValue]="imageTag">{{ imageTag.subject }}
                </option>
              }
            </select>
          </div>
        }
        <div class="row mb-3">
          <div class="col-sm-6">
            <label for="search">Filter images for text</label>
            <input [(ngModel)]="filterText" type="text"
                   (ngModelChange)="onSearchChange($event)" class="form-control input-md rounded ms-8 w-100"
                   id="search"
                   placeholder="any text">
          </div>
          <div class="col-sm-6 mt-auto">
            <div class="form-check">
              <input
                [(ngModel)]="showDuplicates"
                (ngModelChange)="applyFilter()"
                type="checkbox" class="form-check-input"
                id="show-duplicates">
              <label class="form-check-label" for="show-duplicates">Show duplicate images</label>
            </div>
          </div>
        </div>
        <h6>Pagination</h6>
      }
      <div class="sticky-toolbar">
        <ng-container *ngTemplateOutlet="imageListPagination"/>
      </div>
      @for (imageMetaDataItem of currentPageImages; track metadataItemTracker(index, imageMetaDataItem); let index = $index) {
        <app-image-edit nonDestructive
                        [index]="index"
                        [duplicateImages]="duplicateImages"
                        [contentMetadata]="contentMetadata"
                        [s3Metadata]="metaDataFor(imageMetaDataItem)"
                        [contentMetadataImageTags]="contentMetadata.imageTags"
                        [filteredFiles]="currentPageImages"
                        [item]="imageMetaDataItem"
                        (imageInsert)="imageInsert($event)"
                        (imageEdit)="imageEdit($event)"
                        (imageChange)="imageChange($event)"
                        (imagedSavedOrReverted)="imagedSavedOrReverted($event)"
                        (delete)="delete($event)"
                        (moveUp)="moveUp($event)"
                        (moveDown)="moveDown($event)"
                        (copyToAlbum)="startCopyToAlbum($event)">
        </app-image-edit>
      }
      }
      @if (workflowMode) {
        <div class="album-sticky-bar workflow">
          <button type="button" class="album-upload-action primary"
                  [disabled]="disabled() || photosWorking()"
                  (click)="browseToFile(photosInput)">
            <fa-icon [icon]="faImages"/>
            Library
          </button>
          <button type="button" class="album-upload-action"
                  [disabled]="disabled() || photosWorking()"
                  (click)="browseToFile(cameraInput)">
            <fa-icon [icon]="faCamera"/>
            Camera
          </button>
          <button type="button" class="album-upload-action primary done"
                  [disabled]="disabled() || photosWorking()"
                  (click)="requestSaveChangesAndExit()">
            @if (photosWorking()) {
              <fa-icon [icon]="faSpinner" animation="spin"/>
            } @else {
              <fa-icon [icon]="faSave"/>
            }
            {{ saveAndExitCaption() }}
          </button>
          <button type="button" class="album-upload-action secondary-exit"
                  [disabled]="disabled() || photosWorking()"
                  (click)="exitBackWithoutSaving()">
            {{ exitWithoutSavingCaption() }}
          </button>
        </div>
      } @else {
        <div class="album-sticky-bar">
          <button type="button" class="album-upload-action primary"
                  [disabled]="disabled() || photosWorking()"
                  (click)="browseToFile(photosInput)">
            <fa-icon [icon]="faImages"/>
            {{ imagesExist() ? "Add more" : "Add photos" }}
          </button>
          <button type="button" class="album-upload-action"
                  [disabled]="disabled()"
                  (click)="requestSaveChanges()">
            <fa-icon [icon]="faSave"/>
            {{ unsavedImages()?.length ? "Save album" : "Save" }}
          </button>
        </div>
      }
      <ng-template #imageListPagination>
        <div class="image-list-pagination">
          <pagination class="pagination rounded" [boundaryLinks]="true" [directionLinks]="true" [rotate]="true"
                      [maxSize]="maxSize()"
                      [itemsPerPage]="pageSize"
                      [totalItems]="filteredFiles.length"
                      [(ngModel)]="pageNumber"
                      [disabled]="disabled()"
                      (pageChanged)="pageChanged($event)"></pagination>
          @if (notifyTarget.showAlert) {
            <div class="image-list-pagination-alert alert {{notifyTarget.alertClass}}">
              <fa-icon [icon]="notifyTarget.alert.icon"/>
              @if (notifyTarget.alertTitle) {
                <strong>
                  {{ notifyTarget.alertTitle }}: </strong>
              } {{ notifyTarget.alertMessage }}
            </div>
          }
        </div>
      </ng-template>
    }`,
  imports: [FileUploadModule, BadgeButtonComponent, NgClass, NgStyle, FontAwesomeModule, TagManagerComponent,
    FormsModule, PaginationComponent, TooltipDirective, AspectRatioSelectorComponent, ImageEditComponent,
    BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, FileSizeSelectorComponent, NgTemplateOutlet,
    CdkDropListGroup, CdkDropList, CdkDrag]
})
export class ImageListEditComponent implements OnInit, OnDestroy {
  private changeDetectorRef = inject(ChangeDetectorRef);

  private static readonly EDIT_WORKING_MAX_WIDTH = 2400;

  @Input("name") set nameValue(name: string) {
    this.logger.info("name changed:", name);
    this.initialiseImagesForName(name);
  }

  @Input() workflowMode = false;
  @HostBinding("class.workflow-mode") get workflowModeClass(): boolean {
    return this.workflowMode;
  }
  @Output() exit: EventEmitter<ContentMetadata> = new EventEmitter();
  private logger: Logger = inject(LoggerFactory).createLogger("ImageListEditComponent", NgxLoggerLevel.ERROR);
  public notifyTarget: AlertTarget = {};
  private notifierService: NotifierService = inject(NotifierService);
  private webSocketClientService: WebSocketClientService = inject(WebSocketClientService);
  public notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  private pageContentService: PageContentService = inject(PageContentService);
  private createWalkAlbumService = inject(CreateWalkAlbumService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public imageTagDataService: ImageTagDataService = inject(ImageTagDataService);
  public numberUtils: NumberUtilsService = inject(NumberUtilsService);
  public fileUtils: FileUtilsService = inject(FileUtilsService);
  private imageDuplicatesService: ImageDuplicatesService = inject(ImageDuplicatesService);
  protected contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private fileUploadService: FileUploadService = inject(FileUploadService);
  private memberLoginService: MemberLoginService = inject(MemberLoginService);
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  protected urlService: UrlService = inject(UrlService);
  private http: HttpClient = inject(HttpClient);
  public name: string;
  public pageUsages: string[] = [];
  private changeUrlOnChangeOfTag = false;
  private queuedFileCount = 0;
  public duplicateImages: DuplicateImages;
  public base64Files: Base64File[] = [];
  public nonImageFiles: Base64File[] = [];
  public activeTag: ImageTag;
  private story: string;
  public warnings: AlertInstance;
  public warningTarget: AlertTarget = {};
  public confirm = new Confirm();
  public destinationType: string;
  public filterType: ImageFilterType;
  public uploader: FileUploader;
  public contentMetadata: ContentMetadata;
  public filesTaggedWith = (tag: Tag): number => this.contentMetadata?.files?.filter(file => file.tags?.includes(tag.key)).length ?? 0;
  public s3Metadata: S3Metadata[] = [];
  public filteredFiles: ContentMetadataItem[] = [];
  public changedItems: ContentMetadataItem[] = [];
  public currentPageImages: ContentMetadataItem[] = [];
  public allow: MemberResourcesPermissions = {};
  public showDuplicates = false;
  public filterText: string;
  public hasFileOver = false;
  public exitAfterSave = false;
  public currentImageIndex: number;
  protected reorderMode = false;
  protected coverDropItems: ContentMetadataItem[] = [];
  protected reorderBoundaryDropItems: ContentMetadataItem[] = [];
  protected reorderPageImages: ContentMetadataItem[] = [];
  protected reorderPageNumber = 1;
  protected readonly reorderPageSize = 40;
  protected copySourceItem: ContentMetadataItem = null;
  protected copyDestinationAlbums: ContentMetadata[] = [];
  protected copyDestinationAlbumName: string = null;
  protected copyInProgress = false;
  protected copyCompleted = false;
  protected copyDestinationAlbumsLoading = false;
  private searchChangeObservable = new Subject<string>();
  public pageNumber = 1;
  private pageCount: number;
  protected pageSize = 10;
  private pages: number[];
  private subscriptions: Subscription[] = [];
  public tags: number[];
  public manageTags: boolean;
  protected readonly faSave = faSave;
  protected readonly faPencil = faPencil;
  protected readonly faRemove = faRemove;
  protected readonly faEraser = faEraser;
  protected readonly faUndo = faUndo;
  protected readonly faSortNumericDown = faSortNumericDown;
  protected readonly faSortNumericUp = faSortNumericUp;
  protected readonly faAdd = faAdd;
  protected readonly faArrowsUpDown = faArrowsUpDown;
  protected readonly faBookOpen = faBookOpen;
  protected readonly faTags = faTags;
  protected readonly faFile = faFile;
  protected readonly faTableCells = faTableCells;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleInfo = faCircleInfo;
  protected readonly faCompress = faCompress;
  protected readonly faImages = faImages;
  protected readonly faCamera = faCamera;
  protected readonly faCloudArrowUp = faCloudArrowUp;
  protected readonly faSpinner = faSpinner;
  private preparingPhotos = false;
  protected readonly saveToNew = false;
  public highlightUploadZone = false;
  @ViewChild("uploadZone") private uploadZoneRef: ElementRef<HTMLElement>;
  private systemConfig: SystemConfig;
  protected progressResponse: ProgressResponse;
  protected resizeInProgress = false;
  private resizePollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.logger.info("ngOnInit:this.contentMetadata", this.contentMetadata, "name:", this.name, "story:", this.story);
    this.notify.setBusy();
    this.warnings = this.notifierService.createAlertInstance(this.warningTarget);
    this.destinationType = "";
    this.filterType = ImageFilterType.ALL;
    this.subscriptions.push(this.contentMetadataService.s3Notifications().subscribe(data => this.logger.debug("contentMetadataService.notifications.s3:", data)));
    this.subscriptions.push(this.route.queryParams.subscribe(params => {
      this.story = params[StoredValue.STORY];
      this.logger.info("route.queryParams:", this.story);
      this.syncTagWithStory();
      if (params[StoredValue.ADD_PHOTOS] === "1" || params[StoredValue.ADD_PHOTOS] === "true") {
        this.promptAddPhotos();
      }
    }));
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      const name = paramMap.get("name");
      this.logger.info("paramMap:subscribe:", paramMap, "name from paramMap:", name, "existing name:", this.name);
      this.initialiseImagesForName(name);
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => this.systemConfig = systemConfig));
    this.subscriptions.push(this.webSocketClientService.receiveMessages<ProgressResponse>(MessageType.PROGRESS).subscribe((progressResponse: ProgressResponse) => {
      this.progressResponse = progressResponse;
      this.resizeInProgress = true;
      this.startResizePolling();
      this.logger.info(`Progress: ${progressResponse.message}`);
      this.notify.success({title: progressResponse.queued ? "Resize Queued" : "Progress", message: progressResponse.message});
    }));
    this.subscriptions.push(this.webSocketClientService.receiveMessages(MessageType.ERROR).subscribe(error => {
        this.logger.error(`Error:`, error);
        this.resizeInProgress = false;
        this.progressResponse = null;
        this.clearResizeState();
        this.clearBusy();
        this.notify.error({title: "Error", message: error});
      })
    );
    this.subscriptions.push(this.webSocketClientService.receiveMessages(MessageType.COMPLETE).subscribe((message: ApiResponse) => {
        this.logger.info(`Task completed:`, message);
        this.resizeInProgress = false;
        this.progressResponse = null;
        this.clearResizeState();
        if (isArray(message.response)) {
          this.processResizeItemsResponse(message.response);
          this.clearBusy();
        } else {
          this.postSaveContentMetadata(Promise.resolve(message.response)).then(() => this.clearBusy());
        }
      })
    );
    this.applyFilter();
    this.applyAllowEdits();
    this.searchChangeObservable.pipe(debounceTime(500))
      .pipe(distinctUntilChanged())
      .subscribe(() => this.applyFilter());
    this.contentMetadataService.albumCatalogue()
      .catch(error => this.logger.debug("Album catalogue prefetch failed", error));
  }

  private clearBusy() {
    this.logger.info("clearBusy called");
    this.notify.clearBusy();
  }

  private setBusy() {
    this.logger.info("setBusy called");
    this.notify.setBusy();
  }

  albumNameChange(albumName: string) {
    const reformattedPath = this.urlService.reformatLocalHref(albumName);
    this.logger.info("albumNameChange:", albumName, "reformattedPath:", reformattedPath);
    this.contentMetadata.name = reformattedPath;
  }

  private initialiseImagesForName(name: string) {
    if (name && this.name !== name) {
      this.name = name;
      this.initialiseImageList();
    } else if (this.name && this.name !== this.contentMetadata?.name) {
      this.initialiseImageList();
    }
  }

  public tagSelected(tag: ImageTag) {
    this.logger.debug("tag selected:", tag);
    if (tag) {
      if (tag === RECENT_PHOTOS) {
        this.filterType = ImageFilterType.RECENT;
      } else if (tag === ALL_PHOTOS) {
        this.filterType = ImageFilterType.ALL;
      } else {
        this.filterType = ImageFilterType.TAG;
      }
    }
  }

  private syncTagWithStory() {
    if (this.contentMetadata) {
      const tag = this.imageTagDataService.findTag(this.contentMetadata?.imageTags, this.story);
      this.logger.info("syncTagWithStory:contentMetadata:", this.contentMetadata, "received story parameter:", this.story, "setting activeTag to:", tag);
      this.activeTag = tag;
      if (tag) {
        this.imageTagDataService.updateUrlWith(tag);
        this.tagSelected(tag);
        this.applyFilter();
      }
    } else {
      this.logger.info("syncTagWithStory:story parameter:", this.story, "cant perform sync as no contentMetadata");
    }

  }

  private async initialiseImageList() {
    this.logger.info("initialiseImageList for name:", this.name);
    await this.refreshContentAndS3Metadata(this.name);
    const uploadPath = this.contentMetadataService.rootFolderAndName(this.contentMetadata.rootFolder, this.contentMetadata.name);
    this.logger.info("creating uploader for path:", uploadPath, "from rootFolder:", this.contentMetadata.rootFolder, "name:", this.contentMetadata.name);
    this.uploader = this.fileUploadService.createUploaderFor(uploadPath, false);
    this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
        const awsFileUploadResponse: AwsFileUploadResponse = this.fileUploadService.handleAwsFileUploadResponse(response, this.notify, this.logger);
        this.logger.info("received awsFileUploadResponse:", awsFileUploadResponse);
        if (awsFileUploadResponse.errors.length > 0) {
          this.notify.error({title: "File upload failed", message: awsFileUploadResponse.errors});
        } else {
          const responses: AwsFileUploadResponseData[] = awsFileUploadResponse.responses;
          if (responses.length > 0) {
            this.notify.success({
              title: "File upload success",
              message: `${this.stringUtils.pluraliseWithCount(responses.length, "file")} ${this.stringUtils.pluraliseWithCount(responses.length, "was", "were")} uploaded`
            });
            const unmatchedQueue: ContentMetadataItem[] = [...this.unsavedImages()];
            const matches: ContentMetadataItem[] = responses.map(response => {
              const baseResponseName = this.fileUtils.basename(response.uploadedFile.originalname)?.toLowerCase();
              const matchedByBaseName = this.contentMetadata.files.find(item => {
                const baseOriginalName = this.fileUtils.basename(item.originalFileName || "")?.toLowerCase();
                return baseOriginalName && baseOriginalName === baseResponseName;
              });
              const matchedByOriginalName = matchedByBaseName
                || unmatchedQueue.find(item => (item.originalFileName || "").toLowerCase() === response.uploadedFile.originalname.toLowerCase());
              if (matchedByOriginalName) {
                const queueIndex = unmatchedQueue.indexOf(matchedByOriginalName);
                if (queueIndex >= 0) {
                  unmatchedQueue.splice(queueIndex, 1);
                }
              }
              const metadataItem = matchedByOriginalName || (() => {
                if (unmatchedQueue.length === 0) {
                  return null;
                }
                const fallback = unmatchedQueue.shift();
                this.logger.warn("falling back to sequential match for", response.uploadedFile.originalname, "matched:", fallback?.originalFileName);
                if (fallback && !fallback.originalFileName) {
                  fallback.originalFileName = response.uploadedFile.originalname;
                }
                return fallback;
              })();
              if (metadataItem) {
                metadataItem.image = response.fileNameData.awsFileName;
                delete metadataItem.base64Content;
                this.logger.debug("matched image :", metadataItem?.originalFileName, "with aws file", response.fileNameData.awsFileName);
                return metadataItem;
              } else {
                this.logger.warn("could not find match in metadata items for:", response);
                return null;
              }
            }).filter(item => item);
            if (matches.length === responses.length) {
              if (this.uploader.progress < 100) {
                this.logger.debug("uploader is still uploading with", this.stringUtils.pluraliseWithCount(this.uploader.queue.length, "queued item"), "remaining");
                this.alertWarnings();
              } else {
                const message = this.stringUtils.pluraliseWithCount(responses.length, "saved file") + " were matched to currently viewed images that have been uploaded";
                const title = "File upload success";
                this.logger.debug(title, message);
                this.notify.success({
                  title,
                  message
                });
                this.clearUpload();
                if (this.readyToSaveMetadata()) {
                  if (this.exitAfterSave) {
                    this.saveChangeAndExit();
                  } else {
                    this.saveChanges();
                  }
                } else {
                  this.notify.warning({
                    title: "File upload",
                    message: `Previous save was not complete as ${this.unsavedImages().length} out of ${this.stringUtils.pluraliseWithCount(this.queuedFileCount, "file")} ${this.stringUtils.pluralise(this.unsavedImages().length, "appears", "appear")} to not have been saved. Try the save operation again.`
                  });
                }
              }
            } else {
              this.notify.warning({
                title: "File upload matching failed",
                message: `${this.stringUtils.pluraliseWithCount(matches.length, "viewed file")} of ${this.stringUtils.pluraliseWithCount(responses.length, "saved file")} were matched to images that have been uploaded`
              });
            }
          } else {
            this.notify.warning({
              title: "File upload",
              message: "no files were uploaded"
            });
          }
        }
      }, (error) => {
        this.notify.error({title: "Upload failed", message: error});
      }
    );
  }

  private clearUpload() {
    this.uploader?.clearQueue();
    if (this.uploader) {
      this.uploader.isUploading = false;
    }
  }

  imagesExist() {
    return this.contentMetadata?.files?.filter(item => item.image)?.length > 0;
  }

  dimensionsChanged(dimensions: DescribedDimensions): void {
    this.logger.debug("dimensions changed:", dimensions);
    this.contentMetadata.aspectRatio = dimensions.description;
  }

  pageChanged(event: PageChangedEvent): void {
    this.logger.debug("event:", event);
    this.goToPage(event.page);
  }

  ngOnDestroy(): void {
    this.stopResizePolling();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  insertToEmptyList() {
    this.logger.debug("inserting image with filteredFiles:", this.filteredFiles);
    const newItem: ContentMetadataItem = {date: this.dateUtils.dateTimeNow().toMillis(), dateSource: "upload", tags: []};
    this.contentMetadata.rootFolder = RootFolder.carousels;
    this.contentMetadata.name = this.name;
    this.imageInsert(newItem);
  }

  goToPage(pageNumber) {
    this.logger.debug("goToPage", pageNumber);
    this.pageNumber = pageNumber;
    this.applyPagination();
  }

  paginate(contentMetadataItems: ContentMetadataItem[], pageSize, pageNumber): ContentMetadataItem[] {
    return contentMetadataItems.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
  }

  private applyPagination() {
    this.pages = range(1, this.pageCount + 1);
    const filteredImageCount = this.filteredFiles?.length;
    this.currentPageImages = this.paginate(this.filteredFiles, this.pageSize, this.pageNumber) || [];
    this.logger.debug("applyPagination: filtered image count", filteredImageCount, "filtered image count", filteredImageCount, "current page image count", this.currentPageImages?.length, "pageSize:", this.pageSize, "pageCount", this.pageCount, "pages", this.pages);
    if (this.currentPageImages.length === 0) {
      this.notify.progress("No images found");
    } else {
      const offset = (this.pageNumber - 1) * this.pageSize + 1;
      const pageIndicator = this.pages.length > 1 ? `Page ${this.pageNumber} of ${this.pageCount}` : `Page ${this.pageNumber}`;
      const toNumber = min([offset + this.pageSize - 1, filteredImageCount]);
      this.notify.progress(`${pageIndicator}  — showing ${offset} to ${toNumber} of ${this.stringUtils.pluraliseWithCount(filteredImageCount, "image")}`);
    }
  }

  onSearchChange(searchEntry: string) {
    this.logger.debug("received searchEntry:" + searchEntry);
    this.searchChangeObservable.next(searchEntry);
  }

  imageTagComparer(item1: ImageTag, item2: ImageTag): boolean {
    return item1?.key === item2?.key;
  }

  filterByTag(tagSubject: string) {
    this.logger.debug("filterByTag:tagSubject:", tagSubject);
    if (this.changeUrlOnChangeOfTag) {
      this.imageTagDataService.select(this.contentMetadata?.imageTags, tagSubject);
    }
    this.applyFilter();
  }

  applyFilter() {
    this.logger.info("applyFilters start:", this.filteredFiles?.length, "of", this.contentMetadata?.files?.length, "files", "tag:", this.activeTag, "showDuplicates:", this.showDuplicates, "filterText:", this.filterText);
    this.filterFiles();
    this.pageCount = this.calculatePageCount();
    this.applyPagination();
    this.detectDuplicates();
    this.alertWarnings();
  }

  private detectDuplicates() {
    this.duplicateImages = this.imageDuplicatesService.populateFrom(this.contentMetadata);
  }

  private   filterFiles() {
    this.filteredFiles = this.contentMetadataService.filterSlides(this.contentMetadata?.imageTags, this.contentMetadata?.files, this.duplicateImages, this.filterType, this.activeTag, this.showDuplicates, this.filterText) || [];
    this.logger.info("filteredFiles:", this.filteredFiles);
  }

  refreshContentAndS3Metadata(name: string) {
    this.setBusy();
    this.name = name;
    this.logger.info("image metadata refresh started for name:", name);
    return this.contentMetadataService.items(RootFolder.carousels, this.name)
      .then((contentMetaData: ContentMetadata) => {
        this.contentMetadata = contentMetaData;
        this.logger.info("this.contentMetadataService:returned:", contentMetaData);
        return this.refreshS3Metadata();
      })
      .then(() => {
        this.logger.info("metadata query complete for:", this.name);
        this.postMetadataRetrieveMapping();
      })
      .catch(response => this.notify.error({title: "Failed to refresh images", message: response}))
      .finally(() => this.clearBusy());
  }

  private refreshS3Metadata() {
    const metadataPrefix = this.contentMetadataService.rootFolderAndName(this.contentMetadata.rootFolder, this.contentMetadata.name);
    this.logger.info("refreshS3Metadata using prefix:", metadataPrefix, "from rootFolder:", this.contentMetadata.rootFolder, "name:", this.contentMetadata.name);
    return this.contentMetadataService.listMetaData(metadataPrefix)
      .then((s3Metadata: S3Metadata[]) => {
        this.s3Metadata = s3Metadata;
        this.logger.info("listMetaData:metadataPrefix:", metadataPrefix, "returned:", s3Metadata);
      });
  }

  private postMetadataRetrieveMapping() {
    this.syncTagWithStory();
    this.pollResizeStatus();
    this.startResizePolling();
    this.pageContentService.albumNames()
      .then(albumPaths => {
        this.pageUsages = albumPaths.filter(ap => ap.albumName === this.name).map(ap => ap.contentPath);
      })
      .catch(err => this.logger.error("Failed to load page usages", err));
    this.logger.info("postMetadataRetrieveMapping for:", this.name, "this.contentMetadata.maxImageSize", this.contentMetadata.maxImageSize, "this.contentMetadata.aspectRatio", this.contentMetadata.aspectRatio);
    if (isUndefined(this.contentMetadata.maxImageSize)) {
      this.contentMetadata.maxImageSize = this.systemConfig.images?.imageLists?.defaultMaxImageSize;
    }
    if (isUndefined(this.contentMetadata.aspectRatio)) {
      this.contentMetadata.aspectRatio = this.systemConfig.images?.imageLists?.defaultAspectRatio;
    }
    if (this.contentMetadata.files) {
      this.contentMetadata.files = this.contentMetadata.files.map(file => {
        return {
          ...file,
          date: this.fileDate(file),
          dateSource: file.dateSource || "upload"
        };
      });
    } else {
      this.logger.debug("no data exists for:", this.name);
    }
    this.logger.debug("refreshImageMetaData:name", this.name, "returning", this.contentMetadata?.files?.length, "ContentMetadataItem items");
    this.base64Files = [];
    this.applyFilter();
  }

  fileDate(file: ContentMetadataItem): number {
    if (!file.date && !this.s3Metadata) {
      this.logger.warn("cant find date for", file);
    }
    const fileDate = file.date || this.metaDataFor(file)?.lastModified;
    this.logger.debug("fileDate:", fileDate, "original file.date", file.date);
    return fileDate;
  }

  public metaDataFor(item: ContentMetadataItem): S3Metadata {
    const metadata = this.contentMetadataService.findMetadataFor(item, this.s3Metadata);
    this.logger.off("metaDataFor item:", item, this.s3Metadata, "found metadata:", metadata);
    return metadata;
  }

  reverseSortOrder() {
    this.contentMetadata.files = this.contentMetadata.files.reverse();
    this.applyFilter();
  }

  clearImages() {
    this.contentMetadata.files = [];
    this.base64Files = [];
    this.applyFilter();
  }

  sortByDate() {
    this.contentMetadata.files = this.contentMetadata.files.sort(sortBy("-date"));
    this.applyFilter();
  }

  saveAndExitCaption(): string {
    if (!this.workflowMode) {
      return "Save changes and exit";
    }
    return this.isCompactViewport() ? "Save and return" : "Save and return to walk";
  }

  exitWithoutSavingCaption(): string {
    if (!this.workflowMode) {
      return "Exit without saving";
    }
    return this.isCompactViewport() ? "Back without saving" : "Return to walk";
  }

  private isCompactViewport(): boolean {
    return !isUndefined(window) && window.matchMedia("(max-width: 767.98px)").matches;
  }

  requestSaveChangesAndExit() {
    if (this.readyToSaveMetadata()) {
      this.saveChangeAndExit();
    } else {
      this.exitAfterSave = true;
      this.prepareFilesAndPerformUpload();
    }
  }

  requestSaveChanges(): void {
    if (this.readyToSaveMetadata()) {
      this.saveChanges();
    } else {
      this.exitAfterSave = false;
      this.prepareFilesAndPerformUpload();
    }
  }

  saveChangeAndExit() {
    this.saveChanges()
      .then(async (saved: ContentMetadata) => {
        if (!saved) {
          return;
        }
        this.createWalkAlbumService.clearPendingAlbum(saved.name || this.name);
        if (this.workflowMode) {
          this.exit.next(saved);
          return;
        }
        if (await this.createWalkAlbumService.navigateBackToWalkIfNeeded(saved.name || this.name)) {
          return;
        }
        this.exit.next(saved);
      }).catch(response => this.notify.error({title: "Failed to save images", message: response}));
  }

  saveChanges(): Promise<ContentMetadata> {
    return this.postSaveContentMetadata(this.contentMetadataService.createOrUpdate(this.contentMetadata));
  }

  postSaveContentMetadata(savedContent: Promise<ContentMetadata>): Promise<ContentMetadata> {
    return savedContent
      .then(async (savedContent: ContentMetadata) => {
        this.saveOrUpdateSuccessful();
        this.logger.info("postSaveContentMetadata:saved content:", savedContent);
        this.contentMetadata = savedContent;
        await this.createWalkAlbumService.ensureAlbumPageAfterSave(this.contentMetadata?.name);
        this.contentMetadata = await this.createWalkAlbumService.applyAutoCoverIfNeeded(this.contentMetadata, {
          force: this.workflowMode
        });
        await this.refreshS3Metadata();
        this.postMetadataRetrieveMapping();
        return this.contentMetadata;
      })
      .catch(response => {
        this.notify.error({title: "Failed to save changes", message: response});
        return null;
      });
  }

  public async exitBackWithoutSaving() {
    const albumName = this.contentMetadata?.name || this.name;
    if (this.workflowMode) {
      await this.createWalkAlbumService.abandonEmptyPendingAlbum(albumName, this.contentMetadata);
      this.exit.emit(null);
      return;
    }
    if (await this.createWalkAlbumService.navigateBackToWalkIfNeeded(albumName)) {
      return;
    }
    this.createWalkAlbumService.clearPendingAlbum(albumName);
    this.exit.emit(null);
  }

  public undoChanges() {
    this.clearUpload();
    this.nonImageFiles = [];
    return this.refreshContentAndS3Metadata(this.name)
      .catch(response => this.notify.error({title: "Failed to undo changes", message: response}));
  }

  applyAllowEdits() {
    this.allow.edit = this.memberLoginService.allowContentEdits();
  }

  saveOrUpdateSuccessful() {
    this.notify.success(`${this.stringUtils.pluraliseWithCount(this.contentMetadata?.files?.length, "image")} ${this.stringUtils.pluralise(this.contentMetadata?.files?.length, "was", "were")} saved successfully`);
  }

  protected toggleReorderMode(): void {
    this.reorderMode = !this.reorderMode;
    if (this.reorderMode) {
      const currentImageOffset = Math.max(0, (this.pageNumber - 1) * this.pageSize);
      this.reorderPageNumber = Math.floor(currentImageOffset / this.reorderPageSize) + 1;
      this.applyReorderPage();
    }
  }

  protected reorderPageChanged(event: PageChangedEvent): void {
    this.reorderPageNumber = event.page;
    this.applyReorderPage();
  }

  protected reorderPageCount(): number {
    return Math.ceil((this.contentMetadata?.files?.length || 0) / this.reorderPageSize);
  }

  protected reorderImageNumber(index: number): number {
    return (this.reorderPageNumber - 1) * this.reorderPageSize + index + 1;
  }

  protected reorderRangeDescription(): string {
    const totalImages = this.contentMetadata?.files?.length || 0;
    const firstImage = totalImages === 0 ? 0 : (this.reorderPageNumber - 1) * this.reorderPageSize + 1;
    const lastImage = Math.min(this.reorderPageNumber * this.reorderPageSize, totalImages);
    return `Section ${this.reorderPageNumber} of ${this.reorderPageCount()} — images ${firstImage} to ${lastImage} of ${totalImages}`;
  }

  protected imageOrderDropped(event: CdkDragDrop<ContentMetadataItem[]>): void {
    if (event.previousContainer === event.container && event.previousIndex !== event.currentIndex) {
      const pageOffset = (this.reorderPageNumber - 1) * this.reorderPageSize;
      move(this.contentMetadata.files, pageOffset + event.previousIndex, pageOffset + event.currentIndex);
      this.applyFilter();
      this.applyReorderPage();
    }
  }

  protected coverImageItem(): ContentMetadataItem | null {
    return this.contentMetadata?.files?.find(item => item.image === this.contentMetadata.coverImage) || null;
  }

  protected coverImageDropped(event: CdkDragDrop<ContentMetadataItem[]>): void {
    const item = event.item.data as ContentMetadataItem;
    if (item?.image) {
      this.contentMetadata.coverImage = item.image;
      this.applyReorderPage();
    }
  }

  protected clearCoverImage(): void {
    this.contentMetadata.coverImage = null;
  }

  protected moveImageToPreviousReorderPage(event: CdkDragDrop<ContentMetadataItem[]>): void {
    const item = event.item.data as ContentMetadataItem;
    const sourceIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (sourceIndex >= 0 && this.reorderPageNumber > 1) {
      const previousPageLastIndex = (this.reorderPageNumber - 1) * this.reorderPageSize - 1;
      move(this.contentMetadata.files, sourceIndex, previousPageLastIndex);
      this.reorderPageNumber -= 1;
      this.applyFilter();
      this.applyReorderPage();
    }
  }

  protected moveImageToStart(event: CdkDragDrop<ContentMetadataItem[]>): void {
    const item = event.item.data as ContentMetadataItem;
    const sourceIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (sourceIndex > 0) {
      move(this.contentMetadata.files, sourceIndex, 0);
      this.reorderPageNumber = 1;
      this.applyFilter();
      this.applyReorderPage();
    }
  }

  protected moveImageToNextReorderPage(event: CdkDragDrop<ContentMetadataItem[]>): void {
    const item = event.item.data as ContentMetadataItem;
    const sourceIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (sourceIndex >= 0 && this.reorderPageNumber < this.reorderPageCount()) {
      const nextPageFirstIndex = Math.min(this.reorderPageNumber * this.reorderPageSize, this.contentMetadata.files.length - 1);
      move(this.contentMetadata.files, sourceIndex, nextPageFirstIndex);
      this.reorderPageNumber += 1;
      this.applyFilter();
      this.applyReorderPage();
    }
  }

  private applyReorderPage(): void {
    const maximumPage = Math.max(this.reorderPageCount(), 1);
    this.reorderPageNumber = Math.min(Math.max(this.reorderPageNumber, 1), maximumPage);
    this.reorderPageImages = this.paginate(this.contentMetadata?.files || [], this.reorderPageSize, this.reorderPageNumber);
  }

  protected startCopyToAlbum(item: ContentMetadataItem): void {
    this.copySourceItem = item;
    this.copyDestinationAlbumName = null;
    this.copyDestinationAlbums = [];
    this.copyCompleted = false;
    this.copyDestinationAlbumsLoading = true;
    this.contentMetadataService.albumCatalogue()
      .then(albums => {
        const recentAlbumNames = this.recentCopyDestinationAlbumNames();
        this.copyDestinationAlbums = albums
          .filter(album => album.rootFolder === RootFolder.carousels && album.name !== this.contentMetadata.name)
          .sort((firstAlbum, secondAlbum) => this.compareCopyDestinationAlbums(firstAlbum, secondAlbum, recentAlbumNames));
        this.copyDestinationAlbumName = recentAlbumNames.find(name => this.copyDestinationAlbums.some(album => album.name === name)) || null;
      })
      .catch(error => {
        this.copySourceItem = null;
        this.notify.error({title: "Album list unavailable", message: error});
      })
      .finally(() => {
        this.copyDestinationAlbumsLoading = false;
        this.changeDetectorRef.markForCheck();
      });
  }

  protected cancelCopyToAlbum(): void {
    this.copySourceItem = null;
    this.copyDestinationAlbumName = null;
    this.copyDestinationAlbums = [];
    this.copyCompleted = false;
    this.copyDestinationAlbumsLoading = false;
  }

  protected async confirmCopyToAlbum(): Promise<void> {
    if (this.copySourceItem?.image && this.copyDestinationAlbumName) {
      this.copyInProgress = true;
      const request: ContentMetadataCopyImageRequest = {
        sourceAlbumName: this.contentMetadata.name,
        destinationAlbumName: this.copyDestinationAlbumName,
        sourceImage: this.copySourceItem.image
      };
      try {
        await this.contentMetadataService.copyImageToAlbum(request);
        this.rememberCopyDestinationAlbum(this.copyDestinationAlbumName);
        this.notify.success({
          title: "Image copied",
          message: `A separate copy was added to ${this.contentMetadataService.contentMetadataName({name: this.copyDestinationAlbumName} as ContentMetadata)}. The original image was not changed.`
        });
        this.copyCompleted = true;
      } catch (error) {
        this.notify.error({title: "Image copy failed", message: error});
      } finally {
        this.copyInProgress = false;
      }
    }
  }

  private compareCopyDestinationAlbums(firstAlbum: ContentMetadata, secondAlbum: ContentMetadata, recentAlbumNames: string[]): number {
    const firstRecentIndex = recentAlbumNames.indexOf(firstAlbum.name);
    const secondRecentIndex = recentAlbumNames.indexOf(secondAlbum.name);
    if (firstRecentIndex >= 0 && secondRecentIndex >= 0) {
      return firstRecentIndex - secondRecentIndex;
    } else if (firstRecentIndex >= 0) {
      return -1;
    } else if (secondRecentIndex >= 0) {
      return 1;
    } else {
      return firstAlbum.name.localeCompare(secondAlbum.name);
    }
  }

  private recentCopyDestinationAlbumNames(): string[] {
    const storedValue = localStorage.getItem(StoredValue.ALBUM_COPY_DESTINATIONS);
    try {
      const parsedValue = storedValue ? JSON.parse(storedValue) : [];
      return isArray(parsedValue) ? parsedValue.filter(isString) : [];
    } catch (error) {
      this.logger.warn("failed to read recent album copy destinations", error);
      return [];
    }
  }

  private rememberCopyDestinationAlbum(albumName: string): void {
    const recentAlbumNames = this.recentCopyDestinationAlbumNames();
    const updatedAlbumNames = [albumName, ...recentAlbumNames.filter(name => name !== albumName)].slice(0, 5);
    localStorage.setItem(StoredValue.ALBUM_COPY_DESTINATIONS, JSON.stringify(updatedAlbumNames));
  }

  moveUp(item: ContentMetadataItem) {
    const currentIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (this.contentMetadataService.canMoveUp(this.contentMetadata.files, item)) {
      move(this.contentMetadata.files, currentIndex, currentIndex - 1);
      this.logger.debug("moved up item with index", currentIndex, "to", this.contentMetadataService.findIndex(this.contentMetadata.files, item), "in total of", this.contentMetadata?.files?.length, "items");
      this.applyFilter();
    } else {
      this.logger.warn("cant move up item with index", currentIndex);
    }
  }

  moveDown(item: ContentMetadataItem) {
    const currentIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (this.contentMetadataService.canMoveDown(this.contentMetadata.files, item)) {
      move(this.contentMetadata.files, currentIndex, currentIndex + 1);
      this.logger.debug("moved down item with index", currentIndex, "to", this.contentMetadataService.findIndex(this.contentMetadata.files, item), "for item", item.text, "in total of", this.contentMetadata?.files?.length, "items");
      this.applyFilter();
    } else {
      this.logger.warn("cant move down item", currentIndex);
    }
  }

  imagedSavedOrReverted(changedItem: ContentMetadataItem) {
    this.logger.debug("imagedSavedOrReverted:changedItem.image", changedItem.image);
    this.removeFromChangedItems(changedItem);
    if (!changedItem.image) {
      this.applyFilter();
    }
  }

  imageChange(item: ContentMetadataItem) {
    if (!item) {
      this.logger.debug("change:no item");
    } else {
      this.currentImageIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
      if (this.currentImageIndex >= 0) {
        this.logger.debug("change:existing item", item, "at index", this.currentImageIndex);
        this.contentMetadata.files[this.currentImageIndex] = item;
      } else {
        this.logger.warn("change:appears to be a new item", item, "at index", this.currentImageIndex);
      }
    }
  }

  delete(item: ContentMetadataItem): number {
    this.removeFromChangedItems(item);
    this.logger.debug("delete:before count", this.contentMetadata?.files?.length, "item:", item);
    const index = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (index >= 0) {
      this.contentMetadata.files.splice(index, 1);
      this.logger.debug("delete:after count", this.contentMetadata?.files?.length);
      this.applyFilter();
      this.detectDuplicates();
    } else {
      this.logger.warn("cant delete", item);
    }
    return this.contentMetadataService.findIndex(this.contentMetadata.files, item);
  }

  imageEdit(item: ContentMetadataItem) {
    this.addToChangedItems(item);
  }

  imageInsert(...items: ContentMetadataItem[]) {
    const defaultDateSource = this.contentMetadataService.defaultDateSourceFor(this.contentMetadata.files);
    const initialisedItems = items.map(item => ({
      ...item,
      dateSource: !item.dateSource || item.dateSource === uploadGroupEventType.area ? defaultDateSource : item.dateSource
    }));
    this.logger.info("insert:new items", initialisedItems, "before:", this.contentMetadata.files);
    if (this.contentMetadata.files) {
      this.contentMetadata.files.splice(0, 0, ...initialisedItems);
    } else {
      this.contentMetadata.files = initialisedItems;
    }

    this.logger.info("insert:new items", initialisedItems, "after:", this.contentMetadata.files);
    this.addToChangedItems(...initialisedItems);
    this.downscaleUnsavedImagesForEditing(initialisedItems);
  }

  alertWarnings() {
    if (this.unsavedImages().length > 0 || !isEmpty(this.nonImageMessage()) || !isEmpty(this.duplicateMessage())) {
      if (isEmpty(this.duplicateMessage())) {
        this.warnings.warning({title: "Unsaved Changes", message: this.alertText()});
      } else {
        this.warnings.error({title: "Unsaved Changes", message: this.alertText(), continue: true});
      }
    } else {
      this.warnings.hide();
    }
  }

  selectableTags(): ImageTag[] {
    return this.contentMetadata?.imageTags || [];
  }

  tagTracker(index: number, imageTag: ImageTag) {
    return imageTag.key;
  }

  metadataItemTracker(index: number, item: ContentMetadataItem) {
    return item._id || index;
  }

  filterFor(choice: any) {
    this.logger.debug("filterFor:choice:", choice);
    this.applyFilter();
  }

  maxSize() {
    return min([this.calculatePageCount(), 5]);
  }

  private calculatePageCount(): number {
    return Math.ceil(this.filteredFiles?.length / this.pageSize);
  }

  private addToChangedItems(...items: ContentMetadataItem[]) {
    const netChangedItems: ContentMetadataItem[] = this.changedItems.filter(item => !items.includes(item));
    if (netChangedItems.length > 0) {
      this.logger.debug("addToChangedItems:", netChangedItems);
      this.changedItems.push(...netChangedItems);
    }
    this.applyFilter();
  }

  private removeFromChangedItems(item: ContentMetadataItem) {
    if (this.changedItems.includes(item)) {
      this.logger.debug("removeFromChangedItems:", item);
      this.changedItems = this.changedItems.filter(changedItem => changedItem !== item);
    }
    this.alertWarnings();
  }

  alertText() {
    const duplicateMessage = this.duplicateMessage();
    const nonImageMessage = this.nonImageMessage();
    return `You have ${this.stringUtils.pluraliseWithCount(this.unsavedImages()?.length, "unsaved image")}${duplicateMessage}${nonImageMessage}`;
  }

  private duplicateMessage(): string {
    const imageFiles = this.contentMetadata?.files?.filter(file => !file.youtubeId) || [];
    const imageDuplicates = keys(this.duplicateImages).filter(key => key && key !== 'undefined');
    return imageDuplicates.length > 0 ? ` and ${this.stringUtils.pluralise(imageDuplicates.length, "a duplicate", "duplicates")} on ${this.stringUtils.pluraliseWithCount(imageDuplicates.length, "image")} will need to be resolved before you can save this album` : "";
  }

  private nonImageMessage(): string {
    return this.nonImageFiles.length > 0 ? ` and ${this.stringUtils.pluraliseWithCount(this.nonImageFiles.length, "non-image")} that ${this.stringUtils.pluralise(this.nonImageFiles.length, "was", "were")} skipped` : "";
  }

  toggleManageTags() {
    this.manageTags = !this.manageTags;
  }

  browseToFile(fileElement: HTMLInputElement) {
    if (!this.photosWorking() && !this.disabled() && fileElement) {
      fileElement.value = "";
      fileElement.click();
    }
  }

  onUploadZoneClick(fileElement: HTMLInputElement) {
    if (!isUndefined(window) && window.matchMedia("(max-width: 767.98px)").matches) {
      return;
    }
    this.browseToFile(fileElement);
  }

  private promptAddPhotos() {
    this.highlightUploadZone = true;
    setTimeout(() => {
      this.uploadZoneRef?.nativeElement?.scrollIntoView({behavior: "smooth", block: "center"});
    }, 250);
    setTimeout(() => {
      this.highlightUploadZone = false;
    }, 4500);
    const phoneLayout = !isUndefined(window) && window.matchMedia("(max-width: 767.98px)").matches;
    this.notify.success({
      title: "Add walk photos",
      message: phoneLayout
        ? "Tap Photo library for several shots from your camera roll, or Take photo for a new one. Then Save album."
        : "Drag and drop photos here, or click to browse. Then Save."
    });
  }

  photosWorking(): boolean {
    return this.preparingPhotos || !!this.uploader?.isUploading || this.resizeInProgress || !!this.notifyTarget?.busy;
  }

  albumUploadTitle(): string {
    if (this.uploader?.isUploading) {
      return "Uploading photos…";
    }
    if (this.resizeInProgress) {
      return "Resizing photos…";
    }
    if (this.preparingPhotos || this.notifyTarget?.busy) {
      return "Preparing photos…";
    }
    return this.imagesExist() ? "Add more photos" : "Add photos";
  }

  albumUploadWorkingSubtitle(): string {
    if (this.uploader?.isUploading) {
      return "Please wait while photos are uploaded to your site.";
    }
    if (this.resizeInProgress) {
      return "Please wait while photos are resized.";
    }
    return "Please wait while photos are read and prepared.";
  }

  async onFileSelectOrDropped(fileList: any) {
    if (!this.uploader?.isUploading && !this.preparingPhotos) {
      try {
        const droppedCount = fileList?.length || 0;
        this.logger.debug("onFileSelectOrDropped:", fileList);
        this.preparingPhotos = true;
        this.notify.success({
          title: "Preparing photos",
          message: "Reading " + this.stringUtils.pluraliseWithCount(droppedCount, "photo")
        });
        this.setBusy();
        const allBase64Files: Base64File[] = await this.fileUtils.fileListToBase64Files(fileList);
        const unreadableCount = droppedCount - allBase64Files.length;
        if (unreadableCount > 0) {
          this.notify.warning({
            title: "Some photos could not be read",
            message: `${this.stringUtils.pluraliseWithCount(unreadableCount, "photo")} could not be read and ${this.stringUtils.pluralise(unreadableCount, "was", "were")} skipped. Try again with fewer at once if this keeps happening.`,
            continue: true
          });
        }
        const checkedResults: CheckedImage[] = await Promise.all(allBase64Files.map(async file => {
          if (file.file.type === IMAGE_HEIC || file.file.name?.toLowerCase()?.endsWith(".heic") || file.file.name?.toLowerCase()?.endsWith(".heif")) {
            return await this.fileUtils.convertHEICFile(file);
          } else {
            return {file, isImage: this.urlService.isBase64Image(file.base64Content)};
          }
        }));
        this.logger.debug("checkedResults:", checkedResults);
        this.base64Files = checkedResults.filter(result => result.isImage).map(result => result.file);
        this.nonImageFiles = checkedResults.filter(result => !result.isImage).map(result => result.file);
        this.logger.info("there are", this.stringUtils.pluraliseWithCount(this.base64Files.length, "image"), "and", this.stringUtils.pluraliseWithCount(this.nonImageFiles.length, "non-image"), "non-images:", this.nonImageFiles);
        if (this.base64Files.length === 0) {
          this.notify.warning({
            title: "No photos added",
            message: "None of the selected files looked like photos. Choose images from your library (JPEG, PNG or HEIC) and try again."
          });
          this.preparingPhotos = false;
          this.clearBusy();
          return;
        }
        this.imageInsert(...this.base64Files.map(item => this.fileUtils.contentMetadataItemFromBase64File(item)));
        this.notify.success({
          title: "Photos ready",
          message: `${this.stringUtils.pluraliseWithCount(this.base64Files.length, "photo")} added. Save when you are done.`
        });
        this.preparingPhotos = false;
      } catch (error) {
        this.logger.error("onFileSelectOrDropped failed:", error);
        this.notify.error({title: "Could not add photos", message: error});
        this.preparingPhotos = false;
        this.clearBusy();
      }
    }
  }

  public fileOver(e: any): void {
    if (!this.photosWorking()) {
      this.hasFileOver = e;
    }
  }

  private async prepareFilesAndPerformUpload() {
    try {
      await this.compressUnsavedImagesToMaxSize();
    } catch (error) {
      this.handleResizeError(error as any);
    }
    const queuedFiles: File[] = this.unsavedImages()
      .map(item => this.fileUtils.awsFileData(item.originalFileName, item.base64Content, this.fileForBase64Content(item)))
      .map(item => item.file);
    this.queuedFileCount = queuedFiles.length;
    this.uploader.clearQueue();
    this.uploader.addToQueue(queuedFiles);
    this.logger.debug("addedToQueue:", queuedFiles);
    this.uploader.uploadAll();
  }

  private unsavedImages(): ContentMetadataItem[] {
    return (this.contentMetadata?.files && this.contentMetadata.files.filter(item => this.urlService.isBase64Image(item.base64Content))) || [];
  }

  private fileForBase64Content(item: ContentMetadataItem): File {
    const file = this.base64Files.find(file => file.base64Content === item.base64Content)?.file;
    const fileFromContentMetadata = new File([base64ToFile(item.base64Content)], item.originalFileName, {
      lastModified: item.date,
      type: this.fileUtils.fileExtension(item.originalFileName)
    });
    return file || fileFromContentMetadata;
  }

  readyToSaveMetadata() {
    return this.unsavedImages().length === 0;
  }

  private pollResizeStatus(): void {
    if (!this.contentMetadata?.id) {
      this.stopResizePolling();
      return;
    }
    this.http.get<ProgressResponse>(`api/integration-worker/resize/status/${this.contentMetadata.id}`).subscribe({
      next: (state) => {
        if (state) {
          this.resizeInProgress = true;
          this.progressResponse = state;
          this.logger.info(`Resize state: queued=${state.queued}, message=${state.message}`);
        } else {
          this.resizeInProgress = false;
          this.progressResponse = null;
          this.stopResizePolling();
        }
      },
      error: (error) => {
        if ((error as HttpErrorResponse).status === HttpStatusCode.NotFound) {
          this.logger.info("Resize complete - no active state on backend");
          this.resizeInProgress = false;
          this.progressResponse = null;
          this.stopResizePolling();
        }
      }
    });
  }

  private startResizePolling(): void {
    if (this.resizePollTimer) {
      return;
    }
    this.resizePollTimer = setInterval(() => this.pollResizeStatus(), 3000);
  }

  private stopResizePolling(): void {
    if (this.resizePollTimer) {
      clearInterval(this.resizePollTimer);
      this.resizePollTimer = null;
    }
  }

  private clearResizeState(): void {
    this.stopResizePolling();
  }

  public async resizeSavedImages(): Promise<void> {
    if (this.resizeInProgress) {
      this.notify.warning({title: "Resize in progress", message: "An image resize is already queued or running. Please wait for it to finish before starting another."});
      return;
    }
    this.resizeInProgress = true;
    try {
      await this.saveChanges();
      const contentMetadataResizeRequest: ContentMetadataResizeRequest = {
        maxFileSize: this.contentMetadata.maxImageSize,
        id: this.contentMetadata.id,
        output: this.saveToNew ? {
          name: this.contentMetadata.name + "-resized",
          rootFolder: this.contentMetadata.rootFolder
        } : null
      };
      this.setBusy();
      this.webSocketClientService.connect()
        .then(() => this.webSocketClientService.sendMessage(EventType.RESIZE_SAVED_IMAGES, contentMetadataResizeRequest))
        .catch(error => this.handleResizeError(error));
    } catch (error) {
      this.handleResizeError(error as Error);
    }
  }

  private downscaleUnsavedImagesForEditing(items: ContentMetadataItem[]) {
    try {
      this.logger.info("downscaleUnsavedImagesForEditing called with items:", items);
      const resizable = (items || []).filter(i => this.fileUtils.isResizableName(i.originalFileName || "") && this.urlService.isBase64Image(i.base64Content));
      if (resizable.length === 0) {
        this.logger.info("no images eligible for downscaling on drop");
        this.clearBusy();
        return;
      }
      this.setBusy();
      const tasks = resizable.map(async item => {
        const updated = await this.fileUtils.downscaleBase64Image(item.base64Content, item.originalFileName, ImageListEditComponent.EDIT_WORKING_MAX_WIDTH);
        if (updated) {
          item.base64Content = updated;
        }
      });
      Promise.all(tasks).then(() => this.clearBusy()).catch(error => this.handleResizeError(error));
    } catch (error) {
      this.handleResizeError(error as any);
    }
  }

  private async compressUnsavedImagesToMaxSize(): Promise<void> {
    const maxBytes = this.contentMetadata?.maxImageSize || 0;
    if (!(maxBytes > 0)) {
      return;
    }
    const compressible = this.unsavedImages().filter(item => this.fileUtils.isResizableName(item.originalFileName || ""));
    if (compressible.length === 0) {
      return;
    }
    this.notify.success({
      title: "Resizing Images",
      message: "Resizing " + this.stringUtils.pluraliseWithCount(compressible.length, "image") + " to a maximum size of " + this.numberUtils.humanFileSize(maxBytes)
    });
    await Promise.all(compressible.map(async item => {
      const updated = await this.fileUtils.resizeBase64Image(item.base64Content, item.originalFileName, maxBytes, 1200);
      if (updated) {
        item.base64Content = updated;
      }
    }));
  }

  private handleResizeError(error: Error) {
    this.resizeInProgress = false;
    this.progressResponse = null;
    this.clearResizeState();
    this.clearBusy();
    this.logger.error(error);
    this.notify.error({title: "Image Resizing failed", message: error});
  }

  private processResizeItemsResponse(resizedItems: ContentMetadataItem[]) {
    resizedItems.forEach(resizedItem => {
      const metadataItem: ContentMetadataItem = this.contentMetadata.files.find(file => file.originalFileName === resizedItem.originalFileName);
      if (metadataItem) {
        this.logger.info("received resizedItems image related to :", metadataItem?.originalFileName, "with content", this.numberUtils.humanFileSize(resizedItem.base64Content.length));
        metadataItem.base64Content = resizedItem.base64Content;
      } else {
        this.logger.warn("could not find match in metadata items for:", resizedItem);
      }
    });
    this.notify.success({
      title: "Task completed",
      message: `Resized ${this.stringUtils.pluraliseWithCount(resizedItems.length, "image")}`
    });
  }

  disabled() {
    return !this.uploader || this.uploader.isUploading || this.notifyTarget.busy;
  }

  imageActionsDisabled() {
    return this.disabled() || this.resizeInProgress;
  }

  resizeActionCaption(): string {
    return this.progressResponse?.queued ? "Resize queued" : "Resize in progress";
  }

  progressPercent(): number {
    return this.progressResponse?.queued ? 100 : (this.progressResponse?.percent || 0);
  }
}
