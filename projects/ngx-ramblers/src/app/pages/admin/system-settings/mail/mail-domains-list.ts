import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MailService } from "../../../../services/mail/mail.service";
import { apexHost } from "../../../../functions/hosts";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { BrevoDomainConfiguration, DomainAuthenticationResult, SwitchSendingDomainResponse } from "../../../../models/mail.model";
import { EmailAuthRecordsStatus, MxRecordStatus } from "../../../../models/cloudflare-email-routing.model";
import { StringUtilsService } from "../../../../services/string-utils.service";
import {
  faCheck,
  faClose,
  faEnvelope,
  faExclamationTriangle,
  faPlus,
  faShieldAlt,
  faSpinner,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { BrevoButtonComponent } from "../../../../modules/common/third-parties/brevo-button";
import { SessionLogsComponent } from "../../../../shared/components/session-logs";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-mail-domains-list",
  template: `
    <div class="thumbnail-heading-frame">
      <div class="thumbnail-heading">Domain Management</div>
      <div class="col-sm-12">
        @if (domainMismatch()) {
          <div class="row mb-3">
            <div class="col-md-12">
              <div class="alert alert-warning mb-2">
                <div class="d-flex align-items-start gap-3">
                  <fa-icon [icon]="faExclamationTriangle" class="mt-1"></fa-icon>
                  <div class="flex-grow-1">
                    <strong>Sending domain does not match site URL.</strong>
                    Brevo is authenticated for <code>{{ baseDomain }}</code> but this site's canonical URL is <code>{{ canonicalHost }}</code>.
                    Switching will re-authenticate <code>{{ canonicalHost }}</code> in Brevo, create the required DKIM/SPF records in Cloudflare, and rewrite every sender from <code>&#64;{{ baseDomain }}</code> to <code>&#64;{{ canonicalHost }}</code>.
                  </div>
                  <button class="btn btn-danger" [disabled]="switching" (click)="switchSendingDomain()"
                          tooltip="Re-authenticate Brevo and rewrite senders">
                    @if (switching) {
                      <fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>Switching...
                    } @else {
                      Switch sending domain to {{ canonicalHost }}
                    }
                  </button>
                </div>
              </div>
              @if (switchError) {
                <div class="alert alert-danger mb-2">
                  <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>{{ switchError }}
                </div>
              }
              @if (switchResult) {
                <div class="alert alert-success mb-2">
                  <fa-icon [icon]="faCheck" class="me-2"></fa-icon>
                  <strong>Done.</strong>
                  Rewrote {{ switchResult.rewrite.rewritten.length }},
                  skipped {{ switchResult.rewrite.skipped.length }},
                  failed {{ switchResult.rewrite.failed.length }}.
                </div>
              }
              @if (switchLogs.length) {
                <app-session-logs [messages]="switchLogs"></app-session-logs>
              }
            </div>
          </div>
        }
        @if (baseDomain) {
          <div class="row mb-3">
            <div class="col-md-12">
              <div class="d-flex align-items-center gap-3 p-2 border rounded bg-light">
                <fa-icon [icon]="faShieldAlt" class="fa-icon"></fa-icon>
                <div class="flex-grow-1">
                  <strong>Domain:</strong> {{ baseDomain }}
                  @if (domainStatus) {
                    @if (domainStatus.authenticated && domainStatus.verified) {
                      <span class="badge bg-success ms-2">Authenticated</span>
                    } @else if (domainStatus.authenticated) {
                      <span class="badge bg-warning ms-2">Authenticated (not verified)</span>
                    } @else {
                      <span class="badge bg-danger ms-2">Not authenticated</span>
                    }
                  } @else if (!domainAuthenticating) {
                    <span class="badge bg-secondary ms-2">Not registered</span>
                  }
                </div>
                <app-brevo-button button title="Authenticate Domain"
                                  [loading]="domainAuthenticating"
                                  [disabled]="domainAuthenticating || (domainStatus?.authenticated && domainStatus?.verified)"
                                  (click)="authenticateDomain()"/>
              </div>
              @if (domainAuthResult) {
                <div class="alert mt-2 mb-0" [class.alert-success]="domainAuthResult.authenticated" [class.alert-warning]="!domainAuthResult.authenticated">
                  <fa-icon [icon]="domainAuthResult.authenticated ? faCheck : faExclamationTriangle" class="me-2"></fa-icon>
                  <strong>{{ domainAuthResult.authenticated ? 'Domain Authenticated' : 'Authentication Pending' }}:</strong>
                  {{ domainAuthResult.message }}
                  @if (domainAuthResult.brevoDomainsUrl) {
                    <a [href]="domainAuthResult.brevoDomainsUrl" target="_blank" class="ms-1">Open Brevo Domains</a>
                  }
                </div>
              }
            </div>
          </div>
        }
        @if (baseDomain) {
          <div class="row mb-3">
            <div class="col-md-12">
              <div class="d-flex align-items-center gap-3 p-2 border rounded bg-light">
                <fa-icon [icon]="faShieldAlt" class="fa-icon"></fa-icon>
                <div class="flex-grow-1">
                  <strong>Email Authentication (SPF &amp; DMARC):</strong> {{ baseDomain }}
                  @if (authRecordsLoading) {
                    <fa-icon [icon]="faSpinner" animation="spin" class="ms-2"></fa-icon>
                  } @else if (authRecordsStatus) {
                    @if (authRecordsStatus.spf.allPresent) {
                      <span class="badge bg-success ms-2">SPF OK</span>
                    } @else if (authRecordsStatus.spf.multiple) {
                      <span class="badge bg-danger ms-2">SPF has multiple records</span>
                    } @else if (authRecordsStatus.spf.present) {
                      <span class="badge bg-warning ms-2">SPF missing includes</span>
                    } @else {
                      <span class="badge bg-danger ms-2">SPF absent</span>
                    }
                    @if (authRecordsStatus.dmarc.present && authRecordsStatus.dmarc.reportingConfigured) {
                      <span class="badge bg-success ms-2">DMARC {{ authRecordsStatus.dmarc.policy || "present" }}</span>
                    } @else if (authRecordsStatus.dmarc.present) {
                      <span class="badge bg-warning ms-2">DMARC missing reporting</span>
                    } @else {
                      <span class="badge bg-warning ms-2">DMARC absent</span>
                    }
                  }
                </div>
                @if (authRecordsStatus && authRecordsFixable()) {
                  <button class="btn btn-sm btn-primary text-nowrap flex-shrink-0" [disabled]="authRecordsCreating || authRecordsStatus.spf.multiple"
                          [tooltip]="authRecordsStatus.spf.multiple ? 'Consolidate multiple SPF records in Cloudflare first' : ''"
                          (click)="ensureAuthRecords()">
                    @if (authRecordsCreating) {
                      <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>Updating...
                    } @else {
                      <fa-icon [icon]="faPlus" class="me-1"></fa-icon>Fix Auth Records
                    }
                  </button>
                }
              </div>
              @if (authRecordsStatus) {
                <div class="mt-2">
                  <table class="table table-sm table-bordered mb-0">
                    <thead>
                      <tr>
                        <th style="width: 80px">Type</th>
                        <th>Expected / Current</th>
                        <th style="width: 120px" class="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>SPF</td>
                        <td class="small">
                          @if (authRecordsStatus.spf.present) {
                            <div>{{ authRecordsStatus.spf.rawContent }}</div>
                            @if (authRecordsStatus.spf.missingIncludes.length) {
                              <div class="text-danger mt-1">Missing includes: {{ authRecordsStatus.spf.missingIncludes.join(", ") }}</div>
                            }
                          } @else {
                            <span class="text-muted">No v=spf1 record on {{ baseDomain }}. Will create: v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all</span>
                          }
                        </td>
                        <td class="text-center">
                          @if (authRecordsStatus.spf.allPresent) {
                            <fa-icon [icon]="faCheck" class="text-success"></fa-icon>
                          } @else {
                            <fa-icon [icon]="faClose" class="text-danger"></fa-icon>
                          }
                        </td>
                      </tr>
                      <tr>
                        <td>DMARC</td>
                        <td class="small">
                          @if (authRecordsStatus.dmarc.present) {
                            <div>{{ authRecordsStatus.dmarc.rawContent }}</div>
                            @if (authRecordsStatus.dmarc.inherited) {
                              <div class="text-muted mt-1">Inherited from {{ authRecordsStatus.dmarc.dmarcHostname }}</div>
                            }
                            @if (!authRecordsStatus.dmarc.reportingConfigured) {
                              <div class="text-warning mt-1">Missing aggregate reporting. Will add: rua=mailto:rua&#64;dmarc.brevo.com</div>
                            }
                          } @else {
                            <span class="text-muted">No DMARC record on {{ authRecordsStatus.dmarc.dmarcHostname }}. Will create: v=DMARC1; p=none; rua=mailto:rua&#64;dmarc.brevo.com; (monitoring and aggregate reporting)</span>
                          }
                        </td>
                        <td class="text-center">
                          @if (authRecordsStatus.dmarc.present && authRecordsStatus.dmarc.reportingConfigured) {
                            <fa-icon [icon]="faCheck" class="text-success"></fa-icon>
                          } @else {
                            <fa-icon [icon]="faClose" class="text-danger"></fa-icon>
                          }
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              }
              @if (authRecordsError) {
                <div class="alert alert-danger mt-2 mb-0">
                  <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                  {{ authRecordsError }}
                </div>
              }
            </div>
          </div>
        }
        @if (baseDomain) {
          <div class="row mb-3">
            <div class="col-md-12">
              <div class="d-flex align-items-center gap-3 p-2 border rounded bg-light">
                <fa-icon [icon]="faEnvelope" class="fa-icon"></fa-icon>
                <div class="flex-grow-1">
                  <strong>MX Records:</strong> {{ baseDomain }}
                  @if (mxRecordLoading) {
                    <fa-icon [icon]="faSpinner" animation="spin" class="ms-2"></fa-icon>
                  } @else if (mxRecordStatus) {
                    @if (mxRecordStatus.allPresent) {
                      <span class="badge bg-success ms-2">All MX records present</span>
                    } @else {
                      <span class="badge bg-danger ms-2">Missing MX records</span>
                    }
                    @if (mxRecordStatus.extraRecords?.length) {
                      <span class="badge bg-warning text-dark ms-2">{{ stringUtilsService.pluraliseWithCount(mxRecordStatus.extraRecords.length, "conflicting record") }}</span>
                    }
                  }
                </div>
                @if (mxRecordStatus && !mxRecordStatus.allPresent) {
                  <button class="btn btn-sm btn-primary text-nowrap flex-shrink-0" [disabled]="mxRecordCreating" (click)="createMissingMxRecords()">
                    @if (mxRecordCreating) {
                      <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>Creating...
                    } @else {
                      <fa-icon [icon]="faPlus" class="me-1"></fa-icon>Add Missing MX Records
                    }
                  </button>
                }
              </div>
              @if (mxRecordStatus) {
                <div class="mt-2">
                  <table class="table table-sm table-bordered mb-0">
                    <thead>
                      <tr>
                        <th>MX Server</th>
                        <th style="width: 100px">Priority</th>
                        <th style="width: 80px" class="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (record of mxRecordStatus.expectedRecords; track record.content) {
                        <tr>
                          <td class="small">{{ record.content }}</td>
                          <td>{{ record.priority }}</td>
                          <td class="text-center">
                            @if (record.exists) {
                              <fa-icon [icon]="faCheck" class="text-success"></fa-icon>
                            } @else {
                              <fa-icon [icon]="faClose" class="text-danger"></fa-icon>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                @if (mxRecordStatus.extraRecords?.length) {
                  <div class="mt-2">
                    <div class="small text-muted mb-1">
                      The following MX records are present on {{ baseDomain }} but are not part of Cloudflare email routing. They will conflict with inbound delivery and should be removed unless intentional.
                    </div>
                    <table class="table table-sm table-bordered mb-0">
                      <thead>
                        <tr>
                          <th>MX Server</th>
                          <th style="width: 100px">Priority</th>
                          <th style="width: 110px" class="text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (record of mxRecordStatus.extraRecords; track record.id) {
                          <tr>
                            <td class="small">{{ record.content }}</td>
                            <td>{{ record.priority ?? "" }}</td>
                            <td class="text-center">
                              <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-danger"
                                        tooltip="Delete MX record"
                                        [disabled]="mxRecordDeletingId === record.id"
                                        (click)="deleteExtraMxRecord(record.id)">
                                  @if (mxRecordDeletingId === record.id) {
                                    <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
                                  } @else {
                                    <fa-icon [icon]="faTrash"></fa-icon>
                                  }
                                </button>
                              </div>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              }
              @if (mxRecordError) {
                <div class="alert alert-danger mt-2 mb-0">
                  <fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>
                  {{ mxRecordError }}
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>`,
  imports: [FontAwesomeModule, BrevoButtonComponent, SessionLogsComponent, TooltipDirective]
})
export class MailDomainsListComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("MailDomainsListComponent", NgxLoggerLevel.ERROR);
  private mailService = inject(MailService);
  private cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  protected stringUtilsService = inject(StringUtilsService);
  private mailMessagingService = inject(MailMessagingService);
  private subscriptions: Subscription[] = [];
  public baseDomain: string;
  public domainStatus: BrevoDomainConfiguration | null = null;
  public domainAuthenticating = false;
  public domainAuthResult: DomainAuthenticationResult | null = null;
  public mxRecordStatus: MxRecordStatus | null = null;
  public mxRecordLoading = false;
  public mxRecordCreating = false;
  public mxRecordDeletingId: string | null = null;
  public mxRecordError: string | null = null;
  public authRecordsStatus: EmailAuthRecordsStatus | null = null;
  public authRecordsLoading = false;
  public authRecordsCreating = false;
  public authRecordsError: string | null = null;
  public canonicalHost: string;
  public switching = false;
  public switchLogs: string[] = [];
  public switchError: string;
  public switchResult: SwitchSendingDomainResponse | null = null;

  protected readonly faCheck = faCheck;
  protected readonly faClose = faClose;
  protected readonly faEnvelope = faEnvelope;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faPlus = faPlus;
  protected readonly faShieldAlt = faShieldAlt;
  protected readonly faSpinner = faSpinner;
  protected readonly faTrash = faTrash;

  async ngOnInit() {
    this.subscriptions.push(
      this.mailMessagingService.events().subscribe(async mailMessagingConfig => {
        this.canonicalHost = this.hostOf(mailMessagingConfig?.group?.href);
        if (mailMessagingConfig.brevo.accountError) {
          this.logger.info("Brevo account not configured — skipping domain status");
          return;
        }
        try {
          const config = await this.cloudflareEmailRoutingService.queryCloudflareConfig();
          this.baseDomain = config?.baseDomain;
          if (this.baseDomain) {
            await this.loadDomainStatus();
            await this.loadMxRecordStatus();
            await this.loadAuthRecordsStatus();
          }
        } catch (err) {
          this.logger.warn("Could not load cloudflare config for domain validation:", err);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private hostOf(urlOrHost: string | undefined): string {
    const trimmed = (urlOrHost || "").trim();
    if (!trimmed) return "";
    try {
      return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).host.toLowerCase();
    } catch {
      return trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
    }
  }

  domainMismatch(): boolean {
    return !!(this.canonicalHost && this.baseDomain && apexHost(this.canonicalHost) !== apexHost(this.baseDomain));
  }

  async switchSendingDomain(): Promise<void> {
    if (!this.domainMismatch()) return;
    this.switching = true;
    this.switchError = null;
    this.switchResult = null;
    this.switchLogs = [`Switching sending domain from ${this.baseDomain} to ${this.canonicalHost}...`];
    try {
      const result = await this.mailService.switchSendingDomain({
        newHostname: this.canonicalHost,
        oldHostname: this.baseDomain,
        rewriteSenders: true
      });
      this.switchResult = result;
      if (result?.logs?.length) {
        this.switchLogs = [...this.switchLogs, ...result.logs];
      }
      this.baseDomain = this.canonicalHost;
      await this.loadDomainStatus();
      await this.loadMxRecordStatus();
      await this.loadAuthRecordsStatus();
    } catch (error) {
      this.switchError = this.stringUtilsService.stringify(error);
      this.logger.error("Failed to switch sending domain:", error);
      const errorLogs = error?.error?.logs as string[] | undefined;
      if (errorLogs?.length) {
        this.switchLogs = [...this.switchLogs, ...errorLogs];
      }
      this.switchLogs = [...this.switchLogs, `Error: ${this.switchError}`];
    } finally {
      this.switching = false;
    }
  }

  async authenticateDomain(): Promise<void> {
    this.domainAuthenticating = true;
    this.domainAuthResult = null;
    try {
      this.domainAuthResult = await this.mailService.authenticateDomain(this.baseDomain);
      await this.loadDomainStatus();
    } catch (error) {
      this.logger.error("Failed to authenticate domain:", error);
      this.stringUtilsService.stringify(error);
    } finally {
      this.domainAuthenticating = false;
    }
  }

  private async loadDomainStatus(): Promise<void> {
    try {
      this.domainStatus = await this.mailService.domainConfiguration(this.baseDomain);
    } catch (err) {
      this.logger.warn("Could not load domain status:", err);
      this.domainStatus = null;
    }
  }

  private async loadMxRecordStatus(): Promise<void> {
    this.mxRecordLoading = true;
    this.mxRecordError = null;
    try {
      this.mxRecordStatus = await this.cloudflareEmailRoutingService.queryMxRecordStatus();
      this.logger.info("MX record status:", this.mxRecordStatus);
    } catch (err) {
      this.logger.warn("Could not load MX record status:", err);
      this.mxRecordError = this.stringUtilsService.stringify(err);
    } finally {
      this.mxRecordLoading = false;
    }
  }

  async createMissingMxRecords(): Promise<void> {
    this.mxRecordCreating = true;
    this.mxRecordError = null;
    try {
      this.mxRecordStatus = await this.cloudflareEmailRoutingService.createMissingMxRecords();
      this.logger.info("MX records created, status:", this.mxRecordStatus);
    } catch (err) {
      this.logger.error("Failed to create MX records:", err);
      this.mxRecordError = this.stringUtilsService.stringify(err);
    } finally {
      this.mxRecordCreating = false;
    }
  }

  async deleteExtraMxRecord(recordId: string): Promise<void> {
    this.mxRecordDeletingId = recordId;
    this.mxRecordError = null;
    try {
      this.mxRecordStatus = await this.cloudflareEmailRoutingService.deleteMxRecord(recordId);
      this.logger.info("MX record deleted, status:", this.mxRecordStatus);
    } catch (err) {
      this.logger.error("Failed to delete MX record:", err);
      this.mxRecordError = this.stringUtilsService.stringify(err);
    } finally {
      this.mxRecordDeletingId = null;
    }
  }

  private async loadAuthRecordsStatus(): Promise<void> {
    this.authRecordsLoading = true;
    this.authRecordsError = null;
    try {
      this.authRecordsStatus = await this.cloudflareEmailRoutingService.queryEmailAuthRecords();
      this.logger.info("Email auth records status:", this.authRecordsStatus);
    } catch (err) {
      this.logger.warn("Could not load email auth records status:", err);
      this.authRecordsError = this.stringUtilsService.stringify(err);
    } finally {
      this.authRecordsLoading = false;
    }
  }

  authRecordsFixable(): boolean {
    const status = this.authRecordsStatus;
    if (!status) return false;
    return !status.spf.allPresent || !status.dmarc.present || !status.dmarc.reportingConfigured;
  }

  async ensureAuthRecords(): Promise<void> {
    this.authRecordsCreating = true;
    this.authRecordsError = null;
    try {
      this.authRecordsStatus = await this.cloudflareEmailRoutingService.ensureEmailAuthRecords();
      this.logger.info("Email auth records ensured, status:", this.authRecordsStatus);
    } catch (err) {
      this.logger.error("Failed to ensure email auth records:", err);
      this.authRecordsError = this.stringUtilsService.stringify(err);
    } finally {
      this.authRecordsCreating = false;
    }
  }
}
