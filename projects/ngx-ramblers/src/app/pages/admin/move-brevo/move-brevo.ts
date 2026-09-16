import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck, faCircleExclamation, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { firstValueFrom } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { PageComponent } from "../../../page/page.component";
import { EnvironmentSelectComponent } from "../../../modules/common/selectors/environment-select";
import { SecretInputComponent } from "../../../modules/common/secret-input/secret-input.component";
import { VendorBrandMarkComponent } from "../../../modules/common/vendor-brand-mark/vendor-brand-mark.component";
import { MoveBrevoService } from "../../../services/move-brevo.service";
import { BackupAndRestoreService } from "../../../services/backup-and-restore.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MoveBrevoRequest, MoveBrevoResult, MoveBrevoStatus } from "../../../models/move-brevo.model";
import { BrevoDnsRecord } from "../../../models/mail.model";
import { EnvironmentInfo } from "../../../models/backup-session.model";
import { InputSize } from "../../../models/ui-size.model";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 1200;

@Component({
  selector: "app-move-brevo",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    PageComponent,
    EnvironmentSelectComponent,
    SecretInputComponent,
    VendorBrandMarkComponent
  ],
  template: `
    <app-page>
      <div class="row">
        <div class="col-12">
          <h1>Move Brevo</h1>
          <p>Propagate sending domain, senders, lists, contacts and the events webhook to a destination Brevo account. Committee Settings and Mail Settings stay the editors.</p>
        </div>
      </div>
      <div class="row">
        <div class="col-md-6 mb-3">
          <app-environment-select
            label="Environment"
            [items]="environments"
            [(selectedName)]="request.environment"
            placeholder="Select environment..."></app-environment-select>
        </div>
        <div class="col-md-6 mb-3">
          <label class="form-label" for="confirm-environment">Type the environment name to confirm</label>
          <input id="confirm-environment" class="form-control" name="confirmEnvironment"
                 [(ngModel)]="request.confirmEnvironment" (ngModelChange)="invalidatePlan()" autocomplete="off">
        </div>
        <div class="col-md-6 mb-3">
          <label class="form-label" for="destination-api-key">Destination Brevo API key</label>
          <app-secret-input [(ngModel)]="request.destinationApiKey"
                            (ngModelChange)="invalidatePlan()"
                            name="destinationApiKey"
                            id="destination-api-key"
                            [size]="InputSize.SM"
                            autocomplete="off">
          </app-secret-input>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-12">
          <button class="btn btn-quiet me-2" type="button" (click)="plan()" [disabled]="busy || jobRunning || !formReady()">
            @if (busy) {
              <fa-icon [icon]="faSpinner" animation="spin" class="me-1"/>
            }
            Validate Plan
          </button>
          <button class="btn btn-primary" type="button" (click)="execute()" [disabled]="!canPropagate()">
            @if (jobRunning) {
              <fa-icon [icon]="faSpinner" animation="spin" class="me-1"/>
            }
            Propagate
          </button>
        </div>
      </div>
      @if (error) {
        <div class="alert alert-danger d-flex align-items-start">
          <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
          <div>
            <strong>Move Brevo failed</strong>
            <div>{{ error }}</div>
            @if (result?.membersUpdated?.length) {
              <div class="mt-2"><strong>Members already updated to the destination account:</strong></div>
              <ul class="mb-0">
                @for (member of result.membersUpdated; track member.memberId) {
                  <li>{{ member.email }}</li>
                }
              </ul>
            }
          </div>
        </div>
      }
      @if (result?.status === MoveBrevoStatus.DNS_RECORDS_REQUIRED) {
        <div class="alert alert-warning d-flex align-items-start">
          <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
          <div>
            <strong>DNS records required before the domain can be authenticated</strong>
            <div>{{ result.message }}</div>
            @for (record of dnsRecords(); track record.hostName) {
              <div class="mt-2">
                <div><strong>Type:</strong> {{ record.type }}</div>
                <div><strong>Host:</strong> <code>{{ record.hostName }}</code></div>
                <div><strong>Value:</strong> <code>{{ record.value }}</code></div>
              </div>
            }
            <div class="mt-2">Nothing was changed in the environment database. Add the records, then Validate Plan and Propagate again.</div>
          </div>
        </div>
      }
      @if (result?.status === MoveBrevoStatus.COMPLETED) {
        <div class="alert alert-success d-flex align-items-start">
          <fa-icon [icon]="faCircleCheck" class="me-2 mt-1"/>
          <div>
            <strong>Move Brevo completed</strong>
            <div>Mail Settings now use the destination account. Validate Plan again before running another move.</div>
          </div>
        </div>
      }
      @if (result) {
        <div class="thumbnail-heading-frame">
          <div class="thumbnail-heading d-flex align-items-center gap-2">
            <app-vendor-brand-mark serviceId="brevo" [sizePx]="30"/>
            <span>{{ result.dryRun ? "Plan" : result.status }} - {{ result.environment }}</span>
          </div>
          <ul>
            @for (step of result.steps; track step) {
              <li>{{ step }}</li>
            }
          </ul>
          <p><strong>Domain:</strong> {{ result.domain || "none" }}</p>
          <p><strong>Senders:</strong> {{ result.senders.length }}</p>
          <p><strong>Lists:</strong> {{ result.lists.length }}</p>
          <p><strong>Contacts:</strong> {{ result.contactCount }}</p>
          @if (result.skippedDoNotEmail > 0) {
            <p><strong>Skipped (do not email):</strong> {{ result.skippedDoNotEmail }}</p>
          }
        </div>
      }
    </app-page>
  `
})
export class MoveBrevoComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("MoveBrevoComponent", NgxLoggerLevel.ERROR);
  private moveBrevoService = inject(MoveBrevoService);
  private backupService = inject(BackupAndRestoreService);
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  environments: EnvironmentInfo[] = [];
  faSpinner = faSpinner;
  faCircleCheck = faCircleCheck;
  faCircleExclamation = faCircleExclamation;
  InputSize = InputSize;
  MoveBrevoStatus = MoveBrevoStatus;
  busy = false;
  jobRunning = false;
  planValidated = false;
  error: string | null = null;
  result: MoveBrevoResult | null = null;
  request: MoveBrevoRequest = {
    environment: "",
    destinationApiKey: "",
    confirmEnvironment: "",
    dryRun: true
  };

  async ngOnInit(): Promise<void> {
    this.logger.info("opened");
    try {
      const environments = await firstValueFrom(this.backupService.listEnvironments());
      this.environments = environments.filter(environment => environment.hasMongoConfig);
    } catch (error: any) {
      this.logger.error("Failed to load environments:", error);
      this.error = error?.message || "Failed to load environments";
    }
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }
  }

  formReady(): boolean {
    return !!(this.request.environment && this.request.confirmEnvironment && this.request.destinationApiKey);
  }

  canPropagate(): boolean {
    return this.planValidated && !this.busy && !this.jobRunning && this.formReady();
  }

  invalidatePlan(): void {
    this.planValidated = false;
  }

  dnsRecords(): BrevoDnsRecord[] {
    const records = this.result?.dnsRecords;
    return records ? [records.brevoCode, records.dkimRecord].filter(record => !!record?.hostName) : [];
  }

  plan(): void {
    this.busy = true;
    this.error = null;
    this.planValidated = false;
    this.moveBrevoService.plan({ ...this.request, dryRun: true }).subscribe({
      next: result => {
        this.result = result;
        this.busy = false;
        this.planValidated = result.status === MoveBrevoStatus.PLANNED;
      },
      error: err => {
        this.busy = false;
        this.error = this.errorMessage(err);
      }
    });
  }

  execute(): void {
    this.busy = true;
    this.jobRunning = true;
    this.planValidated = false;
    this.error = null;
    this.moveBrevoService.execute({ ...this.request, dryRun: false }).subscribe({
      next: job => {
        this.result = job;
        this.busy = false;
        this.pollJob(job.jobId, 0);
      },
      error: err => {
        this.busy = false;
        this.jobRunning = false;
        this.error = this.errorMessage(err);
      }
    });
  }

  private pollJob(jobId: string, attempt: number): void {
    this.pollTimer = setTimeout(async () => {
      try {
        const job = await firstValueFrom(this.moveBrevoService.job(jobId));
        this.result = job;
        if (job.status === MoveBrevoStatus.RUNNING && attempt < MAX_POLL_ATTEMPTS) {
          this.pollJob(jobId, attempt + 1);
        } else if (job.status === MoveBrevoStatus.RUNNING) {
          this.jobRunning = false;
          this.error = "Move Brevo is still running on the server; reload this page later to check the result";
        } else {
          this.jobRunning = false;
          this.error = job.status === MoveBrevoStatus.FAILED ? (job.error || "Move Brevo failed") : null;
        }
      } catch (err: any) {
        this.logger.error("Move Brevo polling failed:", err);
        this.jobRunning = false;
        this.error = this.errorMessage(err);
      }
    }, POLL_INTERVAL_MS);
  }

  private errorMessage(err: any): string {
    return err?.error?.error || err?.message || "Move Brevo failed";
  }
}
