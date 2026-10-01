import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MailService } from "../../../../services/mail/mail.service";
import { MailLinkService } from "../../../../services/mail/mail-link.service";
import { apexHost } from "../../../../functions/hosts";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { BrevoDomainConfiguration, DomainAuthenticationResult, SwitchSendingDomainResponse } from "../../../../models/mail.model";
import {
  EmailAuthRecordsStatus,
  MailAuthNoteTone,
  MailAuthRecordType,
  MailAuthTableRow,
  MxRecordStatus
} from "../../../../models/cloudflare-email-routing.model";
import { SortableTableComponent } from "../../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableAlignment, SortableTableColumn, SortableTableSortState } from "../../../../modules/common/sortable-table/sortable-table.model";
import { SortDirection } from "../../../../models/sort.model";
import { ASCENDING, DESCENDING } from "../../../../models/table-filtering.model";
import { StoredValue } from "../../../../models/ui-actions";
import { StringUtilsService } from "../../../../services/string-utils.service";
import {
  faCheck,
  faClose,
  faExclamationTriangle,
  faPlus,
  faShieldAlt,
  faSpinner
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { BrevoButtonComponent } from "../../../../modules/common/third-parties/brevo-button";
import { SessionLogsComponent } from "../../../../shared/components/session-logs";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { MailMxRecords } from "./mail-mx-records";

@Component({
  selector: "app-mail-domains-list",
  styles: [`
    :host
      display: block

    :host ::ng-deep .sortable-table-card
      overflow-x: auto

    :host ::ng-deep .sortable-table td
      word-break: normal
      overflow-wrap: break-word
  `],
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
                    Switching will re-authenticate the apex domain in Brevo, rewrite senders, and rewrite committee role mailboxes from <code>&#64;{{ baseDomain }}</code> to that domain. Mail never uses www.
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
                  @if (domainAuthResult.brevoDomainsUrl && mailLinkService.canNavigateToBrevo) {
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
                  } @else if (authRecordsStatus?.spf && authRecordsStatus?.dmarc) {
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
                <div class="d-flex flex-wrap gap-2 flex-shrink-0">
                  @if (authRecordsStatus?.spf && authRecordsFixable()) {
                    <button class="btn btn-primary text-nowrap" [disabled]="authRecordsCreating || authRecordsTrimming || authRecordsStatus.spf.multiple"
                            [tooltip]="authRecordsStatus.spf.multiple ? 'Consolidate multiple SPF records in Cloudflare first' : ''"
                            (click)="ensureAuthRecords()">
                      @if (authRecordsCreating) {
                        <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>Updating...
                      } @else {
                        <fa-icon [icon]="faPlus" class="me-1"></fa-icon>Fix Auth Records
                      }
                    </button>
                  }
                  @if (authRecordsStatus?.spf?.extraIncludes?.length) {
                    <button class="btn btn-quiet text-nowrap" [disabled]="authRecordsCreating || authRecordsTrimming || !!authRecordsStatus.spf?.multiple"
                            (click)="trimLeftoverSpfIncludes()">
                      @if (authRecordsTrimming) {
                        <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>Removing leftover includes...
                      } @else {
                        Remove leftover SPF includes
                      }
                    </button>
                  }
                </div>
              </div>
              @if (authRecordsStatus) {
                <div class="mt-2">
                  <app-sortable-table
                    [columns]="authColumns"
                    [rows]="authRows()"
                    [defaultSortKey]="authSortKey"
                    [defaultSortDirection]="authSortDirection"
                    [trackBy]="trackAuthRow"
                    (sortChange)="onAuthSortChange($event)"
                    emptyMessage="No authentication records to show.">
                    <ng-template appSortableTableCell="type" let-row>
                      {{ row.type }}
                    </ng-template>
                    <ng-template appSortableTableCell="detail" let-row>
                      <div>{{ row.detail }}</div>
                      @if (row.note) {
                        <div class="mt-1" [class]="noteClass(row)">{{ row.note }}</div>
                      }
                    </ng-template>
                    <ng-template appSortableTableCell="status" let-row>
                      @if (row.ok) {
                        <fa-icon [icon]="faCheck" class="text-success"></fa-icon>
                      } @else {
                        <fa-icon [icon]="faClose" class="text-danger"></fa-icon>
                      }
                    </ng-template>
                  </app-sortable-table>
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
          <app-mail-mx-records
            [domain]="baseDomain"
            [status]="mxRecordStatus"
            [loading]="mxRecordLoading"
            [creating]="mxRecordCreating"
            [deletingId]="mxRecordDeletingId"
            [error]="mxRecordError"
            allowMutate
            (addMissing)="createMissingMxRecords()"
            (deleteExtra)="deleteExtraMxRecord($event.id)"/>
        }
      </div>
    </div>`,
  imports: [FontAwesomeModule, BrevoButtonComponent, SessionLogsComponent, TooltipDirective, MailMxRecords, SortableTableComponent, SortableTableCellDirective]
})
export class MailDomainsListComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("MailDomainsListComponent", NgxLoggerLevel.ERROR);
  private mailService = inject(MailService);
  protected mailLinkService = inject(MailLinkService);
  private cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  protected stringUtilsService = inject(StringUtilsService);
  private mailMessagingService = inject(MailMessagingService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
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
  public authRecordsTrimming = false;
  public authRecordsError: string | null = null;
  public canonicalHost: string;
  public switching = false;
  public switchLogs: string[] = [];
  public switchError: string;
  public switchResult: SwitchSendingDomainResponse | null = null;

  protected readonly faCheck = faCheck;
  protected readonly faClose = faClose;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faPlus = faPlus;
  protected readonly faShieldAlt = faShieldAlt;
  protected readonly faSpinner = faSpinner;
  protected readonly MailAuthNoteTone = MailAuthNoteTone;
  authSortKey = "type";
  authSortDirection = ASCENDING;
  authColumns: SortableTableColumn<MailAuthTableRow>[] = [
    {key: "type", label: "Type", sortKey: "type", cellClass: "nowrap"},
    {key: "detail", label: "Expected / Current"},
    {key: "status", label: "Status", sortKey: "ok", align: SortableTableAlignment.CENTER}
  ];

  constructor() {
    const params = this.activatedRoute.snapshot.queryParams;
    this.authSortKey = params[StoredValue.MAIL_AUTH_SORT] || "type";
    this.authSortDirection = params[StoredValue.MAIL_AUTH_SORT_ORDER] === SortDirection.DESC ? DESCENDING : ASCENDING;
  }

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
    if (!status?.spf || !status?.dmarc) {
      return false;
    } else {
      return !status.spf.allPresent || !status.dmarc.present || !status.dmarc.reportingConfigured;
    }
  }

  authRows(): MailAuthTableRow[] {
    const status = this.authRecordsStatus;
    if (!status?.spf || !status?.dmarc) {
      return [];
    } else {
      return [this.spfRow(status), this.dmarcRow(status)];
    }
  }

  trackAuthRow(_index: number, row: MailAuthTableRow): string {
    return row.type;
  }

  noteClass(row: MailAuthTableRow): string {
    if (row.noteTone === MailAuthNoteTone.DANGER) {
      return "text-danger";
    } else if (row.noteTone === MailAuthNoteTone.WARNING) {
      return "text-warning";
    } else if (row.noteTone === MailAuthNoteTone.MUTED) {
      return "text-muted";
    } else {
      return "";
    }
  }

  onAuthSortChange(sortState: SortableTableSortState): void {
    this.authSortKey = sortState.key || "type";
    this.authSortDirection = sortState.direction;
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        [StoredValue.MAIL_AUTH_SORT]: this.authSortKey,
        [StoredValue.MAIL_AUTH_SORT_ORDER]: this.authSortDirection === DESCENDING ? SortDirection.DESC : SortDirection.ASC
      },
      queryParamsHandling: "merge"
    });
  }

  private spfRow(status: EmailAuthRecordsStatus): MailAuthTableRow {
    if (status.spf.present) {
      return {
        type: MailAuthRecordType.SPF,
        detail: status.spf.rawContent || "",
        note: status.spf.missingIncludes.length
          ? `Missing includes: ${status.spf.missingIncludes.join(", ")}`
          : (status.spf.extraIncludes.length ? `Leftover includes: ${status.spf.extraIncludes.join(", ")}` : null),
        noteTone: status.spf.missingIncludes.length
          ? MailAuthNoteTone.DANGER
          : (status.spf.extraIncludes.length ? MailAuthNoteTone.WARNING : MailAuthNoteTone.NONE),
        ok: status.spf.allPresent
      };
    } else {
      return {
        type: MailAuthRecordType.SPF,
        detail: `No v=spf1 record on ${this.baseDomain}. Will create: v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all`,
        note: null,
        noteTone: MailAuthNoteTone.NONE,
        ok: false
      };
    }
  }

  private dmarcRow(status: EmailAuthRecordsStatus): MailAuthTableRow {
    if (status.dmarc.present) {
      const notes = [
        status.dmarc.inherited ? `Inherited from ${status.dmarc.dmarcHostname}` : null,
        status.dmarc.reportingConfigured ? null : "Aggregate reporting must go to rua@dmarc.brevo.com. Will replace local rua/ruf mailboxes and set rua=mailto:rua@dmarc.brevo.com"
      ].filter(Boolean);
      return {
        type: MailAuthRecordType.DMARC,
        detail: status.dmarc.rawContent || "",
        note: notes.length ? notes.join(" ") : null,
        noteTone: status.dmarc.reportingConfigured ? MailAuthNoteTone.MUTED : MailAuthNoteTone.WARNING,
        ok: status.dmarc.reportingConfigured
      };
    } else {
      return {
        type: MailAuthRecordType.DMARC,
        detail: `No DMARC record on ${status.dmarc.dmarcHostname}. Will create: v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com; (monitoring and aggregate reporting)`,
        note: null,
        noteTone: MailAuthNoteTone.NONE,
        ok: false
      };
    }
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

  async trimLeftoverSpfIncludes(): Promise<void> {
    this.authRecordsTrimming = true;
    this.authRecordsError = null;
    try {
      this.authRecordsStatus = await this.cloudflareEmailRoutingService.trimLeftoverSpfIncludes();
      this.logger.info("Leftover SPF includes removed, status:", this.authRecordsStatus);
    } catch (err) {
      this.logger.error("Failed to remove leftover SPF includes:", err);
      this.authRecordsError = this.stringUtilsService.stringify(err);
    } finally {
      this.authRecordsTrimming = false;
    }
  }
}
