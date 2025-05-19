import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageComponent } from "../../../page/page.component";
import { SocialCarouselComponent } from "../social-carousel/social-carousel";
import { SocialEventsComponent } from "../list/social-events";
import { EventsMigrationService } from "../../../services/migration/events-migration.service";
import { Subscription } from "rxjs";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { SystemConfig } from "../../../models/system.model";

@Component({
    selector: "app-social-home",
    template: `
    <app-page>
      <app-social-carousel/>
      @if (systemConfig?.enableMigration?.events) {
        <div class="mb-3 col-sm-12">
        <button (click)="performMigration()" class="btn btn-primary mr-2"
                type="button">Migrate
        </button>
        </div>
      }
      <app-social-events/>
    </app-page>
  `,
    styleUrls: ["./social-home.component.sass"],
    imports: [PageComponent, SocialCarouselComponent, SocialEventsComponent]
})
export class SocialHomeComponent implements OnInit, OnDestroy {
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  protected eventsMigrationService = inject(EventsMigrationService);
  private systemConfigService = inject(SystemConfigService);
  public logger = this.loggerFactory.createLogger("SocialHomeComponent", NgxLoggerLevel.ERROR);
  private subscriptions: Subscription[] = [];
  protected systemConfig: SystemConfig;
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
    await this.eventsMigrationService.migrateSocialEvents(true);
  }

}
