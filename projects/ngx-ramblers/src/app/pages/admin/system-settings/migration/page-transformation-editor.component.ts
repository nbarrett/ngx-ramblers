import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faAdd, faArrowDown, faArrowUp, faClose } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { RowTypeSelectorInlineComponent } from "../../../../modules/common/dynamic-content/row-type-selector-inline";
import { FragmentSelectorComponent } from "../../../../modules/common/dynamic-content/fragment-selector.component";
import { MarginSelectComponent } from "../../../../modules/common/dynamic-content/dynamic-content-margin-select";
import { FragmentService } from "../../../../services/fragment.service";
import { EM_DASH_WITH_SPACES, FragmentWithLabel, PageContentType } from "../../../../models/content-text.model";
import { PageContentService } from "../../../../services/page-content.service";
import {
  ColumnConfig,
  ContentMatchType,
  createAllImagesLayoutTransformationConfig,
  createCustomRegexTransformationConfig,
  createDefaultTransformationConfig,
  createRouteMapLayoutTransformationConfig,
  createTwoColumnWithImageTransformationConfig,
  createWalkingRouteLayoutTransformationConfig,
  ImageMatchPattern,
  Mode,
  PageTransformationConfig,
  RowConfig,
  SegmentType,
  TextMatchPattern,
  TransformationAction,
  TransformationActionType
} from "../../../../models/page-transformation.model";

