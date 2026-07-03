import { Component, EventEmitter, HostListener, inject, Input, OnInit, Output } from "@angular/core";
import { faArrowDown, faArrowsUpDown, faArrowUp, faPencil, faRemove } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AwsFileData, DescribedDimensions } from "../../../models/aws-object.model";
import {
  ImageFit,
  ImageType,
  PageContent,
  PageContentColumn,
  PageContentEditEvent,
  PageContentRow,
  PageContentType
} from "../../../models/content-text.model";
import { IconService } from "../../../services/icon-service/icon-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentService } from "../../../services/page-content.service";
import { UrlService } from "../../../services/url.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { YouTubeService } from "../../../services/youtube.service";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { CropperDebugOffsets } from "../../../models/image-cropper.model";
import { CardImageComponent } from "../card/image/card-image";
import { RouterLink } from "@angular/router";
import { ImageCropperAndResizerComponent } from "../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { FormsModule } from "@angular/forms";
import { TypeaheadDirective } from "ngx-bootstrap/typeahead";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ActionsDropdownComponent } from "../actions-dropdown/actions-dropdown";
import { FALLBACK_MEDIA } from "../../../models/walk.model";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { AspectRatioSelectorComponent } from "../../../carousel/edit/aspect-ratio-selector/aspect-ratio-selector";
import { SiteLinkInputComponent } from "../site-link-input/site-link-input";
import { FocalPoint, FocalPointPickerComponent } from "../focal-point-picker/focal-point-picker";
import { ClipboardService } from "../../../services/clipboard.service";
import { FileUtilsService } from "../../../file-utils.service";

