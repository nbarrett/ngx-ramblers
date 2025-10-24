import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import {
  faAdd,
  faArrowsUpDown,
  faEye,
  faPencil,
  faRemove,
  faSave,
  faSpinner,
  faUndo
} from "@fortawesome/free-solid-svg-icons";
import { cloneDeep, first, isEmpty, last, uniq } from "es-toolkit/compat";
import { BsDropdownConfig } from "ngx-bootstrap/dropdown";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import {
  Action,
  ColumnInsertData,
  ContentText,
  DuplicateUsageMessage,
  FragmentWithLabel,
  InsertionPosition,
  InsertionRow,
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentType
} from "../../../models/content-text.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { ContentTextService } from "../../../services/content-text.service";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
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
import { fieldStartsWithValue } from "../../../functions/mongo";
import { PageService } from "../../../services/page.service";
import { AlbumIndexService } from "../../../services/album-index.service";
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
import { AlbumIndexSiteEditComponent } from "./dynamic-content-site-edit-album-index";
import { ActionButtonsComponent } from "../action-buttons/action-buttons";
import { DynamicContentSiteEditAlbumComponent } from "./dynamic-content-site-edit-album";
import { DynamicContentSiteEditTextRowComponent } from "./dynamic-content-site-edit-text-row";
import { DuplicateContentDetectionService } from "../../../services/duplicate-content-detection-service";
import { move } from "../../../functions/arrays";
import { ALERT_ERROR } from "../../../models/alert-target.model";
import { DynamicContentSiteEditEvents } from "./dynamic-content-site-edit-events";
import { DynamicContentSiteEditAreaMapComponent } from "./dynamic-content-site-edit-area-map";
import { DynamicContentViewComponent } from "./dynamic-content-view";
import { FragmentService } from "../../../services/fragment.service";
import { RowTypeSelectorComponent } from "./row-type-selector";

