import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowUpRightFromSquare, faChevronDown, faChevronRight, faCircleExclamation, faCircleCheck, faCircleXmark, faCheck, faRotate, faSpinner, faWrench, faKey, faPen, faTrash, faSave, faPlus, faXmark, faGears } from "@fortawesome/free-solid-svg-icons";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { NgSelectComponent } from "@ng-select/ng-select";
import { kebabCase, values } from "es-toolkit/compat";
import { PageComponent } from "../../../page/page.component";
import { SiteRegistrationService } from "../../../services/site-registration.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { RegistrationAdminTab, RegistrationPageAnchor, RegistrationSettings, RegistrationState, SiteRegistration, RegistrationEmailApproval } from "../../../models/site-registration.model";
import { AdminPlatformPath } from "../../../models/admin-route-paths.model";
import { EnvironmentSetupTab, SetupMode } from "../../../models/environment-setup.model";
import { StoredValue } from "../../../models/ui-actions";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective, SortableTableExpandedRowDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { ASCENDING } from "../../../models/table-filtering.model";
import { AlertPanelVariant } from "../../../models/alert-panel.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { SetupProgress, SetupStepStatus } from "../../../models/environment-setup.model";
import { Subscription, timer } from "rxjs";
import { reversed } from "../../../functions/arrays";
import { UIDateFormat } from "../../../models/date-format.model";