@Component({
    selector: "app-card-editor",
  template: `
    <div class="card shadow clickable h-100 mb-4 action-button-card-editor"
         (dragover)="onActionButtonDragOver($event)"
         (drop)="onActionButtonDrop($event)"
         (dragend)="onActionButtonDragEnd()">
      @if (actionButtonControlsVisible()) {
        <div class="action-button-card-controls">
          <button type="button"
                  class="badge-button action-button-card-control"
                  [attr.draggable]="true"
                  tooltip="Drag action button"
                  container="body"
                  (click)="$event.stopPropagation()"
                  (dragstart)="onActionButtonDragStart($event)">
            <fa-icon [icon]="faArrowsUpDown"></fa-icon>
          </button>
          <button type="button"
                  class="badge-button action-button-card-control"
                  [disabled]="!canMoveActionButtonUp()"
                  tooltip="Move action button up"
                  container="body"
                  (click)="moveActionButtonUp($event)">
            <fa-icon [icon]="faArrowUp"></fa-icon>
          </button>
          <button type="button"
                  class="badge-button action-button-card-control"
                  [disabled]="!canMoveActionButtonDown()"
                  tooltip="Move action button down"
                  container="body"
                  (click)="moveActionButtonDown($event)">
            <fa-icon [icon]="faArrowDown"></fa-icon>
          </button>
          <button type="button"
                  class="badge-button action-button-card-control text-danger"
                  tooltip="Delete action button"
                  container="body"
                  (click)="deleteActionButton($event)">
            <fa-icon [icon]="faRemove"></fa-icon>
          </button>
        </div>
      }
      <app-card-image noBorderRadius
        [smallIconContainer]="smallIconContainer"
        [imageType]="imageType"
        [icon]="iconService.iconForName(column?.icon)"
        [aspectRatio]="column?.imageAspectRatio"
        [imageSource]="imageSourceOrPreview()"
        [objectPositionY]="column?.imageVerticalPosition"
        [cropperPosition]="column?.imageCropperPosition"
        [focalPoint]="column?.imageFocalPoint"
        [showBorder]="column?.imageBorder"
        [padding]="column?.imagePadding"
        [imageFit]="column?.imageFit"
        [cropperDebugOffsets]="cropperDebugOffsets"
        [fixedHeight]="actions.isActionButtons(row)"
        [height]="actions.isActionButtons(row) ? (row?.carousel?.coverImageHeight || 200) : null"
        [imageLink]="column?.href"
        [borderRadius]="imageBorderRadius(column)"/>
      <div [class]="columnClass()">
        <h4 class="card-title">
          @if (routerLink) {
            <a class="rams-text-decoration-pink"
               [routerLink]="routerLink"
               target="_self">{{ column?.title }}</a>
          }
          @if (!routerLink) {
            <a class="rams-text-decoration-pink" [href]="column?.href"
               target="_self">{{ column?.title }}</a>
          }
        </h4>
        @if (pageContentEdit?.editActive) {
          <app-image-cropper-and-resizer
            [selectAspectRatio]="column?.imageAspectRatio?.description"
            [preloadImage]="awsFileData?.image || column?.imageSource"
            (imageChange)="imageChanged($event)"
            (quit)="exitImageEdit()"
            (save)="imagedSaved($event)"/>
        }
        @if (siteEditActive()) {
          <div class="form-group">
            <label class="form-label"
                   [for]="idFor('title')">Title</label>
            <input [(ngModel)]="column.title"
                   [id]="idFor('title')"
                   class="form-control input-sm" placeholder="Enter slide title"
                   type="text">
          </div>
          <form class="form-group">
            <label class="form-label"
                   [for]="idFor('href')">Link</label>
            <app-site-link-input cssClass="form-control input-sm"
                                 [inputId]="idFor('href')"
                                 placeholder="Enter href value"
                                 [value]="column.href"
                                 (valueChange)="column.href = $event"/>
          </form>
          <div class="form-group">
            <div class="form-check form-check-inline">
              <input [id]="idFor('use-image')"
                     type="radio"
                     class="form-check-input"
                     [name]="idFor('image-type')"
                     [ngModel]="imageType"
                     (change)="changeToImageType()"
                     value="image"/>
              <label class="form-check-label"
                     [for]="idFor('use-image')">
                Use Image</label>
            </div>
            <div class="form-check form-check-inline">
              <input [id]="idFor('use-icon')"
                     type="radio"
                     [name]="idFor('image-type')"
                     class="form-check-input"
                     [ngModel]="imageType"
                     (change)="changeToIconType()"
                     value="icon"/>
              <label class="form-check-label"
                     [for]="idFor('use-icon')">
                Use Icon</label>
            </div>
          </div>
          @if (imageType === ImageType.ICON) {
            <div class="form-group">
              <label class="form-label"
                     [for]="idFor('icon')">Icon</label>
              <input [(ngModel)]="column.icon"
                     [typeahead]="iconService.iconKeys"
                     [id]="idFor('icon')"
                     class="form-control input-sm" placeholder="Enter icon value">
            </div>
          }
          @if (imageType === ImageType.IMAGE) {
            <div class="form-group">
              <label class="form-label"
                     [for]="idFor('imageSource')">Image Source</label>
              <input [(ngModel)]="column.imageSource"
                     [id]="idFor('imageSource')"
                     class="form-control input-sm" placeholder="Enter image source value"
                     type="text">
            </div>
            @if (imageSourceOrPreview()) {
              <div class="form-group">
                <label class="form-label"
                       [for]="idFor('image-fit')">Image Fit</label>
                <select [ngModel]="imageFit()"
                        (ngModelChange)="onImageFitChanged($event)"
                        [id]="idFor('image-fit')"
                        class="form-control input-sm">
                  <option [ngValue]="ImageFit.COVER">Crop to fill</option>
                  <option [ngValue]="ImageFit.CONTAIN">Show entire image</option>
                </select>
              </div>
              <div class="form-group">
                <div class="form-check form-check-inline">
                  <input [id]="idFor('image-padding')"
                         type="checkbox"
                         class="form-check-input"
                         [checked]="imagePaddingEnabled()"
                         (change)="onImagePaddingChanged($event)">
                  <label class="form-check-label"
                         [for]="idFor('image-padding')">
                    Image padding</label>
                </div>
                <div class="form-check form-check-inline">
                  <input [id]="idFor('image-border')"
                         type="checkbox"
                         class="form-check-input"
                         [(ngModel)]="column.imageBorder">
                  <label class="form-check-label"
                         [for]="idFor('image-border')">
                    Image border</label>
                </div>
              </div>
              @if (imagePaddingEnabled()) {
                <div class="form-group">
                  <label class="form-label"
                         [for]="idFor('image-padding-size')">Padding Size</label>
                  <input [(ngModel)]="column.imagePadding"
                         [id]="idFor('image-padding-size')"
                         min="0"
                         max="48"
                         class="form-control input-sm"
                         type="number">
                </div>
              }
              <div class="form-group">
                <label class="form-label">Focal Point</label>
                <app-focal-point-picker
                  [imageSrc]="imageSourceOrPreview()"
                  [focalPoint]="column.imageFocalPoint || defaultFocalPoint"
                  (focalPointChange)="onFocalPointChange($event)">
                </app-focal-point-picker>
              </div>
            }
            <div class="form-group">
              <div class="form-check form-check-inline mb-0">
                <input [name]="generateUniqueCheckboxId('show-placeholder-image')"
                       type="checkbox" class="form-check-input"
                       [id]="generateUniqueCheckboxId('show-placeholder-image')"
                       [checked]="column?.showPlaceholderImage"
                       (change)="onShowPlaceholderImageChanged($event)">
                <label class="form-check-label"
                       [for]="generateUniqueCheckboxId('show-placeholder-image')">Show Placeholder Image
                </label>
              </div>
            </div>
            @if (column?.showPlaceholderImage) {
              <div class="form-group">
                <app-aspect-ratio-selector
                  label="Image Aspect Ratio"
                  [dimensionsDescription]="column?.imageAspectRatio?.description"
                  (dimensionsChanged)="onImageAspectRatioChanged($event)">
                </app-aspect-ratio-selector>
              </div>
            }
          }
          <div class="form-group">
            <label [for]="idFor('access-level')">Access</label>
            <select [(ngModel)]="column.accessLevel" [id]="idFor('access-level')"
                    class="form-control input-sm">
              @for (accessLevel of memberResourcesReferenceData.accessLevels(); track accessLevel.description) {
                <option
                  [textContent]="accessLevel.description"
                  [ngValue]="accessLevel.id">
                  }
            </select>
          </div>
        }
        <app-markdown-editor [presentationMode]="presentationMode"
                             (changed)="actions.notifyPageContentTextChange($event, column, pageContent)"
                             class="card-text"
                             [text]="column?.contentText"
                             [styles]="column?.styles"
                             [actionCaptionSuffix]="'text'"
                             [category]="pageContent.path"
                             [description]="idFor(pageContent.path)"
                             [name]="actions.rowColFor(rowIndex, columnIndex)">
          @if (!pageContentEdit?.editActive) {
            <div
              (click)="editImage()"
              delay=500 tooltip="edit image" class="badge-button">
              <fa-icon [icon]="faPencil"></fa-icon>
              <span>edit image</span>
            </div>
          }
          <app-actions-dropdown [columnIndex]="columnIndex"
                                [pageContent]="pageContent"
                                [row]="row"/>
        </app-markdown-editor>
      </div>
    </div>
  `,
  styleUrls: ["./../dynamic-content/dynamic-content.sass"],
  styles: [`
    .action-button-card-editor
      position: relative

    .action-button-card-controls
      position: absolute
      top: 8px
      right: 8px
      z-index: 3
      display: flex
      gap: 4px
      flex-wrap: wrap
      justify-content: flex-end

    .action-button-card-control
      width: 32px
      height: 32px
      min-height: 32px
      padding: 0
      display: inline-flex
      align-items: center
      justify-content: center

      &:disabled
        opacity: 0.45
        cursor: not-allowed

    .card-body-styled
      border-bottom-left-radius: 0.375rem
      border-bottom-right-radius: 0.375rem
  `],
  imports: [CardImageComponent, RouterLink, ImageCropperAndResizerComponent, FormsModule, TypeaheadDirective, MarkdownEditorComponent, TooltipDirective, FontAwesomeModule, ActionsDropdownComponent, AspectRatioSelectorComponent, SiteLinkInputComponent, FocalPointPickerComponent]
})
export class CardEditorComponent implements OnInit {

