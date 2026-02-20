import { Component, inject, Input, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from "@angular/core";
import {
  faAdd,
  faArrowsUpDown,
  faCheck,
  faCircleCheck,
  faCopy,
  faEye,
  faPaste,
  faPencil,
  faRemove,
  faSave,
  faSpinner,
  faUndo
} from "@fortawesome/free-solid-svg-icons";
import { cloneDeep, first, isArray, isEmpty, isNull, isNumber, isObject, isString, isUndefined, keys, last, uniq } from "es-toolkit/compat";
import { BsDropdownConfig } from "ngx-bootstrap/dropdown";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import {
  Action,
  ColumnContentType,
  ColumnInsertData,
  ColumnMappingConfig,
  ContentTemplateType,
  EM_DASH_WITH_SPACES,
  FragmentWithLabel,
  ImagePattern,
  InsertionPosition,
  InsertionRow,
  LocationRenderingMode,
  MigrationTemplateLocationMapping,
  MigrationTemplateMapMapping,
  MigrationTemplateMapping,
  MigrationTemplateMetadata,
  MigrationTemplateSourceType,
  NestedRowMappingConfig,
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentType,
  USER_TEMPLATES_PATH_PREFIX
} from "../../../models/content-text.model";
import { TextMatchPattern } from "../../../models/page-transformation.model";
import { LocationDetails } from "../../../models/ramblers-walks-manager";
import { BroadcastService } from "../../../services/broadcast-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { AlertInstance } from "../../../services/notifier.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentRowService } from "../../../services/page-content-row.service";
import { PageContentService } from "../../../services/page-content.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { DataPopulationService } from "../../../pages/admin/data-population.service";
import { fieldStartsWithValue } from "../../../functions/mongo";
import { PageService } from "../../../services/page.service";
import { assignDeep } from "../../../functions/object-utils";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgClass, NgTemplateOutlet } from "@angular/common";
import { RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { TypeaheadDirective } from "ngx-bootstrap/typeahead";
import { FragmentSelectorComponent } from "./fragment-selector.component";
import { RowSettingsCarouselComponent } from "./dynamic-content-site-edit-carousel-row";
import { RowSettingsActionButtonsComponent } from "./dynamic-content-row-settings-action-buttons";
import { MarginSelectComponent } from "./dynamic-content-margin-select";
import { ActionsDropdownComponent } from "../actions-dropdown/actions-dropdown";
import { BulkActionSelectorComponent } from "./bulk-action-selector";
import { AlbumIndexSiteEditComponent } from "./dynamic-content-site-edit-index";
import { ActionButtons } from "../action-buttons/action-buttons";
import { DynamicContentSiteEditAlbumComponent } from "./dynamic-content-site-edit-album";
import { DynamicContentSiteEditTextRowComponent } from "./dynamic-content-site-edit-text-row";
import { move } from "../../../functions/arrays";
import { DynamicContentSiteEditEvents } from "./dynamic-content-site-edit-events";
import { DynamicContentSiteEditAreaMapComponent } from "./dynamic-content-site-edit-area-map";
import { DynamicContentSiteEditMap } from "./dynamic-content-site-edit-map";
import { DynamicContentSiteEditLocation } from "./dynamic-content-site-edit-location";
import { DynamicContentViewComponent } from "./dynamic-content-view";
import { FragmentService } from "../../../services/fragment.service";
import { RowTypeSelectorComponent } from "./row-type-selector";
import { TemplateSelectEvent, TemplateSelectorComponent } from "./template-selector";
import { IndexService } from "../../../services/index.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { faClone } from "@fortawesome/free-solid-svg-icons/faClone";

@Component({
  selector: "app-dynamic-content-site-edit",
  template: `
    @if (siteEditService.active()) {
      @if (notify.alertTarget.showAlert || !actions.pageContentFound(pageContent, queryCompleted)) {
        @if (notify.alertTarget.showAlert) {
          <div class="col-12 alert {{notify.alertTarget.alertClass}} mt-3">
            <fa-icon [icon]="notify.alertTarget.alert.icon"></fa-icon>
            <strong class="ms-2">{{ notify.alertTarget.alertTitle }}</strong>
            <div class="p-2">{{ notify.alertTarget.alertMessage }}.
              @if (canCreateContent()) {
                <a (click)="createContent()"
                   class="rams-text-decoration-pink"
                   type="button">Create content</a>
              }
              @if (canGoToThatPage()) {
                <a (click)="goToOtherPage()"
                   class="rams-text-decoration-pink"
                   type="button">Go to that page</a>
              }
            </div>
          </div>
        }
      }
      @if (pageContent) {
        <div class="card mb-2">
          <div class="card-body">
            <h4 class="card-title">Page content for {{ pageContent.path }} (<small
              class="text-muted">{{ stringUtils.pluraliseWithCount(pageContent?.rows.length, 'row') }}</small>)</h4>
            <ng-container *ngTemplateOutlet="saveButtonsAndPath"/>
            @if (unreferencedPaths?.length > 0 && showUnreferenced) {
              <div class="row mt-2 align-items-end mb-3">
                <div class="align-middle">
                  <div class="col-sm-12">
                    <div class="mb-2">Other unreferenced pages related to this area:</div>
                    @for (path of unreferencedPaths; track path) {
                      <ul class="breadcrumb bg-transparent mb-1 ms-0 p-1">
                        <span class="d-md-none">...</span>
                        @for (page of pageService.linksFromPathSegments(urlService.pathSegmentsForUrl(path)); track page.href) {
                          <li class="breadcrumb-item d-none d-md-inline">
                            <a [routerLink]="'/' + page?.href" target="_self">{{ page?.title }}</a>
                          </li>
                        }
                        <li class="breadcrumb-item d-none d-md-inline">
                          <a class="rams-text-decoration-pink"
                             [href]="path">{{ formatHref(last(urlService.pathSegmentsForUrl(path))) }}</a>
                        </li>
                      </ul>
                    }
                  </div>
                </div>
              </div>
            }
            <div class="row mt-2 align-items-end mb-3">
              <div [ngClass]="pageContentRowService.rowsSelected()? 'col-md-10' : 'col'" class="mb-2">
                <form>
                  <label class="me-2" for="path">Content Path
                    <span>{{ contentPathReadOnly ? "(not editable as this content is part of internal page)" : "" }}</span></label>
                  <input [disabled]="contentPathReadOnly" autocomplete="off"
                         [typeahead]="pageContentService.siteLinks"
                         (ngModelChange)="contentPathChange($event)"
                         [typeaheadMinLength]="0" id="path"
                         [ngModel]="pageContent.path"
                         name="path"
                         [ngModelOptions]="{standalone: true}"
                         type="text" class="form-control">
                </form>
              </div>
            </div>
            @if (templateOptionsVisible) {
              <div class="row mt-2 mb-3 thumbnail-heading-frame">
                <div class="thumbnail-heading">Template Options</div>
                <div class="col-12">
                  <div class="p-3">
                    <div class="d-flex flex-wrap align-items-center gap-2">
                      @for (option of contentTemplateTypeOptions; track option.value; let isLast = $last) {
                        <app-badge-button
                          [active]="isTemplateType(option.value)"
                          [icon]="templateButtonIcon(option.value)"
                          [caption]="option.label"
                          [tooltip]="option.description"
                          [noRightMargin]="!isLast"
                          (click)="setTemplateType(option.value)"/>
                      }
                      <app-badge-button
                        [icon]="faRemove"
                        caption="Remove"
                        [tooltip]="'Remove template configuration'"
                        (click)="removeTemplate()"/>
                      @if (!canEnableTemplateMode()) {
                        <app-badge-button
                          [icon]="faSave"
                          caption="Save as template"
                          [tooltip]="'Copy this page structure to template library'"
                          (click)="createTemplateFromPage()"/>
                      }
                      @if (isMigrationTemplateSelected()) {
                        <div class="form-check form-switch mb-0 ms-auto">
                          <input class="form-check-input" type="checkbox" id="migration-template-mapping-mode"
                                 [ngModel]="templateMappingMode"
                                 (ngModelChange)="setTemplateMappingMode($event)"
                                 [disabled]="!isMigrationTemplateSelected()">
                          <label class="form-check-label" for="migration-template-mapping-mode">Mapping mode</label>
                        </div>
                      }
                    </div>
                    @if (templateType()) {
                      <div class="small text-muted mt-2">
                        <app-markdown-editor [text]="templateTypeDescription()" [presentationMode]="true"/>
                      </div>
                    }
                  </div>
                </div>
                <div class="col-12">
                  <div class="p-3">
                    <app-template-selector (templateSelected)="onTemplateSelected($event)"/>
                  </div>
                </div>
              </div>
            }
            @for (row of pageContent?.rows; track row; let rowIndex = $index) {
              @if (pageContentRowService.rowsSelected() && rowIndex === firstSelectedRowIndex()) {
                <div class="row thumbnail-heading-frame">
                  <div class="thumbnail-heading">Row Actions</div>
                  <div class="row align-items-end">
                    <div class="col-auto d-flex align-items-center">
                      <div class="form-check form-check-inline mb-0">
                        <input class="form-check-input"
                               type="checkbox"
                               id="select-all-rows"
                               [checked]="allRowsSelected()"
                               [indeterminate]="selectAllRowsIndeterminate()"
                               (change)="onSelectAllRowsChange($event)"
                               [disabled]="!pageContent?.rows?.length">
                        <label class="form-check-label" for="select-all-rows">Select All Rows</label>
                      </div>
                    </div>
                    <div class="col-sm-4 col-md-2">
                      <label for="action">Action</label>
                      <select class="form-control"
                              [(ngModel)]="action"
                              id="action">
                        @for (action of contentActions; track action) {
                          <option [ngValue]="action">{{ action }}</option>
                        }
                      </select>
                    </div>
                    @if (action !== Action.CREATE_FRAGMENT) {
                      <div class="col-md-8">
                        <form>
                          <label class="me-2" for="move-or-copy-to-path">
                            {{ action }}
                            {{ stringUtils.pluraliseWithCount(pageContentRowService.selectedRowCount(), "row") }}
                            to</label>
                          <input id="move-or-copy-to-path"
                                 [typeahead]="pageContentService.siteLinks"
                                 name="destinationPath"
                                 autocomplete="nope"
                                 [typeaheadMinLength]="0"
                                 [disabled]="!pageContentRowService.rowsSelected()"
                                 (ngModelChange)="destinationPathLookupChange($event)"
                                 [ngModel]="destinationPath"
                                 type="text" class="form-control">
                        </form>
                      </div>
                      <div class="col-sm-4 col-md-2">
                        <label for="before-after">Position</label>
                        <select class="form-control input-sm"
                                [(ngModel)]="destinationPathInsertBeforeAfterIndex"
                                id="before-after">
                          @for (insertionRow of insertionRowPosition; track insertionRow) {
                            <option [ngValue]="insertionRow.index">{{ insertionRow.description }}</option>
                          }
                        </select>
                      </div>
                      <div class="col-md-10 mt-2">
                        <label for="insert-at-row">Row</label>
                        <select class="form-control input-sm"
                                [(ngModel)]="destinationPathInsertionRowIndex"
                                (ngModelChange)="destinationPathInsertionRowIndexChange($event)"
                                id="insert-at-row">
                          @for (insertionRow of insertionRowLookup; track insertionRow) {
                            <option [ngValue]="insertionRow.index">{{ insertionRow.description }}</option>
                          }
                        </select>
                      </div>
                    }
                    @if (action === Action.CREATE_FRAGMENT) {
                      <div class="col-md-6">
                        <label for="fragment-name">Create Named Fragment</label>
                        <input id="fragment-name" [(ngModel)]="fragmentName" type="text" class="form-control"
                               placeholder="Fragment name e.g. homepage-hero"/>
                      </div>
                    }
                    <div class="col-auto mt-2">
                      <button [disabled]="actionDisabled()"
                              delay=500 tooltip="{{action}} rows"
                              type="submit"
                              (click)="performCopyOrMoveAction()"
                              [ngClass]="buttonClass(!actionDisabled())">
                        <fa-icon [icon]="faSave"></fa-icon>
                        <span class="ms-2">Perform {{ action }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              }
              <div class="thumbnail-site-edit-top-bottom-margins" (dragover)="onRowDragOver(rowIndex, $event)"
                   (drop)="onRowDrop(rowIndex)">
                <div class="thumbnail-heading" [attr.draggable]="true" (dragstart)="onRowDragStart($event, rowIndex)"
                     (dragend)="onRowDragEnd()" [tooltip]="rowDragTooltip(rowIndex)"
                     [isOpen]="!!rowDragTooltip(rowIndex)" container="body" triggers="">
                  {{ actions.rowHeading(rowIndex, row?.columns.length) }}
                  @if (isMigrationTemplateSelected()) {
                    @let mappingSummary = templateMappingSummary(row, rowIndex);
                    @if (mappingSummary) {
                      <span class="badge bg-light text-dark border ms-2">{{ mappingSummary }}</span>
                    }
                  }
                  <app-badge-button noRightMargin class="ms-2"
                                    (click)="deleteRow(rowIndex)"
                                    [icon]="faRemove"
                                    [tooltip]="'Delete row'"/>
                  <span class="drag-handle ms-2 float-end" [attr.draggable]="true"
                        (dragstart)="onRowDragStart($event, rowIndex)">
                        <fa-icon [icon]="faArrowsUpDown"></fa-icon>
                      </span>
                </div>
                <div class="row align-items-end mb-3 d-flex">
                  <div class="col d-flex align-items-end flex-wrap gap-3">
                    <div class="flex-grow-1">
                      <app-row-type-selector
                        [row]="row"
                        [rowIndex]="rowIndex"
                        [contentPath]="contentPath"
                        (typeChange)="changePageContentRowType(row)"/>
                    </div>
                    @if (actions.isActionButtons(row) || actions.isIndex(row)) {
                      <div class="d-inline-flex align-items-end flex-wrap gap-3" app-row-settings-action-buttons
                           [row]="row" (columnsChange)="refreshAlbumIndexPreviews()"></div>
                    }
                    <div class="d-inline-flex align-items-end flex-wrap gap-3">
                      <div app-margin-select label="Margin Top" [data]="row" field="marginTop"></div>
                      <div app-margin-select label="Margin Bottom" [data]="row" field="marginBottom"></div>
                    </div>
                    <div class="d-inline-flex align-items-end flex-wrap gap-3 ms-auto"
                         [ngClass]="actions.isActionButtons(row) ? 'mt-2' : ''">
                      <app-actions-dropdown [rowIndex]="rowIndex" [pageContent]="pageContent" [row]="row"/>
                      <app-bulk-action-selector [row]="row"/>
                    </div>
                  </div>
                </div>
                @if (isMigrationTemplateSelected() && templateMappingMode) {
                  <div class="row thumbnail-heading-frame thumbnail-heading-mapping-mode">
                    <div class="thumbnail-heading-with-select">
                      <div class="d-flex flex-wrap align-items-center gap-2">
                        <label [for]="'mapping-source-' + rowIndex">Mapping source</label>
                        <select class="form-control input-sm"
                                style="width: auto; max-width: 300px;"
                                [id]="'mapping-source-' + rowIndex"
                                [ngModel]="templateMappingSourceType(rowIndex)"
                                (ngModelChange)="onMappingSourceChange(rowIndex, $event)">
                          <option value="">Not mapped</option>
                          @for (option of templateSourceOptions; track option.value) {
                            <option [value]="option.value">{{ option.label }}</option>
                          }
                        </select>
                      </div>
                    </div>
                    <div class="row">
                      @if (templateMappingSourceType(rowIndex) === MigrationTemplateSourceType.EXTRACT && !actions.isLocation(row) && !actions.isMap(row) && !isConfigurationOnlyMapping(rowIndex)) {
                        <div class="col-md-4">
                          <label class="form-label-sm" [for]="'mapping-text-pattern-' + rowIndex">Text pattern</label>
                          <select class="form-select form-select-sm"
                                  [id]="'mapping-text-pattern-' + rowIndex"
                                  [ngModel]="templateMappingExtractPreset(rowIndex)"
                                  (ngModelChange)="onExtractPresetChange(rowIndex, $event)">
                            <option value="">Select pattern...</option>
                            @for (option of templateExtractOptions; track option.value) {
                              <option [value]="option.value">{{ option.label }}</option>
                            }
                          </select>
                        </div>
                      }
                      @if (templateMappingSourceType(rowIndex) === MigrationTemplateSourceType.EXTRACT && actions.isLocation(row)) {
                        <div class="col-md-12">
                          <div class="alert alert-warning mb-0 py-2">
                            <fa-icon [icon]="faCircleCheck"/>
                            <strong class="ms-2">Location configuration{{ EM_DASH_WITH_SPACES }}</strong>
                            <span class="ms-1">Use the checkboxes and fields below to configure how location data is extracted</span>
                          </div>
                        </div>
                      }
                      @if (templateMappingSourceType(rowIndex) === MigrationTemplateSourceType.EXTRACT && actions.isMap(row)) {
                        <div class="col-md-12">
                          <div class="alert alert-warning mb-0 py-2">
                            <fa-icon [icon]="faCircleCheck"/>
                            <strong class="ms-2">Map configuration -</strong>
                            <span class="ms-1">Use the checkboxes and fields below to configure GPX extraction and location settings</span>
                          </div>
                        </div>
                      }
                      @if (templateMappingBy(rowIndex)?.textPattern === TextMatchPattern.CUSTOM_REGEX || templateMappingBy(rowIndex)?.extractPattern) {
                        <div class="col-md-4">
                          <label class="form-label-sm" [for]="'mapping-extract-pattern-' + rowIndex">
                            Custom regex pattern</label>
                          <input type="text" class="form-control"
                                 [id]="'mapping-extract-pattern-' + rowIndex"
                                 [ngModel]="templateMappingBy(rowIndex)?.extractPattern || ''"
                                 (ngModelChange)="updateExtractPattern(rowIndex, $event)"
                                 placeholder="e.g., ^### .+">
                        </div>
                      }
                      @if (templateMappingSourceType(rowIndex) === MigrationTemplateSourceType.METADATA) {
                        <div class="col-md-4">
                          <label class="form-label-sm" [for]="'mapping-metadata-' + rowIndex">
                            Metadata field</label>
                          <select class="form-select form-select-sm"
                                  [id]="'mapping-metadata-' + rowIndex"
                                  [ngModel]="templateMappingBy(rowIndex)?.sourceIdentifier || ''"
                                  (ngModelChange)="updateMetadataSelection(rowIndex, $event)">
                            <option value="">Select field...</option>
                            @for (option of templateMetadataOptions; track option.value) {
                              <option [value]="option.value">{{ option.label }}</option>
                            }
                          </select>
                        </div>
                      }
                      @if (templateMappingSourceType(rowIndex) === MigrationTemplateSourceType.STATIC) {
                        <div class="col-md-8">
                          <label class="form-label-sm" [for]="'mapping-static-value-' + rowIndex">
                            Static value or instructions</label>
                          <input type="text" class="form-control"
                                 [id]="'mapping-static-value-' + rowIndex"
                                 [ngModel]="templateMappingBy(rowIndex)?.notes || ''"
                                 (ngModelChange)="updateMappingNotes(rowIndex, $event)">
                        </div>
                      }
                      @if (templateMappingSourceType(rowIndex) && templateMappingSourceType(rowIndex) !== MigrationTemplateSourceType.STATIC) {
                        <div class="col-12 mt-2">
                          <label class="form-label-sm" [for]="'mapping-notes-' + rowIndex">
                            Documentation notes
                            <small class="text-muted">(optional - describe what this mapping does)</small>
                          </label>
                          <textarea class="form-control"
                                    [id]="'mapping-notes-' + rowIndex"
                                    rows="2"
                                    [ngModel]="templateMappingBy(rowIndex)?.notes || ''"
                                    (ngModelChange)="updateMappingNotes(rowIndex, $event)"
                                    placeholder="e.g., Extracts the first level 1 or 2 heading from the source content"></textarea>
                        </div>
                      }
                      @if (templateMappingSourceType(rowIndex) === MigrationTemplateSourceType.EXTRACT && actions.isLocation(row)) {
                        <div class="col-12">
                          <div class="row g-3 align-items-center">
                            <div class="col-md-3">
                              <div class="form-check mt-2">
                                <input class="form-check-input" type="checkbox"
                                       [id]="'mapping-location-extract-' + rowIndex"
                                       [ngModel]="templateMappingBy(rowIndex)?.location?.extractFromContent || false"
                                       (ngModelChange)="updateLocationMapping(rowIndex, 'extractFromContent', $event)">
                                <label class="form-check-label"
                                       [for]="'mapping-location-extract-' + rowIndex">
                                  Extract from content
                                </label>
                              </div>
                            </div>
                            <div class="col-md-3">
                              <div class="form-check mt-2">
                                <input class="form-check-input" type="checkbox"
                                       [id]="'mapping-location-hide-' + rowIndex"
                                       [ngModel]="templateMappingBy(rowIndex)?.location?.hideRow || false"
                                       (ngModelChange)="updateLocationMapping(rowIndex, 'hideRow', $event)">
                                <label class="form-check-label"
                                       [for]="'mapping-location-hide-' + rowIndex">
                                  Hide location row
                                </label>
                              </div>
                            </div>
                            <div class="col-md-6">
                              <label class="form-label-sm"
                                     [for]="'mapping-location-default-' + rowIndex">
                                Default location
                              </label>
                              <input type="text" class="form-control"
                                     [id]="'mapping-location-default-' + rowIndex"
                                     [ngModel]="templateMappingBy(rowIndex)?.location?.defaultLocation || ''"
                                     (ngModelChange)="updateLocationMapping(rowIndex, 'defaultLocation', $event)">
                            </div>
                          </div>
                        </div>
                      }
                      @if (actions.isMap(row)) {
                        <div class="col-12">
                          <div class="row g-3 align-items-end">
                            <div class="col-md-4">
                              <div class="form-check">
                                <input class="form-check-input" type="checkbox"
                                       [id]="'mapping-map-extract-gpx-' + rowIndex"
                                       [ngModel]="templateMappingBy(rowIndex)?.map?.extractGpxFromContent || false"
                                       (ngModelChange)="updateMapMapping(rowIndex, 'extractGpxFromContent', $event)">
                                <label class="form-check-label"
                                       [for]="'mapping-map-extract-gpx-' + rowIndex">
                                  Extract GPX from content
                                </label>
                              </div>
                            </div>
                            <div class="col-md-4">
                              <label class="form-label-sm"
                                     [for]="'mapping-map-gpx-path-' + rowIndex">
                                GPX file path
                              </label>
                              <input type="text" class="form-control"
                                     [id]="'mapping-map-gpx-path-' + rowIndex"
                                     [ngModel]="templateMappingBy(rowIndex)?.map?.gpxFilePath || ''"
                                     (ngModelChange)="updateMapMapping(rowIndex, 'gpxFilePath', $event)">
                            </div>
                            <div class="col-md-4">
                              <div class="form-check">
                                <input class="form-check-input" type="checkbox"
                                       [id]="'mapping-map-location-row-' + rowIndex"
                                       [ngModel]="templateMappingBy(rowIndex)?.map?.useLocationFromRow || false"
                                       (ngModelChange)="updateMapMapping(rowIndex, 'useLocationFromRow', $event)">
                                <label class="form-check-label"
                                       [for]="'mapping-map-location-row-' + rowIndex">
                                  Use location from row
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
                @if (actions.isCarouselOrAlbum(row)) {
                  <div class="row">
                    <div (nameInputChange)="editAlbumName=$event" class="col" app-row-settings-carousel
                         [row]="row"></div>
                  </div>
                }
                @if (actions.isIndex(row)) {
                  <app-album-index-site-edit [row]="row" [rowIndex]="rowIndex"/>
                }
                @if (actions.isSharedFragment(row)) {
                  <div class="row mt-2">
                    <div class="col-12">
                      <label [for]="'shared-fragment-path-' + rowIndex">Shared Fragment</label>
                      <app-fragment-selector
                        [elementId]="'shared-fragment-path-' + rowIndex"
                        [selectedFragment]="selectedFragmentForRow(row)"
                        (fragmentChange)="onSharedFragmentChange(row, $event)"/>
                    </div>
                  </div>
                  @if (row?.fragment?.pageContentId) {
                    <div class="mt-2 panel-border">
                      <app-dynamic-content-view [pageContent]="fragmentContent(row)" [contentPath]="fragmentPath(row)"
                                                [forceView]="true"/>
                    </div>
                    @if (!fragmentContent(row) && fragmentService.failedToLoad(row.fragment.pageContentId)) {
                      <div class="alert alert-warning mt-2">Fragment not found: {{ row.fragment.pageContentId }}</div>
                    }
                  }
                }
                @if (actions.isActionButtons(row)) {
                  <app-action-buttons [pageContent]="pageContent"
                                      [rowIndex]="rowIndex"/>
                }
                @if (actions.isCarouselOrAlbum(row)) {
                  <app-dynamic-content-site-edit-album [row]="row"
                                                       [rowIndex]="rowIndex"
                                                       [pageContent]="pageContent"/>
                }
                <app-dynamic-content-site-edit-text-row [row]="row"
                                                        [rowIndex]="rowIndex"
                                                        [rootRowIndex]="rowIndex"
                                                        [contentDescription]="contentDescription"
                                                        [contentPath]="contentPath"
                                                        [pageContent]="pageContent"
                                                        [isMigrationTemplateSelected]="isMigrationTemplateSelected.bind(this)"
                                                        [templateMappingMode]="templateMappingMode"
                                                        [columnMapping]="columnMapping.bind(this)"
                                                        (columnMappingSourceChange)="onColumnMappingSourceChange($event.rowIndex, $event.columnIndex, $event.value, $event.nestedRowIndex, $event.nestedColumnIndex)"
                                                        (columnNestedRowMappingUpdate)="updateColumnNestedRowMapping($event.rowIndex, $event.columnIndex, $event.updates, $event.nestedRowIndex, $event.nestedColumnIndex)"
                                                        (columnMappingPropertyUpdate)="updateColumnMappingProperty($event.rowIndex, $event.columnIndex, $event.key, $event.value, $event.nestedRowIndex, $event.nestedColumnIndex)"
                                                        [columnContentTypeOptions]="columnContentTypeOptions"
                                                        [imagePatternOptions]="imagePatternOptions"
                                                        [templateSourceOptions]="templateSourceOptions"
                                                        [templateExtractOptions]="templateExtractOptions"
                                                        [allowColumnMappings]="columnMappingEnabled(rowIndex)"/>
                @if (actions.isEvents(row)) {
                  <app-dynamic-content-site-edit-events [row]="row" [rowIndex]="rowIndex"/>
                }
                @if (actions.isAreaMap(row)) {
                  <app-dynamic-content-site-edit-area-map [row]="row" [id]="'area-map-' + rowIndex"
                                                          [pageContent]="pageContent"/>
                }
                @if (actions.isMap(row)) {
                  <app-dynamic-content-site-edit-map [row]="row" [id]="'map-' + rowIndex"
                                                     [pageContent]="pageContent"/>
                }
                @if (actions.isLocation(row)) {
                  <app-dynamic-content-site-edit-location [row]="row" [rowIndex]="rowIndex"/>
                }
              </div>
            }
            <ng-container *ngTemplateOutlet="saveButtonsAndPath"/>
          </div>
        </div>
      }
      <ng-template #saveButtonsAndPath>
        <div class="d-flex align-items-center flex-wrap gap-3 w-100">
          <div class="d-flex align-items-center flex-wrap gap-2">
            <app-badge-button [disabled]="actions.rowsInEdit.length>0 || savingPage" (click)="onSaveClicked()"
                              [tooltip]="actions.rowsInEdit.length>0?'Finish current row edit before saving':'Save page changes'"
                              [icon]="savingPage?faSpinner:faSave" [spin]="savingPage"
                              caption="Save page changes"/>
            <app-badge-button [disabled]="savingPage" (click)="revertPageContent()"
                              [tooltip]="'Revert page changes'"
                              [icon]="faUndo"
                              caption="Revert page changes"/>
            @if (insertableContent?.length > 0) {
              <app-badge-button (click)="insertData()"
                                [tooltip]="'Insert missing data'"
                                [icon]="faAdd" caption="Insert data"/>
            }
            @if (pageContent.rows?.length === 0) {
              <app-badge-button (click)="createContent()"
                                [tooltip]="'Add first row'"
                                [icon]="faAdd" caption="Add first row"/>
            }
            @if (unreferencedPaths?.length > 0) {
              <app-badge-button (click)="toggleShowUnreferencedPages()"
                                [icon]="faEye"
                                [active]="showUnreferenced"
                                caption="{{showUnreferenced? 'Hide':'Show'}} {{stringUtils.pluraliseWithCount(unreferencedPaths?.length, 'unreferenced page')}}"/>
            }
            <app-badge-button
              [icon]="faCopy"
              caption="Copy current page content"
              [tooltip]="'Copy page content JSON to clipboard'"
              (click)="copyCurrentPageContent()"/>
            <app-badge-button
              [icon]="faPaste"
              [active]="pastePageContentVisible"
              caption="Paste page content"
              [tooltip]="'Paste JSON from another page or template'"
              (click)="togglePastePageContent()"/>
            @if (pageContent?.debugLogs?.length) {
              <app-badge-button
                [icon]="faCopy"
                caption="Copy debug logs ({{ pageContent.debugLogs.length }})"
                [tooltip]="'Copy migration debug logs to clipboard'"
                (click)="copyDebugLogs()"/>
            }
            <app-badge-button (click)="deletePageContent()"
                              [icon]="faRemove"
                              delay=500 caption="Delete page"
                              [tooltip]="deletePagContentTooltip()"
                              [disabled]="savingPage || allReferringPages().length !== 0"/>
          </div>
          @if (pastePageContentVisible) {
            <div class="w-100">
              <label class="form-label-sm" for="paste-page-content">Paste PageContent JSON</label>
              <textarea id="paste-page-content"
                        class="form-control"
                        rows="6"
                        placeholder='{"path": "fragments/templates/routes-template", "rows": [...] }'
                        [(ngModel)]="pastePageContentText"></textarea>
              @if (pastePageContentError) {
                <div class="text-danger mt-1">{{ pastePageContentError }}</div>
              }
              @if (pastePathMismatch) {
                <div class="alert alert-warning mt-2 mb-2">
                  <strong>Path Mismatch:</strong> The pasted content has a different path. Which path should be used?
                  <div class="mt-2">
                    <div class="form-check">
                      <input class="form-check-input" type="radio" [name]="'pathChoice-' + componentId"
                             [id]="'keepCurrentPath-' + componentId"
                             [value]="pageContent?.path" [(ngModel)]="selectedPastePath">
                      <label class="form-check-label" [for]="'keepCurrentPath-' + componentId">
                        Keep current path: <strong>{{ pageContent?.path }}</strong>
                      </label>
                    </div>
                    <div class="form-check">
                      <input class="form-check-input" type="radio" [name]="'pathChoice-' + componentId"
                             [id]="'usePastedPath-' + componentId"
                             [value]="pastedContentPath" [(ngModel)]="selectedPastePath"
                             [disabled]="pastedPathExists">
                      <label class="form-check-label" [for]="'usePastedPath-' + componentId">
                        Use pasted path: <strong>{{ pastedContentPath }}</strong>
                        @if (pastedPathExists) {
                          <span class="text-danger ms-2">(path already exists)</span>
                        }
                      </label>
                    </div>
                  </div>
                </div>
              }
              <div class="d-flex flex-wrap gap-2 mt-2">
                <app-badge-button
                  [icon]="pastingPageContent ? faSpinner : faSave"
                  [spin]="pastingPageContent"
                  [caption]="pastePathMismatch ? 'Apply with selected path' : 'Apply pasted content'"
                  [disabled]="pastingPageContent || (pastePathMismatch && !selectedPastePath)"
                  (click)="applyPastedPageContent()"/>
                <app-badge-button
                  [icon]="faRemove"
                  caption="Cancel"
                  (click)="cancelPastePageContent()"/>
              </div>
            </div>
          }
          <div class="ms-auto">
            <label class="form-check form-switch mb-0">
              <input class="form-check-input" type="checkbox"
                     [ngModel]="templateOptionsVisible"
                     (ngModelChange)="onTemplateToggle($event)">
              <span class="form-check-label">Template options</span>
            </label>
          </div>
          <div class="row w-100 mt-3">
            <div class="col-12">
              @if (this.allReferringPageCount() > 0) {
                <div>Referred to
                  by: @for (referringPage of allReferringPages(); track referringPage; let linkIndex = $index) {
                    <a class="ms-2 rams-text-decoration-pink"
                       [href]="referringPage">{{ formatHref(referringPage) }}{{ linkIndex < allReferringPageCount() - 1 ? ',' : '' }}</a>
                  }
                </div>
              } @else {
                <div>Not Referred to by any other pages or links</div>
              }
            </div>
          </div>
        </div>
      </ng-template>
    }`,
  styleUrls: ["./dynamic-content.sass"],
  imports: [FontAwesomeModule, BadgeButtonComponent, TooltipDirective, NgTemplateOutlet, RouterLink, NgClass, FormsModule, TypeaheadDirective, FragmentSelectorComponent, RowSettingsCarouselComponent, RowSettingsActionButtonsComponent, MarginSelectComponent, ActionsDropdownComponent, BulkActionSelectorComponent, AlbumIndexSiteEditComponent, ActionButtons, DynamicContentSiteEditAlbumComponent, DynamicContentSiteEditTextRowComponent, DynamicContentSiteEditEvents, DynamicContentSiteEditAreaMapComponent, DynamicContentSiteEditMap, DynamicContentSiteEditLocation, DynamicContentViewComponent, RowTypeSelectorComponent, MarkdownEditorComponent, TemplateSelectorComponent]
})
export class DynamicContentSiteEditComponent implements OnInit, OnDestroy {

  @Input("defaultPageContent") set acceptChangesFrom(defaultPageContent: PageContent) {
    this.logger.debug("acceptChangesFrom:defaultPageContent:", defaultPageContent);
    this.defaultPageContent = defaultPageContent;
    this.deriveInsertableData();
  }

  @Input("pageContent") set acceptPageContentChanges(pageContent: PageContent) {
    this.logger.debug("acceptPageContentChanges:pageContent:", pageContent);
    this.pendingPageContent = pageContent;
    if (!this.siteEditService.active()) {
      this.logger.debug("skipping initialisePageContent as site edit not active");
      return;
    }
    Promise.resolve().then(() => {
      this.initialisePageContent(pageContent);
      this.clearAlert(pageContent);
    });
  }

  @ViewChild(TemplateSelectorComponent) templateSelector: TemplateSelectorComponent;

  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  protected pageContentRowService = inject(PageContentRowService);
  protected siteEditService = inject(SiteEditService);
  private indexService = inject(IndexService);
  protected memberResourcesReferenceData = inject(MemberResourcesReferenceDataService);
  protected urlService = inject(UrlService);
  protected pageService = inject(PageService);
  protected uiActionsService = inject(UiActionsService);
  protected stringUtils = inject(StringUtilsService);
  protected pageContentService = inject(PageContentService);
  protected fragmentService = inject(FragmentService);
  protected actions = inject(PageContentActionsService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  protected dataPopulationService = inject(DataPopulationService);
  @Input() contentPathReadOnly: boolean;
  @Input() public queryCompleted: boolean;
  @Input() public notify: AlertInstance;
  @Input() public contentDescription: string;
  @Input() public contentPath: string;
  @ViewChildren(AlbumIndexSiteEditComponent) albumIndexComponents: QueryList<AlbumIndexSiteEditComponent>;
  private queriedContentPath: string;
  private albumIndexDataRows: PageContent[] = [];
  public showUnreferenced: boolean;
  public unreferencedPaths: string[];
  public pageContent: PageContent;
  public insertableContent: ColumnInsertData[] = [];
  private defaultPageContent: PageContent;
  private destinationPageContent: PageContent;
  public pageTitle: string;
  public templateOptionsVisible = false;
  public templateMappingMode = false;
  private preferredTemplateMappingMode = false;
  public templateFragments: PageContent[] = [];
  public templateFragmentsLoading = false;
  public selectedTemplateFragmentId = "";
  public pastePageContentVisible = false;
  public pastePageContentText = "";
  public pastePageContentError = "";
  public pastingPageContent = false;
  public pastePathMismatch = false;
  public pastedContentPath = "";
  public selectedPastePath = "";
  public pastedPathExists = false;
  public componentId = Math.random().toString(36).substring(2, 9);
  private pendingPastedContent: PageContent | null = null;
  protected readonly MigrationTemplateSourceType = MigrationTemplateSourceType;
  readonly contentTemplateTypeOptions = [
    {
      value: ContentTemplateType.SHARED_FRAGMENT,
      label: "Shared fragment",
      description: "Reusable page components (headers, footers, sidebars) that can be inserted into multiple pages"
    },
    {
      value: ContentTemplateType.USER_TEMPLATE,
      label: "User template",
      description: "Custom page layouts you create for quickly building new pages with consistent structure"
    },
    {
      value: ContentTemplateType.MIGRATION_TEMPLATE,
      label: "Migration template",
      description: "Templates with data mappings for migrating content from old pages to new structure"
    }
  ];
  readonly templateButtonIcons = {
    [ContentTemplateType.SHARED_FRAGMENT]: faClone,
    [ContentTemplateType.USER_TEMPLATE]: faSave,
    [ContentTemplateType.MIGRATION_TEMPLATE]: faPencil
  };
  readonly templateSourceOptions = [
    {value: MigrationTemplateSourceType.EXTRACT, label: "Extract from source"},
    {value: MigrationTemplateSourceType.METADATA, label: "Use metadata"},
    {value: MigrationTemplateSourceType.STATIC, label: "Static value"}
  ];
  readonly templateExtractOptions = [
    {value: TextMatchPattern.FIRST_HEADING_AND_CONTENT, label: "First heading + content"},
    {value: TextMatchPattern.LEVEL_1_OR_2_HEADING, label: "Level 1 or 2 heading"},
    {value: TextMatchPattern.PARAGRAPH, label: "Paragraph"},
    {value: TextMatchPattern.ALL_TEXT_UNTIL_IMAGE, label: "All text until image"},
    {value: TextMatchPattern.ALL_TEXT_AFTER_HEADING, label: "All text after heading"},
    {value: TextMatchPattern.TEXT_BEFORE_HEADING, label: "Text before heading"},
    {value: TextMatchPattern.TEXT_FROM_HEADING, label: "Text from heading"},
    {value: TextMatchPattern.HEADING_UNTIL_NEXT_HEADING, label: "Heading until next heading"},
    {value: TextMatchPattern.CONTENT_AFTER_FIRST_HEADING, label: "Content after first heading"},
    {value: TextMatchPattern.STARTS_WITH_HEADING, label: "Starts with heading"},
    {value: TextMatchPattern.REMAINING_TEXT, label: "Remaining text"},
    {value: TextMatchPattern.CUSTOM_REGEX, label: "Custom regex"}
  ];
  readonly templateMetadataOptions = [
    {value: "title", label: "Source title"},
    {value: "path", label: "Source path"},
    {value: "menuTitle", label: "Menu title"},
    {value: "publishDate", label: "Publish date"},
    {value: "migration-note", label: "Migration note"}
  ];
  readonly nestedRowContentSourceOptions = [
    {value: "remaining-images", label: "Remaining images"},
    {value: "remaining-text", label: "Remaining text"},
    {value: "all-content", label: "All content"},
    {value: "all-images", label: "All images"},
    {value: "pattern-match", label: "Pattern match"}
  ];
  readonly columnContentTypeOptions = [
    {value: ColumnContentType.IMAGE, label: "Image"},
    {value: ColumnContentType.TEXT, label: "Text"},
    {value: ColumnContentType.MIXED, label: "Mixed (image + text)"}
  ];
  readonly imagePatternOptions = [
    {value: ImagePattern.FIRST, label: "First"},
    {value: ImagePattern.LAST, label: "Last"},
    {value: ImagePattern.ALL, label: "All"},
    {value: ImagePattern.PATTERN_MATCH, label: "Pattern match"}
  ];
  readonly nestedRowPackingOptions = [
    {value: "one-per-item", label: "One row per item"},
    {value: "all-in-one", label: "All items in one row"},
    {value: "collect-with-breaks", label: "Collect with breaks"}
  ];
  readonly breakStopConditionOptions = [
    {value: "image", label: "Image"},
    {value: "heading", label: "Heading"},
    {value: "paragraph", label: "Paragraph"}
  ];
  faPencil = faPencil;
  faRemove = faRemove;
  faAdd = faAdd;
  faSave = faSave;
  faUndo = faUndo;
  faSpinner = faSpinner;
  faArrowsUpDown = faArrowsUpDown;
  faCopy = faCopy;
  faPaste = faPaste;
  faCircleCheck = faCircleCheck;
  TextMatchPattern = TextMatchPattern;
  public savingPage = false;
  providers: [{ provide: BsDropdownConfig, useValue: { isAnimated: true, autoClose: true } }];
  public destinationPath: string;
  public destinationPathLookup: Subject<string> = new Subject<string>();
  destinationPathInsertionRowIndex = 0;
  destinationPathInsertBeforeAfterIndex = 0;
  insertionRowLookup: InsertionRow[] = [];
  contentActions: string[] = [Action.MOVE, Action.COPY, Action.CREATE_FRAGMENT];
  public fragmentName: string;
  action: string = this.contentActions[0];
  insertionRowPosition: InsertionRow[] = [{index: 0, description: InsertionPosition.BEFORE}, {
    index: 1,
    description: InsertionPosition.AFTER
  }];
  public referringPages: PageContent[] = [];
  public pagesBelow: PageContent[] = [];
  private error: any = null;
  private pendingPageContent: PageContent;
  private pageHrefs: string[];
  private copyOrMoveActionComplete: boolean;
  private subscriptions: Subscription[] = [];
  public editAlbumName: boolean;
  protected readonly faEye = faEye;
  protected readonly last = last;
  protected readonly Action = Action;
  private rowDragTargetIndex: number = null;

  protected readonly faClone = faClone;

  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.systemConfigService.events().subscribe(item => {
      const pageHrefs: string[] = item.group.pages.map(link => link.href).filter(item => item);
      this.logger.debug("pageHrefs received as:", pageHrefs);
      if (pageHrefs.length > 0) {
        this.pageHrefs = pageHrefs;
      }
    });
    this.broadcastService.on(NamedEventType.SAVE_PAGE_CONTENT, (namedEvent: NamedEvent<PageContent>) => {
      this.logger.debug("event received:", namedEvent);
      if (namedEvent.data.id === this.pageContent.id) {
        this.savePageContent();
      }
    });
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_DELETED, (namedEvent: NamedEvent<PageContent>) => {
      this.logger.debug("event received:", namedEvent);
      this.savePageContent();
    });
    this.destinationPathLookup.pipe(debounceTime(250))
      .pipe(distinctUntilChanged())
      .subscribe(() => {
        this.pageContentService.findByPath(this.destinationPath)
          .then(response => {
            this.logger.debug("find by path:", this.destinationPath, "resulted in:", response);
            this.destinationPageContent = response;
            this.updateInsertionRowLookup();
          });
      });
    if (this.siteEditService.active()) {
      this.runInitCode();
    }
    this.subscriptions.push(this.siteEditService.events.subscribe(event => {
      if (event.data) {
        this.runInitCode();
        if (this.pendingPageContent) {
          this.initialisePageContent(this.pendingPageContent);
        }
      }
    }));
  }

  deriveInsertableData() {
    if (this.pageContent && this.defaultPageContent) {
      this.insertableContent = this.actions.calculateInsertableContent(this.pageContent, this.defaultPageContent);
      const message = `Insert ${this.stringUtils.pluraliseWithCount(this.insertableContent.length, "new item")}: ${this.insertableContent?.map(item => item.data.title)?.join(", ")}`;
      if (this.insertableContent.length > 0) {
        this.logger.debug("deriveInsertableData:insertableContent:from:defaultData", this.defaultPageContent, "returned missing data to insert:", this.insertableContent);
        this.notify.warning({title: "Additional content available for page:", message});
      } else {
        this.logger.debug("deriveInsertableData:insertableContent:from:defaultData", this.defaultPageContent, "no data to insert");
        this.notify.hide();
      }
    } else {
      this.logger.debug("deriveInsertableData:not calculating insertable data as pageContent:", this.pageContent, "defaultPageContent:", this.defaultPageContent);
    }
  }

  templateModeActive(): boolean {
    return !!this.templateType();
  }

  isFragmentPath(): boolean {
    return this.pageContent?.path?.startsWith("fragments/") || false;
  }

  canEnableTemplateMode(): boolean {
    return this.isFragmentPath();
  }

  templateType(): ContentTemplateType | "" {
    const template = this.pageContent?.migrationTemplate;
    if (!template) {
      return "";
    }
    if (template.templateType) {
      return template.templateType;
    }
    if (template.isTemplate) {
      template.templateType = ContentTemplateType.MIGRATION_TEMPLATE;
      return template.templateType;
    }
    return "";
  }

  templateTypeDescription(): string {
    const type = this.templateType();
    if (!type) {
      return "";
    }
    const name = type.replace(/-/g, "-");
    return this.dataPopulationService.defaultContent("template-type", name) || "";
  }

  onTemplateToggle(enabled: boolean) {
    if (enabled && this.canEnableTemplateMode()) {
      this.ensureTemplateStructures();
    }
    this.templateOptionsVisible = enabled;
    this.uiActionsService.saveValueFor(StoredValue.TEMPLATE_OPTIONS_VISIBLE, enabled);
  }

  async createTemplateFromPage() {
    if (!this.pageContent?.rows?.length) {
      this.notify.error({title: "Create Template", message: "Add at least one row before creating a template"});
      return;
    }

    const fragmentPath = this.defaultTemplateFragmentPath();

    try {
      const existingFragment = await this.pageContentService.findByPath(fragmentPath);
      if (existingFragment) {
        this.notify.warning({
          title: "Template Exists",
          message: `A template already exists at ${fragmentPath}. Navigate there to edit it.`
        });
        return;
      }
    } catch (error) {
      this.logger.info("Fragment doesn't exist, which is good - we can create it");
    }

    const fragmentPayload: PageContent = {
      path: fragmentPath,
      rows: await this.actions.copyContentTextIdsInRows(this.pageContent.rows || []),
      migrationTemplate: {
        isTemplate: true,
        templateType: ContentTemplateType.MIGRATION_TEMPLATE,
        mappings: []
      }
    };

    try {
      const saved = await this.pageContentService.createOrUpdate(fragmentPayload);
      await this.fragmentService.ensureLoadedById(saved.id);
      await this.templateSelector?.refresh();
      const navigateToTemplate = confirm(`Template created at ${saved.path}.\n\nWould you like to navigate to the template to configure it?`);
      if (navigateToTemplate) {
        this.urlService.navigateTo(["admin", "page-content", saved.path]);
      } else {
        this.notify.success({
          title: "Template Created",
          message: `Template saved at ${saved.path}`
        });
      }
    } catch (error) {
      this.notify.error({title: "Create Template", message: error});
    }
  }

  async copyCurrentPageContent() {
    try {
      const pageContentJson = JSON.stringify(this.pageContent, null, 2);
      await navigator.clipboard.writeText(pageContentJson);
      this.notify.success({
        title: "Copy Page Content",
        message: "Page content JSON copied to clipboard"
      });
    } catch (error) {
      this.notify.error({
        title: "Copy Page Content",
        message: "Failed to copy to clipboard: " + (error?.message || "Unknown error")
      });
    }
  }

  async copyDebugLogs() {
    try {
      const debugLogsText = (this.pageContent?.debugLogs || []).join("\n");
      await navigator.clipboard.writeText(debugLogsText);
      this.notify.success({
        title: "Copy Debug Logs",
        message: `Copied ${this.pageContent?.debugLogs?.length || 0} debug log entries to clipboard`
      });
    } catch (error) {
      this.notify.error({
        title: "Copy Debug Logs",
        message: "Failed to copy to clipboard: " + (error?.message || "Unknown error")
      });
    }
  }

  togglePastePageContent() {
    this.pastePageContentVisible = !this.pastePageContentVisible;
    if (!this.pastePageContentVisible) {
      this.resetPastePageContentState();
    }
  }

  cancelPastePageContent() {
    this.pastePageContentVisible = false;
    this.resetPastePageContentState();
  }

  private resetPastePageContentState() {
    this.pastePageContentText = "";
    this.pastePageContentError = "";
    this.pastingPageContent = false;
    this.pastePathMismatch = false;
    this.pastedContentPath = "";
    this.selectedPastePath = "";
    this.pastedPathExists = false;
    this.pendingPastedContent = null;
  }

  private extractPastedPageContent(value: any): PageContent | null {
    if (!value || !isObject(value) || isArray(value)) {
      return null;
    } else {
      const obj = value as Record<string, any>;
      if (obj.rows && obj.path) {
        return obj as PageContent;
      } else if (obj.response) {
        return this.extractPastedPageContent(obj.response);
      } else if (obj.data) {
        return this.extractPastedPageContent(obj.data);
      } else if (obj.pageContent) {
        return this.extractPastedPageContent(obj.pageContent);
      } else {
        return null;
      }
    }
  }

  async applyPastedPageContent() {
    if (this.pastingPageContent) {
      return;
    }

    if (this.pastePathMismatch && this.pendingPastedContent && this.selectedPastePath) {
      this.pastingPageContent = true;
      try {
        this.pendingPastedContent.path = this.selectedPastePath;
        await this.initialisePageContent(this.pendingPastedContent);
        this.notify.success({
          title: "Paste Page Content",
          message: `Applied pasted content to ${this.pendingPastedContent.path}`
        });
        this.cancelPastePageContent();
      } catch (error) {
        this.pastePageContentError = error instanceof Error ? error.message : "Failed to apply content";
      } finally {
        this.pastingPageContent = false;
      }
      return;
    }

    const raw = this.pastePageContentText?.trim();
    if (!raw) {
      this.pastePageContentError = "Paste JSON representing PageContent";
      return;
    }
    this.pastingPageContent = true;
    this.pastePageContentError = "";
    try {
      const parsed = JSON.parse(raw);
      const extracted = this.extractPastedPageContent(parsed);
      if (!extracted) {
        throw new Error("Unable to locate PageContent in pasted JSON");
      }
      delete extracted.id;
      delete (extracted as any)._id;

      const pastedPath = this.urlService.reformatLocalHref(extracted.path || "");
      const currentPath = this.pageContent?.path || "";

      if (pastedPath && currentPath && pastedPath !== currentPath) {
        const existingPage = await this.pageContentService.findByPath(pastedPath);
        this.pastedPathExists = !!existingPage;
        this.pastedContentPath = pastedPath;
        this.selectedPastePath = currentPath;
        this.pendingPastedContent = extracted;
        this.pastePathMismatch = true;
        this.pastingPageContent = false;
        return;
      }

      extracted.path = pastedPath || currentPath;
      await this.initialisePageContent(extracted);
      this.notify.success({
        title: "Paste Page Content",
        message: `Applied pasted content to ${extracted.path}`
      });
      this.cancelPastePageContent();
    } catch (error) {
      this.pastePageContentError = error instanceof Error ? error.message : "Invalid JSON supplied";
    } finally {
      this.pastingPageContent = false;
    }
  }

  isTemplateType(type: ContentTemplateType): boolean {
    return this.templateType() === type;
  }

  setTemplateType(type: ContentTemplateType) {
    if (!this.pageContent) {
      return;
    }
    this.ensureTemplateStructures();
    this.pageContent.migrationTemplate.templateType = type;
    this.pageContent.migrationTemplate.isTemplate = true;
    const mappingEnabled = type === ContentTemplateType.MIGRATION_TEMPLATE ? this.preferredTemplateMappingMode : false;
    this.setTemplateMappingMode(mappingEnabled, true);
  }

  removeTemplate() {
    if (!this.pageContent?.migrationTemplate) {
      return;
    }
    this.pageContent.migrationTemplate.isTemplate = false;
    delete this.pageContent.migrationTemplate.templateType;
    this.setTemplateMappingMode(false, false);
  }

  isMigrationTemplateSelected(): boolean {
    return this.templateType() === ContentTemplateType.MIGRATION_TEMPLATE;
  }

  templateButtonIcon(type: ContentTemplateType) {
    return this.templateButtonIcons[type] || faCheck;
  }

  defaultTemplateFragmentPath(): string {
    const base = this.pageContent?.path || "template";
    const slug = this.stringUtils.kebabCase(base);
    const normalised = slug?.startsWith("fragments/") ? slug.replace(/^fragments\//, "") : slug;
    return `${USER_TEMPLATES_PATH_PREFIX}${normalised}`;
  }

  templateFragmentLabel(fragment: PageContent): string {
    return fragment?.path || "Unknown";
  }

  private fragmentIsTemplate(fragment: PageContent): boolean {
    return !!this.fragmentTemplateType(fragment);
  }

  private fragmentTemplateType(fragment: PageContent): ContentTemplateType | "" {
    if (!fragment) {
      return "";
    }
    if (fragment?.migrationTemplate?.templateType) {
      return fragment.migrationTemplate.templateType;
    }
    if (fragment?.migrationTemplate?.isTemplate) {
      return ContentTemplateType.MIGRATION_TEMPLATE;
    }
    const normalised = this.urlService.reformatLocalHref(fragment?.path || "")?.replace(/^\/+/, "") || "";
    if (normalised.startsWith(USER_TEMPLATES_PATH_PREFIX)) {
      return ContentTemplateType.USER_TEMPLATE;
    }
    return "";
  }

  setTemplateMappingMode(value: boolean, persist = true) {
    this.logger.debug("setTemplateMappingMode:value:", value, "persist:", persist, "isMigrationTemplateSelected:", this.isMigrationTemplateSelected());
    this.templateMappingMode = value;
    if (persist) {
      this.uiActionsService.saveValueFor(StoredValue.MIGRATION_TEMPLATE_MAPPING_MODE, this.templateMappingMode);
      this.preferredTemplateMappingMode = this.templateMappingMode;
    }
    this.syncTemplateMappingAvailability();
  }

  templateMappingBy(rowIndex: number, columnIndex?: number): MigrationTemplateMapping | undefined {
    if (!this.isMigrationTemplateSelected()) {
      return undefined;
    }
    const template = this.pageContent?.migrationTemplate;
    if (!template?.mappings) {
      return undefined;
    }
    return template.mappings.find(mapping => this.mappingMatches(mapping, rowIndex, columnIndex));
  }

  templateMappingSourceType(rowIndex: number): string {
    const mapping = this.templateMappingBy(rowIndex);
    if (!mapping) {
      return "";
    } else if (mapping.sourceType) {
      return mapping.sourceType;
    } else if (mapping.columnMappings && mapping.columnMappings.length > 0) {
      const firstColumnMapping = mapping.columnMappings[0];
      return firstColumnMapping.sourceType || "";
    } else {
      return "";
    }
  }

  columnMappingEnabled(rowIndex: number): boolean {
    if (!this.isMigrationTemplateSelected()) {
      return false;
    }
    return this.templateMappingSourceType(rowIndex) !== MigrationTemplateSourceType.METADATA;
  }

  templateMappingExtractPreset(rowIndex: number): string {
    const mapping = this.templateMappingBy(rowIndex);
    if (!mapping) {
      return "";
    }
    if (mapping.textPattern || mapping.extractPreset || mapping.extractPattern) {
      return this.actualExtractPreset(mapping);
    }
    if (mapping.columnMappings && mapping.columnMappings.length > 0) {
      const firstColumnMapping = mapping.columnMappings[0];
      if (firstColumnMapping.textPattern) {
        return firstColumnMapping.textPattern;
      }
      if (firstColumnMapping.extractPreset) {
        return firstColumnMapping.extractPreset;
      }
      if (firstColumnMapping.extractPattern) {
        const matchedOption = this.templateExtractOptions.find(option => option.value === firstColumnMapping.extractPattern);
        if (matchedOption) {
          return matchedOption.value;
        } else {
          return TextMatchPattern.CUSTOM_REGEX;
        }
      }
    }
    return "";
  }

  isConfigurationOnlyMapping(rowIndex: number): boolean {
    const mapping = this.templateMappingBy(rowIndex);
    if (!mapping) {
      return false;
    }
    const hasMapOrLocationConfig = !!(mapping.map || mapping.location);
    const hasContentExtraction = !!(
      mapping.textPattern ||
      mapping.extractPreset ||
      mapping.extractPattern ||
      (mapping.columnMappings && mapping.columnMappings.length > 0)
    );
    return hasMapOrLocationConfig && !hasContentExtraction;
  }

  templateMappingSummary(row: PageContentRow, rowIndex: number): string | null {
    if (!this.isMigrationTemplateSelected()) {
      return null;
    }
    const mapping = this.templateMappingBy(rowIndex);
    if (!mapping?.sourceType) {
      return null;
    }
    if (mapping.sourceType === MigrationTemplateSourceType.EXTRACT) {
      if (row.type === PageContentType.LOCATION && mapping.location?.extractFromContent) {
        return mapping.location?.hideRow ? "Extract location (hidden)" : "Extract location";
      }
      const label = this.extractPresetLabel(mapping.extractPreset || mapping.extractPattern);
      return label ? `Extract ${label.toLowerCase()}` : "Extract";
    }
    if (mapping.sourceType === MigrationTemplateSourceType.METADATA) {
      const label = this.metadataLabel(mapping.sourceIdentifier);
      return label ? `Metadata: ${label}` : "Metadata";
    }
    if (mapping.sourceType === MigrationTemplateSourceType.STATIC) {
      return "Static";
    }
    return null;
  }

  onMappingSourceChange(rowIndex: number, value: MigrationTemplateSourceType | "") {
    if (!this.isMigrationTemplateSelected()) {
      return;
    }
    if (!value) {
      this.clearTemplateMapping(rowIndex);
      return;
    }
    const mapping = this.ensureTemplateMapping(rowIndex);
    mapping.sourceType = value;
    if (value !== MigrationTemplateSourceType.EXTRACT) {
      delete mapping.extractPreset;
      delete mapping.extractPattern;
      delete mapping.location;
    }
    if (value !== MigrationTemplateSourceType.METADATA) {
      delete mapping.sourceIdentifier;
    }
    if (value !== MigrationTemplateSourceType.STATIC) {
      delete mapping.notes;
    }
  }

  onExtractPresetChange(rowIndex: number, preset: string) {
    if (!this.isMigrationTemplateSelected()) {
      return;
    }
    const mapping = this.ensureTemplateMapping(rowIndex);
    if (preset) {
      mapping.textPattern = preset;
      delete mapping.extractPattern;
      delete mapping.extractPreset;
    } else {
      delete mapping.textPattern;
      delete mapping.extractPattern;
      delete mapping.extractPreset;
    }
  }

  updateExtractPattern(rowIndex: number, value: string) {
    if (!this.isMigrationTemplateSelected()) {
      return;
    }
    const mapping = this.ensureTemplateMapping(rowIndex);
    mapping.extractPattern = value || undefined;
  }

  updateMetadataSelection(rowIndex: number, value: string) {
    if (!this.isMigrationTemplateSelected()) {
      return;
    }
    const mapping = this.ensureTemplateMapping(rowIndex);
    mapping.sourceIdentifier = value || undefined;
  }

  updateMappingNotes(rowIndex: number, value: string) {
    if (!this.isMigrationTemplateSelected()) {
      return;
    }
    const mapping = this.ensureTemplateMapping(rowIndex);
    mapping.notes = value || undefined;
  }

  updateLocationMapping<K extends keyof MigrationTemplateLocationMapping>(rowIndex: number, key: K, value: MigrationTemplateLocationMapping[K]) {
    if (!this.isMigrationTemplateSelected()) {
      return;
    }
    const mapping = this.ensureTemplateMapping(rowIndex);
    mapping.location = mapping.location || {};
    if (isString(value) && value.trim().length === 0) {
      delete mapping.location[key];
    } else {
      mapping.location[key] = value;
    }
    if (mapping.location && keys(mapping.location).length === 0) {
      delete mapping.location;
    } else {
      mapping.sourceType = MigrationTemplateSourceType.EXTRACT;
    }
  }

  updateMapMapping<K extends keyof MigrationTemplateMapMapping>(rowIndex: number, key: K, value: MigrationTemplateMapMapping[K]) {
    if (!this.isMigrationTemplateSelected()) {
      return;
    }
    const mapping = this.ensureTemplateMapping(rowIndex);
    mapping.map = mapping.map || {};
    if (isString(value) && value.trim().length === 0) {
      delete mapping.map[key];
    } else if (isNumber(value) || !isUndefined(value)) {
      mapping.map[key] = value;
    }
    if (mapping.map && keys(mapping.map).length === 0) {
      delete mapping.map;
    } else {
      mapping.sourceType = MigrationTemplateSourceType.EXTRACT;
    }
  }

  hasColumnsWithNestedRows(row: PageContentRow): boolean {
    return row.columns?.some(col => col.rows && col.rows.length > 0) || false;
  }

  columnMapping(rowIndex: number, columnIndex: number, nestedRowIndex?: number, nestedColumnIndex?: number): ColumnMappingConfig | undefined {
    if (!this.isMigrationTemplateSelected()) {
      return undefined;
    }
    const template = this.pageContent?.migrationTemplate;
    if (!template?.mappings) {
      return undefined;
    }
    for (const mapping of template.mappings) {
      if (mapping.targetRowIndex === rowIndex && mapping.columnMappings) {
        const columnMapping = mapping.columnMappings.find(cm => this.columnMappingMatches(cm, columnIndex, nestedRowIndex, nestedColumnIndex));
        if (columnMapping) {
          return columnMapping;
        }
      }
    }
    return undefined;
  }

  private columnMappingMatches(mapping: ColumnMappingConfig, columnIndex: number, nestedRowIndex?: number, nestedColumnIndex?: number): boolean {
    if (mapping.columnIndex !== columnIndex) {
      return false;
    }
    const mappingNestedRowIndex = mapping.nestedRowIndex ?? mapping.targetNestedRowIndex;
    const mappingNestedColumnIndex = mapping.nestedColumnIndex ?? mapping.targetNestedColumnIndex;
    if ((nestedRowIndex ?? undefined) !== (mappingNestedRowIndex ?? undefined)) {
      return false;
    }
    if ((nestedColumnIndex ?? undefined) !== (mappingNestedColumnIndex ?? undefined)) {
      return false;
    }
    return true;
  }

  ensureColumnMapping(rowIndex: number, columnIndex: number, nestedRowIndex?: number, nestedColumnIndex?: number): ColumnMappingConfig {
    const rowMapping = this.ensureTemplateMapping(rowIndex);
    rowMapping.columnMappings = rowMapping.columnMappings || [];
    let colMapping = rowMapping.columnMappings.find(cm => this.columnMappingMatches(cm, columnIndex, nestedRowIndex, nestedColumnIndex));
    if (!colMapping) {
      colMapping = {columnIndex};
      if (!isUndefined(nestedRowIndex)) {
        colMapping.nestedRowIndex = nestedRowIndex;
      }
      if (!isUndefined(nestedColumnIndex)) {
        colMapping.nestedColumnIndex = nestedColumnIndex;
      }
      rowMapping.columnMappings.push(colMapping);
    } else {
      if (!isUndefined(nestedRowIndex)) {
        colMapping.nestedRowIndex = nestedRowIndex;
        delete colMapping.targetNestedRowIndex;
      }
      if (!isUndefined(nestedColumnIndex)) {
        colMapping.nestedColumnIndex = nestedColumnIndex;
        delete colMapping.targetNestedColumnIndex;
      }
    }
    return colMapping;
  }

  clearColumnMapping(rowIndex: number, columnIndex: number, nestedRowIndex?: number, nestedColumnIndex?: number) {
    const rowMapping = this.templateMappingBy(rowIndex);
    if (rowMapping?.columnMappings) {
      rowMapping.columnMappings = rowMapping.columnMappings.filter(cm => !this.columnMappingMatches(cm, columnIndex, nestedRowIndex, nestedColumnIndex));
      if (rowMapping.columnMappings.length === 0) {
        delete rowMapping.columnMappings;
      }
    }
  }

  onColumnMappingSourceChange(rowIndex: number, columnIndex: number, value: MigrationTemplateSourceType | "", nestedRowIndex?: number, nestedColumnIndex?: number) {
    if (!this.isMigrationTemplateSelected()) {
      return;
    }
    if (!value) {
      this.clearColumnMapping(rowIndex, columnIndex, nestedRowIndex, nestedColumnIndex);
      return;
    }
    const colMapping = this.ensureColumnMapping(rowIndex, columnIndex, nestedRowIndex, nestedColumnIndex);
    colMapping.sourceType = value;
    if (value !== "extract") {
      delete colMapping.extractPreset;
      delete colMapping.extractPattern;
      delete colMapping.nestedRowMapping;
    }
  }

  updateColumnNestedRowMapping(rowIndex: number, columnIndex: number, updates: Partial<NestedRowMappingConfig>, nestedRowIndex?: number, nestedColumnIndex?: number) {
    if (!this.isMigrationTemplateSelected()) {
      return;
    }
    const colMapping = this.ensureColumnMapping(rowIndex, columnIndex, nestedRowIndex, nestedColumnIndex);
    const target = colMapping.nestedRowMapping = colMapping.nestedRowMapping || {} as NestedRowMappingConfig;
    assignDeep(target, updates);
  }

  updateColumnMappingProperty(rowIndex: number, columnIndex: number, key: string, value: any, nestedRowIndex?: number, nestedColumnIndex?: number) {
    if (!this.isMigrationTemplateSelected()) {
      return;
    }
    const colMapping = this.ensureColumnMapping(rowIndex, columnIndex, nestedRowIndex, nestedColumnIndex);
    if (isString(value) && value.trim().length === 0) {
      delete colMapping[key];
    } else {
      colMapping[key] = value;
    }
  }

  async refreshTemplateFragments(showSpinner = true) {
    if (showSpinner) {
      this.templateFragmentsLoading = true;
    }
    try {
      const fragmentPaths = this.fragmentService.fragmentLinks || [];
      await Promise.all(fragmentPaths.map(path => this.fragmentService.ensureLoaded(path)));
      this.templateFragments = this.fragmentService.fragments.filter(fragment => this.fragmentIsTemplate(fragment));
      if (!this.templateFragments.length) {
        this.selectedTemplateFragmentId = "";
      } else if (!this.selectedTemplateFragmentId || !this.templateFragments.some(fragment => fragment.id === this.selectedTemplateFragmentId)) {
        this.selectedTemplateFragmentId = this.templateFragments[0].id;
      }
    } catch (error) {
      this.notify.error({title: "Template Library", message: error});
    } finally {
      if (showSpinner) {
        this.templateFragmentsLoading = false;
      }
    }
  }

  async onTemplateSelected(event: TemplateSelectEvent) {
    const template = event.template;
    const replace = event.replace || !(this.pageContent?.rows?.length);
    const rows = await this.actions.copyContentTextIdsInRows(template.rows || []);
    if (!this.pageContent.rows || replace) {
      this.pageContent.rows = rows;
    } else {
      this.pageContent.rows.push(...rows);
    }
    this.notify.success({title: "Template Library", message: `Applied template ${template.path}`});
  }

  async applySelectedTemplate(replace: boolean) {
    const fragmentId = this.selectedTemplateFragmentId;
    if (!fragmentId) {
      return;
    }
    await this.applyTemplateFragmentById(fragmentId, replace || !(this.pageContent?.rows?.length));
  }

  private async applyTemplateFragmentById(fragmentId: string, replace: boolean) {
    await this.fragmentService.ensureLoadedById(fragmentId);
    const fragment = this.fragmentService.contentById(fragmentId);
    if (!fragment) {
      this.notify.error({title: "Template Library", message: "Template fragment could not be loaded"});
      return;
    }
    const rows = await this.actions.copyContentTextIdsInRows(fragment.rows || []);
    if (!this.pageContent.rows || replace) {
      this.pageContent.rows = rows;
    } else {
      this.pageContent.rows.push(...rows);
    }
    const label = this.templateFragmentLabel(fragment);
    this.notify.success({title: "Template Library", message: `Applied template ${label}`});
  }

  private ensureTemplateStructures() {
    if (!this.pageContent) {
      return;
    }
    if (!this.pageContent.migrationTemplate) {
      this.pageContent.migrationTemplate = {} as MigrationTemplateMetadata;
    }
    if (!isArray(this.pageContent.migrationTemplate.mappings)) {
      this.pageContent.migrationTemplate.mappings = [];
    }
    this.syncTemplateMappingAvailability();
  }

  private ensureTemplateMapping(rowIndex: number, columnIndex?: number): MigrationTemplateMapping {
    if (!this.isMigrationTemplateSelected()) {
      throw new Error("Template mappings are only available for migration templates");
    }
    this.ensureTemplateStructures();
    const existing = this.templateMappingBy(rowIndex, columnIndex);
    if (existing) {
      return existing;
    }
    const mapping: MigrationTemplateMapping = {targetRowIndex: rowIndex};
    if (!isNull(columnIndex) && !isUndefined(columnIndex)) {
      mapping.targetColumnIndex = columnIndex;
    }
    this.pageContent.migrationTemplate.mappings.push(mapping);
    return mapping;
  }

  private clearTemplateMapping(rowIndex: number, columnIndex?: number) {
    if (!this.isMigrationTemplateSelected()) {
      return;
    }
    const template = this.pageContent?.migrationTemplate;
    if (!template?.mappings) {
      return;
    }
    template.mappings = template.mappings.filter(mapping => !this.mappingMatches(mapping, rowIndex, columnIndex));
  }

  private mappingMatches(mapping: MigrationTemplateMapping, rowIndex: number, columnIndex?: number): boolean {
    const mappingColumn = mapping.targetColumnIndex ?? undefined;
    const targetColumn = columnIndex ?? undefined;
    return mapping.targetRowIndex === rowIndex && mappingColumn === targetColumn;
  }

  private extractPresetLabel(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    return this.templateExtractOptions.find(option => option.value === value)?.label || value;
  }

  private metadataLabel(value?: string): string | undefined {
    if (!value) {
      return undefined;
    } else {
      return this.templateMetadataOptions.find(option => option.value === value)?.label || value;
    }
  }

  private ensureMappingSourceTypes() {
    if (!this.isMigrationTemplateSelected()) {
      return;
    }
    const mappings = this.pageContent?.migrationTemplate?.mappings;
    if (!mappings) {
      return;
    }
    mappings.forEach(mapping => {
      if (!mapping.sourceType) {
        if (mapping.location && keys(mapping.location).length > 0) {
          mapping.sourceType = MigrationTemplateSourceType.EXTRACT;
        } else if (mapping.map && keys(mapping.map).length > 0) {
          mapping.sourceType = MigrationTemplateSourceType.EXTRACT;
        }
      }
    });
  }

  actualExtractPreset(mapping: MigrationTemplateMapping): string {
    if (mapping.textPattern) {
      return mapping.textPattern;
    }
    if (mapping.extractPreset) {
      return mapping.extractPreset;
    }
    if (mapping.extractPattern) {
      const matchedOption = this.templateExtractOptions.find(option => option.value === mapping.extractPattern);
      if (matchedOption) {
        return matchedOption.value;
      } else {
        return TextMatchPattern.CUSTOM_REGEX;
      }
    }
    return "";
  }

  private syncTemplateMappingAvailability() {
    this.logger.debug("syncTemplateMappingAvailability:isMigrationTemplateSelected:", this.isMigrationTemplateSelected(), "templateMappingMode:", this.templateMappingMode, "Logic removed to prevent overriding user preference");
  }

  private computedTemplateFragmentPath(): string {
    const raw = this.pageContent?.migrationTemplate?.fragmentPath || this.defaultTemplateFragmentPath();
    const reformatted = this.urlService.reformatLocalHref(raw)?.replace(/^\/+/, "") || "";
    if (reformatted.startsWith("fragments/")) {
      return reformatted;
    } else {
      return `fragments/${reformatted}`;
    }
  }

  insertData() {
    this.insertableContent.forEach(item => {
      const pageContentColumns: PageContentColumn[] = this.actions.findPageContentColumnsOfType(this.pageContent, item.type);
      if (pageContentColumns) {
        pageContentColumns.splice(item.index, 0, item.data);
        this.logger.debug("pageContentColumns after insert:", pageContentColumns);
      } else {
        this.logger.warn("could not find  pageContentColumns of type:", item.type, "in pageContent:", this.pageContent);
      }
    });
    this.deriveInsertableData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private async runInitCode() {
    this.showUnreferenced = this.uiActionsService.initialBooleanValueFor(StoredValue.SHOW_UNREFERENCED_PAGES, false);
    this.templateOptionsVisible = this.uiActionsService.initialBooleanValueFor(StoredValue.TEMPLATE_OPTIONS_VISIBLE, false);
    this.templateMappingMode = this.uiActionsService.initialBooleanValueFor(StoredValue.MIGRATION_TEMPLATE_MAPPING_MODE, false);
    this.logger.debug("ngOnInit:templateMappingMode after loading:", this.templateMappingMode);
    this.preferredTemplateMappingMode = this.templateMappingMode;
    this.syncTemplateMappingAvailability();
    this.logger.debug("ngOnInit:runInitCode:pageContent:", this.pageContent, "path:", this.urlService.urlPath());
    await this.loadAllFragments();
    await this.pageContentService.allReferringPages(this.contentPath)
      .then(referringPages => {
        const referringPagesFilteredForExactPath = referringPages.filter(pageContent => this.actions.allPageHrefs(pageContent).includes(this.urlService.urlPath()));
        this.logger.debug("referringPages for:", this.contentPath, "referringPages:", referringPages, "referringPagesFilteredForExactPath:", referringPagesFilteredForExactPath);
        this.referringPages = referringPagesFilteredForExactPath;
      }).catch(error => {
        this.notify.error({title: "Failed to query referring pages:", message: error});
        this.queryCompleted = true;
        this.error = error;
      });
  }

  private async loadAllFragments() {
    const fragmentPaths = this.fragmentService.fragmentLinks;
    this.logger.debug("loadAllFragments: loading", fragmentPaths.length, "fragments");
    await Promise.all(fragmentPaths.map(path => this.fragmentService.ensureLoaded(path)));
    this.logger.debug("loadAllFragments: loaded", this.fragmentService.fragments.length, "fragments");
  }

  deleteRow(rowIndex: number) {
    this.actions.deleteRow(this.pageContent, rowIndex, false, null);
  }

  buttonClass(enabledIf: any) {
    return enabledIf ? "badge-button" : "badge-button disabled";
  }

  async createContent() {
    await this.initialisePageContent({
      path: this.contentPath,
      rows: [this.actions.defaultRowFor(PageContentType.TEXT)]
    });
    this.queryCompleted = true;
  }

  goToOtherPage() {
    this.urlService.navigateUnconditionallyTo([this.destinationPath]);
  }

  public changePageContentRowType(row: PageContentRow) {
    this.initialiseRowIfRequired(row);
  }

  private initialiseRowIfRequired(row: PageContentRow) {
    this.logger.debug("row:", row);
    if (this.actions.isCarouselOrAlbum(row)) {
      const defaultAlbum = this.actions.defaultAlbum(this.contentPathWithIndex(row));
      if (!row.carousel?.name) {
        const carousel = defaultAlbum;
        this.logger.debug("initialising carousel data:", carousel);
        row.carousel = carousel;
      } else if (!row.carousel.albumView) {
        row.carousel.albumView = defaultAlbum.albumView;
        row.carousel.eventType = defaultAlbum.eventType;
      }
    } else if (this.actions.isIndex(row)) {
      if (!row?.albumIndex?.contentPaths) {
        row.albumIndex = this.actions.defaultIndex();
        this.logger.debug("initialising albumIndex to:", row.albumIndex);
      }
    } else if (this.actions.isSharedFragment(row)) {
      if (!row?.fragment) {
        row.fragment = {pageContentId: ""};
      } else if (row.fragment.pageContentId) {
        this.fragmentService.ensureLoadedById(row.fragment.pageContentId);
      }
    } else if (this.actions.isLocation(row)) {
      if (!row?.location) {
        row.location = {
          start: this.defaultLocationDetails(),
          end: null,
          renderingMode: LocationRenderingMode.VISIBLE
        };
        this.logger.debug("initialising location to:", row.location);
      }
    } else if (this.actions.isMap(row)) {
      this.actions.ensureMapData(row);
    } else {
      this.logger.debug("not initialising data for ", row.type);
    }
  }

  private defaultLocationDetails(): LocationDetails {
    return {
      latitude: null,
      longitude: null,
      grid_reference_6: null,
      grid_reference_8: null,
      grid_reference_10: null,
      postcode: "",
      description: "",
      w3w: ""
    };
  }

  selectedFragmentForRow(row: PageContentRow): FragmentWithLabel | null {
    return this.fragmentService.fragmentWithLabelForId(row?.fragment?.pageContentId);
  }

  onSharedFragmentChange(row: PageContentRow, fragmentWithLabel: FragmentWithLabel) {
    this.logger.info("onSharedFragmentChange received fragmentWithLabel:", fragmentWithLabel);
    if (fragmentWithLabel?.pageContentId) {
      row.fragment = {pageContentId: fragmentWithLabel.pageContentId};
      this.logger.info("Set fragment:", row.fragment);
    } else {
      row.fragment = null;
    }
  }

  fragmentContent(row: PageContentRow): PageContent {
    return row?.fragment?.pageContentId ? this.fragmentService.contentById(row.fragment.pageContentId) : null;
  }

  fragmentPath(row: PageContentRow): string {
    return this.fragmentService.contentById(row?.fragment?.pageContentId)?.path;
  }

  onRowDragStart(event: DragEvent, index: number) {
    this.actions.draggedRowIndex = index;
    this.actions.dragStartX = event?.clientX ?? null;
    this.actions.dragStartY = event?.clientY ?? null;
    this.actions.dragHasMovedEvent(event)
    this.actions.dragHasMoved = false;
    try {
      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        const dragEl = (event.target as HTMLElement) || (event.currentTarget as HTMLElement);
        if (dragEl && event.dataTransfer.setDragImage) {
          event.dataTransfer.setDragImage(dragEl, 10, 10);
        }
      }
    } catch {
    }
  }

  onRowDragOver(targetIndex: number, $event: DragEvent) {
    $event.preventDefault();
    this.autoScrollViewport($event?.clientY ?? 0);
    const dx = ($event?.clientX ?? 0) - (this.actions.dragStartX ?? 0);
    const dy = ($event?.clientY ?? 0) - (this.actions.dragStartY ?? 0);
    if (!this.actions.dragHasMoved && (Math.abs(dx) + Math.abs(dy) > 3)) {
      this.actions.dragHasMoved = true;
    }
    this.rowDragTargetIndex = targetIndex;
  }

  private autoScrollViewport(clientY: number) {
    const threshold = 100;
    const speed = 20;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (clientY < threshold) {
      window.scrollBy({top: -speed, behavior: "auto"});
    } else if (clientY > vh - threshold) {
      window.scrollBy({top: speed, behavior: "auto"});
    }
  }

  onRowDrop(targetIndex: number) {
    if (isNull(this.actions.draggedRowIndex) || isUndefined(this.actions.draggedRowIndex)) {
      return;
    }
    if (targetIndex === this.actions.draggedRowIndex) {
      this.actions.draggedRowIndex = null;
      return;
    }
    move(this.pageContent.rows, this.actions.draggedRowIndex, targetIndex);
    this.actions.draggedRowIndex = null;
    this.rowDragTargetIndex = null;
  }

  onRowDragEnd() {
    this.rowDragTargetIndex = null;
  }

  rowDragTooltip(index: number): string | null {
    const dragged = this.actions.draggedRowIndex;
    const target = this.rowDragTargetIndex;
    if (isNull(dragged) || isUndefined(dragged)) {
      return null;
    }
    if (!this.actions.dragHasMoved) {
      return null;
    }
    if (target !== index) {
      return null;
    }
    if (dragged === target) {
      return "Drop: no change";
    }
    return `Drop row ${dragged + 1} ${dragged < target ? "after" : "before"} row ${target + 1}`;
  }

  public contentPathWithIndex(row: PageContentRow): string {
    const index = this.actions.carouselOrAlbumIndex(row, this.pageContent);
    return `${this.pageContent?.path?.replace("#", "")}${index > 0 ? "-" + index : ""}`;
  }

  public savePageContent(): Promise<boolean> {
    if (this.actions.rowsInEdit.length === 0) {
      this.logger.info("pageContent before save:", cloneDeep(this.pageContent));
        return this.pageContentService.createOrUpdate(this.pageContent)
          .then(async pageContent => {
            this.logger.info("pageContent after save response:", cloneDeep(pageContent));
            await this.initialisePageContent(pageContent);
            return this.urlService.redirectToNormalisedUrl(this.pageContent.path);
          });
    }
  }

  public revertPageContent() {
    this.actions.rowsInEdit = [];
    const revertPath = this.queriedContentPath || this.pageContent.path;
    this.logger.debug("reverting page content to:", revertPath);
    this.pageContentService.findByPath(revertPath)
      .then(async pageContent => {
        await this.initialisePageContent(pageContent);
        this.deriveInsertableData();
      });
  }

  public deletePageContent() {
    if (!this.deletePagContentDisabled()) {
      this.pageContentService.delete(this.pageContent.id)
        .then(() => this.urlService.navigateUnconditionallyTo([this.urlService.area()]));
    }
  }

  public deletePagContentTooltip() {
    return this.allReferringPageCount() === 0 ? "Delete this page" : "Can't delete as " + this.stringUtils.pluraliseWithCount(this.allReferringPageCount(), "other page") + " " + this.stringUtils.pluraliseWithCount(this.allReferringPageCount(), "refers", "refer") + " to this page";
  }

  public allReferringPageCount(): number {
    return this.allReferringPages().length;
  }

  private mainPagesReferred(): string[] {
    const mainPagesReferredTo = this.pageHrefs?.filter(href => href === first(this.pageContent.path.split("#")));
    this.logger.debug("mainPagesReferredTo:", mainPagesReferredTo);
    return mainPagesReferredTo;
  }

  public allReferringPages(): string[] {
    const allReferringPages = this.referringPages.map(pageContent => first(pageContent.path.split("?"))).concat(this.mainPagesReferred());
    this.logger.debug("allReferringPages:", allReferringPages);
    return allReferringPages;
  }

  public async unreferencedPagesStartingWith(pageContent: PageContent): Promise<void> {
    const albumIndexHrefs: string[] = this.albumIndexDataRows.map(albumIndexDataRow => albumIndexDataRow.rows[0].columns.map(item => item.href)).flat(2);
    const hrefsBelow: string[] = this.pagesBelow.map(page => this.actions.allPageHrefs(page)).flat(2);
    const currentPageHrefs = this.actions.allPageHrefs(pageContent).concat(pageContent.path);
    const allReferencedHrefs = uniq(currentPageHrefs.concat(albumIndexHrefs).concat(hrefsBelow)).sort();
    const pagePathsBelow: string[] = this.pagesBelow.map(page => this.urlService.pathOnlyFrom(page.path));
    const unreferencedPaths: string[] = uniq(pagePathsBelow.filter(path => !allReferencedHrefs.includes(path))).sort();
    this.unreferencedPaths = unreferencedPaths;
    this.logger.debug("calculateOtherPagesStartingWith:path:", pageContent.path, "albumIndexHrefs:", albumIndexHrefs, "currentPageHrefs:", currentPageHrefs, "allReferencedHrefs:", allReferencedHrefs, "pagesBelowPath:", this.pagesBelow, "pagePathsBelow:", pagePathsBelow, "unreferencedPaths:", unreferencedPaths);
  }

  private async collectNestedAlbumIndexes() {
    const albumIndexRows: PageContentRow[] = this.pagesBelow.map(item => item.rows.filter(row => this.actions.isIndex(row))).flat(3);
    const albums = await Promise.all(albumIndexRows.map(albumIndexRow => this.indexService.albumIndexToPageContent(albumIndexRow, albumIndexRows.indexOf(albumIndexRow))));
    this.logger.debug("collectNestedAlbumIndexes:albums:", albums);
    albums.forEach(album => this.collectAlbumIndexData(album));
  }

  public deletePagContentDisabled(): boolean {
    return this.allReferringPages().length > 0;
  }

  async performCopyOrMoveAction() {
    const createNewPage: boolean = !this.destinationPageContent;
    if (this.action === Action.CREATE_FRAGMENT) {
      const fragmentPath = this.urlService.reformatLocalHref(`fragments/${this.fragmentName}`);
      const newPageContent: PageContent = {
        path: fragmentPath,
        rows: await this.actions.copyContentTextIdsInRows(this.pageContentRowService.selectedRows())
      };
      this.logger.debug("new fragment newPageContent:", newPageContent);
      this.performAction(newPageContent, true, fragmentPath);
    } else if (createNewPage) {
      const newPageContent: PageContent = {
        path: this.destinationPath,
        rows: await this.actions.copyContentTextIdsInRows(this.pageContentRowService.selectedRows())
      };
      this.logger.debug("newPageContent:", newPageContent);
      this.performAction(newPageContent, createNewPage, this.destinationPath);
    } else {
      this.logger.debug("destinationPageContent.rows before:", cloneDeep(this.destinationPageContent.rows));
      const duplicatedRows: PageContentRow[] = this.action === Action.COPY
        ? await this.actions.copyContentTextIdsInRows(this.pageContentRowService.selectedRows())
        : this.pageContentRowService.selectedRows();
      this.destinationPageContent.rows.splice(
        this.destinationPathInsertionRowIndex + this.destinationPathInsertBeforeAfterIndex,
        0,
        ...duplicatedRows
      );
      this.logger.debug("destinationPageContent.rows after:", cloneDeep(this.destinationPageContent.rows));
      this.performAction(this.destinationPageContent, createNewPage, this.destinationPath);
    }
  }


  private performAction(newPageContent: PageContent, createNewPage: boolean, destinationLabel: string) {
    this.copyOrMoveActionComplete = false;
    this.pageContentService.createOrUpdate(newPageContent)
      .then(() => {
        if (this.action === Action.MOVE) {
          this.pageContent.rows = this.pageContent.rows.filter(row => !newPageContent.rows.includes(row));
          this.savePageContent().then(() => this.notifyActionCompleted(createNewPage, destinationLabel));
        } else {
          this.notifyActionCompleted(createNewPage, destinationLabel);
        }
      });
  }

  private notifyActionCompleted(createNewPage: boolean, destinationLabel: string) {
    this.copyOrMoveActionComplete = true;
    const count = this.pageContentRowService.selectedRowCount();
    const verb = count === 1 ? "was" : "were";
    const operation = this.action === Action.MOVE ? "moved" : "copied";
    const targetType = this.action === Action.CREATE_FRAGMENT ? "fragment" : "page";
    const destination = destinationLabel || this.destinationPath || this.pageContent?.path;
    this.notify.success({
      title: `${this.action} Rows`,
      message: `${this.stringUtils.pluraliseWithCount(count, "row")} ${verb} ${operation} to ${createNewPage ? "new" : "existing"} ${targetType} ${destination} successfully`
    });
    this.pageContentRowService.deselectAll();
  }

  canCreateContent() {
    return !this.pageContent && !this.error;
  }

  canGoToThatPage() {
    return !isEmpty(this.destinationPath) && (this.destinationPath !== this.pageContent.path) && this.copyOrMoveActionComplete;
  }

  formatHref(referringPage: string): string {
    return this.stringUtils.asTitle(referringPage?.split("#").join(" "));
  }

  contentPathChange(contentPath: string) {
    const reformattedPath = this.urlService.reformatLocalHref(contentPath);
    this.logger.debug("contentPathChange:", contentPath, "reformattedPath:", reformattedPath);
    this.pageContent.path = reformattedPath;
  }

  destinationPathInsertionRowIndexChange($event: any) {
    this.logger.debug("destinationPathInsertionRowIndexChange:", $event);
  }

  actionDisabled() {
    if (!this.pageContentRowService.rowsSelected()) {
      return true;
    }
    if (this.action === Action.CREATE_FRAGMENT) {
      return isEmpty(this.fragmentName);
    }
    return isEmpty(this.destinationPath) || (this.destinationPath === this.pageContent.path);
  }

  destinationPathLookupChange(value: string) {
    this.logger.debug("destinationPathLookupChange:", value);
    const reformattedPath = this.urlService.reformatLocalHref(value)?.replace(/^\/+/, "");
    this.destinationPathLookup.next(reformattedPath);
    this.destinationPath = reformattedPath;
  }

  private updateInsertionRowLookup() {
    if (this.destinationPageContent?.rows?.length) {
      this.insertionRowLookup = this.destinationPageContent.rows.map((row, index) => ({
        index,
        description: `Row ${index + 1}: ${this.rowSummary(row)}`
      }));
    } else {
      this.insertionRowLookup = [{index: 0, description: "Row 1: In new page"}];
    }
    this.destinationPathInsertionRowIndex = 0;
    this.destinationPathInsertBeforeAfterIndex = 0;
  }

  private rowSummary(row: PageContentRow): string {
    const type = this.stringUtils.asTitle((row?.type || "row").toString().replace(/-/g, " "));
    const columnCount = row?.columns?.length;
    return columnCount ? `${type} (${this.stringUtils.pluraliseWithCount(columnCount, "column")})` : type;
  }

  onSelectAllRowsChange(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      (this.pageContent?.rows || []).forEach(row => this.pageContentRowService.selectRow(row));
    } else {
      this.pageContentRowService.deselectAll();
    }
  }

  allRowsSelected(): boolean {
    const total = this.pageContent?.rows?.length || 0;
    return total > 0 && this.pageContentRowService.selectedRowCount() === total;
  }

  selectAllRowsIndeterminate(): boolean {
    const total = this.pageContent?.rows?.length || 0;
    const selected = this.pageContentRowService.selectedRowCount();
    return selected > 0 && selected < total;
  }

  firstSelectedRowIndex(): number {
    const indexes = this.pageContent?.rows?.map((row, index) => this.pageContentRowService.isSelected(row) ? index : null).filter(v => !isNull(v)) as number[];
    return indexes?.length ? Math.min(...indexes) : -1;
  }

  private clearAlert(pageContent: PageContent) {
    if (pageContent && this.notify) {
      this.notify.hide();
    }
  }

  private async initialisePageContent(pageContent: PageContent): Promise<void> {
    if (pageContent) {
      this.queriedContentPath = pageContent.path;
      pageContent.rows.forEach(row => this.initialiseRowIfRequired(row));
      this.pageContent = pageContent;
      this.ensureTemplateStructures();
      this.ensureMappingSourceTypes();
      this.logger.info("initialisePageContent.pageContent:", this.pageContent, "urlPath:", this.urlService.urlPath());
      await this.collectPagesBelowPath(pageContent);
      await this.collectNestedAlbumIndexes();
      await this.unreferencedPagesStartingWith(pageContent);
      await this.templateSelector?.refresh(false);
    }
  }

  private async collectPagesBelowPath(pageContent: PageContent) {
    const path = pageContent.path;
    const dataQueryOptions = {criteria: {path: fieldStartsWithValue(path)}};
    this.pagesBelow = await this.pageContentService.all(dataQueryOptions);
    this.logger.debug("initialisePageContent:path:", path, "dataQueryOptions:", dataQueryOptions, "pagesBelowPath:", this.pagesBelow);
  }

  collectAlbumIndexData(albumIndexDataRow: PageContent) {
    if (albumIndexDataRow) {
      this.albumIndexDataRows = this.albumIndexDataRows.filter(item => item.path !== albumIndexDataRow.path).concat(albumIndexDataRow);
      this.logger.debug("collectAlbumIndexData:albumIndexDataRow:", albumIndexDataRow, "albumIndexDataRows:", this.albumIndexDataRows);
    }
  }

  toggleShowUnreferencedPages() {
    this.showUnreferenced = !this.showUnreferenced;
    this.uiActionsService.saveValueFor(StoredValue.SHOW_UNREFERENCED_PAGES, this.showUnreferenced);
  }

  onSaveClicked() {
    if (this.actions.rowsInEdit.length > 0 || this.savingPage) {
      return;
    }
    this.savingPage = true;
    this.savePageContent()
      ?.catch(error => this.notify.error({title: "Failed to save page", message: error}))
      ?.finally(() => this.savingPage = false);
  }

  refreshAlbumIndexPreviews() {
    this.albumIndexComponents?.forEach(component => component.refreshContentPreview());
  }
}
