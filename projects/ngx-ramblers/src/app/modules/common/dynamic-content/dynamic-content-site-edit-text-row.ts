import { Component, inject, Input, OnInit } from "@angular/core";
import {
  faAdd,
  faArrowDown,
  faArrowUp,
  faMagnifyingGlass,
  faPencil,
  faRemove
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AwsFileData, DescribedDimensions } from "../../../models/aws-object.model";
import {
  EditorInstanceState,
  FragmentWithLabel,
  PageContent,
  PageContentColumn,
  PageContentEditEvent,
  PageContentRow,
  SplitEvent
} from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentEditService } from "../../../services/page-content-edit.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { HtmlPasteResult, HtmlPasteRow } from "../../../models/html-paste.model";
import { FormsModule } from "@angular/forms";
import { ColumnWidthComponent } from "./column-width";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { ActionsDropdownComponent } from "../actions-dropdown/actions-dropdown";
import { ImageCropperAndResizerComponent } from "../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { CardImageComponent } from "../card/image/card-image";
import { NgClass } from "@angular/common";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { MarginSelectComponent } from "./dynamic-content-margin-select";
import { FALLBACK_MEDIA } from "../../../models/walk.model";
import { AspectRatioSelectorComponent } from "../../../carousel/edit/aspect-ratio-selector/aspect-ratio-selector";
import { ImageActionsDropdownComponent } from "./image-actions-dropdown";
import { isUndefined } from "es-toolkit/compat";
import { FileUtilsService } from "../../../file-utils.service";
import { RowTypeSelectorComponent } from "./row-type-selector";
import { FragmentService } from "../../../services/fragment.service";
import { FragmentSelectorComponent } from "./fragment-selector.component";
import { DynamicContentViewComponent } from "./dynamic-content-view";

