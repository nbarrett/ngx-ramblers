import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
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
import { BroadcastService } from "../../../services/broadcast-service";
import { IconService } from "../../../services/icon-service/icon-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentService } from "../../../services/page-content.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";

@Component({
  selector: "app-card-editor",
  templateUrl: "./card-editor.html",
  styleUrls: ["./card-editor.sass"]
})
export class CardEditorComponent implements OnInit {
  @Output() pageContentEditEvents: EventEmitter<PageContentEditEvent> = new EventEmitter();
  @Input()
  public pageContent: PageContent;
  @Input()
  public column: PageContentColumn;
  @Input()
  public rowIndex: number;
  @Input()
  public smallIconContainer: boolean;
  public pageContentEdit: PageContentEditEvent;
  public row: PageContentRow;
  public awsFileData: AwsFileData;
  private logger: Logger;
  public faPencil = faPencil;
  public imageType: ImageType;
  public columnIndex: number;

  constructor(
    public memberResourcesReferenceData: MemberResourcesReferenceDataService,
    public iconService: IconService,
    private urlService: UrlService,
    private pageService: PageService,
    private stringUtils: StringUtilsService,
    public siteEditService: SiteEditService,
    public pageContentService: PageContentService,
    public actions: PageContentActionsService,
    private broadcastService: BroadcastService<PageContent>,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CardEditorComponent, NgxLoggerLevel.INFO);
  }

  ngOnInit() {
    this.row = this.pageContent.rows[this.rowIndex];
    this.columnIndex = this.row.columns.indexOf(this.column);
    this.imageType = this.column.imageSource ? ImageType.IMAGE : ImageType.ICON;
    this.pageContentEdit = {path: this.pageContent.path, columnIndex: this.columnIndex, rowIndex: this.rowIndex, editActive: false};
    this.logger.debug("ngOnInit:column", this.column, "this.row:", this.row, "this.imageType:", this.imageType, "pageContentEdit:", this.pageContentEdit, "content path:", this.pageContent.path);
  }

  idFor(name?: string) {
    return this.actions.columnIdentifierFor(this.columnIndex, this.pageContent.path + (name ? ("-" + name) : ""));
  }

  imageSourceOrPreview(): string {
    return this.awsFileData?.image || this.column?.imageSource;
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
    this.column.href = this.urlService.reformatHref(this.column.href);
  }
}

