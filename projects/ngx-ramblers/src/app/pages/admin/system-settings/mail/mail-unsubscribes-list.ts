import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { values } from "es-toolkit/compat";
import {
  faBan,
  faCheck,
  faEnvelopeOpen,
  faExclamationTriangle,
  faRefresh,
  faSearch,
  faSort,
  faSortDown,
  faSortUp,
  faSpinner,
  faTrash,
  faUpRightFromSquare,
  faXmark
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgClass } from "@angular/common";
import { AdminMembersPath } from "../../../../models/admin-route-paths.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MailService } from "../../../../services/mail/mail.service";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { MailLinkService } from "../../../../services/mail/mail-link.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import {
  BLOCKED_CONTACT_REASON_LABELS,
  BlockedContact,
  BlockedContactReasonCode,
  ClearAllBlocklistResult,
  ListInfo,
  SalesforceWritebackStatus,
  Sender,
  UNSUBSCRIBE_FEEDBACK_REASON_LABELS,
  UnsubscribeActivity,
  UnsubscribesListMode,
  UnsubscribeSortField
} from "../../../../models/mail.model";
import { ALERT_ERROR } from "../../../../models/alert-target.model";
import { SortDirection } from "../../../../models/sort.model";
import { StoredValue } from "../../../../models/ui-actions";
import { BrevoButtonComponent } from "../../../../modules/common/third-parties/brevo-button";
import { BrevoDropdownItem } from "../../../../models/brevo-dropdown.model";
import { SectionToggle } from "../../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../../models/section-toggle.model";
import { ContentTextEditor } from "../../../../modules/common/tiptap-editor/content-text-editor";
import { DateRange, DateRangeSlider } from "../../../../components/date-range-slider/date-range-slider";
import { UIDateFormat } from "../../../../models/date-format.model";
import { DateTime } from "luxon";
import { UiActionsService } from "../../../../services/ui-actions.service";

const ALL_REASONS = "all";
const ALL_SENDERS = "all";

