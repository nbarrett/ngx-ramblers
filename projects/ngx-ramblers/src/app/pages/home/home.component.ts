import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { ExternalSystems } from "../../models/system.model";
import { liteHomePageContent, liteHomePageContentFromTemplate, HOME_CONTENT_PATH, LITE_HOME_TEMPLATE_PATH } from "../../models/home-content.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { PageService } from "../../services/page.service";
import { PageContentService } from "../../services/page-content.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { SiteEditService } from "../../site-edit/site-edit.service";
import { NgxLiteService } from "../../services/ngx-lite.service";
import { UrlService } from "../../services/url.service";
import { DynamicContentComponent } from "../../modules/common/dynamic-content/dynamic-content";
import { FacebookComponent } from "../facebook/facebook.component";
import { InstagramComponent } from "../instagram/instagram.component";
import { BuiltInAnchor } from "../../models/content-text.model";

@Component({
    selector: "app-home",
  template: `
    @if (siteEditService.active() && ngxLiteService.ngxLite) {
      <div class="row mb-3">
        <div class="col-12">
          <button type="button" class="btn btn-quiet" [disabled]="regenerating" (click)="regenerateFromLiteTemplate()">
            <fa-icon [icon]="faRotate"/>
            Regenerate from lite template
          </button>
        </div>
      </div>
    }
    <app-dynamic-content [anchor]="BuiltInAnchor.HOME_CONTENT" contentPathReadOnly/>
    <div class="row g-3">
      @if (externalSystems?.facebook?.showFeed) {
        <div class="col-lg-6">
          <app-facebook/>
        </div>
      }
      @if (externalSystems?.instagram?.showFeed) {
        <div class="col-lg-6">
          <app-instagram/>
        </div>
      }
    </div>
  `,
    styleUrls: ["./home.component.sass"],
  imports: [DynamicContentComponent, FacebookComponent, InstagramComponent, FontAwesomeModule]
})
export class HomeComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("HomeComponent", NgxLoggerLevel.ERROR);
  pageService = inject(PageService);
  private systemConfigService = inject(SystemConfigService);
  private pageContentService = inject(PageContentService);
  private urlService = inject(UrlService);
  siteEditService = inject(SiteEditService);
  ngxLiteService = inject(NgxLiteService);
  public feeds: { facebook: {} };
  faRotate = faRotate;
  public regenerating = false;
  private groupName: string;
  private subscriptions: Subscription[] = [];
  public externalSystems: ExternalSystems;
  protected readonly BuiltInAnchor = BuiltInAnchor;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => {
      this.externalSystems = item.externalSystems;
      this.groupName = item?.group?.longName;
    }));
  }

  async regenerateFromLiteTemplate() {
    this.regenerating = true;
    try {
      const existing = await this.pageContentService.findByPath(HOME_CONTENT_PATH);
      const template = await this.pageContentService.findByPath(LITE_HOME_TEMPLATE_PATH);
      const regenerated = template?.rows?.length
        ? liteHomePageContentFromTemplate(template, this.groupName)
        : liteHomePageContent(this.groupName);
      await this.pageContentService.createOrUpdate({ ...existing, ...regenerated });
      this.logger.info("regenerated lite home content for", this.groupName);
      this.urlService.refresh();
    } catch (error) {
      this.logger.error("failed to regenerate lite home content", error);
      this.regenerating = false;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
