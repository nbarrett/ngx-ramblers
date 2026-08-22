import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Subscription } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { EnvironmentConfigService } from "../../../services/environment-config.service";
import {
  createEmptyAwsConfig,
  createEmptyCloudflareConfig,
  createDefaultFlyioConfig,
  createDefaultJitsiConfig,
  createDefaultUploadWorkerConfig,
  createEmptyMongoConfig,
  EnvironmentConfig,
  EnvironmentsConfig,
  JitsiConfig,
  UploadWorkerConfig
} from "../../../models/environment-config.model";
import { EnvironmentSettingsSubTab } from "../../../models/system.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { sortBy } from "../../../functions/arrays";
import { UrlService } from "../../../services/url.service";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../models/section-toggle.model";
import { EnvironmentGlobalSettings } from "./environment-global-settings";
import { EnvironmentPerEnvSettings } from "./environment-per-env-settings";
import { EnvironmentConfigTools } from "./environment-config-tools";
import { Environment } from "../../../models/environment.model";
import { StoredValue } from "../../../models/ui-actions";
import { FormSaveActionsComponent } from "../form-save-actions/form-save-actions";
import { FormSaveActions } from "../../../models/form-save-actions.model";

@Component({
  selector: "app-environment-settings",
  imports: [
    FormsModule,
    SectionToggle,
    EnvironmentGlobalSettings,
    EnvironmentPerEnvSettings,
    EnvironmentConfigTools,
    FormSaveActionsComponent
  ],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Environment Configuration</div>
      <div class="col-sm-12">
        <app-section-toggle
          [tabs]="settingsSubTabs"
          [(selectedTab)]="settingsSubTab"
          [queryParamKey]="StoredValue.SUB_TAB"
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
      <app-form-save-actions
        [disabled]="saving"
        [actions]="formSaveActions"/>
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
  protected readonly StoredValue = StoredValue;

  public formSaveActions: FormSaveActions = {
    save: () => this.saveConfigFromForm(),
    saveAndExit: () => this.saveAndExit(),
    undo: () => this.undoChanges(),
    cancel: () => this.cancel()
  };
  public saving = false;

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
    this.editableConfig.uploadWorker = {...createDefaultUploadWorkerConfig(), ...this.editableConfig.uploadWorker};
    this.editableConfig.jitsi = {...createDefaultJitsiConfig(), ...this.editableConfig.jitsi};
    this.editableConfig.environments = this.editableConfig.environments
      .map(env => ({
        ...env,
        environment: env.environment || "",
        aws: {...createEmptyAwsConfig(), ...env.aws},
        mongo: {...createEmptyMongoConfig(), ...env.mongo},
        flyio: {...createDefaultFlyioConfig(), ...env.flyio},
        cloudflare: {accountId: "", apiToken: "", zoneId: "", ...env.cloudflare},
        secrets: env.secrets || {}
      }))
      .sort(sortBy("environment"));
  }

  saveConfigFromForm(): Promise<void> {
    this.configError = "";
    this.saving = true;
    const config: EnvironmentsConfig = {
      ...this.editableConfig,
      environments: this.propagateJitsiSecrets(
        this.propagateWorkerSecrets(this.editableConfig.environments, this.editableConfig.uploadWorker),
        this.editableConfig.jitsi)
    };

    return this.environmentConfigService.saveConfig(config).then(async () => {
      this.editableConfig.environments = config.environments;
      this.configJson = JSON.stringify(config, null, 2);
      const sync = await this.environmentConfigService.syncNgxLite().catch(error => {
        this.logger.warn("syncNgxLite failed:", error);
        return null;
      });
      const unreachable = sync?.failed?.length ? ` (NGX-Lite not yet applied to: ${sync.failed.join(", ")})` : "";
      this.notify.success({
        title: "Configuration Saved",
        message: `Environment configuration has been saved successfully${unreachable}`
      });
    }).catch(err => {
      this.configError = `Error saving config: ${err.message}`;
      this.notify.error({
        title: "Error saving configuration",
        message: err.message
      });
      throw err;
    }).finally(() => {
      this.saving = false;
    });
  }

  saveAndExit(): Promise<void> {
    return this.saveConfigFromForm().then(() => {
      this.urlService.navigateTo(["admin"]);
    }).catch(() => null);
  }

  undoChanges() {
    void this.environmentConfigService.refresh();
  }

  cancel() {
    this.urlService.navigateTo(["admin"]);
  }

  private propagateWorkerSecrets(environments: EnvironmentConfig[], uploadWorker: UploadWorkerConfig): EnvironmentConfig[] {
    if (!uploadWorker?.appName) {
      return environments;
    }
    const workerUrl = `https://${uploadWorker.appName}.fly.dev`;
    return environments.map(env => {
      if (!env.secrets?.[Environment.INTEGRATION_WORKER_URL]) {
        return env;
      }
      return {
        ...env,
        secrets: {
          ...env.secrets,
          [Environment.INTEGRATION_WORKER_URL]: workerUrl,
          [Environment.INTEGRATION_WORKER_SHARED_SECRET]: uploadWorker.sharedSecret || "",
          [Environment.INTEGRATION_WORKER_ENCRYPTION_KEY]: uploadWorker.encryptionKey || ""
        }
      };
    });
  }

  private propagateJitsiSecrets(environments: EnvironmentConfig[], jitsi: JitsiConfig): EnvironmentConfig[] {
    const hostUrl = jitsi?.hostUrl || (jitsi?.appName ? `https://${jitsi.appName}.fly.dev` : "");
    const active = !!(jitsi?.enabled && hostUrl);
    return environments.map(env => {
      const secrets = {...(env.secrets || {})};
      if (active) {
        secrets[Environment.JITSI_HOST_URL] = hostUrl;
        secrets[Environment.JITSI_JWT_APP_ID] = jitsi.jwtAppId || "";
        secrets[Environment.JITSI_JWT_APP_SECRET] = jitsi.jwtAppSecret || "";
      } else {
        delete secrets[Environment.JITSI_HOST_URL];
        delete secrets[Environment.JITSI_JWT_APP_ID];
        delete secrets[Environment.JITSI_JWT_APP_SECRET];
      }
      return {...env, secrets};
    });
  }
}