@Component({
    selector: "app-dynamic-content-site-edit",
    template: `
      @if (siteEditService.active()) {
        @if (duplicateUsageMessages.length > 0) {
          <div class="alert alert-warning">
            <fa-icon [icon]="ALERT_ERROR.icon"/>
            <strong class="ms-2">Duplicate content usage on this page has been detected
              in {{ stringUtils.pluraliseWithCount(duplicateUsageMessages.length, "item") }}</strong>
            <div class="ms-3 mb-2">Scroll down to editable content panels below where content can be unlinked and
              optionally updated. When you have finished, click <strong>Save page changes</strong>.
            </div>
          </div>
        }
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
                          @for (page of pageService.linksFromPathSegments(urlService.pathSegmentsForUrl(path)); track page) {
                            <li class="breadcrumb-item d-none d-md-inline"
                            >
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
              @for (row of pageContent?.rows; track row; let rowIndex = $index) {
                @if (pageContentRowService.rowsSelected() && rowIndex === firstSelectedRowIndex()) {
                  <div class="thumbnail-site-edit mt-2">
                    <fieldset class="p-2 border rounded">
                      <legend class="float-none w-auto px-2 mb-0">Row Actions</legend>
                      <div class="row align-items-end">
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
                                {{ stringUtils.pluraliseWithCount(pageContentRowService.selectedRowCount(), "row") }} to</label>
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
                            <input id="fragment-name" [(ngModel)]="fragmentName" type="text" class="form-control" placeholder="Fragment name e.g. homepage-hero"/>
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
                    </fieldset>
                  </div>
                }
                <div class="thumbnail-site-edit-top-bottom-margins" (dragover)="onRowDragOver(rowIndex, $event)" (drop)="onRowDrop(rowIndex)">
                  <div class="thumbnail-heading" [attr.draggable]="true" (dragstart)="onRowDragStart($event, rowIndex)" (dragend)="onRowDragEnd()" [tooltip]="rowDragTooltip(rowIndex)" [isOpen]="!!rowDragTooltip(rowIndex)" container="body" triggers="">Row {{ rowIndex + 1 }}
                    @if (actions.isTextRow(row)) {
                      ({{ stringUtils.pluraliseWithCount(row?.columns.length, 'column') }})
                    }
                    <app-badge-button noRightMargin class="ms-2"
                                      (click)="deleteRow(rowIndex)"
                                      [icon]="faRemove"
                                      [tooltip]="'Delete row'"/>
                    <span class="drag-handle ms-2 float-end" [attr.draggable]="true" (dragstart)="onRowDragStart($event, rowIndex)">
                      <fa-icon [icon]="faArrowsUpDown"></fa-icon>
                    </span>
                  </div>
                  <div class="row align-items-end mb-3 d-flex">
                    <app-row-type-selector
                      [row]="row"
                      [rowIndex]="rowIndex"
                      [contentPath]="contentPath"
                      (typeChange)="changePageContentRowType(row)"/>
                    @if (actions.isCarouselOrAlbum(row)) {
                      <div (nameInputChange)="editAlbumName=$event" class="col" app-row-settings-carousel
                           [row]="row">
                      </div>
                    }
                    @if (!editAlbumName) {
                    @if (actions.isActionButtons(row) || actions.isAlbumIndex(row)) {
                      <div class="col-auto" app-row-settings-action-buttons [row]="row"></div>
                    }
                    <div class="col-auto">
                        <div class="d-inline-flex align-items-center flex-wrap">
                          <div app-margin-select label="Margin Top"
                               [data]="row"
                               field="marginTop" class="me-4">
                          </div>
                          <div app-margin-select label="Margin Bottom"
                               [data]="row"
                               field="marginBottom">
                          </div>
                        </div>
                      </div>
                    <div class="col-auto">
                      <div class="d-inline-flex align-items-center flex-wrap float-end" [ngClass]="actions.isActionButtons(row) ? 'mt-2' : ''">
                        <app-actions-dropdown [rowIndex]="rowIndex"
                                              [pageContent]="pageContent"
                                              [row]="row"/>
                        <app-bulk-action-selector [row]="row"/>
                      </div>
                    </div>
                    }
                  </div>
                  @if (actions.isAlbumIndex(row)) {
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
                                                          [contentDescription]="contentDescription"
                                                          [contentPath]="contentPath"
                                                          [pageContent]="pageContent"/>
                  @if (actions.isEvents(row)) {
                    <app-dynamic-content-site-edit-events [row]="row" [rowIndex]="rowIndex"/>
                  }
                  @if (actions.isAreaMap(row)) {
                    <app-dynamic-content-site-edit-area-map [row]="row" [id]="'area-map-' + rowIndex" [pageContent]="pageContent"/>
                  }
                </div>
              }
              <ng-container *ngTemplateOutlet="saveButtonsAndPath"/>
            </div>
          </div>
        }
        <ng-template #saveButtonsAndPath>
          <div class="d-inline-flex align-items-center flex-wrap">
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
            <app-badge-button (click)="deletePageContent()"
                              [icon]="faRemove"
                              delay=500 caption="Delete page"
                              [tooltip]="deletePagContentTooltip()"
                              [disabled]="savingPage || allReferringPages().length !== 0"/>
            @if (this.allReferringPageCount() > 0) {
              <div class="align-middle">Referred to
                by: @for (referringPage of allReferringPages(); track referringPage; let linkIndex = $index) {
                  <a class="ms-2 rams-text-decoration-pink"
                     [href]="referringPage">{{ formatHref(referringPage) }}{{ linkIndex < allReferringPageCount() - 1 ? ',' : '' }}</a>
                }
              </div>
            }
            @if (this.allReferringPageCount() === 0) {
              <div class="align-middle mb-2">Not Referred to by any other pages or links</div>
            }
          </div>
        </ng-template>
      }`,
    styleUrls: ["./dynamic-content.sass"],
  imports: [FontAwesomeModule, BadgeButtonComponent, TooltipDirective, NgTemplateOutlet, RouterLink, NgClass, FormsModule, TypeaheadDirective, FragmentSelectorComponent, RowSettingsCarouselComponent, RowSettingsActionButtonsComponent, MarginSelectComponent, ActionsDropdownComponent, BulkActionSelectorComponent, AlbumIndexSiteEditComponent, ActionButtonsComponent, DynamicContentSiteEditAlbumComponent, DynamicContentSiteEditTextRowComponent, DynamicContentSiteEditEvents, DynamicContentSiteEditAreaMapComponent, DynamicContentViewComponent, RowTypeSelectorComponent]
})
export class DynamicContentSiteEditComponent implements OnInit, OnDestroy {
  protected duplicateUsageMessages: DuplicateUsageMessage[] = [];

