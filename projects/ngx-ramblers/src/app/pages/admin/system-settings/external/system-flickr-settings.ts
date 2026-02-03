import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { SystemConfig } from "../../../../models/system.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { FormsModule } from "@angular/forms";
import { SecretInputComponent } from "../../../../modules/common/secret-input/secret-input.component";
import { InputSize } from "../../../../models/ui-size.model";

@Component({
  selector: "app-system-flickr-settings",
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Flickr</div>
      <div class="col-sm-12">
        @if (config?.externalSystems) {
          <div class="row align-items-end">
            <div class="col-md-6">
              <div class="form-group">
                <label for="flickr-api-key">API Key</label>
                <app-secret-input
                  [(ngModel)]="flickrApiKey"
                  id="flickr-api-key"
                  name="apiKey"
                  [size]="InputSize.SM"
                  placeholder="Enter Flickr API Key">
                </app-secret-input>
                <small class="form-text text-muted">
                  Get your API key from <a href="https://www.flickr.com/services/apps/create/apply/" target="_blank">Flickr App Garden</a>
                </small>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="flickr-user-id">Default User ID (optional)</label>
                <input [(ngModel)]="flickrUserId"
                       id="flickr-user-id"
                       type="text" class="form-control input-sm"
                       placeholder="e.g., 68480955@N08">
                <small class="form-text text-muted">
                  Used as fallback when album URL doesn't include user ID
                </small>
              </div>
            </div>
          </div>
        }
      </div>
    </div>`,
  imports: [FormsModule, SecretInputComponent]
})
export class FlickrSettings implements OnInit, OnDestroy {

  public config: SystemConfig;
  private subscriptions: Subscription[] = [];
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  protected readonly InputSize = InputSize;
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("FlickrSettings", NgxLoggerLevel.ERROR);

  ngOnInit() {
    this.logger.info("constructed");
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
        this.ensureFlickrInitialised();
        this.logger.info("retrieved config", config);
      }));
  }

  ngOnDestroy(): void {
    this.logger.info("ngOnDestroy");
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private ensureFlickrInitialised(): void {
    if (this.config?.externalSystems && !this.config.externalSystems.flickr) {
      this.config.externalSystems.flickr = {
        apiKey: "",
        userId: ""
      };
    }
  }

  get flickrApiKey(): string {
    return this.config?.externalSystems?.flickr?.apiKey || "";
  }

  set flickrApiKey(value: string) {
    if (this.config?.externalSystems?.flickr) {
      this.config.externalSystems.flickr.apiKey = value;
    }
  }

  get flickrUserId(): string {
    return this.config?.externalSystems?.flickr?.userId || "";
  }

  set flickrUserId(value: string) {
    if (this.config?.externalSystems?.flickr) {
      this.config.externalSystems.flickr.userId = value;
    }
  }
}
