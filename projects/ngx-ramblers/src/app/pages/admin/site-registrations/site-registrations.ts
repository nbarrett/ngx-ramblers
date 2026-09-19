import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowUpRightFromSquare, faChevronDown, faChevronRight, faCircleExclamation, faCircleCheck, faCheck, faRotate, faSpinner, faWrench, faKey, faStop, faPen, faTrash, faSave, faPlus, faXmark, faGears, faEnvelope, faMagnifyingGlass, faEllipsisVertical } from "@fortawesome/free-solid-svg-icons";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { NgSelectComponent } from "@ng-select/ng-select";
import { kebabCase, values } from "es-toolkit/compat";
import { PageComponent } from "../../../page/page.component";
import { SiteRegistrationService } from "../../../services/site-registration.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { RegistrationAdminTab, RegistrationEmailApproval, RegistrationHistoryRow, RegistrationPageAnchor, RegistrationSettings, RegistrationState, SiteRegistration } from "../../../models/site-registration.model";
import { AvailableArea } from "../../../models/system.model";
import { ComposerExternalRecipient } from "../../../models/email-composer.model";
import { RamblersGroupsApiResponse } from "../../../models/ramblers-walks-manager";
import { GroupSelector } from "../../walks/walk-edit/group-selector";
import { RecipientFieldComponent } from "../../../modules/common/recipient-field/recipient-field";
import { AdminPlatformPath } from "../../../models/admin-route-paths.model";
import { EnvironmentSetupTab, SetupMode } from "../../../models/environment-setup.model";
import { StoredValue } from "../../../models/ui-actions";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective, SortableTableExpandedRowDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { ASCENDING } from "../../../models/table-filtering.model";
import { AlertPanelVariant } from "../../../models/alert-panel.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { Subscription, timer } from "rxjs";
import { registrationProgressLines, sanitiseRegistrationMessage } from "../../../functions/registration-progress";
import { approvalAreaLabel, approvalCode, approvalGroupLabel, approvalRecipientNames, approvalRecipients } from "../../../functions/registration-settings";
import { AreaSelector } from "../../walks/walk-edit/area-selector";
import { RegistrationProgressLogComponent } from "../../../modules/common/registration-progress-log/registration-progress-log";
import { latestBuildSpan, registrationHistoryRows } from "../../../functions/registration-history";
import { DateUtilsService } from "../../../services/date-utils.service";
import { RegistrationStepperComponent } from "../../../modules/common/registration-stepper/registration-stepper";