@Component({
  selector: "app-page-transformation-editor",
  template: `
    <div class="page-transformation-editor">
      @if (config) {
        <div class="row mb-2">
          <div class="col-sm-4">
            <label class="form-label-sm">Name</label>
            <input type="text" class="form-control form-control-sm" placeholder="Enter name" [(ngModel)]="config.name">
          </div>
          <div class="col-sm-6">
            <label class="form-label-sm">Description</label>
            <input type="text" class="form-control form-control-sm" placeholder="Enter description"
                   [(ngModel)]="config.description">
          </div>
          <div class="col-sm-2">
            <label class="form-label-sm d-block">Enabled</label>
            <div class="form-check">
              <input type="checkbox" class="form-check-input" id="transformation-enabled" [(ngModel)]="config.enabled">
              <label class="form-check-label" for="transformation-enabled">Active</label>
            </div>
          </div>
        </div>
        <div class="mb-3 d-flex gap-2 flex-wrap align-items-center">
          <span class="text-muted small">Load Preset:</span>
          <select class="form-select form-select-sm preset-select" [(ngModel)]="selectedPreset"
                  (ngModelChange)="loadPreset()">
            <option value="">Select a preset...</option>
            <option value="default">Simple Full-Width</option>
            <option value="twoColumn">Two Column + Image</option>
            <option value="customRegex">Custom Regex</option>
            <option value="routeMap">Route Map</option>
            <option value="allImages">Image Carousel</option>
            <option value="walkingRoute">Walking Route</option>
          </select>
          @if (config?.preset) {
            <span class="small text-muted">Preset: <strong>{{ presetLabel() }}</strong> — {{ changedPaths().length }} changed</span>
            @if (changedPaths().length) {
              <details>
                <summary class="small pointer">Show changes</summary>
                <ul class="small mb-0">
                  @for (p of changedPaths(); track p) {
                    <li>{{ p }}</li>
                  }
                </ul>
              </details>
            }
          }
        </div>
        @for (step of config.steps; track config.name; let stepIndex = $index) {
          <div class="row thumbnail-heading-frame">
            <div class="thumbnail-heading">Step {{ stepIndex + 1 }}
              <div class="badge-button" (click)="insertStep(stepIndex)" delay="500" tooltip="Add step here">
                <fa-icon [icon]="faAdd"></fa-icon>
              </div>
              @if (stepIndex > 0) {
                <div class="badge-button" (click)="moveStepUp(stepIndex)" delay="500" tooltip="Move step up">
                  <fa-icon [icon]="faArrowUp"></fa-icon>
                </div>
              }
              @if (stepIndex < config.steps.length - 1) {
                <div class="badge-button" (click)="moveStepDown(stepIndex)" delay="500" tooltip="Move step down">
                  <fa-icon [icon]="faArrowDown"></fa-icon>
                </div>
              }
              <div class="badge-button" (click)="deleteStep(stepIndex)" delay="500" tooltip="Delete step">
                <fa-icon [icon]="faClose"></fa-icon>
              </div>
            </div>
            <div class="row">
              <div class="step-heading d-flex align-items-center gap-3">
                <select class="form-select form-select-sm step-action-select" [(ngModel)]="step.type"
                        (ngModelChange)="onStepTypeChange(step)">
                  <option [value]="TransformationActionType.CONVERT_TO_MARKDOWN">Convert to Markdown</option>
                  <option [value]="TransformationActionType.CREATE_PAGE">Create Page</option>
                  <option [value]="TransformationActionType.ADD_ROW">Add Row</option>
                  <option [value]="TransformationActionType.ADD_COLUMN">Add Column</option>
                  <option [value]="TransformationActionType.ADD_MIGRATION_NOTE">Add Migration Note</option>
                </select>
                @if (step.type === TransformationActionType.ADD_ROW && step.rowConfig) {
                  <span class="step-label">Type:</span>
                  <app-row-type-selector-inline
                    [(type)]="step.rowConfig.type"
                    (typeChange)="onRowTypeChange(step.rowConfig)"
                    [cssClass]="'form-select form-select-sm inline-select'"/>
                  @if (step.rowConfig.type === PageContentType.ACTION_BUTTONS) {
                    <span class="step-label">Max Cols:</span>
                    <input type="number" min="1" max="12" class="form-control form-control-sm inline-input"
                           [(ngModel)]="step.rowConfig.maxColumns">
                  }
                }
                @if (step.type === TransformationActionType.ADD_MIGRATION_NOTE) {
                  <div class="d-flex gap-2 align-items-end ms-2">
                    <div>
                      <label class="form-label-sm">Prefix</label>
                      <input type="text" class="form-control form-control-sm" placeholder="Migrated from"
                             [(ngModel)]="step.notePrefix">
                    </div>
                    <div>
                      <label class="form-label-sm">Date Format</label>
                      <input type="text" class="form-control form-control-sm" placeholder="yyyy-LL-dd HH:mm"
                             [(ngModel)]="step.dateFormat">
                    </div>
                  </div>
                }
              </div>
              <div class="p-2">
                @if (step.type === TransformationActionType.ADD_ROW) {
                  <div class="row-configuration mt-2">
                    @if (step.rowConfig.description !== undefined) {
                      <div class="row mb-1">
                        <div class="col-sm-12">
                          <label class="form-label-sm">Description</label>
                          <input type="text" class="form-control form-control-sm"
                                 placeholder="Optional row description"
                                 [(ngModel)]="step.rowConfig.description">
                        </div>
                      </div>
                    }

                    <div class="row mb-1">
                      <div class="col-sm-6">
                        <app-margin-select label="Margin Top"
                                           [data]="step.rowConfig"
                                           field="marginTop"/>
                      </div>
                      <div class="col-sm-6">
                        <app-margin-select label="Margin Bottom"
                                           [data]="step.rowConfig"
                                           field="marginBottom"/>
                      </div>
                    </div>

                    @if (step.rowConfig.type === PageContentType.SHARED_FRAGMENT) {
                      <div class="row mb-1">
                        <div class="col-sm-12">
                          <label class="form-label-sm">Shared Fragment</label>
                          <app-fragment-selector
                            [elementId]="'fragment-row-' + stepIndex"
                            [selectedFragment]="selectedFragmentForRow(step.rowConfig)"
                            (fragmentChange)="onSharedFragmentChange(step.rowConfig, $event)"
                            [cssClass]="'form-control-sm'"/>
                        </div>
                      </div>
                    }

                    <div class="columns-section mt-2 p-2 bg-light rounded">
                      @for (column of step.rowConfig.columns; let colIndex = $index; track colIndex) {
                        <div class="row thumbnail-heading-frame">
                          <div class="thumbnail-heading">Column {{ colIndex + 1 }}
                            <div class="badge-button" (click)="insertColumn(step.rowConfig, colIndex)" delay="500"
                                 tooltip="Insert column here">
                              <fa-icon [icon]="faAdd"></fa-icon>
                            </div>
                            <div class="badge-button" (click)="deleteColumn(step.rowConfig, colIndex)" delay="500"
                                 tooltip="Delete column">
                              <fa-icon [icon]="faClose"></fa-icon>
                            </div>
                          </div>
                          <div class="row">
                            <div class="col-sm-12">
                              <div class="d-flex gap-2 flex-wrap align-items-center mb-2">
                                <span class="field-label">Width</span>
                                <input type="number" min="1" max="12"
                                       class="form-control form-control-sm inline-width-input"
                                       [(ngModel)]="column.columns">
                                @if (!column.rows || column.rows.length === 0) {
                                  <span class="field-label">Content Type</span>
                                  <select class="form-select form-select-sm inline-content-select"
                                          [(ngModel)]="column.content.type"
                                          (ngModelChange)="onContentTypeChange(column.content)">
                                    <option [value]="ContentMatchType.TEXT">Text</option>
                                    <option [value]="ContentMatchType.IMAGE">Image</option>
                                    <option [value]="ContentMatchType.HEADING">Heading</option>
                                    <option [value]="ContentMatchType.ALL_CONTENT">All Content</option>
                                    <option [value]="ContentMatchType.REMAINING">Remaining</option>
                                    <option [value]="''">None (nested)</option>
                                  </select>
                                } @else {
                                  <span class="badge bg-secondary">Has explicit nested rows</span>
                                }
                                @if (column.content.type === ContentMatchType.TEXT) {
                                  <span class="field-label">Text Pattern</span>
                                  <select class="form-select form-select-sm inline-pattern-select"
                                          [(ngModel)]="column.content.textPattern">
                                    <option [value]="TextMatchPattern.ALL_TEXT_UNTIL_IMAGE">Until image</option>
                                    <option [value]="TextMatchPattern.ALL_TEXT_AFTER_HEADING">After heading</option>
                                    <option [value]="TextMatchPattern.REMAINING_TEXT">Remaining</option>
                                    <option [value]="TextMatchPattern.PARAGRAPH">Paragraph</option>
                                    <option [value]="TextMatchPattern.STARTS_WITH_HEADING">With heading</option>
                                    <option [value]="TextMatchPattern.CUSTOM_REGEX">Custom regex</option>
                                  </select>
                                }
                                @if (column.content.type === ContentMatchType.IMAGE) {
                                  <span class="field-label">Image Pattern</span>
                                  <select class="form-select form-select-sm inline-pattern-select"
                                          [(ngModel)]="column.content.imagePattern">
                                    <option [value]="ImageMatchPattern.FIRST_IMAGE">First</option>
                                    <option [value]="ImageMatchPattern.REMAINING_IMAGES">Remaining</option>
                                    <option [value]="ImageMatchPattern.ALL_IMAGES">All</option>
                                    <option [value]="ImageMatchPattern.FILENAME_PATTERN">Filename</option>
                                    <option [value]="ImageMatchPattern.ALT_TEXT_PATTERN">Alt text</option>
                                  </select>
                                }
                              </div>

                              @if (column.content.type === ContentMatchType.IMAGE && column.content.imagePattern === ImageMatchPattern.FILENAME_PATTERN) {
                                <div class="row mb-1">
                                  <div class="col-sm-12">
                                    <label class="form-label-sm">Filename Pattern</label>
                                    <input type="text" class="form-control form-control-sm"
                                           placeholder="e.g., *route*.jpg or *map*|*route*"
                                           [(ngModel)]="column.content.filenamePattern">
                                  </div>
                                </div>
                              }

                              @if (column.content.type === ContentMatchType.IMAGE && column.content.imagePattern === ImageMatchPattern.ALT_TEXT_PATTERN) {
                                <div class="row mb-1">
                                  <div class="col-sm-12">
                                    <label class="form-label-sm">Alt Text Pattern</label>
                                    <input type="text" class="form-control form-control-sm" placeholder="e.g., map"
                                           [(ngModel)]="column.content.altTextPattern">
                                  </div>
                                </div>
                              }

                              @if (column.content.type === ContentMatchType.IMAGE && !column.nestedRows && (!column.rows || column.rows.length === 0)) {
                                <div class="form-check mb-2">
                                  <input type="checkbox" class="form-check-input"
                                         [id]="'group-image-text-' + stepIndex + '-' + colIndex"
                                         [(ngModel)]="column.content.groupTextWithImage">
                                  <label class="form-check-label"
                                         [for]="'group-image-text-' + stepIndex + '-' + colIndex">
                                    Group short text following image (captions/labels)
                                  </label>
                                </div>
                              }

                              @if (column.content.type === ContentMatchType.TEXT && column.content.textPattern === TextMatchPattern.CUSTOM_REGEX) {
                                <div class="row mb-1">
                                  <div class="col-sm-12">
                                    <label class="form-label-sm">Custom Regex Pattern</label>
                                    <input type="text" class="form-control form-control-sm"
                                           placeholder="e.g., ^### .+"
                                           [(ngModel)]="column.content.customRegex">
                                  </div>
                                </div>
                              }

                              <div class="row thumbnail-heading-frame mt-2">
                                <div class="thumbnail-heading">Nested Rows Configuration</div>
                                <div class="row">
                                  <div class="col-sm-12 p-2">
                                    @if ((column.content.type === '' || !column.content.type) && !column.nestedRows && (!column.rows || column.rows.length === 0)) {
                                      <div class="alert alert-info p-1 mb-2">
                                        <small>Choose a nested rows configuration below</small>
                                      </div>
                                    }

                                    <div class="small text-muted mb-2">Choose how to configure nested rows within this
                                      column:
                                    </div>

                                    <div class="form-check mb-2">
                                      <input type="radio" class="form-check-input"
                                             [id]="'nested-mode-none-' + stepIndex + '-' + colIndex"
                                             [name]="'nested-mode-' + stepIndex + '-' + colIndex"
                                             [checked]="!column.nestedRows && (!column.rows || column.rows.length === 0)"
                                             (change)="setNestedMode(column, 'none')">
                                      <label class="form-check-label"
                                             [for]="'nested-mode-none-' + stepIndex + '-' + colIndex">
                                          None${EM_DASH_WITH_SPACES}
                                        uses Content Type {{ stringUtils.asTitle(column.content.type) }} (set above)
                                      </label>
                                    </div>

                                    <div class="form-check mb-2">
                                      <input type="radio" class="form-check-input"
                                             [id]="'nested-mode-dynamic-' + stepIndex + '-' + colIndex"
                                             [name]="'nested-mode-' + stepIndex + '-' + colIndex"
                                             [checked]="!!column.nestedRows"
                                             (change)="setNestedMode(column, 'dynamic')">
                                      <label class="form-check-label"
                                             [for]="'nested-mode-dynamic-' + stepIndex + '-' + colIndex">
                                        Dynamic Collection${EM_DASH_WITH_SPACES}Automatically collect
                                        content and create
                                        rows based on patterns
                                      </label>
                                    </div>

                                    <div class="form-check mb-3">
                                      <input type="radio" class="form-check-input"
                                             [id]="'nested-mode-explicit-' + stepIndex + '-' + colIndex"
                                             [name]="'nested-mode-' + stepIndex + '-' + colIndex"
                                             [checked]="!!column.rows && column.rows.length > 0"
                                             (change)="setNestedMode(column, 'explicit')">
                                      <label class="form-check-label"
                                             [for]="'nested-mode-explicit-' + stepIndex + '-' + colIndex">
                                        Explicit Rows${EM_DASH_WITH_SPACES}Manually define specific
                                        rows to create
                                      </label>
                                    </div>

                                    @if (column.nestedRows) {
                                      <div class="nested-config mt-2 p-2 bg-light rounded">
                                        <div class="d-flex gap-2 flex-wrap align-items-center mb-2">
                                          <span class="field-label">Collection Type</span>
                                          <select class="form-select form-select-sm inline-content-select"
                                                  [(ngModel)]="column.nestedRows.contentMatcher.type">
                                            <option [value]="ContentMatchType.COLLECT_WITH_BREAKS">Collect with Breaks
                                            </option>
                                            <option [value]="ContentMatchType.REMAINING">All Remaining</option>
                                          </select>
                                        </div>

                                        <div class="row mb-2">
                                          <div class="col-sm-6">
                                            <label class="form-label-sm">Text Row Type</label>
                                            <app-row-type-selector-inline [(type)]="column.nestedRows.textRowTemplate.type" [cssClass]="'form-select form-select-sm'"/>
                                          </div>
                                          <div class="col-sm-6">
                                            <label class="form-label-sm">Image Row Type</label>
                                            <app-row-type-selector-inline [(type)]="column.nestedRows.imageRowTemplate.type" [cssClass]="'form-select form-select-sm'"/>
                                          </div>
                                        </div>

                                        @if (column.nestedRows.contentMatcher.type === ContentMatchType.COLLECT_WITH_BREAKS) {
                                          <div class="form-check mb-2">
                                            <input type="checkbox" class="form-check-input"
                                                   [id]="'break-' + stepIndex + '-' + colIndex"
                                                   [(ngModel)]="column.nestedRows.contentMatcher.breakOnImage">
                                            <label class="form-check-label"
                                                   [for]="'break-' + stepIndex + '-' + colIndex">
                                              Create row break on image detection
                                            </label>
                                          </div>

                                          <div class="form-check mb-2">
                                            <input type="checkbox" class="form-check-input"
                                                   [id]="'group-text-' + stepIndex + '-' + colIndex"
                                                   [(ngModel)]="column.nestedRows.contentMatcher.groupTextWithImage">
                                            <label class="form-check-label"
                                                   [for]="'group-text-' + stepIndex + '-' + colIndex">
                                              Group short text following image (captions/labels)
                                            </label>
                                          </div>

                                          <div class="d-flex gap-2 flex-wrap align-items-center mb-2">
                                            <span class="field-label">Image Pattern</span>
                                            <select class="form-select form-select-sm inline-pattern-select" [(ngModel)]="column.nestedRows.contentMatcher.imagePattern">
                                              <option [value]="ImageMatchPattern.FIRST_IMAGE">First</option>
                                              <option [value]="ImageMatchPattern.ALL_IMAGES">All</option>
                                              <option [value]="ImageMatchPattern.REMAINING_IMAGES">Remaining</option>
                                              <option [value]="ImageMatchPattern.FILENAME_PATTERN">Filename</option>
                                              <option [value]="ImageMatchPattern.ALT_TEXT_PATTERN">Alt text</option>
                                            </select>
                                          </div>

                                          @if (column.nestedRows.contentMatcher.imagePattern === ImageMatchPattern.FILENAME_PATTERN) {
                                            <div class="row mb-1">
                                              <div class="col-sm-12">
                                                <label class="form-label-sm">Filename Pattern</label>
                                                <input type="text" class="form-control form-control-sm" placeholder="e.g., *route* or *map*|*route*" [(ngModel)]="column.nestedRows.contentMatcher.filenamePattern">
                                              </div>
                                            </div>
                                          }

                                          @if (column.nestedRows.contentMatcher.imagePattern === ImageMatchPattern.ALT_TEXT_PATTERN) {
                                            <div class="row mb-1">
                                              <div class="col-sm-12">
                                                <label class="form-label-sm">Alt Text Pattern</label>
                                                <input type="text" class="form-control form-control-sm" placeholder="e.g., map" [(ngModel)]="column.nestedRows.contentMatcher.altTextPattern">
                                              </div>
                                            </div>
                                          }

                                          <div class="mb-2">
                                            <label class="form-label-sm">Stop Collection On Detection Of:</label>
                                            <div class="d-flex gap-3 flex-wrap">
                                              <div class="form-check">
                                                <input type="checkbox" class="form-check-input"
                                                       [id]="'stop-heading-' + stepIndex + '-' + colIndex"
                                                       [checked]="hasStopCondition(column, SegmentType.HEADING)"
                                                       (change)="toggleStopCondition(column, SegmentType.HEADING)">
                                                <label class="form-check-label"
                                                       [for]="'stop-heading-' + stepIndex + '-' + colIndex">Heading</label>
                                              </div>
                                              <div class="form-check">
                                                <input type="checkbox" class="form-check-input"
                                                       [id]="'stop-image-' + stepIndex + '-' + colIndex"
                                                       [checked]="hasStopCondition(column, SegmentType.IMAGE)"
                                                       (change)="toggleStopCondition(column, SegmentType.IMAGE)">
                                                <label class="form-check-label"
                                                       [for]="'stop-image-' + stepIndex + '-' + colIndex">Image</label>
                                              </div>
                                            </div>
                                          </div>
                                        }
                                      </div>
                                    }

                                    @if (column.rows && column.rows.length > 0) {
                                      <div class="nested-config mt-2 p-2 bg-light rounded">
                                        @for (nestedRow of column.rows; let nestedRowIndex = $index; track nestedRowIndex) {
                                          <div class="row thumbnail-heading-frame">
                                            <div class="thumbnail-heading">Row {{ nestedRowIndex + 1 }}
                                              <div class="badge-button" (click)="insertExplicitNestedRow(column, nestedRowIndex)"
                                                   delay="500"
                                                   tooltip="Add row here">
                                                <fa-icon [icon]="faAdd"></fa-icon>
                                              </div>
                                              <div class="badge-button"
                                                   (click)="deleteExplicitNestedRow(column, nestedRowIndex)" delay="500"
                                                   tooltip="Delete row">
                                                <fa-icon [icon]="faClose"></fa-icon>
                                              </div>
                                            </div>
                                            <div class="row">
                                              <div class="col-sm-12 p-2">
                                                <div class="d-flex gap-2 flex-wrap align-items-center mb-2">
                                                  <span class="field-label">Type:</span>
                                                  <app-row-type-selector-inline
                                                    [(type)]="nestedRow.type"
                                                    (typeChange)="onNestedRowTypeChange(column, nestedRow, nestedRowIndex)"
                                                    [cssClass]="'form-select form-select-sm inline-select'"/>
                                                </div>
                                                @if (nestedRow.type === PageContentType.SHARED_FRAGMENT) {
                                                  <div class="mt-1">
                                                    <label class="form-label-sm">Shared Fragment</label>
                                                    <app-fragment-selector
                                                      [elementId]="'fragment-nested-' + stepIndex + '-' + colIndex + '-' + nestedRowIndex"
                                                      [selectedFragment]="selectedFragmentForRow(nestedRow)"
                                                      (fragmentChange)="onSharedFragmentChange(nestedRow, $event)"
                                                      [cssClass]="'form-control-sm'"/>
                                                  </div>
                                                }
                                                @if (nestedRow.type === PageContentType.TEXT) {
                                                  <div class="mt-1">
                                                    <label class="form-label-sm">Content Matcher</label>
                                                    <div class="d-flex gap-2 flex-wrap align-items-center">
                                                      <select class="form-select form-select-sm inline-content-select"
                                                              [(ngModel)]="nestedRow.columns[0].content.type"
                                                              (ngModelChange)="onContentTypeChange(nestedRow.columns[0].content)">
                                                        <option [value]="ContentMatchType.TEXT">Text</option>
                                                        <option [value]="ContentMatchType.IMAGE">Image</option>
                                                        <option [value]="ContentMatchType.HEADING">Heading</option>
                                                        <option [value]="ContentMatchType.ALL_CONTENT">All Content
                                                        </option>
                                                        <option [value]="ContentMatchType.REMAINING">Remaining</option>
                                                      </select>
                                                      @if (nestedRow.columns[0].content.type === ContentMatchType.TEXT) {
                                                        <select class="form-select form-select-sm inline-pattern-select"
                                                                [(ngModel)]="nestedRow.columns[0].content.textPattern">
                                                          <option [value]="TextMatchPattern.PARAGRAPH">Paragraph
                                                          </option>
                                                          <option [value]="TextMatchPattern.ALL_TEXT_UNTIL_IMAGE">Until
                                                            image
                                                          </option>
                                                          <option [value]="TextMatchPattern.ALL_TEXT_AFTER_HEADING">
                                                            After heading
                                                          </option>
                                                          <option [value]="TextMatchPattern.REMAINING_TEXT">Remaining
                                                          </option>
                                                          <option [value]="TextMatchPattern.STARTS_WITH_HEADING">With
                                                            heading
                                                          </option>
                                                          <option [value]="TextMatchPattern.CUSTOM_REGEX">Custom regex
                                                          </option>
                                                        </select>
                                                        @if (nestedRow.columns[0].content.textPattern === TextMatchPattern.PARAGRAPH) {
                                                          <span class="field-label">Limit:</span>
                                                          <input type="number" min="1"
                                                                 class="form-control form-control-sm inline-input"
                                                                 [(ngModel)]="nestedRow.columns[0].content.limit"
                                                                 placeholder="1">
                                                        }
                                                      }
                                                      @if (nestedRow.columns[0].content.type === ContentMatchType.IMAGE) {
                                                        <div class="d-flex gap-2 flex-wrap align-items-center">
                                                          <span class="field-label">Image Pattern</span>
                                                          <select class="form-select form-select-sm inline-pattern-select"
                                                                  [(ngModel)]="nestedRow.columns[0].content.imagePattern">
                                                            <option [value]="ImageMatchPattern.FIRST_IMAGE">First</option>
                                                            <option [value]="ImageMatchPattern.REMAINING_IMAGES">Remaining</option>
                                                            <option [value]="ImageMatchPattern.ALL_IMAGES">All</option>
                                                            <option [value]="ImageMatchPattern.FILENAME_PATTERN">Filename</option>
                                                            <option [value]="ImageMatchPattern.ALT_TEXT_PATTERN">Alt text</option>
                                                          </select>
                                                        </div>
                                                        @if (nestedRow.columns[0].content.imagePattern === ImageMatchPattern.FILENAME_PATTERN) {
                                                          <div class="row mb-1">
                                                            <div class="col-sm-12">
                                                              <label class="form-label-sm">Filename Pattern</label>
                                                          <input type="text" class="form-control form-control-sm" placeholder="e.g., *route* or *map*|*route*"
                                                                 [(ngModel)]="nestedRow.columns[0].content.filenamePattern">
                                                            </div>
                                                          </div>
                                                        }
                                                        @if (nestedRow.columns[0].content.imagePattern === ImageMatchPattern.ALT_TEXT_PATTERN) {
                                                          <div class="row mb-1">
                                                            <div class="col-sm-12">
                                                              <label class="form-label-sm">Alt Text Pattern</label>
                                                              <input type="text" class="form-control form-control-sm" placeholder="e.g., map"
                                                                     [(ngModel)]="nestedRow.columns[0].content.altTextPattern">
                                                            </div>
                                                          </div>
                                                        }
                                                      }
                                                    </div>
                                                  </div>
                                                }
                                              </div>
                                            </div>
                                          </div>
                                        }
                                      </div>
                                    }
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (step.type === TransformationActionType.ADD_COLUMN) {
                  <div class="add-column-configuration mt-2">
                    <div class="row mb-1">
                      <div class="col-sm-6">
                        <label class="form-label-sm">Target Row</label>
                        <input type="number" min="0" class="form-control form-control-sm" [(ngModel)]="step.targetRow"
                               placeholder="e.g., 0">
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .page-transformation-editor
      padding: 0.5rem
      padding-bottom: 1rem

    .step-card
      background-color: #fff
      border: 1px solid #dee2e6
      border-radius: 4px
      margin-bottom: 0.5rem
      padding-top: 0.5rem
      padding-bottom: 0.5rem

    .step-card .p-2
      padding: 0.5rem !important
      padding-top: 0 !important
      padding-bottom: 0 !important

    .step-heading
      padding: 0.5rem
      margin-bottom: 0
      font-weight: bold

    .content-matcher-section
      margin-top: 0.5rem
      padding: 0.5rem
      background-color: #fff
      border-radius: 4px

    .columns-section
      margin-top: 0.75rem
      margin-bottom: 0.5rem
      padding: 0.5rem
      background-color: #f1f3f5
      border-radius: 4px

    .row-configuration, .nested-rows-configuration, .add-column-configuration
      margin-top: 0.75rem
      margin-bottom: 0.5rem

    .nested-row-card
      background-color: #f8f9fa
      border: 1px solid #dee2e6

    .form-label-sm
      font-size: 0.875rem
      margin-bottom: 0.25rem

    select.form-select, input.form-control
      margin-bottom: 0.5rem

    .step-action-select
      max-width: 300px
      margin-bottom: 0

    .step-label
      font-weight: bold
      white-space: nowrap
      font-size: 0.875rem

    .field-label
      font-size: 0.875rem
      white-space: nowrap
      font-weight: 500

    .inline-select
      width: 150px
      margin-bottom: 0

    .inline-input
      width: 80px
      margin-bottom: 0

    .inline-width-input
      width: 80px
      margin-bottom: 0

    .inline-content-select
      width: 180px
      margin-bottom: 0

    .inline-pattern-select
      width: 180px
      margin-bottom: 0

    .preset-select
      width: 200px
      margin-bottom: 0

    ::ng-deep .page-transformation-editor ng-select
      .ng-select-container
        border: 1px solid #dee2e6 !important
        box-shadow: none !important

      .ng-select-container:hover
        border-color: #adb5bd !important

      .ng-select-container.ng-has-value
        border-color: #dee2e6 !important
  `],
  imports: [FormsModule, FontAwesomeModule, TooltipDirective, RowTypeSelectorInlineComponent, FragmentSelectorComponent, MarginSelectComponent]
})
export class PageTransformationEditorComponent implements OnInit {
  @Input() config: PageTransformationConfig;
  @Output() configChange = new EventEmitter<PageTransformationConfig>();