  @Input("presentationMode") set presentationModeValue(presentationMode: boolean) {
    this.presentationMode = coerceBooleanProperty(presentationMode);
  }

  @Input("columnIndex") set columnIndexValue(columnIndex: number) {
    this._columnIndex = columnIndex;
    if (this.pageContentEdit) {
      this.pageContentEdit.columnIndex = columnIndex;
    }
  }

  get columnIndex(): number {
    return this._columnIndex;
  }

  private logger: Logger = inject(LoggerFactory).createLogger("CardEditorComponent", NgxLoggerLevel.ERROR);
  memberResourcesReferenceData = inject(MemberResourcesReferenceDataService);
  iconService = inject(IconService);
  urlService = inject(UrlService);
  siteEditService = inject(SiteEditService);
  pageContentService = inject(PageContentService);
  actions = inject(PageContentActionsService);
  private numberUtils = inject(NumberUtilsService);
  private youtubeService = inject(YouTubeService);
  private clipboardService = inject(ClipboardService);
  private fileUtils = inject(FileUtilsService);

  @Input() public pageContent: PageContent;
  @Input() public column: PageContentColumn;
  @Input() public rowIndex: number;
  private _columnIndex: number;

  @Input() public smallIconContainer: boolean;
  @Input() public cropperDebugOffsets: CropperDebugOffsets = null;
  @Output() pageContentEditEvents: EventEmitter<PageContentEditEvent> = new EventEmitter();
  public presentationMode: boolean;
  public pageContentEdit: PageContentEditEvent;
  public row: PageContentRow;
  public awsFileData: AwsFileData;
  public faPencil: IconDefinition = faPencil;
  public faArrowUp: IconDefinition = faArrowUp;
  public faArrowDown: IconDefinition = faArrowDown;
  public faArrowsUpDown: IconDefinition = faArrowsUpDown;
  public faRemove: IconDefinition = faRemove;
  public imageType: ImageType;
  public routerLink: string;
  private uniqueCheckboxId: string;
  protected readonly PageContentType = PageContentType;

