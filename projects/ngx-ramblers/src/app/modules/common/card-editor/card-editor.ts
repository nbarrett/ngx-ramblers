import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AwsFileData, DescribedDimensions } from "../../../models/aws-object.model";
import {
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

@Component({
    selector: "app-card-editor",
  template: `
    <div class="card shadow clickable h-100 mb-4">
      <app-card-image noBorderRadius
        [smallIconContainer]="smallIconContainer"
        [imageType]="imageType"
        [icon]="iconService.iconForName(column.icon)"
        [aspectRatio]="column?.imageAspectRatio"
        [imageSource]="imageSourceOrPreview()"
        [fixedHeight]="actions.isActionButtons(row)"
        [height]="actions.isActionButtons(row) ? (row?.carousel?.coverImageHeight || 200) : null"
        [imageLink]="column.href"
        [borderRadius]="imageBorderRadius(column)"/>
      <div [class]="columnClass()">
        <h4 class="card-title">
          @if (routerLink) {
            <a class="rams-text-decoration-pink"
               [routerLink]="routerLink"
               target="_self">{{ column.title }}</a>
          }
          @if (!routerLink) {
            <a class="rams-text-decoration-pink" [href]="column.href"
               target="_self">{{ column.title }}</a>
          }
        </h4>
        @if (pageContentEdit?.editActive) {
          <app-image-cropper-and-resizer
            [selectAspectRatio]="column?.imageAspectRatio?.description"
            [preloadImage]="column?.imageSource"
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
            <input [(ngModel)]="column.href"
                   name="href"
                   autocomplete="nope"
                   (blur)="reformatHref($event)"
                   [typeahead]="pageContentService.siteLinks"
                   [id]="idFor('href')"
                   class="form-control input-sm" placeholder="Enter href value">
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
            <div class="form-group">
              <div class="form-check form-check-inline mb-0">
                <input [name]="generateUniqueCheckboxId('show-placeholder-image')"
                       type="checkbox" class="form-check-input"
                       [id]="generateUniqueCheckboxId('show-placeholder-image')"
                       [checked]="column.showPlaceholderImage"
                       (change)="onShowPlaceholderImageChanged($event)">
                <label class="form-check-label"
                       [for]="generateUniqueCheckboxId('show-placeholder-image')">Show Placeholder Image
                </label>
              </div>
            </div>
            @if (column.showPlaceholderImage) {
              <div class="form-group">
                <app-aspect-ratio-selector
                  label="Image Aspect Ratio"
                  [dimensionsDescription]="column.imageAspectRatio?.description"
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
    .card-body-styled
      border-bottom-left-radius: 0.375rem
      border-bottom-right-radius: 0.375rem
  `],
  imports: [CardImageComponent, RouterLink, ImageCropperAndResizerComponent, FormsModule, TypeaheadDirective, MarkdownEditorComponent, TooltipDirective, FontAwesomeModule, ActionsDropdownComponent, AspectRatioSelectorComponent]
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

  @Input() public pageContent: PageContent;
  @Input() public column: PageContentColumn;
  @Input() public rowIndex: number;
  private _columnIndex: number;

  @Input() public smallIconContainer: boolean;
  @Output() pageContentEditEvents: EventEmitter<PageContentEditEvent> = new EventEmitter();
  public presentationMode: boolean;
  public pageContentEdit: PageContentEditEvent;
  public row: PageContentRow;
  public awsFileData: AwsFileData;
  public faPencil: IconDefinition = faPencil;
  public imageType: ImageType;
  public routerLink: string;
  private uniqueCheckboxId: string;
  protected readonly PageContentType = PageContentType;

  protected readonly ImageType = ImageType;

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

  ngOnInit() {
    this.uniqueCheckboxId = `card-editor-${this.numberUtils.generateUid()}`;
    this.row = this.pageContent.rows[this.rowIndex];
    const initialColumnIndex = this._columnIndex;
    this.row.columns.indexOf(this.column);
    this._columnIndex = initialColumnIndex;
    this.imageType = (this.column.imageSource || this.column.showPlaceholderImage) ? ImageType.IMAGE : ImageType.ICON;
    this.pageContentEdit = {
      path: this.pageContent.path,
      columnIndex: initialColumnIndex,
      rowIndex: this.rowIndex,
      editActive: false
    };
    this.routerLink = this.urlService.routerLinkUrl(this.column.href);
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
      return this.youtubeService.thumbnailUrl(this.column.youtubeId);
    } else {
      return actualImage;
    }
  }

  onShowPlaceholderImageChanged(event: Event) {
    const target = event.target as HTMLInputElement;
    this.column.showPlaceholderImage = target.checked;
    if (target.checked && !this.column.imageAspectRatio) {
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
    if (value === "image") {
      this.column.icon = null;
    } else {
      this.column.imageSource = null;
    }
  }

  reformatHref($event: any) {
    this.logger.info("reformat:", $event, "this.column.href", this.column.href);
    this.column.href = this.urlService.reformatLocalHref(this.column.href);
  }

  siteEditActive() {
    if (this.presentationMode) {
      return false;
    } else {
      return this.siteEditService.active();
    }
  }
}
