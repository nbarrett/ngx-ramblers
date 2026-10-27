import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck, faCircleExclamation, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { FormsModule } from "@angular/forms";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { Subscription } from "rxjs";
import { MailClientService } from "../../../services/mail/mail-client.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import {
  MailClientConnectionSettings,
  MailClientCredentialView
} from "../../../models/mail-client.model";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { StoredValue } from "../../../models/ui-actions";
import { DESCENDING } from "../../../models/table-filtering.model";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";

enum MailClientCredentialColumn {
  LABEL = "label",
  CREATED_AT = "createdAt",
  LAST_USED_AT = "lastUsedAt",
  ACTIONS = "actions"
}

@Component({
  selector: "app-mail-client-passwords",
  imports: [FontAwesomeModule, FormsModule, TooltipDirective, SortableTableComponent, SortableTableCellDirective, DisplayDateAndTimePipe],
  template: `
    <div class="row thumbnail-heading-frame mt-3">
      <div class="thumbnail-heading">Apple Mail, Outlook and Thunderbird</div>
      <div class="col-12">
        @if (!settings?.enabled) {
          <div class="alert alert-warning d-flex align-items-start">
            <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
            <div>
              <strong>Mail applications are switched off</strong>
              <div>A site administrator can turn this on in Mail Settings → API. Groups that are happy with the website inbox can leave it off.</div>
            </div>
          </div>
        } @else {
          <p class="form-text">
            Use these settings in Apple Mail, Outlook or Thunderbird for a committee role address you hold.
            Username is the role address (for example {{ settings.usernameHint || "webmaster@your-group.org.uk" }}).
            Host {{ settings.host || "this site" }}, SMTP port {{ settings.smtpPort }}, IMAP port {{ settings.imapPort }}.
            Incoming connection security: {{ settings.imapSecure ? "SSL/TLS" : "None (local development only)" }}.
            Outgoing connection security: {{ settings.smtpSecure ? "SSL/TLS" : "None (local development only)" }}.
            Use password authentication. Do not select STARTTLS.
            New mail is filed in the shared committee inbox so the rest of the committee can see it.
          </p>
          @if (settings.allowedFromAddresses.length) {
            <p class="form-text">You can send from: {{ settings.allowedFromAddresses.join(", ") }}.</p>
          }
          @if (createdSecret) {
            <div class="alert alert-success d-flex align-items-start">
              <fa-icon [icon]="faCircleCheck" class="me-2 mt-1"/>
              <div>
                <strong>Application password created</strong>
                <div>Copy it now. It will not be shown again: <code>{{ createdSecret }}</code></div>
              </div>
            </div>
          }
          <div class="d-flex flex-wrap align-items-end gap-2 mb-3">
            <div class="form-group mb-0">
              <label for="mail-client-password-label">Label</label>
              <input id="mail-client-password-label" class="form-control" [(ngModel)]="newLabel" placeholder="Phone, laptop">
            </div>
            <button type="button" class="btn btn-primary" (click)="create()" [disabled]="creating">
              <fa-icon [icon]="faPlus" class="me-2"/>Create application password
            </button>
          </div>
          <app-sortable-table
            [columns]="columns"
            [rows]="credentials"
            [defaultSortKey]="sortKey"
            [defaultSortDirection]="sortDirection"
            emptyMessage="No application passwords yet."
            (sortChange)="onSortChange($event)">
            <ng-template [appSortableTableCell]="MailClientCredentialColumn.CREATED_AT" let-row>
              {{ row.createdAt | displayDateAndTime }}
            </ng-template>
            <ng-template [appSortableTableCell]="MailClientCredentialColumn.LAST_USED_AT" let-row>
              {{ row.lastUsedAt ? (row.lastUsedAt | displayDateAndTime) : "Never" }}
            </ng-template>
            <ng-template [appSortableTableCell]="MailClientCredentialColumn.ACTIONS" let-row>
              <button type="button" class="btn btn-quiet btn-icon" tooltip="Revoke this application password" (click)="revoke(row)">
                <fa-icon [icon]="faTrash"/>
              </button>
            </ng-template>
          </app-sortable-table>
        }
      </div>
    </div>
  `
})
export class MailClientPasswordsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("MailClientPasswordsComponent", NgxLoggerLevel.ERROR);
  private mailClientService = inject(MailClientService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private subscriptions: Subscription[] = [];
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faPlus = faPlus;
  protected readonly faTrash = faTrash;
  protected readonly MailClientCredentialColumn = MailClientCredentialColumn;
  protected settings: MailClientConnectionSettings | null = null;
  protected credentials: MailClientCredentialView[] = [];
  protected newLabel = "";
  protected createdSecret: string | null = null;
  protected creating = false;
  protected sortKey = MailClientCredentialColumn.CREATED_AT;
  protected sortDirection: string = DESCENDING;
  protected readonly columns: SortableTableColumn<MailClientCredentialView>[] = [
    {key: MailClientCredentialColumn.LABEL, label: "Label", sortKey: MailClientCredentialColumn.LABEL},
    {key: MailClientCredentialColumn.CREATED_AT, label: "Created", sortKey: MailClientCredentialColumn.CREATED_AT},
    {key: MailClientCredentialColumn.LAST_USED_AT, label: "Last used", sortKey: MailClientCredentialColumn.LAST_USED_AT},
    {key: MailClientCredentialColumn.ACTIONS, label: ""}
  ];

  ngOnInit(): void {
    this.subscriptions.push(this.route.queryParams.subscribe(params => {
      this.sortKey = params[StoredValue.MAIL_CLIENT_CREDENTIAL_SORT] || MailClientCredentialColumn.CREATED_AT;
      this.sortDirection = params[StoredValue.MAIL_CLIENT_CREDENTIAL_SORT_ORDER] || DESCENDING;
    }));
    this.refresh();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async refresh(): Promise<void> {
    try {
      this.settings = await this.mailClientService.settings();
      this.credentials = await this.mailClientService.credentials();
    } catch (error) {
      this.logger.error("failed to load mail application settings", error);
    }
  }

  async create(): Promise<void> {
    this.creating = true;
    try {
      const created = await this.mailClientService.createCredential({label: this.newLabel});
      this.createdSecret = created.secret;
      this.newLabel = "";
      await this.refresh();
    } catch (error) {
      this.logger.error("failed to create application password", error);
    }
    this.creating = false;
  }

  async revoke(row: MailClientCredentialView): Promise<void> {
    await this.mailClientService.revokeCredential(row.id);
    if (this.createdSecret) {
      this.createdSecret = null;
    }
    await this.refresh();
  }

  onSortChange(state: SortableTableSortState): void {
    this.sortKey = state.key || MailClientCredentialColumn.CREATED_AT;
    this.sortDirection = state.direction || DESCENDING;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [StoredValue.MAIL_CLIENT_CREDENTIAL_SORT]: this.sortKey,
        [StoredValue.MAIL_CLIENT_CREDENTIAL_SORT_ORDER]: this.sortDirection
      },
      queryParamsHandling: "merge"
    });
  }
}
