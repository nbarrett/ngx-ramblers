import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { PageContent } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageContentService } from "../../../services/page-content.service";
import { PageService } from "../../../services/page.service";
import { UrlService } from "../../../services/url.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { DynamicContentSiteEditComponent } from "./dynamic-content-site-edit";
import { DynamicContentViewComponent } from "./dynamic-content-view";
import { filter } from "rxjs/operators";
import { MemberLoginService } from "../../../services/member/member-login.service";

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
  private notifierService = inject(NotifierService);
  private urlService = inject(UrlService);
  private router = inject(Router);
  private pageContentService = inject(PageContentService);
  private pageService = inject(PageService);
  private authService = inject(AuthService);
  private memberLoginService = inject(MemberLoginService);


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
    this.subscriptions.push(
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => this.updateContentFromRoute())
    );
    this.subscriptions.push(this.authService.authResponse().subscribe(() => this.refreshPageContent()));
    this.updateContentFromRoute();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private updateContentFromRoute() {
    const anchorSuffix = this.pageService.anchorWithSuffix(this.anchor);
    if (this.areaAsContentPath) {
      this.contentPath = this.urlService.area() + anchorSuffix;
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
    this.pageContent = null;
    this.queryCompleted = false;
    this.refreshPageContent();
  }

  private refreshPageContent() {
    const anchorPath = `${this.urlService.firstPathSegment()}${this.anchor ? `#${this.anchor}` : ""}`;
    const queryPath = this.contentPath || anchorPath;
    this.logger.info("refreshPageContent for", this.contentPath, "anchorPath:", anchorPath, "queryPath:", queryPath);
    if (!this.memberLoginService.allowContentEdits() && this.isFragmentPath(queryPath)) {
      this.logger.warn("Blocking public access to fragment path:", queryPath);
      this.notifyRestrictedAccess();
      this.queryCompleted = true;
      this.pageContent = null;
      return;
    }
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
          this.logger.info("Page content not found for", queryPath, "redirecting to", this.contentPath);
        }
      }).catch(error => {
      this.logger.info("Page content error found for", queryPath, error);
    }).finally(() => this.queryCompleted = true);
  }

  private pageContentReceived(pageContent: PageContent) {
    if (this.templateAccessRestricted(pageContent)) {
      this.logger.warn("Blocking public access to template page:", pageContent?.path);
      this.notifyRestrictedAccess();
      this.pageContent = null;
      return;
    }
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

  private notifyRestrictedAccess() {
    this.notify.error({
      title: "Restricted content",
      message: "Shared fragments and migration templates are not accessible to the public."
    });
  }

  private templateAccessRestricted(pageContent: PageContent): boolean {
    if (this.memberLoginService.allowContentEdits()) {
      return false;
    }
    if (!pageContent) {
      return false;
    }
    return this.isFragmentPath(pageContent.path) || this.isTemplateContent(pageContent);
  }

  private isFragmentPath(path: string): boolean {
    const normalised = this.urlService.reformatLocalHref(path)?.replace(/^\/+/, "") || "";
    return normalised.startsWith("fragments/");
  }

  private isTemplateContent(pageContent: PageContent): boolean {
    return !!pageContent?.migrationTemplate?.templateType || !!pageContent?.migrationTemplate?.isTemplate;
  }

}
