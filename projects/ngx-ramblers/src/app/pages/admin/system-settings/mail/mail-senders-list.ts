import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { faCheck, faClose, faSearch, faSort, faSortDown, faSortUp, faSpinner, faTrash } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MailService } from "../../../../services/mail/mail.service";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { CommitteeConfigService } from "../../../../services/committee/commitee-config.service";
import { CommitteeMember } from "../../../../models/committee.model";
import { Sender, SenderSortField, SendersResponse } from "../../../../models/mail.model";
import { ALERT_ERROR } from "../../../../models/alert-target.model";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { SortDirection } from "../../../../models/sort.model";
import { StoredValue } from "../../../../models/ui-actions";
import { FormsModule } from "@angular/forms";
import { BrevoButtonComponent } from "../../../../modules/common/third-parties/brevo-button";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-mail-senders-list",
  styles: [`
    .table-container
      max-height: calc(100vh - 520px)
      overflow-y: auto
      overflow-x: hidden
      border: 1px solid #dee2e6
      border-radius: 4px
    th.sortable
      cursor: pointer
      user-select: none
    th.sortable:hover
      background-color: rgba(0, 0, 0, 0.05)
    th .sort-icon
      margin-left: 0.25rem
      opacity: 0.5
    th.sorted .sort-icon
      opacity: 1
    thead.sticky-top
      background-color: #f8f9fa
      border-top: 2px solid #dee2e6
      border-bottom: 2px solid #dee2e6
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)
    thead th
      font-weight: 600
      padding-top: 0.75rem
      padding-bottom: 0.75rem
    td.truncate
      max-width: 250px
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis
    tr.no-hover,
    tr.no-hover:hover,
    tr.no-hover > td,
    tr.no-hover:hover > td
      --bs-table-bg-type: transparent !important
      --bs-table-bg-state: transparent !important
      --bs-table-accent-bg: transparent !important
      --bs-table-striped-bg: transparent !important
      background-color: white !important
      cursor: default
  `],
  template: `
    <div class="thumbnail-heading-frame">
      <div class="thumbnail-heading">Brevo Senders</div>
      @if (errorMessage) {
        <div class="alert alert-danger mt-2">
          <fa-icon [icon]="ALERT_ERROR.icon" class="me-2"></fa-icon>
          {{ errorMessage }}
        </div>
      }
      <div class="d-flex justify-content-between mb-3">
        <div class="row flex-grow-1 me-3">
          <div class="col-sm-6">
            <label class="form-label">Search</label>
            <div class="input-group">
              <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
              <input type="text" class="form-control" [(ngModel)]="searchTerm"
                (ngModelChange)="updateQueryParams()"
                placeholder="Search senders...">
            </div>
          </div>
          <div class="col-sm-6">
            <label class="form-label">Stats</label>
            <div class="form-control-plaintext">
              @if (loading) {
                <fa-icon [icon]="faSpinner" [spin]="true" class="me-2"></fa-icon>Loading senders...
              } @else {
                {{ filteredSenders().length }} of {{ senders.length }} senders
                ({{ activeSenderCount() }} active)
              }
            </div>
          </div>
        </div>
        @if (!showAddForm) {
          <div class="d-flex align-items-end">
            <app-brevo-button button title="Add Sender" (click)="showAddForm = true"/>
          </div>
        }
      </div>
      @if (showAddForm) {
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
              @if (domainMismatchMessage()) {
                <small class="text-danger">{{ domainMismatchMessage() }}</small>
              }
            </div>
          </div>
          <div class="col-sm-4 d-flex align-items-end">
            <app-brevo-button button title="Confirm Add Sender" [disabled]="addSenderDisabled()" (click)="addSender()"/>
            <app-brevo-button button title="Cancel" class="ms-2" (click)="cancelAdd()"/>
          </div>
        </div>
        @if (addError) {
          <div class="alert alert-danger mb-3">{{ addError }}</div>
        }
      }
      <div class="table-responsive table-container">
        <table class="table table-striped table-hover">
          <thead class="sticky-top">
            <tr>
              <th class="sortable" [class.sorted]="sortField === SenderSortField.NAME"
                (click)="toggleSort(SenderSortField.NAME)">
                Name
                <fa-icon [icon]="sortIcon(SenderSortField.NAME)" class="sort-icon"></fa-icon>
              </th>
              <th class="sortable" [class.sorted]="sortField === SenderSortField.EMAIL"
                (click)="toggleSort(SenderSortField.EMAIL)">
                Email
                <fa-icon [icon]="sortIcon(SenderSortField.EMAIL)" class="sort-icon"></fa-icon>
              </th>
              <th style="width: 80px" class="text-center sortable" [class.sorted]="sortField === SenderSortField.MAPPED"
                (click)="toggleSort(SenderSortField.MAPPED)">
                Mapped
                <fa-icon [icon]="sortIcon(SenderSortField.MAPPED)" class="sort-icon"></fa-icon>
              </th>
              <th style="width: 100px" class="sortable" [class.sorted]="sortField === SenderSortField.ACTIVE"
                (click)="toggleSort(SenderSortField.ACTIVE)">
                Status
                <fa-icon [icon]="sortIcon(SenderSortField.ACTIVE)" class="sort-icon"></fa-icon>
              </th>
              <th style="width: 100px">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (loading) {
              <tr class="no-hover">
                <td colspan="5" class="text-center py-4">
                  <fa-icon [icon]="faSpinner" [spin]="true" class="me-2"></fa-icon>Loading senders...
                </td>
              </tr>
            } @else if (filteredSenders().length === 0) {
              <tr class="no-hover">
                <td colspan="5" class="text-center py-4 text-muted">
                  @if (senders.length === 0) {
                    No senders created in Brevo
                  } @else {
                    No senders match your search
                  }
                </td>
              </tr>
            } @else {
              @for (sender of filteredSenders(); track sender.id) {
                <tr>
                  <td class="truncate">{{ sender.name }}</td>
                  <td class="small">{{ sender.email }}</td>
                  <td class="text-center">
                    @if (committeeRoleFor(sender); as role) {
                      <fa-icon [icon]="faCheck" class="text-success" [tooltip]="role.description"></fa-icon>
                    } @else {
                      <fa-icon [icon]="faClose" class="text-danger" tooltip="Not mapped to a committee role"></fa-icon>
                    }
                  </td>
                  <td class="text-center">
                    @if (sender.active) {
                      <span class="badge text-style-sunset" tooltip="Sender is verified and active">Active</span>
                    } @else {
                      <span class="badge bg-warning" tooltip="Sender is not yet verified">Inactive</span>
                    }
                  </td>
                  <td>
                    <div class="btn-group btn-group-sm">
                      <button class="btn btn-outline-danger" (click)="requestDelete(sender); $event.stopPropagation()"
                        [disabled]="deleting || (deletingSenderId && deletingSenderId !== sender.id)"
                        tooltip="Delete sender">
                        <fa-icon [icon]="faTrash"></fa-icon>
                      </button>
                    </div>
                  </td>
                </tr>
                @if (deletingSenderId === sender.id) {
                  <tr class="no-hover">
                    <td colspan="5" class="p-2">
                      <div class="alert alert-warning d-flex align-items-center justify-content-between py-2 mb-0">
                        <span>
                          <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                          <strong class="ms-2">Delete Sender</strong>
                          <span class="ms-2">Are you sure you want to delete sender "{{ sender.name }}" ({{ sender.email }})?</span>
                        </span>
                        <div class="btn-group btn-group-sm">
                          <button type="button" class="btn btn-danger" [disabled]="deleting" (click)="confirmDelete(sender)">Delete</button>
                          <button type="button" class="btn btn-outline-secondary" (click)="cancelDelete()">Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              }
            }
          </tbody>
        </table>
      </div>
    </div>`,
  imports: [FormsModule, BrevoButtonComponent, FontAwesomeModule, TooltipDirective]
})
export class MailSendersListComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("MailSendersListComponent", NgxLoggerLevel.ERROR);
  private mailService = inject(MailService);
  private cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  private committeeConfigService = inject(CommitteeConfigService);
  private stringUtilsService = inject(StringUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private subscriptions: Subscription[] = [];
  public senders: Sender[] = [];
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
  public sortDirection: SortDirection = SortDirection.ASC;
  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly SenderSortField = SenderSortField;
  protected readonly faCheck = faCheck;
  protected readonly faClose = faClose;
  protected readonly faSearch = faSearch;
  protected readonly faSpinner = faSpinner;
  protected readonly faTrash = faTrash;
  private baseDomain: string;

  async ngOnInit() {
    this.subscriptions.push(
      this.activatedRoute.queryParams.subscribe(params => {
        const search = params[StoredValue.SEARCH];
        const sort = params[StoredValue.SORT];
        const sortOrder = params[StoredValue.SORT_ORDER];
        if (search && !this.searchTerm) {
          this.searchTerm = search;
        }
        if (sort) {
          this.sortField = sort as SenderSortField;
        }
        if (sortOrder === SortDirection.ASC || sortOrder === SortDirection.DESC) {
          this.sortDirection = sortOrder;
        }
      }),
      this.committeeConfigService.committeeConfigEvents().subscribe(config => {
        this.committeeRoles = config?.roles || [];
        this.logger.info("loaded committee roles:", this.committeeRoles);
      })
    );
    try {
      const config = await this.cloudflareEmailRoutingService.queryCloudflareConfig();
      this.baseDomain = config?.baseDomain;
    } catch (err) {
      this.logger.warn("Could not load cloudflare config for domain validation:", err);
    }
    await this.loadSenders();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  committeeRoleFor(sender: Sender): CommitteeMember {
    return this.committeeRoles.find(role => role.email === sender.email);
  }

  private senderSortValue(sender: Sender, field: SenderSortField): string {
    if (field === SenderSortField.MAPPED) {
      return this.committeeRoleFor(sender) ? "0" : "1";
    }
    return String(sender[field] ?? "").toLowerCase();
  }

  filteredSenders(): Sender[] {
    const term = this.searchTerm?.toLowerCase()?.trim();
    const filtered = term
      ? this.senders.filter(s => s.name?.toLowerCase().includes(term) || s.email?.toLowerCase().includes(term))
      : [...this.senders];
    return filtered.sort((a, b) => {
      const aVal = this.senderSortValue(a, this.sortField);
      const bVal = this.senderSortValue(b, this.sortField);
      const comparison = aVal.localeCompare(bVal);
      return this.sortDirection === SortDirection.ASC ? comparison : -comparison;
    });
  }

  activeSenderCount(): number {
    return this.senders.filter(s => s.active).length;
  }

  toggleSort(field: SenderSortField) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === SortDirection.ASC ? SortDirection.DESC : SortDirection.ASC;
    } else {
      this.sortField = field;
      this.sortDirection = SortDirection.ASC;
    }
    this.updateQueryParams();
  }

  sortIcon(field: SenderSortField) {
    if (this.sortField !== field) {
      return faSort;
    }
    return this.sortDirection === SortDirection.ASC ? faSortUp : faSortDown;
  }

  updateQueryParams() {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        [StoredValue.SEARCH]: this.searchTerm || null,
        [StoredValue.SORT]: this.sortField || null,
        [StoredValue.SORT_ORDER]: this.sortDirection || null
      },
      queryParamsHandling: "merge"
    });
  }

  emailPlaceholder(): string {
    if (this.baseDomain) {
      return `e.g. role@${this.baseDomain}`;
    }
    return "Sender email address";
  }

  addSenderDisabled(): boolean {
    return !this.newSenderName.trim() || !this.validEmail();
  }

  domainMismatchMessage(): string {
    const email = this.newSenderEmail?.trim();
    if (!email || !email.includes("@") || !this.baseDomain) {
      return null;
    }
    if (!email.endsWith(`@${this.baseDomain}`)) {
      return `Email must end with @${this.baseDomain}`;
    }
    return null;
  }

  private validEmail(): boolean {
    const email = this.newSenderEmail.trim();
    if (!email || !email.includes("@")) {
      return false;
    }
    if (this.baseDomain) {
      return email.endsWith(`@${this.baseDomain}`);
    }
    return true;
  }

  async addSender() {
    this.addError = null;
    try {
      await this.mailService.createSender({name: this.newSenderName.trim(), email: this.newSenderEmail.trim(), active: false});
      this.cancelAdd();
      await this.loadSenders();
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
      await this.loadSenders();
    } catch (error) {
      this.errorMessage = error?.error?.error || error?.message || "Failed to delete sender";
      this.logger.error("Failed to delete sender:", error);
    } finally {
      this.deleting = false;
    }
  }

  cancelDelete() {
    this.deletingSenderId = null;
  }

  private async loadSenders() {
    this.loading = true;
    this.errorMessage = null;
    try {
      const response: SendersResponse = await this.mailService.querySenders();
      this.senders = response?.senders || [];
      this.logger.info("loaded senders:", this.senders);
    } catch (error) {
      this.errorMessage = error?.error?.error || error?.message || "Failed to load senders";
      this.logger.error("Failed to load senders:", error);
    } finally {
      this.loading = false;
    }
  }
}
