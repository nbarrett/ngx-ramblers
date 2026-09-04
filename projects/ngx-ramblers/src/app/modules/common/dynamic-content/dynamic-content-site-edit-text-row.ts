import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import {
  faAdd,
  faArrowDown,
  faArrowsUpDown,
  faArrowUp,
  faCheck,
  faLayerGroup,
  faRemove,
  faSliders
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AwsFileData, DescribedDimensions } from "../../../models/aws-object.model";
import {
  ColumnContentType,
  ColumnMappingContext,
  ContentTextStyles,
  EM_DASH_WITH_SPACES,
  FragmentWithLabel, ImageFit, MigrationTemplateSourceType,
  NestedRowContentSource,
  PageContent,
  PageContentColumn,
  PageContentEditEvent,
  PageContentRow,
  SplitEvent
} from "../../../models/content-text.model";
import { ImageMatchPattern, TextMatchPattern } from "../../../models/page-transformation.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentEditService } from "../../../services/page-content-edit.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { ImageCropperPosition } from "../../../models/image-cropper.model";
import { ContentTextEditor } from "../../../modules/common/tiptap-editor/content-text-editor";
import { HtmlPasteResult, HtmlPasteRow } from "../../../models/html-paste.model";
import { FormsModule } from "@angular/forms";
import { ColumnWidthComponent } from "./column-width";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { ActionsDropdownComponent } from "../actions-dropdown/actions-dropdown";
import { ImageCropperAndResizerComponent } from "../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { CardImageComponent } from "../card/image/card-image";
import { NgClass, NgTemplateOutlet } from "@angular/common";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { MarginSelectComponent } from "./dynamic-content-margin-select";
import { FALLBACK_MEDIA } from "../../../models/walk.model";
import { AspectRatioSelectorComponent } from "../../../carousel/edit/aspect-ratio-selector/aspect-ratio-selector";
import { ImageActionsDropdownComponent } from "./image-actions-dropdown";
import { FileUtilsService } from "../../../file-utils.service";
import { RowTypeSelectorComponent } from "./row-type-selector";
import { FragmentService } from "../../../services/fragment.service";
import { FragmentSelectorComponent } from "./fragment-selector.component";
import { DynamicContentViewComponent } from "./dynamic-content-view";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { DynamicContentSiteEditMap } from "./dynamic-content-site-edit-map";
import { DynamicContentSiteEditRoute } from "./dynamic-content-site-edit-route";
import { AlertComponent } from "ngx-bootstrap/alert";
import { ALERT_WARNING } from "../../../models/alert-target.model";
import { YoutubeEmbed } from "../youtube-embed/youtube-embed";
import { YoutubeInputComponent } from "../youtube-input/youtube-input";
import { ResizerComponent } from "../resizer/resizer";
import { ColumnImageDisplaySettingsComponent } from "../column-image-display-settings/column-image-display-settings";
import { ClipboardService } from "../../../services/clipboard.service";

