import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { DOCUMENT } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheck, faCircleCheck, faCircleExclamation, faCopy, faDownload, faExternalLinkAlt, faRotate, faSave } from "@fortawesome/free-solid-svg-icons";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import {
  ConsoleAccessCredentialField,
  ConsoleAccessDocument,
  ConsoleAccessEnvironmentListItem,
  ConsoleAccessLoginView,
  ConsoleAccessServiceInfo,
  EstateRebuildCaptureFormat,
  EstateRebuildCaptureSummary,
  EstateRebuildDownloadChoice
} from "../../../models/environment-setup.model";
import { AlertTarget } from "../../../models/alert-target.model";
import { StoredValue } from "../../../models/ui-actions";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { ClipboardService } from "../../../services/clipboard.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageComponent } from "../../../page/page.component";
import { LoginRequiredComponent } from "../../../modules/common/login-required/login-required";
import { SecretInputComponent } from "../../../modules/common/secret-input/secret-input.component";

const PLATFORM_SCOPE = "platform";

@Component({
  selector: "app-estate-rebuild-capture",
  template: `
    <app-page>
      <app-login-required/>
      <div class="row">
        <div class="col-12">
          <h1>Estate rebuild capture</h1>
          <div class="row thumbnail-heading-frame">
            <div class="thumbnail-heading">What is in the pack</div>
            <div class="col-sm-12">
              <p>
                Generates a private rebuild inventory of every site from live configuration: staging
                <code>config.environments</code>, each site’s Mongo <code>config</code> collection, and
                stored <strong>console access</strong> (Atlas / Fly / AWS website logins that NGX does not use at runtime).
                By default the download includes secret values (passwords, API keys, tokens) so the estate can be rebuilt.
              </p>
              <p class="text-muted">
                This runs on the platform-admin (staging) server, which holds the central environments map and can probe each site database.
              </p>

              @if (summary) {
                <div class="alert alert-success d-flex align-items-start" role="alert">
                  <fa-icon [icon]="faCircleCheck" class="me-2 mt-1"></fa-icon>
                  <div>
                    <strong class="d-block">Platform inventory scope</strong>
                    As of {{ summary.generatedAtUtc }}:
                    {{ summary.siteCount }} sites ·
                    {{ summary.fieldsPerSite }} fields per site ·
                    {{ summary.siteCaptureRows }} site capture rows ·
                    {{ summary.platformFieldCount }} platform fields.
                    Download probes every site database and may take around half a minute.
                  </div>
                </div>
              }

              <div class="d-flex flex-nowrap gap-2 mb-3 align-items-center flex-wrap">
                <div class="btn-group" dropdown [isDisabled]="busy">
                  <button type="button"
                          class="btn btn-primary dropdown-toggle text-nowrap"
                          dropdownToggle
                          [disabled]="busy">
                    <fa-icon [icon]="faDownload" class="me-1"></fa-icon>
                    {{ busy ? "Busy…" : "Download" }}
                  </button>
                  <ul *dropdownMenu class="dropdown-menu" role="menu">
                    <li role="menuitem">
                      <button class="dropdown-item" type="button" (click)="downloadChoice(allChoice)">All</button>
                    </li>
                    <li role="menuitem">
                      <button class="dropdown-item" type="button" (click)="downloadChoice(xlsxChoice)">Excel</button>
                    </li>
                    <li role="menuitem">
                      <button class="dropdown-item" type="button" (click)="downloadChoice(markdownChoice)">Markdown</button>
                    </li>
                    <li role="menuitem">
                      <button class="dropdown-item" type="button" (click)="downloadChoice(htmlChoice)">HTML</button>
                    </li>
                  </ul>
                </div>
                <button type="button" class="btn btn-quiet text-nowrap" [disabled]="busy" (click)="refreshSummary()">
                  <fa-icon [icon]="faRotate" class="me-1"></fa-icon>
                  {{ busyFormat === "summary" ? "Busy…" : "Refresh" }}
                </button>
                <div class="form-check mb-0 ms-1">
                  <input class="form-check-input"
                         type="checkbox"
                         id="include-secrets"
                         [(ngModel)]="includeSecrets"
                         [disabled]="busy"
                         name="includeSecrets">
                  <label class="form-check-label text-nowrap" for="include-secrets">
                    Include secrets
                  </label>
                </div>
              </div>
              <p class="text-muted small mb-3">
                Format default is All. <strong>Include secrets</strong> is on by default so passwords, API keys and tokens are written in full.
                Untick only if you want a presence-only inventory (SET or empty for secrets).
              </p>

              <ul>
                <li><strong>Third-party systems</strong> - one row per integrated system and what config holds</li>
                <li><strong>Console access</strong> - website logins per environment (Atlas, Fly.io, AWS, …) plus platform-shared GitHub/Docker Hub; not used by the running app</li>
                <li><strong>Sites directory</strong> - one row per live environment</li>
                <li><strong>Site capture</strong> - runtime, application, people, and per-site console fields</li>
                <li><strong>Platform capture</strong> - shared staging config plus platform console logins</li>
              </ul>

              <div class="alert alert-warning d-flex align-items-start mb-0" role="alert">
                <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"></fa-icon>
                <div>
                  <strong class="d-block">Keep this private</strong>
                  @if (includeSecrets) {
                    This download writes live credentials. Store only in a password manager. Do not commit or email.
                  } @else {
                    Secrets will be presence-only (SET or empty). Tick Include secrets for full rebuild values.
                  }
                </div>
              </div>

              @if (notifyTarget.showAlert) {
                <div class="mt-3 alert {{ notifyTarget.alert.class }} d-flex align-items-start mb-0" role="alert">
                  <fa-icon [icon]="notifyTarget.alert.icon" class="me-2 mt-1"></fa-icon>
                  <div>
                    @if (notifyTarget.alertTitle) {
                      <strong class="d-block">{{ notifyTarget.alertTitle }}</strong>
                    }
                    {{ notifyTarget.alertMessage }}
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="row thumbnail-heading-frame">
            <div class="thumbnail-heading">Console access</div>
            <div class="col-sm-12">
              <p class="text-muted">
                Website logins that NGX does not use at runtime (Atlas UI, fly.io dashboard, AWS console, and so on).
                <strong>Most values are per environment</strong> — each site has its own row set under
                <code>config.environments[].consoleAccess</code>. Only GitHub and Docker Hub are shared platform accounts.
              </p>
              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label" for="console-scope">Environment</label>
                  <select id="console-scope"
                          class="form-select"
                          [(ngModel)]="consoleScope"
                          (ngModelChange)="onConsoleScopeChange($event)"
                          [disabled]="consoleBusy"
                          name="consoleScope">
                    @for (env of consoleEnvironments; track env.environment) {
                      <option [value]="env.environment">
                        {{ env.environment }}{{ env.hasConsoleAccess ? " · saved" : "" }}
                      </option>
                    }
                    <option [value]="platformScope">Platform shared (GitHub, Docker Hub)</option>
                  </select>
                </div>
                <div class="col-md-6 d-flex align-items-end gap-2 flex-wrap">
                  <button type="button"
                          class="btn btn-primary"
                          [disabled]="consoleBusy || !consoleScope"
                          (click)="saveConsoleAccess()">
                    <fa-icon [icon]="faSave" class="me-1"></fa-icon>
                    {{ consoleBusy ? "Saving…" : "Save" }}
                  </button>
                  <button type="button"
                          class="btn btn-quiet btn-sm"
                          [disabled]="consoleBusy || !consoleScope"
                          (click)="copyAllForScope()"
                          [tooltip]="copiedScopeKey === consoleScope ? 'Copied' : 'Copy all'"
                          container="body">
                    <fa-icon [icon]="copiedScopeKey === consoleScope ? faCheck : faCopy"></fa-icon>
                  </button>
                </div>
              </div>

              @if (consoleServices.length > 0) {
                @for (service of visibleConsoleServices(); track service.serviceId) {
                  <div class="row thumbnail-heading-frame">
                    <div class="thumbnail-heading d-flex align-items-center gap-2 flex-wrap">
                      <span>{{ service.name }}</span>
                      <button type="button"
                              class="btn btn-quiet btn-sm"
                              (click)="copyAllForService(service)"
                              [tooltip]="copiedServiceId === service.serviceId ? 'Copied' : 'Copy all'"
                              container="body">
                        <fa-icon [icon]="copiedServiceId === service.serviceId ? faCheck : faCopy"></fa-icon>
                      </button>
                    </div>
                    <div class="col-sm-12">
                      <p class="small text-muted">{{ service.function }}</p>
                      @if (service.identifiers?.length) {
                        <div class="row mb-3 g-3">
                          @for (identifier of service.identifiers; track identifier.key) {
                            <div class="col-md-6">
                              <label class="form-label d-block"
                                     [for]="'id-' + service.serviceId + '-' + identifier.key">
                                {{ identifier.label }}
                              </label>
                              <input type="text"
                                     class="form-control w-100"
                                     [id]="'id-' + service.serviceId + '-' + identifier.key"
                                     [placeholder]="identifier.placeholder || ''"
                                     [ngModel]="identifierValue(service.serviceId, identifier.key)"
                                     (ngModelChange)="setIdentifier(service.serviceId, identifier.key, $event)"
                                     [name]="'id-' + service.serviceId + '-' + identifier.key"
                                     autocomplete="off">
                            </div>
                          }
                        </div>
                      }
                      @if (resolvedUrlsFor(service).length) {
                        <div class="mb-3">
                          <div class="form-label d-block">Console links</div>
                          <ul class="mb-0 ps-3">
                            @for (link of resolvedUrlsFor(service); track link.url) {
                              <li class="mb-1">
                                <a [href]="link.url" target="_blank" rel="noopener noreferrer">
                                  {{ link.label }}
                                  <fa-icon [icon]="faExternalLinkAlt" class="ms-1 small"></fa-icon>
                                </a>
                              </li>
                            }
                          </ul>
                        </div>
                      }
                      <div class="row mb-3 g-3">
                        <div class="col-md-6">
                          <label class="form-label d-block" [for]="'login-' + service.serviceId">Username</label>
                          <input type="text"
                                 class="form-control w-100"
                                 [id]="'login-' + service.serviceId"
                                 [ngModel]="loginFor(service.serviceId).login"
                                 (ngModelChange)="setLoginField(service.serviceId, loginField, $event)"
                                 [name]="'login-' + service.serviceId"
                                 autocomplete="off">
                        </div>
                        <div class="col-md-6">
                          <label class="form-label d-block" [for]="'password-' + service.serviceId">Password</label>
                          <app-secret-input
                            class="w-100 d-block"
                            [id]="'password-' + service.serviceId"
                            [ngModel]="loginFor(service.serviceId).password"
                            (ngModelChange)="setLoginField(service.serviceId, passwordField, $event)"
                            [name]="'password-' + service.serviceId">
                          </app-secret-input>
                        </div>
                      </div>
                      <div class="row">
                        <div class="col-12">
                          <label class="form-label d-block" [for]="'notes-' + service.serviceId">Notes</label>
                          <textarea class="form-control w-100"
                                    rows="2"
                                    [id]="'notes-' + service.serviceId"
                                    [ngModel]="loginFor(service.serviceId).notes"
                                    (ngModelChange)="setLoginField(service.serviceId, notesField, $event)"
                                    [name]="'notes-' + service.serviceId"></textarea>
                        </div>
                      </div>
                    </div>
                  </div>
                }
              }
            </div>
          </div>
        </div>
      </div>
    </app-page>
  `,
  styleUrls: ["../admin/admin.component.sass"],
  imports: [
    PageComponent,
    LoginRequiredComponent,
    FontAwesomeModule,
    FormsModule,
    SecretInputComponent,
    TooltipDirective,
    BsDropdownDirective,
    BsDropdownToggleDirective,
    BsDropdownMenuDirective
  ]
})
export class EstateRebuildCaptureComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("EstateRebuildCaptureComponent", NgxLoggerLevel.ERROR);
  private environmentSetupService = inject(EnvironmentSetupService);
  private notifierService = inject(NotifierService);
  private clipboardService = inject(ClipboardService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private document = inject(DOCUMENT);
  private subscriptions: Subscription[] = [];

  summary: EstateRebuildCaptureSummary = null;
  busy = false;
  busyFormat: string = null;
  includeSecrets = true;
  consoleBusy = false;
  consoleScope = "";
  consoleEnvironments: ConsoleAccessEnvironmentListItem[] = [];
  consoleServices: ConsoleAccessServiceInfo[] = [];
  consoleAccess: Record<string, ConsoleAccessLoginView> = {};
  copiedServiceId: string = null;
  copiedScopeKey: string = null;
  notifyTarget: AlertTarget = {};
  notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  protected readonly platformScope = PLATFORM_SCOPE;
  protected readonly faDownload = faDownload;
  protected readonly faRotate = faRotate;
  protected readonly faSave = faSave;
  protected readonly faCopy = faCopy;
  protected readonly faCheck = faCheck;
  protected readonly faExternalLinkAlt = faExternalLinkAlt;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly allChoice = EstateRebuildDownloadChoice.ALL;
  protected readonly xlsxChoice = EstateRebuildDownloadChoice.XLSX;
  protected readonly markdownChoice = EstateRebuildDownloadChoice.MARKDOWN;
  protected readonly htmlChoice = EstateRebuildDownloadChoice.HTML;
  protected readonly loginField = ConsoleAccessCredentialField.LOGIN;
  protected readonly passwordField = ConsoleAccessCredentialField.PASSWORD;
  protected readonly notesField = ConsoleAccessCredentialField.NOTES;

  async ngOnInit(): Promise<void> {
    await this.refreshSummary();
    await this.loadConsoleEnvironments();
    const fromUrl = this.route.snapshot.queryParamMap.get(StoredValue.ENVIRONMENT);
    const initialScope = this.resolveConsoleScope(fromUrl);
    this.consoleScope = initialScope;
    await this.loadConsoleAccess(initialScope);
    if (fromUrl !== initialScope) {
      this.writeEnvironmentToUrl(initialScope);
    }
    this.subscriptions.push(this.route.queryParamMap.subscribe(params => {
      const scope = this.resolveConsoleScope(params.get(StoredValue.ENVIRONMENT));
      if (scope !== this.consoleScope) {
        this.consoleScope = scope;
        this.loadConsoleAccess(scope);
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private resolveConsoleScope(candidate: string | null): string {
    if (candidate === PLATFORM_SCOPE) {
      return PLATFORM_SCOPE;
    } else if (candidate && this.consoleEnvironments.some(env => env.environment === candidate)) {
      return candidate;
    } else {
      return this.consoleEnvironments[0]?.environment || PLATFORM_SCOPE;
    }
  }

  private writeEnvironmentToUrl(scope: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.ENVIRONMENT]: scope},
      queryParamsHandling: "merge",
      replaceUrl: true
    });
  }

  visibleConsoleServices(): ConsoleAccessServiceInfo[] {
    if (this.consoleScope === PLATFORM_SCOPE) {
      return this.consoleServices.filter(service =>
        service.scope === "platform" || service.scope === "per-site-and-platform"
      );
    } else {
      return this.consoleServices.filter(service =>
        service.scope === "per-site" || service.scope === "per-site-and-platform"
      );
    }
  }

  loginFor(serviceId: string): ConsoleAccessLoginView {
    if (!this.consoleAccess[serviceId]) {
      this.consoleAccess[serviceId] = {};
    }
    return this.consoleAccess[serviceId];
  }

  setLoginField(serviceId: string, field: ConsoleAccessCredentialField, value: string): void {
    const current = this.loginFor(serviceId);
    this.consoleAccess = {
      ...this.consoleAccess,
      [serviceId]: {...current, [field]: value}
    };
  }

  identifierValue(serviceId: string, key: string): string {
    return this.loginFor(serviceId).identifiers?.[key] || "";
  }

  setIdentifier(serviceId: string, key: string, value: string): void {
    const current = this.loginFor(serviceId);
    const identifiers = {...(current.identifiers || {}), [key]: value};
    this.consoleAccess = {
      ...this.consoleAccess,
      [serviceId]: {...current, identifiers}
    };
  }

  resolvedUrlsFor(service: ConsoleAccessServiceInfo): Array<{label: string; url: string}> {
    const identifiers = this.loginFor(service.serviceId).identifiers || {};
    return (service.urls || [])
      .map(template => {
        const placeholders: string[] = template.urlTemplate.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
        const missing = placeholders.some(token => {
          const key = token.slice(1, -1);
          return !identifiers[key];
        });
        if (missing && placeholders.length > 0) {
          return null;
        } else {
          const url = placeholders.reduce((current: string, token: string) => {
            const key = token.slice(1, -1);
            return current.split(token).join(encodeURIComponent(identifiers[key]));
          }, template.urlTemplate);
          return {label: template.label, url};
        }
      })
      .filter((item): item is {label: string; url: string} => item !== null);
  }

  copyAllForService(service: ConsoleAccessServiceInfo): void {
    const text = this.formatServiceCredentials(service);
    this.clipboardService.copyToClipboard(text);
    this.copiedServiceId = service.serviceId;
    this.copiedScopeKey = null;
    window.setTimeout(() => {
      if (this.copiedServiceId === service.serviceId) {
        this.copiedServiceId = null;
      }
    }, 2000);
  }

  copyAllForScope(): void {
    const scopeLabel = this.consoleScope === PLATFORM_SCOPE ? "Platform shared" : this.consoleScope;
    const blocks = this.visibleConsoleServices()
      .map(service => this.formatServiceCredentials(service))
      .filter(block => block.length > 0);
    const text = [`Environment: ${scopeLabel}`, "", ...blocks].join("\n\n");
    this.clipboardService.copyToClipboard(text);
    this.copiedScopeKey = this.consoleScope;
    this.copiedServiceId = null;
    window.setTimeout(() => {
      if (this.copiedScopeKey === this.consoleScope) {
        this.copiedScopeKey = null;
      }
    }, 2000);
  }

  private formatServiceCredentials(service: ConsoleAccessServiceInfo): string {
    const entry = this.loginFor(service.serviceId);
    const username = entry.login || "";
    const password = entry.password || "";
    const notes = entry.notes || "";
    const identifierLines = (service.identifiers || []).map(identifier =>
      `${identifier.label}: ${entry.identifiers?.[identifier.key] || ""}`
    );
    const linkLines = this.resolvedUrlsFor(service).map(link => `${link.label}: ${link.url}`);
    if (!username && !password && !notes && identifierLines.every(line => line.endsWith(": "))) {
      return "";
    } else {
      return [
        service.name,
        ...identifierLines,
        `Username: ${username}`,
        `Password: ${password}`,
        `Notes: ${notes}`,
        ...linkLines
      ].join("\n");
    }
  }

  async onConsoleScopeChange(scope: string): Promise<void> {
    this.copiedServiceId = null;
    this.copiedScopeKey = null;
    this.writeEnvironmentToUrl(scope);
    await this.loadConsoleAccess(scope);
  }

  async refreshSummary(): Promise<void> {
    this.busy = true;
    this.busyFormat = "summary";
    this.notify.hide();
    try {
      this.summary = await this.environmentSetupService.estateRebuildCaptureSummary();
    } catch (error) {
      this.logger.error("Failed to load estate rebuild summary:", error);
      this.notify.error({
        title: "Could not probe environments",
        message: error instanceof Error ? error.message : "Generation failed — check that platform admin is enabled and Mongo is reachable.",
        continue: true
      });
    } finally {
      this.busy = false;
      this.busyFormat = null;
    }
  }

  async loadConsoleEnvironments(): Promise<void> {
    try {
      const response = await this.environmentSetupService.consoleAccessEnvironments();
      this.consoleEnvironments = response.environments || [];
    } catch (error) {
      this.logger.error("Failed to list console-access environments:", error);
    }
  }

  async loadConsoleAccess(scope: string): Promise<void> {
    this.consoleBusy = true;
    try {
      const document: ConsoleAccessDocument = await this.environmentSetupService.consoleAccess(scope);
      this.consoleScope = document.scope;
      this.consoleServices = document.services || [];
      this.consoleAccess = {...(document.consoleAccess || {})};
    } catch (error) {
      this.logger.error("Failed to load console access:", error);
      this.notify.error({
        title: "Could not load console access",
        message: error instanceof Error ? error.message : "Load failed",
        continue: true
      });
    } finally {
      this.consoleBusy = false;
    }
  }

  async saveConsoleAccess(): Promise<void> {
    this.consoleBusy = true;
    this.notify.hide();
    try {
      const cleaned: Record<string, ConsoleAccessLoginView> = {};
      this.visibleConsoleServices().forEach(service => {
        const entry = this.consoleAccess[service.serviceId] || {};
        const identifiers = entry.identifiers || {};
        const hasIdentifiers = (service.identifiers || []).some(item => !!(identifiers[item.key] || "").trim());
        if (entry.login || entry.password || entry.notes || hasIdentifiers) {
          const cleanedIdentifiers: Record<string, string> = {};
          (service.identifiers || []).forEach(item => {
            const value = (identifiers[item.key] || "").trim();
            if (value) {
              cleanedIdentifiers[item.key] = value;
            }
          });
          cleaned[service.serviceId] = {
            login: entry.login || "",
            password: entry.password || "",
            notes: entry.notes || "",
            identifiers: cleanedIdentifiers
          };
        }
      });
      const document = await this.environmentSetupService.saveConsoleAccess(this.consoleScope, cleaned);
      this.consoleAccess = {...(document.consoleAccess || {})};
      await this.loadConsoleEnvironments();
      this.notify.success({
        title: "Console access saved",
        message: this.consoleScope === PLATFORM_SCOPE
          ? "Platform website logins updated on staging config.environments."
          : `Website logins updated for ${this.consoleScope}.`
      });
    } catch (error) {
      this.logger.error("Failed to save console access:", error);
      this.notify.error({
        title: "Could not save console access",
        message: error instanceof Error ? error.message : "Save failed",
        continue: true
      });
    } finally {
      this.consoleBusy = false;
    }
  }

  async downloadChoice(choice: EstateRebuildDownloadChoice): Promise<void> {
    if (choice === EstateRebuildDownloadChoice.ALL) {
      await this.downloadAll();
    } else if (choice === EstateRebuildDownloadChoice.XLSX) {
      await this.downloadOne(EstateRebuildCaptureFormat.XLSX);
    } else if (choice === EstateRebuildDownloadChoice.MARKDOWN) {
      await this.downloadOne(EstateRebuildCaptureFormat.MARKDOWN);
    } else {
      await this.downloadOne(EstateRebuildCaptureFormat.HTML);
    }
  }

  private async downloadAll(): Promise<void> {
    this.busy = true;
    this.busyFormat = "all";
    this.notify.hide();
    try {
      const formats = [
        EstateRebuildCaptureFormat.XLSX,
        EstateRebuildCaptureFormat.MARKDOWN,
        EstateRebuildCaptureFormat.HTML
      ];
      for (const format of formats) {
        const blob = await this.environmentSetupService.downloadEstateRebuildCapture(format, this.includeSecrets);
        this.triggerDownload(blob, this.fileNameFor(format));
      }
      this.notify.success({
        title: "Download ready",
        message: this.includeSecrets
          ? "Excel, Markdown and HTML with live secret values. Store only in a password manager."
          : "Excel, Markdown and HTML generated without secret values (SET or empty)."
      });
    } catch (error) {
      this.logger.error("Failed to download estate rebuild capture pack:", error);
      this.notify.error({
        title: "Generation failed",
        message: error instanceof Error ? error.message : "Could not generate the pack.",
        continue: true
      });
    } finally {
      this.busy = false;
      this.busyFormat = null;
    }
  }

  private async downloadOne(format: EstateRebuildCaptureFormat): Promise<void> {
    this.busy = true;
    this.busyFormat = format;
    this.notify.hide();
    try {
      const blob = await this.environmentSetupService.downloadEstateRebuildCapture(format, this.includeSecrets);
      this.triggerDownload(blob, this.fileNameFor(format));
      this.notify.success({
        title: "Download ready",
        message: this.includeSecrets
          ? `${this.fileNameFor(format)} includes live secret values. Store only in a password manager.`
          : `${this.fileNameFor(format)} generated without secret values (SET or empty).`
      });
    } catch (error) {
      this.logger.error("Failed to download estate rebuild capture:", error);
      this.notify.error({
        title: "Generation failed",
        message: error instanceof Error ? error.message : "Could not generate the pack.",
        continue: true
      });
    } finally {
      this.busy = false;
      this.busyFormat = null;
    }
  }

  private fileNameFor(format: EstateRebuildCaptureFormat): string {
    const suffix = this.includeSecrets ? "-with-secrets" : "";
    if (format === EstateRebuildCaptureFormat.MARKDOWN) {
      return `estate-rebuild-capture${suffix}.md`;
    } else if (format === EstateRebuildCaptureFormat.HTML) {
      return `estate-rebuild-capture${suffix}.html`;
    } else {
      return `estate-rebuild-capture${suffix}.xlsx`;
    }
  }

  private triggerDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement("a");
    link.href = url;
    link.download = fileName;
    this.document.body.appendChild(link);
    link.click();
    this.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
