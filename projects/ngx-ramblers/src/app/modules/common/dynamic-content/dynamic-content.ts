import { Component, Input, OnDestroy, OnInit } from "@angular/core";
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
import { NamedEventType } from "../../../models/broadcast.model";
import { BroadcastService } from "../../../services/broadcast-service";

@Component({
  selector: "app-dynamic-content",
  templateUrl: "./dynamic-content.html",
  styleUrls: ["./dynamic-content.sass"],
})
export class DynamicContentComponent implements OnInit, OnDestroy {
  @Input()
  contentPathReadOnly: boolean;
  @Input()
  public anchor: string;
  @Input()
  public notifier: AlertInstance;
  @Input()
  public defaultPageContent: PageContent;
  private logger: Logger;
  public relativePath: string;
  public contentPath: string;
  public pageContent: PageContent;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public pageTitle: string;
  public contentDescription: string;
  public queryCompleted = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private notifierService: NotifierService,
    private urlService: UrlService,
    public stringUtils: StringUtilsService,
    private pageContentService: PageContentService,
    private pageService: PageService,
    private broadcastService: BroadcastService<PageContent>,
    private authService: AuthService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("DynamicContentComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.notify = this.notifier || this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.relativePath = paramMap.get("relativePath");
      this.contentPath = this.pageService.contentPath(this.anchor);
      this.contentDescription = this.pageService.contentDescription(this.anchor);
      this.logger.debug("initialised with relativePath:", this.relativePath, "contentPath:", this.contentPath);
      this.pageTitle = this.pageService.pageSubtitle();
      this.logger.debug("Finding page content for " + this.contentPath);
      this.refreshPageContent();
      this.authService.authResponse().subscribe(() => this.refreshPageContent());
      this.broadcastService.on(NamedEventType.PAGE_CONTENT_CHANGED, (pageContentData) => {
        this.logger.info("received:", pageContentData);
        this.pageContent = pageContentData.data;
      });
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private refreshPageContent() {
    this.logger.info("refreshPageContent for", this.contentPath);
    this.pageContentService.findByPath(this.contentPath)
      .then(pageContent => {
        if (pageContent) {
          this.logger.info("findByPath", this.contentPath, "returned:", pageContent);
          this.pageContentReceived(pageContent);
        } else {
          this.pageContentService.findByPath(`${this.urlService.firstPathSegment()}${this.anchor ? `#${this.anchor}` : ""}`)
            .then(pageContent => {
              if (pageContent) {
                this.pageContentReceived(pageContent);
              } else {
                this.notify.warning({
                  title: `Page not found`,
                  message: `The ${this.contentPath} page content was not found`
                });
              }
            });
        }
      }).catch(error => {
      this.logger.info("Page content error found for", this.contentPath, error);
      this.queryCompleted = true;
    });
  }

  private pageContentReceived(pageContent: PageContent) {
    this.pageContent = pageContent;
    this.queryCompleted = true;
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