@Component({
  selector: "app-site-registrations",
  imports: [FormsModule, RouterLink, FontAwesomeModule, TooltipModule, TabDirective, TabsetComponent, NgSelectComponent, PageComponent, SortableTableComponent, SortableTableCellDirective, SortableTableExpandedRowDirective],
  styles: [`
    .registration-progress-log
      background-color: #1e293b
      color: #e2e8f0
      padding: 1rem
      border-radius: 0.375rem
      font-family: monospace
      font-size: 0.875rem
      max-height: 400px
      overflow-y: auto

    .registration-progress-log .text-muted
      color: #94a3b8 !important

    .registration-progress-row
      display: grid
      grid-template-columns: 1.25rem 4.5rem minmax(0, 1fr)
      column-gap: 0.5rem
      align-items: start
      margin-bottom: 0.35rem

    .registration-progress-time
      white-space: nowrap

    .registration-progress-message
      overflow-wrap: anywhere
      min-width: 0

    .registration-details-toggle
      display: flex
      align-items: center
      gap: 0.5rem
      width: 100%
      margin: 0
      padding: 0
      border: 0
      background: none
      color: inherit
      text-align: left
      cursor: pointer
  `],
  template: `
    <app-page pageTitle="Group registrations">
      <p>Use this page to switch group registration on, follow each request, and decide who may start one. <a routerLink="/register"><fa-icon [icon]="icons.open"/> Open public registration</a>. <a routerLink="/how-to/group-registration">How to use this</a>.</p>
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
              <div class="row g-2 align-items-end mb-2">
                <div class="col-12 col-md">
                  <label for="registration-state">Registration state</label>
                  <ng-select id="registration-state" [items]="states" [multiple]="true" [closeOnSelect]="false" [clearable]="true" [(ngModel)]="selectedStates" (ngModelChange)="filterChanged()" placeholder="All states"/>
                </div>
                <div class="col-12 col-md-auto">
                  <button class="btn btn-quiet" [disabled]="busy" (click)="refresh()"><fa-icon [icon]="icons.retry"/> Refresh requests</button>
                </div>
              </div>
              <app-sortable-table [rows]="filteredRegistrations()" [columns]="columns" [defaultSortKey]="sort.key" [defaultSortDirection]="sort.direction" emptyMessage="No registrations match this state." [expandedWhen]="buildLogOpen" (sortChange)="sortChanged($event)">
                <ng-template appSortableTableCell="error" let-row>
                  @if (hasBuildLog(row)) {
                    <button type="button" class="registration-details-toggle" [class.text-danger]="siteUnreachable(row) && !inFlight(row)" [tooltip]="detailsTooltip(row)" (click)="toggleBuildLog(row)">
                      <fa-icon [icon]="inFlight(row) ? icons.running : (buildLogOpen(row) ? icons.collapse : icons.expand)" [animation]="inFlight(row) ? 'spin' : undefined"/>
                      @if (siteUnreachable(row) && !inFlight(row)) {
                        <fa-icon [icon]="icons.warning"/>
                      }
                      <span>{{detailsText(row)}}</span>
                    </button>
                  } @else {
                    <span>{{row.error || ""}}</span>
                  }
                </ng-template>
                <ng-template appSortableTableCell="actions" let-row>
                  @if (row.state === State.REVIEW) {
                    <button class="btn btn-primary btn-icon me-1" tooltip="Open reviewer login" [disabled]="busy" (click)="reviewLogin(row)"><fa-icon [icon]="icons.key"/></button>
                    <button class="btn btn-primary btn-icon me-1" [tooltip]="siteUnreachable(row) ? 'The public hostname is not live yet' : 'Approve and invite the group'" [disabled]="busy || siteUnreachable(row)" (click)="approve(row)"><fa-icon [icon]="icons.check"/></button>
                    <button class="btn btn-primary btn-icon me-1" tooltip="Run import again" [disabled]="busy" (click)="retry(row)"><fa-icon [icon]="icons.retry"/></button>
                    <button class="btn btn-quiet btn-icon me-1" tooltip="Mark broken" [disabled]="busy" (click)="broken(row)"><fa-icon [icon]="icons.wrench"/></button>
                  }
                  @if (row.state === State.FAILED || row.state === State.BROKEN) {
                    <button class="btn btn-primary btn-icon me-1" tooltip="Retry from saved progress" [disabled]="busy" (click)="retry(row)"><fa-icon [icon]="icons.retry"/></button>
                  }
                  @if (openSiteUrl(row)) { <a [href]="openSiteUrl(row)" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-icon me-1" [tooltip]="siteUnreachable(row) ? 'Open working Fly site' : 'Open site'"><fa-icon [icon]="icons.open"/></a> }
                  @if (siteUnreachable(row)) { <a [routerLink]="'/' + setupPath" [queryParams]="setupQuery(row)" class="btn btn-danger btn-icon" [tooltip]="siteHealthTooltip(row)"><fa-icon [icon]="icons.setup"/></a> }
                </ng-template>
                <ng-template appSortableTableExpandedRow let-row>
                  @if (row.error) {
                    <div class="alert alert-danger d-flex align-items-start mb-2"><fa-icon [icon]="icons.warning" class="me-2"/><div><strong>What went wrong</strong><p class="mb-0">{{row.error}}</p></div></div>
                  }
                  @if (row.progress?.length) {
                    <div class="registration-progress-log mb-2">
                      @for (item of progressLines(row); track $index) {
                        <div class="registration-progress-row">
                          <fa-icon [icon]="progressIcon(item, row)" [class.text-success]="progressStatus(item, row) === StepStatus.Completed" [class.text-danger]="progressStatus(item, row) === StepStatus.Failed" [animation]="progressStatus(item, row) === StepStatus.Running ? 'spin' : undefined"/>
                          <span class="text-muted registration-progress-time">{{progressTime(item)}}</span>
                          <span class="registration-progress-message">{{item.message || item.step}}</span>
                        </div>
                      }
                    </div>
                  }
                </ng-template>
              </app-sortable-table>
            </div>
          }
        </tab>
        <tab [active]="tabActive(AdminTab.APPROVED_EMAILS)" (selectTab)="selectTab(AdminTab.APPROVED_EMAILS)" [heading]="AdminTab.APPROVED_EMAILS">
          @if (settings && tabActive(AdminTab.APPROVED_EMAILS)) {
            <div class="thumbnail-heading-frame mt-3"><div class="thumbnail-heading">Approved committee email addresses</div>
              <p>When committee email validation is on, only these addresses can start registration for that group.</p>
              <label for="approval-group">Group code</label><input id="approval-group" class="form-control" [(ngModel)]="approvalGroup"/>
              <label for="approval-emails">Email addresses, one per line</label><textarea id="approval-emails" class="form-control" [(ngModel)]="approvalEmails"></textarea>
              <button class="btn btn-primary my-2" [disabled]="!approvalGroup || !approvalEmails" (click)="addApproval()"><fa-icon [icon]="icons.add"/> Add or update group</button>
              <app-sortable-table [rows]="settings.approvedEmails" [columns]="approvalColumns" [defaultSortKey]="approvalSort.key" [defaultSortDirection]="approvalSort.direction" emptyMessage="No committee email addresses have been approved." (sortChange)="approvalSortChanged($event)">
                <ng-template appSortableTableCell="actions" let-row><button class="btn btn-quiet btn-icon me-1" tooltip="Edit approved addresses" (click)="editApproval(row)"><fa-icon [icon]="icons.edit"/></button><button class="btn btn-quiet btn-icon" tooltip="Remove group approval" (click)="pendingRemoval = row.groupCode"><fa-icon [icon]="icons.trash"/></button></ng-template>
              </app-sortable-table>
              <button class="btn btn-primary my-2" [disabled]="busy" (click)="saveSettings()"><fa-icon [icon]="icons.save"/> Save approved emails</button>
              @if (pendingRemoval) { <div class="alert alert-warning d-flex align-items-start mt-2"><fa-icon [icon]="icons.warning" class="me-2"/><div><strong>Remove email approval for {{pendingRemoval}}?</strong><p>New registration requests for this group will no longer be authorised by this list.</p><button class="btn btn-primary me-2" (click)="removeApproval()"><fa-icon [icon]="icons.trash"/> Remove from list</button><button class="btn btn-quiet" (click)="pendingRemoval = null"><fa-icon [icon]="icons.cancel"/> Cancel</button></div></div> }
            </div>
          }
        </tab>
      </tabset>
    </app-page>`
})
export class SiteRegistrationsComponent implements OnInit, OnDestroy {
  private service = inject(SiteRegistrationService);
  private setup = inject(EnvironmentSetupService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private subscriptions: Subscription[] = [];
  readonly State = RegistrationState;
  readonly setupPath = AdminPlatformPath.ENVIRONMENT_MANAGEMENT_SETUP;
  readonly AlertVariant = AlertPanelVariant;
  readonly AdminTab = RegistrationAdminTab;
  readonly Anchor = RegistrationPageAnchor;
  readonly states = values(RegistrationState);
  readonly ascending = ASCENDING;
  readonly StepStatus = SetupStepStatus;
  readonly icons = {warning: faCircleExclamation, success: faCircleCheck, failed: faCircleXmark, running: faSpinner, check: faCheck, retry: faRotate, wrench: faWrench, key: faKey, edit: faPen, trash: faTrash, open: faArrowUpRightFromSquare, save: faSave, add: faPlus, cancel: faXmark, expand: faChevronRight, collapse: faChevronDown, setup: faGears};
  registrations: SiteRegistration[] = [];
  settings: RegistrationSettings = null;
  selectedStates: RegistrationState[] = [];
  openBuildLogs = new Set<string>();
  sort: SortableTableSortState = {key: "group.name", direction: ASCENDING};
  approvalSort: SortableTableSortState = {key: "groupCode", direction: ASCENDING};
  approvalGroup = "";
  approvalEmails = "";
  pendingRemoval: string = null;
  reviewUrl = "";
  busy = false;
  message = "";
  messageTitle = "Registration update";
  messageVariant = AlertPanelVariant.WARNING;
  tab = RegistrationAdminTab.REGISTRATION_REQUESTS;
  readonly columns: SortableTableColumn<SiteRegistration>[] = [
    {key: "group", label: "Group", sortKey: "group.name", cellGetter: row => row.group.name},
    {key: "plan", label: "Plan", sortKey: "plan", cellGetter: row => row.plan},
    {key: "state", label: "State", sortKey: "state", cellGetter: row => row.state},
    {key: "error", label: "Details", sortKey: "error", cellGetter: row => row.error || row.progress[row.progress.length - 1]?.message || ""},
    {key: "actions", label: "Actions"}
  ];
  readonly approvalColumns: SortableTableColumn<RegistrationEmailApproval>[] = [
    {key: "group", label: "Group", sortKey: "groupCode", cellGetter: row => row.groupCode},
    {key: "emails", label: "Approved emails", sortKey: "emails", cellGetter: row => row.emails.join(", ")},
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
  hasBuildLog = (row: SiteRegistration) => !!(row.error || row.progress?.length || row.siteHealth?.advertisedReachable === false);
  inFlight = (row: SiteRegistration) => [RegistrationState.QUEUED, RegistrationState.PROVISIONING, RegistrationState.IMPORTING, RegistrationState.APPROVING].includes(row.state);
  siteUnreachable = (row: SiteRegistration) => row.siteHealth?.advertisedReachable === false;
  openSiteUrl = (row: SiteRegistration) => row.siteHealth?.workingUrl || row.siteUrl;
  setupQuery = (row: SiteRegistration) => ({
    [StoredValue.TAB]: kebabCase(EnvironmentSetupTab.CREATE),
    [StoredValue.SETUP_MODE]: SetupMode.MANAGE,
    [StoredValue.ENVIRONMENT]: row.environmentName
  });
  buildLogOpen = (row: SiteRegistration) => this.openBuildLogs.has(row.id) || this.inFlight(row);
  detailsText(row: SiteRegistration): string {
    if (this.inFlight(row)) {
      return this.progressLines(row)[0]?.message || row.state;
    } else if (this.siteUnreachable(row)) {
      return `${row.siteHealth.advertisedUrl.replace(/^https?:\/\//, "")} is not live`;
    } else {
      return row.error || row.progress?.[row.progress.length - 1]?.message || "";
    }
  }
  siteHealthTooltip(row: SiteRegistration): string {
    return `${row.siteHealth.detail} ${row.siteHealth.action}`;
  }
  detailsTooltip(row: SiteRegistration): string {
    return this.siteUnreachable(row) ? this.siteHealthTooltip(row) : (this.buildLogOpen(row) ? "Hide build log" : "Show build log");
  }
  progressLines(row: SiteRegistration): SetupProgress[] {
    return reversed((row.progress || []).filter(item => !/resource failed|resource load error|net::ERR/i.test(item.message || "")));
  }
  progressStatus(item: SetupProgress, row: SiteRegistration): SetupStepStatus {
    if (item.status === SetupStepStatus.Failed || /error|failed|❌/i.test(item.message || "")) {
      return SetupStepStatus.Failed;
    } else if (item.status === SetupStepStatus.Completed || /✅|migrated|skip/i.test(item.message || "")) {
      return SetupStepStatus.Completed;
    } else if (item.status === SetupStepStatus.Running && this.inFlight(row)) {
      return SetupStepStatus.Running;
    } else {
      return SetupStepStatus.Completed;
    }
  }
  progressIcon(item: SetupProgress, row: SiteRegistration) {
    const status = this.progressStatus(item, row);
    if (status === SetupStepStatus.Failed) {
      return this.icons.failed;
    } else if (status === SetupStepStatus.Completed) {
      return this.icons.success;
    } else {
      return this.icons.running;
    }
  }
  progressTime(item: SetupProgress): string {
    return item.timestamp ? this.dateUtils.asString(item.timestamp, undefined, UIDateFormat.RAMBLERS_TIME) : "";
  }
  async refreshQuietly(): Promise<void> {
    this.registrations = await this.service.list();
  }
  toggleBuildLog(row: SiteRegistration): void {
    if (this.openBuildLogs.has(row.id)) {
      this.openBuildLogs.delete(row.id);
    } else {
      this.openBuildLogs.add(row.id);
    }
    this.openBuildLogs = new Set(this.openBuildLogs);
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
  async approve(row: SiteRegistration): Promise<void> { await this.perform(async () => { await this.service.approve(row.id); this.registrations = await this.service.list(); }); }
  async retry(row: SiteRegistration): Promise<void> {
    await this.perform(async () => {
      await this.service.retry(row.id);
      this.openBuildLogs.add(row.id);
      this.openBuildLogs = new Set(this.openBuildLogs);
      this.registrations = await this.service.list();
    });
  }
  async broken(row: SiteRegistration): Promise<void> { await this.perform(async () => { await this.service.broken(row.id); this.registrations = await this.service.list(); }); }
  async reviewLogin(row: SiteRegistration): Promise<void> {
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
    }
  }

  addApproval(): void {
    const groupCode = this.approvalGroup.trim().toUpperCase();
    this.settings.approvedEmails = [...this.settings.approvedEmails.filter(row => row.groupCode !== groupCode), {groupCode, emails: this.approvalEmails.split(/[\n,;]/).map(email => email.trim().toLowerCase()).filter(Boolean)}];
    this.approvalGroup = "";
    this.approvalEmails = "";
  }

  editApproval(row: RegistrationEmailApproval): void { this.approvalGroup = row.groupCode; this.approvalEmails = row.emails.join("\n"); }
  removeApproval(): void { this.settings.approvedEmails = this.settings.approvedEmails.filter(row => row.groupCode !== this.pendingRemoval); this.pendingRemoval = null; }
  filterChanged(): void {
    this.router.navigate([], {queryParams: {[StoredValue.STATUS]: this.selectedStates?.length ? this.selectedStates.join(",") : null}, queryParamsHandling: "merge"});
  }
  tabActive(tab: RegistrationAdminTab): boolean { return this.tab === tab; }
  selectTab(tab: RegistrationAdminTab): void { this.tab = tab; this.router.navigate([], {queryParams: {[StoredValue.TAB]: kebabCase(tab)}, queryParamsHandling: "merge"}); }
  sortChanged(sort: SortableTableSortState): void { this.sort = sort; this.router.navigate([], {queryParams: {[StoredValue.SORT]: sort.key, [StoredValue.SORT_ORDER]: sort.direction}, queryParamsHandling: "merge"}); }
  approvalSortChanged(sort: SortableTableSortState): void { this.approvalSort = sort; this.router.navigate([], {queryParams: {[StoredValue.REGISTRATION_EMAIL_SORT]: sort.key, [StoredValue.REGISTRATION_EMAIL_SORT_ORDER]: sort.direction}, queryParamsHandling: "merge"}); }

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