  @Input("defaultPageContent") set acceptChangesFrom(defaultPageContent: PageContent) {
    this.logger.debug("acceptChangesFrom:defaultPageContent:", defaultPageContent);
    this.defaultPageContent = defaultPageContent;
    this.deriveInsertableData();
  }

  @Input("pageContent") set acceptPageContentChanges(pageContent: PageContent) {
    this.logger.debug("acceptPageContentChanges:pageContent:", pageContent);
    this.initialisePageContent(pageContent);
    this.clearAlert(pageContent);
  }

  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  protected pageContentRowService = inject(PageContentRowService);
  protected siteEditService = inject(SiteEditService);
  private albumIndexService = inject(AlbumIndexService);
  protected memberResourcesReferenceData = inject(MemberResourcesReferenceDataService);
  protected urlService = inject(UrlService);
  protected duplicateContentDetectionService = inject(DuplicateContentDetectionService);
  protected pageService = inject(PageService);
  protected uiActionsService = inject(UiActionsService);
  protected stringUtils = inject(StringUtilsService);
  protected pageContentService = inject(PageContentService);
  protected fragmentService = inject(FragmentService);
  private contentTextService = inject(ContentTextService);
  protected actions = inject(PageContentActionsService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  @Input() contentPathReadOnly: boolean;
  @Input() public queryCompleted: boolean;
  @Input() public notify: AlertInstance;
  @Input() public contentDescription: string;
  @Input() public contentPath: string;
  private queriedContentPath: string;
  private albumIndexDataRows: PageContent[] = [];
  public showUnreferenced: boolean;
  public unreferencedPaths: string[];
  public pageContent: PageContent;
  public insertableContent: ColumnInsertData[] = [];
  private defaultPageContent: PageContent;
  private destinationPageContent: PageContent;
  public pageTitle: string;
  faPencil = faPencil;
  faRemove = faRemove;
  faAdd = faAdd;
  faSave = faSave;
  faUndo = faUndo;
  faSpinner = faSpinner;
  faArrowsUpDown = faArrowsUpDown;
  public savingPage = false;
  providers: [{ provide: BsDropdownConfig, useValue: { isAnimated: true, autoClose: true } }];
  public unsavedMarkdownComponents: Set<MarkdownEditorComponent> = new Set();
  public destinationPath: string;
  public destinationPathLookup: Subject<string> = new Subject<string>();
  destinationPathInsertionRowIndex = 0;
  destinationPathInsertBeforeAfterIndex = 0;
  insertionRowLookup: InsertionRow[] = [];
  contentActions: string[] = [Action.MOVE, Action.COPY, Action.CREATE_FRAGMENT];
  public fragmentName: string;
  action: string = this.contentActions[0];
  insertionRowPosition: InsertionRow[] = [{index: 0, description: InsertionPosition.BEFORE}, {index: 1, description: InsertionPosition.AFTER}];
  public referringPages: PageContent[] = [];
  public pagesBelow: PageContent[] = [];
  private error: any = null;
  private pageHrefs: string[];
  private copyOrMoveActionComplete: boolean;
  private subscriptions: Subscription[] = [];
  public editAlbumName: boolean;
  protected readonly faEye = faEye;
  protected readonly last = last;
  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly Action = Action;
  private rowDragTargetIndex: number = null;
  private fragmentCache = new Map<string, FragmentWithLabel>();

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
      this.pageContent?.rows?.forEach(row => row.columns.forEach(column => {
        if (column.contentTextId === namedEvent?.data?.id) {
          this.logger.debug("removing link to content " + namedEvent.data.id);
          delete column.contentTextId;
        }
      }));
      this.savePageContent();
    });
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_UNSAVED, (namedEvent: NamedEvent<MarkdownEditorComponent>) => {
      this.logger.debug("event received:", namedEvent);
      this.unsavedMarkdownComponents.add(namedEvent.data);
      this.logger.debug("added:", namedEvent.data, "to unsavedMarkdownComponents:", this.unsavedMarkdownComponents);
    });
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_SYNCED, (namedEvent: NamedEvent<MarkdownEditorComponent>) => {
      this.logger.debug("event received:", namedEvent);
      this.unsavedMarkdownComponents.delete(namedEvent.data);
      this.logger.debug("unsavedMarkdownComponents removed:", namedEvent.data, "result:", this.unsavedMarkdownComponents);
    });
    this.destinationPathLookup.pipe(debounceTime(250))
      .pipe(distinctUntilChanged())
      .subscribe(() => {
        this.pageContentService.findByPath(this.destinationPath)
          .then(response => {
            this.logger.debug("find by path:", this.destinationPath, "resulted in:", response);
            this.destinationPageContent = response;
            if (response) {
              const contentTextIds = response.rows.map((row: PageContentRow) => first(row.columns)?.contentTextId || first(first(first(row.columns)?.rows)?.columns)?.contentTextId);
              this.logger.debug("found contentTextIds:", contentTextIds);
              Promise.all(contentTextIds.map(contentTextId => this.contentTextService.getById(contentTextId))).then(contentTextItems => {
                const textRowInformation: string[] = contentTextItems.map(contentTextItem => this.firstTextLineFrom(contentTextItem));
                this.logger.debug("found contentTextItems:", textRowInformation);
                this.insertionRowLookup = textRowInformation.map((row, index) => ({index, description: `Row ${index + 1}: ${row}`}));
              });
            } else {
              this.insertionRowLookup = [{index: 0, description: `Row 1: In new page`}];
            }
          });
      });
    if (this.siteEditService.active()) {
      this.runInitCode();
    }
    this.subscriptions.push(this.siteEditService.events.subscribe(event => {
      if (event.data) {
        this.runInitCode();
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

  firstTextLineFrom(contentTextItem: ContentText): string {
    const replaced: string = this.stringUtils.replaceAll("#", "", first(contentTextItem?.text?.split("\n"))) as string;
    return replaced.trim();
  }

  async createContent() {
    await this.initialisePageContent({
      path: this.contentPath,
      rows: [this.actions.defaultRowFor(PageContentType.TEXT)]
    })
    this.queryCompleted = true;
    this.actions.notifyPageContentChanges(this.pageContent);
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
    } else if (this.actions.isAlbumIndex(row)) {
      if (!row?.albumIndex?.contentPaths) {
        row.albumIndex = this.actions.defaultAlbumIndex();
        this.logger.debug("initialising albumIndex to:", row.albumIndex);
      }
    } else if (this.actions.isSharedFragment(row)) {
      if (!row?.fragment) {
        row.fragment = {pageContentId: ""};
      } else if (row.fragment.pageContentId) {
        this.fragmentService.ensureLoadedById(row.fragment.pageContentId);
      }
    } else {
      this.logger.debug("not initialising data for ", row.type);
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
      this.actions.notifyPageContentChanges(this.pageContent);
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

  allowDrop($event: DragEvent) { $event.preventDefault(); }

  onRowDragStart(event: DragEvent, index: number) {
    this.actions.draggedRowIndex = index;
    this.actions.dragStartX = event?.clientX ?? null;
    this.actions.dragStartY = event?.clientY ?? null;
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

  onRowDragOver(targetIndex: number, $event: DragEvent) {
    $event.preventDefault();
    this.autoScrollViewport($event?.clientY ?? 0);
    const dx = ($event?.clientX ?? 0) - (this.actions.dragStartX ?? 0);
    const dy = ($event?.clientY ?? 0) - (this.actions.dragStartY ?? 0);
    if (!this.actions.dragHasMoved && (Math.abs(dx) + Math.abs(dy) > 3)) { this.actions.dragHasMoved = true; }
    this.rowDragTargetIndex = targetIndex;
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

  onRowDrop(targetIndex: number) {
    if (this.actions.draggedRowIndex === null || this.actions.draggedRowIndex === undefined) { return; }
    if (targetIndex === this.actions.draggedRowIndex) { this.actions.draggedRowIndex = null; return; }
    move(this.pageContent.rows, this.actions.draggedRowIndex, targetIndex);
    this.actions.draggedRowIndex = null;
    this.actions.notifyPageContentChanges(this.pageContent);
    this.rowDragTargetIndex = null;
  }

  onRowDragEnd() {
    this.rowDragTargetIndex = null;
  }

  rowDragTooltip(index: number): string | null {
    const dragged = this.actions.draggedRowIndex;
    const target = this.rowDragTargetIndex;
    if (dragged === null || dragged === undefined) { return null; }
    if (!this.actions.dragHasMoved) { return null; }
    if (target !== index) { return null; }
    if (dragged === target) { return "Drop: no change"; }
    return `Drop row ${dragged + 1} ${dragged < target ? 'after' : 'before'} row ${target + 1}`;
  }

  public contentPathWithIndex(row: PageContentRow): string {
    const index = this.actions.carouselOrAlbumIndex(row, this.pageContent);
    return `${this.pageContent?.path?.replace("#", "")}${index > 0 ? "-" + index : ""}`;
  }

  public savePageContent(): Promise<boolean> {
    if (this.actions.rowsInEdit.length === 0) {
      this.logger.debug("saving", this.stringUtils.pluraliseWithCount(this.unsavedMarkdownComponents.size, "markdown component"), "before saving page content");
      return Promise.all(Array.from(this.unsavedMarkdownComponents.values()).map(component => component.save())).then(() => {
        return this.pageContentService.createOrUpdate(this.pageContent)
          .then(async pageContent => {
            await this.initialisePageContent(pageContent);
            return this.urlService.redirectToNormalisedUrl(this.pageContent.path);
          });
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
        this.actions.notifyPageContentChanges(pageContent);
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
    const albumIndexRows: PageContentRow[] = this.pagesBelow.map(item => item.rows.filter(row => this.actions.isAlbumIndex(row))).flat(3);
    const albums = await Promise.all(albumIndexRows.map(albumIndexRow => this.albumIndexService.albumIndexToPageContent(albumIndexRow, albumIndexRows.indexOf(albumIndexRow))));
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
    if (!this.pageContentRowService.rowsSelected()) { return true; }
    if (this.action === Action.CREATE_FRAGMENT) { return isEmpty(this.fragmentName); }
    return isEmpty(this.destinationPath) || (this.destinationPath === this.pageContent.path);
  }

  destinationPathLookupChange(value: string) {
    this.logger.debug("destinationPathLookupChange:", value);
    this.destinationPathLookup.next(value);
    this.destinationPath = value;
  }

  firstSelectedRowIndex(): number {
    const indexes = this.pageContent?.rows?.map((row, index) => this.pageContentRowService.isSelected(row) ? index : null).filter(v => v !== null) as number[];
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
      this.logger.info("initialisePageContent.pageContent:", this.pageContent, "urlPath:", this.urlService.urlPath());
      await this.collectPagesBelowPath(pageContent);
      await this.collectNestedAlbumIndexes();
      await this.unreferencedPagesStartingWith(pageContent);
      const usageMapForPageContent = this.duplicateContentDetectionService.contentTextUsageMapForPageContent(pageContent);
      await this.duplicateContentDetectionService.initialiseForAll();
      this.duplicateUsageMessages = this.duplicateContentDetectionService.usageMessages().filter(item => usageMapForPageContent.has(item.id));
      this.logger.info("initialisePageContent.duplicateUsageMessages:", this.duplicateUsageMessages, "usageMapForPageContent:", usageMapForPageContent);
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
}
