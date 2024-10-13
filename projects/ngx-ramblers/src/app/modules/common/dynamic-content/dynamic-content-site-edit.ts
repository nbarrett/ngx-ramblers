import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { faAdd, faEye, faPencil, faRemove, faSave, faUndo } from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash-es/cloneDeep";
import first from "lodash-es/first";
import isEmpty from "lodash-es/isEmpty";
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
import last from "lodash-es/last";
import { AlbumIndexService } from "../../../services/album-index.service";
import uniq from "lodash-es/uniq";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";

@Component({
  selector: "app-dynamic-content-site-edit",
  template: `
    <ng-container *ngIf="siteEditService.active()">
      <ng-container *ngIf="notify.alertTarget.showAlert || !actions.pageContentFound(pageContent, queryCompleted)">
        <div *ngIf="notify.alertTarget.showAlert" class="col-12 alert {{notify.alertTarget.alertClass}} mt-3">
          <fa-icon [icon]="notify.alertTarget.alert.icon"></fa-icon>
          <strong class="ml-2">{{ notify.alertTarget.alertTitle }}</strong>
          <span class="p-2">{{ notify.alertTarget.alertMessage }}.
        <a *ngIf="canCreateContent()" (click)="createContent()"
           class="rams-text-decoration-pink"
           type="button">Create content</a>
        <a *ngIf="canGoToThatPage()" (click)="goToOtherPage()"
           class="rams-text-decoration-pink"
           type="button">Go to that page</a>
      </span>
        </div>
      </ng-container>
      <ng-container *ngIf="pageContent">
        <div class="card mb-2">
          <div class="card-body">
            <h4 class="card-title">Page content for {{ pageContent.path }} (<small
              class="text-muted">{{ stringUtils.pluraliseWithCount(pageContent?.rows.length, 'row') }}</small>)</h4>
            <ng-template #saveButtonsAndPath>
              <div class="form-inline">
                <app-badge-button [disabled]="actions.rowsInEdit.length>0" (click)="savePageContent()"
                                  delay=500
                                  [tooltip]="actions.rowsInEdit.length>0?'Finish current row edit before saving':'Save page changes'"
                                  [icon]="faSave"
                                  caption="Save page changes">
                </app-badge-button>
                <app-badge-button (click)="revertPageContent()"
                                  delay=500 [tooltip]="'Revert page changes'"
                                  [icon]="faUndo"
                                  caption="Revert page changes">
                </app-badge-button>
                <app-badge-button *ngIf="insertableContent?.length > 0" (click)="insertData()"
                                  delay=500 [tooltip]="'Insert missing data'"
                                  [icon]="faAdd" caption="Insert data">
                </app-badge-button>
                <app-badge-button *ngIf="pageContent.rows?.length === 0" (click)="createContent()"
                                  delay=500 [tooltip]="'Add first row'"
                                  [icon]="faAdd" caption="Add first row">
                </app-badge-button>
                <app-badge-button *ngIf="unreferencedPaths?.length>0" (click)="toggleShowUnreferencedPages()"
                                  [icon]="faEye"
                                  [active]="showUnreferenced"
                                  delay=500
                                  caption="{{showUnreferenced? 'Hide':'Show'}} {{stringUtils.pluraliseWithCount(unreferencedPaths?.length, 'unreferenced page')}}">
                </app-badge-button>
                <app-badge-button (click)="deletePageContent()"
                                  [icon]="faRemove"
                                  delay=500 caption="Delete page"
                                  [tooltip]="deletePagContentTooltip()"
                                  [disabled]="allReferringPages().length !== 0">
                </app-badge-button>
                <ng-container *ngIf="this.allReferringPageCount() > 0">
                  <div class="align-middle">Referred to by: <a class="ml-2 rams-text-decoration-pink"
                                                               *ngFor="let referringPage of allReferringPages(); let linkIndex = index;"
                                                               [href]="referringPage">{{ formatHref(referringPage) }}{{ linkIndex < allReferringPageCount() - 1 ? ',' : '' }}</a>
                  </div>
                </ng-container>
                <ng-container *ngIf="this.allReferringPageCount() === 0">
                  <div class="align-middle mb-2">Not Referred to by any other pages or links</div>
                </ng-container>
              </div>
            </ng-template>
            <ng-container *ngTemplateOutlet="saveButtonsAndPath"></ng-container>
            <div class="row mt-2 align-items-end mb-3" *ngIf="unreferencedPaths?.length>0 && showUnreferenced">
              <div class="align-middle">
                <div class="col-sm-12">
                  <div class="mb-2">Other unreferenced pages related to this area:</div>
                  <ul *ngFor="let path of unreferencedPaths;" class="breadcrumb bg-transparent mb-1 ml-0 p-1">
                    <span class="d-md-none">...</span>
                    <li class="breadcrumb-item d-none d-md-inline"
                        *ngFor="let page of pageService.linksFromPathSegments(urlService.pathSegmentsForUrl(path))">
                      <a [routerLink]="'/' + page?.href" target="_self">{{ page?.title }}</a>
                    </li>
                    <li class="breadcrumb-item d-none d-md-inline">
                      <a class="rams-text-decoration-pink"
                         [href]="path">{{ formatHref(last(urlService.pathSegmentsForUrl(path))) }}</a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="row mt-2 align-items-end mb-3">
              <div [ngClass]="pageContentRowService.rowsSelected()? 'col-md-10' : 'col'">
                <form>
                  <label class="mr-2" for="path">Content Path
                    <span>{{ contentPathReadOnly ? "(not editable as this content is part of internal page)" : "" }}</span></label>
                  <input [disabled]="contentPathReadOnly" autocomplete="off" [typeahead]="pageContentService.siteLinks"
                         [typeaheadMinLength]="0" id="path"
                         [(ngModel)]="pageContent.path"
                         name="path"
                         [ngModelOptions]="{standalone: true}"
                         type="text" class="form-control">
                </form>
              </div>
              <ng-container *ngIf="pageContentRowService.rowsSelected()">
                <div class="col-sm-4 col-md-2">
                  <label for="action">Action</label>
                  <select class="form-control input-sm"
                          [(ngModel)]="action"
                          id="action">
                    <option *ngFor="let action of contentActions"
                            [ngValue]="action">{{ action }}
                    </option>
                  </select>
                </div>
                <div class="col-md-10 mt-3">
                  <form>
                    <label class="mr-2" for="move-or-copy-to-path">
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
                <div class="col-sm-4 col-md-2 mt-3">
                  <label for="before-after">Position</label>
                  <select class="form-control input-sm"
                          [(ngModel)]="destinationPathInsertBeforeAfterIndex"
                          id="before-after">
                    <option *ngFor="let insertionRow of insertionRowPosition"
                            [ngValue]="insertionRow.index">{{ insertionRow.description }}
                    </option>
                  </select>
                </div>
                <div class="col-md-10 mt-3">
                  <label for="insert-at-row">Row</label>
                  <select class="form-control input-sm"
                          [(ngModel)]="destinationPathInsertionRowIndex"
                          (ngModelChange)="destinationPathInsertionRowIndexChange($event)"
                          id="insert-at-row">
                    <option *ngFor="let insertionRow of insertionRowLookup"
                            [ngValue]="insertionRow.index">{{ insertionRow.description }}
                    </option>
                  </select>
                </div>
                <div class="col mt-3">
                  <button [disabled]="actionDisabled()"
                          delay=500 tooltip="{{action}} rows to {{destinationPath}}"
                          type="submit"
                          (click)="performCopyOrMoveAction()"
                          [ngClass]="buttonClass(!actionDisabled())">
                    <fa-icon [icon]="faSave"></fa-icon>
                    <span class="ml-2">Perform {{ action }}</span>
                  </button>
                </div>
              </ng-container>
            </div>
            <div class="thumbnail-site-edit-top-bottom-margins"
                 *ngFor="let row of pageContent?.rows; let rowIndex = index;">
              <div class="thumbnail-heading">Row {{ rowIndex + 1 }}
                ({{ stringUtils.pluraliseWithCount(row?.columns.length, 'column') }})
              </div>
              <div class="row align-items-end mb-3 d-flex">
                <div class="col-auto">
                  <label [for]="actions.rowColumnIdentifierFor(rowIndex, 0, this.contentPath + '-type')">
                    Row Type</label>
                  <select class="form-control input-sm"
                          [(ngModel)]="row.type"
                          (ngModelChange)="changePageContentRowType(row)"
                          [id]="actions.rowColumnIdentifierFor(rowIndex, 0, this.contentPath + '-type')">
                    <option *ngFor="let type of enumKeyValuesForPageContentType"
                            [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                    </option>
                  </select>
                </div>
                <div (nameInputChange)="editAlbumName=$event" class="col" app-row-settings-carousel
                     *ngIf="actions.isCarouselOrAlbum(row)" [row]="row">
                </div>
                <ng-container *ngIf="!editAlbumName">
                  <div class="col-auto" app-row-settings-action-buttons
                       *ngIf="actions.isActionButtons(row) || actions.isAlbumIndex(row)" [row]="row"></div>
                  <div class="col-auto">
                    <div class="form-inline">
                      <div app-margin-select label="Margin Top"
                           [data]="row"
                           field="marginTop" class="mr-4">
                      </div>
                      <div app-margin-select label="Margin Bottom"
                           [data]="row"
                           field="marginBottom">
                      </div>
                    </div>
                  </div>
                  <div class="col-auto">
                    <div class="form-inline float-right">
                      <app-actions-dropdown [rowIndex]="rowIndex"
                                            [pageContent]="pageContent"
                                            [row]="row">
                      </app-actions-dropdown>
                      <app-bulk-action-selector [row]="row"></app-bulk-action-selector>
                    </div>
                  </div>
                </ng-container>
              </div>
              <app-album-index-site-edit *ngIf="actions.isAlbumIndex(row)" [row]="row" [rowIndex]="rowIndex"/>
              <app-action-buttons *ngIf="actions.isActionButtons(row)"
                                  [pageContent]="pageContent"
                                  [rowIndex]="rowIndex">
              </app-action-buttons>
              <app-dynamic-content-site-edit-album *ngIf="actions.isCarouselOrAlbum(row)"
                                                   [row]="row" [rowIndex]="rowIndex" [pageContent]="pageContent"/>
              <app-dynamic-content-site-edit-text-row
                [row]="row"
                [rowIndex]="rowIndex"
                [contentDescription]="contentDescription"
                [contentPath]="contentPath"
                [pageContent]="pageContent">
              </app-dynamic-content-site-edit-text-row>
              <app-events *ngIf="actions.isEvents(row)" [row]="row" [rowIndex]="rowIndex"/>
            </div>
            <ng-container *ngTemplateOutlet="saveButtonsAndPath"></ng-container>
          </div>
        </div>
      </ng-container>
    </ng-container>`,
  styleUrls: ["./dynamic-content.sass"],
})
export class DynamicContentSiteEditComponent implements OnInit, OnDestroy {

