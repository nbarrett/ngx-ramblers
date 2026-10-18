import { ButtonDropdownComponent } from "../../../modules/common/button-dropdown/button-dropdown";
import { ButtonDropdownItem } from "../../../models/button-dropdown.model";
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
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { isEmpty, isString, keys, values } from "es-toolkit/compat";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { CdkDrag, CdkDragHandle, CdkDragDrop, CdkDropList, CdkDropListGroup } from "@angular/cdk/drag-drop";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  faAdd,
  faArrowLeft,
  faAngleLeft,
  faAngleRight,
  faGrip,
  faSliders,
  faBookOpen,
  faCamera,
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faCloudArrowUp,
  faCompress,
  faEraser,
  faFile,
  faImages,
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
  AlbumEditorView,
  AlbumPhotoSort,
  albumMaxImageSize,
  Base64File,
  imageAlt,
  ContentMetadata,
  ContentMetadataCopyImageRequest,
  ContentMetadataItem,
  ContentMetadataResizeRequest,
  DuplicateImages,
  ImageFilterType,
  ImageTag,
  RECENT_PHOTOS,
  S3Metadata,
  AlbumEditRole,
  AlbumContributor,
  contributorOwnsItem,
  draftFiles
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
import { YouTubeService } from "../../../services/youtube.service";
import { YouTubeQuality } from "../../../models/youtube.model";
import { base64ToFile } from "ngx-image-cropper";
import { NgClass, NgStyle, NgTemplateOutlet } from "@angular/common";
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

    .album-upload-zone-compact
      min-height: 96px
      padding: var(--space-3, 12px)

    .album-upload-zone-compact .album-upload-icon,
    .album-upload-zone-compact .album-upload-actions
      display: none !important

    .album-sticky-bar
      position: sticky
      bottom: 0
      z-index: 20
      display: grid
      grid-template-columns: 1fr 1fr
      gap: var(--space-2, 8px)
      padding: var(--space-3, 12px) 0
      padding-bottom: calc(var(--space-3, 12px) + env(safe-area-inset-bottom, 0px))
      margin-top: var(--space-3, 12px)
      background: var(--rsm-panel-bg, white)
      border-top: 1px solid var(--rsm-border, rgba(64, 65, 65, 0.1))

    .album-sticky-bar .btn
      width: 100%
      min-width: 0
      height: auto
      box-sizing: border-box
      white-space: normal
      overflow: visible
      padding-left: var(--space-2, 8px)
      padding-right: var(--space-2, 8px)
      line-height: 1.2
      justify-content: center
      text-align: center

    .album-sticky-bar .btn + .btn
      margin-left: 0

    :host.workflow-mode
      display: block

    .album-editor-drop
      min-height: 100%

    @keyframes album-upload-pulse
      0%, 100%
        box-shadow: 0 0 0 0 rgba(249, 177, 4, 0)
      50%
        box-shadow: 0 0 0 8px rgba(249, 177, 4, 0.22)

    .sticky-toolbar
      background: var(--rsm-panel-bg, white)

    .reorder-view-switch
      display: flex
      flex-wrap: wrap
      align-items: center
      gap: var(--space-3, 12px)
      margin: 0 0 var(--space-3, 12px)

    .reorder-view-switch span
      color: var(--rsm-muted, rgb(110, 112, 115))
      font-size: 0.85rem

    @media (max-width: 767.98px)
      .reorder-view-switch
        display: grid
        grid-template-columns: minmax(0, 1fr)

      .reorder-view-switch app-button-dropdown
        width: 100%

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

    .cover-drop-zone
      display: grid
      grid-template-columns: 88px minmax(0, 1fr) auto
      align-items: center
      gap: var(--space-3, 12px)
      min-height: 88px
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
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))
      gap: var(--space-3, 12px)

    .image-reorder-empty
      grid-column: 1 / -1

    .image-reorder-item
      position: relative
      min-width: 0
      border: 1px solid var(--rsm-border, rgba(15, 23, 42, 0.15))
      border-radius: var(--radius-2, 6px)
      background: var(--rsm-panel-bg, #fff)
      overflow: hidden
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12)
      touch-action: pan-y
      content-visibility: auto
      contain-intrinsic-size: auto 220px

    .image-reorder-preview
      display: block
      width: 100%
      padding: 0
      border: 0
      background: var(--rsm-panel-bg, white)
      cursor: pointer
      touch-action: pan-y

    .image-reorder-preview:focus-visible
      outline: 3px solid var(--ramblers-colour-sunrise)
      outline-offset: -3px

    .image-reorder-handle
      cursor: grab
      touch-action: none

    .image-reorder-status
      padding: 0 var(--space-2, 8px) var(--space-2, 8px)
      font-size: 0.75rem
      color: var(--rsm-muted, rgb(110, 112, 115))

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
      flex: 1
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

    @media (max-width: 575.98px)
      .cover-drop-zone
        grid-template-columns: 64px minmax(0, 1fr)

      .cover-drop-zone > :last-child
        grid-column: 2

      .copy-image-introduction
        grid-template-columns: 1fr

      .copy-image-introduction img
        width: 120px

      .image-reorder-grid
        grid-template-columns: repeat(2, minmax(0, 1fr))
  `],
  template: `
    @if (allow.edit && contentMetadata) {
      <div class="album-editor-drop" ng2FileDrop [uploader]="uploader"
           (fileOver)="fileOver($event)" (onFileDrop)="onFileSelectOrDropped($event)">
      @if (!workflowMode && albumEditorView === AlbumEditorView.PHOTOS) {
        <details class="thumbnail-heading-frame thumbnail-heading-frame-compact mb-3">
          <summary class="thumbnail-heading"><fa-icon [icon]="faSliders" class="me-2"/>Album settings and filters</summary>
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
          <div class="d-flex flex-wrap gap-2 mt-3">
            <button type="button" class="btn btn-quiet" [disabled]="disabled()" (click)="undoChanges()">
              <fa-icon [icon]="faUndo" class="me-2"/>Undo changes
            </button>
        <div class="btn-group" dropdown>
          <button [disabled]="imageActionsDisabled()" aria-controls="dropdown-animated"
                  class="btn btn-primary dropdown-toggle"
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
          </div>
        </details>
      }
      <ng-template #photoOrderControl>
        <app-button-dropdown [label]="workflowMode ? 'Photo order' : photoSortLabel()" [icon]="faSortNumericDown"
                             [items]="photoSortItems()" [disabled]="photosWorking()" [compact]="!workflowMode"
                             [fullWidth]="workflowMode" [tooltip]="photoSortLabel()"
                             ariaLabel="Photo order" (itemSelect)="changePhotoSort($event)"/>
      </ng-template>
      @if (workflowMode) {
        <ng-content select="[albumReport]"/>
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
      @if (albumEditorView === AlbumEditorView.PHOTOS) {
      <h5 class="fw-bold mb-2">{{ stringUtils.pluraliseWithCount(filteredFiles.length, "photo") }}</h5>
      <div class="row mb-3">
        <div class="col-12">
          <div #uploadZone
               role="button"
               tabindex="0"
               [class.album-upload-zone-compact]="contentMetadata.files.length > 0"
               [attr.aria-label]="contentMetadata.files.length > 0 ? 'Add more photos to this album' : 'Add photos to this album'"
               [ngClass]="{
                 'file-over': !photosWorking() && hasFileOver,
                 'disabled': disabled() || photosWorking(),
                 'highlight': highlightUploadZone,
                 'working': photosWorking()
               }"
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
              <button type="button" class="btn btn-primary"
                      [disabled]="disabled() || photosWorking()"
                      (click)="browseToFile(photosInput)">
                <fa-icon [icon]="faImages"/>
                Photo library
              </button>
              <button type="button" class="btn btn-quiet"
                      [disabled]="disabled() || photosWorking()"
                      (click)="browseToFile(cameraInput)">
                <fa-icon [icon]="faCamera"/>
                Take photo
              </button>
            </div>
          </div>
        </div>
      </div>
      }
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
        <div class="col-sm-12">
          @if (warningTarget.showAlert && hasImageWarnings()) {
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
      @if (albumEditorView === AlbumEditorView.PHOTOS && !contributor() && pendingDrafts().length > 0) {
        <div class="alert alert-warning d-flex align-items-start gap-2 mb-3">
          <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1"/>
          <div class="flex-grow-1 min-w-0">
            <strong class="d-block">{{ stringUtils.pluraliseWithCount(pendingDrafts().length, "photo") }} awaiting approval</strong>
            <span>Added by members and hidden from visitors until approved. Approve each one below, or all at once, then save.</span>
          </div>
          <button type="button" class="btn btn-primary btn-sm flex-shrink-0" [disabled]="disabled()" (click)="approveAll()">
            <fa-icon [icon]="faCircleCheck" class="me-2"/>Approve all
          </button>
        </div>
      }
      @if (albumEditorView === AlbumEditorView.PHOTOS) {
      <div class="reorder-view-switch">
        <p class="flex-grow-1 mb-0">
          {{ unsavedImages().length ? stringUtils.pluraliseWithCount(unsavedImages().length, "new photo") + " ready to save. " : "" }}
          @if (contentMetadata.files.length) {
            Select a photo to view, crop or edit its details.
          } @else {
            Your photos will appear here. Add photos from your library or camera to get started.
          }
          Dates use the photo's capture metadata where available, otherwise the file's modified date.
        </p>
        @if (!workflowMode) {
          <ng-container *ngTemplateOutlet="photoOrderControl"/>
        }

      </div>
      }
      @if (notifyTarget.showAlert) {
        <div class="alert" [ngClass]="notifyTarget.alertClass" role="status" aria-live="polite">
          <div class="d-flex align-items-start gap-2 mb-1">
            <fa-icon [icon]="notifyTarget.alert.icon"/>
            <strong>{{ notifyTarget.alertTitle }}</strong>
          </div>
          <div>{{ notifyTarget.alertMessage }}</div>
        </div>
      }
      @if (copySourceItem) {
        <div class="copy-image-backdrop" role="presentation">
          <section class="copy-image-panel" role="dialog" aria-modal="true" aria-labelledby="copy-image-title">
            <div class="copy-image-introduction">
              <img [src]="urlService.imageSourceFor(copySourceItem, contentMetadata)" [alt]="imageAlt(copySourceItem) || copySourceItem.image">
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
                  <option [ngValue]="null">{{ copyDestinationAlbumsLoading ? "Loading albums…" : copyDestinationAlbums.length === 0 ? "No other albums" : "Choose an album" }}</option>
                  @for (album of copyDestinationAlbums; track album.rootFolder + album.name) {
                    <option [ngValue]="album.name">{{ contentMetadataService.contentMetadataName(album) }}</option>
                  }
                </select>
                @if (!copyDestinationAlbumsLoading && copyDestinationAlbums.length === 0) {
                  <div class="alert alert-warning d-flex align-items-start mt-2 mb-0">
                    <fa-icon [icon]="faCircleExclamation" class="me-2"/>
                    <div><strong>No other album to copy to</strong><p class="mb-0">This site has no album apart from this one. Create another album first, for example by adding an album row to a page, then copy the photo into it.</p></div>
                  </div>
                }
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
      @if (albumEditorView === AlbumEditorView.PHOTOS || !selectedPhoto()) {
        <div class="image-reorder-workspace" cdkDropListGroup>
          @if (!contributor() && filteredFiles.length > 0) {
            <section class="cover-drop-zone" cdkDropList [cdkDropListData]="coverDropItems"
                     [cdkDropListDisabled]="photosWorking()" [cdkDropListSortingDisabled]="true"
                     (cdkDropListDropped)="coverImageDropped($event)">
              <div class="cover-drop-preview">
                @if (coverImageItem(); as coverImage) {
                  <img loading="lazy" decoding="async" [src]="urlService.imageSourceFor(coverImage, contentMetadata)" [alt]="imageAlt(coverImage) || 'Album cover'">
                } @else {
                  <div class="cover-drop-placeholder"><fa-icon [icon]="faBookOpen"/></div>
                }
              </div>
              <div class="cover-drop-copy">
                <strong class="d-block">{{ coverImageItem() ? "Album cover" : "Choose your album cover" }}</strong>
                <p class="mb-0">{{ autoCoverRequested ? "A cover will be chosen automatically when you save the album." : "Choose a photo, drag it here, or let us pick one when you save." }}</p>
              </div>
              <div class="d-flex align-items-center flex-wrap gap-2">
                <button type="button" class="btn btn-quiet btn-sm" [disabled]="photosWorking() || autoCoverRequested"
                        tooltip="Choose a cover automatically when you save the album" (click)="autoChooseCover()">
                  <fa-icon [icon]="faBookOpen" class="me-2"/>Auto-choose
                </button>
              @if (coverImageItem()) {
                <button type="button" class="btn btn-quiet btn-icon" [disabled]="photosWorking()"
                        tooltip="Clear cover" aria-label="Clear cover" (click)="clearCoverImage()">
                  <fa-icon [icon]="faRemove"/>
                </button>
              }
              </div>
            </section>
          }
          <div class="image-reorder-grid" cdkDropList cdkDropListOrientation="mixed"
               [cdkDropListData]="reorderPageImages" [cdkDropListDisabled]="contributor() || photosWorking()"
               (cdkDropListDropped)="imageOrderDropped($event)">
            @for (item of reorderPageImages; track metadataItemTracker($index, item); let index = $index) {
              <article class="image-reorder-item" cdkDrag [cdkDragData]="item" [cdkDragDisabled]="contributor() || photosWorking()">
                <button type="button" class="image-reorder-preview" [disabled]="photosWorking()"
                        [attr.aria-label]="'Open photo ' + (index + 1) + (item.text ? ': ' + item.text : '')" (click)="openPhoto(item)">
                  <img loading="lazy" decoding="async" [src]="item.youtubeId ? youtubeService.thumbnailUrl(item.youtubeId, YouTubeQuality.HQ) : urlService.imageSourceFor(item, contentMetadata)" [alt]="imageAlt(item) || 'Photo ' + (index + 1)">
                </button>
                @if (isCoverImage(item)) {
                  <span class="image-reorder-cover-badge"><fa-icon [icon]="faBookOpen"/>Cover</span>
                }
                <div class="image-reorder-details">
                  <span class="image-reorder-name">{{ item.text || item.originalFileName || 'Photo ' + (index + 1) }}</span>
                  @if (!contributor()) {
                    <button type="button" class="btn btn-quiet btn-icon" [disabled]="photosWorking() || !!item.youtubeId || !!item.draft"
                            [class.active]="isCoverImage(item)" [attr.aria-pressed]="isCoverImage(item)"
                            [attr.aria-label]="isCoverImage(item) ? 'Clear cover' : 'Use photo ' + (index + 1) + ' as cover'"
                            [tooltip]="item.draft ? 'Approve this photo before choosing it as cover' : isCoverImage(item) ? 'Clear cover' : 'Use as cover'"
                            (click)="useAsCover(item)"><fa-icon [icon]="faBookOpen"/></button>
                    <button type="button" class="btn btn-quiet btn-icon image-reorder-handle" cdkDragHandle
                            [disabled]="photosWorking()" tooltip="Drag to reorder" [attr.aria-label]="'Drag photo ' + (index + 1) + ' to reorder'">
                      <fa-icon [icon]="faGrip"/>
                    </button>
                  }
                </div>
                @if (item.base64Content || item.draft) {
                  <div class="image-reorder-status"><fa-icon [icon]="item.base64Content ? faCloudArrowUp : faCircleExclamation" class="me-1"/>
                    {{ item.base64Content ? "Ready to save" : "Awaiting approval" }}
                  </div>
                }
              </article>
            } @empty {
              @if (contentMetadata.files.length) {
                <p class="image-reorder-empty mb-0">No photos match these filters. Change the album filters above.</p>
              }
            }
          </div>
        </div>
      } @else {
        @if (selectedPhoto(); as imageMetaDataItem) {
          <div class="reorder-view-switch sticky-toolbar">
            <button type="button" class="btn btn-quiet" [disabled]="photosWorking() || photoEditor.editActive" (click)="showPhotos()">
              <fa-icon [icon]="faArrowLeft" class="me-2"/>Back to photos
            </button>
            <span class="flex-grow-1">Photo {{ selectedPhotoIndex + 1 }} of {{ filteredFiles.length }}</span>
            <button type="button" class="btn btn-quiet btn-icon" aria-label="Previous photo" tooltip="Previous photo"
                    [disabled]="selectedPhotoIndex === 0 || photosWorking() || photoEditor.editActive" (click)="selectAdjacentPhoto(-1)"><fa-icon [icon]="faAngleLeft"/></button>
            <button type="button" class="btn btn-quiet btn-icon" aria-label="Next photo" tooltip="Next photo"
                    [disabled]="selectedPhotoIndex >= filteredFiles.length - 1 || photosWorking() || photoEditor.editActive" (click)="selectAdjacentPhoto(1)"><fa-icon [icon]="faAngleRight"/></button>
          </div>
        <app-image-edit #photoEditor nonDestructive
                        [index]="selectedPhotoIndex"
                        [role]="role"
                        [selectedCover]="coverImageItem()"
                        (coverChange)="useAsCover($event)"
                        (approve)="approve($event)"
                        [duplicateImages]="duplicateImages"
                        [contentMetadata]="contentMetadata"
                        [s3Metadata]="metaDataFor(imageMetaDataItem)"
                        [contentMetadataImageTags]="contentMetadata.imageTags"
                        [filteredFiles]="filteredFiles"
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
      @if (albumEditorView === AlbumEditorView.PHOTOS) {
      <div class="album-sticky-bar">
        @if (workflowMode) {
          <ng-content select="[albumControls]"/>
          <ng-container *ngTemplateOutlet="photoOrderControl"/>
        }
        <button type="button" class="btn btn-quiet" [disabled]="photosWorking() || disabled()"
                (click)="browseToFile(photosInput)">
          <fa-icon [icon]="faImages" class="me-2"/>Add photos
        </button>
        <button type="button" class="btn btn-quiet" [disabled]="photosWorking() || disabled()"
                (click)="browseToFile(cameraInput)">
          <fa-icon [icon]="faCamera" class="me-2"/>Take photo
        </button>
        <button type="button" class="btn btn-primary" [disabled]="photosWorking() || disabled()"
                (click)="workflowMode ? requestSaveChangesAndExit() : requestSaveChanges()">
          <fa-icon [icon]="photosWorking() ? faSpinner : faSave" [animation]="photosWorking() ? 'spin' : null" class="me-2"/>
          {{ workflowMode ? saveAndExitCaption() : "Save album" }}
        </button>
        <button type="button" class="btn btn-quiet" [disabled]="photosWorking() || disabled()"
                [tooltip]="exitWithoutSavingCaption()" (click)="exitBackWithoutSaving()">
          <fa-icon [icon]="faUndo" class="me-2"/>Discard changes
        </button>
      </div>
      }
      </div>

    }`,
  imports: [NgTemplateOutlet, ButtonDropdownComponent, FileUploadModule, NgClass, NgStyle, FontAwesomeModule, TagManagerComponent,
    FormsModule, TooltipDirective, AspectRatioSelectorComponent, ImageEditComponent,
    BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, FileSizeSelectorComponent,
    CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle]
})
export class ImageListEditComponent implements OnInit, OnDestroy {
  private changeDetectorRef = inject(ChangeDetectorRef);
  protected youtubeService = inject(YouTubeService);
  protected readonly YouTubeQuality = YouTubeQuality;

  private static readonly EDIT_WORKING_MAX_WIDTH = 2400;

  @Input("name") set nameValue(name: string) {
    this.logger.info("name changed:", name);
    this.initialiseImagesForName(name);
  }

  @Input() workflowMode = false;
  @Input() role: AlbumEditRole = AlbumEditRole.CURATOR;
  @Input() contributorIdentity: AlbumContributor | null = null;
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
  private router = inject(Router);
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
  public allow: MemberResourcesPermissions = {};
  public showDuplicates = false;
  public filterText: string;
  public hasFileOver = false;
  public exitAfterSave = false;
  public currentImageIndex: number;
  protected readonly AlbumEditorView = AlbumEditorView;
  protected readonly imageAlt = imageAlt;
  protected albumEditorView = AlbumEditorView.PHOTOS;
  protected albumPhotoSort = AlbumPhotoSort.NEWEST;
  protected selectedPhotoIndex = 0;
  private pendingCoverItem: ContentMetadataItem | null = null;
  protected autoCoverRequested = false;
  protected coverDropItems: ContentMetadataItem[] = [];
  protected reorderPageImages: ContentMetadataItem[] = [];
  protected copySourceItem: ContentMetadataItem = null;
  protected copyDestinationAlbums: ContentMetadata[] = [];
  protected copyDestinationAlbumName: string = null;
  protected copyInProgress = false;
  protected copyCompleted = false;
  protected copyDestinationAlbumsLoading = false;
  private searchChangeObservable = new Subject<string>();
  private subscriptions: Subscription[] = [];
  public tags: number[];
  public manageTags: boolean;
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faAngleLeft = faAngleLeft;
  protected readonly faAngleRight = faAngleRight;
  protected readonly faGrip = faGrip;
  protected readonly faSliders = faSliders;
  protected readonly faSave = faSave;
  protected readonly faRemove = faRemove;
  protected readonly faEraser = faEraser;
  protected readonly faUndo = faUndo;
  protected readonly faSortNumericDown = faSortNumericDown;
  protected readonly faSortNumericUp = faSortNumericUp;
  protected readonly faAdd = faAdd;
  protected readonly faBookOpen = faBookOpen;
  protected readonly faTags = faTags;
  protected readonly faFile = faFile;
  protected readonly faTableCells = faTableCells;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faCircleInfo = faCircleInfo;
  protected readonly faCompress = faCompress;
  protected readonly faImages = faImages;
  protected readonly faCamera = faCamera;
  protected readonly faCloudArrowUp = faCloudArrowUp;
  protected readonly faSpinner = faSpinner;
  private preparingPhotos = false;
  private loadingAlbum = false;
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
      this.albumEditorView = params[StoredValue.ALBUM_EDIT_VIEW] === AlbumEditorView.DETAILS ? AlbumEditorView.DETAILS : AlbumEditorView.PHOTOS;
      const selectedSort = params[StoredValue.ALBUM_PHOTO_SORT];
      this.albumPhotoSort = values(AlbumPhotoSort).includes(selectedSort) ? selectedSort : AlbumPhotoSort.NEWEST;
      const photoNumber = Number(params[StoredValue.ALBUM_EDIT_PHOTO]);
      this.selectedPhotoIndex = Number.isInteger(photoNumber) && photoNumber > 0 ? photoNumber - 1 : 0;
      this.story = params[StoredValue.STORY];
      this.logger.info("route.queryParams:", this.story);
      this.syncTagWithStory();
      this.applyFilter();
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
                if (metadataItem === this.pendingCoverItem) {
                  this.contentMetadata.coverImage = metadataItem.image;
                  this.pendingCoverItem = null;
                }
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

  ngOnDestroy(): void {
    this.stopResizePolling();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    if (this.workflowMode) {
      const albumName = this.contentMetadata?.name || this.name;
      void this.createWalkAlbumService.abandonEmptyPendingAlbum(albumName, this.contentMetadata);
    }
  }

  insertToEmptyList() {
    this.logger.debug("inserting image with filteredFiles:", this.filteredFiles);
    const newItem: ContentMetadataItem = {date: this.dateUtils.dateTimeNow().toMillis(), dateSource: "upload", tags: []};
    this.contentMetadata.rootFolder = RootFolder.carousels;
    this.contentMetadata.name = this.name;
    this.imageInsert(newItem);
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
    this.reorderPageImages = this.filteredFiles;
    if (this.contentMetadata) {
      this.selectedPhotoIndex = Math.min(this.selectedPhotoIndex, Math.max(this.filteredFiles.length - 1, 0));
    }
    this.detectDuplicates();
    this.alertWarnings();
  }

  private detectDuplicates() {
    this.duplicateImages = this.imageDuplicatesService.populateFrom(this.contentMetadata);
  }

  private   filterFiles() {
    const filtered = this.contentMetadataService.filterSlides(this.contentMetadata?.imageTags, this.contentMetadata?.files, this.duplicateImages, this.filterType, this.activeTag, this.showDuplicates, this.filterText) || [];
    this.filteredFiles = this.sortedPhotos(this.contributor() ? filtered.filter(item => item.draft && contributorOwnsItem(this.uploaderIdentity(), item)) : filtered);
    this.logger.info("filteredFiles:", this.filteredFiles);
  }

  refreshContentAndS3Metadata(name: string) {
    this.loadingAlbum = true;
    this.setBusy();
    this.name = name;
    this.logger.info("image metadata refresh started for name:", name);
    return this.contentMetadataService.items(RootFolder.carousels, this.name, true)
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
      .finally(() => {
        this.loadingAlbum = false;
        this.clearBusy();
      });
  }

  private refreshS3Metadata(): Promise<void> {
    if (!this.contentMetadata.files?.some(file => !!file.image)) {
      this.s3Metadata = [];
      return Promise.resolve();
    } else {
      const metadataPrefix = this.contentMetadataService.rootFolderAndName(this.contentMetadata.rootFolder, this.contentMetadata.name);
      this.logger.info("refreshS3Metadata using prefix:", metadataPrefix, "from rootFolder:", this.contentMetadata.rootFolder, "name:", this.contentMetadata.name);
      return this.contentMetadataService.listMetaData(metadataPrefix)
        .then((s3Metadata: S3Metadata[]) => {
          this.s3Metadata = s3Metadata;
          this.logger.info("listMetaData:metadataPrefix:", metadataPrefix, "returned:", s3Metadata);
        });
    }
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
    this.contentMetadata.maxImageSize = albumMaxImageSize(
      this.contentMetadata.maxImageSize,
      this.systemConfig.images?.imageLists?.defaultMaxImageSize
    );
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
    this.contentMetadata.files = [...this.sortedPhotos(this.contentMetadata.files)].reverse();
    this.changePhotoSort(AlbumPhotoSort.CUSTOM);
  }

  clearImages() {
    this.contentMetadata.files = [];
    this.base64Files = [];
    this.pendingCoverItem = null;
    this.applyFilter();
  }

  sortByDate() {
    this.contentMetadata.files = this.sortedPhotos(this.contentMetadata.files);
    this.applyFilter();
  }

  protected photoSortItems(): ButtonDropdownItem[] {
    return [
      {id: AlbumPhotoSort.NEWEST, label: "Newest first"},
      {id: AlbumPhotoSort.OLDEST, label: "Oldest first"},
      {id: AlbumPhotoSort.FILENAME, label: "Filename"},
      {id: AlbumPhotoSort.CUSTOM, label: "Custom order"}
    ].map(item => ({...item, selected: item.id === this.albumPhotoSort}));
  }

  protected photoSortLabel(): string {
    return `Photo order: ${this.photoSortItems().find(item => item.selected)?.label || ""}`;
  }

  protected changePhotoSort(order: string): void {
    const selected = values(AlbumPhotoSort).find(value => value === order);
    if (selected) {
      this.albumPhotoSort = selected;
      this.sortByDate();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {[StoredValue.ALBUM_PHOTO_SORT]: selected},
        queryParamsHandling: "merge",
        replaceUrl: true
      });
    }
  }

  private sortedPhotos(files: ContentMetadataItem[]): ContentMetadataItem[] {
    if (this.albumPhotoSort === AlbumPhotoSort.CUSTOM) {
      return files;
    } else if (this.albumPhotoSort === AlbumPhotoSort.FILENAME) {
      return [...files].sort((a, b) => (a.originalFileName || a.image || "").localeCompare(b.originalFileName || b.image || "", "en", {numeric: true}));
    } else {
      const direction = this.albumPhotoSort === AlbumPhotoSort.OLDEST ? 1 : -1;
      return [...files].sort((a, b) => direction * ((a.date || 0) - (b.date || 0)));
    }
  }

  saveAndExitCaption(): string {
    if (!this.workflowMode) {
      return "Save changes and exit";
    }
    return this.isCompactViewport() ? "Save and return" : "Save and return to walk";
  }

  exitWithoutSavingCaption(): string {
    return this.workflowMode ? "Discard changes and return to walk" : "Discard changes and exit";
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
          force: this.workflowMode && !this.contributor()
        });
        this.createWalkAlbumService.clearPendingAlbum(this.contentMetadata?.name || this.name);
        this.autoCoverRequested = false;
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
    this.pendingCoverItem = null;
    this.nonImageFiles = [];
    return this.refreshContentAndS3Metadata(this.name)
      .catch(response => this.notify.error({title: "Failed to undo changes", message: response}));
  }

  applyAllowEdits() {
    this.allow.edit = (this.memberLoginService.memberLoggedIn() && this.memberLoginService.allowContentEdits()) || (this.workflowMode && !!this.role);
  }

  contributor(): boolean {
    return this.role === AlbumEditRole.CONTRIBUTOR;
  }

  private uploaderIdentity(): AlbumContributor | null {
    if (this.contributorIdentity) {
      return this.contributorIdentity;
    } else if (this.memberLoginService.memberLoggedIn()) {
      const member = this.memberLoginService.loggedInMember();
      return {memberId: member?.memberId, name: [member?.firstName, member?.lastName].filter(Boolean).join(" ")};
    } else {
      return null;
    }
  }

  pendingDrafts(): ContentMetadataItem[] {
    return draftFiles(this.contentMetadata?.files);
  }

  approve(item: ContentMetadataItem): void {
    item.draft = false;
    this.applyFilter();
  }

  approveAll(): void {
    this.pendingDrafts().forEach(item => item.draft = false);
    this.applyFilter();
    this.notify.success({title: "Photos approved", message: "Save to make them visible to everyone"});
  }

  saveOrUpdateSuccessful() {
    this.notify.success(`${this.stringUtils.pluraliseWithCount(this.contentMetadata?.files?.length, "image")} ${this.stringUtils.pluralise(this.contentMetadata?.files?.length, "was", "were")} saved successfully`);
  }

  protected selectedPhoto(): ContentMetadataItem | null {
    return this.filteredFiles[this.selectedPhotoIndex] || null;
  }

  protected openPhoto(item: ContentMetadataItem): void {
    this.selectedPhotoIndex = this.filteredFiles.indexOf(item);
    this.albumEditorView = AlbumEditorView.DETAILS;
    this.updatePhotoViewUrl();
  }

  protected showPhotos(): void {
    this.albumEditorView = AlbumEditorView.PHOTOS;
    this.updatePhotoViewUrl();
  }

  protected selectAdjacentPhoto(offset: number): void {
    this.selectedPhotoIndex = Math.max(0, Math.min(this.selectedPhotoIndex + offset, this.filteredFiles.length - 1));
    this.updatePhotoViewUrl();
  }

  private updatePhotoViewUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [StoredValue.ALBUM_EDIT_VIEW]: this.albumEditorView === AlbumEditorView.DETAILS ? this.albumEditorView : null,
        [StoredValue.ALBUM_EDIT_PHOTO]: this.albumEditorView === AlbumEditorView.DETAILS ? this.selectedPhotoIndex + 1 : null
      },
      queryParamsHandling: "merge",
      replaceUrl: true
    });
  }

  protected imageOrderDropped(event: CdkDragDrop<ContentMetadataItem[]>): void {
    if (!this.contributor() && !this.photosWorking() && event.previousContainer === event.container && event.previousIndex !== event.currentIndex) {
      const source = this.filteredFiles[event.previousIndex];
      const destination = this.filteredFiles[event.currentIndex];
      this.contentMetadata.files = this.sortedPhotos(this.contentMetadata.files);
      move(this.contentMetadata.files, this.contentMetadata.files.indexOf(source), this.contentMetadata.files.indexOf(destination));
      this.changePhotoSort(AlbumPhotoSort.CUSTOM);
    }
  }

  protected autoChooseCover(): void {
    if (!this.contributor() && !this.photosWorking()) {
      this.clearCoverImage();
      this.autoCoverRequested = true;
      this.createWalkAlbumService.markAlbumForAutoCover(this.contentMetadata.name);
    }
  }

  protected coverImageItem(): ContentMetadataItem | null {
    return this.pendingCoverItem || this.contentMetadata?.files?.find(item => !!item.image && item.image === this.contentMetadata.coverImage) || null;
  }

  protected isCoverImage(item: ContentMetadataItem): boolean {
    return item === this.coverImageItem();
  }

  protected useAsCover(item: ContentMetadataItem): void {
    if (!this.contributor() && !this.photosWorking() && !item.youtubeId && !item.draft) {
      this.autoCoverRequested = false;
      if (this.isCoverImage(item)) {
        this.clearCoverImage();
      } else if (item.image) {
        this.pendingCoverItem = null;
        this.contentMetadata.coverImage = item.image;
      } else {
        this.pendingCoverItem = item;
      }
    }
  }

  protected coverImageDropped(event: CdkDragDrop<ContentMetadataItem[]>): void {
    const item = event.item.data as ContentMetadataItem;
    if (item && !this.isCoverImage(item)) {
      this.useAsCover(item);
    }
  }

  protected clearCoverImage(): void {
    this.autoCoverRequested = false;    this.pendingCoverItem = null;
    this.contentMetadata.coverImage = null;
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
          .filter(album => album.name !== this.contentMetadata.name || album.rootFolder !== this.contentMetadata.rootFolder)
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
        sourceRootFolder: this.contentMetadata.rootFolder,
        sourceAlbumName: this.contentMetadata.name,
        destinationRootFolder: this.copyDestinationAlbums.find(album => album.name === this.copyDestinationAlbumName)?.rootFolder,
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
    this.contentMetadata.files = this.sortedPhotos(this.contentMetadata.files);
    const currentIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (this.contentMetadataService.canMoveUp(this.contentMetadata.files, item)) {
      move(this.contentMetadata.files, currentIndex, currentIndex - 1);
      this.logger.debug("moved up item with index", currentIndex, "to", this.contentMetadataService.findIndex(this.contentMetadata.files, item), "in total of", this.contentMetadata?.files?.length, "items");
      this.changePhotoSort(AlbumPhotoSort.CUSTOM);
      if (this.albumEditorView === AlbumEditorView.DETAILS) {
        this.openPhoto(item);
      }
    } else {
      this.logger.warn("cant move up item with index", currentIndex);
    }
  }

  moveDown(item: ContentMetadataItem) {
    this.contentMetadata.files = this.sortedPhotos(this.contentMetadata.files);
    const currentIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (this.contentMetadataService.canMoveDown(this.contentMetadata.files, item)) {
      move(this.contentMetadata.files, currentIndex, currentIndex + 1);
      this.logger.debug("moved down item with index", currentIndex, "to", this.contentMetadataService.findIndex(this.contentMetadata.files, item), "for item", item.text, "in total of", this.contentMetadata?.files?.length, "items");
      this.changePhotoSort(AlbumPhotoSort.CUSTOM);
      if (this.albumEditorView === AlbumEditorView.DETAILS) {
        this.openPhoto(item);
      }
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
      if (this.isCoverImage(item)) {
        this.clearCoverImage();
      }
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

  async imageInsert(...items: ContentMetadataItem[]): Promise<boolean> {
    const prepared = await this.downscaleUnsavedImagesForEditing(items);
    if (prepared) {
      this.insertPreparedImages(...items);
    }
    return prepared;
  }

  private insertPreparedImages(...items: ContentMetadataItem[]): void {
    const defaultDateSource = this.contentMetadataService.defaultDateSourceFor(this.contentMetadata.files);
    const identity = this.uploaderIdentity();
    const uploadedAt = this.dateUtils.dateTimeNow().toMillis();
    const initialisedItems = items.map(item => ({
      ...item,
      dateSource: !item.dateSource || item.dateSource === uploadGroupEventType.area ? defaultDateSource : item.dateSource,
      uploadedBy: item.uploadedBy || identity?.memberId,
      uploadedByName: item.uploadedByName || identity?.name,
      uploadedByEmail: item.uploadedByEmail || identity?.email,
      uploadedAt: item.uploadedAt || uploadedAt,
      draft: this.contributor()
    }));
    this.logger.info("insert:new items", initialisedItems, "before:", this.contentMetadata.files);
    if (this.contentMetadata.files) {
      this.contentMetadata.files.splice(0, 0, ...initialisedItems);
    } else {
      this.contentMetadata.files = initialisedItems;
    }

    this.logger.info("insert:new items", initialisedItems, "after:", this.contentMetadata.files);
    this.sortByDate();
    this.addToChangedItems(...initialisedItems);
    if (this.albumEditorView === AlbumEditorView.DETAILS) {
      this.showPhotos();
    }
  }

  protected hasImageWarnings(): boolean {
    return this.nonImageFiles.length > 0 || !isEmpty(this.duplicateMessage());
  }

  alertWarnings() {
    if (this.unsavedImages().length > 0 || !isEmpty(this.nonImageMessage()) || !isEmpty(this.duplicateMessage())) {
      this.warnings.warning({title: "Unsaved Changes", message: this.alertText()});
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
    const imageDuplicates = keys(this.duplicateImages).filter(key => key && key !== "undefined");
    return imageDuplicates.length > 0 ? `. ${this.stringUtils.pluraliseWithCount(imageDuplicates.length, "photo")} ${imageDuplicates.length === 1 ? "appears" : "appear"} more than once. You can still save this album` : "";
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
    return this.loadingAlbum || this.preparingPhotos || !!this.uploader?.isUploading || this.resizeInProgress || !!this.notifyTarget?.busy;
  }

  albumUploadTitle(): string {
    if (this.loadingAlbum) {
      return "Loading album…";
    } else if (this.uploader?.isUploading) {
      return "Uploading photos…";
    } else if (this.resizeInProgress) {
      return "Resizing photos…";
    } else if (this.preparingPhotos || this.notifyTarget?.busy) {
      return "Preparing photos…";
    } else {
      return this.contentMetadata?.files?.length ? "Add more photos" : "Add photos";
    }
  }

  albumUploadWorkingSubtitle(): string {
    if (this.loadingAlbum) {
      return "Loading the album and saved photo details.";
    } else if (this.uploader?.isUploading) {
      return "Please wait while photos are uploaded to your site.";
    } else if (this.resizeInProgress) {
      return "Please wait while photos are resized.";
    } else {
      return "Please wait while photos are read and prepared.";
    }
  }

  async onFileSelectOrDropped(fileList: FileList | File[]) {
    if (!this.photosWorking()) {
      const droppedCount = (fileList as FileList)?.length || (fileList as File[])?.length || 0;
      this.preparingPhotos = true;
      this.base64Files = [];
      this.nonImageFiles = [];
      this.setBusy();
      try {
        this.notify.success({
          title: "Preparing photos",
          message: "Reading " + this.stringUtils.pluraliseWithCount(droppedCount, "photo")
        });
        const prepared = await this.fileUtils.prepareDroppedFiles(fileList, this.contentMetadata.files || []);
        this.base64Files = prepared.images;
        this.nonImageFiles = [];
        if (prepared.images.length === 0 && !prepared.skippedDuplicates) {
          this.notify.warning({
            title: "No photos added",
            message: "None of the selected files could be prepared. Choose JPEG, PNG or HEIC photos and try again."
          });
        } else if (prepared.images.length > 0) {
          const inserted = await this.imageInsert(...prepared.images.map(item => this.fileUtils.contentMetadataItemFromBase64File(item)));
          if (inserted) {
            this.notify.success({
              title: "Photos ready",
              message: `${this.stringUtils.pluraliseWithCount(prepared.images.length, "photo")} added. Save when you are done.`
            });
          }
        }
        if (prepared.skippedDuplicates > 0) {
          this.notify.warning({
            title: "Duplicate photos skipped",
            message: `${this.stringUtils.pluraliseWithCount(prepared.skippedDuplicates, "photo")} already in this album or repeated in this selection. No extra copies were added.`,
            continue: true
          });
        }
        const failedFiles = prepared.failedFiles || prepared.skippedHeicFiles || [];
        const failedCount = Math.max(failedFiles.length, (prepared.unread || 0) + (prepared.skippedHeic || 0));
        if (failedCount > 0) {
          this.notify.warning({
            title: "Some photos could not be added",
            message: `${this.stringUtils.pluraliseWithCount(failedCount, "file")} could not be read or opened as a photo. ${prepared.images.length > 0 ? "The readable photos were added." : "No photos were added."}${failedFiles.length ? " Files: " + failedFiles.join(", ") : ""}`,
            continue: true
          });
        }
      } catch (error) {
        this.logger.error("onFileSelectOrDropped failed:", error);
        this.notify.error({title: "Could not add photos", message: error});
      } finally {
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
    if (!this.photosWorking()) {
      this.preparingPhotos = true;
      this.setBusy();
      try {
        await this.compressUnsavedImagesToMaxSize();
        const queuedFiles: File[] = this.unsavedImages()
          .map(item => this.fileUtils.awsFileData(item.originalFileName, item.base64Content, this.fileForBase64Content(item)))
          .map(item => item.file);
        this.queuedFileCount = queuedFiles.length;
        this.uploader.clearQueue();
        this.uploader.addToQueue(queuedFiles);
        this.logger.debug("addedToQueue:", queuedFiles);
        this.uploader.uploadAll();
      } catch (error) {
        this.exitAfterSave = false;
        this.handleResizeError(error as Error);
      } finally {
        this.preparingPhotos = false;
      }
    }
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

  private async downscaleUnsavedImagesForEditing(items: ContentMetadataItem[]): Promise<boolean> {
    this.setBusy();
    try {
      const resizable = (items || []).filter(item => this.fileUtils.isResizableName(item.originalFileName || "") && this.urlService.isBase64Image(item.base64Content));
      for (const [index, item] of resizable.entries()) {
        this.notify.success({title: "Preparing photos", message: `Preparing photo ${index + 1} of ${resizable.length}: ${item.originalFileName}.`});
        await this.prepareImageForEditing(item);
      }
      return true;
    } catch (error) {
      this.handleResizeError(error as Error);
      return false;
    } finally {
      this.clearBusy();
    }
  }

  private async prepareImageForEditing(item: ContentMetadataItem): Promise<void> {
    if (this.fileUtils.isResizableName(item.originalFileName || "")) {
      const updated = await this.fileUtils.downscaleBase64Image(item.base64Content, item.originalFileName, ImageListEditComponent.EDIT_WORKING_MAX_WIDTH);
      if (updated) {
        this.replaceUnsavedImageContent(item, updated);
      }
    }
  }

  private replaceUnsavedImageContent(item: ContentMetadataItem, updated: string): void {
    this.base64Files = this.base64Files.filter(file => file.base64Content !== item.base64Content);
    item.base64Content = updated;
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
    for (const [index, item] of compressible.entries()) {
      this.notify.success({
        title: "Resizing Images",
        message: `Preparing photo ${index + 1} of ${compressible.length}: ${item.originalFileName}. Maximum size ${this.numberUtils.humanFileSize(maxBytes)}.`
      });
      try {
        const updated = await this.fileUtils.resizeBase64Image(item.base64Content, item.originalFileName, maxBytes, 1200);
        if (updated) {
          this.replaceUnsavedImageContent(item, updated);
        }
      } catch (error) {
        throw new Error(`Could not resize photo ${index + 1} of ${compressible.length} (${item.originalFileName}). ${error instanceof Error ? error.message : "Your device could not finish preparing this photo."} Your photos are still unsaved. Try saving again, or add fewer photos at once.`);
      }
    }
  }

  private handleResizeError(error: Error) {
    this.resizeInProgress = false;
    this.progressResponse = null;
    this.clearResizeState();
    this.clearBusy();
    this.logger.error(error);
    this.notify.error({title: "Image Resizing failed", message: error instanceof Error ? error.message : "Your device could not resize the photos. Try adding fewer photos at once.", continue: true});
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
