import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageComponent } from "../../../page/page.component";
import { SocialCarouselComponent } from "../social-carousel/social-carousel";
import { EventsMigrationService } from "../../../services/migration/events-migration.service";
import { Subscription } from "rxjs";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { SystemConfig } from "../../../models/system.model";
import { SocialDisplayService } from "../social-display.service";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";
import { BuiltInAnchor } from "../../../models/content-text.model";

@Component({
    selector: "app-social-home",
    template: `
      <app-page>
        <app-social-carousel/>
        @if (displayService.allow.admin && systemConfig?.enableMigration?.events) {
          <div class="mb-3 col-sm-12">
            <button (click)="performMigration()" class="btn btn-primary mr-2"
                    type="button">Migrate URLs
            </button>
          </div>
        }
        <app-dynamic-content contentPathReadOnly [anchor]="BuiltInAnchor.SOCIAL_CONTENT"/>
      </app-page>
    `,
    styleUrls: ["./social-home.component.sass"],
  imports: [PageComponent, SocialCarouselComponent, DynamicContentComponent]
})
export class SocialHomeComponent implements OnInit, OnDestroy {
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  protected displayService: SocialDisplayService = inject(SocialDisplayService);
  protected eventsMigrationService = inject(EventsMigrationService);
  private systemConfigService = inject(SystemConfigService);
  public logger = this.loggerFactory.createLogger("SocialHomeComponent", NgxLoggerLevel.ERROR);
  private subscriptions: Subscription[] = [];
  protected systemConfig: SystemConfig;
  protected readonly BuiltInAnchor = BuiltInAnchor;

  ngOnInit() {
    this.logger.info("ngOnInit");
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.systemConfig = systemConfig;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
  public async performMigration() {
    await this.eventsMigrationService.migrateSocialEventUrls();
  }
}
