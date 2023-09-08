import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { faAdd, faPencil, faRemove, faSave, faUndo } from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash-es/cloneDeep";
import first from "lodash-es/first";
import isEmpty from "lodash-es/isEmpty";
import { BsDropdownConfig } from "ngx-bootstrap/dropdown";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AuthService } from "../../../auth/auth.service";
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
import { enumKeyValues, KeyValue } from "../../../services/enums";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentRowService } from "../../../services/page-content-row.service";
import { PageContentService } from "../../../services/page-content.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";

@Component({
  selector: "app-dynamic-content-site-edit",
  templateUrl: "./dynamic-content-site-edit.html",
  styleUrls: ["./dynamic-content.sass"],
})
export class DynamicContentSiteEditComponent implements OnInit, OnDestroy {
  @Input()
  public pageContent: PageContent;
  @Input()
  public queryCompleted: boolean;
  @Input()
  public notify: AlertInstance;
  @Input()
  public contentDescription: string;
  @Input()
  public contentPath: string;
  private insertableContent: ColumnInsertData[] = [];
  private defaultPageContent: PageContent;

  @Input("defaultPageContent") set acceptChangesFrom(defaultPageContent: PageContent) {
    this.logger.info("defaultPageContent:", defaultPageContent);
    this.defaultPageContent = defaultPageContent;
    this.deriveInsertableData();
  }

  private destinationPageContent: PageContent;
  private logger: Logger;
  public relativePath: string;
  public pageTitle: string;
  faPencil = faPencil;
  faRemove = faRemove;
  faAdd = faAdd;
  faSave = faSave;
  faUndo = faUndo;
  public area: string;
  providers: [{ provide: BsDropdownConfig, useValue: { isAnimated: true, autoClose: true } }];
  enumKeyValuesForPageContentType: KeyValue<string>[] = enumKeyValues(PageContentType);
  public unsavedMarkdownComponents: MarkdownEditorComponent[] = [];
  public destinationPath: string;
  public destinationPathLookup: Subject<string> = new Subject<string>();
  destinationPathInsertionRowIndex = 0;
  destinationPathInsertBeforeAfterIndex = 0;
  insertionRowLookup: InsertionRow[] = [];
  contentActions: string[] = [Action.MOVE, Action.COPY];
  action: string = this.contentActions[0];
  insertionRowPosition: InsertionRow[] = [{index: 0, description: InsertionPosition.BEFORE}, {index: 1, description: InsertionPosition.AFTER}];
  public referringPages: PageContent[] = [];
  private error: any = null;
  private pageHrefs: string[];
  private copyOrMoveActionComplete: boolean;
  private subscriptions: Subscription[] = [];

  constructor(
    private systemConfigService: SystemConfigService,
    public pageContentRowService: PageContentRowService,
    public siteEditService: SiteEditService,
    public memberResourcesReferenceData: MemberResourcesReferenceDataService,
    private route: ActivatedRoute,
    private notifierService: NotifierService,
    private urlService: UrlService,
    private numberUtils: NumberUtilsService,
    public stringUtils: StringUtilsService,
    public pageContentService: PageContentService,
    private contentTextService: ContentTextService,
    private pageService: PageService,
    private authService: AuthService,
    public actions: PageContentActionsService,
    private broadcastService: BroadcastService<any>,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(DynamicContentSiteEditComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
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
      this.logger.info("deriveInsertableData:insertableContent:from:defaultData", this.defaultPageContent, "returned:", this.insertableContent);
      const message = `Insert ${this.stringUtils.pluraliseWithCount(this.insertableContent.length, "new item")}: ${this.insertableContent?.map(item => item.data.title)?.join(", ")}`;
      if (this.insertableContent.length > 0) {
        this.notify.warning({title: "Additional content available for page:", message});
      } else {
        this.notify.hide();
      }
    }
  }

