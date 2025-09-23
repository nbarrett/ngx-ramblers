import { Component, Input, OnDestroy, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SystemConfig } from "../../../../models/system.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfigService } from "../../../../services/system/system-config.service";

@Component({
  selector: "app-system-os-maps-settings",
  template: `
    <div class="row img-thumbnail thumbnail-2">
      <div class="thumbnail-heading">OS Maps</div>
      @if (configInternal?.externalSystems) {
        <div class="col-sm-12">
          <div class="row">
            <div class="col-md-6">
              <div class="form-group">
                <label for="os-maps-api-key">API Key</label>
                <input [(ngModel)]="configInternal.externalSystems.osMaps.apiKey"
                       id="os-maps-api-key"
                       type="text" class="form-control input-sm"
                       placeholder="Enter OS Maps API Key">
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  imports: [FormsModule]
})
export class SystemOsMapsSettings implements OnInit, OnDestroy {
  configInternal: SystemConfig;
  private logger = inject(LoggerFactory).createLogger("SystemOsMapsSettings", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);

  @Input({ alias: "config", required: true }) set configValue(systemConfig: SystemConfig) {
    this.configInternal = systemConfig;
    if (!this.configInternal?.externalSystems?.osMaps) {
      this.configInternal.externalSystems.osMaps = { apiKey: null } as any;
    }
  }

  ngOnInit() {}
  ngOnDestroy(): void {}
}