@Component({
  selector: "app-site-registrations",
  imports: [FormsModule, NgClass, RouterLink, BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, FontAwesomeModule, TooltipModule, TabDirective, TabsetComponent, NgSelectComponent, PageComponent, SortableTableComponent, SortableTableCellDirective, SortableTableExpandedRowDirective, RegistrationProgressLogComponent, GroupSelector, AreaSelector, RecipientFieldComponent, RegistrationStepperComponent],
  styles: [`
    .registration-action-item
      display: flex
      align-items: center
      gap: 0.5rem

      fa-icon
        flex: 0 0 1.25rem
        text-align: center

    .registration-actions
      grid-auto-flow: column
      justify-content: end
      &:has(> :nth-child(4))
        grid-auto-flow: row
        grid-template-columns: repeat(3, auto)
      &:has(> :nth-child(4)):not(:has(> :nth-child(5)))
        grid-template-columns: repeat(2, auto)

    .registration-details-toggle
      display: flex
      align-items: flex-start
      gap: 0.5rem
      width: 100%
      margin: 0
      padding: 0
      border: 0
      background: none
      color: inherit
      text-align: left
      cursor: pointer

    .registration-details-toggle fa-icon
      flex-shrink: 0
      margin-top: 0.15rem

    .registration-details-text
      min-width: 0
      overflow-wrap: anywhere
      display: -webkit-box
      -webkit-line-clamp: 2
      line-clamp: 2
      -webkit-box-orient: vertical
      overflow: hidden
      text-align: left
  `],
  template: `
    <app-page pageTitle="Site registrations">
      <p>Use this page to switch site registration on for groups and areas, follow each request, and decide who may start one. <a routerLink="/how-to/group-registration">How to use this</a>.</p>
      <div class="mb-3">
        <a class="btn btn-primary btn-sm" routerLink="/register"><fa-icon [icon]="icons.open" [fixedWidth]="true"/>Open the registration form</a>
      </div>
      @if (message) { <div class="alert d-flex align-items-start" [class.alert-success]="messageVariant === AlertVariant.SUCCESS" [class.alert-danger]="messageVariant === AlertVariant.DANGER" [class.alert-warning]="messageVariant === AlertVariant.WARNING"><fa-icon [icon]="messageVariant === AlertVariant.SUCCESS ? icons.success : icons.warning" class="me-2"/><div><strong>{{messageTitle}}</strong><p>{{message}}</p></div></div> }
      @if (reviewUrl) {
        <div class="alert alert-success d-flex align-items-start"><fa-icon [icon]="icons.success" class="me-2"/><div>
          <strong>Reviewer sign-in</strong>
          <p class="mb-1">{{messageTitle}}</p>
          <a [href]="reviewUrl" target="_blank" rel="noopener noreferrer">Set a password and open the site</a>
        </div></div>
      }
      <tabset class="custom-tabset">
        <tab [active]="tabActive(AdminTab.REGISTRATION_REQUESTS)" (selectTab)="selectTab(AdminTab.REGISTRATION_REQUESTS)" [heading]="AdminTab.REGISTRATION_REQUESTS">
          @if (tabActive(AdminTab.REGISTRATION_REQUESTS)) {
            @if (settings) {
              <div class="thumbnail-heading-frame mt-3" [id]="Anchor.PUBLIC_REGISTRATION"><div class="thumbnail-heading">Public registration</div>
                <p>New sites reuse this site's mail, maps and hosting keys. You are the reviewer. Confirmation links use this website.</p>
                <div class="d-flex flex-wrap align-items-center gap-3 mb-2">
                  <label class="mb-0"><input type="checkbox" [(ngModel)]="settings.enabled"/> Enable public registration</label>
                  <button class="btn btn-primary" [disabled]="busy" (click)="saveSettings()"><fa-icon [icon]="icons.save"/> Save</button>
                </div>
                <label class="d-block"><input type="checkbox" [(ngModel)]="settings.committeeEmailValidationEnabled"/> Require the email address to be on the group's approved committee list</label>
                <label class="d-block"><input type="checkbox" [(ngModel)]="settings.sourceFidelityValidationEnabled"/> Stop a Full migration when source content is missing from the result</label>
                <p class="guidance">This check allows formatting cleanup and grammar corrections. Turn it off only when diagnosing a source site that cannot pass the completeness check.</p>
                @if (!settings.committeeEmailValidationEnabled) {
                  <div class="alert alert-warning d-flex align-items-start mt-2"><fa-icon [icon]="icons.warning" class="me-2"/><div>
                    <strong>Committee email validation is off</strong>
                    <p>Any valid email address can request a confirmation link for a directory group.</p>
                  </div></div>
                }
              </div>
            }
            <div class="thumbnail-heading-frame mt-3"><div class="thumbnail-heading">Registration requests</div>
              <p>New requests appear here after a group starts registration. Open the build log from a row when you need the error or step list. Use Retry from there.</p>
              @if (inFlightRows().length) {
                <div class="alert alert-success d-flex align-items-start mb-2"><fa-icon [icon]="icons.running" animation="spin" class="me-2"/><div>
                  <strong>Build in progress</strong>
                  <p class="mb-0">{{inFlightRows().map(row => row.group?.name + " (" + row.state + ")").join(", ")}}. The log under the row updates every few seconds.</p>
                </div></div>
              }
              <div class="row g-2 align-items-end mb-2">
                <div class="col-12 col-md">
                  <label for="registration-state">Registration state</label>
                  <ng-select id="registration-state" [items]="states" [multiple]="true" [closeOnSelect]="false" [clearable]="true" [(ngModel)]="selectedStates" (ngModelChange)="filterChanged()" placeholder="All states"/>
                </div>
                <div class="col-12 col-md-auto">
                  <button class="btn btn-quiet" [disabled]="busy" (click)="refresh()"><fa-icon [icon]="icons.retry"/> Refresh requests</button>
                </div>
              </div>
              @if (loading) {
                <div class="alert alert-warning d-flex align-items-center"><fa-icon [icon]="icons.running" animation="spin" class="me-2"/><strong>Loading registrations</strong></div>
              } @else {
              <app-sortable-table [rows]="filteredRegistrations()" [columns]="columns" [defaultSortKey]="sort.key" [defaultSortDirection]="sort.direction" emptyMessage="No registrations match this state." [expandedWhen]="rowExpanded" (sortChange)="sortChanged($event)">
                <ng-template appSortableTableCell="progress" let-row>
                  <app-registration-stepper [stages]="row.stages"/>
                </ng-template>
                <ng-template appSortableTableCell="error" let-row>
                  @if (hasBuildLog(row)) {
                    <button type="button" class="registration-details-toggle" [class.text-danger]="siteUnreachable(row) && !inFlight(row)" [tooltip]="detailsTooltip(row)" (click)="toggleBuildLog(row)">
                      <fa-icon [icon]="inFlight(row) ? icons.running : (buildLogOpen(row) ? icons.collapse : icons.expand)" [animation]="inFlight(row) ? 'spin' : undefined"/>
                      @if (siteUnreachable(row) && !inFlight(row)) {
                        <fa-icon [icon]="icons.warning"/>
                      }
                      <span class="registration-details-text">{{detailsText(row)}}</span>
                    </button>
                  } @else {
                    <span class="registration-details-text">{{row.error || ""}}</span>
                  }
                </ng-template>
                <ng-template appSortableTableCell="actions" let-row>
                  <div class="btn-group" dropdown container="body" placement="bottom right">
                    <button class="btn btn-primary btn-sm dropdown-toggle" dropdownToggle type="button" [disabled]="rowBusy(row)">
                      <fa-icon [icon]="icons.actions"/><span class="ms-2">Actions</span><span class="caret"></span>
                    </button>
                    <ul *dropdownMenu class="dropdown-menu dropdown-menu-end" role="menu">
                      @if (row.state === State.REVIEW) {
                        <li role="menuitem"><a class="dropdown-item registration-action-item" (click)="reviewLogin(row)"><fa-icon [icon]="icons.key" [fixedWidth]="true"/>Open reviewer login</a></li>
                        <li role="menuitem"><a class="dropdown-item registration-action-item" [ngClass]="{'disabled': siteUnreachable(row)}" [tooltip]="siteUnreachable(row) ? 'The public hostname is not live yet' : ''" (click)="approve(row)"><fa-icon [icon]="icons.check" [fixedWidth]="true"/>Approve and invite the group</a></li>
                        <li role="menuitem"><a class="dropdown-item registration-action-item" (click)="retry(row)"><fa-icon [icon]="icons.retry" [fixedWidth]="true"/>Run import again</a></li>
                        <li role="menuitem"><a class="dropdown-item registration-action-item" (click)="rediscover(row)"><fa-icon [icon]="icons.findPages" [fixedWidth]="true"/>Find pages again, then rebuild</a></li>
                        <li role="menuitem"><a class="dropdown-item registration-action-item" (click)="broken(row)"><fa-icon [icon]="icons.wrench" [fixedWidth]="true"/>Mark broken</a></li>
                      }
                      @if (row.state === State.AWAITING_EMAIL || row.state === State.DRAFT) {
                        <li role="menuitem"><a class="dropdown-item registration-action-item" (click)="emailReturnLink(row)"><fa-icon [icon]="icons.email" [fixedWidth]="true"/>Email a fresh return link</a></li>
                      }
                      @if (inFlight(row)) {
                        <li role="menuitem"><a class="dropdown-item registration-action-item" (click)="stop(row)"><fa-icon [icon]="icons.stop" [fixedWidth]="true"/>Stop this build</a></li>
                      }
                      @if (row.state === State.FAILED || row.state === State.BROKEN) {
                        <li role="menuitem"><a class="dropdown-item registration-action-item" (click)="retry(row)"><fa-icon [icon]="icons.retry" [fixedWidth]="true"/>Retry from saved progress</a></li>
                        <li role="menuitem"><a class="dropdown-item registration-action-item" (click)="rediscover(row)"><fa-icon [icon]="icons.findPages" [fixedWidth]="true"/>Find pages again, then rebuild</a></li>
                      }
                      @if (openSiteUrl(row)) {
                        <li role="menuitem"><a class="dropdown-item registration-action-item" [ngClass]="{'disabled': inFlight(row)}" [href]="openSiteUrl(row)" target="_blank" rel="noopener noreferrer"><fa-icon [icon]="icons.open" [fixedWidth]="true"/>{{siteUnreachable(row) ? "Open working Fly site" : "Open site"}}</a></li>
                      }
                      @if (siteUnreachable(row)) {
                        <li role="menuitem"><a class="dropdown-item registration-action-item" [ngClass]="{'disabled': inFlight(row)}" [routerLink]="'/' + setupPath" [queryParams]="setupQuery(row)" [tooltip]="siteHealthTooltip(row)"><fa-icon [icon]="icons.setup" [fixedWidth]="true"/>Environment setup</a></li>
                      }
                      @if (!inFlight(row)) {
                        <li class="dropdown-divider"></li>
                        <li role="menuitem"><a class="dropdown-item registration-action-item text-danger" (click)="pendingDelete = row"><fa-icon [icon]="icons.trash" [fixedWidth]="true"/>Delete this registration request</a></li>
                      }
                    </ul>
                  </div>
                </ng-template>
                <ng-template appSortableTableExpandedRow let-row>
                  @if (pendingDelete?.id === row.id) {
                    <div class="alert alert-warning d-flex align-items-start mb-2"><fa-icon [icon]="icons.warning" class="me-2"/><div>
                      <strong>Delete the registration request for {{row.group?.name}}?</strong>
                      <p>This only removes the registration request. @if (row.siteUrl) {The review site and its environment stay as they are; destroy them from Environment setup if they are no longer needed.} @else {Nothing was built for it.} The group can then start again from /register.</p>
                      <button class="btn btn-primary me-2" [disabled]="busy" (click)="deleteRegistration()"><fa-icon [icon]="icons.trash"/> Delete request</button>
                      <button class="btn btn-quiet" [disabled]="busy" (click)="pendingDelete = null"><fa-icon [icon]="icons.cancel"/> Cancel</button>
                    </div></div>
                  }
                  @if (row.error && (row.state === State.FAILED || row.state === State.BROKEN)) {
                    <div class="alert alert-danger d-flex align-items-start mb-2"><fa-icon [icon]="icons.warning" class="me-2"/><div><strong>What went wrong</strong><p class="mb-0">{{sanitiseError(row.error)}}</p></div></div>
                  }
                  @if (row.progress?.length || inFlight(row)) {
                    <app-registration-progress-log class="d-block mb-2" [progress]="row.progress" [inFlight]="inFlight(row)"/>
                  }
                  @if (row.history?.length) {
                    <details class="mb-2">
                      <summary>History ({{ row.history.length }})</summary>
                      <table class="table table-sm mt-2 mb-0">
                        <thead><tr><th>When</th><th>Step</th><th>By</th><th>Took</th></tr></thead>
                        <tbody>
                          @for (entry of historyRows(row); track entry.at) {
                            <tr>
                              <td class="nowrap">{{ dateUtils.displayDateAndTime(entry.at) }}</td>
                              <td>{{ entry.label }}</td>
                              <td>{{ entry.by }}</td>
                              <td class="nowrap">{{ entry.sincePrevious === null ? "" : dateUtils.formatDuration(0, entry.sincePrevious) }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </details>
                  }
                </ng-template>
              </app-sortable-table>
              }
            </div>
          }
        </tab>
        <tab [active]="tabActive(AdminTab.APPROVED_EMAILS)" (selectTab)="selectTab(AdminTab.APPROVED_EMAILS)" [heading]="AdminTab.APPROVED_EMAILS">
          @if (settings && tabActive(AdminTab.APPROVED_EMAILS)) {
            <div class="thumbnail-heading-frame mt-3"><div class="thumbnail-heading">Approved committee email addresses</div>
              <p>When committee email validation is on, only these addresses can start registration for that group.</p>
              <app-area-selector id="approval-area" label="Area" [areaCode]="approvalArea" (areaChanged)="approvalAreaChanged($event)"/>
              <app-group-selector label="Group (leave empty to approve for the area site)" [areaCode]="approvalArea" [groupCode]="approvalGroup" (groupChanged)="approvalGroupChanged($event)"/>
              <label class="mt-2">Approved email addresses</label>
              <app-recipient-field [to]="approvalRecipients" (toChange)="approvalRecipients = $event" [plain]="true"/>
              <div class="d-flex flex-wrap gap-2 my-2">
                <button class="btn btn-primary" [disabled]="busy || !approvalArea || !approvalRecipients.length" (click)="saveApproval()"><fa-icon [icon]="icons.save"/> {{ editingApproval() ? "Save changes" : "Save approval" }}</button>
                @if (approvalArea || approvalGroup || approvalRecipients.length) {
                  <button class="btn btn-quiet" [disabled]="busy" (click)="clearApproval()"><fa-icon [icon]="icons.cancel"/> Cancel</button>
                }
              </div>
              <app-sortable-table [rows]="settings.approvedEmails" [columns]="approvalColumns" [defaultSortKey]="approvalSort.key" [defaultSortDirection]="approvalSort.direction" emptyMessage="No committee email addresses have been approved." (sortChange)="approvalSortChanged($event)">
                <ng-template appSortableTableCell="actions" let-row>
                  <div class="d-flex flex-wrap gap-2 justify-content-end">
                    <button class="btn btn-quiet btn-icon" tooltip="Edit approved addresses" [disabled]="busy" (click)="editApproval(row)"><fa-icon [icon]="icons.edit"/></button>
                    <button class="btn btn-quiet btn-icon" tooltip="Remove approval" [disabled]="busy" (click)="pendingRemoval = approvalCode(row)"><fa-icon [icon]="icons.trash"/></button>
                  </div>
                </ng-template>
              </app-sortable-table>
              @if (pendingRemoval) { <div class="alert alert-warning d-flex align-items-start mt-2"><fa-icon [icon]="icons.warning" class="me-2"/><div><strong>Remove email approval for {{pendingRemoval}}?</strong><p>New registration requests for this group or area will no longer be authorised by this list.</p><button class="btn btn-primary me-2" [disabled]="busy" (click)="removeApproval()"><fa-icon [icon]="icons.trash"/> Remove from list</button><button class="btn btn-quiet" [disabled]="busy" (click)="pendingRemoval = null"><fa-icon [icon]="icons.cancel"/> Cancel</button></div></div> }
            </div>
          }
        </tab>
      </tabset>
    </app-page>`
})
export class SiteRegistrationsComponent implements OnInit, OnDestroy {
  protected dateUtils = inject(DateUtilsService);
  private service = inject(SiteRegistrationService);
  private setup = inject(EnvironmentSetupService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private stringUtils = inject(StringUtilsService);
  private subscriptions: Subscription[] = [];
  readonly State = RegistrationState;
  readonly setupPath = AdminPlatformPath.ENVIRONMENT_MANAGEMENT_SETUP;
  readonly AlertVariant = AlertPanelVariant;
  readonly AdminTab = RegistrationAdminTab;
  readonly Anchor = RegistrationPageAnchor;
  readonly states = values(RegistrationState);
  readonly ascending = ASCENDING;
  protected readonly approvalCode = approvalCode;
  readonly icons = {warning: faCircleExclamation, success: faCircleCheck, running: faSpinner, check: faCheck, retry: faRotate, wrench: faWrench, stop: faStop, key: faKey, edit: faPen, trash: faTrash, open: faArrowUpRightFromSquare, save: faSave, add: faPlus, cancel: faXmark, expand: faChevronRight, collapse: faChevronDown, setup: faGears, email: faEnvelope, findPages: faMagnifyingGlass, actions: faEllipsisVertical};
  registrations: SiteRegistration[] = [];
  loading = true;
  settings: RegistrationSettings = null;
  selectedStates: RegistrationState[] = [];
  openBuildLogs = new Set<string>();
  closedBuildLogs = new Set<string>();
  sort: SortableTableSortState = {key: "group.name", direction: ASCENDING};
  approvalSort: SortableTableSortState = {key: "groupCode", direction: ASCENDING};
  approvalArea = "";
  approvalGroup = "";
  approvalGroupName = "";
  approvalRecipients: ComposerExternalRecipient[] = [];
  approvalAreaName = "";
  pendingRemoval: string = null;
  pendingDelete: SiteRegistration = null;
  reviewUrl = "";
  busy = false;
  busyRowId: string = null;
  message = "";
  messageTitle = "Registration update";
  messageVariant = AlertPanelVariant.WARNING;
  tab = RegistrationAdminTab.REGISTRATION_REQUESTS;
  readonly columns: SortableTableColumn<SiteRegistration>[] = [
    {key: "group", label: "Group", sortKey: "group.name", cellGetter: row => row.group.name, cellClass: "nowrap"},
    {key: "plan", label: "Plan", sortKey: "plan", cellGetter: row => row.plan, cellClass: "nowrap"},
    {key: "state", label: "State", sortKey: "state", cellGetter: row => row.state, cellClass: "nowrap"},
    {key: "progress", label: "Progress", cellClass: "nowrap"},
    {key: "error", label: "Details", sortKey: "error", cellGetter: row => row.error || row.progress[row.progress.length - 1]?.message || ""},
    {key: "buildTime", label: "Build time", cellClass: "nowrap", cellGetter: row => this.buildTime(row)},
    {key: "actions", label: "Actions", cellClass: "nowrap"}
  ];
  readonly approvalColumns: SortableTableColumn<RegistrationEmailApproval>[] = [
    {key: "area", label: "Area", sortKey: "areaName", cellClass: "nowrap", cellGetter: row => approvalAreaLabel(row)},
    {key: "group", label: "Group", sortKey: "groupCode", cellClass: "nowrap", cellGetter: row => approvalGroupLabel(row)},
    {key: "recipients", label: "Approved people", cellGetter: row => approvalRecipientNames(row)},
    {key: "actions", label: "Actions"}
  ];

  async ngOnInit(): Promise<void> {
    this.tab = values(RegistrationAdminTab).find(tab => kebabCase(tab) === this.route.snapshot.queryParamMap.get(StoredValue.TAB)) || RegistrationAdminTab.REGISTRATION_REQUESTS;
    this.selectedStates = (this.route.snapshot.queryParamMap.get(StoredValue.STATUS) || "").split(",").map(value => value.trim()).filter(value => this.states.includes(value as RegistrationState)) as RegistrationState[];
    this.sort = {key: this.route.snapshot.queryParamMap.get(StoredValue.SORT) || "group.name", direction: this.route.snapshot.queryParamMap.get(StoredValue.SORT_ORDER) || ASCENDING};
    this.approvalSort = {key: this.route.snapshot.queryParamMap.get(StoredValue.REGISTRATION_EMAIL_SORT) || "groupCode", direction: this.route.snapshot.queryParamMap.get(StoredValue.REGISTRATION_EMAIL_SORT_ORDER) || ASCENDING};
    await this.perform(async () => {
      this.settings = await this.service.settings();
      this.registrations = await this.service.list();
    });
    this.loading = false;
    this.subscriptions.push(timer(0, 3000).subscribe(() => {
      if (this.registrations.some(row => [RegistrationState.QUEUED, RegistrationState.PROVISIONING, RegistrationState.IMPORTING, RegistrationState.APPROVING].includes(row.state))) {
        this.refreshQuietly();
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  filteredRegistrations(): SiteRegistration[] {
    return this.registrations.filter(row => !this.selectedStates?.length || this.selectedStates.includes(row.state));
  }
  hasBuildLog = (row: SiteRegistration) => !!(this.inFlight(row) || row.error || row.progress?.length || row.siteHealth?.advertisedReachable === false);
  inFlightRows = () => this.registrations.filter(row => this.inFlight(row));
  inFlight = (row: SiteRegistration) => [RegistrationState.QUEUED, RegistrationState.PROVISIONING, RegistrationState.IMPORTING, RegistrationState.APPROVING].includes(row.state);
  sanitiseError(message: string): string {
    return sanitiseRegistrationMessage(message);
  }

  inFlightLabel(row: SiteRegistration): string {
    if (row.state === RegistrationState.QUEUED) {
      return "Waiting to start";
    } else if (row.state === RegistrationState.PROVISIONING) {
      return "Creating the review site";
    } else if (row.state === RegistrationState.IMPORTING) {
      return "Importing the current website";
    } else {
      return "Sending the invitation";
    }
  }
  siteUnreachable = (row: SiteRegistration) => row.siteHealth?.advertisedReachable === false;
  openSiteUrl = (row: SiteRegistration) => row.siteHealth?.workingUrl || row.siteUrl;
  setupQuery = (row: SiteRegistration) => ({
    [StoredValue.TAB]: kebabCase(EnvironmentSetupTab.CREATE),
    [StoredValue.SETUP_MODE]: SetupMode.MANAGE,
    [StoredValue.ENVIRONMENT]: row.environmentName
  });
  buildLogOpen = (row: SiteRegistration) => this.openBuildLogs.has(row.id) || (this.inFlight(row) && !this.closedBuildLogs.has(row.id));
  rowExpanded = (row: SiteRegistration) => this.buildLogOpen(row) || this.pendingDelete?.id === row.id;
  detailsText(row: SiteRegistration): string {
    if (this.inFlight(row)) {
      return sanitiseRegistrationMessage(registrationProgressLines(row.progress)[0]?.message || this.inFlightLabel(row));
    } else if (this.siteUnreachable(row)) {
      return `${row.siteHealth.advertisedUrl.replace(/^https?:\/\//, "")} is not live`;
    } else {
      return sanitiseRegistrationMessage(row.error || row.progress?.[row.progress.length - 1]?.message || "");
    }
  }
  siteHealthTooltip(row: SiteRegistration): string {
    return `${row.siteHealth.detail} ${row.siteHealth.action}`;
  }
  detailsTooltip(row: SiteRegistration): string {
    return this.siteUnreachable(row) ? this.siteHealthTooltip(row) : (this.buildLogOpen(row) ? "Hide build log" : "Show build log");
  }
  async refreshQuietly(): Promise<void> {
    this.registrations = await this.service.list();
  }
  historyRows(row: SiteRegistration): RegistrationHistoryRow[] {
    return registrationHistoryRows(row.history || []);
  }

  buildTime(row: SiteRegistration): string {
    const span = latestBuildSpan(row.history || [], this.dateUtils.nowAsValue());
    return span ? `${this.dateUtils.formatDuration(span.from, span.to)}${span.finished ? "" : " so far"}` : "";
  }

  toggleBuildLog(row: SiteRegistration): void {
    this.setBuildLogOpen(row.id, !this.buildLogOpen(row));
  }

  private setBuildLogOpen(id: string, open: boolean): void {
    this.openBuildLogs = new Set([...this.openBuildLogs].filter(item => item !== id).concat(open ? [id] : []));
    this.closedBuildLogs = new Set([...this.closedBuildLogs].filter(item => item !== id).concat(open ? [] : [id]));
  }
  async refresh(): Promise<void> { await this.perform(async () => { this.registrations = await this.service.list(); }); }
  async saveSettings(): Promise<void> {
    await this.perform(async () => {
      try {
        this.settings = await this.service.saveSettings(this.settings);
        this.messageTitle = "Registration settings saved";
        this.message = "The registration settings are now in use.";
        this.messageVariant = AlertPanelVariant.SUCCESS;
      } catch (error) {
        this.settings = await this.service.settings();
        throw error;
      }
    });
  }
  async approve(row: SiteRegistration): Promise<void> { await this.performForRow(row, async () => { await this.service.approve(row.id); this.registrations = await this.service.list(); }); }
  async emailReturnLink(row: SiteRegistration): Promise<void> {
    await this.performForRow(row, async () => {
      const sent = await this.service.emailReturnLink(row.id);
      this.messageTitle = "Return link sent";
      this.messageVariant = AlertPanelVariant.SUCCESS;
      this.message = `A fresh confirmation and return link for ${row.group.name} was emailed to ${sent.email}.`;
      this.registrations = await this.service.list();
    });
  }

  async stop(row: SiteRegistration): Promise<void> {
    await this.performForRow(row, async () => {
      await this.service.stop(row.id);
      this.setBuildLogOpen(row.id, true);
      this.registrations = await this.service.list();
    });
  }

  async rediscover(row: SiteRegistration): Promise<void> {
    await this.performForRow(row, async () => {
      await this.service.rediscover(row.id);
      this.setBuildLogOpen(row.id, true);
      this.registrations = await this.service.list();
    });
  }

  async retry(row: SiteRegistration): Promise<void> {
    await this.performForRow(row, async () => {
      await this.service.retry(row.id);
      this.setBuildLogOpen(row.id, true);
      this.registrations = await this.service.list();
    });
  }
  async deleteRegistration(): Promise<void> {
    const row = this.pendingDelete;
    if (row) {
      await this.perform(async () => {
        await this.service.delete(row.id);
        this.pendingDelete = null;
        this.registrations = await this.service.list();
      });
    }
  }
  async broken(row: SiteRegistration): Promise<void> { await this.performForRow(row, async () => { await this.service.broken(row.id); this.registrations = await this.service.list(); }); }
  async reviewLogin(row: SiteRegistration): Promise<void> {
    this.busyRowId = row.id;
    this.busy = true;
    this.message = "";
    this.reviewUrl = "";
    try {
      const result = await this.setup.adminPasswordReset(row.environmentName);
      this.reviewUrl = this.siteUnreachable(row) ? (result.flyResetUrl || result.resetUrl) : (result.resetUrl || result.flyResetUrl);
      this.messageTitle = `User name ${result.userName || result.email}. Set a password on the opened page.`;
      if (this.reviewUrl) {
        window.open(this.reviewUrl, "_blank", "noopener");
      }
    } catch (error) {
      this.messageTitle = "Reviewer sign-in failed";
      this.messageVariant = AlertPanelVariant.DANGER;
      this.message = this.stringUtils.userErrorMessage(error, "The reviewer sign-in link could not be created.");
    } finally {
      this.busy = false;
      this.busyRowId = null;
    }
  }

  async saveApproval(): Promise<void> {
    const groupCode = this.approvalGroup.trim().toUpperCase();
    const code = approvalCode({areaCode: this.approvalArea, groupCode});
    const recipients = this.approvalRecipients.map(recipient => ({
      email: recipient.email.trim().toLowerCase(),
      name: (recipient.name || "").trim()
    })).filter(recipient => recipient.email);
    this.settings.approvedEmails = [...this.settings.approvedEmails.filter(row => approvalCode(row) !== code), {
      areaCode: this.approvalArea.trim().toUpperCase(),
      areaName: this.approvalAreaName,
      groupCode,
      groupName: this.approvalGroupName.trim(),
      recipients
    }];
    this.clearApproval();
    await this.saveSettings();
  }

  clearApproval(): void {
    this.approvalArea = "";
    this.approvalAreaName = "";
    this.approvalGroup = "";
    this.approvalGroupName = "";
    this.approvalRecipients = [];
  }

  editingApproval(): boolean {
    const code = approvalCode({areaCode: this.approvalArea, groupCode: this.approvalGroup});
    return !!code && this.settings.approvedEmails.some(row => approvalCode(row) === code);
  }

  approvalAreaChanged(area: AvailableArea | null): void {
    this.approvalArea = area?.areaCode || "";
    this.approvalAreaName = area?.areaName || "";
    this.approvalGroup = "";
    this.approvalGroupName = "";
  }

  approvalGroupChanged(group: RamblersGroupsApiResponse | null): void {
    this.approvalGroup = group?.group_code || "";
    this.approvalGroupName = group?.name || "";
  }

  editApproval(row: RegistrationEmailApproval): void {
    this.approvalArea = row.areaCode || (row.groupCode || "").slice(0, 2);
    this.approvalAreaName = row.areaName || "";
    this.approvalGroup = row.groupCode;
    this.approvalGroupName = row.groupName || "";
    this.approvalRecipients = approvalRecipients(row);
  }

  async removeApproval(): Promise<void> {
    this.settings.approvedEmails = this.settings.approvedEmails.filter(row => approvalCode(row) !== this.pendingRemoval);
    this.pendingRemoval = null;
    await this.saveSettings();
  }
  filterChanged(): void {
    this.router.navigate([], {queryParams: {[StoredValue.STATUS]: this.selectedStates?.length ? this.selectedStates.join(",") : null}, queryParamsHandling: "merge"});
  }
  tabActive(tab: RegistrationAdminTab): boolean { return this.tab === tab; }
  selectTab(tab: RegistrationAdminTab): void { this.tab = tab; this.router.navigate([], {queryParams: {[StoredValue.TAB]: kebabCase(tab)}, queryParamsHandling: "merge"}); }
  sortChanged(sort: SortableTableSortState): void { this.sort = sort; this.router.navigate([], {queryParams: {[StoredValue.SORT]: sort.key, [StoredValue.SORT_ORDER]: sort.direction}, queryParamsHandling: "merge"}); }
  approvalSortChanged(sort: SortableTableSortState): void { this.approvalSort = sort; this.router.navigate([], {queryParams: {[StoredValue.REGISTRATION_EMAIL_SORT]: sort.key, [StoredValue.REGISTRATION_EMAIL_SORT_ORDER]: sort.direction}, queryParamsHandling: "merge"}); }

  rowBusy(row: SiteRegistration): boolean {
    return this.busyRowId ? this.busyRowId === row.id : this.busy;
  }

  private async performForRow(row: SiteRegistration, action: () => Promise<void>): Promise<void> {
    this.busyRowId = row.id;
    try {
      await this.perform(action);
    } finally {
      this.busyRowId = null;
    }
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.message = "";
    try { await action(); } catch (error) {
      this.messageTitle = "Settings were not saved";
      this.messageVariant = AlertPanelVariant.DANGER;
      this.message = this.stringUtils.userErrorMessage(error, "The settings could not be saved.");
    }
    finally { this.busy = false; }
  }
}