  stringUtils = inject(StringUtilsService);
  fragmentService = inject(FragmentService);
  pageContentService = inject(PageContentService);
  selectedPreset = "";
  private baselineConfig: PageTransformationConfig | null = null;
  private fragmentCache = new Map<string, FragmentWithLabel>();

  protected readonly faAdd = faAdd;
  protected readonly faClose = faClose;
  protected readonly faArrowUp = faArrowUp;
  protected readonly faArrowDown = faArrowDown;
  protected readonly TransformationActionType = TransformationActionType;
  protected readonly ContentMatchType = ContentMatchType;
  protected readonly TextMatchPattern = TextMatchPattern;
  protected readonly ImageMatchPattern = ImageMatchPattern;
  protected readonly PageContentType = PageContentType;
  protected readonly SegmentType = SegmentType;

  async ngOnInit() {
    if (!this.config) {
      this.config = createDefaultTransformationConfig();
      this.emitChange();
    }
    this.ensureDefaultsForAllSteps();
    if (this.config?.preset) {
      this.baselineConfig = this.createPresetConfig(this.config.preset);
    }
    await this.loadAllFragments();
  }

  ensureDefaultsForAllSteps() {
    this.config.steps.forEach(step => {
      if (step.type === TransformationActionType.ADD_ROW && !step.rowConfig) {
        step.rowConfig = this.createDefaultRowConfig();
      }
      if (step.rowConfig?.columns) {
        step.rowConfig.columns.forEach(col => {
          if (!col.content) {
            col.content = {type: ContentMatchType.ALL_CONTENT};
          }
          if (col.nestedRows) {
            if (!col.nestedRows.contentMatcher) {
              col.nestedRows.contentMatcher = { type: ContentMatchType.COLLECT_WITH_BREAKS, breakOnImage: true, stopCondition: { onDetect: [] } } as any;
            } else if (!col.nestedRows.contentMatcher.stopCondition) {
              (col.nestedRows.contentMatcher as any).stopCondition = { onDetect: [] };
            }
            if (!col.nestedRows.rowTemplate) {
              col.nestedRows.rowTemplate = { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false } as any;
            }
            if (!col.nestedRows.textRowTemplate) {
              col.nestedRows.textRowTemplate = col.nestedRows.rowTemplate || { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false } as any;
            }
            if (!col.nestedRows.imageRowTemplate) {
              col.nestedRows.imageRowTemplate = col.nestedRows.rowTemplate || { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false } as any;
            }
          }
        });
      }
    });
  }

