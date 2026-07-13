import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { AdminPlatformPath } from "../../../../models/admin-route-paths.model";
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
  BuiltInRole,
  CommitteeConfig,
  CommitteeFileType,
  CommitteeMember,
  DEFAULT_COST_PER_MILE,
  EmailDerivation,
  ForwardEmailTarget,
  Notification,
  RoleType
} from "../../../../models/committee.model";
import { Member } from "../../../../models/member.model";
import {
  CatchAllAction,
  DestinationAddress,
  DestinationVerificationStatus,
  EmailForwardStatus,
  EmailRoutingActionType,
  EmailRoutingMatcherField,
  EmailRoutingMatcherType,
  EmailRoutingRule,
  EmailWorkerScript,
  NonSensitiveCloudflareConfig,
  SHARED_INBOX_ROUTER_WORKER_NAME
} from "../../../../models/cloudflare-email-routing.model";
import { EnvironmentSettingsSubTab, SystemConfig } from "../../../../models/system.model";
import { EnvironmentSetupTab } from "../../../../models/environment-setup.model";
import { StoredValue } from "../../../../models/ui-actions";
import { sortBy } from "../../../../functions/arrays";
import { extractErrorMessage, toDotCase, toKebabCase } from "../../../../functions/strings";
import { SortDirection } from "../../../../models/sort.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance } from "../../../../services/notifier.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";
import { CommitteeConfigService } from "../../../../services/committee/commitee-config.service";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { destinationVerificationStatusFor } from "./email-routing-view-resolver";
import { CloudflareUrlService } from "../../../../services/cloudflare/cloudflare-url.service";
import { CommitteeQueryService } from "../../../../services/committee/committee-query.service";
import { InboxService } from "../../../../services/inbox/inbox.service";
import { InboxAliasConnectionStatus, InboxCatchAllMode, InboxReaderProvider } from "../../../../models/inbox.model";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { filter, Subscription } from "rxjs";
import { ConfigKey } from "../../../../models/config.model";
import { MessageType } from "../../../../models/websocket.model";
import { WebSocketClientService } from "../../../../services/websockets/websocket-client.service";
import { cloneDeep, isBoolean, isEqual, isString } from "es-toolkit/compat";
import { PageComponent } from "../../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";
import { CommitteeMemberEditor } from "./committee-member";
import { RecipientMultiSelect } from "./recipient-multi-select";
import { CloudflareButton } from "../../../../modules/common/third-parties/cloudflare-button";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { AsyncPipe, NgClass } from "@angular/common";
import { AlertComponent } from "ngx-bootstrap/alert";
import { EnvironmentSetupService } from "../../../../services/environment-setup/environment-setup.service";