  insertData() {
    const pageContentColumns: PageContentColumn[] = this.actions.firstRowColumns(this.pageContent);
    this.insertableContent.forEach(item => {
      pageContentColumns.splice(item.index, 0, item.data);
    });
    this.logger.info("pageContentColumns after insert:", pageContentColumns);
    this.deriveInsertableData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private runInitCode() {
    this.logger.info("ngOnInit:subscribing to systemConfigService events");
    this.systemConfigService.events().subscribe(item => {
      const pageHrefs: string[] = item.group.pages.map(link => link.href).filter(item => item);
      this.logger.info("pageHrefs received as:", pageHrefs);
      if (pageHrefs.length > 0) {
        this.pageHrefs = pageHrefs;
      }
    });
    this.pageContentService.allReferringPages(this.contentPath)
      .then(referringPages => {
        const referringPagesFilteredForExactPath = referringPages.filter(pageContent => this.actions.allPageHrefs(pageContent).includes(this.pageContent.path));
        this.logger.info("referringPages for:", this.contentPath, "referringPages:", referringPages, "referringPagesFilteredForExactPath:", referringPagesFilteredForExactPath);
        this.referringPages = referringPagesFilteredForExactPath;
      }).catch(response => {
      this.notify.error({title: "Failed to query referring pages:", message: response.error});
      this.queryCompleted = true;
      this.error = response.error;
    });
    this.broadcastService.on(NamedEventType.SAVE_PAGE_CONTENT, (namedEvent: NamedEvent<PageContent>) => {
      this.logger.info("event received:", namedEvent);
      if (namedEvent.data.id === this.pageContent.id) {
        this.savePageContent();
      }
    });
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_DELETED, (namedEvent: NamedEvent<PageContent>) => {
      this.logger.info("event received:", namedEvent);
      this.pageContent.rows.forEach(row => row.columns.forEach(column => {
        if (column.contentTextId === namedEvent?.data?.id) {
          this.logger.info("removing link to content " + namedEvent.data.id);
          delete column.contentTextId;
        }
      }));
      this.savePageContent();
    });
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_UNSAVED, (namedEvent: NamedEvent<MarkdownEditorComponent>) => {
      this.logger.info("event received:", namedEvent);
      if (!this.unsavedMarkdownComponents.includes(namedEvent.data)) {
        this.unsavedMarkdownComponents.push(namedEvent.data);
        this.logger.info("unsavedMarkdownComponents:", this.unsavedMarkdownComponents.map(item => item.content));
      }
    });
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_SYNCED, (namedEvent: NamedEvent<MarkdownEditorComponent>) => {
      this.logger.info("event received:", namedEvent);
      if (this.unsavedMarkdownComponents.includes(namedEvent.data)) {
        this.unsavedMarkdownComponents = this.unsavedMarkdownComponents.filter(item => item !== namedEvent.data);
        this.logger.info("unsavedMarkdownComponents:", this.unsavedMarkdownComponents.map(component => component.content));
      }
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

  createContent() {
    this.pageContent = {
      path: this.contentPath,
      rows: [this.actions.defaultRowFor(PageContentType.TEXT)]
    };
    this.logger.info("this.pageContent:", this.pageContent);
    this.queryCompleted = true;
  }

  goToOtherPage() {
    this.urlService.navigateUnconditionallyTo(this.destinationPath);
  }

  public changeType($event: any) {
    this.logger.info("changeType:", $event);
  }

  public savePageContent(): Promise<boolean> {
    this.logger.info("saving", this.unsavedMarkdownComponents.length, "markdown components before saving page content");
    return Promise.all(this.unsavedMarkdownComponents.map(component => component.save())).then(() => {
      return this.pageContentService.createOrUpdate(this.pageContent)
        .then(pageContent => {
          this.pageContent = pageContent;
          this.logger.info("this.pageContent.path:", this.pageContent.path, "urlPath:", this.urlService.urlPath());
          if (this.pageContent.path !== this.urlService.urlPath()) {
            const navigateToPath = this.urlService.pathMinusAnchorForUrl(this.pageContent.path);
            this.logger.info("need to move to:", navigateToPath);
            return this.urlService.navigateUnconditionallyTo(navigateToPath);
          } else {
            return true;
          }
        });
    });
  }

  public revertPageContent() {
    this.pageContentService.findByPath(this.pageContent.path)
      .then(pageContent => {
        this.pageContent = pageContent;
        this.deriveInsertableData();
      });
  }

  public deletePageContent() {
    if (!this.deletePagContentDisabled()) {
      this.pageContentService.delete(this.pageContent)
        .then(() => this.urlService.navigateUnconditionallyTo(this.urlService.area()));
    }
  }

  public deletePagContentTooltip() {
    return this.allReferringPageCount() === 0 ? "Delete this page" : "Can't delete as " + this.stringUtils.pluraliseWithCount(this.allReferringPageCount(), "other page") + " " + this.stringUtils.pluraliseWithCount(this.allReferringPageCount(), "refers", "refer") + " to this page";
  }

  public allReferringPageCount(): number {
    return this.allReferringPages().length;
  }

  public isMainPageContent() {
    return this.mainPagesReferred().length > 0;
  }

  private mainPagesReferred(): string[] {
    const mainPagesReferredTo = this.pageHrefs?.filter(href => href === first(this.pageContent.path.split("#")));
    this.logger.debug("mainPagesReferredTo:", mainPagesReferredTo);
    return mainPagesReferredTo;
  }

  public allReferringPages(): string[] {
    return this.referringPages.map(pageContent => first(pageContent.path.split("?"))).concat(this.mainPagesReferred());
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
    return referringPage?.split("#").join(" ");
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
}
