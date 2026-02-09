import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
  faAdd,
  faClose,
  faEdit,
  faExternalLinkAlt,
  faSearch,
  faSort,
  faSortDown,
  faSortUp,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { ALERT_ERROR, AlertTarget } from "../../../../models/alert-target.model";
import {
  CommitteeConfig,
  CommitteeFileType,
  CommitteeMember,
  DEFAULT_COST_PER_MILE,
  ForwardEmailTarget,
  Notification
} from "../../../../models/committee.model";
import {
  EmailForwardStatus,
  EmailRoutingActionType,
  EmailRoutingMatcherField,
  EmailRoutingMatcherType,
  EmailRoutingRule,
  EmailWorkerScript,
  NonSensitiveCloudflareConfig
} from "../../../../models/cloudflare-email-routing.model";
import { EnvironmentSettingsSubTab } from "../../../../models/system.model";
import { EnvironmentSetupTab } from "../../../../models/environment-setup.model";
import { StoredValue } from "../../../../models/ui-actions";
import { sortBy } from "../../../../functions/arrays";
import { toKebabCase } from "../../../../functions/strings";
import { SortDirection } from "../../../../models/sort.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance } from "../../../../services/notifier.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";
import { CommitteeConfigService } from "../../../../services/committee/commitee-config.service";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { CommitteeQueryService } from "../../../../services/committee/committee-query.service";
import { Subscription } from "rxjs";
import { cloneDeep, isBoolean, isEqual, isString } from "es-toolkit/compat";
import { PageComponent } from "../../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";
import { CommitteeMemberEditor } from "./committee-member";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { AsyncPipe, NgClass } from "@angular/common";
import { AlertComponent } from "ngx-bootstrap/alert";
import { EnvironmentSetupService } from "../../../../services/environment-setup/environment-setup.service";