  private createPresetConfig(preset: string): PageTransformationConfig {
    switch (preset) {
      case "default":
        return createDefaultTransformationConfig();
      case "twoColumn":
        return createTwoColumnWithImageTransformationConfig();
      case "customRegex":
        return createCustomRegexTransformationConfig();
      case "routeMap":
        return createRouteMapLayoutTransformationConfig();
      case "allImages":
        return createAllImagesLayoutTransformationConfig();
      case "walkingRoute":
        return createWalkingRouteLayoutTransformationConfig();
      default:
        return createDefaultTransformationConfig();
    }
  }

  presetLabel(): string {
    const id = this.config?.preset || "";
    switch (id) {
      case "default": return "Simple Full-Width";
      case "twoColumn": return "Two Column + Image";
      case "customRegex": return "Custom Regex";
      case "routeMap": return "Route Map";
      case "allImages": return "Image Carousel";
      case "walkingRoute": return "Walking Route";
      default: return id || "None";
    }
  }

  changedPaths(): string[] {
    if (!this.baselineConfig) return [];
    const current = JSON.parse(JSON.stringify(this.config));
    const baseline = JSON.parse(JSON.stringify(this.baselineConfig));
    const paths: string[] = [];
    const walk = (a: any, b: any, p: string) => {
      const keys = Array.from(new Set([...(Object.keys(a||{})), ...(Object.keys(b||{}))]));
      for (const k of keys) {
        const ap = a ? a[k] : undefined;
        const bp = b ? b[k] : undefined;
        const path = p ? `${p}.${k}` : k;
        if (typeof ap === "object" && ap && typeof bp === "object" && bp) {
          walk(ap, bp, path);
        } else if (JSON.stringify(ap) !== JSON.stringify(bp)) {
          if (k !== "preset") paths.push(path);
        }
      }
    };
    walk(current, baseline, "");
    return paths.sort();
  }

