import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { PageContent } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageContentService } from "../../../services/page-content.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { DynamicContentSiteEditComponent } from "./dynamic-content-site-edit";
import { DynamicContentViewComponent } from "./dynamic-content-view";

@Component({
    selector: "app-dynamic-content",
    template: `
    <app-dynamic-content-site-edit [pageContent]="pageContent"
                                   [contentPathReadOnly]="contentPathReadOnly"
                                   [notify]="notify"
                                   [queryCompleted]="queryCompleted"
                                   [contentPath]="contentPath"
                                   [contentDescription]="contentDescription"
                                   [defaultPageContent]="defaultPageContent"/>
    <app-dynamic-content-view [pageContent]="pageContent"
                              [notify]="notify"
                              [contentPath]="contentPath"
                              [contentDescription]="contentDescription"/>`,
    styleUrls: ["./dynamic-content.sass"],
    imports: [DynamicContentSiteEditComponent, DynamicContentViewComponent]
})
export class DynamicContentComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentComponent", NgxLoggerLevel.ERROR);
  private route = inject(ActivatedRoute);
  private notifierService = inject(NotifierService);
  private urlService = inject(UrlService);
  stringUtils = inject(StringUtilsService);
  private pageContentService = inject(PageContentService);
  private pageService = inject(PageService);
  private authService = inject(AuthService);


  @Input("areaAsContentPath") set areaAsContentPathValue(areaAsContentPath: boolean) {
    this.areaAsContentPath = coerceBooleanProperty(areaAsContentPath);
  }

  @Input("contentPathReadOnly") set contentPathReadOnlyValue(contentPathReadOnly: boolean) {
    this.contentPathReadOnly = coerceBooleanProperty(contentPathReadOnly);
  }

  @Input("preventRedirect") set preventRedirectValue(preventRedirect: boolean) {
    this.preventRedirect = coerceBooleanProperty(preventRedirect);
  }

  @Input("defaultPageContent") set acceptChangesFrom(defaultPageContent: PageContent) {
    this.logger.info("acceptChangesFrom:defaultPageContent:", defaultPageContent);
    this.defaultPageContent = defaultPageContent;
  }
  public contentPath: string;
  @Input()
  public anchor: string;
  @Input()
  public notifier: AlertInstance;
  private areaAsContentPath: boolean;
  contentPathReadOnly: boolean;
  private preventRedirect: boolean;
  public defaultPageContent: PageContent;
  public pageContent: PageContent;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public pageTitle: string;
  public contentDescription: string;
  public queryCompleted = false;
  private subscriptions: Subscription[] = [];

  async ngOnInit() {
    this.notify = this.notifier || this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      if (this.areaAsContentPath) {
        this.contentPath = this.urlService.area() + this.pageService.anchorWithSuffix(this.anchor);
      } else {
        this.contentPath = this.pageService.contentPath(this.anchor);
      }
      if (!this.preventRedirect) {
        this.urlService.redirectToNormalisedUrl(this.contentPath);
      }
      this.contentDescription = this.pageService.contentDescription(this.anchor);
      this.logger.info("areaAsContentPath:", this.areaAsContentPath, "initialised with contentPath:", this.contentPath);
      this.pageTitle = this.pageService.pageSubtitle();
      this.logger.info("Finding page content for " + this.contentPath);
      this.refreshPageContent();
      this.authService.authResponse().subscribe(() => this.refreshPageContent());
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private refreshPageContent() {
    const anchorPath = `${this.urlService.firstPathSegment()}${this.anchor ? `#${this.anchor}` : ""}`;
    const queryPath = this.contentPath || anchorPath;
    this.logger.info("refreshPageContent for", this.contentPath, "anchorPath:", anchorPath, "queryPath:", queryPath);
    this.pageContentService.findByPath(queryPath)
      .then(pageContent => {
        if (pageContent) {
          this.logger.info("findByPath", queryPath, "returned:", pageContent);
          this.pageContentReceived(pageContent);
        } else {
          this.notify.warning({
            title: `Page not found`,
            message: `The ${queryPath} page content was not found`
          });
          this.logger.info("Page content not found for", queryPath, "redirecting to", this.contentPath)
        }
      }).catch(error => {
      this.logger.info("Page content error found for", queryPath, error);
    }).finally(() => this.queryCompleted = true);
  }

  private pageContentReceived(pageContent: PageContent) {
    this.pageContent = pageContent;
    if (pageContent) {
      this.logger.info("Page content found for", this.contentPath, "as:", pageContent);
      this.notify.hide();
    } else {
      this.logger.info("Page content not found for", this.contentPath, "pageContent:", this.pageContent);
      this.notify.warning({
        title: `Page not found`,
        message: `The ${this.contentPath} page content was not found`
      });
    }
  }

}
