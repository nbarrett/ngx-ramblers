import { Component, inject, Input, OnInit } from "@angular/core";
import { faAdd, faPencil, faRemove } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AwsFileData } from "../../../models/aws-object.model";
import {
  EditorInstanceState,
  PageContent,
  PageContentColumn,
  PageContentEditEvent,
  PageContentRow
} from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentEditService } from "../../../services/page-content-edit.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { FormsModule } from "@angular/forms";
import { ColumnWidthComponent } from "./column-width";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { ActionsDropdownComponent } from "../actions-dropdown/actions-dropdown";
import { ImageCropperAndResizerComponent } from "../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { CardImageComponent } from "../card/image/card-image";
import { NgClass } from "@angular/common";
import { MarginSelectComponent } from "./dynamic-content-margin-select";
import { FALLBACK_MEDIA } from "../../../models/walk.model";
import { AspectRatioSelectorComponent } from "../../../carousel/edit/aspect-ratio-selector/aspect-ratio-selector";
import { DescribedDimensions } from "../../../models/aws-object.model";

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
                <div class="thumbnail-site-edit h-100">
                  <div class="thumbnail-heading">Col {{ columnIndex + 1 }}</div>
                  <app-markdown-editor #markdownEditorComponent
                                       (saved)="actions.saveContentTextId($event, column)"
                                       (focusChange)="markdownEditorFocusChange($event)"
                                       buttonsAvailableOnlyOnFocus queryOnlyById allowMaximise
                                       [description]="actions.rowColumnIdentifierFor(rowIndex, columnIndex, contentDescription)"
                                       [id]="column?.contentTextId"
                                       [initialView]="actions.view()"
                                       [name]="actions.parentRowColFor(parentRowIndex, rowIndex, columnIndex)"
                                       [category]="contentPath">
                    <ng-container prepend>
                      <div class="form-group">
                        <label
                          [for]="actions.rowColumnIdentifierFor(rowIndex, columnIndex, 'access-level-' + contentPath)">Access</label>
                        <select [(ngModel)]="column.accessLevel"
                                [id]="actions.rowColumnIdentifierFor(rowIndex, columnIndex, 'access-level-' + contentPath)"
                                class="form-control input-sm">
                          @for (accessLevel of memberResourcesReferenceData.accessLevels(); track accessLevel.description) {
                            <option
                              [textContent]="accessLevel.description"
                              [ngValue]="accessLevel.id"></option>
                          }
                        </select>
                      </div>
                      <div class="form-group">
                        <app-column-width [column]="column" (expandToggle)="expanded=$event"/>
                      </div>
                      <div class="form-group">
                        <div class="form-check form-check-inline mb-0">
                          <input [name]="getUniqueCheckboxId('show-placeholder-image')"
                                 type="checkbox" class="form-check-input"
                                 [id]="getUniqueCheckboxId('show-placeholder-image')"
                                 [checked]="column.showPlaceholderImage"
                                 (change)="onShowPlaceholderImageChanged($event, columnIndex)">
                          <label class="form-check-label"
                                 [for]="getUniqueCheckboxId('show-placeholder-image')">Show Placeholder Image
                          </label>
                        </div>
                      </div>
                      @if (column.showPlaceholderImage) {
                        <div class="form-group">
                          <app-aspect-ratio-selector
                            label="Image Aspect Ratio"
                            [dimensionsDescription]="column.imageAspectRatio?.description"
                            (dimensionsChanged)="onImageAspectRatioChanged(columnIndex, $event)">
                          </app-aspect-ratio-selector>
                        </div>
                      }
                      @if (!column.imageSource) {
                        <app-badge-button (click)="editImage(rowIndex, columnIndex)"
                                          [icon]="faAdd"
                                          [caption]="'add image'"/>
                      }
                      @if (column.imageSource) {
                        <app-badge-button (click)="editImage(rowIndex, columnIndex)"
                                          [icon]="faPencil"
                                          [caption]="'edit image'"/>
                        <app-badge-button (click)="replaceImage(column, rowIndex, columnIndex)"
                                          [icon]="faAdd"
                                          [caption]="'replace image'"/>
                        <app-badge-button (click)="removeImage(column)"
                                          [icon]="faRemove"
                                          [caption]="'remove image'"/>
                      }
                      <app-actions-dropdown
                        [markdownEditorComponent]="markdownEditorComponent"
                        [columnIndex]="columnIndex"
                        [pageContent]="pageContent"
                        [column]="column"
                        [row]="row"/>
                    </ng-container>
                  </app-markdown-editor>

                  <!-- Always show image source URL field when editing -->
                  <div class="row mt-2">
                    <div [class]="imagePropertyColumnClasses(column)">
                      <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'name')">
                        Image Source</label>
                      <input [(ngModel)]="column.imageSource"
                             [id]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'name')"
                             type="text" class="form-control">
                    </div>
                    <div [class]="imagePropertyColumnClasses(column)">
                      <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-border-radius')">
                        Border Radius</label>
                      <input [(ngModel)]="column.imageBorderRadius"
                             [id]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-border-radius')"
                             type="number" class="form-control">
                    </div>
                  </div>

                  @if (shouldShowImage(rowIndex, columnIndex, column)) {
                    <div class="mt-2 mb-3">
                      <div class="mb-2">
                        @if (editActive(rowIndex, columnIndex)) {
                          <app-image-cropper-and-resizer
                            [selectAspectRatio]="column?.imageAspectRatio?.description"
                            [preloadImage]="column?.imageSource"
                            (imageChange)="imageChanged(rowIndex, columnIndex, $event)"
                            (quit)="exitImageEdit(rowIndex, columnIndex)"
                            (save)="imagedSaved(rowIndex, columnIndex, column, $event)">
                          </app-image-cropper-and-resizer>
                        }
                      </div>
                      <app-card-image
                        [borderRadius]="column?.imageBorderRadius"
                        [aspectRatio]="column?.imageAspectRatio"
                        unconstrainedHeight
                        [imageSource]="imageSourceFor(rowIndex, columnIndex, column)">
                      </app-card-image>
                    </div>
                  }
                </div>
              }
              <!-- end of row content editing-->
              <!-- start of column nested rows-->
              @if (column.rows) {
                <div class="thumbnail-site-edit">
                  <div class="thumbnail-heading">Row {{ rowIndex + 1 }} column {{ columnIndex + 1 }}
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
                    <div class="thumbnail-site-edit mt-3">
                      <div class="thumbnail-heading">Row {{ rowIndex + 1 }} (nested row {{ nestedRowIndex + 1 }}
                        column {{ columnIndex + 1 }}
                        ({{ stringUtils.pluraliseWithCount(nestedRow?.columns.length, 'column') }}))
                      </div>
                      <div class="row align-items-end mb-3">
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
                          <app-actions-dropdown [rowIndex]="nestedRowIndex"
                                                [pageContent]="pageContent"
                                                [rowIsNested]="true"
                                                [column]="column"
                                                [row]="nestedRow"/>
                        </div>
                      </div>
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
        </div>
      }`,
    styleUrls: ["./dynamic-content.sass"],
    imports: [MarkdownEditorComponent, FormsModule, ColumnWidthComponent, BadgeButtonComponent, ActionsDropdownComponent, ImageCropperAndResizerComponent, CardImageComponent, NgClass, MarginSelectComponent, AspectRatioSelectorComponent]
})
export class DynamicContentSiteEditTextRowComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditTextRowComponent", NgxLoggerLevel.ERROR);
  pageContentEditService = inject(PageContentEditService);
  memberResourcesReferenceData = inject(MemberResourcesReferenceDataService);
  stringUtils = inject(StringUtilsService);
  numberUtils = inject(NumberUtilsService);
  actions = inject(PageContentActionsService);
  public expanded: boolean;

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

  protected readonly faRemove = faRemove;

  ngOnInit() {
    this.uniqueCheckboxId = `text-row-${this.numberUtils.generateUid()}`;
    this.logger.info("ngOnInit called for", this.row, "containing", this.stringUtils.pluraliseWithCount(this.row?.columns.length, "column"));
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
    return this.expanded ? 12 : (pageContentColumn?.columns || 12);
  }

  markdownEditorFocusChange(editorInstanceState: EditorInstanceState) {
    this.logger.info("markdownEditorFocusChange:editorInstanceState:", editorInstanceState);
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

  onShowPlaceholderImageChanged(event: Event, columnIndex: number) {
    const target = event.target as HTMLInputElement;
    const column = this.row.columns[columnIndex];
    column.showPlaceholderImage = target.checked;

    if (target.checked && !column.imageAspectRatio) {
      column.imageAspectRatio = {
        width: 16,
        height: 9,
        description: "16:9 (Landscape)"
      };
    }
  }

  onImageAspectRatioChanged(columnIndex: number, dimensions: DescribedDimensions) {
    this.row.columns[columnIndex].imageAspectRatio = dimensions;
  }






}