  createDefaultRowConfig(): RowConfig {
    return {
      type: PageContentType.TEXT,
      maxColumns: 1,
      showSwiper: false,
      columns: [{
        columns: 12,
        content: {type: ContentMatchType.ALL_CONTENT}
      }]
    };
  }

  createDefaultColumn(): ColumnConfig {
    return {
      columns: 12,
      content: {type: ContentMatchType.ALL_CONTENT}
    };
  }

  addStep() {
    const newStep: TransformationAction = {
      type: TransformationActionType.ADD_ROW,
      rowConfig: this.createDefaultRowConfig()
    };
    this.config.steps.push(newStep);
    this.emitChange();
  }

  insertStep(index: number) {
    const newStep: TransformationAction = {
      type: TransformationActionType.ADD_ROW,
      rowConfig: this.createDefaultRowConfig()
    };
    this.config.steps.splice(index, 0, newStep);
    this.emitChange();
  }

  deleteStep(index: number) {
    this.config.steps.splice(index, 1);
    this.emitChange();
  }

  moveStepUp(index: number) {
    if (index > 0) {
      const temp = this.config.steps[index];
      this.config.steps[index] = this.config.steps[index - 1];
      this.config.steps[index - 1] = temp;
      this.emitChange();
    }
  }

  moveStepDown(index: number) {
    if (index < this.config.steps.length - 1) {
      const temp = this.config.steps[index];
      this.config.steps[index] = this.config.steps[index + 1];
      this.config.steps[index + 1] = temp;
      this.emitChange();
    }
  }

