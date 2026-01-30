import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { SystemConfig } from "../../../../models/system.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { FormsModule } from "@angular/forms";
import { SecretInputComponent } from "../../../../modules/common/secret-input/secret-input.component";
import { InputSize } from "../../../../models/ui-size.model";

@Component({
  selector: "app-system-google-maps-settings",
  standalone: true,
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Google Maps</div>
      @if (systemConfigInternal?.googleMaps) {
        <div class="col-sm-12">
          <div class="row">
            <div class="col-sm-6">
              <div class="form-group">
                <label for="google-maps-api-key">API Key</label>
                <app-secret-input
                  [(ngModel)]="systemConfigInternal.googleMaps.apiKey"
                  id="google-maps-api-key"
                  name="googleMapsApiKey"
                  [size]="InputSize.SM"
                  placeholder="Enter Google Maps API Key">
                </app-secret-input>
                @if (!systemConfigInternal?.googleMaps?.apiKey) {
                  <div class="mt-1 small text-danger">
                    API Key is required for map functionality
                  </div>
                }
              </div>
            </div>
            <div class="col-sm-6">
              <div class="form-group">
                <p class="text-muted mb-2">
                  The Google Maps API key is used for displaying maps and location services throughout the application.
                </p>
                <div>For more information on how to obtain an API key, visit the
                  <a href="https://developers.google.com/maps/documentation/javascript/get-api-key" target="_blank">Google Maps Platform documentation.</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>`,
  imports: [FormsModule, SecretInputComponent]
})
export class SystemGoogleMapsSettingsComponent implements OnInit, OnDestroy {

  protected systemConfigInternal: SystemConfig;
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  systemConfigService: SystemConfigService = inject(SystemConfigService);
  private logger = this.loggerFactory.createLogger("SystemGoogleMapsSettingsComponent", NgxLoggerLevel.ERROR);
  protected readonly InputSize = InputSize;

  @Input({
    alias: "config",
    required: true
  }) set configValue(systemConfig: SystemConfig) {
    this.handleConfigChange(systemConfig);
  }

  ngOnInit() {
    this.logger.info("constructed:", this.systemConfigInternal?.googleMaps);
  }

  ngOnDestroy(): void {
    this.logger.info("ngOnDestroy");
  }

  handleConfigChange(systemConfig: SystemConfig) {
    this.systemConfigInternal = systemConfig;
    if (!this.systemConfigInternal?.googleMaps) {
      this.systemConfigInternal.googleMaps = this.systemConfigService.googleMapsDefaults();
    }
    this.logger.info("handleConfigChange:googleMaps:", this.systemConfigInternal.googleMaps);
  }
}