@Component({
  selector: "app-mail-unsubscribes-list",
  styles: [`
    .mode-toggle-anchor
      position: absolute
      top: 12px
      right: 12px
    .mode-toggle-anchor ::ng-deep .section-toggle
      margin-bottom: 0
    .table-container
      max-height: calc(100vh - 420px)
      overflow-y: auto
      overflow-x: auto
      border: 1px solid #dee2e6
      border-radius: 4px
    .blocks-table
      table-layout: fixed
      width: 100%
      margin-bottom: 0
    .blocks-table th,
    .blocks-table td
      vertical-align: middle
      padding-top: 0.55rem
      padding-bottom: 0.55rem
    .blocks-table .col-name
      width: 24%
    .blocks-table .col-sender
      width: 18%
    .blocks-table .col-reason
      width: 28%
    .blocks-table .col-lists
      width: 16%
    .blocks-table .col-blocked-at
      width: 14%
    .reason-detail
      display: -webkit-box
      -webkit-line-clamp: 2
      -webkit-box-orient: vertical
      overflow: hidden
      white-space: normal
      line-height: 1.3
    .reason-related
      white-space: normal
      line-height: 1.3
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
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis
    td.name-cell
      vertical-align: middle
      white-space: nowrap
    td.lists-cell
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
    .reason-badge
      font-size: 0.75rem
      padding: 0.35em 0.65em
      white-space: nowrap
    .brevo-link
      display: inline-flex
      align-items: center
      justify-content: center
      width: 25px
      height: 25px
      padding: 0
      margin-right: 6px
      border: 0
      background-color: transparent
      vertical-align: middle
      line-height: 1
    .brevo-link img
      width: 19px
      height: 19px
      border-radius: 50%
    .brevo-link-placeholder
      display: inline-block
      width: 25px
      height: 25px
      margin-right: 6px
      vertical-align: middle
    .row-action
      width: 25px
      height: 25px
      min-height: 25px
      padding: 0
      display: inline-flex
      align-items: center
      justify-content: center
      font-size: 0.8rem
      line-height: 1
      vertical-align: middle
  `],
  template: `
    <div class="thumbnail-heading-frame" style="position: relative; margin-top: 24px">
      <div class="thumbnail-heading">Brevo Unsubscribes &amp; Blocked Contacts</div>
      <div class="mode-toggle-anchor">
        <app-section-toggle
          [tabs]="modeTabs"
          [selectedTab]="mode"
          (selectedTabChange)="onModeChange($event)"
          [queryParamKey]="StoredValue.SUB_TAB"
          [fullWidth]="false"/>
      </div>
      @if (errorMessage) {
        <div class="alert alert-danger mt-2">
          <fa-icon [icon]="ALERT_ERROR.icon" class="me-2"></fa-icon>
          {{ errorMessage }}
        </div>
      }
      <div class="row mb-3 g-3">
        <div class="col-sm-4">
          <label class="form-label">Search</label>
          <div class="input-group">
            <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
            <input type="text" class="form-control" [(ngModel)]="searchTerm"
                   (ngModelChange)="updateQueryParams()"
                   placeholder="Contact or sender email...">
          </div>
        </div>
        <div class="col-sm-4">
          <label for="reason-filter" class="form-label">Reason</label>
          <select id="reason-filter" class="form-select" [(ngModel)]="reasonFilter"
                  (ngModelChange)="updateQueryParams()">
            <option [ngValue]="ALL_REASONS">All reasons</option>
            @for (reason of reasonOptions; track reason.code) {
              <option [ngValue]="reason.code">{{ reason.label }}</option>
            }
          </select>
        </div>
        <div class="col-sm-4">
          <label for="sender-filter" class="form-label">Sender</label>
          <select id="sender-filter" class="form-select" [(ngModel)]="senderFilter"
                  (ngModelChange)="onSenderFilterChange()">
            <option [ngValue]="ALL_SENDERS">All senders</option>
            @for (sender of availableSenders; track sender.id ?? $index) {
              <option [ngValue]="sender.email">{{ sender.name }} &lt;{{ sender.email }}&gt;</option>
            }
          </select>
        </div>
        <div class="col">
          <app-date-range-slider
            [minDate]="dateFilterMinDate"
            [maxDate]="dateFilterMaxDate"
            [range]="dateFilterRange"
            (rangeChange)="onDateRangeChange($event)"/>
        </div>
        <div class="col-auto d-flex align-items-end justify-content-end gap-2">
          @if (hasServerSideFilters()) {
            <app-brevo-button button title="Clear filters" [disabled]="loading" (click)="resetServerSideFilters()"/>
          }
          <app-brevo-button button title="Options"
                            [disabled]="loading"
                            [dropdownItems]="manageDropdownItems()"
                            (dropdownSelected)="handleManageDropdown($event)"/>
        </div>
        @if (pendingClearAll) {
          <div class="col-sm-12">
            <div class="alert alert-warning d-flex flex-wrap align-items-center gap-2">
              <span class="me-auto">
                <strong>Clear all blocks?</strong>
                Removes every contact from Brevo's blocklist and clears every local emailBlock record. NGX member records are not deleted.
              </span>
              <app-brevo-button button title="Confirm clear all"
                                [disabled]="clearAllInProgress"
                                [loading]="clearAllInProgress"
                                (click)="confirmClearAllBlocklist()"/>
              <app-brevo-button button title="Cancel"
                                [disabled]="clearAllInProgress"
                                (click)="cancelClearAllBlocklist()"/>
            </div>
          </div>
        }
        @if (clearAllResult) {
          <div class="col-sm-12">
            <div class="alert" [ngClass]="clearAllResult.brevoFailed > 0 ? 'alert-warning' : 'alert-success'">
              Cleared {{ clearAllResult.brevoCleared }} of {{ clearAllResult.brevoFound }} Brevo blocked contacts and {{ clearAllResult.localCleared }} local emailBlock {{ clearAllResult.localCleared === 1 ? 'record' : 'records' }}.
              @if (clearAllResult.brevoFailed > 0) {
                {{ clearAllResult.brevoFailed }} Brevo removals failed.
              }
            </div>
          </div>
        }
      </div>
      <div class="row">
        <div class="col-sm-12 mb-3 mx-2">
          <app-content-text-editor standalone category="admin" name="mail-settings-unsubscribes-help"
                               description="Mail settings unsubscribes help"/>
        </div>
      </div>
      @if (mode === UnsubscribesListMode.Blocks) {
      <div class="table-responsive table-container">
        <table class="table table-striped table-hover blocks-table">
          <thead class="sticky-top">
            <tr>
              <th class="col-name sortable" [class.sorted]="sortField === UnsubscribeSortField.EMAIL"
                  (click)="toggleSort(UnsubscribeSortField.EMAIL)">
                Name
                <fa-icon [icon]="sortIcon(UnsubscribeSortField.EMAIL)" class="sort-icon"></fa-icon>
              </th>
              <th class="col-sender sortable" [class.sorted]="sortField === UnsubscribeSortField.SENDER_EMAIL"
                  (click)="toggleSort(UnsubscribeSortField.SENDER_EMAIL)">
                Sender Email
                <fa-icon [icon]="sortIcon(UnsubscribeSortField.SENDER_EMAIL)" class="sort-icon"></fa-icon>
              </th>
              <th class="col-reason sortable" [class.sorted]="sortField === UnsubscribeSortField.REASON_CODE"
                  (click)="toggleSort(UnsubscribeSortField.REASON_CODE)">
                Reason
                <fa-icon [icon]="sortIcon(UnsubscribeSortField.REASON_CODE)" class="sort-icon"></fa-icon>
              </th>
              <th class="col-lists"
                  tooltip="Brevo mail lists associated with the contact, and whether email is globally denied">
                Lists
              </th>
              <th class="col-blocked-at sortable" [class.sorted]="sortField === UnsubscribeSortField.BLOCKED_AT"
                  (click)="toggleSort(UnsubscribeSortField.BLOCKED_AT)">
                Blocked At
                <fa-icon [icon]="sortIcon(UnsubscribeSortField.BLOCKED_AT)" class="sort-icon"></fa-icon>
              </th>
            </tr>
          </thead>
          <tbody>
            @if (loading) {
              <tr class="no-hover">
                <td colspan="5" class="text-center py-4">
                  <fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>Loading unsubscribes...
                </td>
              </tr>
            } @else if (filteredUnsubscribes().length === 0) {
              <tr class="no-hover">
                <td colspan="5" class="text-center py-4 text-muted">
                  @if (unsubscribes.length === 0) {
                    <fa-icon [icon]="faEnvelopeOpen" class="me-2"></fa-icon>No unsubscribes or blocked contacts
                  } @else {
                    No unsubscribes match your filters
                  }
                </td>
              </tr>
            } @else {
              @for (contact of filteredUnsubscribes(); track trackByContact($index, contact)) {
                <tr>
                  <td class="name-cell col-name">
                    @if (contact.brevoContactId) {
                      <a [href]="mailLinkService.contactView(contact.brevoContactId)"
                         target="_blank"
                         rel="noopener"
                         class="brevo-link"
                         tooltip="Open this contact in Brevo">
                        <img src="/assets/images/local/brevo.ico" alt="Open in Brevo">
                      </a>
                    } @else {
                      <span class="brevo-link-placeholder"></span>
                    }
                    @if (pendingRemovalEmail === contact.email) {
                      <button type="button" class="btn btn-sm btn-danger row-action me-1"
                              [disabled]="removalInProgress"
                              tooltip="Confirm — this calls Brevo and clears the local block"
                              (click)="confirmRemoveFromBlocklist(contact)">
                        @if (removalInProgress) {
                          <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
                        } @else {
                          <fa-icon [icon]="faCheck"></fa-icon>
                        }
                      </button>
                      <button type="button" class="btn btn-sm btn-outline-secondary row-action me-2"
                              [disabled]="removalInProgress"
                              tooltip="Cancel"
                              (click)="cancelRemoveFromBlocklist()">
                        <fa-icon [icon]="faXmark"></fa-icon>
                      </button>
                    } @else {
                      <button type="button" class="btn btn-sm btn-outline-danger row-action me-2"
                              tooltip="Remove this contact from Brevo's account-level blocklist"
                              (click)="startRemoveFromBlocklist(contact)">
                        <fa-icon [icon]="faTrash"></fa-icon>
                      </button>
                    }
                    <span class="d-inline-block align-middle">
                      @if (contact.matchedMember?.membershipNumber) {
                        <a [routerLink]="['/' + adminMembersMemberAdminPath]"
                           [queryParams]="memberAdminQueryParams(contact.matchedMember.membershipNumber)"
                           [tooltip]="contact.email || 'Open this member in Member Admin'">{{ contactDisplay(contact) }}</a>
                        <div class="text-muted small">{{ contact.matchedMember.membershipNumber }}</div>
                      } @else {
                        <span [tooltip]="contact.email">{{ contactDisplay(contact) }}</span>
                      }
                    </span>
                  </td>
                  <td class="truncate col-sender" [tooltip]="senderTooltip(contact)">{{ senderDisplay(contact) }}</td>
                  <td class="col-reason">
                    <span class="badge reason-badge"
                          [ngClass]="reasonBadgeClass(contact.reason?.code)"
                          [tooltip]="reasonTooltip(contact)">
                      @if (reasonIcon(contact.reason?.code); as icon) {
                        <fa-icon [icon]="icon" class="me-1"></fa-icon>
                      }
                      {{ reasonLabel(contact.reason?.code) }}
                    </span>
                    @if (contact.reason?.message) {
                      <div class="small mt-1 reason-detail" [tooltip]="contact.reason.message">
                        <span class="fw-semibold">{{ contact.reason.message }}</span>
                      </div>
                    }
                    @if (contact.detail) {
                      <div class="text-muted small mt-1 reason-related" [tooltip]="contact.detail">
                        {{ formatRelatedDetail(contact.detail) }}
                      </div>
                    }
                    @if (contact.unsubscribeFeedback) {
                      <div class="text-muted small mt-1 text-truncate" [tooltip]="feedbackTooltip(contact.unsubscribeFeedback)">
                        {{ feedbackReasonLabel(contact.unsubscribeFeedback.reason) }}@if (contact.unsubscribeFeedback.comment) { &nbsp;&mdash; &ldquo;{{ contact.unsubscribeFeedback.comment }}&rdquo; }
                      </div>
                    }
                  </td>
                  <td class="lists-cell col-lists small"
                      [tooltip]="listsCellTooltip(contact)">
                    @if (contactListNames(contact); as names) {
                      @if (names.length === 0) {
                        <span class="text-muted">—</span>
                      } @else {
                        <span>{{ names.join(", ") }}</span>
                      }
                    }
                    @if (showGlobalDenyHint(contact)) {
                      <span class="text-danger ms-1">· denied</span>
                    }
                  </td>
                  <td class="small text-nowrap col-blocked-at">{{ formatBlockedAt(contact.blockedAt) }}</td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
      }
      @if (mode === UnsubscribesListMode.Unsubscribes) {
        <div class="table-responsive table-container">
          <table class="table table-striped table-hover">
            <thead class="sticky-top">
              <tr>
                <th class="sortable" [class.sorted]="sortField === UnsubscribeSortField.NAME"
                    (click)="toggleSort(UnsubscribeSortField.NAME)">
                  Name
                  <fa-icon [icon]="sortIcon(UnsubscribeSortField.NAME)" class="sort-icon"></fa-icon>
                </th>
                <th class="sortable" [class.sorted]="sortField === UnsubscribeSortField.LIST_NAME"
                    (click)="toggleSort(UnsubscribeSortField.LIST_NAME)">
                  List
                  <fa-icon [icon]="sortIcon(UnsubscribeSortField.LIST_NAME)" class="sort-icon"></fa-icon>
                </th>
                <th class="sortable" [class.sorted]="sortField === UnsubscribeSortField.REASON_CODE"
                    (click)="toggleSort(UnsubscribeSortField.REASON_CODE)">
                  Reason
                  <fa-icon [icon]="sortIcon(UnsubscribeSortField.REASON_CODE)" class="sort-icon"></fa-icon>
                </th>
                <th style="width: 170px" class="sortable" [class.sorted]="sortField === UnsubscribeSortField.BLOCKED_AT"
                    (click)="toggleSort(UnsubscribeSortField.BLOCKED_AT)">
                  Unsubscribed At
                  <fa-icon [icon]="sortIcon(UnsubscribeSortField.BLOCKED_AT)" class="sort-icon"></fa-icon>
                </th>
              </tr>
            </thead>
            <tbody>
              @if (loading) {
                <tr class="no-hover">
                  <td colspan="4" class="text-center py-4">
                    <fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>Loading unsubscribe activity...
                  </td>
                </tr>
              } @else if (sortedActivity().length === 0) {
                <tr class="no-hover">
                  <td colspan="4" class="text-center py-4 text-muted">
                    @if (activity.length === 0) {
                      <fa-icon [icon]="faEnvelopeOpen" class="me-2"></fa-icon>No unsubscribe activity recorded
                    } @else {
                      No unsubscribes match your filters
                    }
                  </td>
                </tr>
              } @else {
                @for (event of sortedActivity(); track trackByActivity($index, event)) {
                  <tr>
                    <td class="truncate">
                      <span class="d-inline-block align-top">
                        @if (event.membershipNumber) {
<a [routerLink]="['/' + adminMembersMemberAdminPath]"
                              [queryParams]="memberAdminQueryParams(event.membershipNumber)"
                             [tooltip]="event.email || 'Open this member in Member Admin'">{{ activityDisplay(event) }}</a>
                          <div class="text-muted small">{{ event.membershipNumber }}</div>
                        } @else {
                          <span [tooltip]="event.email">{{ activityDisplay(event) }}</span>
                        }
                      </span>
                    </td>
                    <td class="small">
                      @if (event.listId === 0 || !event.listId) {
                        <span class="text-muted">Unknown list</span>
                      } @else {
                        {{ event.listName || listNameById.get(event.listId) || ('#' + event.listId) }}
                      }
                    </td>
                    <td>
                      @if (event.reason) {
                        <span class="badge reason-badge bg-info text-white">{{ feedbackReasonLabel(event.reason) }}@if (event.comment) { &mdash; &ldquo;{{ event.comment }}&rdquo;}</span>
                      } @else {
                        <span class="text-muted small">No reason given</span>
                      }
                    </td>
                    <td class="small text-nowrap">{{ formatBlockedAt(event.unsubscribedAt) }}</td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>`,
  imports: [FormsModule, BrevoButtonComponent, FontAwesomeModule, TooltipDirective, ContentTextEditor, NgClass, DateRangeSlider, RouterLink, SectionToggle]
})
export class MailUnsubscribesListComponent implements OnInit, OnDestroy {
  adminMembersMemberAdminPath = AdminMembersPath.MEMBER_ADMIN;

