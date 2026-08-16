import { Component, Input, OnDestroy, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SystemConfig } from "../../../../models/system.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { SecretInputComponent } from "../../../../modules/common/secret-input/secret-input.component";
import { InputSize } from "../../../../models/ui-size.model";
import { RouterLink } from "@angular/router";
import { DEFAULT_WALKS_AREA, walksAdminPath, WalksAdminSegment } from "../../../../models/walks-route-paths.model";

@Component({
  selector: "app-system-os-maps-settings",
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">OS Maps</div>
      @if (configInternal?.externalSystems) {
        <div class="col-sm-12">
          <div class="row">
            <div class="col-12">
              <div class="form-group">
                <label for="os-maps-api-key">API Key</label>
                <app-secret-input [(ngModel)]="configInternal.externalSystems.osMaps.apiKey"
                                  id="os-maps-api-key"
                                  [size]="InputSize.SM"
                                  placeholder="Enter OS Maps API Key"/>
              </div>
            </div>
          </div>
          <div class="row">
            <div class="col-md-6">
              <div class="form-group">
                <label for="os-maps-email">OS Maps email</label>
                <input [(ngModel)]="configInternal.externalSystems.osMaps.email"
                       type="email"
                       class="form-control"
                       id="os-maps-email"
                       placeholder="OS Maps account email">
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="os-maps-password">OS Maps password</label>
                <app-secret-input [(ngModel)]="configInternal.externalSystems.osMaps.password"
                                  id="os-maps-password"
                                  [size]="InputSize.SM"
                                  placeholder="OS Maps account password"/>
              </div>
            </div>
            <div class="col-12">
              <a class="btn btn-primary" [routerLink]="walksAdminHref">Choose routes to convert</a>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  imports: [FormsModule, SecretInputComponent, RouterLink]
})
export class SystemOsMapsSettings implements OnInit, OnDestroy {
  configInternal: SystemConfig;
  private logger = inject(LoggerFactory).createLogger("SystemOsMapsSettings", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  protected readonly InputSize = InputSize;
  protected readonly walksAdminHref = "/" + walksAdminPath(DEFAULT_WALKS_AREA, WalksAdminSegment.OS_MAPS_EXPORT);


  @Input({ alias: "config", required: true }) set configValue(systemConfig: SystemConfig) {
    this.configInternal = systemConfig;
    if (!this.configInternal?.externalSystems?.osMaps) {
      this.configInternal.externalSystems.osMaps = {apiKey: null, email: null, password: null};
    }
  }

  ngOnInit() {}
  ngOnDestroy(): void {}
}