@Component({
    selector: "app-committee-settings",
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
      tr.row-selected
        background-color: rgba(155, 200, 171, 0.15) !important
        border-left: 3px solid var(--ramblers-colour-mintcake, rgb(155, 200, 171))
      tr.row-selected:hover
        background-color: rgba(155, 200, 171, 0.25) !important
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
      tr.no-hover .thumbnail-heading-frame
        background-color: white
        border-color: #dee2e6
      .btn-outline-cloudflare
        border: 1px solid #F6821F
        color: #F6821F
        background-color: transparent
        &:hover
          background-color: #F6821F
          border-color: #F6821F
          color: white
    `],
    template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          @if (committeeConfig) {
            <tabset class="custom-tabset">
              <tab heading="Committee Members">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="col-sm-12 mt-2 mb-2">
                    <app-markdown-editor standalone category="admin" name="committee-roles-help"
                                         description="Committee roles help"/>
                  </div>
                  @if (cloudflareEmailRoutingService.hasConfigError()) {
                    <div class="col-sm-12 mt-2 mb-2">
                      <alert type="warning">
                        <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                        <strong class="ms-2">Email Forwarding Not Available</strong>
                        @if (platformAdminEnabled) {
                          <span class="ms-2">Cloudflare Email Routing could not be contacted. To enable
                            email forwarding for committee roles:
                            <ol class="mt-1 mb-0">
                              <li>Open <a routerLink="/admin/environment-setup" [queryParams]="environmentSetupGlobalQueryParams">Global Settings</a> and ensure
                                the Cloudflare section has a valid <strong>API Token</strong>,
                                <strong>Zone ID</strong>, and <strong>Base Domain</strong></li>
                              <li>The <a href="https://dash.cloudflare.com/profile/api-tokens"
                                target="_blank">API Token</a> must include
                                <em>Zone &gt; Email Routing Rules &gt; Edit</em></li>
                              <li>Enable Email Routing for your zone in the
                                <a href="https://dash.cloudflare.com" target="_blank">Cloudflare dashboard</a></li>
                            </ol>
                            <div class="mt-2"><strong>Detail:</strong>
                              {{ cloudflareEmailRoutingService.configErrorNotifications() | async }}</div>
                          </span>
                        } @else {
                          <span class="ms-2">Email forwarding is not configured for this group. Contact the platform administrator to enable Cloudflare Email Routing.</span>
                        }
                      </alert>
                    </div>
                  }
                  <div class="d-flex justify-content-between mb-3">
                    <div>
                      @if (platformAdminEnabled && !cloudflareEmailRoutingService.hasConfigError() && cloudflareRoutingUrl()) {
                        <a [href]="cloudflareRoutingUrl()" target="_blank"
                           class="btn btn-sm btn-outline-cloudflare">
                          <fa-icon [icon]="faExternalLinkAlt" class="me-1"></fa-icon>View Routing Rules in Cloudflare
                        </a>
                      }
                      @if (platformAdminEnabled && !cloudflareEmailRoutingService.hasConfigError() && !cloudflareRoutingUrl()) {
                        <alert type="warning" class="mt-2 mb-0">
                          <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                          <strong class="ms-2">Routing link unavailable</strong>
                          <span class="ms-2">{{ routingLinkUnavailableReason() }}</span>
                        </alert>
                      }
                    </div>
                    <div class="d-flex gap-2">
                      <button class="btn btn-success btn-sm" [disabled]="hasUnsavedRole() || !!editingRoleDraft"
                              (click)="createNewRole()" tooltip="Add a new committee role">
                        <fa-icon [icon]="faAdd" class="me-1"></fa-icon>Add Role
                      </button>
                    </div>
                  </div>
                  <div class="row mb-3">
                    <div class="col-sm-8">
                      <label class="form-label">Search</label>
                      <div class="input-group">
                        <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
                        <input type="text" class="form-control" [(ngModel)]="searchTerm"
                               (ngModelChange)="updateQueryParams()"
                               placeholder="Search roles...">
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <label class="form-label">Stats</label>
                      <div class="form-control-plaintext">
                        {{ filteredRoles.length }} of {{ committeeConfig.roles.length }} roles
                        ({{ vacantCount }} vacant)
                      </div>
                    </div>
                  </div>
                  @if (platformAdminEnabled && orphanedWorkerScripts.length) {
                    <div class="mb-3">
                      <h6 class="mb-2">Orphaned Cloudflare Workers</h6>
                      <div class="table-responsive">
                        <table class="table table-sm table-striped">
                          <thead>
                            <tr>
                              <th>Script</th>
                              <th>Mapped</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (script of orphanedWorkerScripts; track script.id) {
                              <tr>
                                <td class="small">{{ script.id }}</td>
                                <td class="small">{{ workerMappingLabel(script.id) }}</td>
                                <td>
                                  <div class="d-flex gap-2">
                                    @if (workerServiceUrl(script.id)) {
                                      <a class="btn btn-sm btn-outline-ramblers"
                                         [href]="workerServiceUrl(script.id)"
                                         target="_blank"
                                         tooltip="Open in Cloudflare">
                                        <fa-icon [icon]="faExternalLinkAlt"></fa-icon>
                                      </a>
                                    }
                                    <button type="button" class="btn btn-sm btn-outline-danger"
                                      [disabled]="workerDeletePending === script.id"
                                      (click)="deleteWorkerScript(script.id)">
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>
                  }
                  @if (!editingRoleDraft) {
                    <div class="table-responsive table-container">
                      <table class="table table-striped table-hover">
                        <thead class="sticky-top">
                          <tr>
                            <th class="sortable" [class.sorted]="sortField === 'fullName'"
                                (click)="toggleSort('fullName')">
                              Name
                              <fa-icon [icon]="sortIcon('fullName')" class="sort-icon"></fa-icon>
                            </th>
                            <th class="sortable" [class.sorted]="sortField === 'email'"
                                (click)="toggleSort('email')">
                              Email
                              <fa-icon [icon]="sortIcon('email')" class="sort-icon"></fa-icon>
                            </th>
                            <th class="sortable" [class.sorted]="sortField === 'roleType'"
                                (click)="toggleSort('roleType')">
                              Role
                              <fa-icon [icon]="sortIcon('roleType')" class="sort-icon"></fa-icon>
                            </th>
                            <th class="sortable" [class.sorted]="sortField === 'description'"
                                (click)="toggleSort('description')">
                              Description
                              <fa-icon [icon]="sortIcon('description')" class="sort-icon"></fa-icon>
                            </th>
                            <th style="width: 80px" class="sortable" [class.sorted]="sortField === 'vacant'"
                                (click)="toggleSort('vacant')">
                              Vacant
                              <fa-icon [icon]="sortIcon('vacant')" class="sort-icon"></fa-icon>
                            </th>
                            @if (!cloudflareEmailRoutingService.hasConfigError()) {
                              <th style="width: 130px" class="sortable" [class.sorted]="sortField === 'emailForward'"
                                  (click)="toggleSort('emailForward')">
                                Email Forward
                                <fa-icon [icon]="sortIcon('emailForward')" class="sort-icon"></fa-icon>
                              </th>
                            }
                            <th style="width: 100px">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (role of filteredRoles; track $index) {
                            <tr [class.row-selected]="editingRoleOriginal === role || pendingDeleteRole === role"
                                class="pointer" (click)="toggleEditRole(role)">
                              <td>{{ role.fullName || '\u2014' }}</td>
                              <td class="small">{{ role.email || '\u2014' }}</td>
                              <td>{{ stringUtils.asTitle(role.roleType) }}</td>
                              <td>{{ role.description }}</td>
                              <td class="text-center">
                                @if (role.vacant) {
                                  <span class="badge bg-warning">Yes</span>
                                }
                              </td>
                              @if (!cloudflareEmailRoutingService.hasConfigError()) {
                                <td class="text-center">
                                  @switch (emailForwardStatus(role)) {
                                    @case (EmailForwardStatus.ACTIVE) {
                                      <span class="badge text-style-sunset"
                                            tooltip="{{ role.type }}@{{ baseDomain }} &rarr; {{ resolvedForwardEmailFor(role) }}">Active</span>
                                    }
                                    @case (EmailForwardStatus.OUTDATED) {
                                      <span class="badge bg-warning"
                                            tooltip="Destination mismatch - click to update">Outdated</span>
                                    }
                                    @case (EmailForwardStatus.CATCH_ALL) {
                                      <span class="badge text-style-sunset"
                                            tooltip="Routed via catch-all &rarr; {{ catchAllDestination() }}">Catch-all</span>
                                    }
                                    @case (EmailForwardStatus.WORKER) {
                                      <span class="badge text-style-sunset"
                                            tooltip="{{ roleEmailFor(role) }} &rarr; {{ role.forwardEmailRecipients?.length || 0 }} recipients">Multiple</span>
                                    }
                                    @case (EmailForwardStatus.MISSING) {
                                      <span class="badge bg-warning"
                                            tooltip="No forwarding rule - click to create">Not Set</span>
                                    }
                                  }
                                </td>
                              }
                              <td>
                                <div class="btn-group btn-group-sm">
                                  <button class="btn btn-outline-ramblers" (click)="confirmDeleteRole(role); $event.stopPropagation()"
                                          [disabled]="!!editingRoleDraft || !!pendingDeleteRole" tooltip="Delete role">
                                    <fa-icon [icon]="faTrash"></fa-icon>
                                  </button>
                                </div>
                              </td>
                            </tr>
                            @if (pendingDeleteRole === role) {
                              <tr class="no-hover">
                                <td [attr.colspan]="cloudflareEmailRoutingService.hasConfigError() ? 6 : 7" class="p-2">
                                  <div class="alert alert-warning d-flex align-items-center justify-content-between py-2 mb-0">
                                    <span>
                                      <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                                      <strong class="ms-2">Delete Role</strong>
                                      <span class="ms-2">Are you sure you want to delete role "{{ pendingDeleteRole.description }}"
                                        ({{ pendingDeleteRole.fullName || 'vacant' }})?</span>
                                    </span>
                                    <div class="btn-group btn-group-sm">
                                      <button type="button" class="btn btn-danger" (click)="executeDeleteRole()">Delete</button>
                                      <button type="button" class="btn btn-outline-secondary" (click)="cancelDeleteRole()">Cancel</button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            }
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                  @if (editingRoleDraft) {
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">
                        {{ editingRoleHeading() }}
                      </div>
                      <app-committee-member [committeeMember]="editingRoleDraft"
                                            [roles]="committeeConfig.roles"
                                            [index]="editingRoleIndex()"/>
                      <div class="d-flex justify-content-end gap-2 mt-3 pe-2">
                        <button type="button" class="btn btn-outline-secondary"
                          (click)="cancelRoleEdit()">Cancel</button>
                        <button type="button" class="btn btn-success"
                          (click)="saveRoleEdit()">Save</button>
                      </div>
                    </div>
                  }
                </div>
              </tab>
              <tab heading="File Types">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="row">
                    <div class="col-sm-12 mt-2 mb-2">
                      <app-markdown-editor standalone category="admin" name="committee-file-types-help"
                                           description="Committee file types help"/>
                    </div>
                  </div>
                  <div class="badge-button mb-3" (click)="addFileType()"
                       delay=500 tooltip="Add new file type">
                    <fa-icon [icon]="faAdd"></fa-icon>
                    Add new file type
                  </div>
                  @for (fileType of committeeConfig.fileTypes; track fileType.description; let fileTypeIndex = $index) {
                    <div class="row">
                      <div class="col-sm-8">
                        <div class="form-group">
                          <label [for]="stringUtils.kebabCase('file-type', fileTypeIndex)">File Type</label>
                          <input [id]="stringUtils.kebabCase('file-type', fileTypeIndex)" type="text"
                                 class="form-control input-sm"
                                 placeholder="Enter File Type Description" [(ngModel)]="fileType.description">
                        </div>
                      </div>
                      <div class="col-sm-3">
                        <div class="form-group mt-5">
                          <div class="form-check">
                            <input [(ngModel)]="fileType.public"
                                   type="checkbox" class="form-check-input"
                                   [id]="stringUtils.kebabCase('public', fileTypeIndex)">
                            <label class="form-check-label" [for]="stringUtils.kebabCase('public', fileTypeIndex)">
                              Visible by Public</label>
                          </div>
                        </div>
                      </div>
                      <div class="col-sm-1 mt-5">
                        <div class="badge-button" (click)="deleteFileType(fileType)"
                             delay=500 tooltip="Delete file type">
                          <fa-icon [icon]="faClose"></fa-icon>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </tab>
              <tab heading="Expenses">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="row">
                    <div class="col-sm-12 mt-2 mb-2">
                      <app-markdown-editor standalone category="admin" name="committee-expenses-help"
                                           description="Committee file expenses help"/>
                    </div>
                  </div>
                  <div class="col-sm-12">
                    <div class="form-group">
                      <label for="cost-per-mile">Cost Per Mile</label>
                      @if (committeeConfig?.expenses) {
                        <input [(ngModel)]="committeeConfig.expenses.costPerMile"
                               type="text"
                               class="form-control input-sm" id="cost-per-mile"
                               placeholder="Enter cost per mile for travel expenses here">
                      }
                    </div>
                  </div>
                </div>
              </tab>
            </tabset>
          }
          @if (notifyTarget.showAlert) {
            <div class="row">
              <div class="col-sm-12 mb-10">
                <div class="alert {{notifyTarget.alert.class}}">
                  <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                  @if (notifyTarget.alertTitle) {
                    <strong>
                      {{ notifyTarget.alertTitle }}: </strong>
                  } {{ notifyTarget.alertMessage }}
                </div>
              </div>
            </div>
          }
        </div>
        <div class="col-sm-12">
          <input type="submit" value="Save settings and exit" (click)="saveAndExit()"
                 [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-success me-2'" [disabled]="notReady()">
          <input type="submit" value="Save" (click)="save()"
                 [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-success me-2'" [disabled]="notReady()">
          <input type="submit" value="Undo Changes" (click)="undoChanges()"
                 [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-primary me-2'" [disabled]="notReady()">
          <input type="submit" value="Exit Without Saving" (click)="cancel()"
                 [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-primary me-2'" [disabled]="notReady()">
        </div>
      </div>
    </app-page>`,
    imports: [PageComponent, TabsetComponent, TabDirective, MarkdownEditorComponent, CommitteeMemberEditor, TooltipDirective, FontAwesomeModule, FormsModule, NgClass, AlertComponent, AsyncPipe, RouterLink]
})
export class CommitteeSettingsComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeSettingsComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  private urlService = inject(UrlService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private committeeConfigService = inject(CommitteeConfigService);
  cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  private committeeQueryService = inject(CommitteeQueryService);
  private environmentSetupService = inject(EnvironmentSetupService);
  private subscriptions: Subscription[] = [];
  private pendingEditType: string | null = null;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  public committeeConfig: CommitteeConfig;
  protected readonly environmentSetupGlobalQueryParams = {tab: toKebabCase(EnvironmentSetupTab.SETTINGS), "sub-tab": EnvironmentSettingsSubTab.GLOBAL};
  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly EmailForwardStatus = EmailForwardStatus;
  protected readonly faClose = faClose;
  protected readonly faAdd = faAdd;
  protected readonly faEdit = faEdit;
  protected readonly faTrash = faTrash;
  protected readonly faExternalLinkAlt = faExternalLinkAlt;
  protected readonly faSearch = faSearch;
  protected readonly faSort = faSort;
  protected readonly faSortUp = faSortUp;
  protected readonly faSortDown = faSortDown;

  editingRoleOriginal: CommitteeMember | null = null;
  editingRoleDraft: CommitteeMember | null = null;
  pendingDeleteRole: CommitteeMember | null = null;
  searchTerm = "";
  sortField: keyof CommitteeMember | "emailForward" | null = "fullName";
  sortDirection: SortDirection = SortDirection.ASC;
  emailRoutingRules: EmailRoutingRule[] = [];
  catchAllRule: EmailRoutingRule = null;
  workerScripts: EmailWorkerScript[] = [];
  workerDeletePending: string | null = null;
  baseDomain = "";
  cloudflareAccountId: string = "";
  cloudflareZoneId: string = "";
  platformAdminEnabled = false;

  ngOnInit() {
    this.cloudflareEmailRoutingService.queryCloudflareConfig().catch(err => this.logger.error("Cloudflare config not available:", err));
    this.cloudflareEmailRoutingService.queryRules().catch(err => this.logger.error("Email routing rules not available:", err));
    this.cloudflareEmailRoutingService.queryCatchAllRule().catch(err => this.logger.error("Catch-all rule not available:", err));
    this.cloudflareEmailRoutingService.queryWorkers().catch(err => this.logger.error("Cloudflare workers not available:", err));
    this.environmentSetupService.status()
      .then(status => this.platformAdminEnabled = status.platformAdminEnabled)
      .catch(err => this.logger.error("Platform admin status not available:", err));
    this.subscriptions.push(
      this.activatedRoute.queryParams.subscribe(params => {
        const editType = params[StoredValue.EDIT];
        const search = params[StoredValue.SEARCH];
        const sort = params[StoredValue.SORT];
        const sortOrder = params[StoredValue.SORT_ORDER];
        if (search && !this.searchTerm) {
          this.searchTerm = search;
        }
        if (sort) {
          this.sortField = sort as keyof CommitteeMember | "emailForward";
        }
        if (sortOrder === SortDirection.ASC || sortOrder === SortDirection.DESC) {
          this.sortDirection = sortOrder;
        }
        if (editType && this.committeeConfig) {
          this.openEditorForType(editType);
        } else if (editType) {
          this.pendingEditType = editType;
        }
      }),
      this.committeeConfigService.committeeConfigEvents().subscribe(committeeConfig => {
        this.committeeConfig = committeeConfig;
        if (!this.committeeConfig?.expenses) {
          this.committeeConfig.expenses = {costPerMile: DEFAULT_COST_PER_MILE};
        }
        if (this.pendingEditType) {
          this.openEditorForType(this.pendingEditType);
          this.pendingEditType = null;
        }
        this.logger.info("retrieved committeeConfig", committeeConfig);
      }),
      this.cloudflareEmailRoutingService.rulesNotifications().subscribe(rules => {
        this.emailRoutingRules = rules;
      }),
      this.cloudflareEmailRoutingService.catchAllNotifications().subscribe(rule => {
        this.catchAllRule = rule;
      }),
      this.cloudflareEmailRoutingService.workersNotifications().subscribe(workers => {
        this.workerScripts = workers;
      }),
      this.cloudflareEmailRoutingService.cloudflareConfigNotifications().subscribe((config: NonSensitiveCloudflareConfig) => {
        this.baseDomain = config?.baseDomain || "";
        this.cloudflareAccountId = config?.accountId || "";
        this.cloudflareZoneId = config?.zoneId || "";
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  get filteredRoles(): CommitteeMember[] {
    if (!this.committeeConfig?.roles) return [];
    const term = this.searchTerm?.toLowerCase();
    const filtered = this.committeeConfig.roles.filter(role =>
      !term ||
      role.description?.toLowerCase().includes(term) ||
      role.fullName?.toLowerCase().includes(term) ||
      role.email?.toLowerCase().includes(term) ||
      role.roleType?.toLowerCase().includes(term)
    );
    return this.sortRoles(filtered);
  }

  get vacantCount(): number {
    return this.committeeConfig?.roles?.filter(r => r.vacant).length || 0;
  }

  get workerScriptsSorted(): EmailWorkerScript[] {
    return [...(this.workerScripts || [])].sort(sortBy("id"));
  }

  get orphanedWorkerScripts(): EmailWorkerScript[] {
    return this.workerScriptsSorted.filter(script => !this.workerRuleForScript(script.id));
  }

  private sortValue(role: CommitteeMember): string | boolean {
    if (this.sortField === "emailForward") {
      return this.emailForwardStatus(role);
    }
    return role[this.sortField as keyof CommitteeMember] as string | boolean;
  }

  private sortRoles(roles: CommitteeMember[]): CommitteeMember[] {
    if (!this.sortField) return roles;
    const direction = this.sortDirection;
    return [...roles].sort((a, b) => {
      const aVal = this.sortValue(a);
      const bVal = this.sortValue(b);
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      let comparison = 0;
      if (isString(aVal) && isString(bVal)) {
        comparison = aVal.localeCompare(bVal);
      } else if (isBoolean(aVal) && isBoolean(bVal)) {
        comparison = (aVal === bVal) ? 0 : aVal ? 1 : -1;
      }
      return direction === SortDirection.ASC ? comparison : -comparison;
    });
  }

  toggleSort(field: keyof CommitteeMember | "emailForward") {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === SortDirection.ASC ? SortDirection.DESC : SortDirection.ASC;
    } else {
      this.sortField = field;
      this.sortDirection = SortDirection.ASC;
    }
  }

  sortIcon(field: keyof CommitteeMember | "emailForward") {
    if (this.sortField !== field) return this.faSort;
    return this.sortDirection === SortDirection.ASC ? this.faSortUp : this.faSortDown;
  }

  memberPersonalEmailFor(role: CommitteeMember): string {
    if (!role.memberId) {
      return null;
    }
    const member = this.committeeQueryService.committeeMembers.find(m => m.id === role.memberId);
    return member?.email || null;
  }

  resolvedForwardEmailFor(role: CommitteeMember): string {
    switch (role.forwardEmailTarget) {
      case ForwardEmailTarget.MEMBER_EMAIL:
        return this.memberPersonalEmailFor(role);
      case ForwardEmailTarget.CUSTOM:
        return role.forwardEmailCustom || null;
      case ForwardEmailTarget.MULTIPLE:
        return role.forwardEmailRecipients?.[0] || null;
      case ForwardEmailTarget.NONE:
        return null;
      default:
        return this.memberPersonalEmailFor(role);
    }
  }

  cloudflareRoutingUrl(): string {
    if (this.cloudflareAccountId && this.cloudflareZoneId) {
      return `https://dash.cloudflare.com/${this.cloudflareAccountId}/email-service/routing/${this.cloudflareZoneId}/routing-rules`;
    }
    return null;
  }

  workerServiceUrl(scriptName: string): string {
    if (!this.cloudflareAccountId || !scriptName) {
      return null;
    }
    return `https://dash.cloudflare.com/${this.cloudflareAccountId}/workers/services/view/${scriptName}/production`;
  }

  workerMappingLabel(scriptName: string): string {
    const rule = this.workerRuleForScript(scriptName);
    if (rule) {
      const role = this.workerRoleFromRule(rule);
      return role ? `${role.description} (${role.type})` : "Linked via routing rule";
    }
    const role = this.roleFromScriptName(scriptName);
    if (role) {
      return `${role.description} (${role.type})`;
    }
    return "Not mapped (non-standard name)";
  }

  private workerRuleForScript(scriptName: string): EmailRoutingRule | null {
    if (!scriptName) {
      return null;
    }
    return this.emailRoutingRules.find(rule =>
      rule.actions?.some(a => a.type === EmailRoutingActionType.WORKER && a.value?.includes(scriptName))
    ) || null;
  }

  private workerRoleFromRule(rule: EmailRoutingRule | null): CommitteeMember | null {
    const roleType = this.workerRoleTypeFromRule(rule);
    if (!roleType) {
      return null;
    }
    return this.committeeConfig?.roles?.find(role => role.type === roleType) || null;
  }

  private workerRoleTypeFromRule(rule: EmailRoutingRule | null): string {
    const matcher = rule?.matchers?.find(m => m.type === EmailRoutingMatcherType.LITERAL && m.field === EmailRoutingMatcherField.TO);
    if (!matcher?.value) {
      return null;
    }
    return matcher.value.split("@")[0] || null;
  }

  private roleFromScriptName(scriptName: string): CommitteeMember | null {
    return this.committeeConfig?.roles?.find(role => this.workerScriptNameForRole(role.type) === scriptName) || null;
  }

  private workerScriptNameForRole(roleType: string): string {
    if (!roleType || !this.baseDomain) {
      return "";
    }
    const sanitisedDomain = this.baseDomain.replace(/\./g, "-");
    return `email-fwd-${sanitisedDomain}-${roleType}`;
  }

  routingLinkUnavailableReason(): string {
    if (!this.platformAdminEnabled) {
      return "Cloudflare routing is not configured for this group. Contact the platform administrator.";
    }
    const missing = [];
    if (!this.cloudflareAccountId) {
      missing.push("account ID");
    }
    if (!this.cloudflareZoneId) {
      missing.push("zone ID");
    }
    if (missing.length > 0) {
      return `Missing Cloudflare ${missing.join(" and ")} in environment setup.`;
    }
    return "Cloudflare routing link is not available yet.";
  }

  async deleteWorkerScript(scriptName: string) {
    if (!this.platformAdminEnabled || !scriptName) {
      return;
    }
    const confirmed = confirm(`Delete Cloudflare worker "${scriptName}"?`);
    if (!confirmed) {
      return;
    }
    this.workerDeletePending = scriptName;
    try {
      await this.cloudflareEmailRoutingService.deleteWorker(scriptName);
      await this.cloudflareEmailRoutingService.queryWorkers();
    } catch (error) {
      this.notify.error(error);
    } finally {
      this.workerDeletePending = null;
    }
  }

  private roleEmailFor(role: CommitteeMember): string {
    if (role.email && this.baseDomain && role.email.endsWith(`@${this.baseDomain}`)) {
      return role.email;
    }
    return `${role.type}@${this.baseDomain}`;
  }

  workerScriptNameFor(role: CommitteeMember): string {
    const roleEmail = this.roleEmailFor(role);
    const matchingRule = this.emailRoutingRules.find(rule =>
      rule.matchers?.some(m => m.type === EmailRoutingMatcherType.LITERAL && m.field === EmailRoutingMatcherField.TO && m.value === roleEmail)
    );
    const workerAction = matchingRule?.actions?.find(a => a.type === EmailRoutingActionType.WORKER);
    return workerAction?.value?.[0] || "";
  }

  emailForwardStatus(role: CommitteeMember): EmailForwardStatus {
    if (role.vacant || this.cloudflareEmailRoutingService.hasConfigError()) return EmailForwardStatus.NA;
    const forwardEmail = this.resolvedForwardEmailFor(role);
    if (!forwardEmail && role.forwardEmailTarget !== ForwardEmailTarget.MULTIPLE) return EmailForwardStatus.NA;
    if (role.forwardEmailTarget === ForwardEmailTarget.MULTIPLE && !role.forwardEmailRecipients?.length) return EmailForwardStatus.NA;
    const roleEmail = this.roleEmailFor(role);
    const matchingRule = this.emailRoutingRules.find(rule =>
      rule.matchers?.some(m => m.type === EmailRoutingMatcherType.LITERAL && m.field === EmailRoutingMatcherField.TO && m.value === roleEmail)
    );
    if (matchingRule) {
      const workerAction = matchingRule.actions?.find(a => a.type === EmailRoutingActionType.WORKER);
      if (workerAction) {
        return EmailForwardStatus.WORKER;
      }
      const forwardAction = matchingRule.actions?.find(a => a.type === EmailRoutingActionType.FORWARD);
      const currentDest = forwardAction?.value?.[0];
      return currentDest === forwardEmail ? EmailForwardStatus.ACTIVE : EmailForwardStatus.OUTDATED;
    }
    if (this.catchAllRule?.enabled) return EmailForwardStatus.CATCH_ALL;
    return EmailForwardStatus.MISSING;
  }

  catchAllDestination(): string {
    const forwardAction = this.catchAllRule?.actions?.find(a => a.type === EmailRoutingActionType.FORWARD);
    return forwardAction?.value?.[0] || null;
  }

  toggleEditRole(role: CommitteeMember) {
    if (this.editingRoleOriginal === role) {
      this.cancelRoleEdit();
      return;
    }
    this.startRoleEdit(role);
  }

  editRole(role: CommitteeMember) {
    this.startRoleEdit(role);
  }

  cancelRoleEdit() {
    this.editingRoleOriginal = null;
    this.editingRoleDraft = null;
    this.updateQueryParams();
  }

  saveRoleEdit() {
    if (!this.editingRoleDraft) {
      return;
    }
    if (this.editingRoleOriginal) {
      const index = this.committeeConfig.roles.indexOf(this.editingRoleOriginal);
      if (index >= 0) {
        this.committeeConfig.roles = [
          ...this.committeeConfig.roles.slice(0, index),
          this.editingRoleDraft,
          ...this.committeeConfig.roles.slice(index + 1)
        ];
      }
    } else {
      this.committeeConfig.roles = [this.editingRoleDraft, ...this.committeeConfig.roles];
    }
    this.editingRoleOriginal = null;
    this.editingRoleDraft = null;
    this.updateQueryParams();
  }

  editingRoleHeading(): string {
    if (!this.editingRoleDraft) {
      return "New Role";
    }
    if (this.editingRoleDraft.fullName && this.editingRoleDraft.roleType) {
      return `${this.editingRoleDraft.fullName}'s ${this.stringUtils.asTitle(this.editingRoleDraft.roleType)} role`;
    }
    return this.editingRoleDraft.fullName || "New Role";
  }

  editingRoleIndex(): number {
    if (!this.editingRoleOriginal) {
      return -1;
    }
    return this.committeeConfig.roles.indexOf(this.editingRoleOriginal);
  }

  private openEditorForType(type: string) {
    if (this.editingRoleDraft?.type === type || this.editingRoleOriginal?.type === type) {
      return;
    }
    const role = this.committeeConfig?.roles?.find(r => r.type === type);
    if (role) {
      this.startRoleEdit(role);
    }
  }

  private startRoleEdit(role: CommitteeMember) {
    this.editingRoleOriginal = role;
    this.editingRoleDraft = cloneDeep(role);
    this.updateQueryParams();
  }

  updateQueryParams() {
    const queryParams: Record<string, string | null> = {
      [StoredValue.EDIT]: this.editingRoleDraft?.type || null,
      [StoredValue.SEARCH]: this.searchTerm || null,
      [StoredValue.SORT]: this.sortField || null,
      [StoredValue.SORT_ORDER]: this.sortDirection || null
    };
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams,
      queryParamsHandling: "merge"
    });
  }

  createNewRole() {
    this.editingRoleOriginal = null;
    this.editingRoleDraft = this.committeeConfigService.emptyCommitteeMember();
    this.updateQueryParams();
  }

  confirmDeleteRole(role: CommitteeMember) {
    this.pendingDeleteRole = role;
  }

  cancelDeleteRole() {
    this.pendingDeleteRole = null;
  }

  executeDeleteRole() {
    if (this.pendingDeleteRole) {
      const role = this.pendingDeleteRole;
      this.pendingDeleteRole = null;
      this.committeeConfig.roles = this.committeeConfig.roles.filter(r => r !== role);
    }
  }

  hasUnsavedRole(): boolean {
    const emptyRole = this.committeeConfigService.emptyCommitteeMember();
    const draftEmpty = this.editingRoleDraft ? isEqual(emptyRole, this.editingRoleDraft) : false;
    const existingEmpty = this.committeeConfig?.roles?.some(role => isEqual(emptyRole, role));
    return draftEmpty || existingEmpty;
  }

  saveAndExit() {
    this.save()
      .then(() => this.urlService.navigateTo(["admin"]))
      .catch((error) => this.notify.error(error));
  }

  save() {
    this.logger.info("saving config", this.committeeConfig);
    this.committeeConfig.fileTypes = [...this.committeeConfig.fileTypes].sort(sortBy("description"));
    return this.committeeConfigService.saveConfig(this.committeeConfig);
  }

  cancel() {
    this.undoChanges();
    this.urlService.navigateTo(["admin"]);
  }

  notReady() {
    return !this.committeeConfig;
  }

  deleteFileType(fileType: CommitteeFileType) {
    this.committeeConfig.fileTypes = this.committeeConfig.fileTypes.filter(item => item !== fileType);
  }

  addFileType() {
    this.committeeConfig.fileTypes = [...this.committeeConfig.fileTypes, {description: "(Enter new file type)"}];
  }

  undoChanges() {
    this.editingRoleOriginal = null;
    this.editingRoleDraft = null;
    this.pendingDeleteRole = null;
    this.committeeConfigService.refreshConfig();
  }
}
