import { Component, inject, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageComponent } from "../../../page/page.component";
import { SocialCarouselComponent } from "../social-carousel/social-carousel";
import { SocialEventsComponent } from "../list/social-events";
import { EventsMigrationService } from "../../../services/migration/events-migration.service";

@Component({
    selector: "app-social-home",
    template: `
    <app-page>
      <app-social-carousel/>
      <div class="mb-3 col-sm-12">
        <button (click)="performMigration()" class="btn btn-primary mr-2"
                type="button">Migrate
        </button>
      </div>
      <app-social-events/>
    </app-page>
  `,
    styleUrls: ["./social-home.component.sass"],
    imports: [PageComponent, SocialCarouselComponent, SocialEventsComponent]
})
export class SocialHomeComponent implements OnInit {
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  protected eventsMigrationService = inject(EventsMigrationService);
  public logger = this.loggerFactory.createLogger("SocialHomeComponent", NgxLoggerLevel.INFO);

  ngOnInit() {
    this.logger.info("ngOnInit");
  }
  public async performMigration() {
    const migrated = await this.eventsMigrationService.migrateSocialEvents(true);
    // this.applyWalks(migrated);
  }

}