  onStepTypeChange(step: TransformationAction) {
    if (step.type === TransformationActionType.ADD_ROW && !step.rowConfig) {
      step.rowConfig = this.createDefaultRowConfig();
    } else if (step.type === TransformationActionType.ADD_NESTED_ROWS) {
      if (step.targetRow === undefined) step.targetRow = 0;
      if (step.targetColumn === undefined) step.targetColumn = 0;
    } else if (step.type === TransformationActionType.ADD_MIGRATION_NOTE) {
      if (!step.notePrefix) step.notePrefix = "Migrated from";
      if (!step.dateFormat) step.dateFormat = "yyyy-LL-dd HH:mm";
    }
    this.emitChange();
  }

  onRowTypeChange(rowConfig: RowConfig) {
    if (rowConfig.type === PageContentType.SHARED_FRAGMENT) {
      if (!rowConfig.fragment) {
        rowConfig.fragment = {pageContentId: ""};
      }
    }
    this.emitChange();
  }

  addColumn(rowConfig: RowConfig) {
    if (!rowConfig.columns) {
      rowConfig.columns = [];
    }
    rowConfig.columns.push(this.createDefaultColumn());
    this.emitChange();
  }

  insertColumn(rowConfig: RowConfig, index: number) {
    if (!rowConfig.columns) {
      rowConfig.columns = [];
    }
    rowConfig.columns.splice(index + 1, 0, this.createDefaultColumn());
    this.emitChange();
  }