  private logger: Logger = inject(LoggerFactory).createLogger("MailUnsubscribesListComponent", NgxLoggerLevel.ERROR);
  private mailService = inject(MailService);
  private mailMessagingService = inject(MailMessagingService);
  protected mailLinkService = inject(MailLinkService);
  private dateUtils = inject(DateUtilsService);
  private stringUtils = inject(StringUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private uiActions = inject(UiActionsService);
  private subscriptions: Subscription[] = [];

  public unsubscribes: BlockedContact[] = [];
  public activity: UnsubscribeActivity[] = [];
  public mode: UnsubscribesListMode = UnsubscribesListMode.Unsubscribes;
  public modeTabs: SectionToggleTab[] = [
    { value: UnsubscribesListMode.Unsubscribes, label: "Unsubscribes" },
    { value: UnsubscribesListMode.Blocks, label: "Blocks" }
  ];
  public totalCount = 0;
  public loading = true;
  public errorMessage: string;
  public searchTerm = "";
  public reasonFilter: string = ALL_REASONS;
  public sortField: UnsubscribeSortField = UnsubscribeSortField.BLOCKED_AT;
  public sortDirection: SortDirection = SortDirection.DESC;
  public pendingRemovalEmail: string | null = null;
  public removalInProgress = false;
  public pendingClearAll = false;
  public clearAllInProgress = false;
  public clearAllResult: ClearAllBlocklistResult | null = null;
  public senderFilter: string = ALL_SENDERS;
  public dateFilterMinDate: DateTime;
  public dateFilterMaxDate: DateTime;
  public dateFilterRange: DateRange | null = null;
  public availableSenders: Sender[] = [];
  protected listNameById = new Map<number, string>();
  private committeeMembers: {email?: string; description?: string; fullName?: string}[] = [];
  private configLoaded = false;

  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly ALL_REASONS = ALL_REASONS;
  protected readonly ALL_SENDERS = ALL_SENDERS;
  protected readonly StoredValue = StoredValue;
  protected readonly UnsubscribeSortField = UnsubscribeSortField;
  protected readonly UnsubscribesListMode = UnsubscribesListMode;
  protected readonly faSearch = faSearch;
  protected readonly faSpinner = faSpinner;
  protected readonly faEnvelopeOpen = faEnvelopeOpen;
  protected readonly faRefresh = faRefresh;
  protected readonly faTrash = faTrash;
  protected readonly faCheck = faCheck;
  protected readonly faXmark = faXmark;
  protected readonly faUpRightFromSquare = faUpRightFromSquare;
  protected readonly reasonOptions: { code: string; label: string }[] = [
    { code: BlockedContactReasonCode.UNSUBSCRIBED_VIA_EMAIL, label: BLOCKED_CONTACT_REASON_LABELS[BlockedContactReasonCode.UNSUBSCRIBED_VIA_EMAIL] },
    { code: BlockedContactReasonCode.UNSUBSCRIBED_VIA_MA, label: BLOCKED_CONTACT_REASON_LABELS[BlockedContactReasonCode.UNSUBSCRIBED_VIA_MA] },
    { code: BlockedContactReasonCode.UNSUBSCRIBED_VIA_API, label: BLOCKED_CONTACT_REASON_LABELS[BlockedContactReasonCode.UNSUBSCRIBED_VIA_API] },
    { code: BlockedContactReasonCode.ADMIN_BLOCKED, label: BLOCKED_CONTACT_REASON_LABELS[BlockedContactReasonCode.ADMIN_BLOCKED] },
    { code: BlockedContactReasonCode.HARD_BOUNCE, label: BLOCKED_CONTACT_REASON_LABELS[BlockedContactReasonCode.HARD_BOUNCE] },
    { code: BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM, label: BLOCKED_CONTACT_REASON_LABELS[BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM] }
  ];

  async ngOnInit() {
    this.initialiseDateFilterDefaults();
    this.subscriptions.push(
      this.activatedRoute.queryParams.subscribe(params => {
        const search = params[StoredValue.SEARCH];
        const sort = this.uiActions.queryValueForAlias(params[StoredValue.SORT], values(UnsubscribeSortField));
        const sortOrder = params[StoredValue.SORT_ORDER];
        const status = params[StoredValue.STATUS];
        const subTab = params[StoredValue.SUB_TAB];
        const startDate = params[StoredValue.START_DATE];
        const endDate = params[StoredValue.END_DATE];
        const sender = params[StoredValue.SENDER];
        if (search !== undefined && search !== null) {
          this.searchTerm = search || "";
        }
        if (sort) {
          this.sortField = sort as UnsubscribeSortField;
        }
        if (sortOrder === SortDirection.ASC || sortOrder === SortDirection.DESC) {
          this.sortDirection = sortOrder;
        }
        if (status) {
          this.reasonFilter = status;
        }
        if (subTab === UnsubscribesListMode.Blocks || subTab === UnsubscribesListMode.Unsubscribes) {
          const previousMode = this.mode;
          this.mode = subTab as UnsubscribesListMode;
          if (previousMode !== this.mode && this.configLoaded) {
            if (this.mode === UnsubscribesListMode.Unsubscribes) {
              void this.loadActivity();
            } else {
              void this.loadUnsubscribes();
            }
          }
        }
        if (startDate || endDate) {
          const fromMs = startDate ? this.dateUtils.asDateTime(startDate).startOf("day").toMillis() : this.dateFilterRange?.from;
          const toMs = endDate ? this.dateUtils.asDateTime(endDate).endOf("day").toMillis() : this.dateFilterRange?.to;
          if (Number.isFinite(fromMs) || Number.isFinite(toMs)) {
            this.dateFilterRange = { from: fromMs, to: toMs };
          }
        }
        if (sender) {
          this.senderFilter = sender;
        }
      })
    );
    this.subscriptions.push(
      this.mailMessagingService.events().subscribe(async mailMessagingConfig => {
        this.rebuildListNameMap(mailMessagingConfig?.brevo?.lists?.lists);
        this.committeeMembers = mailMessagingConfig?.committeeReferenceData?.committeeMembers?.() || [];
        if (mailMessagingConfig?.brevo?.accountError) {
          this.logger.info("Brevo account not configured — skipping unsubscribes load");
          this.errorMessage = "Brevo account is not configured. Configure the API key on the Mail API Settings tab first.";
          this.loading = false;
          this.configLoaded = false;
        } else {
          this.configLoaded = true;
          await this.loadAvailableSenders();
          if (this.mode === UnsubscribesListMode.Unsubscribes) {
            await this.loadActivity();
          } else {
            await this.loadUnsubscribes();
          }
        }
      })
    );
  }

  private async loadAvailableSenders(): Promise<void> {
    try {
      const response = await this.mailService.querySenders();
      this.availableSenders = response?.senders || [];
    } catch (error) {
      this.logger.error("loadAvailableSenders:failed", error);
      this.availableSenders = [];
    }
  }

  private rebuildListNameMap(lists: ListInfo[] | undefined): void {
    this.listNameById.clear();
    (lists || []).forEach(list => {
      if (Number.isFinite(list?.id)) this.listNameById.set(list.id, list.name);
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async loadUnsubscribes(): Promise<void> {
    if (this.mode === UnsubscribesListMode.Unsubscribes) {
      return this.loadActivity();
    }
    this.loading = true;
    this.errorMessage = null;
    try {
      const dateRangeOverridden = this.dateRangeOverridesDefault();
      const request = {
        sort: this.sortDirection,
        startDate: dateRangeOverridden ? this.formatRangeDate(this.dateFilterRange?.from) : undefined,
        endDate: dateRangeOverridden ? this.formatRangeDate(this.dateFilterRange?.to) : undefined,
        senders: this.senderFilter && this.senderFilter !== ALL_SENDERS ? [this.senderFilter] : undefined
      };
      const response = await this.mailService.queryUnsubscribes(request);
      this.unsubscribes = response?.contacts || [];
      this.totalCount = response?.count ?? this.unsubscribes.length;
      this.logger.info("loaded unsubscribes:", this.unsubscribes.length, "of", this.totalCount);
    } catch (error) {
      this.errorMessage = this.stringUtils.stringify(error?.error?.error || error?.error || error?.message || error) || "Failed to load unsubscribes";
      this.logger.error("Failed to load unsubscribes:", error);
      this.unsubscribes = [];
      this.totalCount = 0;
    } finally {
      this.loading = false;
    }
  }

  async loadActivity(): Promise<void> {
    this.loading = true;
    this.errorMessage = null;
    try {
      const dateRangeOverridden = this.dateRangeOverridesDefault();
      const response = await this.mailService.queryUnsubscribeActivity({
        sort: this.sortDirection,
        startDate: dateRangeOverridden ? this.formatRangeDate(this.dateFilterRange?.from) : undefined,
        endDate: dateRangeOverridden ? this.formatRangeDate(this.dateFilterRange?.to) : undefined
      });
      this.activity = response?.activity || [];
      this.totalCount = response?.count ?? this.activity.length;
    } catch (error) {
      this.errorMessage = this.stringUtils.stringify(error?.error?.error || error?.error || error?.message || error) || "Failed to load unsubscribe activity";
      this.logger.error("loadActivity:failed", error);
      this.activity = [];
      this.totalCount = 0;
    } finally {
      this.loading = false;
    }
  }

  setMode(mode: UnsubscribesListMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === UnsubscribesListMode.Unsubscribes) {
      this.loadActivity();
    } else {
      this.loadUnsubscribes();
    }
    this.updateQueryParams();
  }

  sortedActivity(): UnsubscribeActivity[] {
    const term = this.searchTerm?.toLowerCase()?.trim();
    const filtered = !term ? this.activity : this.activity.filter(event => {
      return event.email?.toLowerCase().includes(term)
        || event.displayName?.toLowerCase().includes(term)
        || event.firstName?.toLowerCase().includes(term)
        || event.lastName?.toLowerCase().includes(term)
        || event.membershipNumber?.toLowerCase().includes(term)
        || event.listName?.toLowerCase().includes(term)
        || event.comment?.toLowerCase().includes(term);
    });
    return [...filtered].sort((a, b) => {
      const aVal = this.activitySortValue(a, this.sortField);
      const bVal = this.activitySortValue(b, this.sortField);
      const comparison = aVal.localeCompare(bVal);
      return this.sortDirection === SortDirection.ASC ? comparison : -comparison;
    });
  }

  private activitySortValue(event: UnsubscribeActivity, field: UnsubscribeSortField): string {
    switch (field) {
      case UnsubscribeSortField.NAME:
        return this.activityDisplay(event).toLowerCase();
      case UnsubscribeSortField.LIST_NAME:
        return (event.listName || "").toLowerCase();
      case UnsubscribeSortField.REASON_CODE:
        return (event.reason || "").toLowerCase();
      case UnsubscribeSortField.BLOCKED_AT:
      default:
        return event.unsubscribedAt || "";
    }
  }

  activityDisplay(event: UnsubscribeActivity): string {
    const parts = [event.firstName, event.lastName].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    return event.displayName || event.email || event.memberId || "";
  }

  trackByActivity(index: number, event: UnsubscribeActivity): string {
    return `${event.memberId || ""}-${event.listId}-${event.unsubscribedAt}-${index}`;
  }

  private formatRangeDate(millis: number | undefined): string | undefined {
    if (!millis || !Number.isFinite(millis)) return undefined;
    return this.dateUtils.asDateTime(millis).toFormat(UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES);
  }

  private dateRangeOverridesDefault(): boolean {
    if (!this.dateFilterRange || !this.dateFilterMinDate || !this.dateFilterMaxDate) return false;
    const defaultFrom = this.dateFilterMinDate.toMillis();
    const defaultTo = this.dateFilterMaxDate.toMillis();
    const fromShifted = Math.abs((this.dateFilterRange.from ?? defaultFrom) - defaultFrom) > 24 * 3600 * 1000;
    const toShifted = Math.abs((this.dateFilterRange.to ?? defaultTo) - defaultTo) > 24 * 3600 * 1000;
    return fromShifted || toShifted;
  }

  hasServerSideFilters(): boolean {
    return this.dateRangeOverridesDefault()
      || (!!this.senderFilter && this.senderFilter !== ALL_SENDERS);
  }

  resetServerSideFilters(): void {
    this.senderFilter = ALL_SENDERS;
    this.initialiseDateFilterDefaults();
    this.loadUnsubscribes();
  }

  onSenderFilterChange(): void {
    this.loadUnsubscribes();
    this.updateQueryParams();
  }

  onDateRangeChange(range: DateRange): void {
    this.dateFilterRange = range;
    this.loadUnsubscribes();
    this.updateQueryParams();
  }

  private initialiseDateFilterDefaults(): void {
    const now = this.dateUtils.dateTimeNow();
    this.dateFilterMaxDate = now;
    this.dateFilterMinDate = now.minus({ years: 2 });
    this.dateFilterRange = {
      from: this.dateFilterMinDate.toMillis(),
      to: this.dateFilterMaxDate.toMillis()
    };
  }

  private unsubscribeSortValue(contact: BlockedContact, field: UnsubscribeSortField): string {
    if (field === UnsubscribeSortField.REASON_CODE) {
      return this.reasonLabel(contact.reason?.code).toLowerCase();
    }
    if (field === UnsubscribeSortField.BLOCKED_AT) {
      return contact.blockedAt || "";
    }
    return String((contact as any)[field] ?? "").toLowerCase();
  }

  filteredUnsubscribes(): BlockedContact[] {
    const term = this.searchTerm?.toLowerCase()?.trim();
    const filtered = this.unsubscribes.filter(contact => {
      const matchedMember = contact.matchedMember;
      const matchesSearch = !term
        || contact.email?.toLowerCase().includes(term)
        || contact.senderEmail?.toLowerCase().includes(term)
        || contact.reason?.message?.toLowerCase().includes(term)
        || matchedMember?.membershipNumber?.toLowerCase().includes(term)
        || matchedMember?.displayName?.toLowerCase().includes(term)
        || matchedMember?.firstName?.toLowerCase().includes(term)
        || matchedMember?.lastName?.toLowerCase().includes(term);
      const matchesReason = this.reasonFilter === ALL_REASONS
        || contact.reason?.code === this.reasonFilter;
      return matchesSearch && matchesReason;
    });
    return filtered.sort((a, b) => {
      const aVal = this.unsubscribeSortValue(a, this.sortField);
      const bVal = this.unsubscribeSortValue(b, this.sortField);
      const comparison = aVal.localeCompare(bVal);
      return this.sortDirection === SortDirection.ASC ? comparison : -comparison;
    });
  }

  toggleSort(field: UnsubscribeSortField) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === SortDirection.ASC ? SortDirection.DESC : SortDirection.ASC;
    } else {
      this.sortField = field;
      this.sortDirection = field === UnsubscribeSortField.BLOCKED_AT ? SortDirection.DESC : SortDirection.ASC;
    }
    this.updateQueryParams();
  }

  sortIcon(field: UnsubscribeSortField) {
    if (this.sortField !== field) {
      return faSort;
    }
    return this.sortDirection === SortDirection.ASC ? faSortUp : faSortDown;
  }

  updateQueryParams() {
    const dateRangeOverridden = this.dateRangeOverridesDefault();
    this.uiActions.updateQueryParameters({
      [StoredValue.SEARCH]: this.searchTerm || null,
      [StoredValue.SORT]: this.sortField ? this.uiActions.queryValueAliasFor(this.sortField) : null,
      [StoredValue.SORT_ORDER]: this.sortDirection || null,
      [StoredValue.STATUS]: this.reasonFilter === ALL_REASONS ? null : this.reasonFilter,
      [StoredValue.SUB_TAB]: this.mode || null,
      [StoredValue.START_DATE]: dateRangeOverridden ? this.formatRangeDate(this.dateFilterRange?.from) : null,
      [StoredValue.END_DATE]: dateRangeOverridden ? this.formatRangeDate(this.dateFilterRange?.to) : null,
      [StoredValue.SENDER]: this.senderFilter && this.senderFilter !== ALL_SENDERS ? this.senderFilter : null
    });
  }

  reasonLabel(code: string | undefined): string {
    if (!code) return "No reason supplied";
    return BLOCKED_CONTACT_REASON_LABELS[code] || code;
  }

  reasonIcon(code: string | undefined) {
    return !code
      ? null
      : code === BlockedContactReasonCode.HARD_BOUNCE
        ? faExclamationTriangle
        : (code === BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM
          || code === BlockedContactReasonCode.ADMIN_BLOCKED
          || code === BlockedContactReasonCode.EMAIL_DENIED)
          ? faBan
          : faEnvelopeOpen;
  }

  reasonBadgeClass(code: string | undefined): string {
    return !code
      ? "bg-light text-muted border"
      : code === BlockedContactReasonCode.HARD_BOUNCE
        ? "bg-warning text-dark"
        : (code === BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM
          || code === BlockedContactReasonCode.ADMIN_BLOCKED
          || code === BlockedContactReasonCode.EMAIL_DENIED)
          ? "bg-danger text-white"
          : "bg-info text-white";
  }

  showGlobalDenyHint(contact: BlockedContact): boolean {
    return !!contact.emailBlocked
      && contact.reason?.code !== BlockedContactReasonCode.EMAIL_DENIED;
  }

  listsCellTooltip(contact: BlockedContact): string {
    const names = this.contactListNames(contact);
    const listPart = names.length > 0 ? names.join(", ") : "No list memberships on this contact";
    return this.showGlobalDenyHint(contact)
      ? `${listPart}. Also globally denied for email on the Brevo contact.`
      : listPart;
  }

  reasonTooltip(contact: BlockedContact): string {
    return !contact?.reason?.code
      ? "Brevo did not return a reason code for this block"
      : contact.reason.message || this.reasonLabel(contact.reason.code);
  }

  formatBlockedAt(value: string): string {
    if (!value) return "";
    const formatted = this.dateUtils.displayDateAbbreviatedTime(value);
    return formatted || value;
  }

  formatSenderEmail(value: string | undefined): string {
    if (!value) return "";
    const angleMatch = value.match(/<([^>]+)>/);
    return (angleMatch ? angleMatch[1] : value).trim();
  }

  senderDisplay(contact: BlockedContact): string {
    const email = this.formatSenderEmail(contact.senderEmail);
    const match = email
      ? this.committeeMembers.find(member => member.email?.toLowerCase() === email.toLowerCase())
      : null;
    return match?.description || match?.fullName || contact.senderName || email || "—";
  }

  senderTooltip(contact: BlockedContact): string | null {
    const email = this.formatSenderEmail(contact.senderEmail);
    const display = this.senderDisplay(contact);
    return !email
      ? null
      : display === email
        ? email
        : `${display} · ${email}`;
  }

  formatRelatedDetail(detail: string): string {
    return detail
      .split(" · ")
      .map(part => {
        const atIndex = part.lastIndexOf(" at ");
        const label = atIndex < 0 ? part : part.slice(0, atIndex);
        const iso = atIndex < 0 ? "" : part.slice(atIndex + 4);
        const formatted = iso ? this.formatBlockedAt(iso) : "";
        return atIndex < 0
          ? part
          : formatted
            ? `Also ${label.toLowerCase()} · ${formatted}`
            : part;
      })
      .join(" · ");
  }

  memberDisplay(contact: BlockedContact): string {
    const match = contact.matchedMember;
    if (!match) return "";
    const parts = [match.firstName, match.lastName].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    if (match.displayName) return match.displayName;
    return match.membershipNumber ? `Member #${match.membershipNumber}` : "Matched";
  }

  contactDisplay(contact: BlockedContact): string {
    return this.memberDisplay(contact) || contact.email || "";
  }

  feedbackReasonLabel(reason: string | undefined): string {
    if (!reason) return "";
    return UNSUBSCRIBE_FEEDBACK_REASON_LABELS[reason] || reason;
  }

  feedbackTooltip(feedback: { reason: string; comment?: string; recordedAt?: string }): string {
    const parts: string[] = [];
    parts.push(`Reason: ${this.feedbackReasonLabel(feedback.reason)}`);
    if (feedback.comment) parts.push(`Comment: ${feedback.comment}`);
    if (feedback.recordedAt) parts.push(`Submitted: ${this.dateUtils.displayDateAbbreviatedTime(feedback.recordedAt) || feedback.recordedAt}`);
    return parts.join(" · ");
  }

  memberAdminQueryParams(membershipNumber: string): { [key: string]: string } {
    return { [this.stringUtils.kebabCase(StoredValue.MEMBER_ID)]: membershipNumber };
  }

  contactListNames(contact: BlockedContact): string[] {
    const ids = contact.listIds || [];
    if (ids.length === 0) return [];
    return ids
      .map(id => this.listNameById.get(id) || `#${id}`)
      .sort((a, b) => a.localeCompare(b));
  }

  writebackLabel(status: SalesforceWritebackStatus | undefined): string {
    switch (status) {
    case SalesforceWritebackStatus.SYNCED:
      return "Synced";
    case SalesforceWritebackStatus.PENDING:
      return "Pending";
    case SalesforceWritebackStatus.FAILED:
      return "Failed";
    default:
      return "N/A";
    }
  }

  writebackBadgeClass(status: SalesforceWritebackStatus | undefined): string {
    switch (status) {
    case SalesforceWritebackStatus.SYNCED:
      return "bg-success text-white";
    case SalesforceWritebackStatus.PENDING:
      return "bg-warning text-dark";
    case SalesforceWritebackStatus.FAILED:
      return "bg-danger text-white";
    default:
      return "bg-gray text-dark border";
    }
  }

  writebackTooltip(contact: BlockedContact): string {
    const writeback = contact.salesforceWriteback;
    if (!writeback) return "";
    switch (writeback.status) {
    case SalesforceWritebackStatus.NOT_APPLICABLE:
      return contact.matchedMember
        ? "Matched member has no membership number - writeback not applicable"
        : "No matching NGX member - writeback not applicable";
    case SalesforceWritebackStatus.PENDING:
      return "Awaiting Ramblers Team Emails consent writeback";
    case SalesforceWritebackStatus.SYNCED:
      return writeback.updatedAt ? `Synced at ${writeback.updatedAt}` : "Synced";
    case SalesforceWritebackStatus.FAILED:
      return writeback.message || "Writeback failed";
    default:
      return "";
    }
  }

  trackByContact(index: number, contact: BlockedContact): string {
    return `${contact.email || ""}-${contact.senderEmail || ""}-${contact.blockedAt || ""}-${index}`;
  }

  startRemoveFromBlocklist(contact: BlockedContact): void {
    this.pendingRemovalEmail = contact.email;
    this.errorMessage = null;
  }

  cancelRemoveFromBlocklist(): void {
    this.pendingRemovalEmail = null;
  }

  manageDropdownItems(): BrevoDropdownItem[] {
    return [
      { id: "refresh", label: "Refresh" },
      { id: "clear-all-blocks", label: "Clear all blocks", disabled: this.unsubscribes.length === 0 || this.pendingClearAll || this.mode !== UnsubscribesListMode.Blocks }
    ];
  }

  handleManageDropdown(item: BrevoDropdownItem): void {
    if (item.id === "refresh") {
      this.loadUnsubscribes();
    } else if (item.id === "clear-all-blocks") {
      this.startClearAllBlocklist();
    }
  }

  onModeChange(value: string): void {
    if (value === UnsubscribesListMode.Blocks || value === UnsubscribesListMode.Unsubscribes) {
      this.setMode(value as UnsubscribesListMode);
    }
  }

  startClearAllBlocklist(): void {
    this.pendingClearAll = true;
    this.errorMessage = null;
    this.clearAllResult = null;
  }

  cancelClearAllBlocklist(): void {
    this.pendingClearAll = false;
  }

  async confirmClearAllBlocklist(): Promise<void> {
    if (this.clearAllInProgress) return;
    this.clearAllInProgress = true;
    this.errorMessage = null;
    try {
      this.clearAllResult = await this.mailService.clearAllBlocklist();
      this.pendingClearAll = false;
      await this.loadUnsubscribes();
    } catch (error) {
      this.errorMessage = this.stringUtils.stringify(error?.error?.error || error?.error || error?.message || error) || "Failed to clear Brevo blocklist";
      this.logger.error("clearAllBlocklist:failed", error);
    } finally {
      this.clearAllInProgress = false;
    }
  }

  async confirmRemoveFromBlocklist(contact: BlockedContact): Promise<void> {
    if (!contact?.email || this.removalInProgress) return;
    this.removalInProgress = true;
    this.errorMessage = null;
    try {
      await this.mailService.removeFromBlocklist(contact.email);
      this.pendingRemovalEmail = null;
      await this.loadUnsubscribes();
    } catch (error) {
      this.errorMessage = this.stringUtils.stringify(error?.error?.error || error?.error || error?.message || error) || `Failed to remove ${contact.email} from Brevo blocklist`;
      this.logger.error("removeFromBlocklist:failed", error);
    } finally {
      this.removalInProgress = false;
    }
  }

  protected readonly faBan = faBan;
  protected readonly faExclamationTriangle = faExclamationTriangle;
}