@Component({
    selector: "app-committee-settings",
    styles: [`
      .committee-roles-alert
        padding: 1.25rem
      .table-container
        max-height: calc(100vh - 520px)
        overflow-y: auto
        overflow-x: hidden
        border: 1px solid rgba(155, 200, 171, 0.4)
        border-radius: 8px
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08)
      .ngx-data-table th
        white-space: nowrap
      th .sort-icon
        margin-left: 0.25rem
        opacity: 0.5
      th.sorted .sort-icon
        opacity: 1
      thead.sticky-top
        background-color: white
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08)
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
      :host ::ng-deep .email-forward-tooltip .tooltip-inner
        max-width: none
        white-space: nowrap
      :host ::ng-deep alert.zone-catch-all-note .alert
        margin-top: 1rem
        margin-bottom: 0.25rem
    `],
    template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          @if (committeeConfig) {
            <tabset class="custom-tabset">
              <tab heading="Committee Members" [active]="tabActive('committee-members')" (selectTab)="selectTab('committee-members')">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="col-sm-12 mt-2 mb-2">
                    <app-markdown-editor standalone category="admin" name="committee-roles-help"
                                         description="Committee roles help"/>
                  </div>
                  @if (cloudflareEmailRoutingService.hasConfigError()) {
                    <div class="col-sm-12 mt-2 mb-2">
                      <alert type="warning">
                        <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                        <strong class="ms-2">Email Forwarding Error</strong>
                        @if (platformAdminEnabled) {
                          <span class="ms-2">Cloudflare Email Routing could not be contacted. To enable
                            email forwarding for committee roles:
                            <ol class="mt-1 mb-0">
                              <li>Open <a [routerLink]="'/' + adminPlatformEnvironmentManagementSetupPath" [queryParams]="environmentSetupGlobalQueryParams">Global Settings</a> and ensure
                                the Cloudflare section has a valid <strong>API Token</strong>,
                                <strong>Zone ID</strong>, and <strong>Base Domain</strong></li>
                              <li>The <a [href]="cloudflareApiTokensUrl"
                                target="_blank">API Token</a> must include
                                <em>Zone &gt; Email Routing Rules &gt; Edit</em></li>
                              <li>Enable Email Routing for your zone in the
                                <a [href]="cloudflareDashboardUrl" target="_blank">Cloudflare dashboard</a></li>
                            </ol>
                            <div class="mt-2"><strong>Detail:</strong>
                              {{ cloudflareEmailRoutingService.configErrorNotifications() | async }}</div>
                          </span>
                        } @else {
                          <span class="ms-2">Email forwarding encountered an error. Contact the platform administrator.</span>
                        }
                      </alert>
                    </div>
                  }
                  <div class="d-flex justify-content-between mb-3">
                    <div>
                      @if (platformAdminEnabled && cloudflareEmailRoutingService.emailForwardingAvailable() && cloudflareRoutingUrl()) {
                        <a [href]="cloudflareRoutingUrl()" target="_blank"
                           class="btn btn-sm btn-outline-cloudflare">
                          <fa-icon [icon]="faExternalLinkAlt" class="me-1"></fa-icon>View Routing Rules in Cloudflare
                        </a>
                      }
                      @if (platformAdminEnabled && cloudflareEmailRoutingService.emailForwardingAvailable() && !cloudflareRoutingUrl()) {
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
                      <button class="btn btn-success btn-sm" [disabled]="!!editingRoleDraft || !committeeMembersWithoutRole.length || !committeeRolesAlertDismissed"
                              (click)="addMissingCommitteeRoles()"
                              tooltip="Add a role for each member flagged as Committee Member in Member Admin who is not yet linked to a role">
                        <fa-icon [icon]="faAdd" class="me-1"></fa-icon>Add missing roles
                        @if (committeeMembersWithoutRole.length) {
                          ({{ committeeMembersWithoutRole.length }})
                        }
                      </button>
                      <button class="btn btn-outline-secondary btn-sm" [disabled]="!!editingRoleDraft || !catchAllRule?.enabled || clearForwardsPending || clearForwardsConfirmPending || !domainForwardRules().length"
                              (click)="requestClearAllForwards()" tooltip="Delete every per-role Cloudflare forwarding rule for this domain so all role emails route via the single catch-all">
                        <fa-icon [icon]="faTrash" class="me-1"></fa-icon>Clear all forwards
                      </button>
                    </div>
                  </div>
                  @if (clearForwardsConfirmPending) {
                    <div class="alert alert-warning">
                      <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                      <strong class="ms-2">Clear all forwards for {{ baseDomain }}?</strong>
                      <div class="mt-2">
                        This deletes
                        <strong>{{ stringUtils.pluraliseWithCount(domainForwardRules().length, "live Cloudflare forwarding rule") }}</strong>
                        for <strong>{{ baseDomain }}</strong> and sets every role to use the catch-all
                        @if (catchAllDestination()) {
                          (<strong>{{ catchAllDestination() }}</strong>)} so all role mail routes there instead.
                        Forwarding rules for any other domain or subdomain are left untouched. This cannot be undone.
                      </div>
                      <div class="d-flex gap-2 mt-2">
                        <button type="button" class="btn btn-sm btn-danger" [disabled]="clearForwardsPending || !domainForwardRules().length"
                                (click)="clearAllForwards()">
                          <fa-icon [icon]="faTrash" class="me-1"></fa-icon>Delete {{ stringUtils.pluraliseWithCount(domainForwardRules().length, "forward") }}
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="clearForwardsPending"
                                (click)="cancelClearAllForwards()">Cancel</button>
                      </div>
                    </div>
                  }
                  <div class="row mb-3">
                    <div class="col-sm-8">
                      <div class="input-group">
                        <span class="input-group-text"><fa-icon [icon]="faSearch"></fa-icon></span>
                        <input type="text" class="form-control" [(ngModel)]="searchTerm"
                               (ngModelChange)="updateQueryParams()"
                               placeholder="Search roles...">
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <div class="form-control-plaintext">
                        {{ filteredRoles.length }} of {{ committeeConfig.roles.length }} roles
                        ({{ vacantCount }} vacant)
                      </div>
                    </div>
                  </div>
                  @if (committeeMembersLoaded && !editingRoleDraft && committeeMembersWithoutRole.length && !committeeRolesAlertDismissed) {
                    <div class="alert alert-warning committee-roles-alert">
                      <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                      <strong class="ms-2">{{ stringUtils.pluraliseWithCount(committeeMembersWithoutRole.length, "committee member") }} not yet linked to a role</strong>
                      <div class="mt-2">
                        These members have the <strong>Committee Member</strong> privilege ticked in Member Admin but are not
                        linked to any role here, so they do not yet appear in the list. Add a role for each of them in one
                        click, then set the actual role (Secretary, Treasurer, etc.) and Save.
                      </div>
                      <ul class="mt-2 mb-2">
                        @for (member of committeeMembersWithoutRole; track member.id) {
                          <li>{{ memberFullName(member) }}</li>
                        }
                      </ul>
                      <div class="d-flex gap-2">
                        <button type="button" class="btn btn-sm btn-primary" (click)="addMissingCommitteeRoles()">
                          <fa-icon [icon]="faAdd" class="me-1"></fa-icon>Add {{ stringUtils.pluraliseWithCount(committeeMembersWithoutRole.length, "role") }}
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary"
                                (click)="committeeRolesAlertDismissed = true">Dismiss</button>
                      </div>
                    </div>
                  }
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
                                    @if (workerDeleteConfirmPending === script.id) {
                                      <button type="button" class="btn btn-sm btn-danger"
                                        (click)="deleteWorkerScript(script.id)">
                                        Confirm
                                      </button>
                                      <button type="button" class="btn btn-sm btn-outline-secondary"
                                        (click)="cancelDeleteWorkerScript()">
                                        Cancel
                                      </button>
                                    } @else {
                                      <button type="button" class="btn btn-sm btn-outline-danger"
                                        [disabled]="workerDeletePending === script.id"
                                        (click)="requestDeleteWorkerScript(script.id)">
                                        Delete
                                      </button>
                                    }
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
                      <table class="ngx-data-table">
                        <thead class="sticky-top">
                          <tr>
                            <th style="width: 150px" class="sortable" [class.sorted]="sortField === 'fullName'"
                                (click)="toggleSort('fullName')">
                              Name
                              <fa-icon [icon]="sortIcon('fullName')" class="sort-icon"></fa-icon>
                            </th>
                            <th class="sortable" [class.sorted]="sortField === 'email'"
                                (click)="toggleSort('email')">
                              Email
                              <fa-icon [icon]="sortIcon('email')" class="sort-icon"></fa-icon>
                            </th>
                            <th style="width: 140px" class="sortable" [class.sorted]="sortField === 'roleType'"
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
                            @if (cloudflareEmailRoutingService.emailForwardingAvailable()) {
                              <th style="width: 120px" class="sortable" [class.sorted]="sortField === 'emailForward'"
                                  (click)="toggleSort('emailForward')">
                                Email Forward
                                <fa-icon [icon]="sortIcon('emailForward')" class="sort-icon"></fa-icon>
                              </th>
                            }
                            <th style="width: 70px">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (role of filteredRoles; track $index) {
                            <tr [class.row-selected]="editingRoleOriginal === role || pendingDeleteRole === role"
                                class="pointer" (click)="toggleEditRole(role)">
                              <td>
                                {{ role.fullName || '\u2014' }}
                                @if (isDuplicateMemberIdRole(role)) {
                                  <span class="badge bg-warning ms-2"
                                        [tooltip]="duplicateMemberIdTooltip(role)">Multiple role mappings</span>
                                }
                              </td>
                              <td class="small text-nowrap">{{ role.email || '\u2014' }}</td>
                              <td>{{ stringUtils.asTitle(role.roleType) }}</td>
                              <td>{{ role.description }}</td>
                              <td class="text-center">
                                @if (role.vacant) {
                                  <span class="badge bg-warning">Yes</span>
                                }
                              </td>
                              @if (cloudflareEmailRoutingService.emailForwardingAvailable()) {
                                <td class="text-center">
                                  @switch (emailForwardStatus(role)) {
                                    @case (EmailForwardStatus.ACTIVE) {
                                      <span class="badge text-style-sunset"
                                            containerClass="email-forward-tooltip"
                                            tooltip="{{ roleEmailFor(role) }} &rarr; {{ resolvedForwardEmailFor(role) }}">Active</span>
                                    }
                                    @case (EmailForwardStatus.OUTDATED) {
                                      <span class="badge bg-warning"
                                            tooltip="Destination mismatch - click to update">Outdated</span>
                                    }
                                    @case (EmailForwardStatus.CATCH_ALL) {
                                      <span class="badge text-style-sunset"
                                            containerClass="email-forward-tooltip"
                                            tooltip="Routed via catch-all &rarr; {{ catchAllTooltipDestination() }}">Catch-all</span>
                                    }
                                    @case (EmailForwardStatus.WORKER) {
                                      <span class="badge text-style-sunset"
                                            containerClass="email-forward-tooltip"
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
                                @if (isContactUsSystemRole(role)) {
                                  <span class="d-inline-block" (click)="$event.stopPropagation()"
                                        tooltip="The Contact Us system role is the sender of contact-us emails and is linked across the site, so it can't be deleted.">
                                    <button class="btn btn-outline-ramblers btn-sm" disabled>
                                      <fa-icon [icon]="faTrash"></fa-icon>
                                    </button>
                                  </span>
                                } @else {
                                  <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-ramblers" (click)="confirmDeleteRole(role); $event.stopPropagation()"
                                            [disabled]="!!editingRoleDraft || !!pendingDeleteRole" tooltip="Delete role">
                                      <fa-icon [icon]="faTrash"></fa-icon>
                                    </button>
                                  </div>
                                }
                              </td>
                            </tr>
                            @if (pendingDeleteRole === role) {
                              <tr class="no-hover">
                                <td [attr.colspan]="cloudflareEmailRoutingService.emailForwardingAvailable() ? 7 : 6" class="p-2">
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
                  } @else {
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
                  @if (cloudflareEmailRoutingService.emailForwardingAvailable() && baseDomain) {
                      <div class="card ngx-data-card mb-3 mt-3">
                        <div class="card-header d-flex justify-content-between align-items-center">
                          <div>
                            <strong>Catch-all rule for *&commat;{{ baseDomain }}</strong>
                            @if (catchAllWorkerScriptName()) {
                              <span class="small text-muted ms-2">({{ catchAllWorkerScriptName() }})</span>
                              @if (catchAllDeployedRecipientCount()) {
                                <span class="small text-muted ms-2">· {{ stringUtils.pluraliseWithCount(catchAllDeployedRecipientCount(), "recipient") }} deployed</span>
                              }
                            }
                          </div>
                          <span class="badge {{ catchAllStatusBadgeClass() }}">{{ catchAllStatusLabel() }}</span>
                        </div>
                        <div class="card-body">
                          @if (isSharedZoneSubdomain()) {
                            <p class="small text-muted mb-2">
                              This subdomain shares the <strong>{{ parentZoneName() }}</strong> zone, so the Cloudflare catch-all rule itself is set once on the {{ parentZoneName() }} site (it must be pointed at the shared inbox router). What you set here is what that shared router does with any <code>&#64;{{ baseDomain }}</code> address that doesn't match a committee role rule:
                            </p>
                            <div class="form-check">
                              <input class="form-check-input" type="radio" name="site-catch-all-mode" id="site-catch-all-inbox"
                                     [checked]="siteCatchAllMode === InboxCatchAllMode.INBOX" (change)="siteCatchAllMode = InboxCatchAllMode.INBOX; editingSiteCatchAll = true">
                              <label class="form-check-label" for="site-catch-all-inbox">Deliver to this site's inbox (general mailbox)</label>
                            </div>
                            <div class="form-check">
                              <input class="form-check-input" type="radio" name="site-catch-all-mode" id="site-catch-all-forward"
                                     [checked]="siteCatchAllMode === InboxCatchAllMode.FORWARD" (change)="siteCatchAllMode = InboxCatchAllMode.FORWARD; editingSiteCatchAll = true">
                              <label class="form-check-label" for="site-catch-all-forward">Forward to an address</label>
                            </div>
                            @if (siteCatchAllMode === InboxCatchAllMode.FORWARD) {
                              <input type="email" class="form-control form-control-sm mt-1 mb-2"
                                     [(ngModel)]="siteCatchAllForwardTo" (ngModelChange)="editingSiteCatchAll = true"
                                     name="site-catch-all-forward-to"
                                     placeholder="e.g. committee@gmail.com">
                              <div class="small text-muted mb-2">Must be a verified Cloudflare forwarding destination. If the router can't reach it, mail falls back to the zone's shared fallback rather than being lost.</div>
                            }
                            <div class="form-check">
                              <input class="form-check-input" type="radio" name="site-catch-all-mode" id="site-catch-all-drop"
                                     [checked]="siteCatchAllMode === InboxCatchAllMode.DROP" (change)="siteCatchAllMode = InboxCatchAllMode.DROP; editingSiteCatchAll = true">
                              <label class="form-check-label" for="site-catch-all-drop">Drop (don't deliver unmatched mail)</label>
                            </div>
                            <div class="mt-3 d-flex gap-2">
                              <button class="btn btn-success btn-sm" type="button" (click)="saveSiteCatchAll()" [disabled]="siteCatchAllSaving">
                                {{ siteCatchAllSaving ? "Saving..." : "Save catch-all" }}
                              </button>
                            </div>
                            <alert type="warning" class="zone-catch-all-note">
                              <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                              <strong class="ms-2">Depends on the zone catch-all</strong>
                              <span class="ms-2">This only applies while {{ parentZoneName() }} routes unmatched mail through the shared inbox router. The zone catch-all is currently <strong>{{ catchAllStatusLabel() }}</strong>.</span>
                            </alert>
                            @if (siteCatchAllError) {
                              <div class="alert alert-warning mt-2 mb-0">
                                <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                                <span class="ms-2">{{ siteCatchAllError }}</span>
                              </div>
                            }
                          } @else {
                          <p class="small text-muted mb-2">
                            The catch-all decides what happens to mail sent to addresses on
                            <strong>{{ baseDomain }}</strong> that don't match a specific role rule.
                          </p>
                          @if (catchAllWorkerScriptName() && catchAllDeployedScriptOutOfDate && !editingCatchAll) {
                            <div class="d-flex align-items-center mb-2">
                              <app-cloudflare-button button
                                [disabled]="catchAllRedeploying"
                                [loading]="catchAllRedeploying"
                                (click)="redeployCatchAllWorker()"
                                title="Redeploy Worker with latest code"></app-cloudflare-button>
                              <span class="small text-muted ms-2">Worker code is out of date - click to redeploy.</span>
                            </div>
                          }
                          @if (!editingCatchAll) {
                            <button class="btn btn-sm btn-primary" type="button" (click)="startEditCatchAll()">Edit catch-all</button>
                          } @else {
                            <div class="row g-2">
                              <div class="col-sm-4">
                                <label class="form-label">Action</label>
                                <select class="form-select form-select-sm" [(ngModel)]="catchAllDraftAction"
                                        name="catch-all-action">
                                  <option [ngValue]="CatchAllAction.DISABLED">Disabled (no rule active)</option>
                                  <option [ngValue]="CatchAllAction.DROP">Drop (return undeliverable)</option>
                                  <option [ngValue]="CatchAllAction.FORWARD">Forward to one address</option>
                                  <option [ngValue]="CatchAllAction.WORKER">{{ catchAllWorkerScriptName() || "Worker" }}</option>
                                  <option [ngValue]="CatchAllAction.SHARED_ROUTER">Shared inbox router (deliver to inboxes, forward the rest)</option>
                                </select>
                              </div>
                              @if (catchAllDraftAction === CatchAllAction.SHARED_ROUTER) {
                                <div class="col-sm-8">
                                  <label class="form-label">Safety-net forward address</label>
                                  <input type="email" class="form-control form-control-sm"
                                         [(ngModel)]="catchAllDraftSingleDestination"
                                         name="catch-all-router-fallback"
                                         placeholder="only used if a site can't be reached, e.g. nick.barrett36@gmail.com">
                                  <div class="small text-muted mt-1">
                                    A safety net, not a routing choice: mail only comes here if a site on this zone can't be reached (its inbox endpoint is down or errors), so nothing is ever lost. Committee addresses with their own routing rules are unaffected.
                                  </div>
                                </div>
                                <div class="col-sm-12 mt-2">
                                  <h6 class="border-top pt-3 mb-1">This site's unmatched mail</h6>
                                  <div class="small text-muted mb-2">Where <code>&#64;{{ baseDomain }}</code> addresses that don't match a committee role rule go &mdash; this site's own destination, separate from the safety net above. (Each subdomain sets its own in its Committee Settings.)</div>
                                  <div class="form-check">
                                    <input class="form-check-input" type="radio" name="apex-site-catch-all-mode" id="apex-site-catch-all-inbox"
                                           [checked]="siteCatchAllMode === InboxCatchAllMode.INBOX" (change)="siteCatchAllMode = InboxCatchAllMode.INBOX">
                                    <label class="form-check-label" for="apex-site-catch-all-inbox">Deliver to this site's inbox (general mailbox)</label>
                                  </div>
                                  <div class="form-check">
                                    <input class="form-check-input" type="radio" name="apex-site-catch-all-mode" id="apex-site-catch-all-forward"
                                           [checked]="siteCatchAllMode === InboxCatchAllMode.FORWARD" (change)="siteCatchAllMode = InboxCatchAllMode.FORWARD">
                                    <label class="form-check-label" for="apex-site-catch-all-forward">Forward to an address</label>
                                  </div>
                                  @if (siteCatchAllMode === InboxCatchAllMode.FORWARD) {
                                    <input type="email" class="form-control form-control-sm mt-1 mb-2"
                                           [(ngModel)]="siteCatchAllForwardTo"
                                           name="apex-site-catch-all-forward-to"
                                           placeholder="e.g. committee@gmail.com">
                                  }
                                  <div class="form-check">
                                    <input class="form-check-input" type="radio" name="apex-site-catch-all-mode" id="apex-site-catch-all-drop"
                                           [checked]="siteCatchAllMode === InboxCatchAllMode.DROP" (change)="siteCatchAllMode = InboxCatchAllMode.DROP">
                                    <label class="form-check-label" for="apex-site-catch-all-drop">Drop (don't deliver unmatched mail)</label>
                                  </div>
                                </div>
                              }
                              @if (catchAllDraftAction === CatchAllAction.FORWARD) {
                                <div class="col-sm-8">
                                  <label class="form-label">Destination email</label>
                                  @if (connectedGmailInboxes.length) {
                                    <select class="form-select form-select-sm"
                                            [ngModel]="catchAllDestinationToken()"
                                            (ngModelChange)="catchAllDestinationChanged($event)"
                                            name="catch-all-destination-select">
                                      @for (option of catchAllDestinationOptions(); track option.token) {
                                        <option [ngValue]="option.token">{{ option.label }}</option>
                                      }
                                    </select>
                                  }
                                  @if (!connectedGmailInboxes.length || catchAllDestinationToken() === CATCH_ALL_OTHER_DESTINATION) {
                                    <input type="email" class="form-control form-control-sm"
                                           [class.mt-2]="connectedGmailInboxes.length"
                                           [(ngModel)]="catchAllDraftSingleDestination"
                                           name="catch-all-destination"
                                           placeholder="recipient@example.com">
                                  }
                                </div>
                                @if (catchAllForwardDestinationUnverified()) {
                                  <div class="col-sm-12 mt-2">
                                    <div class="d-flex align-items-center gap-2">
                                      <div class="alert alert-warning mb-0 flex-grow-1">
                                        <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                                        @if (catchAllDestinationVerificationStatus() === DestinationVerificationStatus.NOT_REGISTERED) {
                                          <strong class="ms-2">Destination not verified</strong>
                                          <span class="ms-2">{{ catchAllDraftSingleDestination }} is not yet a verified forwarding destination, so Cloudflare cannot deliver mail to it. Register and verify it first.</span>
                                        } @else {
                                          <strong class="ms-2">Verification pending</strong>
                                          <span class="ms-2">{{ catchAllDraftSingleDestination }} has not yet confirmed the verification email from Cloudflare, so mail cannot be delivered there yet.</span>
                                        }
                                      </div>
                                      <app-cloudflare-button button
                                        [disabled]="catchAllVerifying" [loading]="catchAllVerifying"
                                        (click)="registerOrResendCatchAllDestination()"
                                        [title]="catchAllVerifyButtonTitle()"></app-cloudflare-button>
                                    </div>
                                    @if (catchAllVerificationMessage) {
                                      <div class="small text-muted mt-1">{{ catchAllVerificationMessage }}</div>
                                    }
                                  </div>
                                }
                              }
                              @if (catchAllDraftAction === CatchAllAction.WORKER) {
                                <div class="col-sm-12 mt-2">
                                  <label class="form-label">Recipients</label>
                                  <app-recipient-multi-select
                                    inputId="catch-all-recipients"
                                    [recipients]="catchAllDraftMultipleDestinations"
                                    (recipientsChange)="catchAllDraftMultipleDestinations = $event"/>
                                  @if (catchAllDraftRecipientsChanged()) {
                                    <div class="small text-muted mt-1">
                                      Recipients changed - click Save to redeploy the worker with the new list.
                                    </div>
                                  } @else if (catchAllDeployedScriptOutOfDate) {
                                    <div class="small text-muted mt-1">
                                      Worker code is out of date - saving will also redeploy with the latest template.
                                    </div>
                                  }
                                </div>
                              }
                              <div class="col-sm-12 mt-3 d-flex gap-2">
                                <button class="btn btn-success btn-sm" type="button"
                                        (click)="saveCatchAll()" [disabled]="catchAllSaving">
                                  {{ catchAllSaving ? "Saving..." : "Save catch-all" }}
                                </button>
                                <button class="btn btn-outline-secondary btn-sm" type="button"
                                        (click)="cancelEditCatchAll()" [disabled]="catchAllSaving">
                                  Cancel
                                </button>
                              </div>
                              @if (catchAllError) {
                                <div class="col-sm-12 mt-2">
                                  <div class="alert alert-warning mb-0">
                                    <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                                    <span class="ms-2">{{ catchAllError }}</span>
                                  </div>
                                </div>
                              }
                            </div>
                          }
                          }
                        </div>
                      </div>
                    }
                </div>
              </tab>
              <tab heading="File Types" [active]="tabActive('file-types')" (selectTab)="selectTab('file-types')">
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
              <tab heading="Expenses" [active]="tabActive('expenses')" (selectTab)="selectTab('expenses')">
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
    imports: [PageComponent, TabsetComponent, TabDirective, MarkdownEditorComponent, CommitteeMemberEditor, TooltipDirective, FontAwesomeModule, FormsModule, NgClass, AlertComponent, AsyncPipe, RouterLink, RecipientMultiSelect, CloudflareButton]
})
export class CommitteeSettingsComponent implements OnInit, OnDestroy {
  adminPlatformEnvironmentManagementSetupPath = AdminPlatformPath.ENVIRONMENT_MANAGEMENT_SETUP;

  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeSettingsComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  private urlService = inject(UrlService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private committeeConfigService = inject(CommitteeConfigService);
  cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  private cloudflareUrl = inject(CloudflareUrlService);
  protected readonly cloudflareDashboardUrl = this.cloudflareUrl.dashboard();
  protected readonly cloudflareApiTokensUrl = this.cloudflareUrl.apiTokens();
  private committeeQueryService = inject(CommitteeQueryService);
  private environmentSetupService = inject(EnvironmentSetupService);
  private inboxService = inject(InboxService);
  private systemConfigService = inject(SystemConfigService);
  private webSocketClientService = inject(WebSocketClientService);
  private subscriptions: Subscription[] = [];
  private pendingEditType: string | null = null;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  public committeeConfig: CommitteeConfig;
  protected selectedTab = "committee-members";
  protected readonly environmentSetupGlobalQueryParams = {[StoredValue.TAB]: toKebabCase(EnvironmentSetupTab.SETTINGS), [StoredValue.SUB_TAB]: EnvironmentSettingsSubTab.GLOBAL};
  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly EmailForwardStatus = EmailForwardStatus;
  protected readonly CatchAllAction = CatchAllAction;
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
  editingCatchAll = false;
  catchAllDraftAction: CatchAllAction = CatchAllAction.DISABLED;
  catchAllDraftSingleDestination = "";
  catchAllDraftMultipleDestinations: string[] = [];
  readonly CATCH_ALL_OTHER_DESTINATION = "__other__";
  connectedGmailInboxes: string[] = [];
  catchAllSaving = false;
  catchAllError: string | null = null;
  catchAllDeployedRecipients: string[] = [];
  catchAllDeployedScriptOutOfDate = false;
  catchAllRedeploying = false;
  destinationAddresses: DestinationAddress[] = [];
  catchAllVerifying = false;
  catchAllVerificationMessage: string | null = null;
  protected readonly DestinationVerificationStatus = DestinationVerificationStatus;
  workerScripts: EmailWorkerScript[] = [];
  workerDeletePending: string | null = null;
  baseDomain = "";
  cloudflareAccountId: string = "";
  cloudflareZoneId: string = "";
  cloudflareOwnsZone: boolean;
  cloudflareZoneName = "";
  private systemConfigInternal: SystemConfig;
  protected editingSiteCatchAll = false;
  protected siteCatchAllMode: InboxCatchAllMode;
  protected siteCatchAllForwardTo = "";
  protected siteCatchAllSaving = false;
  protected siteCatchAllError: string = null;
  protected readonly InboxCatchAllMode = InboxCatchAllMode;
  platformAdminEnabled = false;
  committeeMembersLoaded = false;
  committeeRolesAlertDismissed = false;

  ngOnInit() {
    this.cloudflareEmailRoutingService.invalidateCache();
    this.committeeConfigService.refreshConfig();
    this.webSocketClientService.connect().catch(() => this.logger.info("WebSocket unavailable for live config updates"));
    this.subscriptions.push(this.webSocketClientService.receiveMessages<{key: string}>(MessageType.CONFIG_UPDATED)
      .pipe(filter(event => event?.key === ConfigKey.COMMITTEE))
      .subscribe(() => {
        this.logger.info("committee config updated by another user — refreshing");
        this.cloudflareEmailRoutingService.invalidateCache();
        this.committeeConfigService.refreshConfig();
      }));
    this.subscriptions.push(this.systemConfigService.events().subscribe(config => {
      this.systemConfigInternal = config;
      if (!this.editingSiteCatchAll && !this.editingCatchAll) {
        this.siteCatchAllForwardTo = config?.inbox?.catchAll?.forwardTo || "";
        this.siteCatchAllMode = config?.inbox?.catchAll?.mode ?? InboxCatchAllMode.INBOX;
      }
    }));
    this.committeeQueryService.queryCommitteeMembers()
      .then(() => this.committeeMembersLoaded = true)
      .catch(err => this.logger.error("Committee members not available:", err));
    this.cloudflareEmailRoutingService.queryCloudflareConfig()
      .then(config => {
        if (config?.configured !== false) {
          this.cloudflareEmailRoutingService.queryRules().catch(err => this.logger.error("Email routing rules not available:", err));
          this.cloudflareEmailRoutingService.queryCatchAllRule().catch(err => this.logger.error("Catch-all rule not available:", err));
          this.cloudflareEmailRoutingService.queryWorkers().catch(err => this.logger.error("Cloudflare workers not available:", err));
          this.cloudflareEmailRoutingService.queryDestinationAddresses().catch(err => this.logger.error("Cloudflare destination addresses not available:", err));
        }
      })
      .catch(err => this.logger.error("Cloudflare config not available:", err));
    this.environmentSetupService.status()
      .then(status => this.platformAdminEnabled = status.platformAdminEnabled)
      .catch(err => this.logger.error("Platform admin status not available:", err));
    this.loadConnectedGmailInboxes();
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
        const tab = params[StoredValue.TAB];
        if (tab) {
          this.selectedTab = tab;
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
        this.refreshDeployedCatchAllWorkerInfo();
      }),
      this.cloudflareEmailRoutingService.destinationAddressesNotifications().subscribe(addresses => {
        this.destinationAddresses = addresses || [];
      }),
      this.cloudflareEmailRoutingService.workersNotifications().subscribe(workers => {
        this.workerScripts = workers;
      }),
      this.cloudflareEmailRoutingService.cloudflareConfigNotifications().subscribe((config: NonSensitiveCloudflareConfig) => {
        this.baseDomain = config?.baseDomain || "";
        this.cloudflareAccountId = config?.accountId || "";
        this.cloudflareZoneId = config?.zoneId || "";
        this.cloudflareOwnsZone = config?.ownsZone;
        this.cloudflareZoneName = config?.zoneName || "";
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

  get committeeMembersWithoutRole(): Member[] {
    const linkedMemberIds = new Set((this.committeeConfig?.roles ?? []).map(role => role.memberId).filter(Boolean));
    return (this.committeeQueryService.committeeMembers ?? []).filter(member => !linkedMemberIds.has(member.id));
  }

  memberFullName(member: Member): string {
    const firstName = member?.firstName || member?.title || "";
    const lastName = member?.lastName || "";
    return `${firstName} ${firstName === lastName ? "" : lastName}`.trim();
  }

  private roleForMember(member: Member): CommitteeMember {
    const fullName = this.memberFullName(member);
    const role = this.committeeConfigService.emptyCommitteeMember();
    role.memberId = member.id;
    role.fullName = fullName;
    role.roleType = RoleType.COMMITTEE_MEMBER;
    role.description = fullName;
    role.type = toKebabCase(fullName);
    role.emailDerivation = EmailDerivation.FULL_NAME;
    role.vacant = false;
    if (this.baseDomain) {
      role.email = `${toDotCase(fullName)}@${this.baseDomain}`;
    }
    role.nameAndDescription = this.committeeConfigService.nameAndDescriptionFrom(role);
    return role;
  }

  addMissingCommitteeRoles(): void {
    const newRoles = this.committeeMembersWithoutRole.map(member => this.roleForMember(member));
    if (!newRoles.length) {
      return;
    }
    this.committeeConfig.roles = [...this.committeeConfig.roles, ...newRoles];
  }

  isDuplicateMemberIdRole(role: CommitteeMember): boolean {
    if (!role.memberId) return false;
    return (this.committeeConfig?.roles ?? []).filter(r => r.memberId === role.memberId).length > 1;
  }

  duplicateMemberIdTooltip(role: CommitteeMember): string {
    if (!role.memberId) return "";
    const otherRoles = (this.committeeConfig?.roles ?? [])
      .filter(other => other !== role && other.memberId === role.memberId)
      .map(other => other.description || this.stringUtils.asTitle(other.roleType));
    if (otherRoles.length === 0) return "";
    const memberLabel = role.fullName || "this member";
    return `${memberLabel} is also assigned to: ${otherRoles.join(", ")}`;
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
      case ForwardEmailTarget.CATCHALL:
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
      return this.cloudflareUrl.emailRoutingRules(this.cloudflareAccountId, this.cloudflareZoneId);
    }
    return null;
  }

  workerServiceUrl(scriptName: string): string {
    if (!this.cloudflareAccountId || !scriptName) {
      return null;
    }
    return this.cloudflareUrl.worker(this.cloudflareAccountId, scriptName);
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

  workerDeleteConfirmPending: string = null;

  requestDeleteWorkerScript(scriptName: string) {
    this.workerDeleteConfirmPending = scriptName;
  }

  cancelDeleteWorkerScript() {
    this.workerDeleteConfirmPending = null;
  }

  async deleteWorkerScript(scriptName: string) {
    if (!this.platformAdminEnabled || !scriptName) {
      return;
    }
    this.workerDeleteConfirmPending = null;
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

  protected roleEmailFor(role: CommitteeMember): string {
    if (role.email && this.baseDomain && role.email.endsWith(`@${this.baseDomain}`)) {
      return role.email;
    }
    return `${role.type}@${this.baseDomain}`;
  }

  emailForwardStatus(role: CommitteeMember): EmailForwardStatus {
    if (role.vacant || !this.cloudflareEmailRoutingService.emailForwardingAvailable()) return EmailForwardStatus.NA;
    if (role.forwardEmailTarget === ForwardEmailTarget.CATCHALL) return EmailForwardStatus.CATCH_ALL;
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
        return role.forwardEmailTarget === ForwardEmailTarget.MULTIPLE ? EmailForwardStatus.WORKER : EmailForwardStatus.ACTIVE;
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

  catchAllTooltipDestination(): string {
    const forwardAddress = this.catchAllDestination();
    if (forwardAddress) {
      return forwardAddress;
    }
    if (this.catchAllResolvedAction() === CatchAllAction.WORKER) {
      return this.stringUtils.pluraliseWithCount(this.catchAllDeployedRecipientCount(), "recipient");
    }
    return this.catchAllStatusLabel();
  }

  clearForwardsConfirmPending = false;
  clearForwardsPending = false;

  requestClearAllForwards(): void {
    this.clearForwardsConfirmPending = true;
  }

  cancelClearAllForwards(): void {
    this.clearForwardsConfirmPending = false;
  }

  domainForwardRules(): EmailRoutingRule[] {
    const domain = (this.baseDomain || "").toLowerCase();
    if (!domain) {
      return [];
    }
    return (this.emailRoutingRules || []).filter(rule => rule.matchers?.some(matcher =>
      matcher.type === EmailRoutingMatcherType.LITERAL
      && matcher.field === EmailRoutingMatcherField.TO
      && !!matcher.value
      && matcher.value.split("@")[1]?.toLowerCase() === domain));
  }

  async clearAllForwards(): Promise<void> {
    const rulesToDelete = this.domainForwardRules();
    this.clearForwardsConfirmPending = false;
    this.clearForwardsPending = true;
    try {
      for (const rule of rulesToDelete) {
        if (rule.id) {
          await this.cloudflareEmailRoutingService.deleteRule(rule.id);
        }
      }
      (this.committeeConfig?.roles ?? []).forEach(role => {
        if (!role.vacant) {
          role.forwardEmailTarget = ForwardEmailTarget.CATCHALL;
          role.forwardEmailCustom = null;
        }
      });
      await this.cloudflareEmailRoutingService.queryRules();
      await this.save();
      this.notify.success({
        title: "Forwards cleared",
        message: `Deleted ${this.stringUtils.pluraliseWithCount(rulesToDelete.length, "Cloudflare forwarding rule")} for ${this.baseDomain}. All role mail now routes via the catch-all.`
      });
    } catch (error) {
      this.notify.error(error);
    } finally {
      this.clearForwardsPending = false;
    }
  }

  catchAllWorkerScriptName(): string {
    const workerAction = this.catchAllRule?.actions?.find(a => a.type === EmailRoutingActionType.WORKER);
    return workerAction?.value?.[0] || null;
  }

  isSharedZoneSubdomain(): boolean {
    return this.cloudflareOwnsZone === false;
  }

  async saveSiteCatchAll(): Promise<void> {
    this.siteCatchAllError = null;
    if (this.siteCatchAllMode === InboxCatchAllMode.FORWARD && !this.siteCatchAllForwardTo.trim()) {
      this.siteCatchAllError = "Enter a forward address for the Forward option.";
      return;
    }
    this.siteCatchAllSaving = true;
    try {
      await this.persistSiteCatchAllPolicy();
    } catch (err) {
      this.logger.error("Failed to save site catch-all policy:", err);
      this.siteCatchAllError = extractErrorMessage(err) || "Failed to save catch-all policy.";
    } finally {
      this.siteCatchAllSaving = false;
    }
  }

  private async persistSiteCatchAllPolicy(): Promise<void> {
    const config = this.systemConfigInternal;
    config.inbox = {
      ...(config.inbox || {provider: InboxReaderProvider.GMAIL_API}),
      catchAll: this.siteCatchAllMode === InboxCatchAllMode.FORWARD
        ? {mode: InboxCatchAllMode.FORWARD, forwardTo: this.siteCatchAllForwardTo.trim()}
        : {mode: this.siteCatchAllMode}
    };
    await this.systemConfigService.saveConfig(config);
    this.editingSiteCatchAll = false;
  }

  parentZoneName(): string {
    return this.cloudflareZoneName || "the parent domain";
  }

  catchAllResolvedAction(): CatchAllAction {
    if (!this.catchAllRule || !this.catchAllRule.enabled) {
      return CatchAllAction.DISABLED;
    }
    const action = this.catchAllRule.actions?.[0];
    if (action?.type === EmailRoutingActionType.FORWARD) {
      return CatchAllAction.FORWARD;
    }
    if (action?.type === EmailRoutingActionType.WORKER) {
      return action.value?.[0] === SHARED_INBOX_ROUTER_WORKER_NAME ? CatchAllAction.SHARED_ROUTER : CatchAllAction.WORKER;
    }
    return CatchAllAction.DROP;
  }

  catchAllStatusLabel(): string {
    const resolved = this.catchAllResolvedAction();
    switch (resolved) {
      case CatchAllAction.FORWARD:
        return `Forward -> ${this.catchAllDestination() || "?"}`;
      case CatchAllAction.WORKER:
        return this.catchAllWorkerScriptName() || "Worker";
      case CatchAllAction.SHARED_ROUTER:
        return "Shared inbox router";
      case CatchAllAction.DROP:
        return "Drop";
      case CatchAllAction.DISABLED:
      default:
        return "Disabled";
    }
  }

  catchAllStatusBadgeClass(): string {
    const resolved = this.catchAllResolvedAction();
    if (resolved === CatchAllAction.FORWARD || resolved === CatchAllAction.WORKER || resolved === CatchAllAction.SHARED_ROUTER) {
      return "text-style-sunset";
    }
    if (resolved === CatchAllAction.DROP) {
      return "bg-warning";
    }
    return "bg-secondary";
  }

  async startEditCatchAll(): Promise<void> {
    this.editingCatchAll = true;
    this.catchAllError = null;
    this.catchAllVerificationMessage = null;
    this.cloudflareEmailRoutingService.queryDestinationAddresses().catch(err => this.logger.error("Cloudflare destination addresses not available:", err));
    this.catchAllDraftAction = this.catchAllResolvedAction();
    const action = this.catchAllRule?.actions?.[0];
    const isForward = action?.type === EmailRoutingActionType.FORWARD;
    if (this.catchAllDraftAction === CatchAllAction.SHARED_ROUTER) {
      this.catchAllDraftSingleDestination = this.sharedRouterFallbackFromRuleName();
      this.catchAllDraftMultipleDestinations = [""];
    } else if (this.catchAllDraftAction === CatchAllAction.WORKER) {
      this.catchAllDraftSingleDestination = "";
      this.catchAllDraftMultipleDestinations = await this.recipientsForExistingCatchAllWorker();
    } else {
      this.catchAllDraftSingleDestination = isForward ? (action?.value?.[0] || "") : "";
      this.catchAllDraftMultipleDestinations = [""];
    }
  }

  private sharedRouterFallbackFromRuleName(): string {
    const match = /\(fallback\s+(.+?)\)\s*$/.exec(this.catchAllRule?.name || "");
    return match ? match[1].trim() : "";
  }

  cancelEditCatchAll(): void {
    this.editingCatchAll = false;
    this.catchAllError = null;
    this.catchAllVerificationMessage = null;
    this.catchAllDraftSingleDestination = "";
    this.catchAllDraftMultipleDestinations = [];
    this.editingSiteCatchAll = false;
    this.siteCatchAllForwardTo = this.systemConfigInternal?.inbox?.catchAll?.forwardTo || "";
    this.siteCatchAllMode = this.systemConfigInternal?.inbox?.catchAll?.mode ?? InboxCatchAllMode.INBOX;
  }

  catchAllDestinationVerificationStatus(): DestinationVerificationStatus | null {
    return destinationVerificationStatusFor(this.catchAllDraftSingleDestination, this.destinationAddresses);
  }

  catchAllForwardDestinationUnverified(): boolean {
    return this.catchAllDraftAction === CatchAllAction.FORWARD
      && !!(this.catchAllDraftSingleDestination || "").trim()
      && this.catchAllDestinationVerificationStatus() !== DestinationVerificationStatus.VERIFIED;
  }

  catchAllVerifyButtonTitle(): string {
    return this.catchAllDestinationVerificationStatus() === DestinationVerificationStatus.NOT_REGISTERED
      ? "Register & Verify"
      : "Resend Verification";
  }

  async registerOrResendCatchAllDestination(): Promise<void> {
    const email = (this.catchAllDraftSingleDestination || "").trim();
    if (!email || this.catchAllVerifying) {
      return;
    }
    this.catchAllVerifying = true;
    this.catchAllError = null;
    this.catchAllVerificationMessage = null;
    try {
      if (this.catchAllDestinationVerificationStatus() === DestinationVerificationStatus.NOT_REGISTERED) {
        await this.cloudflareEmailRoutingService.createDestinationAddress(email);
      } else {
        await this.cloudflareEmailRoutingService.resendDestinationVerification(email);
      }
      await this.cloudflareEmailRoutingService.queryDestinationAddresses();
      this.catchAllVerificationMessage = `Verification email sent to ${email}. Open that inbox, click the Cloudflare link, then Save catch-all.`;
    } catch (err) {
      this.logger.error("Failed to register or resend catch-all destination verification:", err);
      this.catchAllError = extractErrorMessage(err) || "Could not send the verification email.";
    } finally {
      this.catchAllVerifying = false;
    }
  }

  private async loadConnectedGmailInboxes(): Promise<void> {
    try {
      const connections = await this.inboxService.mailboxConnections();
      this.connectedGmailInboxes = (connections || [])
        .filter(connection => connection.connectionStatus === InboxAliasConnectionStatus.CONNECTED)
        .map(connection => connection.gmailAccountEmail)
        .filter((email): email is string => !!email);
    } catch (err) {
      this.logger.error("Failed to load connected Gmail inboxes:", err);
      this.connectedGmailInboxes = [];
    }
  }

  catchAllDestinationOptions(): { token: string; label: string }[] {
    const inboxOptions = this.connectedGmailInboxes.map(email => ({token: email, label: `Gmail inbox (${email})`}));
    return [...inboxOptions, {token: this.CATCH_ALL_OTHER_DESTINATION, label: "Other address…"}];
  }

  catchAllDestinationToken(): string {
    return this.connectedGmailInboxes.includes(this.catchAllDraftSingleDestination)
      ? this.catchAllDraftSingleDestination
      : this.CATCH_ALL_OTHER_DESTINATION;
  }

  catchAllDestinationChanged(token: string): void {
    if (token === this.CATCH_ALL_OTHER_DESTINATION) {
      if (this.connectedGmailInboxes.includes(this.catchAllDraftSingleDestination)) {
        this.catchAllDraftSingleDestination = "";
      }
    } else {
      this.catchAllDraftSingleDestination = token;
    }
  }

  async saveCatchAll(): Promise<void> {
    this.catchAllError = null;
    this.catchAllSaving = true;
    try {
      const singleDestinationActions = [CatchAllAction.FORWARD, CatchAllAction.SHARED_ROUTER];
      const destinations = singleDestinationActions.includes(this.catchAllDraftAction)
        ? [this.catchAllDraftSingleDestination]
        : this.catchAllDraftMultipleDestinations;
      const cleaned = destinations.map(d => (d || "").trim()).filter(Boolean);
      if (this.catchAllDraftAction === CatchAllAction.FORWARD && cleaned.length !== 1) {
        this.catchAllError = "Enter a single destination email for the Forward action.";
        return;
      }
      if (this.catchAllDraftAction === CatchAllAction.SHARED_ROUTER && cleaned.length !== 1) {
        this.catchAllError = "Enter a single fallback forward address for the shared inbox router.";
        return;
      }
      if (this.catchAllDraftAction === CatchAllAction.WORKER && cleaned.length === 0) {
        this.catchAllError = "Add at least one destination email for the Multiple action.";
        return;
      }
      if (this.catchAllDraftAction === CatchAllAction.SHARED_ROUTER
        && this.siteCatchAllMode === InboxCatchAllMode.FORWARD && !this.siteCatchAllForwardTo.trim()) {
        this.catchAllError = "Enter a forward address for this site's 'Forward to an address' option.";
        return;
      }
      await this.cloudflareEmailRoutingService.updateCatchAllRule({
        action: this.catchAllDraftAction,
        destinations: cleaned
      });
      if (this.catchAllDraftAction === CatchAllAction.SHARED_ROUTER) {
        await this.persistSiteCatchAllPolicy();
      }
      this.editingCatchAll = false;
      await this.refreshDeployedCatchAllWorkerInfo();
    } catch (err) {
      this.logger.error("Failed to save catch-all rule:", err);
      this.catchAllError = extractErrorMessage(err) || "Failed to save catch-all rule.";
    } finally {
      this.catchAllSaving = false;
    }
  }

  private async recipientsForExistingCatchAllWorker(): Promise<string[]> {
    const action = this.catchAllRule?.actions?.find(a => a.type === EmailRoutingActionType.WORKER);
    const scriptName = action?.value?.[0];
    if (!scriptName) {
      return [""];
    }
    try {
      const recipients = await this.cloudflareEmailRoutingService.queryWorkerRecipients(scriptName);
      return recipients?.length ? [...recipients] : [""];
    } catch (err) {
      this.logger.error("Failed to load catch-all worker recipients for", scriptName, err);
      return [""];
    }
  }

  private async refreshDeployedCatchAllWorkerInfo(): Promise<void> {
    const scriptName = this.catchAllWorkerScriptName();
    if (!scriptName || !this.baseDomain) {
      this.catchAllDeployedRecipients = [];
      this.catchAllDeployedScriptOutOfDate = false;
      return;
    }
    try {
      const info = await this.cloudflareEmailRoutingService.queryWorkerInfo(scriptName, {
        roleEmail: `*@${this.baseDomain}`,
        roleName: "catch-all"
      });
      this.catchAllDeployedRecipients = info.recipients || [];
      this.catchAllDeployedScriptOutOfDate = info.upToDate === false;
    } catch (err) {
      this.logger.error("Failed to load catch-all worker info for", scriptName, err);
      this.catchAllDeployedRecipients = [];
      this.catchAllDeployedScriptOutOfDate = false;
    }
  }

  catchAllDeployedRecipientCount(): number {
    return this.catchAllDeployedRecipients?.length || 0;
  }

  catchAllDraftRecipientsChanged(): boolean {
    if (!this.editingCatchAll || this.catchAllDraftAction !== CatchAllAction.WORKER) {
      return false;
    }
    const draft = (this.catchAllDraftMultipleDestinations || [])
      .map(d => (d || "").trim())
      .filter(Boolean)
      .map(d => d.toLowerCase())
      .sort();
    const deployed = (this.catchAllDeployedRecipients || [])
      .map(d => (d || "").trim())
      .filter(Boolean)
      .map(d => d.toLowerCase())
      .sort();
    if (draft.length !== deployed.length) {
      return true;
    }
    return draft.some((email, index) => email !== deployed[index]);
  }

  async redeployCatchAllWorker(): Promise<void> {
    const scriptName = this.catchAllWorkerScriptName();
    if (!scriptName || this.catchAllRedeploying) {
      return;
    }
    this.catchAllRedeploying = true;
    this.catchAllError = null;
    try {
      if (this.catchAllResolvedAction() === CatchAllAction.SHARED_ROUTER) {
        await this.cloudflareEmailRoutingService.redeployRouterWorker();
      } else {
        const recipients = this.catchAllDeployedRecipients?.length
          ? this.catchAllDeployedRecipients
          : await this.cloudflareEmailRoutingService.queryWorkerRecipients(scriptName);
        await this.cloudflareEmailRoutingService.updateCatchAllRule({
          action: CatchAllAction.WORKER,
          destinations: recipients
        });
      }
      await this.refreshDeployedCatchAllWorkerInfo();
    } catch (err) {
      this.logger.error("Failed to redeploy catch-all worker:", err);
      this.catchAllError = extractErrorMessage(err) || "Failed to redeploy catch-all worker.";
    } finally {
      this.catchAllRedeploying = false;
    }
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
    if (this.isContactUsSystemRole(this.editingRoleDraft)) {
      return `${this.editingRoleDraft.description || "Contact Us"} system role`;
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

  isContactUsSystemRole(role: CommitteeMember): boolean {
    return role?.roleType === RoleType.SYSTEM_ROLE && role?.builtInRoleMapping === BuiltInRole.CONTACT_US;
  }

  confirmDeleteRole(role: CommitteeMember) {
    if (this.isContactUsSystemRole(role)) {
      return;
    }
    this.pendingDeleteRole = role;
  }

  cancelDeleteRole() {
    this.pendingDeleteRole = null;
  }

  executeDeleteRole() {
    if (this.pendingDeleteRole && !this.isContactUsSystemRole(this.pendingDeleteRole)) {
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

  tabActive(tab: string): boolean {
    return this.selectedTab === tab;
  }

  selectTab(tab: string): void {
    this.selectedTab = tab;
    void this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {[StoredValue.TAB]: tab}, queryParamsHandling: "merge"});
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
