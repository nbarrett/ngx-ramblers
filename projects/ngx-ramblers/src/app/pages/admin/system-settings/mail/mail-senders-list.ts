import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ActivatedRoute, Router } from "@angular/router";
import {
  faCheck,
  faClose,
  faExclamationTriangle,
  faSearch,
  faSpinner,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { enumValues } from "../../../../functions/enums";
import { MailService } from "../../../../services/mail/mail.service";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { CommitteeConfigService } from "../../../../services/committee/commitee-config.service";
import { CommitteeMember, committeeRoleMatchingEmail, roleEmailAddresses } from "../../../../models/committee.model";
import { emailLocalPart, emailLocalPartLengthMessage, normaliseEmail, validEmailLocalPart } from "../../../../functions/strings";
import { Sender, SenderListRow, SenderListScope, SenderSortField, SendersResponse } from "../../../../models/mail.model";
import { ALERT_ERROR } from "../../../../models/alert-target.model";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { SortDirection } from "../../../../models/sort.model";
import { ASCENDING, DESCENDING } from "../../../../models/table-filtering.model";
import { StoredValue } from "../../../../models/ui-actions";
import { FormsModule } from "@angular/forms";
import { BrevoButtonComponent } from "../../../../modules/common/third-parties/brevo-button";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { ContentTextEditor } from "../../../../modules/common/tiptap-editor/content-text-editor";
import { SortableTableComponent } from "../../../../modules/common/sortable-table/sortable-table.component";
import {
  SortableTableCellDirective,
  SortableTableExpandedRowDirective
} from "../../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableAlignment, SortableTableColumn, SortableTableSortState } from "../../../../modules/common/sortable-table/sortable-table.model";
import { SectionToggle } from "../../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../../models/section-toggle.model";

@Component({
  selector: "app-mail-senders-list",
  template: `
    <div class="thumbnail-heading-frame">
      <div class="thumbnail-heading">Brevo Senders</div>
      @if (errorMessage) {
        <div class="alert alert-danger d-flex align-items-start mt-2">
          <fa-icon [icon]="ALERT_ERROR.icon" class="me-2 mt-1"></fa-icon>
          <div>
            <strong>Error</strong>
            <div>{{ errorMessage }}</div>
          </div>
        </div>
      }
      @if (!embeddedValue) {
        <div class="row">
          <div class="col-sm-12 mb-3 mx-2">
            <app-content-text-editor standalone category="admin" name="mail-settings-senders-help"
                                 description="Mail settings senders help"/>
          </div>
        </div>
      }
      @if (embeddedValue) {
        <div class="mb-3">
          <app-section-toggle
            [tabs]="scopeTabs"
            [selectedTab]="senderListScope"
            [queryParamKey]="StoredValue.SENDERS_SCOPE"
            (selectedTabChange)="scopeChanged($event)"/>
        </div>
      }
      <div class="d-flex justify-content-between mb-3">
        <div class="row flex-grow-1 me-3">
          <div class="col-sm-6">
            <label class="form-label">Search</label>
            <div class="input-group">
              <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
              <input type="text" class="form-control" [(ngModel)]="searchTerm"
                (ngModelChange)="searchChanged()"
                placeholder="Search senders...">
            </div>
          </div>
          <div class="col-sm-6">
            <label class="form-label">Stats</label>
            <div class="form-control-plaintext">
              @if (loading) {
                <fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>Loading senders...
              } @else {
                {{ statsLabel() }}
              }
            </div>
          </div>
        </div>
        @if (!embeddedValue && !showAddForm) {
          <div class="d-flex align-items-end">
            <app-brevo-button button title="Add Sender" (click)="showAddForm = true"/>
          </div>
        }
      </div>
      @if (!embeddedValue && showAddForm) {
        <div class="row mb-3 align-items-end">
          <div class="col-sm-4">
            <div class="form-group mb-0">
              <label for="sender-name">Name</label>
              <input [(ngModel)]="newSenderName" type="text" class="form-control input-sm" id="sender-name"
                placeholder="Sender name">
            </div>
          </div>
          <div class="col-sm-4">
            <div class="form-group mb-0">
              <label for="sender-email">Email</label>
              <input [(ngModel)]="newSenderEmail" type="email" class="form-control input-sm" id="sender-email"
                [placeholder]="emailPlaceholder()">
              @if (senderEmailError()) {
                <small class="text-danger">{{ senderEmailError() }}</small>
              }
            </div>
          </div>
          <div class="col-sm-4 d-flex align-items-end">
            <app-brevo-button button title="Confirm Add Sender" [disabled]="addSenderDisabled()" (click)="addSender()"/>
            <app-brevo-button button title="Cancel" class="ms-2" (click)="cancelAdd()"/>
          </div>
        </div>
        @if (addError) {
          <div class="alert alert-danger d-flex align-items-start mb-3">
            <fa-icon [icon]="ALERT_ERROR.icon" class="me-2 mt-1"></fa-icon>
            <div>
              <strong>Error</strong>
              <div>{{ addError }}</div>
            </div>
          </div>
        }
      }
      <app-sortable-table
        [columns]="columns"
        [rows]="senderRows"
        [defaultSortKey]="sortField"
        [defaultSortDirection]="sortDirection"
        [trackBy]="trackSender"
        [expandedWhen]="rowPendingDelete"
        [emptyMessage]="emptyMessage()"
        (sortChange)="sortChanged($event)">
        <ng-template [appSortableTableCell]="SenderSortField.NAME" let-sender>
          @if (sender.highlighted) {
            <strong>{{ sender.name }}</strong>
          } @else {
            {{ sender.name }}
          }
        </ng-template>
        <ng-template [appSortableTableCell]="SenderSortField.EMAIL" let-sender>
          <span class="small">{{ sender.email }}</span>
          @if (sender.domainMismatch) {
            <fa-icon [icon]="faExclamationTriangle" class="text-warning ms-1"
                     [tooltip]="'Email domain does not match ' + baseDomain"></fa-icon>
          }
        </ng-template>
        <ng-template [appSortableTableCell]="SenderSortField.MAPPED" let-sender>
          @if (sender.mappedRoleDescription) {
            <fa-icon [icon]="faCheck" class="text-success" [tooltip]="sender.mappedRoleDescription"></fa-icon>
          } @else {
            <fa-icon [icon]="faClose" class="text-danger" tooltip="Not mapped to a committee role"></fa-icon>
          }
        </ng-template>
        <ng-template [appSortableTableCell]="SenderSortField.ACTIVE" let-sender>
          @if (sender.active) {
            <span class="badge text-style-sunset" tooltip="Sender is verified and active">Active</span>
          } @else {
            <span class="badge bg-warning" tooltip="Sender is not yet verified">Inactive</span>
          }
        </ng-template>
        <ng-template appSortableTableCell="actions" let-sender>
          <button type="button" class="btn btn-quiet btn-icon" (click)="requestDelete(sender)"
            [disabled]="deleting || (deletingSenderId && deletingSenderId !== sender.id)"
            tooltip="Delete sender">
            <fa-icon [icon]="faTrash"></fa-icon>
          </button>
        </ng-template>
        <ng-template appSortableTableExpandedRow let-sender>
          <div class="alert alert-warning d-flex align-items-start py-2 mb-0">
            <fa-icon [icon]="ALERT_ERROR.icon" class="me-2 mt-1"></fa-icon>
            <div class="flex-grow-1">
              <strong>Delete Sender</strong>
              <div>Are you sure you want to delete sender "{{ sender.name }}" ({{ sender.email }})?</div>
            </div>
            <div class="d-flex gap-2 flex-shrink-0 ms-3">
              <button type="button" class="btn btn-danger" [disabled]="deleting"
                      (click)="confirmDelete(sender)">Delete
              </button>
              <button type="button" class="btn btn-quiet"
                      (click)="cancelDelete()">Cancel
              </button>
            </div>
          </div>
        </ng-template>
      </app-sortable-table>
    </div>`,
  imports: [FormsModule, BrevoButtonComponent, FontAwesomeModule, TooltipDirective, ContentTextEditor, SortableTableComponent, SortableTableCellDirective, SortableTableExpandedRowDirective, SectionToggle]
})
export class MailSendersListComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("MailSendersListComponent", NgxLoggerLevel.ERROR);
  private mailService = inject(MailService);
  private cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  private committeeConfigService = inject(CommitteeConfigService);
  private stringUtilsService = inject(StringUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private mailMessagingService = inject(MailMessagingService);
  private subscriptions: Subscription[] = [];
  public senders: Sender[] = [];
  public senderRows: SenderListRow[] = [];
  public committeeRoles: CommitteeMember[] = [];
  public loading = true;
  public errorMessage: string;
  public showAddForm = false;
  public newSenderName = "";
  public newSenderEmail = "";
  public addError: string;
  public deletingSenderId: number;
  public deleting = false;
  public searchTerm = "";
  public sortField: SenderSortField = SenderSortField.NAME;
  public sortDirection = ASCENDING;
  public embeddedValue = false;
  private highlightEmailsValue: string[] = [];
  private editingRoleTypeValue: string = null;
  private rememberedRoleEmails: string[] = [];
  senderListScope: SenderListScope = SenderListScope.THIS_ROLE;
  scopeTabs: SectionToggleTab[] = [
    {value: SenderListScope.THIS_ROLE, label: "This role"},
    {value: SenderListScope.ALL, label: "All senders"}
  ];
  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly SenderSortField = SenderSortField;
  protected readonly StoredValue = StoredValue;
  protected readonly SenderListScope = SenderListScope;
  protected readonly faCheck = faCheck;
  protected readonly faClose = faClose;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faSearch = faSearch;
  protected readonly faSpinner = faSpinner;
  protected readonly faTrash = faTrash;
  public baseDomain: string;
  columns: SortableTableColumn<SenderListRow>[] = [
    {key: SenderSortField.NAME, label: "Name", sortKey: SenderSortField.NAME, cellGetter: sender => sender.name},
    {key: SenderSortField.EMAIL, label: "Email", sortKey: SenderSortField.EMAIL, cellGetter: sender => sender.email},
    {key: SenderSortField.MAPPED, label: "Mapped", sortKey: SenderSortField.MAPPED, align: SortableTableAlignment.CENTER, cellGetter: sender => sender.mapped},
    {key: SenderSortField.ACTIVE, label: "Status", sortKey: SenderSortField.ACTIVE, align: SortableTableAlignment.CENTER, cellGetter: sender => sender.active},
    {key: "actions", label: "Actions", align: SortableTableAlignment.CENTER}
  ];

  @Output() sendersChanged = new EventEmitter<Sender[]>();

  @Input() set embedded(value: boolean) {
    this.embeddedValue = coerceBooleanProperty(value);
  }

  @Input() set highlightEmails(value: string[]) {
    const next = value ?? [];
    const previous = this.highlightEmailsValue.map(address => address.toLowerCase()).join("\n");
    const incoming = next.map(address => address.toLowerCase()).join("\n");
    if (incoming !== previous) {
      this.highlightEmailsValue = next;
      this.rememberRoleEmails(next);
      this.rebuildRows();
    }
  }

  @Input() set editingRoleType(value: string) {
    const next = value || null;
    if (next !== this.editingRoleTypeValue) {
      this.editingRoleTypeValue = next;
      this.rememberedRoleEmails = [];
      this.rememberRoleEmails(this.highlightEmailsValue);
      this.rebuildRows();
    }
  }

  async ngOnInit() {
    this.subscriptions.push(
      this.activatedRoute.queryParams.subscribe(params => {
        const search = params[this.searchParam()];
        const sort = params[this.sortParam()];
        const sortOrder = params[this.sortOrderParam()];
        if (search && !this.searchTerm) {
          this.searchTerm = search;
        }
        if (enumValues(SenderSortField).includes(sort)) {
          this.sortField = sort as SenderSortField;
        }
        if (sortOrder === DESCENDING || sortOrder === SortDirection.DESC) {
          this.sortDirection = DESCENDING;
        } else if (sortOrder === ASCENDING || sortOrder === SortDirection.ASC) {
          this.sortDirection = ASCENDING;
        }
        this.rebuildRows();
      }),
      this.committeeConfigService.committeeConfigEvents().subscribe(config => {
        this.committeeRoles = config?.roles || [];
        this.logger.info("loaded committee roles:", this.committeeRoles);
        this.rebuildRows();
      })
    );
    this.subscriptions.push(
      this.mailMessagingService.events().subscribe(async mailMessagingConfig => {
        if (mailMessagingConfig.brevo.accountError) {
          this.logger.info("Brevo account not configured — skipping senders");
          this.loading = false;
        } else {
          try {
            const config = await this.cloudflareEmailRoutingService.queryCloudflareConfig();
            this.baseDomain = config?.baseDomain;
          } catch (err) {
            this.logger.warn("Could not load cloudflare config for sender domain validation:", err);
          }
          await this.reload();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async reload(): Promise<void> {
    this.loading = true;
    this.errorMessage = null;
    try {
      const response: SendersResponse = await this.mailService.querySenders();
      this.senders = response?.senders || [];
      this.logger.info("loaded senders:", this.senders);
      this.rebuildRows();
      this.sendersChanged.emit(this.senders);
    } catch (error) {
      this.errorMessage = this.stringUtilsService.stringify(error) || "Failed to load senders";
      this.logger.error("Failed to load senders:", error);
    } finally {
      this.loading = false;
    }
  }

  committeeRoleFor(sender: Sender): CommitteeMember | null {
    const saved = committeeRoleMatchingEmail(this.committeeRoles, sender.email, this.baseDomain);
    if (!this.embeddedValue || !this.editingRoleTypeValue) {
      return saved;
    } else {
      const inLiveList = this.highlightEmailsValue.some(address => normaliseEmail(address) === normaliseEmail(sender.email));
      if (inLiveList) {
        return saved ?? this.committeeRoles.find(role => role.type === this.editingRoleTypeValue) ?? null;
      } else if (saved?.type === this.editingRoleTypeValue) {
        return null;
      } else {
        return saved;
      }
    }
  }

  trackSender(_index: number, sender: SenderListRow): string | number {
    return sender.id ?? sender.email;
  }

  rowPendingDelete = (sender: SenderListRow): boolean => sender.id === this.deletingSenderId;

  emptyMessage(): string {
    if (this.loading) {
      return "Loading senders...";
    } else if (this.senders.length === 0) {
      return "No senders created in Brevo";
    } else if (this.showingThisRole() && this.scopedSenders().length === 0) {
      return "No senders in Brevo for this role";
    } else {
      return "No senders match your search";
    }
  }

  statsLabel(): string {
    const scoped = this.scopedSenders();
    const active = scoped.filter(sender => sender.active).length;
    if (this.showingThisRole()) {
      if (this.searchTerm?.trim()) {
        return `${this.senderRows.length} of ${scoped.length} senders for this role (${active} active)`;
      } else {
        return `${this.senderRows.length} senders for this role (${active} active)`;
      }
    } else {
      return `${this.senderRows.length} of ${this.senders.length} senders (${this.senders.filter(sender => sender.active).length} active)`;
    }
  }

  scopeChanged(scope: string) {
    if (scope === SenderListScope.ALL) {
      this.senderListScope = SenderListScope.ALL;
    } else {
      this.senderListScope = SenderListScope.THIS_ROLE;
    }
    this.rebuildRows();
  }

  sortChanged(state: SortableTableSortState) {
    if (enumValues(SenderSortField).includes(state.key)) {
      this.sortField = state.key as SenderSortField;
    } else {
      this.sortField = SenderSortField.NAME;
    }
    this.sortDirection = state.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.updateQueryParams();
  }

  searchChanged() {
    this.rebuildRows();
    this.updateQueryParams();
  }

  updateQueryParams() {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        [this.searchParam()]: this.searchTerm || null,
        [this.sortParam()]: this.sortField || null,
        [this.sortOrderParam()]: this.sortDirection || null
      },
      queryParamsHandling: "merge"
    });
  }

  emailPlaceholder(): string {
    if (this.baseDomain) {
      return `e.g. role@${this.baseDomain}`;
    } else {
      return "Sender email address";
    }
  }

  addSenderDisabled(): boolean {
    return !this.newSenderName.trim() || !this.validEmail();
  }

  senderEmailError(): string {
    const email = this.newSenderEmail?.trim();
    if (!email || !email.includes("@")) {
      return null;
    } else {
      const lengthMessage = emailLocalPartLengthMessage(email);
      if (lengthMessage) {
        return lengthMessage;
      } else if (this.baseDomain && !email.endsWith(`@${this.baseDomain}`)) {
        return `Email must end with @${this.baseDomain}`;
      } else {
        return null;
      }
    }
  }

  private validEmail(): boolean {
    const email = this.newSenderEmail.trim();
    if (!email || !email.includes("@") || !validEmailLocalPart(emailLocalPart(email))) {
      return false;
    } else if (this.baseDomain) {
      return email.endsWith(`@${this.baseDomain}`);
    } else {
      return true;
    }
  }

  async addSender() {
    this.addError = null;
    try {
      await this.mailService.createSender({name: this.newSenderName.trim(), email: this.newSenderEmail.trim(), active: false});
      this.cancelAdd();
      await this.reload();
    } catch (error) {
      this.addError = this.stringUtilsService.stringify(error);
      this.logger.error("Failed to create sender:", error);
    }
  }

  cancelAdd() {
    this.showAddForm = false;
    this.newSenderName = "";
    this.newSenderEmail = "";
    this.addError = null;
  }

  requestDelete(sender: Sender) {
    this.deletingSenderId = sender.id;
  }

  async confirmDelete(sender: Sender) {
    this.deleting = true;
    try {
      await this.mailService.deleteSender(sender.id);
      this.cancelDelete();
      await this.reload();
    } catch (error) {
      this.errorMessage = this.stringUtilsService.stringify(error) || "Failed to delete sender";
      this.logger.error("Failed to delete sender:", error);
    } finally {
      this.deleting = false;
    }
  }

  cancelDelete() {
    this.deletingSenderId = null;
  }

  senderDomainMismatch(sender: Sender): boolean {
    return this.baseDomain && sender.email && !sender.email.endsWith(`@${this.baseDomain}`);
  }

  private searchParam(): StoredValue {
    if (this.embeddedValue) {
      return StoredValue.SENDERS_SEARCH;
    } else {
      return StoredValue.SEARCH;
    }
  }

  private sortParam(): StoredValue {
    if (this.embeddedValue) {
      return StoredValue.SENDERS_SORT;
    } else {
      return StoredValue.SORT;
    }
  }

  private sortOrderParam(): StoredValue {
    if (this.embeddedValue) {
      return StoredValue.SENDERS_SORT_ORDER;
    } else {
      return StoredValue.SORT_ORDER;
    }
  }

  private showingThisRole(): boolean {
    return this.embeddedValue && this.senderListScope === SenderListScope.THIS_ROLE;
  }

  private rememberRoleEmails(addresses: string[]) {
    const merged = [...this.rememberedRoleEmails, ...addresses]
      .map(address => normaliseEmail(address))
      .filter(Boolean);
    this.rememberedRoleEmails = merged.reduce<string[]>((unique, address) => unique.includes(address) ? unique : unique.concat(address), []);
  }

  private thisRoleEmails(): string[] {
    const savedRole = this.committeeRoles.find(role => role.type === this.editingRoleTypeValue);
    const saved = savedRole ? roleEmailAddresses(savedRole, this.baseDomain) : [];
    const combined = [...this.highlightEmailsValue, ...this.rememberedRoleEmails, ...saved]
      .map(address => normaliseEmail(address))
      .filter(Boolean);
    return combined.reduce<string[]>((unique, address) => unique.includes(address) ? unique : unique.concat(address), []);
  }

  private scopedSenders(): Sender[] {
    if (this.showingThisRole()) {
      const wanted = this.thisRoleEmails();
      return this.senders.filter(sender => wanted.includes(normaliseEmail(sender.email)));
    } else {
      return this.senders;
    }
  }

  private rebuildRows() {
    const term = this.searchTerm?.toLowerCase()?.trim();
    const highlights = this.highlightEmailsValue.map(address => address.toLowerCase());
    const scoped = this.scopedSenders();
    const matching = term
      ? scoped.filter(sender => (sender.name ?? "").toLowerCase().includes(term) || (sender.email ?? "").toLowerCase().includes(term))
      : scoped;
    this.senderRows = matching.map(sender => {
      const role = this.committeeRoleFor(sender);
      return {
        ...sender,
        mapped: role ? 0 : 1,
        mappedRoleDescription: role?.nameAndDescription || role?.description || null,
        domainMismatch: this.senderDomainMismatch(sender),
        highlighted: highlights.includes((sender.email ?? "").toLowerCase())
      };
    });
  }
}