@Component({
    selector: "app-dynamic-content-site-edit-text-row",
    template: `
      @if (actions.isTextRow(row)) {
        <div [class]="actions.rowClasses(row)">
          @for (column of row?.columns; let columnIndex = $index; track columnIndex) {
            <div
              [class]="'col-sm-' + (focusSensitiveColumns(column))">
              <!-- beginning of row content editing-->
              @if (!column.rows) {
                <div class="thumbnail-site-edit h-100 mt-2" (dragover)="onColumnDragOver($event, rowIndex, columnIndex)"
                     (drop)="onColumnDrop($event, rowIndex, columnIndex)">
                  <div class="thumbnail-heading" [attr.draggable]="true"
                       (dragstart)="onColumnDragStart($event, rowIndex, columnIndex)"
                       [tooltip]="columnDragTooltip(rowIndex, columnIndex)"
                       [isOpen]="!!columnDragTooltip(rowIndex, columnIndex)" container="body" triggers="">
                    Col {{ columnIndex + 1 }}
                    <app-badge-button noRightMargin class="ms-2"
                                      (click)="toggleAll(column, markdownEditorComponent)"
                                      [icon]="controlsShown(column) ? faMagnifyingGlass : faPencil"
                                      [caption]="controlsShown(column) ? 'view' : 'Edit'"/>
                    <app-badge-button noRightMargin class="ms-2"
                                      (click)="actions.deleteColumn(row, columnIndex, pageContent)"
                                      [icon]="faRemove"
                                      [tooltip]="'Delete column'"/>
                    @if (controlsShown(column) && !isNarrow(column) && canJoinWithPreviousRow()) {
                      <app-badge-button noRightMargin class="ms-2"
                                        (click)="joinWithPreviousRow()"
                                        [icon]="faArrowUp"
                                        [tooltip]="'Join with row above'"/>
                    }
                    @if (controlsShown(column) && !isNarrow(column) && canJoinWithNextRow()) {
                      <app-badge-button noRightMargin class="ms-2"
                                        (click)="joinWithNextRow()"
                                        [icon]="faArrowDown"
                                        [tooltip]="'Join with row below'"/>
                    }
                    @if (controlsShown(column) && !isNarrow(column)) {
                      <span class="ms-2 d-inline-flex align-items-center gap-2">
                        <app-image-actions-dropdown [fullWidth]="false" [hasImage]="!!column.imageSource"
                                                    (edit)="editImage(rowIndex, columnIndex)"
                                                    (replace)="replaceImage(column, rowIndex, columnIndex)"
                                                    (remove)="removeImage(column)"/>
                        <app-actions-dropdown [columnIndex]="columnIndex" [rowIndex]="rowIndex"
                                              [pageContent]="pageContent" [column]="column" [row]="row"
                                              [fullWidth]="false" [showRowActions]="false"/>
                      </span>
                    }
                  </div>
                  @if (editActive(rowIndex, columnIndex)) {
                    <div class="mt-2">
                      <app-image-cropper-and-resizer
                        (quit)="exitImageEdit(rowIndex, columnIndex)"
                        (imageChange)="imageChanged(rowIndex, columnIndex, $event)"
                        (save)="imagedSaved(rowIndex, columnIndex, column, $event)"
                        [preloadImage]="imageSource(rowIndex, columnIndex, column?.imageSource)"
                        wrapButtons>
                      </app-image-cropper-and-resizer>
                    </div>
                  }
                  <div class="d-flex gap-2 align-items-stretch" [ngClass]="'flex-column'">
                    @if (showImageBeforeText(rowIndex, columnIndex, column) || showPlaceholderAboveText(rowIndex, columnIndex, column)) {
                      <div>
                        <app-card-image class="w-100"
                                        [borderRadius]="column?.imageBorderRadius"
                                        [aspectRatio]="column?.imageAspectRatio"
                                        [alt]="column?.alt"
                                        unconstrainedHeight
                                        [imageSource]="imageSourceFor(rowIndex, columnIndex, column)"/>
                      </div>
                    }
                    <app-markdown-editor #markdownEditorComponent class="flex-grow-1 w-100"
                                         (changed)="actions.notifyPageContentTextChange($event, column, pageContent)"
                                         (focusChange)="onEditorFocusChange($event, column)"
                                         (split)="onSplit($event, rowIndex, columnIndex)"
                                         (htmlPaste)="onHtmlPaste($event, rowIndex, columnIndex)" allowMaximise hideEditToggle
                                         [presentationMode]="!controlsShown(column)"
                                         [description]="actions.rowColumnIdentifierFor(rowIndex, columnIndex, contentDescription)"
                                         [text]="column?.contentText"
                                         [styles]="column?.styles"
                                         [parentRowColumnCount]="row.columns?.length"
                                         [initialView]="actions.view()"
                                         [name]="actions.parentRowColFor(parentRowIndex, rowIndex, columnIndex)"
                                         [category]="contentPath">
                      <ng-container prepend/>
                    </app-markdown-editor>
                    @if (showImageAfterText(rowIndex, columnIndex, column) || showPlaceholderBelowText(rowIndex, columnIndex, column)) {
                      <div>
                        <app-card-image class="w-100"
                                        [borderRadius]="column?.imageBorderRadius"
                                        [aspectRatio]="column?.imageAspectRatio"
                                        [alt]="column?.alt"
                                        unconstrainedHeight
                                        [imageSource]="imageSourceFor(rowIndex, columnIndex, column)"/>
                      </div>
                    }
                  </div>
                  @if (controlsShown(column)) {
                    <div class="form-group mt-2">
                      <div class="form-check form-check-inline mb-0 me-4">
                        <input [name]="getUniqueCheckboxId('show-text-after-image')"
                               type="checkbox" class="form-check-input"
                               [id]="getUniqueCheckboxId('show-text-after-image')"
                               [(ngModel)]="column.showTextAfterImage">
                        <label class="form-check-label" [for]="getUniqueCheckboxId('show-text-after-image')">Text After
                          Image</label>
                      </div>
                      @if (!column.imageSource && !isNarrow(column)) {
                        <div class="form-check form-check-inline mb-0">
                          <input [name]="getUniqueCheckboxId('show-placeholder-image')" type="checkbox"
                                 class="form-check-input"
                                 [id]="getUniqueCheckboxId('show-placeholder-image')"
                                 [checked]="column.showPlaceholderImage"
                                 (change)="onShowPlaceholderImageChanged($event, column)">
                          <label class="form-check-label" [for]="getUniqueCheckboxId('show-placeholder-image')">Show
                            Placeholder Image</label>
                        </div>
                      }
                    </div>
                  }

                  <!-- Editable properties; hidden when controls are off -->
                  @if (controlsShown(column)) {
                    @if (isNarrow(column)) {
                      <div class="row mt-2">
                        <div class="col-sm-12">
                          <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'name')">Image
                            Source</label>
                          <input [(ngModel)]="column.imageSource"
                                 (paste)="onImageSourcePaste($event, rowIndex, columnIndex)"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'name')"
                                 type="text" class="form-control">
                        </div>
                        <div class="col-sm-12">
                          <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-alt')">Alt
                            Text</label>
                          <input [(ngModel)]="column.alt"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-alt')"
                                 type="text" class="form-control"
                                 placeholder="Describe image for accessibility">
                        </div>
                        <div class="col-sm-12">
                          <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-border-radius')">Border
                            Radius</label>
                          <input [(ngModel)]="column.imageBorderRadius"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-border-radius')"
                                 type="number" class="form-control">
                        </div>
                      </div>
                    } @else {
                      <div class="row mt-2">
                        <div class="col-12">
                          <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'name')">Image
                            Source</label>
                          <input [(ngModel)]="column.imageSource"
                                 (paste)="onImageSourcePaste($event, rowIndex, columnIndex)"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'name')"
                                 type="text" class="form-control">
                        </div>
                      </div>
                      <div class="row mt-2">
                        <div class="col">
                          <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-alt')">Alt
                            Text</label>
                          <input [(ngModel)]="column.alt"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-alt')"
                                 type="text" class="form-control"
                                 placeholder="Describe image for accessibility">
                        </div>
                        <div class="col-auto">
                          <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-border-radius')">Border
                            Radius</label>
                          <input [(ngModel)]="column.imageBorderRadius"
                                 [id]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-border-radius')"
                                 type="number" class="form-control" style="max-width: 140px;">
                        </div>
                      </div>
                    }
                  }
                  @if (controlsShown(column)) {
                    @if (!column.imageSource && isNarrow(column)) {
                      <div class="form-group">
                        <div class="form-check form-check-inline mb-0 me-4">
                          <input [name]="getUniqueCheckboxId('show-placeholder-image')" type="checkbox"
                                 class="form-check-input"
                                 [id]="getUniqueCheckboxId('show-placeholder-image')"
                                 [checked]="column.showPlaceholderImage"
                                 (change)="onShowPlaceholderImageChanged($event, column)">
                          <label class="form-check-label" [for]="getUniqueCheckboxId('show-placeholder-image')">Show
                            Placeholder Image</label>
                        </div>
                      </div>
                    }
                    @if (column.showPlaceholderImage && !column.imageSource) {
                      <div class="form-group">
                        <app-aspect-ratio-selector label="Image Aspect Ratio"
                                                   [dimensionsDescription]="column.imageAspectRatio?.description"
                                                   (dimensionsChanged)="onImageAspectRatioChanged(column, $event)"></app-aspect-ratio-selector>
                      </div>
                    }
                    @if (isNarrow(column)) {
                      <div class="d-flex gap-2 mt-2" [ngClass]="'flex-column'">
                        <div class="w-100">
                          <app-image-actions-dropdown [fullWidth]="true" [hasImage]="!!column.imageSource"
                                                      (edit)="editImage(rowIndex, columnIndex)"
                                                      (replace)="replaceImage(column, rowIndex, columnIndex)"
                                                      (remove)="removeImage(column)"/>
                        </div>
                        <div class="w-100">
                          <app-actions-dropdown [columnIndex]="columnIndex" [rowIndex]="rowIndex"
                                                [pageContent]="pageContent" [column]="column" [row]="row"
                                                [fullWidth]="true" [showRowActions]="false"/>
                        </div>
                      </div>
                    }
                    @if (isNarrow(column)) {
                      <div class="form-group mt-2">
                        <app-column-width [column]="column" (expandToggle)="expanded=$event"/>
                      </div>
                      <div class="form-group">
                        <label
                          [for]="actions.rowColumnIdentifierFor(rowIndex, columnIndex, 'access-level-' + contentPath)">Access</label>
                        <select [(ngModel)]="column.accessLevel"
                                [id]="actions.rowColumnIdentifierFor(rowIndex, columnIndex, 'access-level-' + contentPath)"
                                class="form-control input-sm">
                          @for (accessLevel of memberResourcesReferenceData.accessLevels(); track accessLevel.description) {
                            <option [textContent]="accessLevel.description" [ngValue]="accessLevel.id"></option>
                          }
                        </select>
                      </div>
                    } @else {
                      <div class="row g-2 mt-2 align-items-end">
                        <div class="col-auto">
                          <app-column-width [column]="column" (expandToggle)="expanded=$event"/>
                        </div>
                        <div class="col">
                          <label
                            [for]="actions.rowColumnIdentifierFor(rowIndex, columnIndex, 'access-level-' + contentPath)">Access</label>
                          <select [(ngModel)]="column.accessLevel"
                                  [id]="actions.rowColumnIdentifierFor(rowIndex, columnIndex, 'access-level-' + contentPath)"
                                  class="form-control input-sm">
                            @for (accessLevel of memberResourcesReferenceData.accessLevels(); track accessLevel.description) {
                              <option [textContent]="accessLevel.description" [ngValue]="accessLevel.id"></option>
                            }
                          </select>
                        </div>
                      </div>
                    }
                  }
                </div>
              }
              <!-- end of row content editing-->
              <!-- start of column nested rows-->
              @if (column.rows) {
                <div class="thumbnail-site-edit" (dragover)="onColumnDragOver($event, rowIndex, columnIndex)"
                     (drop)="onColumnDrop($event, rowIndex, columnIndex)">
                  <div class="thumbnail-heading" [attr.draggable]="true"
                       (dragstart)="onColumnDragStart($event, rowIndex, columnIndex)"
                       [tooltip]="columnDragTooltip(rowIndex, columnIndex)"
                       [isOpen]="!!columnDragTooltip(rowIndex, columnIndex)" container="body" triggers="">
                    Row {{ rowIndex + 1 }} column {{ columnIndex + 1 }}
                    ({{ stringUtils.pluraliseWithCount(column.rows?.length, 'nested row') }})
                  </div>
                  <div class="row align-items-end">
                    <div class="col-auto">
                      <app-actions-dropdown [pageContent]="pageContent"
                                            [columnIndex]="columnIndex"
                                            [row]="row"
                                            [column]="column"/>
                    </div>
                    <div class="col">
                      <app-column-width [column]="column" (expandToggle)="expanded=$event"/>
                    </div>
                  </div>
                  @for (nestedRow of column.rows; track nestedRow; let nestedRowIndex = $index) {
                    <div class="thumbnail-site-edit mt-3"
                         (dragover)="onNestedRowDragOver(columnIndex, nestedRowIndex, $event)"
                         (drop)="onNestedRowDrop(columnIndex, nestedRowIndex)">
                      <div class="thumbnail-heading" [attr.draggable]="true"
                           (dragstart)="onNestedRowDragStart(columnIndex, nestedRowIndex)"
                           (dragend)="onNestedRowDragEnd()"
                           [tooltip]="nestedRowDragTooltip(columnIndex, nestedRowIndex)"
                           [isOpen]="!!nestedRowDragTooltip(columnIndex, nestedRowIndex)" container="body" triggers="">
                        Row {{ rowIndex + 1 }} (nested row {{ nestedRowIndex + 1 }}
                        column {{ columnIndex + 1 }}
                        ({{ stringUtils.pluraliseWithCount(nestedRow?.columns.length, 'column') }}))
                        <app-badge-button class="ms-2"
                                          (click)="actions.deleteRow(pageContent, nestedRowIndex, true, column)"
                                          [icon]="faRemove"
                                          [tooltip]="'Delete nested row'"/>
                      </div>
                      <div class="row align-items-end mb-3">
                        <app-row-type-selector
                          [row]="nestedRow"
                          [rowIndex]="nestedRowIndex"
                          [contentPath]="contentPath"
                          (typeChange)="onNestedRowTypeChange(nestedRow)"/>
                        <div [ngClass]="column.columns > 6 || expanded ? 'col': 'col-sm-12'">
                          <app-margin-select label="Margin Top"
                                             [data]="nestedRow"
                                             field="marginTop"/>
                        </div>
                        <div class="col">
                          <app-margin-select label="Margin Bottom"
                                             [data]="nestedRow"
                                             field="marginBottom"/>
                        </div>
                        <div class="col mt-3">
                          <app-actions-dropdown [rowIndex]="nestedRowIndex" fullWidth
                                                [pageContent]="pageContent"
                                                [rowIsNested]="true"
                                                [column]="column"
                                                [row]="nestedRow"/>
                        </div>
                      </div>
                      @if (actions.isSharedFragment(nestedRow)) {
                        <div class="row mt-2">
                          <div class="col-12">
                            <label [for]="'nested-shared-fragment-path-' + rowIndex + '-' + nestedRowIndex">Shared
                              Fragment</label>
                            <app-fragment-selector
                              [elementId]="'nested-shared-fragment-path-' + rowIndex + '-' + nestedRowIndex"
                              [selectedFragment]="selectedFragmentForRow(nestedRow)"
                              (fragmentChange)="onSharedFragmentChange(nestedRow, $event)"/>
                          </div>
                        </div>
                        @if (nestedRow?.fragment?.pageContentId) {
                          <div class="mt-2 panel-border">
                            <app-dynamic-content-view [pageContent]="fragmentContent(nestedRow)"
                                                      [contentPath]="fragmentPath(nestedRow)"
                                                      [forceView]="true"/>
                          </div>
                          @if (!fragmentContent(nestedRow) && fragmentService.failedToLoad(nestedRow.fragment.pageContentId)) {
                            <div class="alert alert-warning mt-2">Fragment not
                              found: {{ nestedRow.fragment.pageContentId }}
                            </div>
                          }
                        }
                      }
                      @if (false) {
                        <div>nested row {{ nestedRowIndex + 1 }} that has {{ nestedRow.columns.length }} cols</div>
                      }
                      <app-dynamic-content-site-edit-text-row
                        [row]="nestedRow"
                        [parentRowIndex]="rowIndex"
                        [rowIndex]="nestedRowIndex"
                        [contentDescription]="contentDescription"
                        [contentPath]="contentPath"
                        [pageContent]="pageContent"/>
                    </div>
                  }
                </div>
              }
              <!-- end of column nested rows-->
            </div>
          }
          @if ((row?.columns?.length || 0) === 0) {
            <div class="col-12">
              <div
                class="thumbnail-site-edit h-100 mt-2 empty-drop-zone d-flex align-items-center justify-content-center"
                (dragover)="allowDrop($event)" (drop)="onEmptyRowDrop()">
                <div class="text-muted">Drop column here</div>
              </div>
            </div>
          }
        </div>
      }`,
    styleUrls: ["./dynamic-content.sass"],
  imports: [MarkdownEditorComponent, FormsModule, ColumnWidthComponent, BadgeButtonComponent, ActionsDropdownComponent, ImageCropperAndResizerComponent, CardImageComponent, NgClass, MarginSelectComponent, AspectRatioSelectorComponent, ImageActionsDropdownComponent, TooltipDirective, RowTypeSelectorComponent, FragmentSelectorComponent, DynamicContentViewComponent]
})
export class DynamicContentSiteEditTextRowComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditTextRowComponent", NgxLoggerLevel.ERROR);
  pageContentEditService = inject(PageContentEditService);
  memberResourcesReferenceData = inject(MemberResourcesReferenceDataService);
  stringUtils = inject(StringUtilsService);
  numberUtils = inject(NumberUtilsService);
  actions = inject(PageContentActionsService);
  fragmentService = inject(FragmentService);
  public expanded: boolean;
  isUndefined = isUndefined;
  private fileUtils = inject(FileUtilsService);

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
  faPencil = faPencil;
  faAdd = faAdd;
  public pageContentEditEvents: PageContentEditEvent[] = [];
  private uniqueCheckboxId: string;
  private controlsVisible = new WeakMap<PageContentColumn, boolean>();
  protected readonly faRemove = faRemove;
  protected readonly faArrowUp = faArrowUp;
  protected readonly faArrowDown = faArrowDown;
  nestedDragTargetColumnIndex: number = null;
  nestedDragTargetRowIndex: number = null;
  private fragmentCache = new Map<string, FragmentWithLabel>();
  protected readonly faMagnifyingGlass = faMagnifyingGlass;

  ngOnInit() {
    this.uniqueCheckboxId = `text-row-${this.numberUtils.generateUid()}`;
    this.logger.info("ngOnInit called for", this.row, "containing", this.stringUtils.pluraliseWithCount(this.row?.columns.length, "column"));
    this.loadNestedFragments();
  }

  private async loadNestedFragments() {
    if (this.row?.columns) {
      for (const column of this.row.columns) {
        if (column.rows) {
          await this.fragmentService.loadFragmentsRecursivelyFromRows(column.rows);
        }
      }
    }
  }

  getUniqueCheckboxId(suffix: string): string {
    return `${this.uniqueCheckboxId}-${suffix}`;
  }

  imageSource(rowIndex: number, columnIndex: number, imageSource: string) {
    return this.pageContentEditService.eventMatching(this.pageContentEditEvents, {
      path: this.pageContent.path,
      rowIndex,
      columnIndex
    })?.image || imageSource;
  }

  editImage(rowIndex: number, columnIndex: number) {
    this.pageContentEditEvents = this.pageContentEditService.handleEvent({
      path: this.pageContent.path,
      rowIndex,
      columnIndex,
      editActive: true
    }, this.pageContentEditEvents);
  }

  removeImage(column: PageContentColumn) {
    column.imageSource = null;
  }

  replaceImage(column: PageContentColumn, rowIndex: number, columnIndex: number) {
    column.imageSource = null;
    this.editImage(rowIndex, columnIndex);
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

  async onImageSourcePaste(event: ClipboardEvent, rowIndex: number, columnIndex: number) {
    const items = event.clipboardData?.items || [];
    const fileItem = Array.from(items).find(item => item.kind === "file" && item.type.startsWith("image/"));
    if (fileItem) {
      event.preventDefault();
      const file = fileItem.getAsFile();
      if (file) {
        const base64File = await this.fileUtils.loadBase64ImageFromFile(file);
        this.pageContentEditEvents = this.pageContentEditService.handleEvent({
          path: this.pageContent.path,
          rowIndex,
          columnIndex,
          editActive: true,
          image: base64File.base64Content
        }, this.pageContentEditEvents);
      }
    }
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
  isNarrow(column: PageContentColumn): boolean {
    return (column?.columns || 12) <= 6;
  }

  focusSensitiveColumns(pageContentColumn: PageContentColumn) {
    return this.expanded ? 12 : (pageContentColumn?.columns || 12);
  }

  markdownEditorFocusChange(editorInstanceState: EditorInstanceState) {
    this.logger.info("markdownEditorFocusChange:editorInstanceState:", editorInstanceState);
  }

  onEditorFocusChange(editorInstanceState: EditorInstanceState, column: PageContentColumn) {
    this.markdownEditorFocusChange(editorInstanceState);
    this.controlsVisible.set(column, editorInstanceState.view === "edit");
  }

  toggleAll(column: PageContentColumn, editor: MarkdownEditorComponent) {
    if (this.controlsShown(column)) {
      this.controlsVisible.set(column, false);
      if (editor?.toggleToView) {
        editor.toggleToView();
      }
    } else {
      this.controlsVisible.set(column, true);
      if (editor?.toggleToEdit) {
        editor.toggleToEdit();
      }
    }
  }

  allowDrop($event: DragEvent) { $event.preventDefault(); }

  onColumnDragStart(event: DragEvent, rowIndex: number, columnIndex: number) {
    this.actions.draggedColumnRowIndex = rowIndex;
    this.actions.draggedColumnIndex = columnIndex;
    this.actions.draggedColumnSourceRow = this.row;
    this.actions.draggedRowIndex = null;
    this.actions.draggedColumnIsNested = this.isNestedLevel();
    this.actions.dragStartX = event?.clientX;
    this.actions.dragStartY = event?.clientY;
    this.actions.dragHasMoved = false;
    try {
      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        const dragEl = (event.target as HTMLElement) || (event.currentTarget as HTMLElement);
        if (dragEl && event.dataTransfer.setDragImage) {
          event.dataTransfer.setDragImage(dragEl, 10, 10);
        }
      }
    } catch {}
  }

  onNestedRowDragOver(columnIndex: number, nestedRowIndex: number, $event: DragEvent) {
    $event.preventDefault();
    this.nestedDragTargetColumnIndex = columnIndex;
    this.nestedDragTargetRowIndex = nestedRowIndex;
  }

  onNestedRowDragEnd() {
    this.nestedDragTargetColumnIndex = null;
    this.nestedDragTargetRowIndex = null;
  }

  nestedRowDragTooltip(columnIndex: number, nestedRowIndex: number): string | null {
    const sCol = this.actions.draggedNestedColumnIndex;
    const sRow = this.actions.draggedNestedRowIndex;
    if (sCol === null || sRow === null) { return null; }
    if (this.nestedDragTargetColumnIndex !== columnIndex || this.nestedDragTargetRowIndex !== nestedRowIndex) { return null; }
    if (sCol === columnIndex && sRow === nestedRowIndex) { return "Drop: no change"; }
    const where = sCol === columnIndex ? (sRow < nestedRowIndex ? "after" : "before") : "into column " + (columnIndex + 1);
    return `Drop nested row ${sRow + 1} ${where} ${sCol === columnIndex ? "row " + (nestedRowIndex + 1) : ""}`.trim();
  }

  onColumnDrop($event: DragEvent, targetRowIndex: number, targetColumnIndex: number) {
    $event.preventDefault();
    $event.stopPropagation();
    if (this.actions.draggedColumnIsNested !== this.isNestedLevel()) { return; }
    const sourceColumnIndex = this.actions.draggedColumnIndex;
    const sourceRow = this.actions.draggedColumnSourceRow;
    const targetRow = this.row;
    if (sourceRow === null || sourceColumnIndex === null) { return; }
    const insertAfter = this.actions.dragInsertAfter && this.actions.dragOverColumnRowIndex === this.rowIndex && this.actions.dragOverColumnIndex === targetColumnIndex;
    let insertionIndex = targetColumnIndex + (insertAfter ? 1 : 0);
    if (sourceRow === targetRow && sourceColumnIndex === targetColumnIndex && !insertAfter) {
      this.actions.draggedColumnIndex = null;
      this.actions.draggedColumnRowIndex = null;
      this.actions.draggedColumnSourceRow = null;
      this.actions.dragOverColumnRowIndex = null;
      this.actions.dragOverColumnIndex = null;
      this.actions.dragInsertAfter = false;
      return;
    }
    if (sourceRow === targetRow) {
      const cols = targetRow.columns;
      const [item] = cols.splice(sourceColumnIndex, 1);
      if (insertionIndex > sourceColumnIndex) { insertionIndex--; }
      cols.splice(insertionIndex, 0, item);
    } else {
      this.actions.moveColumnBetweenRows(sourceRow, sourceColumnIndex, targetRow, insertionIndex, this.pageContent);
    }
    this.actions.draggedColumnIndex = null;
    this.actions.draggedColumnRowIndex = null;
    this.actions.draggedColumnSourceRow = null;
    this.actions.dragOverColumnRowIndex = null;
    this.actions.dragOverColumnIndex = null;
    this.actions.dragInsertAfter = false;
    this.actions.draggedColumnIsNested = false;
  }

  onEmptyRowDrop() {
    const sourceColumnIndex = this.actions.draggedColumnIndex;
    const sourceRow = this.actions.draggedColumnSourceRow;
    const targetRow = this.row;
    if (sourceRow === null || sourceColumnIndex === null) { return; }
    this.actions.moveColumnToEmptyRow(sourceRow, sourceColumnIndex, targetRow, this.pageContent);
    this.actions.draggedColumnIndex = null;
    this.actions.draggedColumnRowIndex = null;
    this.actions.draggedColumnSourceRow = null;
  }

  onColumnDragOver($event: DragEvent, rowIndex: number, columnIndex: number) {
    $event.preventDefault();
    if (this.actions.draggedColumnIsNested !== this.isNestedLevel()) { return; }
    const dx = ($event?.clientX || 0) - (this.actions.dragStartX || 0);
    const dy = ($event?.clientY || 0) - (this.actions.dragStartY || 0);
    if (!this.actions.dragHasMoved && (Math.abs(dx) + Math.abs(dy) > 3)) { this.actions.dragHasMoved = true; }
    this.autoScrollViewport($event?.clientY || 0);
    const rect = ($event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = $event.clientX - rect.left;
    this.actions.dragOverColumnRowIndex = rowIndex;
    this.actions.dragOverColumnIndex = columnIndex;
    this.actions.dragInsertAfter = x > rect.width / 2;
  }

  private autoScrollViewport(clientY: number) {
    const threshold = 100;
    const speed = 20;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (clientY < threshold) {
      window.scrollBy({ top: -speed, behavior: "auto" });
    } else if (clientY > vh - threshold) {
      window.scrollBy({ top: speed, behavior: "auto" });
    }
  }

  columnDragTooltip(rowIndex: number, columnIndex: number): string | null {
    const srcIndex = this.actions.draggedColumnIndex;
    if (srcIndex === null || srcIndex === undefined) { return null; }
    if (!this.actions.dragHasMoved) { return null; }
    if (this.actions.draggedColumnIsNested !== this.isNestedLevel()) { return null; }
    if (this.actions.dragOverColumnRowIndex !== rowIndex || this.actions.dragOverColumnIndex !== columnIndex) { return null; }
    const beforeAfter = this.actions.dragInsertAfter ? "after" : "before";
    return `Drop ${beforeAfter} Col ${columnIndex + 1}`;
  }

  private isNestedLevel(): boolean {
    return this.parentRowIndex !== undefined && this.parentRowIndex !== null;
  }

  onNestedRowDragStart(columnIndex: number, nestedRowIndex: number) {
    this.actions.draggedNestedColumnIndex = columnIndex;
    this.actions.draggedNestedRowIndex = nestedRowIndex;
  }

  onNestedRowDrop(targetColumnIndex: number, targetNestedRowIndex: number) {
    const sourceColumnIndex = this.actions.draggedNestedColumnIndex;
    const sourceNestedRowIndex = this.actions.draggedNestedRowIndex;
    if (sourceColumnIndex === null || sourceNestedRowIndex === null) { return; }
    if (sourceColumnIndex === targetColumnIndex && sourceNestedRowIndex === targetNestedRowIndex) {
      this.actions.draggedNestedColumnIndex = null;
      this.actions.draggedNestedRowIndex = null;
      return;
    }
    const ensureRows = (colIndex: number) => {
      if (!this.row.columns[colIndex].rows) { this.actions.addNestedRows(this.row.columns[colIndex]); }
    };
    ensureRows(sourceColumnIndex);
    ensureRows(targetColumnIndex);
    if (sourceColumnIndex === targetColumnIndex) {
      const rows = this.row.columns[targetColumnIndex].rows || [];
      const [item] = rows.splice(sourceNestedRowIndex, 1);
      rows.splice(targetNestedRowIndex, 0, item);
    } else {
      const sourceRows = this.row.columns[sourceColumnIndex].rows || [];
      const targetRows = this.row.columns[targetColumnIndex].rows || [];
      const [item] = sourceRows.splice(sourceNestedRowIndex, 1);
      targetRows.splice(targetNestedRowIndex, 0, item);
    }
    this.actions.draggedNestedColumnIndex = null;
    this.actions.draggedNestedRowIndex = null;
  }

  shouldShowImage(rowIndex: number, columnIndex: number, column: PageContentColumn): boolean {
    const hasActualImage = !!this.imageSource(rowIndex, columnIndex, column?.imageSource) || this.editActive(rowIndex, columnIndex);
    const showPlaceholder = column?.showPlaceholderImage && !column?.imageSource;
    return hasActualImage || showPlaceholder;
  }

  imageSourceFor(rowIndex: number, columnIndex: number, column: PageContentColumn): string {
    const actualImage = this.imageSource(rowIndex, columnIndex, column?.imageSource);
    if (column?.showPlaceholderImage && !column?.imageSource) {
      return FALLBACK_MEDIA.url;
    } else {
      return actualImage;
    }
  }

  showImageAfterText(rowIndex: number, columnIndex: number, column: PageContentColumn) {
    return !column.showTextAfterImage && this.hasActualImage(rowIndex, columnIndex, column);
  }

  showImageBeforeText(rowIndex: number, columnIndex: number, column: PageContentColumn) {
    return column.showTextAfterImage && this.hasActualImage(rowIndex, columnIndex, column);
  }

  showPlaceholderAboveText(rowIndex: number, columnIndex: number, column: PageContentColumn) {
    return column.showTextAfterImage && !this.hasActualImage(rowIndex, columnIndex, column) && column.showPlaceholderImage;
  }

  showPlaceholderBelowText(rowIndex: number, columnIndex: number, column: PageContentColumn) {
    return !column.showTextAfterImage && !this.hasActualImage(rowIndex, columnIndex, column) && column.showPlaceholderImage;
  }

  hasActualImage(rowIndex: number, columnIndex: number, column: PageContentColumn): boolean {
    return !!this.imageSource(rowIndex, columnIndex, column?.imageSource);
  }

  onShowPlaceholderImageChanged(event: Event, column: PageContentColumn) {
    const target = event.target as HTMLInputElement;
    column.showPlaceholderImage = target.checked;

    if (target.checked && !column.imageAspectRatio) {
      column.imageAspectRatio = {
        width: 16,
        height: 9,
        description: "16:9 (Landscape)"
      };
    }
  }

  onImageAspectRatioChanged(column: PageContentColumn, dimensions: DescribedDimensions) {
    column.imageAspectRatio = dimensions;
  }



  onSplit(splitData: SplitEvent, rowIndex: number, columnIndex: number) {
    this.logger.info("═══ onSplit START ═══");
    this.logger.info("splitData:", splitData, "rowIndex:", rowIndex, "columnIndex:", columnIndex, "parentRowIndex:", this.parentRowIndex);

    const column = this.row.columns?.[columnIndex];
    if (!column) {
      this.logger.warn("Column not found at index", columnIndex);
      return;
    }

    const rowsToInsert: PageContentRow[] = [];

    if (splitData.textAfter !== undefined) {
      rowsToInsert.push(this.createRowFromSplitRow({text: splitData.textAfter}));
    }

    if (splitData.additionalRows && splitData.additionalRows.length > 0) {
      for (const additionalText of splitData.additionalRows) {
        rowsToInsert.push(this.createRowFromSplitRow({text: additionalText}));
      }
    }

    if (rowsToInsert.length > 0) {
      const parentRowHasMultipleColumns = (this.row.columns?.length || 0) > 1;
      const userChoice = splitData.createNested;
      const createNestedRows = userChoice !== undefined ? userChoice : parentRowHasMultipleColumns;

      this.logger.info("Parent row has", this.row.columns?.length, "columns, userChoice:", userChoice, "createNestedRows:", createNestedRows);

      if (createNestedRows) {
        this.logger.info("Creating nested rows in column", columnIndex, "count:", rowsToInsert.length);
        if (!column.rows) {
          column.rows = [];
        }
        column.rows.push(...rowsToInsert);
        this.logger.info("Column now has", column.rows.length, "nested rows");
      } else {
        this.logger.info("Creating sibling rows at page level, count:", rowsToInsert.length);
        this.insertRowsAfterCurrent(rowsToInsert, rowIndex, columnIndex);
      }
    }

    this.logger.info("═══ onSplit END ═══");
  }

  onHtmlPaste(result: HtmlPasteResult, rowIndex: number, columnIndex: number) {
    this.logger.info("═══ onHtmlPaste START ═══");
    this.logger.info("Component UID:", this.uniqueCheckboxId, "rowIndex:", rowIndex, "columnIndex:", columnIndex, "parentRowIndex:", this.parentRowIndex);
    this.logger.info("result:", result);
    this.logger.info("this.row (first 100 chars of contentText):", this.row.columns?.map(c => c.contentText?.substring(0, 100)));
    this.logger.info("pageContent.rows.length:", this.pageContent?.rows?.length);
    const column = this.row.columns?.[columnIndex];
    if (column) {
      const firstRow = result?.firstRow;
      if (firstRow) {
        column.contentText = firstRow.text || "";
        column.imageSource = firstRow.imageSource;
        column.alt = firstRow.alt;
      } else {
        column.contentText = "";
        column.imageSource = null;
        column.alt = null;
      }

      const rowsToInsert: PageContentRow[] = [];
      for (const rowData of result?.additionalRows || []) {
        rowsToInsert.push(this.createRowFromSplitRow(rowData));
      }

      if (rowsToInsert.length > 0) {
        const parentRowHasMultipleColumns = (this.row.columns?.length || 0) > 1;
        const userChoice = result.createNested;
        const createNestedRows = userChoice !== undefined ? userChoice : parentRowHasMultipleColumns;

        this.logger.info("Parent row has", this.row.columns?.length, "columns, userChoice:", userChoice, "createNestedRows:", createNestedRows);

        if (createNestedRows) {
          this.logger.info("Creating nested rows in column", columnIndex, "count:", rowsToInsert.length);
          if (!column.rows) {
            column.rows = [];
          }
          column.rows.push(...rowsToInsert);
          this.logger.info("Column now has", column.rows.length, "nested rows");
        } else {
          this.logger.info("Creating sibling rows at page level, count:", rowsToInsert.length);
          this.insertRowsAfterCurrent(rowsToInsert, rowIndex, columnIndex);
        }
      }
    }

    this.logger.info("═══ onHtmlPaste END ═══");
  }

  private createRowFromSplitRow(rowData: HtmlPasteRow): PageContentRow {
    const newRow: PageContentRow = this.actions.defaultRowFor("text");
    const newColumn = newRow.columns && newRow.columns.length > 0 ? newRow.columns[0] : null;
    if (newColumn) {
      if (rowData.text !== undefined) {
        newColumn.contentText = rowData.text;
      }
      if (rowData.imageSource !== undefined) {
        newColumn.imageSource = rowData.imageSource;
      }
      if (rowData.alt !== undefined) {
        newColumn.alt = rowData.alt;
      }
    }
    this.logger.info("Created new row from split, text length:", newColumn?.contentText?.length, "has image:", !!newColumn?.imageSource);
    return newRow;
  }

  private insertRowsAfterCurrent(rowsToInsert: PageContentRow[], rowIndex: number, _columnIndex: number) {
    if (!rowsToInsert || rowsToInsert.length === 0) {
      return;
    }

    const isNestedRow = this.parentRowIndex !== undefined && this.parentRowIndex !== null;
    this.logger.info("insertRowsAfterCurrent: isNestedRow:", isNestedRow, "parentRowIndex:", this.parentRowIndex, "rowIndex:", rowIndex, "rowsToInsert.length:", rowsToInsert.length);
    this.logger.info("this.row:", this.row);

    if (isNestedRow) {
      const parentRow = this.pageContent.rows[this.parentRowIndex];
      this.logger.info("Nested row mode - parentRow:", parentRow);
      const parentColumn = parentRow?.columns?.find(col => col.rows && col.rows.includes(this.row));
      this.logger.info("Found parentColumn:", parentColumn, "will insert at index:", rowIndex + 1);

      if (parentColumn && parentColumn.rows) {
        const actualRowIndex = parentColumn.rows.indexOf(this.row);
        this.logger.info("Before insert - parentColumn.rows.length:", parentColumn.rows.length, "actualRowIndex:", actualRowIndex);
        parentColumn.rows.splice(actualRowIndex + 1, 0, ...rowsToInsert);
        this.logger.info("After insert - parentColumn.rows.length:", parentColumn.rows.length);
      } else {
        this.logger.warn("Could not find parent column for nested row split");
      }
    } else {
      const actualRowIndex = this.pageContent.rows.indexOf(this.row);
      this.logger.info("Top-level row mode - inserting at pageContent.rows index:", actualRowIndex + 1, "(input rowIndex was:", rowIndex, ")");
      this.logger.info("Before insert - pageContent.rows.length:", this.pageContent.rows.length);
      this.pageContent.rows.splice(actualRowIndex + 1, 0, ...rowsToInsert);
      this.logger.info("After insert - pageContent.rows.length:", this.pageContent.rows.length);
    }
  }

  isDefined(value: unknown): boolean {
    return !isUndefined(value);
  }

  toggleControls(column: PageContentColumn) {
    this.controlsVisible.set(column, !this.controlsShown(column));
  }

  controlsShown(column: PageContentColumn): boolean {
    return this.controlsVisible.get(column) || false;
  }

  onNestedRowTypeChange(row: PageContentRow) {
    this.logger.info("onNestedRowTypeChange called for row with type:", row.type);
    this.initialiseRowIfRequired(row);
    this.logger.info("Row after type change:", row);
  }

  private initialiseRowIfRequired(row: PageContentRow) {
    this.logger.debug("initialiseRowIfRequired for row:", row);
    if (this.actions.isSharedFragment(row)) {
      if (!row?.fragment) {
        row.fragment = {pageContentId: ""};
      } else if (row.fragment.pageContentId) {
        this.fragmentService.ensureLoadedById(row.fragment.pageContentId);
      }
    }
  }

  selectedFragmentForRow(row: PageContentRow): FragmentWithLabel | null {
    if (!row?.fragment?.pageContentId) {
      return null;
    }

    if (this.fragmentCache.has(row.fragment.pageContentId)) {
      return this.fragmentCache.get(row.fragment.pageContentId);
    }

    const fragment = this.fragmentService.fragments.find(f => f.id === row.fragment.pageContentId);
    if (!fragment) {
      return null;
    }

    const fragmentWithLabel: FragmentWithLabel = {
      pageContentId: fragment.id,
      ngSelectAttributes: {label: fragment.path}
    };

    this.fragmentCache.set(row.fragment.pageContentId, fragmentWithLabel);
    return fragmentWithLabel;
  }

  onSharedFragmentChange(row: PageContentRow, fragmentWithLabel: FragmentWithLabel) {
    this.logger.info("onSharedFragmentChange received fragmentWithLabel:", fragmentWithLabel);
    if (fragmentWithLabel?.pageContentId) {
      row.fragment = {pageContentId: fragmentWithLabel.pageContentId};
      this.logger.info("Set fragment:", row.fragment);
      this.loadTheFragmentImmediatelyToAvoidUiHang(fragmentWithLabel);
    } else {
      row.fragment = null;
    }
  }

  private loadTheFragmentImmediatelyToAvoidUiHang(fragmentWithLabel: FragmentWithLabel) {
    this.fragmentService.ensureLoadedById(fragmentWithLabel.pageContentId).then(() => {
      this.logger.info("Fragment loaded:", fragmentWithLabel.pageContentId);
    });
  }

  fragmentContent(row: PageContentRow): PageContent {
    return row?.fragment?.pageContentId ? this.fragmentService.contentById(row.fragment.pageContentId) : null;
  }

  fragmentPath(row: PageContentRow): string {
    return this.fragmentService.contentById(row?.fragment?.pageContentId)?.path;
  }

  canJoinWithPreviousRow(): boolean {
    const rows = this.getRows();
    if (this.rowIndex <= 0 || rows.length <= 1) {
      return false;
    }
    const previousRow = rows[this.rowIndex - 1];
    return this.actions.canJoinRows(this.row, previousRow);
  }

  canJoinWithNextRow(): boolean {
    const rows = this.getRows();
    if (this.rowIndex < 0 || this.rowIndex >= rows.length - 1) {
      return false;
    }
    const nextRow = rows[this.rowIndex + 1];
    return this.actions.canJoinRows(this.row, nextRow);
  }

  joinWithPreviousRow(): void {
    const nestedParentColumn = this.getNestedParentColumn();
    this.actions.joinWithPreviousRow(this.pageContent, this.row, nestedParentColumn);
  }

  joinWithNextRow(): void {
    const nestedParentColumn = this.getNestedParentColumn();
    this.actions.joinWithNextRow(this.pageContent, this.row, nestedParentColumn);
  }

  private getRows(): PageContentRow[] {
    const nestedParentColumn = this.getNestedParentColumn();
    return nestedParentColumn?.rows || this.pageContent?.rows || [];
  }

  private getNestedParentColumn(): PageContentColumn | undefined {
    if (!this.isNestedLevel()) {
      return undefined;
    }
    const parentRow = this.pageContent.rows[this.parentRowIndex];
    return parentRow?.columns?.find(col => col.rows && col.rows.includes(this.row));
  }
}
