import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faExclamationTriangle,
  faGlobe,
  faPlus,
  faRedo,
  faSpinner,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { CustomDomainEntry, CustomDomainStatus, SiteUrlPreference } from "../../../models/environment-config.model";
import {
  CustomDomainEligibility,
  ENVIRONMENT_SUBDOMAIN_BASE,
  ExistingEnvironment,
  HostnameHealth,
  HostnameHealthReport,
  HostnameOrigin,
  HostnameStatus
} from "../../../models/environment-setup.model";

import {
  apexHost,
  firstGroupOwnedApex,
  hostnameMayHaveWwwCompanion,
  suggestedCustomDomainHostname
} from "../../../functions/hosts";
import { mailDomainForSiteHost, ngxRamblersMailDomain } from "../../../functions/rewrite-mail-domain";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { SessionLogsComponent } from "../../../shared/components/session-logs";
import { domainBadgeClass, domainStatusLabel } from "./environment-hostname-display";
import { environmentOperationErrorDetail } from "./environment-operation-error";

@Component({
  selector: "app-environment-custom-domains",
  imports: [
    FormsModule,
    FontAwesomeModule,
    SessionLogsComponent
  ],
  template: `
    <div class="hostname-part mt-4 pt-3 border-top">
      <div class="fw-bold">Attach a custom domain</div>
      @if (groupOwnedApexHost(); as apex) {
        @if (suggestedCustomDomainAlreadyAttached()) {
          <p class="small text-muted mb-2">
            This group's own domain is <code>{{ apex }}</code>.
            <code>{{ suggestedCustomDomain() }}</code> is already attached.
            Add another hostname only if you need a further host on that domain.
          </p>
        } @else {
          <p class="small text-muted mb-2">
            Only if a hostname on this group's own domain (e.g. <code>{{ suggestedCustomDomain() }}</code>)
            should serve this site. Skip when the free NGX subdomain is enough.
          </p>
        }
      } @else {
        <p class="small text-muted mb-2">
          No group-owned domain was found for this environment, so it is on the free NGX subdomain only.
          Attach a hostname here only if the group owns a domain of its own that should serve this site.
        </p>
      }
      <div class="d-flex gap-2 align-items-start flex-wrap">
        <input type="text" class="form-control" style="max-width: 320px;"
               [placeholder]="customDomainPlaceholder()"
               [(ngModel)]="customDomainHostname"
               (ngModelChange)="onCustomDomainHostnameChange()"
               [disabled]="operationBusy || customDomainBusy">
        <button class="btn btn-primary" (click)="addCustomDomain()"
                [disabled]="operationBusy || customDomainBusy || customDomainEligibilityConfirming || !customDomainHostname">
          @if (probingCustomDomain) {
            <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
            Checking DNS
          } @else if (customDomainBusy && !removingDomainHostname && !checkingDomainHostname) {
            <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
            Attach domain
          } @else {
            <fa-icon [icon]="faPlus" class="me-1"></fa-icon>
            Attach domain
          }
        </button>
      </div>
      @if (shouldShowAlsoAttachWwwOption()) {
        <div class="form-check mt-2">
          <input class="form-check-input" type="checkbox" id="alsoAttachWww"
                 [(ngModel)]="alsoAttachWww"
                 [disabled]="operationBusy || customDomainBusy">
          <label class="form-check-label small" for="alsoAttachWww">
            Also attach the <code>www.</code> variant so both names work
          </label>
        </div>
      }
      @if (shouldShowAlsoAttachWwwOption()) {
        <div class="mt-2">
          <div class="small fw-bold mb-1">Visitors should see</div>
          <div class="form-check">
            <input class="form-check-input" type="radio" id="siteUrlApex" name="siteUrlPreference"
                   [value]="SiteUrlPreference.APEX"
                   [(ngModel)]="siteUrlPreference"
                   [disabled]="operationBusy || customDomainBusy">
            <label class="form-check-label small" for="siteUrlApex">
              <code>https://{{ attachApexHostname() }}</code>
              (www redirects here)
            </label>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="radio" id="siteUrlWww" name="siteUrlPreference"
                   [value]="SiteUrlPreference.WWW"
                   [(ngModel)]="siteUrlPreference"
                   [disabled]="operationBusy || customDomainBusy">
            <label class="form-check-label small" for="siteUrlWww">
              <code>https://www.{{ attachApexHostname() }}</code>
              (apex redirects here)
            </label>
          </div>
        </div>
      }
      @if (customDomainEligibilityConfirming && customDomainEligibility) {
        <div class="alert alert-warning d-flex align-items-start mt-3 mb-0">
          <fa-icon [icon]="faExclamationTriangle" class="me-2 mt-1"/>
          <div class="flex-grow-1">
            <div><strong>DNS is not managed here</strong></div>
            <div class="small mt-1">{{ customDomainEligibility.message }}</div>
            @if (alsoAttachWww && shouldShowAlsoAttachWwwOption()) {
              <div class="small mt-1">The www variant will be attached as well.</div>
            }
          </div>
          <div class="btn-group btn-group-sm ms-3">
            <button type="button" class="btn btn-primary" [disabled]="customDomainBusy"
                    (click)="confirmCustomDomainEligibility()">Attach</button>
            <button type="button" class="btn btn-quiet"
                    (click)="cancelCustomDomainEligibility()">Cancel</button>
          </div>
        </div>
      }
      @if (customDomainError) {
        <p class="small text-danger mt-2 mb-0">{{ customDomainError }}</p>
      }
      @if (customDomainMessages.length > 0) {
        <div class="mt-3">
          <app-session-logs [messages]="customDomainMessages"></app-session-logs>
        </div>
      }
    </div>

    <div class="hostname-part mt-4 pt-3 border-top">
      <div class="fw-bold">Apex / www redirect</div>
      <p class="small text-muted mb-2">
        Choose which address visitors should see. The other name redirects there.
        Default for a new attach is the apex (no www).
        @if (!canSetupApexRedirect()) {
          Available after a custom domain is attached.
        }
      </p>
      @if (switchableSiteHostPair(); as pair) {
        <div class="d-flex gap-2 align-items-start flex-wrap mb-2">
          <button type="button" class="btn btn-primary" (click)="setupApexRedirect(pair.apex)"
                  [disabled]="operationBusy || customDomainBusy || apexRedirectBusy">
            @if (apexRedirectBusy) {
              <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
            }
            Use {{ pair.apex }}
          </button>
          <button type="button" class="btn btn-quiet" (click)="setupApexRedirect(pair.www)"
                  [disabled]="operationBusy || customDomainBusy || apexRedirectBusy">
            Use {{ pair.www }}
          </button>
        </div>
      } @else {
        <div class="d-flex gap-2 align-items-start flex-wrap">
          <input type="text" class="form-control" style="max-width: 320px;"
                 [placeholder]="'Serving host e.g. ' + (suggestedCustomDomain() || customDomainExample())"
                 [(ngModel)]="apexRedirectHostname"
                 [disabled]="operationBusy || customDomainBusy || apexRedirectBusy || !canSetupApexRedirect()">
          <button class="btn btn-primary" (click)="setupApexRedirect()"
                  [disabled]="operationBusy || customDomainBusy || apexRedirectBusy || !apexRedirectHostname || !canSetupApexRedirect()">
            @if (apexRedirectBusy) {
              <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
            } @else {
              <fa-icon [icon]="faGlobe" class="me-1"></fa-icon>
            }
            Set up redirect
          </button>
        </div>
      }
      <div class="hostname-part mt-4 pt-3 border-top">
        <div class="fw-bold">Move mail to this domain</div>
        <p class="small text-muted mb-2">
          Rewrites committee role mailboxes and Brevo senders from
          <code>&#64;{{ ngxMailDomain() }}</code> to <code>&#64;{{ mailDomain() }}</code>.
          Works after the site URL is already the group domain. Mail never uses a www address. Does not change member personal emails.
        </p>
        <button type="button" class="btn btn-primary"
                (click)="moveMailToCustomDomain()"
                [disabled]="operationBusy || customDomainBusy || mailMoveBusy || !mailDomain()">
          @if (mailMoveBusy) {
            <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
          }
          Move mail to {{ mailDomain() || "the group domain" }}
        </button>
        @if (notifyTarget.showAlert) {
          <div class="alert {{ notifyTarget.alert.class }} mt-3 mb-0">
            <div class="d-flex align-items-start">
              <fa-icon [icon]="notifyTarget.alert.icon" class="me-2 mt-1"></fa-icon>
              <div>
                @if (notifyTarget.alertTitle) {
                  <strong>{{ notifyTarget.alertTitle }}</strong>
                  <div class="mt-1">{{ notifyTarget.alertMessage }}</div>
                } @else {
                  {{ notifyTarget.alertMessage }}
                }
              </div>
            </div>
          </div>
        }
      </div>
      @if (apexRedirectError) {
        <p class="small text-danger mt-2 mb-0">{{ apexRedirectError }}</p>
      }
      @if (apexRedirectMessages.length > 0) {
        <div class="mt-3">
          <app-session-logs [messages]="apexRedirectMessages"></app-session-logs>
        </div>
      }
    </div>
  `
})
export class EnvironmentCustomDomains implements OnChanges {
  private logger = inject(LoggerFactory).createLogger("EnvironmentCustomDomains", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private environmentSetupService = inject(EnvironmentSetupService);
  private stringUtils = inject(StringUtilsService);
  notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  @Input({required: true}) environment: ExistingEnvironment;
  @Input() environments: ExistingEnvironment[] = [];
  @Input() hostnameHealthReport: HostnameHealthReport | null = null;
  @Input() operationBusy = false;
  @Output() environmentChanged = new EventEmitter<void>();

  customDomainHostname = "";
  customDomainBusy = false;
  probingCustomDomain = false;
  customDomainError: string | null = null;
  customDomainMessages: string[] = [];
  customDomainEligibility: CustomDomainEligibility | null = null;
  customDomainEligibilityConfirming = false;
  removingDomainHostname: string | null = null;
  checkingDomainHostname: string | null = null;
  alsoAttachWww = true;
  siteUrlPreference: SiteUrlPreference = SiteUrlPreference.APEX;
  protected readonly SiteUrlPreference = SiteUrlPreference;
  mailMoveBusy = false;
  apexRedirectHostname = "";
  apexRedirectBusy = false;
  apexRedirectError: string | null = null;
  apexRedirectMessages: string[] = [];

  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faPlus = faPlus;
  protected readonly faSpinner = faSpinner;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.hostnameHealthReport && this.hostnameHealthReport) {
      this.applySuggestedValues();
    }
  }

  customDomains(): CustomDomainEntry[] {
    return this.environment?.customDomains || [];
  }

  domainRowServing(domain: CustomDomainEntry): boolean {
    return this.hostnameStatuses().some(hostname =>
      hostname.hostname === domain.hostname && hostname.health === HostnameHealth.SERVING);
  }

  domainBadge(domain: CustomDomainEntry): string {
    if (this.domainRowServing(domain)) {
      return domainBadgeClass(CustomDomainStatus.ATTACHED);
    } else {
      return domainBadgeClass(domain.status);
    }
  }

  domainLabel(domain: CustomDomainEntry): string {
    if (this.domainRowServing(domain)) {
      return "Serving";
    } else {
      return domainStatusLabel(domain.status);
    }
  }

  hostnameStatuses(): HostnameStatus[] {
    return this.hostnameHealthReport?.hostnames || [];
  }

  canSetupApexRedirect(): boolean {
    return this.customDomains().length > 0
      || this.hostnameStatuses().some(status =>
        status.origin === HostnameOrigin.CUSTOM_DOMAIN && status.healthy);
  }

  groupOwnedApexHost(): string | null {
    const candidates = [
      this.hostnameHealthReport?.relatedGroupSiteUrl,
      this.hostnameHealthReport?.siteUrl,
      ...this.hostnameStatuses().map(hostname => hostname.hostname),
      ...this.customDomains().map(domain => domain.hostname)
    ].filter((hostname): hostname is string => !!hostname);
    return firstGroupOwnedApex(candidates, ENVIRONMENT_SUBDOMAIN_BASE);
  }

  suggestedCustomDomain(): string | null {
    return suggestedCustomDomainHostname(this.groupOwnedApexHost(), this.hostnameHealthReport?.siteUrl);
  }

  suggestedCustomDomainAlreadyAttached(): boolean {
    const suggested = this.suggestedCustomDomain();
    return !!suggested && this.customDomains().some(domain => domain.hostname === suggested);
  }

  customDomainPlaceholder(): string {
    if (this.suggestedCustomDomain()) {
      return `e.g. ${this.suggestedCustomDomain()}`;
    } else {
      return "Hostname on the group domain";
    }
  }

  customDomainExample(): string {
    return this.suggestedCustomDomain()
      || this.groupOwnedApexHost()
      || this.environmentSubdomainHint();
  }

  shouldShowAlsoAttachWwwOption(): boolean {
    return hostnameMayHaveWwwCompanion(this.normaliseHostname(this.customDomainHostname));
  }

  attachApexHostname(): string {
    return apexHost(this.normaliseHostname(this.customDomainHostname));
  }

  ngxMailDomain(): string {
    return ngxRamblersMailDomain(this.environment?.name || "");
  }

  mailDomain(): string {
    const pair = this.switchableSiteHostPair();
    const hostname = pair?.apex
      || this.groupOwnedApexHost()
      || this.hostnameHealthReport?.siteUrl
      || this.customDomains().find(domain => !!domain.hostname)?.hostname
      || "";
    const domain = hostname ? mailDomainForSiteHost(hostname) : "";
    if (!domain || domain.endsWith(".ngx-ramblers.org.uk")) {
      return "";
    } else {
      return domain;
    }
  }

  async moveMailToCustomDomain(): Promise<void> {
    if (!this.mailDomain()) {
      return;
    } else {
      this.mailMoveBusy = true;
      this.notify.hide();
      try {
        const response = await this.environmentSetupService.moveMailToCustomDomain(this.environment.name);
        const rewritten = response.committeeRolesRewritten || 0;
        this.notify.success({
          title: "Mail moved",
          message: `${response.message}. ${this.stringUtils.pluraliseWithCount(rewritten, "committee role mailbox")} rewritten.`
        });
        this.environmentChanged.emit();
      } catch (error) {
        const detail = environmentOperationErrorDetail(error);
        this.notify.error({title: "Move mail failed", message: detail});
      } finally {
        this.mailMoveBusy = false;
      }
    }
  }

  switchableSiteHostPair(): {apex: string; www: string} | null {
    const hosts = [
      ...this.customDomains().map(domain => domain.hostname),
      ...this.hostnameStatuses().map(status => status.hostname)
    ];
    const apex = hosts.map(host => apexHost(host)).find(host => !!host && hosts.includes(host) && hosts.includes(`www.${host}`));
    if (apex) {
      return {apex, www: `www.${apex}`};
    } else {
      return null;
    }
  }

  onCustomDomainHostnameChange(): void {
    if (this.customDomainEligibilityConfirming) {
      this.cancelCustomDomainEligibility();
    }
  }

  cancelCustomDomainEligibility(): void {
    this.customDomainEligibilityConfirming = false;
    this.customDomainEligibility = null;
  }

  async addCustomDomain(): Promise<void> {
    if (!this.environment) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment first" });
    } else {
      const hostname = this.normaliseHostname(this.customDomainHostname);
      if (!hostname) {
        this.customDomainError = "Enter a hostname to add";
      } else {
        await this.probeThenAttachCustomDomain(hostname);
      }
    }
  }

  async confirmCustomDomainEligibility(): Promise<void> {
    const hostname = this.normaliseHostname(this.customDomainHostname);
    this.customDomainEligibilityConfirming = false;
    this.customDomainEligibility = null;
    if (hostname && this.environment) {
      this.customDomainBusy = true;
      this.customDomainError = null;
      try {
        await this.attachCustomDomainQueue(hostname);
      } finally {
        this.customDomainBusy = false;
      }
    }
  }

  async removeCustomDomain(domain: CustomDomainEntry): Promise<void> {
    if (this.environment) {
      this.customDomainBusy = true;
      this.removingDomainHostname = domain.hostname;
      this.customDomainError = null;
      this.customDomainMessages = [`Removing custom domain: ${domain.hostname}`];
      try {
        const response = await this.environmentSetupService.removeCustomDomain(this.environment.name, domain.hostname);
        if (response.success) {
          this.appendLogs(response.logs, response.message || `Custom domain ${domain.hostname} removed`);
          this.environmentChanged.emit();
        } else {
          this.customDomainError = response.message || "Custom domain remove failed";
          this.appendLogs(response.logs, `Error: ${this.customDomainError}`);
        }
      } catch (error) {
        this.customDomainError = environmentOperationErrorDetail(error);
        this.appendLogs(error?.error?.logs, `Error: ${this.customDomainError}`);
        this.logger.error("Remove custom domain failed:", error);
      } finally {
        this.customDomainBusy = false;
        this.removingDomainHostname = null;
      }
    }
  }

  async checkCustomDomain(domain: CustomDomainEntry): Promise<void> {
    if (this.environment) {
      this.customDomainBusy = true;
      this.checkingDomainHostname = domain.hostname;
      this.customDomainError = null;
      this.customDomainMessages = [`Checking custom domain: ${domain.hostname}`];
      try {
        const response = await this.environmentSetupService.checkCustomDomain(this.environment.name, domain.hostname);
        if (response.success) {
          this.appendLogs(response.logs, response.message || `Status checked for ${domain.hostname}`);
          this.environmentChanged.emit();
        } else {
          this.customDomainError = response.message || "Status check failed";
          this.appendLogs(response.logs, `Error: ${this.customDomainError}`);
        }
      } catch (error) {
        this.customDomainError = environmentOperationErrorDetail(error);
        this.appendLogs(error?.error?.logs, `Error: ${this.customDomainError}`);
        this.logger.error("Check custom domain failed:", error);
      } finally {
        this.customDomainBusy = false;
        this.checkingDomainHostname = null;
      }
    }
  }

  async setupApexRedirect(hostnameInput?: string): Promise<void> {
    if (!this.environment) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment first" });
    } else {
      const hostname = this.normaliseHostname(hostnameInput || this.apexRedirectHostname);
      if (!hostname) {
        this.apexRedirectError = "Enter the hostname the site is served on";
      } else {
        this.apexRedirectBusy = true;
        this.apexRedirectError = null;
        this.apexRedirectMessages = [`Setting up apex/www redirect for ${hostname}`];
        try {
          const response = await this.environmentSetupService.setupApexRedirect(this.environment.name, hostname);
          if (response.success) {
            this.apexRedirectMessages = response.logs?.length
              ? [...this.apexRedirectMessages, ...response.logs]
              : [...this.apexRedirectMessages, response.message];
            this.environmentChanged.emit();
          } else {
            this.apexRedirectError = response.message || "Apex redirect setup failed";
            if (response.logs?.length) {
              this.apexRedirectMessages = [...this.apexRedirectMessages, ...response.logs];
            }
          }
        } catch (error) {
          this.apexRedirectError = environmentOperationErrorDetail(error);
          this.apexRedirectMessages = [...this.apexRedirectMessages, `Error: ${this.apexRedirectError}`];
          this.logger.error("Apex redirect setup failed:", error);
        } finally {
          this.apexRedirectBusy = false;
        }
      }
    }
  }

  async removeApexRedirect(hostname: HostnameStatus): Promise<void> {
    if (!this.environment) {
      this.notify.warning({ title: "No Environment Selected", message: "Please select an environment first" });
    } else {
      this.apexRedirectBusy = true;
      this.apexRedirectError = null;
      this.apexRedirectMessages = [`Removing redirect for ${hostname.hostname}`];
      try {
        const response = await this.environmentSetupService.removeApexRedirect(this.environment.name, hostname.hostname);
        if (response.success) {
          this.apexRedirectMessages = response.logs?.length
            ? [...this.apexRedirectMessages, ...response.logs]
            : [...this.apexRedirectMessages, response.message];
          this.environmentChanged.emit();
        } else {
          this.apexRedirectError = response.message || "Redirect removal failed";
          if (response.logs?.length) {
            this.apexRedirectMessages = [...this.apexRedirectMessages, ...response.logs];
          }
        }
      } catch (error) {
        this.apexRedirectError = environmentOperationErrorDetail(error);
        this.apexRedirectMessages = [...this.apexRedirectMessages, `Error: ${this.apexRedirectError}`];
        this.logger.error("Redirect removal failed:", error);
      } finally {
        this.apexRedirectBusy = false;
      }
    }
  }

  applySuggestedValues(): void {
    this.apexRedirectHostname = this.suggestedApexRedirectHostname();
    const suggested = this.suggestedCustomDomain();
    if (!this.customDomainHostname && suggested && !this.suggestedCustomDomainAlreadyAttached()) {
      this.customDomainHostname = suggested;
    }
  }

  get busy(): boolean {
    return this.customDomainBusy || this.apexRedirectBusy;
  }

  private environmentSubdomainHint(): string {
    const fromHealth = this.hostnameStatuses().find(hostname => hostname.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN);
    if (fromHealth) {
      return fromHealth.hostname;
    } else if (this.environment) {
      return `${this.environment.name}.ngx-ramblers.org.uk`;
    } else {
      return "your-env.ngx-ramblers.org.uk";
    }
  }

  private suggestedApexRedirectHostname(): string {
    const serving = this.hostnameStatuses().find(hostname => hostname.health === HostnameHealth.SERVING);
    const attached = this.customDomains().find(domain => domain.status === CustomDomainStatus.ATTACHED);
    return serving?.hostname || attached?.hostname || "";
  }

  private async probeThenAttachCustomDomain(hostname: string): Promise<void> {
    if (this.environment) {
      this.customDomainBusy = true;
      this.probingCustomDomain = true;
      this.customDomainError = null;
      this.customDomainEligibility = null;
      this.customDomainEligibilityConfirming = false;
      this.customDomainMessages = [`Checking whether this Cloudflare account manages ${hostname}`];
      try {
        const response = await this.environmentSetupService.probeCustomDomain(this.environment.name, hostname);
        if (response.success && response.eligibility?.managedByThisAccount) {
          this.probingCustomDomain = false;
          await this.attachCustomDomainQueue(hostname);
        } else if (response.success && response.eligibility) {
          this.customDomainEligibility = response.eligibility;
          this.customDomainEligibilityConfirming = true;
          this.customDomainMessages = [];
        } else {
          this.customDomainError = response.message || "Could not check whether this Cloudflare account manages that hostname";
        }
      } catch (error) {
        this.customDomainError = environmentOperationErrorDetail(error);
        this.logger.error("Probe custom domain failed:", error);
      } finally {
        this.probingCustomDomain = false;
        this.customDomainBusy = false;
      }
    }
  }

  private async attachCustomDomainQueue(hostname: string): Promise<void> {
    if (this.environment) {
      this.customDomainMessages = [`Attaching custom domain: ${hostname}`];
      const queue = [hostname];
      if (this.alsoAttachWww && hostnameMayHaveWwwCompanion(hostname)) {
        queue.push(`www.${hostname}`);
      }
      try {
        for (const target of queue) {
          if (target !== hostname) {
            this.customDomainMessages.push(`Attaching companion domain: ${target}`);
          }
          const response = await this.environmentSetupService.addCustomDomain(this.environment.name, target, this.siteUrlPreference);
          if (response.success) {
            this.appendLogs(response.logs, response.message || `Custom domain ${response.hostname} attached`);
          } else {
            this.customDomainError = response.message || "Custom domain add failed";
            this.appendLogs(response.logs, `Error: ${this.customDomainError}`);
            break;
          }
        }
        if (!this.customDomainError) {
          this.customDomainHostname = "";
        }
        this.environmentChanged.emit();
      } catch (error) {
        this.customDomainError = environmentOperationErrorDetail(error);
        this.appendLogs(error?.error?.logs, `Error: ${this.customDomainError}`);
        this.logger.error("Add custom domain failed:", error);
      }
    }
  }

  private normaliseHostname(input: string | null | undefined): string {
    return (input || "").trim().toLowerCase().replace(/\.$/, "").replace(/^https?:\/\//, "");
  }

  private appendLogs(logs: string[] | undefined, fallback: string): void {
    if (logs && logs.length > 0) {
      this.customDomainMessages = [...this.customDomainMessages, ...logs];
    } else {
      this.customDomainMessages = [...this.customDomainMessages, fallback];
    }
  }

}