  deleteColumn(rowConfig: RowConfig, index: number) {
    rowConfig.columns.splice(index, 1);
    this.emitChange();
  }

  onContentTypeChange(content: any) {
    if (content.type === ContentMatchType.TEXT) {
      content.textPattern = TextMatchPattern.ALL_TEXT_UNTIL_IMAGE;
      delete content.imagePattern;
      delete content.filenamePattern;
      delete content.altTextPattern;
    } else if (content.type === ContentMatchType.IMAGE) {
      content.imagePattern = ImageMatchPattern.FIRST_IMAGE;
      delete content.textPattern;
      delete content.customRegex;
    } else {
      delete content.textPattern;
      delete content.imagePattern;
      delete content.filenamePattern;
      delete content.altTextPattern;
      delete content.customRegex;
    }
    this.emitChange();
  }

  actionTypeLabel(type: TransformationActionType): string {
    switch (type) {
      case TransformationActionType.CONVERT_TO_MARKDOWN:
        return "Convert to Markdown";
      case TransformationActionType.CREATE_PAGE:
        return "Create Page";
      case TransformationActionType.ADD_ROW:
        return "Add Row";
      case TransformationActionType.ADD_COLUMN:
        return "Add Column";
      case TransformationActionType.ADD_NESTED_ROWS:
        return "Add Nested Rows";
      case TransformationActionType.ADD_MIGRATION_NOTE:
        return "Add Migration Note";
      default:
        return "Unknown";
    }
  }

  loadPreset() {
    if (!this.selectedPreset) {
      return;
    }

    switch (this.selectedPreset) {
      case "default":
        this.config = createDefaultTransformationConfig();
        break;
      case "twoColumn":
        this.config = createTwoColumnWithImageTransformationConfig();
        break;
      case "customRegex":
        this.config = createCustomRegexTransformationConfig();
        break;
      case "routeMap":
        this.config = createRouteMapLayoutTransformationConfig();
        break;
      case "allImages":
        this.config = createAllImagesLayoutTransformationConfig();
        break;
      case "walkingRoute":
        this.config = createWalkingRouteLayoutTransformationConfig();
        break;
    }

    this.ensureDefaultsForAllSteps();
    this.emitChange();
    this.selectedPreset = "";
  }

  toggleNestedRows(column: ColumnConfig) {
    if (column.nestedRows) {
      delete column.nestedRows;
    } else {
      column.nestedRows = {
        contentMatcher: {
          type: ContentMatchType.COLLECT_WITH_BREAKS,
          breakOnImage: true,
          stopCondition: {
            onDetect: []
          }
        },
        rowTemplate: { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false },
        textRowTemplate: { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false },
        imageRowTemplate: { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false }
      };
    }
    this.emitChange();
    if (this.config?.preset && !this.baselineConfig) {
      this.baselineConfig = this.createPresetConfig(this.config.preset);
    }
  }

  hasStopCondition(column: ColumnConfig, segmentType: SegmentType): boolean {
    return column.nestedRows?.contentMatcher?.stopCondition?.onDetect?.includes(segmentType) || false;
  }