  protected readonly ImageType = ImageType;
  protected readonly ImageFit = ImageFit;
  protected readonly defaultFocalPoint: FocalPoint = { x: 50, y: 50, zoom: 1 };

  columnClass(): string {
    const custom = this.column?.styles?.class;
    if (custom) {
      return ["card-body", "card-body-styled", custom].join(" ");
    } else {
      return "card-body";
    }
  }

  imageBorderRadius(column: PageContentColumn): number | undefined {
    return column?.imageBorderRadius;
  }

  actionButtonControlsVisible(): boolean {
    return this.siteEditActive() && this.actions.isActionButtons(this.row);
  }

  canMoveActionButtonUp(): boolean {
    return this.columnIndex > 0;
  }

  canMoveActionButtonDown(): boolean {
    return this.columnIndex < (this.row?.columns?.length || 0) - 1;
  }

  moveActionButtonUp(event: Event) {
    event.stopPropagation();
    if (this.canMoveActionButtonUp()) {
      this.actions.moveColumnLeft(this.row.columns, this.columnIndex);
    }
  }

  moveActionButtonDown(event: Event) {
    event.stopPropagation();
    if (this.canMoveActionButtonDown()) {
      this.actions.moveColumnRight(this.row.columns, this.columnIndex, this.pageContent);
    }
  }

  deleteActionButton(event: Event) {
    event.stopPropagation();
    this.actions.deleteColumn(this.row, this.columnIndex, this.pageContent);
  }

  onActionButtonDragStart(event: DragEvent) {
    if (this.actionButtonControlsVisible()) {
      event.stopPropagation();
      this.actions.draggedColumnRowIndex = this.rowIndex;
      this.actions.draggedColumnIndex = this.columnIndex;
      this.actions.draggedColumnSourceRow = this.row;
      this.actions.draggedRowIndex = null;
      this.actions.draggedColumnIsNested = false;
      this.actions.draggedColumnParentColumnIndex = null;
      this.actions.dragStartX = event?.clientX;
      this.actions.dragStartY = event?.clientY;
      this.actions.dragHasMovedEvent(event);
    }
  }

  onActionButtonDragOver(event: DragEvent) {
    if (this.actionButtonControlsVisible() && this.actions.draggedColumnSourceRow === this.row) {
      event.preventDefault();
      event.stopPropagation();
      const dx = (event?.clientX || 0) - (this.actions.dragStartX || 0);
      const dy = (event?.clientY || 0) - (this.actions.dragStartY || 0);
      if (!this.actions.dragHasMoved && (Math.abs(dx) + Math.abs(dy) > 3)) {
        this.actions.dragHasMoved = true;
      }
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const y = event.clientY - rect.top;
      this.actions.dragOverColumnRowIndex = this.rowIndex;
      this.actions.dragOverColumnIndex = this.columnIndex;
      this.actions.dragInsertAfter = y > rect.height / 2;
    }
  }

  onActionButtonDrop(event: DragEvent) {
    if (this.actionButtonControlsVisible() && this.actions.draggedColumnSourceRow === this.row) {
      event.preventDefault();
      event.stopPropagation();
      const sourceColumnIndex = this.actions.draggedColumnIndex;
      if (sourceColumnIndex !== null) {
        this.actions.moveColumnWithinRow(this.row.columns, sourceColumnIndex, this.columnIndex, this.actions.dragInsertAfter);
      }
      this.actions.clearColumnDragState();
    }
  }

  onActionButtonDragEnd() {
    if (this.actions.draggedColumnSourceRow === this.row) {
      this.actions.clearColumnDragState();
    }
  }

