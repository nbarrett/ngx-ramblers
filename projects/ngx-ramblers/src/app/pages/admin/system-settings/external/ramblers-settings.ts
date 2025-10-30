import { Component, inject, Input, OnInit } from "@angular/core";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfig } from "../../../../models/system.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { SecretInputComponent } from "../../../../modules/common/secret-input/secret-input.component";

@Component({
  selector: "app-ramblers-settings",
  template: `
    @if (config?.national?.mainSite) {
      <div class="row thumbnail-heading-frame">
        <div class="thumbnail-heading">Ramblers</div>
        <div class="row">
          <div class="col-md-5">
            <div class="form-group">
              <label for="main-site-href">Main Site Web Url</label>
              <input [(ngModel)]="config.national.mainSite.href"
                     id="main-site-href"
                     type="text" class="form-control input-sm"
                     placeholder="Enter main site link">
            </div>
          </div>
          <div class="col-md-4">
            <div class="form-group">
              <label for="main-site-title">Main Site Name</label>
              <input [(ngModel)]="config.national.mainSite.title"
                     id="main-site-title"
                     type="text" class="form-control input-sm"
                     placeholder="Enter main site title">
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <label>Link Preview</label>
            </div>
            <div class="form-group">
              <a
                [href]="config.national.mainSite.href">{{ config.national.mainSite.title || config.national.mainSite.href }}</a>
            </div>
          </div>
          <div class="col-md-5">
            <div class="form-group">
              <label for="walks-manager-href">Walks Manager Web Url</label>
              <input [(ngModel)]="config.national.walksManager.href" id="walks-manager-href"
                     type="text" class="form-control input-sm"
                     placeholder="Enter Walks Manager site link">
            </div>
          </div>
          <div class="col-md-4">
            <div class="form-group">
              <label for="walks-manager-title">Walks Manager Name</label>
              <input [(ngModel)]="config.national.walksManager.title"
                     id="walks-manager-title"
                     type="text" class="form-control input-sm"
                     placeholder="Enter Walks Manager site title">
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <label>Link Preview</label>
            </div>
            <div class="form-group">
              <a
                [href]="config.national.walksManager.href">{{ config.national.walksManager.title || config.national.walksManager.href }}</a>
            </div>
          </div>
          <div class="col-md-5">
            <form class="form-group">
              <label for="walks-manager-user-name">Walks Manager User Name</label>
              <input [(ngModel)]="config.national.walksManager.userName"
                     id="walks-manager-user-name"
                     autocomplete="nope"
                     name="newPassword"
                     type="text" class="form-control input-sm"
                     placeholder="Enter Walks Manager userName">
            </form>
          </div>
          <div class="col-md-4">
            <form class="form-group">
              <label for="walks-manager-password">Walks Manager password</label>
              <app-secret-input
                [(ngModel)]="config.national.walksManager.password"
                id="walks-manager-password"
                name="password"
                size="sm"
                placeholder="Enter Walks Manager password">
              </app-secret-input>
            </form>
          </div>
          <div class="col-md-3">
            <form class="form-group">
              <label for="walks-manager-api-key">Walks Manager API Key</label>
              <app-secret-input
                [(ngModel)]="config.national.walksManager.apiKey"
                id="walks-manager-api-key"
                name="apiKey"
                size="sm"
                placeholder="Enter Walks Manager API key">
              </app-secret-input>
            </form>
          </div>
        </div>
      </div>
    }
  `,
  imports: [ReactiveFormsModule, FormsModule, SecretInputComponent]
})
export class RamblersSettings implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("ImageCollectionSettingsComponent", NgxLoggerLevel.ERROR);
  protected systemConfigService = inject(SystemConfigService);
  faAdd = faAdd;
  @Input() config: SystemConfig;

  protected readonly JSON = JSON;

  ngOnInit() {
    this.logger.info("constructed:config:", this.config);
  }
}
