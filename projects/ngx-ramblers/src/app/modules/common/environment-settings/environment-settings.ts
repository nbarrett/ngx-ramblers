import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Subscription } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { EnvironmentConfigService } from "../../../services/environment-config.service";
import {
  createEmptyAwsConfig,
  createEmptyCloudflareConfig,
  createDefaultFlyioConfig,
  createEmptyMongoConfig,
  EnvironmentsConfig
} from "../../../models/environment-config.model";
import { EnvironmentSettingsSubTab } from "../../../models/system.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { sortBy } from "../../../functions/arrays";
import { UrlService } from "../../../services/url.service";
import { SectionToggle, SectionToggleTab } from "../../../shared/components/section-toggle";
import { EnvironmentGlobalSettings } from "./environment-global-settings";
import { EnvironmentPerEnvSettings } from "./environment-per-env-settings";
import { EnvironmentConfigTools } from "./environment-config-tools";
import { EnvironmentGitHubSecrets } from "./environment-github-secrets";

@Component({
  selector: "app-environment-settings",
  standalone: true,
  imports: [
    FormsModule,
    SectionToggle,
    EnvironmentGlobalSettings,
    EnvironmentPerEnvSettings,
    EnvironmentConfigTools,
    EnvironmentGitHubSecrets
  ],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Environment Configuration</div>
      <div class="col-sm-12">
        <app-section-toggle
          [tabs]="settingsSubTabs"
          [(selectedTab)]="settingsSubTab"
          [queryParamKey]="'sub-tab'"
          [fullWidth]="true"/>
      </div>
      @if (configError) {
        <div class="alert alert-danger">
          {{ configError }}
        </div>
      }
      @if (showSubTab(EnvironmentSettingsSubTab.TOOLS)) {
        <app-environment-config-tools
          [configJson]="configJson"
          (configJsonChange)="configJson = $event"
          (configLoaded)="populateFormFromConfig($event)"/>
      }
      @if (showSubTab(EnvironmentSettingsSubTab.GITHUB)) {
        <app-environment-github-secrets/>
      }
      <form (ngSubmit)="saveConfigFromForm()" autocomplete="off">
        @if (showSubTab(EnvironmentSettingsSubTab.GLOBAL)) {
          <app-environment-global-settings [config]="editableConfig"/>
        }
        @if (showSubTab(EnvironmentSettingsSubTab.ENVIRONMENTS)) {
          <app-environment-per-env-settings [config]="editableConfig"/>
        }
      </form>
    </div>
    <div class="col-sm-12">
      <input type="submit" value="Save Configuration" (click)="saveConfigFromForm()"
             class="btn btn-success me-2">
      <input type="button" value="Undo Changes" (click)="loadConfig()"
             class="btn btn-primary me-2">
      <input type="button" value="Back to Admin" (click)="backToAdmin()"
             class="btn btn-primary me-2">
    </div>
  `
})
export class EnvironmentSettings implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("EnvironmentSettings", NgxLoggerLevel.ERROR);
  private environmentConfigService = inject(EnvironmentConfigService);
  private notifierService = inject(NotifierService);
  private urlService = inject(UrlService);
  private subscriptions: Subscription[] = [];

  protected readonly EnvironmentSettingsSubTab = EnvironmentSettingsSubTab;

  notifyTarget: AlertTarget = {};
  notify: AlertInstance;

  configJson = "";
  configError = "";
  editableConfig: EnvironmentsConfig = {
    environments: [],
    aws: createEmptyAwsConfig(),
    cloudflare: createEmptyCloudflareConfig(),
    secrets: {}
  };

  settingsSubTab = EnvironmentSettingsSubTab.ENVIRONMENTS;
  settingsSubTabs: SectionToggleTab[] = [
    {value: EnvironmentSettingsSubTab.ENVIRONMENTS, label: "Environments"},
    {value: EnvironmentSettingsSubTab.GLOBAL, label: "Global Settings"},
    {value: EnvironmentSettingsSubTab.TOOLS, label: "View or Initialise"},
    {value: EnvironmentSettingsSubTab.GITHUB, label: "GitHub Secrets"},
    {value: EnvironmentSettingsSubTab.ALL, label: "All"}
  ];

  showSubTab(tab: EnvironmentSettingsSubTab): boolean {
    return [EnvironmentSettingsSubTab.ALL, tab].includes(this.settingsSubTab);
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.loadConfig();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadConfig() {
    this.subscriptions.push(
      this.environmentConfigService.events().subscribe({
        next: config => {
          this.configJson = JSON.stringify(config, null, 2);
          this.populateFormFromConfig(config);
          this.configError = "";
        },
        error: err => {
          this.configError = `Error loading config: ${err.message}`;
        }
      })
    );
  }

  populateFormFromConfig(config: EnvironmentsConfig) {
    this.editableConfig = JSON.parse(JSON.stringify(config));
    this.editableConfig.environments = this.editableConfig.environments || [];
    this.editableConfig.aws = {...createEmptyAwsConfig(), ...this.editableConfig.aws};
    this.editableConfig.cloudflare = {...createEmptyCloudflareConfig(), ...this.editableConfig.cloudflare};
    this.editableConfig.secrets = this.editableConfig.secrets || {};
    this.editableConfig.environments = this.editableConfig.environments
      .map(env => ({
        environment: env.environment || "",
        aws: {...createEmptyAwsConfig(), ...env.aws},
        mongo: {...createEmptyMongoConfig(), ...env.mongo},
        flyio: {...createDefaultFlyioConfig(), ...env.flyio},
        cloudflare: {accountId: "", apiToken: "", zoneId: "", ...env.cloudflare},
        secrets: env.secrets || {}
      }))
      .sort(sortBy("environment"));
  }

  saveConfigFromForm() {
    this.configError = "";
    const config: EnvironmentsConfig = {
      environments: this.editableConfig.environments,
      aws: this.editableConfig.aws,
      cloudflare: this.editableConfig.cloudflare,
      secrets: this.editableConfig.secrets
    };

    this.environmentConfigService.saveConfig(config).then(() => {
      this.configJson = JSON.stringify(config, null, 2);
      this.notify.success({
        title: "Configuration Saved",
        message: "Environment configuration has been saved successfully"
      });
    }).catch(err => {
      this.configError = `Error saving config: ${err.message}`;
      this.notify.error({
        title: "Error saving configuration",
        message: err.message
      });
    });
  }

  backToAdmin() {
    this.urlService.navigateTo(["admin"]);
  }
}