@Component({
    selector: "app-dynamic-content-site-edit-text-row",
    template: `
      @if (actions.isTextRow(row)) {
        <div [class]="actions.rowClasses(row)">
          @for (column of row?.columns; let columnIndex = $index; track columnIndex) {
            <div [class]="'col-sm-' + (focusSensitiveColumns(column))" style="position: relative;">
              <ng-template #columnMappingControls>
                @if (allowColumnMappings && isMigrationTemplateSelected && isMigrationTemplateSelected() && templateMappingMode && columnMapping && columnContentTypeOptions && imagePatternOptions && columnMappingFor(rowIndex, columnIndex)) {
                  <div class="row thumbnail-heading-frame thumbnail-heading-mapping-mode">
                    <div class="thumbnail-heading">Column Mapping</div>
                    @if (templateSourceOptions && templateSourceOptions.length > 0) {
                      <div class="col-md-12">
                        <label class="form-label-sm" [for]="'col-source-' + rowIndex + '-' + columnIndex">
                          Mapping source</label>
                        <select class="form-select form-select-sm"
                                [id]="'col-source-' + rowIndex + '-' + columnIndex"
                                [ngModel]="columnMappingFor(rowIndex, columnIndex)?.sourceType || ''"
                                (ngModelChange)="onColumnMappingSource(rowIndex, columnIndex, $event)">
                          <option value="">Static (use template content)</option>
                          @for (option of templateSourceOptions; track option.value) {
                            <option [value]="option.value">{{ option.label }}</option>
                          }
                        </select>
                      </div>
                      @if (columnMappingFor(rowIndex, columnIndex)?.sourceType === MigrationTemplateSourceType.EXTRACT && templateExtractOptions && templateExtractOptions.length > 0) {
                        <div class="col-md-12">
                          <label class="form-label-sm" [for]="'col-text-pattern-' + rowIndex + '-' + columnIndex">
                            Text pattern</label>
                          <select class="form-select form-select-sm"
                                  [id]="'col-text-pattern-' + rowIndex + '-' + columnIndex"
                                  [ngModel]="columnMappingFor(rowIndex, columnIndex)?.textPattern || ''"
                                  (ngModelChange)="onColumnMappingProperty(rowIndex, columnIndex, 'textPattern', $event)">
                            <option value="">Select pattern...</option>
                            @for (option of templateExtractOptions; track option.value) {
                              <option [value]="option.value">{{ option.label }}</option>
                            }
                          </select>
                        </div>
                        @if (columnMappingFor(rowIndex, columnIndex)?.textPattern === TextMatchPattern.CUSTOM_REGEX) {
                          <div class="col-md-12">
                            <label class="form-label-sm" [for]="'col-custom-pattern-' + rowIndex + '-' + columnIndex">
                              Custom regex</label>
                            <input type="text" class="form-control"
                                   [id]="'col-custom-pattern-' + rowIndex + '-' + columnIndex"
                                   [ngModel]="columnMappingFor(rowIndex, columnIndex)?.extractPattern || ''"
                                   (ngModelChange)="onColumnMappingProperty(rowIndex, columnIndex, 'extractPattern', $event)"
                                   placeholder="Regex pattern">
                          </div>
                        }
                      }
                    }
                    @if ([TextMatchPattern.TEXT_BEFORE_HEADING].includes(columnMappingFor(rowIndex, columnIndex)?.textPattern)) {
                      <div class="col-md-12">
                        <label class="form-label-sm" [for]="'col-heading-pattern-' + rowIndex + '-' + columnIndex">
                          Heading pattern</label>
                        <input type="text" class="form-control"
                               [id]="'col-heading-pattern-' + rowIndex + '-' + columnIndex"
                               [ngModel]="columnMappingFor(rowIndex, columnIndex)?.extractPattern || ''"
                               (ngModelChange)="onColumnMappingProperty(rowIndex, columnIndex, 'extractPattern', $event)"
                               placeholder="e.g., Points of Interest">
                        <small class="form-text text-muted">Heading text to split on</small>
                      </div>
                    }
                    <div class="col-12">
                      <label class="form-label-sm" [for]="'col-content-type-' + rowIndex + '-' + columnIndex">
                        Content Type</label>
                      <select class="form-select form-select-sm"
                              [id]="'col-content-type-' + rowIndex + '-' + columnIndex"
                              [ngModel]="columnMappingFor(rowIndex, columnIndex)?.contentType || ''"
                              (ngModelChange)="onColumnMappingProperty(rowIndex, columnIndex, 'contentType', $event)">
                        <option value="">Select type...</option>
                        @for (option of columnContentTypeOptions; track option.value) {
                          <option [value]="option.value">{{ option.label }}</option>
                        }
                      </select>
                    </div>
                    @if ([ColumnContentType.IMAGE, ColumnContentType.MIXED].includes(columnMappingFor(rowIndex, columnIndex)?.contentType)) {
                      <div class="col-md-12">
                        <label class="form-label-sm" [for]="'col-image-pattern-' + rowIndex + '-' + columnIndex">
                          Image Pattern</label>
                        <select class="form-select form-select-sm"
                                [id]="'col-image-pattern-' + rowIndex + '-' + columnIndex"
                                [ngModel]="columnMappingFor(rowIndex, columnIndex)?.imagePattern || ''"
                                (ngModelChange)="onColumnMappingProperty(rowIndex, columnIndex, 'imagePattern', $event)">
                          <option value="">Select pattern...</option>
                          @for (option of imagePatternOptions; track option.value) {
                            <option [value]="option.value">{{ option.label }}</option>
                          }
                        </select>
                      </div>
                      @if (columnMappingFor(rowIndex, columnIndex)?.imagePattern === ImageMatchPattern.PATTERN_MATCH) {
                        <div class="col-md-12">
                          <label class="form-label-sm"
                                 [for]="'col-image-pattern-value-' + rowIndex + '-' + columnIndex">
                            Pattern Value</label>
                          <input type="text" class="form-control"
                                 [id]="'col-image-pattern-value-' + rowIndex + '-' + columnIndex"
                                 [ngModel]="columnMappingFor(rowIndex, columnIndex)?.imagePatternValue || ''"
                                 (ngModelChange)="onColumnMappingProperty(rowIndex, columnIndex, 'imagePatternValue', $event)"
                                 placeholder="Regex or filename pattern">
                        </div>
                      }
                    }
                    @if ([ColumnContentType.IMAGE, ColumnContentType.MIXED].includes(columnMappingFor(rowIndex, columnIndex)?.contentType)) {
                      <div class="col-12">
                        <div class="form-check">
                          <input class="form-check-input" type="checkbox"
                                 [id]="'col-group-text-' + rowIndex + '-' + columnIndex"
                                 [ngModel]="columnMappingFor(rowIndex, columnIndex)?.groupShortTextWithImage || false"
                                 (ngModelChange)="onColumnMappingProperty(rowIndex, columnIndex, 'groupShortTextWithImage', $event)">
                          <label class="form-check-label"
                                 [for]="'col-group-text-' + rowIndex + '-' + columnIndex">
                            Group short text following image (captions/labels)
                          </label>
                        </div>
                      </div>
                    }
                    <div class="col-12 mt-2">
                      <label class="form-label-sm" [for]="'col-notes-' + rowIndex + '-' + columnIndex">
                        Documentation notes
                        <small class="text-muted">(describe what this mapping does)</small>
                      </label>
                      <textarea class="form-control"
                                [id]="'col-notes-' + rowIndex + '-' + columnIndex"
                                rows="2"
                                [ngModel]="columnMappingFor(rowIndex, columnIndex)?.notes || ''"
                                (ngModelChange)="onColumnMappingProperty(rowIndex, columnIndex, 'notes', $event)"
                                placeholder="e.g., Extracts the route/map image with caption"></textarea>
                    </div>
                  </div>
                }
              </ng-template>
              @if (!column.rows) {
                <ng-template #rowContentEditing>
                  <div class="thumbnail-site-edit thumbnail-site-edit-content h-100 mt-2"
                       [class.thumbnail-site-edit-content-active]="controlsShown(column)"
                       (dragover)="onColumnDragOver($event, rowIndex, columnIndex)"
                       (drop)="onColumnDrop($event, columnIndex)">
                    <div class="thumbnail-heading thumbnail-heading-column" [attr.draggable]="true"
                         (dragstart)="onColumnDragStart($event, rowIndex, columnIndex)"
                         [tooltip]="actions.columnDragTooltip(rowIndex, columnIndex, isNestedLevel(), parentColumnIndex)"
                         [isOpen]="!!actions.columnDragTooltip(rowIndex, columnIndex, isNestedLevel(), parentColumnIndex)"
                         container="body" triggers="">
                      <span class="column-heading-label">Col {{ columnIndex + 1 }}</span>
                      <span class="column-heading-actions">
                        <app-badge-button noRightMargin
                                          (click)="toggleControls(column)"
                                          [icon]="controlsShown(column) ? faCheck : faSliders"
                                          [caption]="controlsShown(column) ? 'done' : 'settings'"/>
                        <app-badge-button noRightMargin
                                          (click)="actions.deleteColumn(row, columnIndex, pageContent)"
                                          [icon]="faRemove"
                                          [tooltip]="'Delete column'"/>
                        @if (!showContentTextEditor(column)) {
                          <app-badge-button noRightMargin
                                            (click)="revealContentTextEditor(column)"
                                            [icon]="faAdd"
                                            caption="add text"
                                            [tooltip]="'Add text to this column'"/>
                        }
                        @if (controlsShown(column) && !isNarrow(column) && canJoinWithPreviousRow()) {
                          <app-badge-button noRightMargin
                                            (click)="joinWithPreviousRow()"
                                            [icon]="faArrowUp"
                                            [tooltip]="'Join with row above'"/>
                        }
                        @if (controlsShown(column) && !isNarrow(column) && canJoinWithNextRow()) {
                          <app-badge-button noRightMargin
                                            (click)="joinWithNextRow()"
                                            [icon]="faArrowDown"
                                            [tooltip]="'Join with row below'"/>
                        }
                        @if (controlsShown(column) && !isNarrow(column)) {
                          <app-image-actions-dropdown [fullWidth]="false" [hasImage]="!!column.imageSource"
                                                      [hasFixedHeight]="!!column.imageHeight"
                                                      (edit)="editImage(rowIndex, columnIndex)"
                                                      (replace)="replaceImage(column, rowIndex, columnIndex)"
                                                      (remove)="removeImage(column)"
                                                      (clearHeight)="column.imageHeight = null"/>
                          <app-actions-dropdown [columnIndex]="columnIndex" [rowIndex]="rowIndex"
                                                [pageContent]="pageContent" [column]="column" [row]="row"
                                                [fullWidth]="false" [showRowActions]="false"/>
                        }
                        <span class="drag-handle" [attr.draggable]="true"
                              (dragstart)="onColumnDragStart($event, rowIndex, columnIndex)">
                          <fa-icon [icon]="faArrowsUpDown"/>
                        </span>
                      </span>
                    </div>
                    <ng-container [ngTemplateOutlet]="columnMappingControls"></ng-container>
                    <div class="row-content-editing">
                      @if (editActive(rowIndex, columnIndex)) {
                        <div class="mt-2">
                          <app-image-cropper-and-resizer
                            (quit)="exitImageEdit(rowIndex, columnIndex)"
                            (imageChange)="imageChanged(rowIndex, columnIndex, $event)"
                            (apply)="exitImageEdit(rowIndex, columnIndex)"
                            (save)="imagedSaved(rowIndex, columnIndex, column, $event)"
                            [preloadImage]="imageSource(rowIndex, columnIndex, column.imageSource)"
                            [cropperPosition]="column.imageCropperPosition"
                            (cropperPositionChange)="cropperPositionChanged(column, $event)"
                            nonDestructive
                            wrapButtons>
                          </app-image-cropper-and-resizer>
                        </div>
                      }
                      <ng-template #imageSourceControl>
                        <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'name')">
                          Image Source</label>
                        <input [(ngModel)]="column.imageSource"
                               (paste)="onImageSourcePaste($event, rowIndex, columnIndex)"
                               [id]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'name')"
                               type="text" class="form-control">
                      </ng-template>
                      <ng-template #youtubeIdControl>
                        <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'youtube-id')">
                          YouTube Video ID</label>
                        <app-youtube-input
                          [(youtubeId)]="column.youtubeId"
                          [showError]="true"
                          [showPreview]="false"
                          placeholder="Paste URL or enter ID (e.g., dQw4w9WgXcQ)">
                        </app-youtube-input>
                        <small class="form-text text-muted">
                          Paste a YouTube URL and it will be converted to video ID automatically
                        </small>
                      </ng-template>
                      <ng-template #imageAltControl>
                        <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-alt')">
                          Alt Text</label>
                        <input [(ngModel)]="column.alt"
                               [id]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-alt')"
                               type="text" class="form-control"
                               placeholder="Describe image for accessibility">
                      </ng-template>
                      <ng-template #imageLinkControl>
                        <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-link')">
                          Link when clicked</label>
                        <input [(ngModel)]="column.href"
                               [id]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-link')"
                               type="text" class="form-control"
                               placeholder="e.g. publications/the-wealdway or https://...">
                        <small class="form-text text-muted">
                          Makes the image clickable. Leave the text box empty for an image-only link.
                        </small>
                      </ng-template>
                      <ng-template #imageBorderRadiusControl let-styleAttr="style">
                        <label [for]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-border-radius')">
                          Border Radius</label>
                        <input [(ngModel)]="column.imageBorderRadius"
                               [id]="actions.rowColumnIdentifierFor(rowIndex,columnIndex,'image-border-radius')"
                               type="number" class="form-control" [style.max-width]="styleAttr">
                      </ng-template>
                      <ng-template #accessLevelSelectControl>
                        <label
                          [for]="actions.rowColumnIdentifierFor(rowIndex, columnIndex, 'access-level-' + contentPath)">Access</label>
                        <select [(ngModel)]="column.accessLevel"
                                [id]="actions.rowColumnIdentifierFor(rowIndex, columnIndex, 'access-level-' + contentPath)"
                                class="form-control input-sm">
                          @for (accessLevel of memberResourcesReferenceData.accessLevels(); track accessLevel.description) {
                            <option [textContent]="accessLevel.description" [ngValue]="accessLevel.id"></option>
                          }
                        </select>
                      </ng-template>
                      <ng-template #cardImageBlock>
                        <div class="column-image-frame">
                          <app-card-image class="w-100"
                                          [borderRadius]="column.imageBorderRadius"
                                          [padding]="column.imagePadding"
                                          [imageFit]="column.imageFit"
                                          [aspectRatio]="column.imageAspectRatio"
                                          [alt]="column.alt"
                                          [unconstrainedHeight]="!column.imageHeight"
                                          [height]="column.imageHeight"
                                          [focalPoint]="column.imageFocalPoint"
                                          [imageSource]="imageDisplay(rowIndex, columnIndex, column).url"/>
                          @if (controlsShown(column) && column.imageSource) {
                            <app-resizer orientation="vertical" variant="tab"
                              [size]="column.imageHeight || 200"
                              [minSize]="50"
                              [maxSize]="800"
                              [label]="column.imageHeight ? null : 'auto'"
                              [canClear]="!!column.imageHeight"
                              resizeHint="Drag to change the image height"
                              (sizeChange)="onImageHeightChange(column, $event)"
                              (sizeClear)="column.imageHeight = null"
                              compact/>
                          }
                        </div>
                      </ng-template>
                      <ng-template #youtubePreviewBlock>
                        <div class="youtube-embed-container youtube-embed-preview">
                          <app-youtube-embed
                            [youtubeId]="column.youtubeId"
                            [title]="column.alt || 'YouTube video'"/>
                        </div>
                      </ng-template>
                      <div class="d-flex gap-2 align-items-stretch" [ngClass]="'flex-column'">
                        @if (imageDisplay(rowIndex, columnIndex, column).showBefore) {
                          <ng-container [ngTemplateOutlet]="cardImageBlock"></ng-container>
                        }
                        @if (showYoutubeBeforeText(column)) {
                          <ng-container [ngTemplateOutlet]="youtubePreviewBlock"></ng-container>
                        }
                        @if (showContentTextEditor(column)) {
                          <app-content-text-editor class="w-100"
                                               [autoFocus]="textEditorJustRevealed(column)"
                                               (changed)="actions.notifyPageContentTextChange($event, column, pageContent)"
                                               (split)="onSplit($event, rowIndex, columnIndex)"
                                               (htmlPaste)="onHtmlPaste($event, rowIndex, columnIndex)"
                                               [description]="editorDescription(rowIndex, columnIndex)"
                                               [text]="column.contentText"
                                               [styles]="columnStyles(column)"
                                               [parentRowColumnCount]="row.columns?.length"
                                               [name]="actions.parentRowColFor(parentRowIndex, rowIndex, columnIndex, parentColumnIndex)"
                                               [category]="contentPath">
                            <ng-container prepend/>
                          </app-content-text-editor>
                        }
                        @if (showYoutubeAfterText(column)) {
                          <ng-container [ngTemplateOutlet]="youtubePreviewBlock"></ng-container>
                        }
                        @if (imageDisplay(rowIndex, columnIndex, column).showAfter) {
                          <ng-container [ngTemplateOutlet]="cardImageBlock"></ng-container>
                        }
                      </div>
                      <ng-template #placeholderToggle>
                        <div class="form-check form-check-inline mb-0">
                          <input [name]="checkboxId('show-placeholder-image', columnIndex)" type="checkbox"
                                 class="form-check-input"
                                 [id]="checkboxId('show-placeholder-image', columnIndex)"
                                 [checked]="column.showPlaceholderImage"
                                 (change)="onShowPlaceholderImageChanged($event, column)">
                          <label class="form-check-label" [for]="checkboxId('show-placeholder-image', columnIndex)">
                            Show Placeholder Image</label>
                        </div>
                      </ng-template>
                      @if (controlsShown(column)) {
                        <div class="form-group mt-2">
                          <div class="form-check form-check-inline mb-0 me-4">
                            <input [name]="checkboxId('show-text-after-image', columnIndex)"
                                   type="checkbox" class="form-check-input"
                                   [id]="checkboxId('show-text-after-image', columnIndex)"
                                   [(ngModel)]="column.showTextAfterImage">
                            <label class="form-check-label" [for]="checkboxId('show-text-after-image', columnIndex)">
                              Text After Image</label>
                          </div>
                          @if (!column.imageSource && !isNarrow(column)) {
                            <ng-container [ngTemplateOutlet]="placeholderToggle"></ng-container>
                          }
                        </div>
                      }
                      @if (controlsShown(column)) {
                        @if (isNarrow(column)) {
                          <div class="row mt-2">
                            <div class="col-sm-12">
                              <ng-container [ngTemplateOutlet]="imageSourceControl"></ng-container>
                            </div>
                            <div class="col-sm-12">
                              <ng-container [ngTemplateOutlet]="youtubeIdControl"></ng-container>
                            </div>
                            <div class="col-sm-12">
                              <ng-container [ngTemplateOutlet]="imageAltControl"></ng-container>
                            </div>
                            <div class="col-sm-12">
                              <ng-container [ngTemplateOutlet]="imageLinkControl"></ng-container>
                            </div>
                            <div class="col-sm-12">
                              <ng-container [ngTemplateOutlet]="imageBorderRadiusControl"></ng-container>
                            </div>
                          </div>
                        } @else {
                          <div class="row mt-2">
                            <div class="col-12">
                              <ng-container [ngTemplateOutlet]="imageSourceControl"></ng-container>
                            </div>
                          </div>
                          <div class="row mt-2">
                            <div class="col-12">
                              <ng-container [ngTemplateOutlet]="youtubeIdControl"></ng-container>
                            </div>
                          </div>
                          <div class="row mt-2">
                            <div class="col">
                              <ng-container [ngTemplateOutlet]="imageAltControl"></ng-container>
                            </div>
                            <div class="col-auto">
                              <ng-container [ngTemplateOutlet]="imageBorderRadiusControl"
                                            [ngTemplateOutletContext]="{style: '140px'}"></ng-container>
                            </div>
                          </div>
                          <div class="row mt-2">
                            <div class="col-12">
                              <ng-container [ngTemplateOutlet]="imageLinkControl"></ng-container>
                            </div>
                          </div>
                        }
                      }
                      @if (controlsShown(column)) {
                        @if (!column.imageSource && isNarrow(column)) {
                          <div class="form-group">
                            <div class="form-check form-check-inline mb-0 me-4">
                              <ng-container [ngTemplateOutlet]="placeholderToggle"></ng-container>
                            </div>
                          </div>
                        }
                        @if (column.imageSource || column.showPlaceholderImage) {
                          <div class="form-group">
                            <app-aspect-ratio-selector label="Image Aspect Ratio"
                                                       [dimensionsDescription]="column.imageAspectRatio?.description"
                                                       (dimensionsChanged)="onImageAspectRatioChanged(column, $event)"></app-aspect-ratio-selector>
                          </div>
                          <app-column-image-display-settings
                            [column]="column"
                            [imageSrc]="imageDisplay(rowIndex, columnIndex, column).url"
                            [idPrefix]="checkboxId('image-display', columnIndex)"
                            [previewHeight]="column.imageHeight"/>
                        }
                        @if (isNarrow(column)) {
                          <div class="d-flex gap-2 mt-2" [ngClass]="'flex-column'">
                            <div class="w-100">
                              <app-image-actions-dropdown [fullWidth]="true" [hasImage]="!!column.imageSource"
                                                          [hasFixedHeight]="!!column.imageHeight"
                                                          (edit)="editImage(rowIndex, columnIndex)"
                                                          (replace)="replaceImage(column, rowIndex, columnIndex)"
                                                          (remove)="removeImage(column)"
                                                          (clearHeight)="column.imageHeight = null"/>
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
                            <ng-container [ngTemplateOutlet]="accessLevelSelectControl"></ng-container>
                          </div>
                        } @else {
                          <div class="row g-2 mt-2 align-items-end">
                            <div class="col-auto">
                              <app-column-width [column]="column" (expandToggle)="expanded=$event"/>
                            </div>
                            <div class="col">
                              <ng-container [ngTemplateOutlet]="accessLevelSelectControl"></ng-container>
                            </div>
                          </div>
                        }
                      }
                    </div>
                  </div>
                </ng-template>
                <ng-container [ngTemplateOutlet]="rowContentEditing"></ng-container>
              }
              @if (column.rows) {
                <ng-template #columnNestedRows>
                  <div class="column-nested-rows">
                    <div class="thumbnail-site-edit" (dragover)="onColumnDragOver($event, rowIndex, columnIndex)"
                         (drop)="onColumnDrop($event, columnIndex)">
                      <div class="thumbnail-heading" [attr.draggable]="true"
                           (dragstart)="onColumnDragStart($event, rowIndex, columnIndex)"
                           [tooltip]="actions.columnDragTooltip(rowIndex, columnIndex, isNestedLevel(), parentColumnIndex)"
                           [isOpen]="!!actions.columnDragTooltip(rowIndex, columnIndex, isNestedLevel(), parentColumnIndex)"
                           container="body"
                           triggers="">
                        {{ actions.nestedRowHeading(rowIndex, columnIndex, column.rows?.length) }}
                        <span class="drag-handle ms-2 float-end" [attr.draggable]="true"
                              (dragstart)="onColumnDragStart($event, rowIndex, columnIndex)">
                      <fa-icon [icon]="faArrowsUpDown"/>
                    </span>
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
                      <ng-container [ngTemplateOutlet]="columnMappingControls"></ng-container>
                      @if (allowColumnMappings && column.rows && column.rows.length > 0 && isMigrationTemplateSelected && isMigrationTemplateSelected() && templateMappingMode && columnMapping) {
                        <div class="row thumbnail-heading-frame thumbnail-heading-mapping-mode">
                          <div class="thumbnail-heading">Nested Rows Configuration</div>
                          @if (columnMappingFor(rowIndex, columnIndex)?.sourceType === MigrationTemplateSourceType.EXTRACT) {
                              <div class="row">
                                <div class="col-md-12">
                                  <label class="form-label-sm" [for]="'col-packing-' + rowIndex + '-' + columnIndex">
                                    Packing behavior</label>
                                  <select class="form-select form-select-sm"
                                          [id]="'col-packing-' + rowIndex + '-' + columnIndex"
                                          [ngModel]="columnMappingFor(rowIndex, columnIndex)?.nestedRowMapping?.packingBehavior || ''"
                                          (ngModelChange)="onNestedRowMappingUpdate(rowIndex, columnIndex, {packingBehavior: $event})">
                                    <option value="">Select behavior...</option>
                                    <option value="one-per-item">One row per item</option>
                                    <option value="all-in-one">All in one row</option>
                                    <option value="collect-with-breaks">Collect with breaks</option>
                                  </select>
                                  <small class="form-text text-muted">How to distribute content across nested
                                    rows</small>
                                </div>
                                <div class="col-md-12">
                                  <label class="form-label-sm"
                                         [for]="'col-content-source-' + rowIndex + '-' + columnIndex">
                                    Content type</label>
                                  <select class="form-select form-select-sm"
                                          [id]="'col-content-source-' + rowIndex + '-' + columnIndex"
                                          [ngModel]="columnMappingFor(rowIndex, columnIndex)?.nestedRowMapping?.contentSource || ''"
                                          (ngModelChange)="onNestedRowMappingUpdate(rowIndex, columnIndex, {contentSource: $event})">
                                    <option value="">Select source...</option>
                                    <option value="remaining-images">Remaining images</option>
                                    <option value="remaining-text">Remaining text</option>
                                    <option value="all-content">All content</option>
                                    <option value="all-images">All images</option>
                                    <option value="pattern-match">Pattern match</option>
                                  </select>
                                  <small class="form-text text-muted">What content to extract from source page</small>
                                </div>
                                @if (columnMappingFor(rowIndex, columnIndex)?.nestedRowMapping?.contentSource === NestedRowContentSource.PATTERN_MATCH) {
                                  @if (templateExtractOptions?.length) {
                                    <div class="col-12">
                                      <label class="form-label-sm"
                                             [for]="'col-pattern-' + rowIndex + '-' + columnIndex">
                                        Text pattern</label>
                                      <select class="form-select form-select-sm"
                                              [id]="'col-pattern-' + rowIndex + '-' + columnIndex"
                                              [ngModel]="columnMappingFor(rowIndex, columnIndex)?.nestedRowMapping?.textPattern || ''"
                                              (ngModelChange)="onNestedRowMappingUpdate(rowIndex, columnIndex, {textPattern: $event})">
                                        <option value="">Select pattern...</option>
                                        @for (option of templateExtractOptions; track option.value) {
                                          <option [value]="option.value">{{ option.label }}</option>
                                        }
                                      </select>
                                      <small class="form-text text-muted">Choose how to split narrative text</small>
                                    </div>
                                  } @else {
                                    <div class="col-12">
                                      <label class="form-label-sm"
                                             [for]="'col-pattern-' + rowIndex + '-' + columnIndex">
                                        Pattern</label>
                                      <input type="text" class="form-control"
                                             [id]="'col-pattern-' + rowIndex + '-' + columnIndex"
                                             [ngModel]="columnMappingFor(rowIndex, columnIndex)?.nestedRowMapping?.textPattern || ''"
                                             (ngModelChange)="onNestedRowMappingUpdate(rowIndex, columnIndex, {textPattern: $event})"
                                             placeholder="Regex pattern">
                                      <small class="form-text text-muted">Regular expression to match content</small>
                                    </div>
                                  }
                                  @if (columnMappingFor(rowIndex, columnIndex)?.nestedRowMapping?.textPattern === TextMatchPattern.CUSTOM_REGEX) {
                                    <div class="col-12">
                                      <label class="form-label-sm"
                                             [for]="'col-custom-pattern-' + rowIndex + '-' + columnIndex">
                                        Custom regex</label>
                                      <input type="text" class="form-control"
                                             [id]="'col-custom-pattern-' + rowIndex + '-' + columnIndex"
                                             [ngModel]="columnMappingFor(rowIndex, columnIndex)?.nestedRowMapping?.customTextPattern || ''"
                                             (ngModelChange)="onNestedRowMappingUpdate(rowIndex, columnIndex, {customTextPattern: $event})"
                                             placeholder="Regex pattern">
                                      <small class="form-text text-muted">Regular expression applied to source text</small>
                                    </div>
                                  }
                                  @if ([TextMatchPattern.TEXT_BEFORE_HEADING, TextMatchPattern.TEXT_FROM_HEADING, TextMatchPattern.HEADING_UNTIL_NEXT_HEADING, TextMatchPattern.FIRST_HEADING_AND_CONTENT].includes(columnMappingFor(rowIndex, columnIndex)?.nestedRowMapping?.textPattern)) {
                                    <div class="col-12">
                                      <label class="form-label-sm"
                                             [for]="'col-heading-pattern-' + rowIndex + '-' + columnIndex">
                                        Heading pattern</label>
                                      <input type="text" class="form-control"
                                             [id]="'col-heading-pattern-' + rowIndex + '-' + columnIndex"
                                             [ngModel]="columnMappingFor(rowIndex, columnIndex)?.nestedRowMapping?.headingPattern || ''"
                                             (ngModelChange)="onNestedRowMappingUpdate(rowIndex, columnIndex, {headingPattern: $event})"
                                             placeholder="e.g., Points of Interest">
                                      <small class="form-text text-muted">Heading text to split on</small>
                                    </div>
                                  }
                                }
                                @if ([NestedRowContentSource.REMAINING_IMAGES, NestedRowContentSource.ALL_IMAGES].includes(columnMappingFor(rowIndex, columnIndex)?.nestedRowMapping?.contentSource)) {
                                  <div class="col-12">
                                    <div class="form-check">
                                      <input class="form-check-input"
                                             type="checkbox"
                                             [id]="'col-group-text-' + rowIndex + '-' + columnIndex"
                                             [ngModel]="columnMappingFor(rowIndex, columnIndex)?.nestedRowMapping?.groupTextWithImage || false"
                                             (ngModelChange)="onNestedRowMappingUpdate(rowIndex, columnIndex, {groupTextWithImage: $event})">
                                      <label class="form-check-label"
                                             [for]="'col-group-text-' + rowIndex + '-' + columnIndex">
                                        Group short text with image
                                      </label>
                                    </div>
                                    <small class="form-text text-muted">When enabled, nearby short text (< 100 chars)
                                      will be associated with images as captions</small>
                                  </div>
                                }
                                <div class="col-12 mt-2">
                                  <label class="form-label-sm" [for]="'col-notes-nested-' + rowIndex + '-' + columnIndex">
                                    Documentation notes
                                    <small class="text-muted">(describe what this nested row mapping does)</small>
                                  </label>
                                  <textarea class="form-control"
                                            [id]="'col-notes-nested-' + rowIndex + '-' + columnIndex"
                                            rows="2"
                                            [ngModel]="columnMappingFor(rowIndex, columnIndex)?.notes || ''"
                                            (ngModelChange)="onColumnMappingProperty(rowIndex, columnIndex, 'notes', $event)"
                                            placeholder="e.g., Points-of-interest sidebar with remaining images"></textarea>
                                </div>
                              </div>
                          } @else {
                            <alert type="warning" class="flex-grow-1">
                              <fa-icon [icon]="ALERT_WARNING.icon"/>
                              <strong class="ms-2">Mapping Source{{ EM_DASH_WITH_SPACES }}</strong>
                              <span class="ms-1">Switch to "Extract from source content" to enable dynamic nested row generation</span>
                            </alert>
                          }
                        </div>

                      }
                      @for (nestedRow of column.rows; track nestedRow; let nestedRowIndex = $index) {
                        <div class="thumbnail-site-edit mt-3"
                             (dragover)="onNestedRowDragOver(columnIndex, nestedRowIndex, $event)"
                             (drop)="onNestedRowDrop(columnIndex, nestedRowIndex)">
                          <div class="thumbnail-heading" [attr.draggable]="true"
                               (dragstart)="onNestedRowDragStart(columnIndex, nestedRowIndex)"
                               (dragend)="onNestedRowDragEnd()"
                               [tooltip]="actions.nestedRowDragTooltip(columnIndex, nestedRowIndex)"
                               [isOpen]="!!actions.nestedRowDragTooltip(columnIndex, nestedRowIndex)" container="body"
                               triggers="">
                            {{actions.nestedRowDescription(nestedRowIndex, columnIndex, nestedRow?.columns?.length)}}
                            <app-badge-button class="ms-2"
                                              (click)="actions.deleteRow(pageContent, nestedRowIndex, true, column)"
                                              [icon]="faRemove"
                                              [tooltip]="'Delete nested row'"/>
                            @if (showPlaceholderToggle(columnIndex)) {
                              <app-badge-button class="ms-2"
                                                [active]="nestedRow.migrationPlaceholder"
                                                [icon]="faLayerGroup"
                                                [caption]="nestedRow.migrationPlaceholder ? 'Dynamic target' : 'Use as dynamic target'"
                                                [tooltip]="placeholderTooltip(nestedRow)"
                                                (click)="togglePlaceholder(nestedRow)"/>
                            }
                            <span class="drag-handle ms-2 float-end" [attr.draggable]="true"
                                  (dragstart)="onNestedRowDragStart(columnIndex, nestedRowIndex)">
                          <fa-icon [icon]="faArrowsUpDown"/>
                        </span>
                          </div>
                          <div class="row g-2 align-items-end mb-3">
                            <div class="col-12 col-sm-6">
                              <app-row-type-selector
                                [row]="nestedRow"
                                [rowIndex]="nestedRowIndex"
                                [contentPath]="contentPath"
                                (typeChange)="onNestedRowTypeChange(nestedRow)"/>
                            </div>
                            <div class="col-6 col-sm-3">
                              <app-margin-select label="Margin Top"
                                                 [data]="nestedRow"
                                                 field="marginTop"/>
                            </div>
                            <div class="col-6 col-sm-3">
                              <app-margin-select label="Margin Bottom"
                                                 [data]="nestedRow"
                                                 field="marginBottom"/>
                            </div>
                            @if ((nestedRow.columns?.length || 0) > 1) {
                              <div class="col-6 col-sm-3">
                                <app-margin-select label="Column gap"
                                                   [data]="nestedRow"
                                                   field="gutter"
                                                   noneLabel="default"
                                                   [minValue]="0"
                                                   [maxValue]="5"/>
                              </div>
                            }
                            <div class="col-12 col-sm-auto">
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
                                <label [for]="'nested-shared-fragment-path-' + rowIndex + '-' + nestedRowIndex">
                                  Shared Fragment</label>
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
                            [rootRowIndex]="rootRowIndex ?? rowIndex"
                            [rootColumnIndex]="rootColumnIndex ?? columnIndex"
                            [parentRowIndex]="rowIndex"
                            [parentColumnIndex]="columnIndex"
                            [rowIndex]="nestedRowIndex"
                            [contentDescription]="contentDescription"
                            [contentPath]="contentPath"
                            [pageContent]="pageContent"
                            [isMigrationTemplateSelected]="isMigrationTemplateSelected"
                            [templateMappingMode]="templateMappingMode"
                            [columnMapping]="columnMapping"
                            (columnMappingSourceChange)="columnMappingSourceChange.emit($event)"
                            (columnNestedRowMappingUpdate)="columnNestedRowMappingUpdate.emit($event)"
                            (columnMappingPropertyUpdate)="columnMappingPropertyUpdate.emit($event)"
                            [columnContentTypeOptions]="columnContentTypeOptions"
                            [imagePatternOptions]="imagePatternOptions"
                            [templateSourceOptions]="templateSourceOptions"
                            [templateExtractOptions]="templateExtractOptions"
                            [allowColumnMappings]="allowColumnMappings"/>
                          @if (actions.isMap(nestedRow) || actions.isRoute(nestedRow)) {
                            @if (actions.isRoute(nestedRow)) {
                              <app-dynamic-content-site-edit-route [row]="nestedRow" [id]="'nested-route-' + rowIndex + '-' + columnIndex + '-' + nestedRowIndex"/>
                            }
                            <app-dynamic-content-site-edit-map
                              [row]="nestedRow"
                              [id]="'nested-map-' + rowIndex + '-' + columnIndex + '-' + nestedRowIndex"
                              [pageContent]="pageContent"/>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </ng-template>
                <ng-container [ngTemplateOutlet]="columnNestedRows"></ng-container>
              }
              @if (columnIndex < row.columns.length - 1 && !expanded) {
                <app-resizer orientation="horizontal" variant="handle" mode="grid"
                  [leftColumn]="column"
                  [rightColumn]="row.columns[columnIndex + 1]"/>
              }
            </div>
          }
          @if ((row?.columns?.length || 0) === 0) {
            <div class="col-12">
              <div class="row-empty-drop-zone">
                <div
                  class="thumbnail-site-edit h-100 mt-2 empty-drop-zone d-flex align-items-center justify-content-center"
                  (dragover)="allowDrop($event)" (drop)="onEmptyRowDrop()">
                  <div class="text-muted">Drop column here</div>
                </div>
              </div>
            </div>
          }
        </div>
      }`,
    styleUrls: ["./dynamic-content.sass"],
    imports: [ContentTextEditor, FormsModule, ColumnWidthComponent, BadgeButtonComponent, ActionsDropdownComponent, ImageCropperAndResizerComponent, CardImageComponent, NgClass, MarginSelectComponent, AspectRatioSelectorComponent, ImageActionsDropdownComponent, TooltipDirective, RowTypeSelectorComponent, FragmentSelectorComponent, DynamicContentViewComponent, FontAwesomeModule, NgTemplateOutlet, DynamicContentSiteEditMap, DynamicContentSiteEditRoute, AlertComponent, YoutubeEmbed, YoutubeInputComponent, ResizerComponent, ColumnImageDisplaySettingsComponent]
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
  private fileUtils = inject(FileUtilsService);
  private clipboardService = inject(ClipboardService);

  @Input()
  public row: PageContentRow;
  @Input()
  public parentRowIndex: number;
  @Input()
  public parentColumnIndex: number;
  @Input()
  public rootRowIndex?: number;
  @Input()
  public rootColumnIndex?: number;
  @Input()
  public rowIndex: number;
  @Input()
  public contentDescription: string;
  @Input()
  public contentPath: string;
  @Input()
  public pageContent: PageContent;
  @Input()
  public isMigrationTemplateSelected?: () => boolean;
  @Input()
  public templateMappingMode?: boolean;
  @Input()
  public columnMapping?: (rowIndex: number, columnIndex: number, nestedRowIndex?: number, nestedColumnIndex?: number) => any;
  @Input()
  public columnContentTypeOptions?: {value: string; label: string}[];
  @Input()
  public imagePatternOptions?: {value: string; label: string}[];
  @Input()
  public templateSourceOptions?: {value: string; label: string}[];
  @Input()
  public templateExtractOptions?: {value: string; label: string}[];
  @Input()
  public allowColumnMappings = true;

  @Output()
  public columnMappingSourceChange = new EventEmitter<ColumnMappingContext & {value: any}>();
  @Output()
  public columnNestedRowMappingUpdate = new EventEmitter<ColumnMappingContext & {updates: any}>();
  @Output()
  public columnMappingPropertyUpdate = new EventEmitter<ColumnMappingContext & {key: string; value: any}>();
  faAdd = faAdd;
  faLayerGroup = faLayerGroup;
  public pageContentEditEvents: PageContentEditEvent[] = [];
  private uniqueCheckboxId: string;
  private controlsVisible = new WeakMap<PageContentColumn, boolean>();
  private textEditorRevealed = new WeakMap<PageContentColumn, boolean>();
  private textEditorAwaitingFocus: PageContentColumn = null;
  protected readonly faRemove = faRemove;
  protected readonly faArrowUp = faArrowUp;
  protected readonly faArrowDown = faArrowDown;
  protected readonly faArrowsUpDown = faArrowsUpDown;
  protected readonly faCheck = faCheck;
  protected readonly faSliders = faSliders;
  protected readonly ALERT_WARNING = ALERT_WARNING;
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;
  protected readonly TextMatchPattern = TextMatchPattern;
  protected readonly ColumnContentType = ColumnContentType;
  protected readonly ImageMatchPattern = ImageMatchPattern;
  protected readonly NestedRowContentSource = NestedRowContentSource;
  protected readonly MigrationTemplateSourceType = MigrationTemplateSourceType;

  ngOnInit() {
    this.uniqueCheckboxId = `text-row-${this.numberUtils.generateUid()}`;
    this.logger.info("ngOnInit called for", this.row, "containing", this.stringUtils.pluraliseWithCount(this.row?.columns.length, "column"));
    this.loadNestedFragments();
  }

  columnMappingFor(rowIndex: number, columnIndex: number) {
    if (!this.columnMapping) {
      return undefined;
    }
    const context = this.mappingContext(rowIndex, columnIndex);
    return this.columnMapping(context.rowIndex, context.columnIndex, context.nestedRowIndex, context.nestedColumnIndex);
  }

  onColumnMappingSource(rowIndex: number, columnIndex: number, value: any) {
    const context = this.mappingContext(rowIndex, columnIndex);
    this.columnMappingSourceChange.emit({...context, value});
  }

  onColumnMappingProperty(rowIndex: number, columnIndex: number, key: string, value: any) {
    const context = this.mappingContext(rowIndex, columnIndex);
    this.columnMappingPropertyUpdate.emit({...context, key, value});
  }

  onNestedRowMappingUpdate(rowIndex: number, columnIndex: number, updates: any) {
    const context = this.mappingContext(rowIndex, columnIndex);
    this.columnNestedRowMappingUpdate.emit({...context, updates});
  }

  private mappingContext(rowIndex: number, columnIndex: number): ColumnMappingContext {
    const resolvedRowIndex = this.rootRowIndex ?? this.parentRowIndex ?? rowIndex;
    if (this.parentColumnIndex == null) {
      return {rowIndex: resolvedRowIndex, columnIndex};
    } else {
      const resolvedColumnIndex = this.rootColumnIndex ?? this.parentColumnIndex;
      return {
        rowIndex: resolvedRowIndex,
        columnIndex: resolvedColumnIndex,
        nestedRowIndex: this.rowIndex,
        nestedColumnIndex: columnIndex
      };
    }
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

  checkboxId(suffix: string, columnIndex: number): string {
    return `${this.uniqueCheckboxId}-col-${columnIndex}-${suffix}`;
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

  onImageHeightChange(column: PageContentColumn, height: number) {
    column.imageHeight = height;
    if (!column.imageFit) {
      column.imageFit = ImageFit.COVER;
    }
    if (!column.imageFocalPoint) {
      column.imageFocalPoint = {x: 50, y: 50, zoom: 1};
    }
  }

  removeImage(column: PageContentColumn) {
    column.imageSource = null;
    column.imageCropperPosition = null;
    column.imageFocalPoint = null;
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

  cropperPositionChanged(column: PageContentColumn, position: ImageCropperPosition) {
    if (column) {
      column.imageCropperPosition = position || null;
    }
  }

  async onImageSourcePaste(event: ClipboardEvent, rowIndex: number, columnIndex: number) {
    const file = this.clipboardService.imageFileFromPasteEvent(event);
    if (file) {
      event.preventDefault();
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
    column.imageCropperPosition = null;
    this.pageContentEditEvents = this.pageContentEditService.handleEvent({
      path: this.pageContent.path,
      rowIndex,
      columnIndex,
      editActive: false
    }, this.pageContentEditEvents);
  }

  isNarrow(column: PageContentColumn): boolean {
    return (column.columns || 12) <= 6;
  }

  focusSensitiveColumns(pageContentColumn: PageContentColumn) {
    return this.expanded ? 12 : (pageContentColumn.columns || 12);
  }

  showPlaceholderToggle(columnIndex: number): boolean {
    const mappingModeReady = !!(this.isMigrationTemplateSelected && this.columnMapping && this.templateMappingMode
      && this.isMigrationTemplateSelected());
    const mapping = mappingModeReady ? this.columnMappingFor(this.rowIndex, columnIndex) : null;
    return mappingModeReady && mapping?.sourceType === "extract";
  }

  togglePlaceholder(row: PageContentRow) {
    row.migrationPlaceholder = !row.migrationPlaceholder;
  }

  placeholderTooltip(row: PageContentRow): string {
    return row.migrationPlaceholder ? "Dynamic content will replace this nested row during migration" : "Use this nested row as the template for generated content";
  }

  allowDrop($event: DragEvent) { $event.preventDefault(); }

  onColumnDragStart(event: DragEvent, rowIndex: number, columnIndex: number) {
    this.actions.draggedColumnRowIndex = rowIndex;
    this.actions.draggedColumnIndex = columnIndex;
    this.actions.draggedColumnSourceRow = this.row;
    this.actions.draggedRowIndex = null;
    this.actions.draggedColumnIsNested = this.isNestedLevel();
    this.actions.draggedColumnParentColumnIndex = this.parentColumnIndex;
    this.actions.dragStartX = event?.clientX;
    this.actions.dragStartY = event?.clientY;
    this.actions.dragHasMovedEvent(event)
  }


  onNestedRowDragOver(columnIndex: number, nestedRowIndex: number, $event: DragEvent) {
    $event.preventDefault();
    this.actions.nestedDragTargetColumnIndex = columnIndex;
    this.actions.nestedDragTargetRowIndex = nestedRowIndex;
  }

  onNestedRowDragEnd() {
    this.actions.clearNestedDragTargets();
  }

  onColumnDrop($event: DragEvent, targetColumnIndex: number) {
    $event.preventDefault();
    $event.stopPropagation();
    const sourceColumnIndex = this.actions.draggedColumnIndex;
    const sourceRow = this.actions.draggedColumnSourceRow;
    const targetRow = this.row;
    const canDrop = this.actions.draggedColumnIsNested === this.isNestedLevel()
      && !this.actions.isActionButtons(this.actions.draggedColumnSourceRow)
      && sourceRow != null
      && sourceColumnIndex != null;
    if (canDrop) {
      const insertAfter = this.actions.dragInsertAfter && this.actions.dragOverColumnRowIndex === this.rowIndex && this.actions.dragOverColumnIndex === targetColumnIndex;
      if (sourceRow === targetRow && sourceColumnIndex === targetColumnIndex && !insertAfter) {
        this.actions.clearColumnDragState();
      } else if (sourceRow === targetRow) {
        this.actions.moveColumnWithinRow(targetRow.columns, sourceColumnIndex, targetColumnIndex, insertAfter);
        this.actions.clearColumnDragState();
      } else {
        this.actions.moveColumnBetweenRows(sourceRow, sourceColumnIndex, targetRow, targetColumnIndex + (insertAfter ? 1 : 0));
        this.actions.clearColumnDragState();
      }
    }
  }

  onEmptyRowDrop() {
    const sourceColumnIndex = this.actions.draggedColumnIndex;
    const sourceRow = this.actions.draggedColumnSourceRow;
    const targetRow = this.row;
    if (!this.actions.isActionButtons(this.actions.draggedColumnSourceRow) && sourceRow != null && sourceColumnIndex != null) {
      this.actions.moveColumnToEmptyRow(sourceRow, sourceColumnIndex, targetRow, this.pageContent);
      this.actions.clearColumnDragState();
    }
  }

  onColumnDragOver($event: DragEvent, rowIndex: number, columnIndex: number) {
    $event.preventDefault();
    $event.stopPropagation();
    if (this.actions.draggedColumnIsNested !== this.isNestedLevel()) { return; }
    if (this.actions.isActionButtons(this.actions.draggedColumnSourceRow)) { return; }
    const dx = ($event?.clientX || 0) - (this.actions.dragStartX || 0);
    const dy = ($event?.clientY || 0) - (this.actions.dragStartY || 0);
    if (!this.actions.dragHasMoved && (Math.abs(dx) + Math.abs(dy) > 3)) { this.actions.dragHasMoved = true; }
    this.autoScrollViewport($event?.clientY || 0);
    const rect = ($event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = $event.clientX - rect.left;
    this.actions.dragOverColumnRowIndex = rowIndex;
    this.actions.dragOverColumnIndex = columnIndex;
    this.actions.dragOverColumnParentColumnIndex = this.parentColumnIndex;
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



  public isNestedLevel(): boolean {
    return this.parentRowIndex != null;
  }

  onNestedRowDragStart(columnIndex: number, nestedRowIndex: number) {
    this.actions.draggedNestedColumnIndex = columnIndex;
    this.actions.draggedNestedRowIndex = nestedRowIndex;
  }

  onNestedRowDrop(targetColumnIndex: number, targetNestedRowIndex: number) {
    const sourceColumnIndex = this.actions.draggedNestedColumnIndex;
    const sourceNestedRowIndex = this.actions.draggedNestedRowIndex;
    if (sourceColumnIndex != null && sourceNestedRowIndex != null) {
      if (sourceColumnIndex === targetColumnIndex && sourceNestedRowIndex === targetNestedRowIndex) {
        this.actions.clearNestedRowDragState();
      } else {
        this.actions.moveNestedRowBetweenColumns(this.row, sourceColumnIndex, sourceNestedRowIndex, targetColumnIndex, targetNestedRowIndex);
        this.actions.clearNestedRowDragState();
      }
    }
  }

  private resolveActualImage(rowIndex: number, columnIndex: number, column: PageContentColumn): string | null {
    return this.imageSource(rowIndex, columnIndex, column.imageSource) || null;
  }

  imageDisplay(rowIndex: number, columnIndex: number, column: PageContentColumn): { showBefore: boolean; showAfter: boolean; url: string | null } {
    if (this.hasYoutubeVideo(column)) {
      return { showBefore: false, showAfter: false, url: null };
    }
    const actual = this.resolveActualImage(rowIndex, columnIndex, column);
    const hasActual = !!actual;
    const showPlaceholder = !!column.showPlaceholderImage && !hasActual;
    const show = hasActual || showPlaceholder;
    const before = show && !!column.showTextAfterImage;
    const after = show && !column.showTextAfterImage;
    const url = showPlaceholder ? FALLBACK_MEDIA.url : actual;
    return { showBefore: before, showAfter: after, url };
  }

  hasYoutubeVideo(column: PageContentColumn): boolean {
    return !!column.youtubeId;
  }

  showYoutubeBeforeText(column: PageContentColumn): boolean {
    return !!column.showTextAfterImage && this.hasYoutubeVideo(column);
  }

  showYoutubeAfterText(column: PageContentColumn): boolean {
    return !column.showTextAfterImage && this.hasYoutubeVideo(column);
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
    if (splitData.textAfter != null) {
      rowsToInsert.push(this.createRowFromSplitRow({text: splitData.textAfter}));
    }
    if (splitData.additionalRows && splitData.additionalRows.length > 0) {
      for (const additionalText of splitData.additionalRows) {
        rowsToInsert.push(this.createRowFromSplitRow({text: additionalText}));
      }
    }
    if (rowsToInsert.length > 0) {
      this.processRowInsert(rowsToInsert, rowIndex, columnIndex, splitData.createNested, column);
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
        this.processRowInsert(rowsToInsert, rowIndex, columnIndex, result.createNested, column);
      }
    }

    this.logger.info("═══ onHtmlPaste END ═══");
  }

  private createRowFromSplitRow(rowData: HtmlPasteRow): PageContentRow {
    const newRow: PageContentRow = this.actions.defaultRowFor("text");
    const newColumn = newRow.columns && newRow.columns.length > 0 ? newRow.columns[0] : null;
    if (newColumn) {
      if (rowData.text != null) {
        newColumn.contentText = rowData.text;
      }
      if (rowData.imageSource != null) {
        newColumn.imageSource = rowData.imageSource;
      }
      if (rowData.alt != null) {
        newColumn.alt = rowData.alt;
      }
    }
    this.logger.info("Created new row from split, text length:", newColumn?.contentText?.length, "has image:", !!newColumn?.imageSource);
    return newRow;
  }

  private processRowInsert(rowsToInsert: PageContentRow[], rowIndex: number, columnIndex: number, userChoice: boolean | undefined, column: PageContentColumn) {
    const parentRowHasMultipleColumns = (this.row.columns?.length || 0) > 1;
    const createNestedRows = userChoice != null ? userChoice : parentRowHasMultipleColumns;
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

  private insertRowsAfterCurrent(rowsToInsert: PageContentRow[], rowIndex: number, _columnIndex: number) {
    if (!rowsToInsert || rowsToInsert.length === 0) {
      return;
    }

    const isNestedRow = this.parentRowIndex != null;
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

  toggleControls(column: PageContentColumn) {
    this.controlsVisible.set(column, !this.controlsShown(column));
  }

  controlsShown(column: PageContentColumn): boolean {
    return this.controlsVisible.get(column) || false;
  }

  columnHasMedia(column: PageContentColumn): boolean {
    return !!(column.imageSource || column.showPlaceholderImage || column.youtubeId);
  }

  columnHasText(column: PageContentColumn): boolean {
    return !!(column.contentText || "").trim();
  }

  columnStyles(column: PageContentColumn): ContentTextStyles {
    if (!column.styles) {
      column.styles = {list: null, class: null};
    }
    return column.styles;
  }

  editorDescription(rowIndex: number, columnIndex: number): string {
    const nestedId = this.actions.parentRowColFor(this.parentRowIndex, rowIndex, columnIndex, this.parentColumnIndex);
    return this.contentDescription ? `${this.contentDescription}-${nestedId}` : nestedId;
  }

  showContentTextEditor(column: PageContentColumn): boolean {
    const showEditor = this.textEditorRevealed.get(column)
      || this.columnHasText(column)
      || !this.columnHasMedia(column);
    return showEditor;
  }

  revealContentTextEditor(column: PageContentColumn) {
    this.textEditorRevealed.set(column, true);
    this.textEditorAwaitingFocus = column;
    if (column.contentText == null) {
      column.contentText = "";
    }
  }

  textEditorJustRevealed(column: PageContentColumn): boolean {
    return this.textEditorAwaitingFocus === column;
  }

  onNestedRowTypeChange(row: PageContentRow) {
    this.logger.info("onNestedRowTypeChange called for row with type:", row.type);
    this.initialiseRowIfRequired(row);
    this.logger.info("Row after type change:", row);
  }

  private initialiseRowIfRequired(row: PageContentRow) {
    this.logger.debug("initialiseRowIfRequired for row:", row);
    if (this.actions.isMap(row)) {
      this.actions.ensureMapData(row);
    } else if (this.actions.isSharedFragment(row)) {
      if (!row?.fragment) {
        row.fragment = {pageContentId: ""};
      } else if (row.fragment.pageContentId) {
        this.fragmentService.ensureLoadedById(row.fragment.pageContentId);
      }
    }
  }

  selectedFragmentForRow(row: PageContentRow): FragmentWithLabel | null {
    return this.fragmentService.fragmentWithLabelForId(row?.fragment?.pageContentId);
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