  ngOnInit() {
    this.uniqueCheckboxId = `card-editor-${this.numberUtils.generateUid()}`;
    this.row = this.pageContent.rows[this.rowIndex];
    const initialColumnIndex = this._columnIndex;
    this.row.columns.indexOf(this.column);
    this._columnIndex = initialColumnIndex;
    this.imageType = (this.column?.imageSource || this.column?.showPlaceholderImage) ? ImageType.IMAGE : ImageType.ICON;
    this.pageContentEdit = {
      path: this.pageContent.path,
      columnIndex: initialColumnIndex,
      rowIndex: this.rowIndex,
      editActive: false
    };
    this.routerLink = this.urlService.routerLinkUrl(this.column?.href);
    this.logger.debug("ngOnInit:column", this.column, "this.row:", this.row, "this.imageType:", this.imageType, "pageContentEdit:", this.pageContentEdit, "content path:", this.pageContent.path);
  }

  generateUniqueCheckboxId(suffix: string): string {
    return `${this.uniqueCheckboxId}-${suffix}`;
  }

  idFor(name?: string) {
    return this.actions.rowColumnIdentifierFor(this.rowIndex, this.columnIndex, this.pageContent.path + (name ? ("-" + name) : ""));
  }

  imageSourceOrPreview(): string {
    const actualImage = this.awsFileData?.image || this.column?.imageSource;
    if (this.column?.showPlaceholderImage && !this.column?.imageSource && !this.column?.youtubeId) {
      return FALLBACK_MEDIA.url;
    } else if (this.column?.youtubeId && !actualImage) {
      return this.youtubeService.thumbnailUrl(this.column?.youtubeId);
    } else {
      return actualImage;
    }
  }

  onShowPlaceholderImageChanged(event: Event) {
    const target = event.target as HTMLInputElement;
    this.column.showPlaceholderImage = target.checked;
    if (target.checked && !this.column?.imageAspectRatio) {
      this.column.imageAspectRatio = {
        width: 16,
        height: 9,
        description: "16:9 (Landscape)"
      };
    }
  }

  onImageAspectRatioChanged(dimensions: DescribedDimensions) {
    this.column.imageAspectRatio = dimensions;
  }

  imageFit(): ImageFit {
    return this.column?.imageFit || ImageFit.COVER;
  }

  onImageFitChanged(imageFit: ImageFit) {
    this.column.imageFit = imageFit;
  }

  imagePaddingEnabled(): boolean {
    return (this.column?.imagePadding || 0) > 0;
  }

  onImagePaddingChanged(event: Event) {
    const target = event.target as HTMLInputElement;
    this.column.imagePadding = target.checked ? (this.column.imagePadding || 16) : 0;
  }

  onFocalPointChange(focalPoint: FocalPoint) {
    this.column.imageFocalPoint = focalPoint || null;
  }

  @HostListener("paste", ["$event"])
  async onPaste(event: ClipboardEvent) {
    if (this.siteEditActive()) {
      const file = this.clipboardService.imageFileFromPasteEvent(event);
      if (file) {
        event.preventDefault();
        const base64File = await this.fileUtils.loadBase64ImageFromFile(file);
        this.awsFileData = this.fileUtils.awsFileData(file.name, base64File.base64Content, file);
        this.imageType = ImageType.IMAGE;
        this.column.icon = null;
        this.pageContentEdit.editActive = true;
        this.logAndSendEvent();
      }
    }
  }

  imageChanged(awsFileData: AwsFileData) {
    this.logger.info("imageChanged:", awsFileData);
    this.awsFileData = awsFileData;
  }

  exitImageEdit() {
    this.pageContentEdit.editActive = false;
    this.logAndSendEvent();
    this.awsFileData = null;
  }

  private logAndSendEvent() {
    this.logger.info("sending pageContentEditEvent:", this.pageContentEdit);
    this.pageContentEditEvents.next(this.pageContentEdit);
  }

  editImage() {
    this.pageContentEdit.editActive = true;
    this.logAndSendEvent();
  }

  imagedSaved(awsFileData: AwsFileData) {
    const imageSource = awsFileData.awsFileName;
    this.logger.info("imagedSaved:", awsFileData, "setting imageSource for column", this.column, "to", imageSource);
    this.column.imageSource = imageSource;
    this.imageType = ImageType.IMAGE;
    this.exitImageEdit();
  }

  changeToImageType() {
    this.changeImageType(ImageType.IMAGE);
  }

  changeToIconType() {
    this.changeImageType(ImageType.ICON);
  }

  changeImageType(value: ImageType) {
    this.imageType = value;
    this.logger.info("changeImageType:", value);
    if (value === ImageType.IMAGE) {
      this.column.icon = null;
    } else {
      this.column.imageSource = null;
      this.column.imageFocalPoint = null;
    }
  }

  siteEditActive() {
    if (this.presentationMode) {
      return false;
    } else {
      return this.siteEditService.active();
    }
  }
}