  @Input("defaultPageContent") set acceptChangesFrom(defaultPageContent: PageContent) {
    this.logger.info("acceptChangesFrom:defaultPageContent:", defaultPageContent);
    this.defaultPageContent = defaultPageContent;
    this.deriveInsertableData();
  }

  @Input("pageContent") set acceptPageContentChanges(pageContent: PageContent) {
    this.logger.info("acceptPageContentChanges:pageContent:", pageContent);
    this.initialisePageContent(pageContent);
    this.clearAlert(pageContent);
  }

  constructor(
    private systemConfigService: SystemConfigService,
    public pageContentRowService: PageContentRowService,
    public siteEditService: SiteEditService,
    private albumIndexService: AlbumIndexService,
    public memberResourcesReferenceData: MemberResourcesReferenceDataService,
    protected urlService: UrlService,
    protected pageService: PageService,
    public uiActionsService: UiActionsService,
    public stringUtils: StringUtilsService,
    public pageContentService: PageContentService,
    private contentTextService: ContentTextService,
    public actions: PageContentActionsService,
    private broadcastService: BroadcastService<any>,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("DynamicContentSiteEditComponent", NgxLoggerLevel.ERROR);
  }

  @Input()
  contentPathReadOnly: boolean;
  @Input()
  public queryCompleted: boolean;
  @Input()
  public notify: AlertInstance;
  @Input()
  public contentDescription: string;
  @Input()
  public contentPath: string;
  private albumIndexDataRows: PageContent[] = [];
  public showUnreferenced: boolean;
  public unreferencedPaths: string[];
  public pageContent: PageContent;
  public insertableContent: ColumnInsertData[] = [];
  private defaultPageContent: PageContent;
  private destinationPageContent: PageContent;
  private logger: Logger;
  public pageTitle: string;
  faPencil = faPencil;
  faRemove = faRemove;
  faAdd = faAdd;
  faSave = faSave;
  faUndo = faUndo;
  providers: [{ provide: BsDropdownConfig, useValue: { isAnimated: true, autoClose: true } }];
  enumKeyValuesForPageContentType: KeyValue<string>[] = enumKeyValues(PageContentType);
  public unsavedMarkdownComponents: Set<MarkdownEditorComponent> = new Set();
  public destinationPath: string;
  public destinationPathLookup: Subject<string> = new Subject<string>();
  destinationPathInsertionRowIndex = 0;
  destinationPathInsertBeforeAfterIndex = 0;
  insertionRowLookup: InsertionRow[] = [];
  contentActions: string[] = [Action.MOVE, Action.COPY];
  action: string = this.contentActions[0];
  insertionRowPosition: InsertionRow[] = [{index: 0, description: InsertionPosition.BEFORE}, {index: 1, description: InsertionPosition.AFTER}];
  public referringPages: PageContent[] = [];
  public pagesBelow: PageContent[] = [];
  private error: any = null;
  private pageHrefs: string[];
  private copyOrMoveActionComplete: boolean;
  private subscriptions: Subscription[] = [];
  public editAlbumName: boolean;
  protected readonly last = last;

