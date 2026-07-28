import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { SystemConfig } from "../../../../models/system.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-system-instagram-settings",
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Instagram site feed</div>
      <div class="col-sm-12">
        @if (config?.externalSystems.instagram) {
          <p class="mb-2">
            The on-site Instagram feed uses the same Facebook Page connection as publishing
            (Connect Facebook above). These fields only control how the feed appears on the website.
          </p>
          <div class="row align-items-end">
            <div class="col-md-6">
              <div class="form-group">
                <label for="instagram-href">Profile URL</label>
                <input [(ngModel)]="config.externalSystems.instagram.groupUrl"
                       id="instagram-href"
                       type="text" class="form-control input-sm"
                       placeholder="https://www.instagram.com">
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="instagram-group-name">Account name</label>
                <input [(ngModel)]="config.externalSystems.instagram.groupName"
                       id="instagram-group-name"
                       type="text" class="form-control input-sm"
                       placeholder="Your Instagram handle">
              </div>
            </div>
            <div class="col-md-12">
              <div class="form-group">
                <div class="form-check">
                  <input [(ngModel)]="config.externalSystems.instagram.showFeed"
                         type="checkbox" class="form-check-input" id="instagram-show-feed">
                  <label class="form-check-label" for="instagram-show-feed">Show Instagram Feed</label>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    </div>`,
  imports: [FormsModule]
})
export class InstagramSettings implements OnInit, OnDestroy {

  public config: SystemConfig;
  private subscriptions: Subscription[] = [];
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  private logger = inject(LoggerFactory).createLogger("InstagramSettings", NgxLoggerLevel.ERROR);

  ngOnInit() {
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
        this.logger.info("retrieved config", config);
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
