import { Component, Input, OnInit } from "@angular/core";
import { faAdd, faPencil } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AwsFileData } from "../../../models/aws-object.model";
import {
  EditorInstanceState,
  PageContent,
  PageContentColumn,
  PageContentEditEvent,
  PageContentRow,
  View
} from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentEditService } from "../../../services/page-content-edit.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MarkdownEditorFocusService } from "../../../services/markdown-editor-focus-service";

@Component({
  selector: "app-dynamic-content-site-edit-text-row",
  templateUrl: "./dynamic-content-site-edit-text-row.html",
  styleUrls: ["./dynamic-content.sass"],
})
export class DynamicContentSiteEditTextRowComponent implements OnInit {
  @Input()
  public row: PageContentRow;
  @Input()
  public parentRowIndex: number;
  @Input()
  public rowIndex: number;
  @Input()
  public contentDescription: string;
  @Input()
  public contentPath: string;
  @Input()
  public pageContent: PageContent;
  private logger: Logger;
  faPencil = faPencil;
  faAdd = faAdd;
  public pageContentEditEvents: PageContentEditEvent[] = [];
  private lastFocussedMarkdownEditor: object;

  constructor(
    public pageContentEditService: PageContentEditService,
    private markdownEditorFocusService: MarkdownEditorFocusService,
    public memberResourcesReferenceData: MemberResourcesReferenceDataService,
    public stringUtils: StringUtilsService,
    public actions: PageContentActionsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(DynamicContentSiteEditTextRowComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
  }

  imageSource(rowIndex: number, columnIndex: number, imageSource: string) {
    return this.pageContentEditService.eventMatching(this.pageContentEditEvents, {path: this.pageContent.path, rowIndex, columnIndex})?.image || imageSource;
  }

  editImage(rowIndex: number, columnIndex: number) {
    this.pageContentEditEvents = this.pageContentEditService.handleEvent({path: this.pageContent.path, rowIndex, columnIndex, editActive: true}, this.pageContentEditEvents);
  }

  imageChanged(rowIndex: number, columnIndex: number, awsFileData: AwsFileData) {
    this.logger.info("imageChanged:", awsFileData);
    this.pageContentEditEvents = this.pageContentEditService.handleEvent({
      path: this.pageContent.path,
      rowIndex,
      columnIndex,
      editActive: true,
      image: awsFileData.image
    }, this.pageContentEditEvents);
  }

  editActive(rowIndex: number, columnIndex: number): boolean {
    const editActive = this.pageContentEditService.eventMatching(this.pageContentEditEvents, {columnIndex, rowIndex, path: this.pageContent.path})?.editActive;
    this.logger.debug("editActive:rowIndex:", rowIndex, "columnIndex:", columnIndex, "pageContentEditEvents:", this.pageContentEditEvents, "->", editActive);
    return editActive;
  }

  exitImageEdit(rowIndex: number, columnIndex: number) {
    this.logger.info("exitImageEdit:rowIndex:", rowIndex, "columnIndex:", columnIndex);
    this.pageContentEditEvents = this.pageContentEditService.handleEvent({path: this.pageContent.path, rowIndex, columnIndex, editActive: false}, this.pageContentEditEvents);
  }

  imagedSaved(rowIndex: number, columnIndex: number, column: PageContentColumn, awsFileData: AwsFileData) {
    this.logger.info("imagedSaved:", awsFileData, "setting imageSource for column", column, "to", awsFileData.awsFileName);
    column.imageSource = awsFileData.awsFileName;
    this.pageContentEditEvents = this.pageContentEditService.handleEvent({
      path: this.pageContent.path,
      rowIndex,
      columnIndex,
      editActive: false
    }, this.pageContentEditEvents);
  }

  imagePropertyColumnClasses(column: PageContentColumn) {
    return column.columns <= 6 ? "col-sm-12" : "col-sm-12 col-xl-6";
  }

  focusSensitiveColumns(pageContentColumn: PageContentColumn) {
    const hasFocus = this.markdownEditorFocusService.hasFocus(this.lastFocussedMarkdownEditor);
    this.logger.debug("focusSensitiveColumns:hasFocus:", hasFocus, "pageContentColumn:", pageContentColumn);
    return hasFocus ? 12 : (pageContentColumn?.columns || 12);
  }

  markdownEditorFocusChange(editorInstanceState: EditorInstanceState) {
    this.logger.info("markdownEditorFocusChange:editorInstanceState:", editorInstanceState);
    this.lastFocussedMarkdownEditor = editorInstanceState.view === View.VIEW ? null : editorInstanceState.instance;
  }
}
