import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AwsFileData } from "../../../models/aws-object.model";
import {
  ImageType,
  PageContent,
  PageContentColumn,
  PageContentEditEvent,
  PageContentRow
} from "../../../models/content-text.model";
import { IconService } from "../../../services/icon-service/icon-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentService } from "../../../services/page-content.service";
import { UrlService } from "../../../services/url.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEventType } from "../../../models/broadcast.model";
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

@Component({
    selector: "app-card-editor",
    templateUrl: "./card-editor.html",
    styleUrls: ["./card-editor.sass", "./../dynamic-content/dynamic-content.sass"],
    imports: [CardImageComponent, RouterLink, ImageCropperAndResizerComponent, FormsModule, TypeaheadDirective, MarkdownEditorComponent, TooltipDirective, FontAwesomeModule, ActionsDropdownComponent]
})
export class CardEditorComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("CardEditorComponent", NgxLoggerLevel.ERROR);
  memberResourcesReferenceData = inject(MemberResourcesReferenceDataService);
  iconService = inject(IconService);
  urlService = inject(UrlService);
  siteEditService = inject(SiteEditService);
  pageContentService = inject(PageContentService);
  actions = inject(PageContentActionsService);
  private broadcastService = inject<BroadcastService<number>>(BroadcastService);

  @Output() pageContentEditEvents: EventEmitter<PageContentEditEvent> = new EventEmitter();
  @Input()
  public pageContent: PageContent;
  @Input()
  public column: PageContentColumn;
  @Input()
  public rowIndex: number;
  @Input()
  public smallIconContainer: boolean;
  public presentationMode: boolean;

  @Input("presentationMode") set presentationModeValue(presentationMode: boolean) {
    this.presentationMode = coerceBooleanProperty(presentationMode);
  }
  public pageContentEdit: PageContentEditEvent;
  public row: PageContentRow;
  public awsFileData: AwsFileData;
  public faPencil: IconDefinition = faPencil;
  public imageType: ImageType;
  public columnIndex: number;
  public routerLink: string;

  ngOnInit() {
    this.row = this.pageContent.rows[this.rowIndex];
    this.columnIndex = this.row.columns.indexOf(this.column);
    this.imageType = this.column.imageSource ? ImageType.IMAGE : ImageType.ICON;
    this.pageContentEdit = {
      path: this.pageContent.path,
      columnIndex: this.columnIndex,
      rowIndex: this.rowIndex,
      editActive: false
    };
    this.routerLink = this.urlService.routerLinkUrl(this.column.href);
    this.logger.debug("ngOnInit:column", this.column, "this.row:", this.row, "this.imageType:", this.imageType, "pageContentEdit:", this.pageContentEdit, "content path:", this.pageContent.path);
    this.broadcastService.on(NamedEventType.PAGE_CONTENT_CHANGED, (pageContentData) => {
      this.logger.info("received:", pageContentData);
      this.columnIndexChanged();
    });
  }

  idFor(name?: string) {
    return this.actions.rowColumnIdentifierFor(this.rowIndex, this.columnIndex, this.pageContent.path + (name ? ("-" + name) : ""));
  }

  imageSourceOrPreview(): string {
    return this.awsFileData?.image || this.column?.imageSource;
  }

  columnIndexChanged() {
    const oldIndex = this.columnIndex;
    const newIndex = this.row.columns.indexOf(this.column);
    if (oldIndex !== newIndex) {
      this.columnIndex = newIndex;
      this.pageContentEdit.columnIndex = this.columnIndex;
      this.logger.info("columnIndexChanged from:", oldIndex, "to:", this.columnIndex);
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