  toggleStopCondition(column: ColumnConfig, segmentType: SegmentType) {
    if (!column.nestedRows?.contentMatcher?.stopCondition) {
      if (!column.nestedRows) {
        column.nestedRows = {
          contentMatcher: {
            type: ContentMatchType.COLLECT_WITH_BREAKS,
            breakOnImage: true
          },
          rowTemplate: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false
          }
        };
      }
      column.nestedRows.contentMatcher.stopCondition = { onDetect: [] };
    }

    const stopCondition = column.nestedRows.contentMatcher.stopCondition;
    const index = stopCondition.onDetect.indexOf(segmentType);

    if (index > -1) {
      stopCondition.onDetect.splice(index, 1);
    } else {
      stopCondition.onDetect.push(segmentType);
    }

    this.emitChange();
  }

  private emitChange() {
    this.configChange.emit(this.config);
  }

  private async loadAllFragments() {
    await this.pageContentService.all();
    const fragmentPaths = this.fragmentService.fragmentLinks;
    await Promise.all(fragmentPaths.map(path => this.fragmentService.ensureLoaded(path)));
  }

  selectedFragmentForRow(rowConfig: RowConfig): FragmentWithLabel | null {
    if (!rowConfig?.fragment?.pageContentId) {
      return null;
    }

    if (this.fragmentCache.has(rowConfig.fragment.pageContentId)) {
      return this.fragmentCache.get(rowConfig.fragment.pageContentId);
    }

    const fragment = this.fragmentService.fragments.find(f => f.id === rowConfig.fragment.pageContentId);
    if (!fragment) {
      return null;
    }

    const fragmentWithLabel: FragmentWithLabel = {
      pageContentId: fragment.id,
      ngSelectAttributes: {label: fragment.path}
    };

    this.fragmentCache.set(rowConfig.fragment.pageContentId, fragmentWithLabel);
    return fragmentWithLabel;
  }

  onSharedFragmentChange(rowConfig: RowConfig, fragmentWithLabel: FragmentWithLabel) {
    if (fragmentWithLabel?.pageContentId) {
      rowConfig.fragment = {pageContentId: fragmentWithLabel.pageContentId};
    } else {
      rowConfig.fragment = {pageContentId: ""};
    }
    this.emitChange();
  }

  getContentDescription(content: any): string {
    if (!content || !content.type) {
      return "No content configured";
    }

    const parts: string[] = [content.type];

    if (content.type === ContentMatchType.TEXT && content.textPattern) {
      parts.push(`(${content.textPattern})`);
      if (content.limit) {
        parts.push(`limit: ${content.limit}`);
      }
    } else if (content.type === ContentMatchType.IMAGE && content.imagePattern) {
      parts.push(`(${content.imagePattern})`);
      if (content.filenamePattern) {
        parts.push(`pattern: ${content.filenamePattern}`);
      }
    }

    return parts.join(" ");
  }

  setNestedMode(column: ColumnConfig, mode: Mode) {
    if (mode === "none") {
      delete column.nestedRows;
      delete column.rows;
      if (!column.content) {
        column.content = {type: ContentMatchType.ALL_CONTENT};
      }
    } else if (mode === "dynamic") {
      delete column.rows;
      if (!column.nestedRows) {
        column.nestedRows = {
          contentMatcher: {
            type: ContentMatchType.COLLECT_WITH_BREAKS,
            breakOnImage: true,
            stopCondition: {
              onDetect: []
            }
          },
          rowTemplate: { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false },
          textRowTemplate: { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false },
          imageRowTemplate: { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false }
        };
      }
      if (!column.nestedRows.textRowTemplate) column.nestedRows.textRowTemplate = { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false } as any;
      if (!column.nestedRows.imageRowTemplate) column.nestedRows.imageRowTemplate = { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false } as any;
    } else if (mode === "explicit") {
      delete column.nestedRows;
      if (!column.rows || column.rows.length === 0) {
        column.rows = [this.createDefaultExplicitNestedRow()];
      }
    }
    this.emitChange();
  }

  createDefaultExplicitNestedRow(): RowConfig {
    return {
      type: PageContentType.TEXT,
      maxColumns: 1,
      showSwiper: false,
      columns: [{
        columns: 12,
        content: {
          type: ContentMatchType.TEXT,
          textPattern: TextMatchPattern.PARAGRAPH,
          limit: 1
        }
      }]
    };
  }

  addExplicitNestedRow(column: ColumnConfig) {
    if (!column.rows) {
      column.rows = [];
    }
    column.rows.push(this.createDefaultExplicitNestedRow());
    this.emitChange();
  }

  insertExplicitNestedRow(column: ColumnConfig, index: number) {
    if (!column.rows) {
      column.rows = [];
    }
    column.rows.splice(index + 1, 0, this.createDefaultExplicitNestedRow());
    this.emitChange();
  }

  deleteExplicitNestedRow(column: ColumnConfig, index: number) {
    if (column.rows) {
      column.rows.splice(index, 1);
      this.emitChange();
    }
  }

  onNestedRowTypeChange(column: ColumnConfig, nestedRow: RowConfig, index: number) {
    if (nestedRow.type === PageContentType.SHARED_FRAGMENT) {
      if (!nestedRow.fragment) {
        nestedRow.fragment = {pageContentId: ""};
      }
      nestedRow.columns = [];
    } else if (nestedRow.type === PageContentType.TEXT) {
      if (!nestedRow.columns || nestedRow.columns.length === 0) {
        nestedRow.columns = [{
          columns: 12,
          content: {
            type: ContentMatchType.TEXT,
            textPattern: TextMatchPattern.PARAGRAPH,
            limit: 1
          }
        }];
      }
      delete nestedRow.fragment;
    }
    this.emitChange();
  }
}