  protected readonly faEye = faEye;

  ngOnInit() {
    this.logger.info("ngOnInit");
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
        this.logger.info("deriveInsertableData:insertableContent:from:defaultData", this.defaultPageContent, "returned missing data to insert:", this.insertableContent);
        this.notify.warning({title: "Additional content available for page:", message});
      } else {
        this.logger.info("deriveInsertableData:insertableContent:from:defaultData", this.defaultPageContent, "no data to insert");
        this.notify.hide();
      }
    } else {
      this.logger.info("deriveInsertableData:not calculating insertable data as pageContent:", this.pageContent, "defaultPageContent:", this.defaultPageContent);
    }
  }

  insertData() {
    this.insertableContent.forEach(item => {
      const pageContentColumns: PageContentColumn[] = this.actions.findPageContentColumnsOfType(this.pageContent, item.type);
      if (pageContentColumns) {
        pageContentColumns.splice(item.index, 0, item.data);
        this.logger.info("pageContentColumns after insert:", pageContentColumns);
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
    this.logger.info("ngOnInit:runInitCode:pageContent:", this.pageContent, "path:", this.urlService.urlPath());
    this.systemConfigService.events().subscribe(item => {
      const pageHrefs: string[] = item.group.pages.map(link => link.href).filter(item => item);
      this.logger.info("pageHrefs received as:", pageHrefs);
      if (pageHrefs.length > 0) {
        this.pageHrefs = pageHrefs;
      }
    });
    this.pageContentService.allReferringPages(this.contentPath)
      .then(referringPages => {
        const referringPagesFilteredForExactPath = referringPages.filter(pageContent => this.actions.allPageHrefs(pageContent).includes(this.urlService.urlPath()));
        this.logger.info("referringPages for:", this.contentPath, "referringPages:", referringPages, "referringPagesFilteredForExactPath:", referringPagesFilteredForExactPath);
        this.referringPages = referringPagesFilteredForExactPath;
      }).catch(error => {
      this.notify.error({title: "Failed to query referring pages:", message: error});
      this.queryCompleted = true;
      this.error = error;
    });
    this.broadcastService.on(NamedEventType.SAVE_PAGE_CONTENT, (namedEvent: NamedEvent<PageContent>) => {
      this.logger.debug("event received:", namedEvent);
      if (namedEvent.data.id === this.pageContent.id) {
        this.savePageContent();
      }
    });
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_DELETED, (namedEvent: NamedEvent<PageContent>) => {
      this.logger.debug("event received:", namedEvent);
      this.pageContent.rows.forEach(row => row.columns.forEach(column => {
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
            this.logger.info("find by path:", this.destinationPath, "resulted in:", response);
            this.destinationPageContent = response;
            if (response) {
              const contentTextIds = response.rows.map((row: PageContentRow) => first(row.columns)?.contentTextId || first(first(first(row.columns)?.rows)?.columns)?.contentTextId);
              this.logger.info("found contentTextIds:", contentTextIds);
              Promise.all(contentTextIds.map(contentTextId => this.contentTextService.getById(contentTextId))).then(contentTextItems => {
                const textRowInformation: string[] = contentTextItems.map(contentTextItem => this.firstTextLineFrom(contentTextItem));
                this.logger.info("found contentTextItems:", textRowInformation);
                this.insertionRowLookup = textRowInformation.map((row, index) => ({index, description: `Row ${index + 1}: ${row}`}));
              });
            } else {
              this.insertionRowLookup = [{index: 0, description: `Row 1: In new page`}];
            }
          });
      });
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
    this.logger.info("row:", row);
    if (this.actions.isCarouselOrAlbum(row)) {
      const defaultAlbum = this.actions.defaultAlbum(this.contentPathWithIndex(row));
      if (!row.carousel?.name) {
        const carousel = defaultAlbum;
        this.logger.info("initialising carousel data:", carousel);
        row.carousel = carousel;
      } else if (!row.carousel.albumView) {
        row.carousel.albumView = defaultAlbum.albumView;
        row.carousel.eventType = defaultAlbum.eventType;
      }
    } else if (this.actions.isAlbumIndex(row)) {
      if (!row?.albumIndex?.contentPaths) {
        row.albumIndex = this.actions.defaultAlbumIndex();
        this.logger.info("initialising albumIndex to:", row.albumIndex);
      }
    } else {
      this.logger.info("not initialising data for ", row.type);
    }
  }

  public contentPathWithIndex(row: PageContentRow): string {
    const index = this.actions.carouselOrAlbumIndex(row, this.pageContent);
    return `${this.pageContent?.path?.replace("#", "")}${index > 0 ? "-" + index : ""}`;
  }

  public savePageContent(): Promise<boolean> {
    if (this.actions.rowsInEdit.length === 0) {
      this.logger.info("saving", this.stringUtils.pluraliseWithCount(this.unsavedMarkdownComponents.size, "markdown component"), "before saving page content");
      return Promise.all(Array.from(this.unsavedMarkdownComponents.values()).map(component => component.save())).then(() => {
        return this.pageContentService.createOrUpdate(this.pageContent)
          .then(async pageContent => {
            await this.initialisePageContent(pageContent);
            if (this.pageContent.path !== this.urlService.urlPath()) {
              const navigateToPath = this.urlService.pathMinusAnchorForUrl(this.pageContent.path);
              this.logger.info("need to move to:", navigateToPath);
              return this.urlService.navigateUnconditionallyTo([navigateToPath]);
            } else {
              return true;
            }
          });
      });
    } else {
    }
  }

  public revertPageContent() {
    this.actions.rowsInEdit = [];
    this.pageContentService.findByPath(this.pageContent.path)
      .then(async pageContent => {
        await this.initialisePageContent(pageContent);
        this.actions.notifyPageContentChanges(pageContent);
        this.deriveInsertableData();
      });
  }

  public deletePageContent() {
    if (!this.deletePagContentDisabled()) {
      this.pageContentService.delete(this.pageContent)
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
    this.logger.info("calculateOtherPagesStartingWith:path:", pageContent.path, "albumIndexHrefs:", albumIndexHrefs, "currentPageHrefs:", currentPageHrefs, "allReferencedHrefs:", allReferencedHrefs, "pagesBelowPath:", this.pagesBelow, "pagePathsBelow:", pagePathsBelow, "unreferencedPaths:", unreferencedPaths);
  }

  private async collectNestedAlbumIndexes() {
    const albumIndexRows: PageContentRow[] = this.pagesBelow.map(item => item.rows.filter(row => this.actions.isAlbumIndex(row))).flat(3);
    const albums = await Promise.all(albumIndexRows.map(albumIndexRow => this.albumIndexService.albumIndexToPageContent(albumIndexRow, albumIndexRows.indexOf(albumIndexRow))));
    this.logger.info("collectNestedAlbumIndexes:albums:", albums);
    albums.forEach(album => this.collectAlbumIndexData(album));
  }

  public deletePagContentDisabled(): boolean {
    return this.allReferringPages().length > 0;
  }

  performCopyOrMoveAction() {
    const createNewPage: boolean = !this.destinationPageContent;
    if (createNewPage) {
      const newPageContent: PageContent = {
        path: this.destinationPath,
        rows: this.pageContentRowService.selectedRows()
      };
      this.logger.info("newPageContent:", newPageContent);
      this.performAction(newPageContent, createNewPage);
    } else {
      this.logger.info("destinationPageContent.rows before:", cloneDeep(this.destinationPageContent.rows));
      this.destinationPageContent.rows.splice(this.destinationPathInsertionRowIndex + this.destinationPathInsertBeforeAfterIndex, 0, ...this.pageContentRowService.selectedRows());
      this.logger.info("destinationPageContent.rows after:", cloneDeep(this.destinationPageContent.rows));
      this.performAction(this.destinationPageContent, createNewPage);
    }
  }

  private performAction(newPageContent: PageContent, createNewPage: boolean) {
    this.copyOrMoveActionComplete = false;
    this.pageContentService.createOrUpdate(newPageContent)
      .then(() => {
        if (this.action === Action.MOVE) {
          this.pageContent.rows = this.pageContent.rows.filter(row => !newPageContent.rows.includes(row));
          this.savePageContent().then(() => this.notifyActionCompleted(createNewPage));
        } else {
          this.notifyActionCompleted(createNewPage);
        }
      });
  }

  private notifyActionCompleted(createNewPage: boolean) {
    this.copyOrMoveActionComplete = true;
    this.notify.success({
      title: `${this.action} Rows`,
      message: `${this.stringUtils.pluraliseWithCount(this.pageContentRowService.selectedRowCount(), "row")} were ${this.action === Action.MOVE ? "moved" : "copied"} to ${createNewPage ? "new" : "existing"} page ${this.destinationPath} successfully`
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

  destinationPathInsertionRowIndexChange($event: any) {
    this.logger.info("destinationPathInsertionRowIndexChange:", $event);
  }

  actionDisabled() {
    return !this.pageContentRowService.rowsSelected() || isEmpty(this.destinationPath) || (this.destinationPath === this.pageContent.path);
  }

  destinationPathLookupChange(value: string) {
    this.logger.info("destinationPathLookupChange:", value);
    this.destinationPathLookup.next(value);
    this.destinationPath = value;
  }

  private clearAlert(pageContent: PageContent) {
    if (pageContent && this.notify) {
      this.notify.hide();
    }
  }

  private async initialisePageContent(pageContent: PageContent): Promise<void> {
    if (pageContent) {
      pageContent.rows.forEach(row => this.initialiseRowIfRequired(row));
      this.pageContent = pageContent;
      this.logger.info("initialisePageContent.pageContent:", this.pageContent, "urlPath:", this.urlService.urlPath());
      await this.collectPagesBelowPath(pageContent);
      await this.collectNestedAlbumIndexes();
      await this.unreferencedPagesStartingWith(pageContent);
    }
  }

  private async collectPagesBelowPath(pageContent: PageContent) {
    const path = pageContent.path;
    const dataQueryOptions = {criteria: {path: fieldStartsWithValue(path)}};
    this.pagesBelow = await this.pageContentService.all(dataQueryOptions);
    this.logger.info("initialisePageContent:path:", path, "dataQueryOptions:", dataQueryOptions, "pagesBelowPath:", this.pagesBelow);
  }

  collectAlbumIndexData(albumIndexDataRow: PageContent) {
    if (albumIndexDataRow) {
      this.albumIndexDataRows = this.albumIndexDataRows.filter(item => item.path !== albumIndexDataRow.path).concat(albumIndexDataRow);
      this.logger.info("collectAlbumIndexData:albumIndexDataRow:", albumIndexDataRow, "albumIndexDataRows:", this.albumIndexDataRows);
    }
  }

  toggleShowUnreferencedPages() {
    this.showUnreferenced = !this.showUnreferenced;
    this.uiActionsService.saveValueFor(StoredValue.SHOW_UNREFERENCED_PAGES, this.showUnreferenced);
  }
}
