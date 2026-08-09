import { Component, inject, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { DOCUMENT, NgClass } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { keys } from "es-toolkit/compat";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBoxArchive,
  faBriefcase,
  faBuilding,
  faChartLine,
  faCheck,
  faCircleCheck,
  faCircleExclamation,
  faCopy,
  faDesktop,
  faDownload,
  faExternalLinkAlt,
  faFolderOpen,
  faGlobe,
  faHouse,
  faIdCard,
  faKey,
  faPlay,
  faPlug,
  faRotate,
  faSave,
  faServer,
  faShieldHalved,
  faTableList,
  faUser,
  faUserLock
} from "@fortawesome/free-solid-svg-icons";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import {
  ConsoleAccessCredentialField,
  ConsoleAccessEnvironmentListItem,
  ConsoleAccessIdentifierInfo,
  ConsoleAccessLoginView,
  ConsoleAccessResolvedUrlInfo,
  ConsoleAccessServiceInfo,
  ConsoleAccessTableRow,
  ConsoleAccessUrlIconKey,
  ConsoleSharedIdentifierGroup,
  EstateRebuildCaptureFormat,
  EstateRebuildCaptureSummary,
  EstateRebuildConfigured,
  EstateRebuildDownloadChoice,
  EstateRebuildFieldLayer,
  EstateRebuildInventory,
  EstateRebuildSiteCaptureRow
} from "../../../models/environment-setup.model";
import { SectionToggleTab } from "../../../models/section-toggle.model";
import { VendorSystemSelectItem } from "../../../models/vendor-brand.model";
import { AlertTarget } from "../../../models/alert-target.model";
import { StoredValue } from "../../../models/ui-actions";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { toKebabCase } from "../../../functions/strings";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { ClipboardService } from "../../../services/clipboard.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageComponent } from "../../../page/page.component";
import { LoginRequiredComponent } from "../../../modules/common/login-required/login-required";
import { SecretInputComponent } from "../../../modules/common/secret-input/secret-input.component";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import {
  SortableTableColumn,
  SortableTableSortState
} from "../../../modules/common/sortable-table/sortable-table.model";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { VendorBrandMarkComponent } from "../../../modules/common/vendor-brand-mark/vendor-brand-mark.component";
import {
  VendorSystemSelectComponent
} from "../../../modules/common/vendor-system-select/vendor-system-select.component";

const PLATFORM_SCOPE = "platform";
const CONSOLE_SCOPE_ALL = "all";
const FULL_WIDTH_BODY_CLASS = "estate-rebuild-full-width";
const SORT_ORDER_ASC = "asc";
const SORT_ORDER_DESC = "desc";

enum PageMode {
  INVENTORY = "inventory",
  SYSTEM_LOGINS = "system-logins",
  OFFLINE_EXPORT = "offline-export"
}

enum AuditSectionTab {
  SYSTEMS = "systems",
  SITES = "sites",
  FIELDS = "fields",
  PLATFORM = "platform"
}

enum LayoutWidth {
  WIDE = "wide",
  NORMAL = "normal"
}

const AUDIT_SECTION_DEFAULT_SORT: Record<AuditSectionTab, string> = {
  [AuditSectionTab.SYSTEMS]: "name",
  [AuditSectionTab.SITES]: "environment",
  [AuditSectionTab.FIELDS]: "environment",
  [AuditSectionTab.PLATFORM]: "category"
};

@Component({
  selector: "app-estate-rebuild-capture",
  encapsulation: ViewEncapsulation.None,
  template: `
    <app-page>
      <app-login-required/>
      <div class="row">
        <div class="col-12">
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <h1 class="mb-0">Platform Configuration Values</h1>
            <div>
              <app-section-toggle
                [tabs]="widthTabs"
                [selectedTab]="layoutWidth"
                (selectedTabChange)="onLayoutWidthChange($event)"/>
            </div>
          </div>
          <p class="mb-2">
            This page gathers everything needed to understand and rebuild the NGX-Ramblers platform:
            live config across all group sites, human logins for the systems those sites depend on,
            and an optional offline pack you can store safely outside the app.
          </p>
          <p class="text-muted mb-3">
            The point is to share that picture with Ramblers Head office so knowledge is not locked
            in one person’s head or laptop. If something fails - or someone is away - the project
            can still be recovered without a single point of failure.
          </p>

          @if (notifyTarget.showAlert) {
            <div class="alert {{ notifyTarget.alert.class }} d-flex align-items-start mb-3" role="alert">
              <fa-icon [icon]="notifyTarget.alert.icon" class="me-2 mt-1"></fa-icon>
              <div>
                @if (notifyTarget.alertTitle) {
                  <strong class="d-block">{{ notifyTarget.alertTitle }}</strong>
                }
                {{ notifyTarget.alertMessage }}
              </div>
            </div>
          }

          <div class="mb-3">
            <app-section-toggle
              [tabs]="pageModeTabs"
              [selectedTab]="pageMode"
              (selectedTabChange)="onPageModeChange($event)"
              [fullWidth]="true"/>
          </div>

          @if (pageMode === pageModeInventory) {
          <div class="row thumbnail-heading-frame">
            <div class="thumbnail-heading">Configuration inventory</div>
            <div class="col-sm-12">
              <p>
                Live audit of config across every site: third-party systems, site directory, per-site field values,
                and shared platform config. Read from staging <code>config.environments</code> and each site Mongo
                <code>config</code> collection.
              </p>
              <p class="text-muted">
                This runs on the platform-admin (staging) server, which holds the central environments map and can probe each site database.
              </p>
              <div class="d-flex flex-wrap gap-2 mb-3 align-items-center">
                  <button type="button"
                          class="btn btn-primary text-nowrap"
                          [disabled]="inventoryBusy"
                          (click)="loadInventory()">
                    <fa-icon [icon]="faRotate" class="me-1"></fa-icon>
                    {{ inventoryBusy ? "Loading…" : (inventory ? "Refresh" : "Load audit") }}
                  </button>
                  <div class="form-check mb-0">
                    <input class="form-check-input"
                           type="checkbox"
                           id="inventory-secrets"
                           [(ngModel)]="inventoryIncludeSecrets"
                           (ngModelChange)="onInventoryIncludeSecretsChange()"
                           [disabled]="inventoryBusy"
                           name="inventoryIncludeSecrets">
                    <label class="form-check-label text-nowrap" for="inventory-secrets">
                      Show secret values
                    </label>
                  </div>
                </div>

                @if (summary && !inventory) {
                  <div class="alert alert-success d-flex align-items-start" role="alert">
                    <fa-icon [icon]="faCircleCheck" class="me-2 mt-1"></fa-icon>
                    <div>
                      <strong class="d-block">Ready to load</strong>
                      {{ summary.siteCount }} sites ·
                      {{ summary.fieldsPerSite }} fields per site ·
                      {{ summary.siteCaptureRows }} configuration rows.
                      Loading probes every site database and may take around half a minute.
                    </div>
                  </div>
                }

                @if (inventory) {
                  <div class="era-stats">
                    <div class="era-stat-card">
                      <div class="era-stat-value">{{ inventory.siteCount }}</div>
                      <div class="era-stat-label">Sites</div>
                      <div class="era-stat-detail">Live environments</div>
                    </div>
                    <div class="era-stat-card">
                      <div class="era-stat-value">{{ inventory.fieldsPerSite }}</div>
                      <div class="era-stat-label">Fields / site</div>
                      <div class="era-stat-detail">{{ inventory.siteCaptureRows }} configuration rows</div>
                    </div>
                    <div class="era-stat-card">
                      <div class="era-stat-value">{{ presentCount() }}</div>
                      <div class="era-stat-label">Configured</div>
                      <div class="era-stat-detail">Values present</div>
                    </div>
                    <div class="era-stat-card">
                      <div class="era-stat-value">{{ emptyCount() }}</div>
                      <div class="era-stat-label">Empty</div>
                      <div class="era-stat-detail">Still to fill</div>
                    </div>
                    <div class="era-stat-card">
                      <div class="era-stat-value">{{ contactsCount() }}</div>
                      <div class="era-stat-label">With contacts</div>
                      <div class="era-stat-detail">Chairman or webmaster</div>
                    </div>
                  </div>

                  <p class="text-muted small mb-3">
                    Generated {{ inventory.generatedAtUtc }} ·
                    secrets {{ inventory.includeSecrets ? "included" : "presence only" }}
                  </p>

                  <div class="mb-3">
                    <app-section-toggle
                      [tabs]="auditSectionTabs"
                      [selectedTab]="auditSectionTab"
                      (selectedTabChange)="onAuditSectionChange($event)"
                      [fullWidth]="true"/>
                  </div>

                  @if (auditSectionTab === auditTabSystems) {
                    <h3 class="h5 mb-2">Third-party systems</h3>
                    <p class="text-muted mb-3">
                      One row per integrated system: what it does, what is held, and where it lives in config.
                      Open site values for a system to compare API keys and config across every environment.
                    </p>
                    <app-sortable-table
                      [columns]="systemsColumns"
                      [rows]="inventory.thirdPartySystems"
                      [defaultSortKey]="auditSortKey"
                      [defaultSortDirection]="auditSortDirection"
                      (sortChange)="onAuditSortChange($event)"
                      [trackBy]="trackSystem"
                      [maxHeight]="'60vh'"
                      emptyMessage="No third-party systems listed.">
                      <ng-template appSortableTableCell="icon" let-row>
                        <span class="system-icon-cell">
                          <app-vendor-brand-mark [systemId]="row.systemId" [sizePx]="22"/>
                        </span>
                      </ng-template>
                      <ng-template appSortableTableCell="name" let-row>
                        <strong>{{ row.name }}</strong>
                      </ng-template>
                      <ng-template appSortableTableCell="configPaths" let-row>
                        <code>{{ row.configPaths }}</code>
                      </ng-template>
                      <ng-template appSortableTableCell="actions" let-row>
                        <button type="button"
                                class="btn btn-quiet btn-sm console-copy-btn"
                                (click)="openSiteValuesForSystem(row.systemId)"
                                tooltip="Site values for this system"
                                container="body">
                          <fa-icon [icon]="faTableList" size="xs"></fa-icon>
                        </button>
                      </ng-template>
                    </app-sortable-table>
                  }

                  @if (auditSectionTab === auditTabSites) {
                    <h3 class="h5 mb-2">Sites directory</h3>
                    <p class="text-muted mb-3">
                      One row per live environment: group identity, contacts, Fly app, Mongo and AWS placement.
                    </p>
                    <app-sortable-table
                      [columns]="sitesColumns"
                      [rows]="inventory.sites"
                      [defaultSortKey]="auditSortKey"
                      [defaultSortDirection]="auditSortDirection"
                      (sortChange)="onAuditSortChange($event)"
                      [trackBy]="trackSite"
                      [maxHeight]="'60vh'"
                      emptyMessage="No sites found.">
                      <ng-template appSortableTableCell="environment" let-row>
                        <strong>{{ row.environment }}</strong>
                      </ng-template>
                      <ng-template appSortableTableCell="groupCode" let-row>
                        <code>{{ row.groupCode }}</code>
                      </ng-template>
                      <ng-template appSortableTableCell="siteHref" let-row>
                        @if (row.siteHref) {
                          <a [href]="row.siteHref" target="_blank" rel="noopener noreferrer">{{ row.siteHref }}</a>
                        }
                      </ng-template>
                      <ng-template appSortableTableCell="chairman" let-row>
                        {{ row.chairmanName }}
                        @if (row.chairmanEmail) {
                          <br><code>{{ row.chairmanEmail }}</code>
                        }
                      </ng-template>
                      <ng-template appSortableTableCell="webmaster" let-row>
                        {{ row.webmasterName }}
                        @if (row.webmasterEmail) {
                          <br><code>{{ row.webmasterEmail }}</code>
                        }
                      </ng-template>
                      <ng-template appSortableTableCell="flyAppName" let-row>
                        <code>{{ row.flyAppName }}</code>
                      </ng-template>
                      <ng-template appSortableTableCell="mongo" let-row>
                        <code>{{ row.mongoCluster }} / {{ row.mongoDb }}</code>
                      </ng-template>
                      <ng-template appSortableTableCell="awsBucket" let-row>
                        <code>{{ row.awsBucket }}</code>
                      </ng-template>
                      <ng-template appSortableTableCell="probeStatus" let-row>
                        <span class="era-badge"
                              [class.present]="row.probeStatus === 'ok'"
                              [class.error]="row.probeStatus !== 'ok'">
                          {{ row.probeStatus }}
                        </span>
                      </ng-template>
                    </app-sortable-table>
                  }

                  @if (auditSectionTab === auditTabFields) {
                    <h3 class="h5 mb-2">Site values</h3>
                    <p class="text-muted mb-3">
                      Runtime, application, people and console fields for every site.
                      Pick a third-party system to compare API keys and related config across environments.
                    </p>
                    <div class="row g-2 mb-3 align-items-end">
                      <div class="col-md-3">
                        <app-vendor-system-select
                          id="filter-system"
                          name="filterSystem"
                          label="System"
                          [items]="inventorySystemFilterItems"
                          [value]="filterSystem"
                          (valueChange)="setInventorySystemFilter($event)"/>
                      </div>
                      <div class="col-md-2">
                        <label class="form-label" for="filter-env">Environment</label>
                        <select id="filter-env"
                                class="form-select"
                                [(ngModel)]="filterEnvironment"
                                (ngModelChange)="onSiteFiltersChange()"
                                name="filterEnvironment">
                          <option value="">All</option>
                          @for (site of inventory.sites; track site.environment) {
                            <option [value]="site.environment">{{ site.environment }}</option>
                          }
                        </select>
                      </div>
                      <div class="col-md-2">
                        <label class="form-label" for="filter-layer">Layer</label>
                        <select id="filter-layer"
                                class="form-select"
                                [(ngModel)]="filterLayer"
                                (ngModelChange)="onSiteFiltersChange()"
                                name="filterLayer">
                          <option value="">All</option>
                          <option [value]="runtimeLayer">runtime</option>
                          <option [value]="applicationLayer">application</option>
                          <option [value]="peopleLayer">people</option>
                          <option [value]="consoleLayer">console</option>
                        </select>
                      </div>
                      <div class="col-md-2">
                        <label class="form-label" for="filter-configured">Configured</label>
                        <select id="filter-configured"
                                class="form-select"
                                [(ngModel)]="filterConfigured"
                                (ngModelChange)="onSiteFiltersChange()"
                                name="filterConfigured">
                          <option value="">All</option>
                          <option [value]="presentStatus">present</option>
                          <option [value]="emptyStatus">empty</option>
                          <option [value]="errorStatus">error</option>
                        </select>
                      </div>
                      <div class="col-md-2">
                        <label class="form-label" for="filter-search">Search</label>
                        <input id="filter-search"
                               type="search"
                               class="form-control"
                               [(ngModel)]="filterSearch"
                               (ngModelChange)="onSiteFiltersChange()"
                               name="filterSearch"
                               placeholder="Field, category, value…">
                      </div>
                      <div class="col-md-1 d-flex align-items-end">
                        <span class="era-count-pill">{{ filteredSiteCapture().length }}</span>
                      </div>
                    </div>
                    <app-sortable-table
                      [columns]="fieldsColumns"
                      [rows]="filteredSiteCapture()"
                      [defaultSortKey]="auditSortKey"
                      [defaultSortDirection]="auditSortDirection"
                      (sortChange)="onAuditSortChange($event)"
                      [trackBy]="trackField"
                      [maxHeight]="'60vh'"
                      emptyMessage="No site configuration rows match the filters.">
                      <ng-template appSortableTableCell="configured" let-row>
                        <span class="era-badge" [ngClass]="configuredBadgeClass(row.configured)">{{ row.configured }}</span>
                      </ng-template>
                      <ng-template appSortableTableCell="safeValue" let-row>
                        <code>{{ row.safeValue }}</code>
                      </ng-template>
                      <ng-template appSortableTableCell="whereHeld" let-row>
                        <code>{{ row.whereHeld }}</code>
                      </ng-template>
                    </app-sortable-table>
                  }

                  @if (auditSectionTab === auditTabPlatform) {
                    <h3 class="h5 mb-2">Platform values</h3>
                    <p class="text-muted mb-3">
                      Shared staging config and platform system logins (GitHub, Docker Hub, worker, Cloudflare, AI).
                    </p>
                    <app-sortable-table
                      [columns]="platformColumns"
                      [rows]="inventory.platformCapture"
                      [defaultSortKey]="auditSortKey"
                      [defaultSortDirection]="auditSortDirection"
                      (sortChange)="onAuditSortChange($event)"
                      [trackBy]="trackPlatform"
                      [maxHeight]="'60vh'"
                      emptyMessage="No platform configuration rows.">
                      <ng-template appSortableTableCell="fieldId" let-row>
                        <code>{{ row.fieldId }}</code>
                      </ng-template>
                      <ng-template appSortableTableCell="configured" let-row>
                        <span class="era-badge" [ngClass]="configuredBadgeClass(row.configured)">{{ row.configured }}</span>
                      </ng-template>
                      <ng-template appSortableTableCell="safeValue" let-row>
                        <code>{{ row.safeValue }}</code>
                      </ng-template>
                      <ng-template appSortableTableCell="whereHeld" let-row>
                        <code>{{ row.whereHeld }}</code>
                      </ng-template>
                    </app-sortable-table>
                  }
                }
            </div>
          </div>
          }

          @if (pageMode === pageModeSystemLogins) {
          <div class="row thumbnail-heading-frame">
            <div class="thumbnail-heading">System Logins</div>
            <div class="col-sm-12">
                <p class="mb-2">
                  Human logins for third-party vendor websites (Atlas, Fly, Brevo, AWS, and so on).
                  These are <strong>not</strong> the runtime API keys used by the app.
                </p>
                <p class="text-muted mb-3">
                  Stored per environment under <code>config.environments[].consoleAccess</code>.
                  GitHub and Docker Hub are platform-shared.
                </p>
                <div class="row g-2 mb-3 align-items-end">
                  <div class="col-md-4">
                    <label class="form-label" for="console-scope">Environment</label>
                    <select id="console-scope"
                            class="form-select"
                            [(ngModel)]="consoleScope"
                            (ngModelChange)="onConsoleScopeChange($event)"
                            [disabled]="consoleBusy"
                            name="consoleScope">
                      <option [value]="consoleScopeAll">All environments</option>
                      @for (env of consoleEnvironments; track env.environment) {
                        <option [value]="env.environment">
                          {{ env.environment }}{{ env.hasConsoleAccess ? " · saved" : "" }}
                        </option>
                      }
                      <option [value]="platformScope">Platform shared</option>
                    </select>
                  </div>
                  <div class="col-md-4">
                    <app-vendor-system-select
                      id="console-system-filter"
                      name="consoleServiceFilter"
                      label="System"
                      [items]="consoleSystemFilterItems"
                      [value]="consoleServiceFilter"
                      (valueChange)="setConsoleServiceFilter($event)"/>
                  </div>
                  <div class="col-md-4 d-flex align-items-end gap-2 flex-wrap">
                    <div class="form-check mb-1">
                      <input class="form-check-input"
                             type="checkbox"
                             id="console-filled-only"
                             [(ngModel)]="consoleFilledOnly"
                             (ngModelChange)="onConsoleFilledOnlyChange()"
                             name="consoleFilledOnly">
                      <label class="form-check-label" for="console-filled-only">Filled only</label>
                    </div>
                    <button type="button"
                            class="btn btn-primary"
                            [disabled]="consoleBusy || !consoleScope"
                            (click)="saveConsoleAccess()">
                      <fa-icon [icon]="faSave" class="me-1"></fa-icon>
                      {{ consoleBusy ? "Saving…" : "Save" }}
                    </button>
                    <button type="button"
                            class="btn btn-quiet"
                            [disabled]="consoleBusy || !consoleScope"
                            (click)="copyAllForScope()"
                            [tooltip]="copiedScopeKey === consoleScope ? 'Copied' : 'Copy visible'"
                            container="body">
                      <fa-icon [icon]="copiedScopeKey === consoleScope ? faCheck : faCopy"></fa-icon>
                    </button>
                  </div>
                </div>

              @if (hoistedSharedGroups().length) {
                  <div class="console-shared-panel mb-3">
                    <div class="console-shared-panel-title">
                      Shared across all environments
                      <span class="console-shared-badge">Shared</span>
                    </div>
                    <p class="console-shared-panel-hint mb-2">
                      Parent account and console login values are not missing from each site row - each is stored once
                      here and applies to every environment below.
                    </p>
                    <div class="console-shared-panel-groups">
                      @for (group of hoistedSharedGroups(); track group.serviceId) {
                        <div class="console-shared-panel-group">
                          @if (showSharedGroupHeading()) {
                            <div class="console-shared-panel-group-heading">
                              <app-vendor-brand-mark [serviceId]="group.serviceId" [inline]="true"/>
                              <strong>{{ group.serviceName }}</strong>
                            </div>
                          }
                          <div class="console-shared-panel-fields"
                               [class.console-shared-panel-fields-wide]="group.sharedCredentials || group.identifiers.length > 1">
                            @for (identifier of group.identifiers; track identifier.key) {
                              <label class="console-field">
                                <span class="form-label">
                                  {{ identifier.label }}
                                  <span class="console-shared-badge">Once for all sites</span>
                                </span>
                                <input type="text"
                                       class="form-control"
                                       [class.console-shared-empty]="identifierIsSharedEmpty(platformScope, group.serviceId, identifier)"
                                       [class.console-shared-filled]="!identifierIsSharedEmpty(platformScope, group.serviceId, identifier)"
                                       [placeholder]="identifierPlaceholder(platformScope, group.serviceId, identifier)"
                                       [ngModel]="identifierValue(platformScope, group.serviceId, identifier.key)"
                                       (ngModelChange)="setIdentifier(platformScope, group.serviceId, identifier.key, $event)"
                                       [name]="'id-shared-' + group.serviceId + '-' + identifier.key"
                                       autocomplete="off">
                                <span class="console-shared-hint"
                                      [class.console-shared-hint-empty]="identifierIsSharedEmpty(platformScope, group.serviceId, identifier)">
                                  {{ identifierSharedHint(platformScope, group.serviceId, identifier) }}
                                </span>
                              </label>
                            }
                            @if (group.sharedCredentials) {
                              <label class="console-field">
                                <span class="form-label">
                                  Username
                                  <span class="console-shared-badge">Once for all sites</span>
                                </span>
                                <input type="text"
                                       class="form-control"
                                       [class.console-shared-filled]="!!loginFieldValue(platformScope, group.serviceId, loginField)"
                                       [ngModel]="loginFieldValue(platformScope, group.serviceId, loginField)"
                                       (ngModelChange)="setLoginField(platformScope, group.serviceId, loginField, $event)"
                                       [name]="'login-shared-' + group.serviceId"
                                       autocomplete="off">
                              </label>
                              <label class="console-field console-shared-panel-password">
                                <span class="form-label">
                                  Password
                                  <span class="console-shared-badge">Once for all sites</span>
                                </span>
                                <app-secret-input
                                  [id]="'password-shared-' + group.serviceId"
                                  [ngModel]="loginFieldValue(platformScope, group.serviceId, passwordField)"
                                  (ngModelChange)="setLoginField(platformScope, group.serviceId, passwordField, $event)"
                                  [name]="'password-shared-' + group.serviceId">
                                </app-secret-input>
                              </label>
                              <label class="console-field console-shared-panel-notes">
                                <span class="form-label">
                                  Notes
                                  <span class="console-shared-badge">Once for all sites</span>
                                </span>
                                <input type="text"
                                       class="form-control"
                                       [class.console-shared-filled]="!!loginFieldValue(platformScope, group.serviceId, notesField)"
                                       [ngModel]="loginFieldValue(platformScope, group.serviceId, notesField)"
                                       (ngModelChange)="setLoginField(platformScope, group.serviceId, notesField, $event)"
                                       [name]="'notes-shared-' + group.serviceId"
                                       autocomplete="off">
                                <span class="console-shared-hint">
                                  Same parent console login for every site - not missing; stored once as platform shared
                                </span>
                              </label>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (layoutWidth === layoutWidthWide) {
                  <div class="console-access-table"
                       [class.console-access-table-no-system]="!consoleSystemColumnVisible()"
                       [class.console-access-table-shared-hoisted]="hoistedSharedGroups().length > 0"
                       [class.console-access-table-no-credentials]="hideCredentialColumns()">
                    <app-sortable-table
                      [columns]="consoleTableColumns()"
                      [rows]="consoleTableRows()"
                      [defaultSortKey]="consoleSortKey"
                      [defaultSortDirection]="consoleSortDirection"
                      (sortChange)="onConsoleSortChange($event)"
                      [trackBy]="trackConsoleRow"
                      [maxHeight]="'70vh'"
                      emptyMessage="No system login rows match the filters.">
                      <ng-template appSortableTableCell="environmentLabel" let-row>
                        <span class="console-table-env">{{ row.environmentLabel }}</span>
                      </ng-template>
                      <ng-template appSortableTableCell="system" let-row>
                        <span class="console-table-system">
                          <app-vendor-brand-mark [serviceId]="row.serviceId" [inline]="true"/>
                          <strong>{{ row.serviceName }}</strong>
                        </span>
                      </ng-template>
                      <ng-template appSortableTableCell="identifiers" let-row>
                        <div class="console-table-ids">
                          @for (identifier of rowSiteIdentifiers(row); track identifier.key) {
                            <label class="console-table-id-row"
                                   [class.console-table-id-shared]="identifier.shared">
                              <span class="console-table-id-label">
                                {{ identifier.label }}
                                @if (identifier.shared) {
                                  <span class="console-shared-badge">Shared</span>
                                }
                              </span>
                              <input type="text"
                                     class="form-control"
                                     [class.console-shared-empty]="identifierIsSharedEmpty(row.scope, row.serviceId, identifier)"
                                     [placeholder]="identifierPlaceholder(row.scope, row.serviceId, identifier)"
                                     [ngModel]="identifierValue(row.scope, row.serviceId, identifier.key)"
                                     (ngModelChange)="setIdentifier(row.scope, row.serviceId, identifier.key, $event)"
                                     [name]="'id-wide-' + row.rowId + '-' + identifier.key"
                                     autocomplete="off">
                              @if (identifier.shared) {
                                <span class="console-shared-hint">
                                  {{ identifierSharedHint(row.scope, row.serviceId, identifier) }}
                                </span>
                              }
                            </label>
                          }
                          @if (!rowSiteIdentifiers(row).length) {
                            <span class="text-muted">—</span>
                          }
                        </div>
                      </ng-template>
                      <ng-template appSortableTableCell="login" let-row>
                        @if (credentialsHoistedForRow(row)) {
                          <span class="console-shared-cell-note">
                            <span class="console-shared-badge">Shared</span>
                            above
                          </span>
                        } @else {
                          <input type="text"
                                 class="form-control"
                                 [ngModel]="loginFieldValue(row.scope, row.serviceId, loginField)"
                                 (ngModelChange)="setLoginField(row.scope, row.serviceId, loginField, $event)"
                                 [name]="'login-wide-' + row.rowId"
                                 autocomplete="off">
                        }
                      </ng-template>
                      <ng-template appSortableTableCell="password" let-row>
                        @if (credentialsHoistedForRow(row)) {
                          <span class="console-shared-cell-note">
                            <span class="console-shared-badge">Shared</span>
                            above
                          </span>
                        } @else {
                          <app-secret-input
                            [id]="'password-wide-' + row.rowId"
                            [ngModel]="loginFieldValue(row.scope, row.serviceId, passwordField)"
                            (ngModelChange)="setLoginField(row.scope, row.serviceId, passwordField, $event)"
                            [name]="'password-wide-' + row.rowId">
                          </app-secret-input>
                        }
                      </ng-template>
                      <ng-template appSortableTableCell="notes" let-row>
                        @if (credentialsHoistedForRow(row)) {
                          <span class="console-shared-cell-note">
                            <span class="console-shared-badge">Shared</span>
                            above
                          </span>
                        } @else {
                          <input type="text"
                                 class="form-control"
                                 [ngModel]="loginFieldValue(row.scope, row.serviceId, notesField)"
                                 (ngModelChange)="setLoginField(row.scope, row.serviceId, notesField, $event)"
                                 [name]="'notes-wide-' + row.rowId"
                                 autocomplete="off">
                        }
                      </ng-template>
                      <ng-template appSortableTableCell="links" let-row>
                        <div class="console-table-links">
                          @for (link of resolvedUrlsFor(row); track link.url) {
                            <a [href]="link.url"
                               target="_blank"
                               rel="noopener noreferrer"
                               class="console-table-link"
                               [tooltip]="link.label"
                               container="body">
                              <fa-icon [icon]="linkIcon(link)"></fa-icon>
                              <span class="console-table-link-text">{{ link.label }}</span>
                            </a>
                          }
                          @if (!resolvedUrlsFor(row).length) {
                            <span class="text-muted">—</span>
                          }
                        </div>
                      </ng-template>
                      <ng-template appSortableTableCell="actions" let-row>
                        <button type="button"
                                class="btn btn-quiet btn-sm console-copy-btn"
                                (click)="copyAllForRow(row)"
                                [tooltip]="copiedServiceId === row.rowId ? 'Copied' : 'Copy'"
                                container="body">
                          <fa-icon [icon]="copiedServiceId === row.rowId ? faCheck : faCopy" size="xs"></fa-icon>
                        </button>
                      </ng-template>
                    </app-sortable-table>
                  </div>
                } @else {
                  <div class="console-access-cards">
                    @if (consoleTableRows().length === 0) {
                      <p class="text-muted mb-0">No system login rows match the filters.</p>
                    }
                    @for (row of consoleTableRows(); track row.rowId) {
                      <div class="row thumbnail-heading-frame console-card-frame">
                        <div class="thumbnail-heading with-vendor-logo console-card-heading">
                          <app-vendor-brand-mark [serviceId]="row.serviceId" [sizePx]="22"/>
                          <span>{{ row.serviceName }}</span>
                          <span class="console-card-env">{{ row.environmentLabel }}</span>
                          <span class="console-card-heading-actions">
                            @for (link of resolvedUrlsFor(row); track link.url) {
                              <a [href]="link.url"
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 class="btn btn-quiet btn-sm console-copy-btn"
                                 [tooltip]="link.label"
                                 container="body">
                                <fa-icon [icon]="linkIcon(link)" size="xs"></fa-icon>
                              </a>
                            }
                            <button type="button"
                                    class="btn btn-quiet btn-sm console-copy-btn"
                                    (click)="copyAllForRow(row)"
                                    [tooltip]="copiedServiceId === row.rowId ? 'Copied credentials' : 'Copy credentials'"
                                    container="body">
                              <fa-icon [icon]="copiedServiceId === row.rowId ? faCheck : faCopy" size="xs"></fa-icon>
                            </button>
                          </span>
                        </div>
                        <div class="col-sm-12">
                          @if (rowSiteIdentifiers(row).length) {
                            <div class="console-card-ids">
                              @for (identifier of rowSiteIdentifiers(row); track identifier.key) {
                                <label class="console-field"
                                       [class.console-table-id-shared]="identifier.shared">
                                  <span class="form-label">
                                    {{ identifier.label }}
                                    @if (identifier.shared) {
                                      <span class="console-shared-badge">Shared</span>
                                    }
                                  </span>
                                  <input type="text"
                                         class="form-control"
                                         [class.console-shared-empty]="identifierIsSharedEmpty(row.scope, row.serviceId, identifier)"
                                         [placeholder]="identifierPlaceholder(row.scope, row.serviceId, identifier)"
                                         [ngModel]="identifierValue(row.scope, row.serviceId, identifier.key)"
                                         (ngModelChange)="setIdentifier(row.scope, row.serviceId, identifier.key, $event)"
                                         [name]="'id-card-' + row.rowId + '-' + identifier.key"
                                         autocomplete="off">
                                  @if (identifier.shared) {
                                    <span class="console-shared-hint">
                                      {{ identifierSharedHint(row.scope, row.serviceId, identifier) }}
                                    </span>
                                  }
                                </label>
                              }
                            </div>
                          }
                          @if (!credentialsHoistedForRow(row)) {
                            <div class="console-card-credentials">
                              <label class="console-field">
                                <span class="form-label">Username</span>
                                <input type="text"
                                       class="form-control"
                                       [ngModel]="loginFieldValue(row.scope, row.serviceId, loginField)"
                                       (ngModelChange)="setLoginField(row.scope, row.serviceId, loginField, $event)"
                                       [name]="'login-card-' + row.rowId"
                                       autocomplete="off">
                              </label>
                              <label class="console-field">
                                <span class="form-label">Password</span>
                                <app-secret-input
                                  [id]="'password-card-' + row.rowId"
                                  [ngModel]="loginFieldValue(row.scope, row.serviceId, passwordField)"
                                  (ngModelChange)="setLoginField(row.scope, row.serviceId, passwordField, $event)"
                                  [name]="'password-card-' + row.rowId">
                                </app-secret-input>
                              </label>
                            </div>
                            <label class="console-field">
                              <span class="form-label">Notes</span>
                              <input type="text"
                                     class="form-control"
                                     [ngModel]="loginFieldValue(row.scope, row.serviceId, notesField)"
                                     (ngModelChange)="setLoginField(row.scope, row.serviceId, notesField, $event)"
                                     [name]="'notes-card-' + row.rowId"
                                     autocomplete="off">
                            </label>
                          } @else {
                            <p class="console-card-shared-credentials-note mb-0">
                              <span class="console-shared-badge">Shared</span>
                              Username, password and notes are edited once above.
                            </p>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
            </div>
          </div>
          }

          @if (pageMode === pageModeOfflineExport) {
          <div class="row thumbnail-heading-frame">
            <div class="thumbnail-heading">Offline export</div>
            <div class="col-sm-12">
                <p class="mb-2">
                  Download an offline pack (Excel, Markdown, HTML) you can keep outside the admin UI.
                </p>
                <p class="text-muted">
                  Prefer the live Configuration inventory and System Logins screens day to day.
                  HTML is a snapshot if the admin UI is unavailable.
                </p>
                <div class="d-flex flex-wrap gap-2 mb-3 align-items-center">
                  <div class="btn-group" dropdown [isDisabled]="busy">
                    <button type="button"
                            class="btn btn-primary dropdown-toggle text-nowrap"
                            dropdownToggle
                            [disabled]="busy">
                      <fa-icon [icon]="faDownload" class="me-1"></fa-icon>
                      {{ busy ? "Busy…" : "Download pack" }}
                    </button>
                    <ul *dropdownMenu class="dropdown-menu" role="menu">
                      <li role="menuitem">
                        <button class="dropdown-item" type="button" (click)="downloadChoice(allChoice)">All formats</button>
                      </li>
                      <li role="menuitem">
                        <button class="dropdown-item" type="button" (click)="downloadChoice(xlsxChoice)">Excel</button>
                      </li>
                      <li role="menuitem">
                        <button class="dropdown-item" type="button" (click)="downloadChoice(markdownChoice)">Markdown</button>
                      </li>
                      <li role="menuitem">
                        <button class="dropdown-item" type="button" (click)="downloadChoice(htmlChoice)">HTML (offline)</button>
                      </li>
                    </ul>
                  </div>
                  <div class="form-check mb-0">
                    <input class="form-check-input"
                           type="checkbox"
                           id="include-secrets"
                           [(ngModel)]="includeSecrets"
                           [disabled]="busy"
                           name="includeSecrets">
                    <label class="form-check-label text-nowrap" for="include-secrets">
                      Include secrets in pack
                    </label>
                  </div>
                </div>
                <div class="alert alert-warning d-flex align-items-start mb-0" role="alert">
                  <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"></fa-icon>
                  <div>
                    <strong class="d-block">Keep pack files private</strong>
                    @if (includeSecrets) {
                      Downloads write live credentials. Store only in a password manager. Do not commit or email.
                    } @else {
                      Secrets will be presence-only (SET or empty). Tick Include secrets in pack for full configuration values.
                    }
                  </div>
                </div>
            </div>
          </div>
          }
        </div>
      </div>
    </app-page>
  `,
  styleUrls: ["./estate-rebuild-capture.component.sass", "../admin/admin.component.sass"],
  imports: [
    PageComponent,
    LoginRequiredComponent,
    FontAwesomeModule,
    FormsModule,
    NgClass,
    SecretInputComponent,
    TooltipDirective,
    BsDropdownDirective,
    BsDropdownToggleDirective,
    BsDropdownMenuDirective,
    SectionToggle,
    SortableTableComponent,
    SortableTableCellDirective,
    VendorBrandMarkComponent,
    VendorSystemSelectComponent
  ]
})
export class EstateRebuildCaptureComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("EstateRebuildCaptureComponent", NgxLoggerLevel.ERROR);
  private environmentSetupService = inject(EnvironmentSetupService);
  private notifierService = inject(NotifierService);
  private clipboardService = inject(ClipboardService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private document = inject(DOCUMENT);
  private subscriptions: Subscription[] = [];

  summary: EstateRebuildCaptureSummary = null;
  inventory: EstateRebuildInventory = null;
  inventoryBusy = false;
  inventoryIncludeSecrets = false;
  layoutWidth = LayoutWidth.NORMAL;
  widthTabs: SectionToggleTab[] = [
    {value: LayoutWidth.NORMAL, label: "Normal"},
    {value: LayoutWidth.WIDE, label: "Wide"}
  ];
  pageMode = PageMode.INVENTORY;
  pageModeTabs: SectionToggleTab[] = [
    {value: PageMode.INVENTORY, label: "Configuration inventory"},
    {value: PageMode.SYSTEM_LOGINS, label: "System Logins"},
    {value: PageMode.OFFLINE_EXPORT, label: "Offline export"}
  ];
  filterEnvironment = "";
  filterSystem = "all";
  filterLayer = "";
  filterConfigured = "";
  filterSearch = "";
  busy = false;
  busyFormat: string = null;
  includeSecrets = true;
  consoleBusy = false;
  consoleScope = CONSOLE_SCOPE_ALL;
  consoleServiceFilter = "all";
  consoleFilledOnly = false;
  consoleEnvironments: ConsoleAccessEnvironmentListItem[] = [];
  consoleServices: ConsoleAccessServiceInfo[] = [];
  consoleSystemFilterItems: VendorSystemSelectItem[] = [{value: "all", label: "All systems"}];
  inventorySystemFilterItems: VendorSystemSelectItem[] = [{value: "all", label: "All systems"}];
  consoleAccessByScope: Record<string, Record<string, ConsoleAccessLoginView>> = {};
  copiedServiceId: string = null;
  copiedScopeKey: string = null;
  auditSortKey = AUDIT_SECTION_DEFAULT_SORT[AuditSectionTab.SYSTEMS];
  auditSortDirection = ASCENDING;
  consoleSortKey = "environmentLabel";
  consoleSortDirection = ASCENDING;
  private readonly queryTrue = "true";
  notifyTarget: AlertTarget = {};
  notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  auditSectionTab = AuditSectionTab.SYSTEMS;
  auditSectionTabs: SectionToggleTab[] = [
    {value: AuditSectionTab.SYSTEMS, label: "Third-party systems"},
    {value: AuditSectionTab.SITES, label: "Sites directory"},
    {value: AuditSectionTab.FIELDS, label: "Site values"},
    {value: AuditSectionTab.PLATFORM, label: "Platform values"}
  ];

  systemsColumns: SortableTableColumn[] = [
    {key: "icon", label: "", cellClass: "system-icon-col", headerClass: "system-icon-col"},
    {key: "name", label: "System", sortKey: "name"},
    {key: "function", label: "Function", sortKey: "function"},
    {key: "informationHeld", label: "Information held", sortKey: "informationHeld"},
    {key: "configPaths", label: "Config paths", sortKey: "configPaths"},
    {key: "scope", label: "Scope", sortKey: "scope", cellGetter: row => row.scope},
    {key: "actions", label: "", cellClass: "console-col-actions", headerClass: "console-col-actions"}
  ];

  sitesColumns: SortableTableColumn[] = [
    {key: "environment", label: "Environment", sortKey: "environment"},
    {key: "group", label: "Group", sortKey: "group", cellGetter: row => row.group},
    {key: "groupCode", label: "Code", sortKey: "groupCode"},
    {key: "siteHref", label: "Public URL", sortKey: "siteHref"},
    {key: "chairman", label: "Chairman", sortKey: "chairmanName"},
    {key: "webmaster", label: "Webmaster", sortKey: "webmasterName"},
    {key: "flyAppName", label: "Fly app", sortKey: "flyAppName"},
    {key: "mongo", label: "Mongo", sortKey: "mongoCluster"},
    {key: "awsBucket", label: "AWS bucket", sortKey: "awsBucket"},
    {key: "probeStatus", label: "Probe", sortKey: "probeStatus"}
  ];

  fieldsColumns: SortableTableColumn[] = [
    {key: "environment", label: "Environment", sortKey: "environment", cellGetter: row => row.environment},
    {key: "layer", label: "Layer", sortKey: "layer", cellGetter: row => row.layer},
    {key: "category", label: "Category", sortKey: "category", cellGetter: row => row.category},
    {key: "field", label: "Field", sortKey: "field", cellGetter: row => row.field},
    {key: "configured", label: "Configured", sortKey: "configured"},
    {key: "safeValue", label: "Value", sortKey: "safeValue"},
    {key: "whereHeld", label: "Where", sortKey: "whereHeld"}
  ];

  platformColumns: SortableTableColumn[] = [
    {key: "category", label: "Category", sortKey: "category", cellGetter: row => row.category},
    {key: "fieldId", label: "Field ID", sortKey: "fieldId"},
    {key: "field", label: "Field", sortKey: "field", cellGetter: row => row.field},
    {key: "configured", label: "Configured", sortKey: "configured"},
    {key: "safeValue", label: "Value", sortKey: "safeValue"},
    {key: "whereHeld", label: "Where", sortKey: "whereHeld"}
  ];

  private readonly consoleColumnsAll: SortableTableColumn[] = [
    {key: "environmentLabel", label: "Environment", sortKey: "environmentLabel", cellClass: "console-col-env", headerClass: "console-col-env"},
    {key: "system", label: "System", sortKey: "serviceName", cellClass: "console-col-system", headerClass: "console-col-system"},
    {key: "identifiers", label: "Identifiers", cellClass: "console-col-ids", headerClass: "console-col-ids"},
    {key: "login", label: "Username", cellClass: "console-col-login", headerClass: "console-col-login"},
    {key: "password", label: "Password", cellClass: "console-col-password", headerClass: "console-col-password"},
    {key: "notes", label: "Notes", cellClass: "console-col-notes", headerClass: "console-col-notes"},
    {key: "links", label: "Links", cellClass: "console-col-links", headerClass: "console-col-links"},
    {key: "actions", label: "", cellClass: "console-col-actions", headerClass: "console-col-actions"}
  ];

  trackSystem = (_index: number, row: {systemId: string}) => row.systemId;
  trackSite = (_index: number, row: {environment: string}) => row.environment;
  trackField = (_index: number, row: {environment: string; fieldId: string}) => `${row.environment}-${row.fieldId}`;
  trackPlatform = (_index: number, row: {fieldId: string}) => row.fieldId;
  trackConsoleRow = (_index: number, row: ConsoleAccessTableRow) => row.rowId;

  protected readonly platformScope = PLATFORM_SCOPE;
  protected readonly consoleScopeAll = CONSOLE_SCOPE_ALL;
  protected readonly layoutWidthWide = LayoutWidth.WIDE;
  protected readonly pageModeInventory = PageMode.INVENTORY;
  protected readonly pageModeSystemLogins = PageMode.SYSTEM_LOGINS;
  protected readonly pageModeOfflineExport = PageMode.OFFLINE_EXPORT;
  protected readonly auditTabSystems = AuditSectionTab.SYSTEMS;
  protected readonly auditTabSites = AuditSectionTab.SITES;
  protected readonly auditTabFields = AuditSectionTab.FIELDS;
  protected readonly auditTabPlatform = AuditSectionTab.PLATFORM;
  protected readonly faDownload = faDownload;
  protected readonly faRotate = faRotate;
  protected readonly faSave = faSave;
  protected readonly faCopy = faCopy;
  protected readonly faCheck = faCheck;
  protected readonly faExternalLinkAlt = faExternalLinkAlt;
  protected readonly faTableList = faTableList;
  protected readonly faCircleCheck = faCircleCheck;
  private readonly consoleLinkIcons: Record<ConsoleAccessUrlIconKey, IconDefinition> = {
    [ConsoleAccessUrlIconKey.OVERVIEW]: faFolderOpen,
    [ConsoleAccessUrlIconKey.NETWORK]: faShieldHalved,
    [ConsoleAccessUrlIconKey.USERS]: faUserLock,
    [ConsoleAccessUrlIconKey.DASHBOARD]: faDesktop,
    [ConsoleAccessUrlIconKey.METRICS]: faChartLine,
    [ConsoleAccessUrlIconKey.SECRETS]: faKey,
    [ConsoleAccessUrlIconKey.ORGANISATION]: faBuilding,
    [ConsoleAccessUrlIconKey.CONSOLE]: faDesktop,
    [ConsoleAccessUrlIconKey.BUCKET]: faBoxArchive,
    [ConsoleAccessUrlIconKey.ACCOUNT]: faUser,
    [ConsoleAccessUrlIconKey.ZONE]: faGlobe,
    [ConsoleAccessUrlIconKey.DNS]: faServer,
    [ConsoleAccessUrlIconKey.APIS]: faPlug,
    [ConsoleAccessUrlIconKey.CREDENTIALS]: faIdCard,
    [ConsoleAccessUrlIconKey.BUSINESS]: faBriefcase,
    [ConsoleAccessUrlIconKey.REPOSITORIES]: faBoxArchive,
    [ConsoleAccessUrlIconKey.ACTIONS]: faPlay,
    [ConsoleAccessUrlIconKey.HOME]: faHouse
  };
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly allChoice = EstateRebuildDownloadChoice.ALL;
  protected readonly xlsxChoice = EstateRebuildDownloadChoice.XLSX;
  protected readonly markdownChoice = EstateRebuildDownloadChoice.MARKDOWN;
  protected readonly htmlChoice = EstateRebuildDownloadChoice.HTML;
  protected readonly loginField = ConsoleAccessCredentialField.LOGIN;
  protected readonly passwordField = ConsoleAccessCredentialField.PASSWORD;
  protected readonly notesField = ConsoleAccessCredentialField.NOTES;
  protected readonly runtimeLayer = EstateRebuildFieldLayer.RUNTIME;
  protected readonly applicationLayer = EstateRebuildFieldLayer.APPLICATION;
  protected readonly peopleLayer = EstateRebuildFieldLayer.PEOPLE;
  protected readonly consoleLayer = EstateRebuildFieldLayer.CONSOLE;
  protected readonly presentStatus = EstateRebuildConfigured.PRESENT;
  protected readonly emptyStatus = EstateRebuildConfigured.EMPTY;
  protected readonly errorStatus = EstateRebuildConfigured.ERROR;

  async ngOnInit(): Promise<void> {
    this.applyQueryParams(this.route.snapshot.queryParamMap);
    this.applyLayoutWidth(this.layoutWidth);
    await this.refreshSummary();
    await this.loadConsoleEnvironments();
    this.consoleScope = this.resolveConsoleScope(this.consoleScope);
    await this.loadConsoleAccess(this.consoleScope);
    this.writePageStateToUrl();
    this.subscriptions.push(this.route.queryParamMap.subscribe(params => {
      const previousScope = this.consoleScope;
      this.applyQueryParams(params);
      if (this.layoutWidth) {
        this.applyLayoutWidth(this.layoutWidth);
      }
      if (this.consoleScope !== previousScope) {
        void this.loadConsoleAccess(this.consoleScope);
      }
    }));
    void this.loadInventory();
  }

  ngOnDestroy(): void {
    this.applyLayoutWidth(LayoutWidth.NORMAL);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onLayoutWidthChange(width: string): void {
    this.layoutWidth = width === LayoutWidth.WIDE ? LayoutWidth.WIDE : LayoutWidth.NORMAL;
    this.applyLayoutWidth(this.layoutWidth);
    this.writePageStateToUrl();
  }

  onPageModeChange(mode: string): void {
    this.pageMode = this.resolvePageMode(mode);
    this.writePageStateToUrl();
  }

  onAuditSectionChange(section: string): void {
    this.auditSectionTab = this.resolveAuditSection(section);
    this.auditSortKey = this.resolveAuditSortKey(this.auditSortKey, this.auditSectionTab);
    this.writePageStateToUrl();
  }

  onAuditSortChange(state: SortableTableSortState): void {
    this.auditSortKey = state.key || AUDIT_SECTION_DEFAULT_SORT[this.auditSectionTab];
    this.auditSortDirection = state.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.writePageStateToUrl();
  }

  onConsoleSortChange(state: SortableTableSortState): void {
    this.consoleSortKey = state.key || "environmentLabel";
    this.consoleSortDirection = state.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.writePageStateToUrl();
  }

  onSiteFiltersChange(): void {
    this.writePageStateToUrl();
  }

  onConsoleFilledOnlyChange(): void {
    this.writePageStateToUrl();
  }

  onInventoryIncludeSecretsChange(): void {
    this.writePageStateToUrl();
    if (this.inventory) {
      void this.loadInventory();
    }
  }

  private applyQueryParams(params: {get: (key: string) => string | null}): void {
    this.layoutWidth = this.resolveLayoutWidth(params.get(StoredValue.LAYOUT_WIDTH));
    this.pageMode = this.resolvePageMode(params.get(StoredValue.TAB));
    this.consoleScope = this.resolveConsoleScope(params.get(StoredValue.ENVIRONMENT));
    this.auditSectionTab = this.resolveAuditSection(params.get(StoredValue.SECTION));
    this.auditSortKey = this.resolveAuditSortKey(params.get(StoredValue.SORT), this.auditSectionTab);
    this.auditSortDirection = this.resolveSortDirection(params.get(StoredValue.SORT_ORDER));
    this.consoleSortKey = this.resolveConsoleSortKey(params.get(StoredValue.CONSOLE_SORT));
    this.consoleSortDirection = this.resolveSortDirection(params.get(StoredValue.CONSOLE_SORT_ORDER));
    this.consoleServiceFilter = this.resolveConsoleServiceFilter(params.get(StoredValue.SYSTEM));
    this.filterSystem = this.resolveInventorySystemFilter(params.get(StoredValue.SYSTEM));
    this.consoleFilledOnly = this.resolveBooleanParam(params.get(StoredValue.FILLED_ONLY));
    this.filterEnvironment = params.get(StoredValue.FILTER) || "";
    this.filterLayer = params.get(StoredValue.LAYER) || "";
    this.filterConfigured = params.get(StoredValue.CONFIGURED) || "";
    this.filterSearch = params.get(StoredValue.SEARCH) || "";
    this.inventoryIncludeSecrets = this.resolveBooleanParam(params.get(StoredValue.INCLUDE_SECRETS));
  }

  private resolveLayoutWidth(candidate: string | null): LayoutWidth {
    if (candidate === LayoutWidth.WIDE) {
      return LayoutWidth.WIDE;
    } else {
      return LayoutWidth.NORMAL;
    }
  }

  private resolvePageMode(candidate: string | null): PageMode {
    if (candidate === PageMode.SYSTEM_LOGINS) {
      return PageMode.SYSTEM_LOGINS;
    } else if (candidate === PageMode.OFFLINE_EXPORT || candidate === "emergency-export") {
      return PageMode.OFFLINE_EXPORT;
    } else {
      return PageMode.INVENTORY;
    }
  }

  private resolveAuditSection(candidate: string | null): AuditSectionTab {
    if (candidate === AuditSectionTab.SITES) {
      return AuditSectionTab.SITES;
    } else if (candidate === AuditSectionTab.FIELDS) {
      return AuditSectionTab.FIELDS;
    } else if (candidate === AuditSectionTab.PLATFORM) {
      return AuditSectionTab.PLATFORM;
    } else {
      return AuditSectionTab.SYSTEMS;
    }
  }

  private auditSortKeysFor(section: AuditSectionTab): string[] {
    if (section === AuditSectionTab.SYSTEMS) {
      return this.systemsColumns.map(column => column.sortKey).filter((key): key is string => !!key);
    } else if (section === AuditSectionTab.SITES) {
      return this.sitesColumns.map(column => column.sortKey).filter((key): key is string => !!key);
    } else if (section === AuditSectionTab.FIELDS) {
      return this.fieldsColumns.map(column => column.sortKey).filter((key): key is string => !!key);
    } else {
      return this.platformColumns.map(column => column.sortKey).filter((key): key is string => !!key);
    }
  }

  private resolveIdentifierFromQuery(candidate: string | null, allowed: string[], fallback: string): string {
    if (!candidate) {
      return fallback;
    } else if (allowed.includes(candidate)) {
      return candidate;
    } else {
      const kebabCandidate = toKebabCase(candidate);
      const matched = allowed.find(key => toKebabCase(key) === kebabCandidate);
      if (matched) {
        return matched;
      } else {
        return fallback;
      }
    }
  }

  private resolveAuditSortKey(candidate: string | null, section: AuditSectionTab): string {
    return this.resolveIdentifierFromQuery(
      candidate,
      this.auditSortKeysFor(section),
      AUDIT_SECTION_DEFAULT_SORT[section]
    );
  }

  private resolveConsoleSortKey(candidate: string | null): string {
    const allowed = this.consoleColumnsAll.map(column => column.sortKey).filter((key): key is string => !!key);
    return this.resolveIdentifierFromQuery(candidate, allowed, "environmentLabel");
  }

  private resolveConsoleServiceFilter(candidate: string | null): string {
    if (!candidate || candidate === "all") {
      return "all";
    } else {
      const serviceIds = this.consoleServices.map(service => service.serviceId);
      if (serviceIds.length === 0) {
        return this.fromKebabCase(candidate);
      } else {
        return this.resolveIdentifierFromQuery(candidate, serviceIds, "all");
      }
    }
  }

  private fromKebabCase(value: string): string {
    return value.replace(/-([a-z0-9])/g, (_match, character: string) => character.toUpperCase());
  }

  private resolveBooleanParam(candidate: string | null): boolean {
    return candidate === this.queryTrue || candidate === "1";
  }

  private resolveSortDirection(candidate: string | null): string {
    if (candidate === SORT_ORDER_DESC || candidate === DESCENDING || candidate === "descending") {
      return DESCENDING;
    } else {
      return ASCENDING;
    }
  }

  private sortDirectionParam(direction: string): string {
    if (direction === DESCENDING) {
      return SORT_ORDER_DESC;
    } else {
      return SORT_ORDER_ASC;
    }
  }

  private queryIdentifier(value: string): string {
    return toKebabCase(value);
  }

  private applyLayoutWidth(width: LayoutWidth): void {
    if (width === LayoutWidth.WIDE) {
      this.document.body.classList.add(FULL_WIDTH_BODY_CLASS);
    } else {
      this.document.body.classList.remove(FULL_WIDTH_BODY_CLASS);
    }
  }

  async loadInventory(): Promise<void> {
    this.inventoryBusy = true;
    this.notify.hide();
    try {
      this.inventory = await this.environmentSetupService.estateRebuildInventory(this.inventoryIncludeSecrets);
      this.summary = {
        generatedAtUtc: this.inventory.generatedAtUtc,
        siteCount: this.inventory.siteCount,
        fieldsPerSite: this.inventory.fieldsPerSite,
        siteCaptureRows: this.inventory.siteCaptureRows,
        platformFieldCount: this.inventory.platformFieldCount,
        formats: this.summary?.formats || [
          EstateRebuildCaptureFormat.XLSX,
          EstateRebuildCaptureFormat.MARKDOWN,
          EstateRebuildCaptureFormat.HTML
        ]
      };
      this.refreshInventorySystemFilterItems();
    } catch (error) {
      this.logger.error("Failed to load platform configuration inventory:", error);
      this.notify.error({
        title: "Could not load configuration audit",
        message: error instanceof Error ? error.message : "Inventory failed - check platform admin and Mongo.",
        continue: true
      });
    } finally {
      this.inventoryBusy = false;
    }
  }

  private refreshInventorySystemFilterItems(): void {
    const systems = (this.inventory?.thirdPartySystems || []).map(system => ({
      value: system.systemId,
      label: system.name,
      systemId: system.systemId,
      brandKey: system.systemId
    }));
    this.inventorySystemFilterItems = [{value: "all", label: "All systems"}, ...systems];
    this.filterSystem = this.resolveInventorySystemFilter(this.filterSystem === "all" ? null : this.filterSystem);
  }

  setInventorySystemFilter(systemId: string): void {
    const next = systemId || "all";
    if (next !== this.filterSystem) {
      this.filterSystem = next;
      this.writePageStateToUrl();
    }
  }

  openSiteValuesForSystem(systemId: string): void {
    this.auditSectionTab = AuditSectionTab.FIELDS;
    this.filterSystem = systemId || "all";
    this.auditSortKey = AUDIT_SECTION_DEFAULT_SORT[AuditSectionTab.FIELDS];
    this.writePageStateToUrl();
  }

  private siteCaptureMatchesSystem(row: EstateRebuildSiteCaptureRow, systemId: string): boolean {
    if (!systemId || systemId === "all") {
      return true;
    } else if (row.systemId) {
      return row.systemId === systemId;
    } else {
      const haystack = [row.fieldId, row.category, row.field, row.whereHeld].join(" ").toLowerCase();
      return haystack.includes(systemId.toLowerCase())
        || (systemId === "awsS3" && (haystack.includes("aws") || haystack.includes("s3")))
        || (systemId === "metaFacebookInstagram" && (haystack.includes("facebook") || haystack.includes("instagram") || haystack.includes("meta")))
        || (systemId === "walksManager" && (haystack.includes("walks manager") || haystack.includes("wmapi") || haystack.includes("wm")));
    }
  }

  filteredSiteCapture(): EstateRebuildSiteCaptureRow[] {
    if (!this.inventory) {
      return [];
    } else {
      const search = (this.filterSearch || "").trim().toLowerCase();
      return this.inventory.siteCapture.filter(row => {
        const envOk = !this.filterEnvironment || row.environment === this.filterEnvironment;
        const systemOk = this.siteCaptureMatchesSystem(row, this.filterSystem);
        const layerOk = !this.filterLayer || row.layer === this.filterLayer;
        const configuredOk = !this.filterConfigured || row.configured === this.filterConfigured;
        const searchOk = !search
          || [row.environment, row.group, row.layer, row.category, row.field, row.fieldId, row.safeValue, row.whereHeld]
            .join(" ")
            .toLowerCase()
            .includes(search);
        return envOk && systemOk && layerOk && configuredOk && searchOk;
      });
    }
  }

  presentCount(): number {
    if (!this.inventory) {
      return 0;
    } else {
      return this.inventory.siteCapture.filter(row => row.configured === EstateRebuildConfigured.PRESENT).length;
    }
  }

  emptyCount(): number {
    if (!this.inventory) {
      return 0;
    } else {
      return this.inventory.siteCapture.filter(row => row.configured === EstateRebuildConfigured.EMPTY).length;
    }
  }

  contactsCount(): number {
    if (!this.inventory) {
      return 0;
    } else {
      return this.inventory.sites.filter(site => !!(site.chairmanEmail || site.webmasterEmail)).length;
    }
  }

  configuredBadgeClass(configured: string): string {
    if (configured === EstateRebuildConfigured.PRESENT) {
      return "present";
    } else if (configured === EstateRebuildConfigured.ERROR) {
      return "error";
    } else {
      return "empty";
    }
  }

  private resolveConsoleScope(candidate: string | null): string {
    if (candidate === CONSOLE_SCOPE_ALL || candidate === "all") {
      return CONSOLE_SCOPE_ALL;
    } else if (candidate === PLATFORM_SCOPE) {
      return PLATFORM_SCOPE;
    } else if (candidate && this.consoleEnvironments.some(env => env.environment === candidate)) {
      return candidate;
    } else {
      return CONSOLE_SCOPE_ALL;
    }
  }

  private resolveInventorySystemFilter(candidate: string | null): string {
    if (!candidate || candidate === "all") {
      return "all";
    } else {
      const kebabCandidate = toKebabCase(candidate);
      const systems = this.inventory?.thirdPartySystems || [];
      const matched = systems.find(system =>
        system.systemId === candidate
        || toKebabCase(system.systemId) === kebabCandidate
        || toKebabCase(system.name) === kebabCandidate
      );
      if (matched) {
        return matched.systemId;
      } else if (candidate === "aws" || kebabCandidate === "aws" || kebabCandidate === "s3") {
        return "awsS3";
      } else if (candidate === "meta" || kebabCandidate === "meta") {
        return "metaFacebookInstagram";
      } else {
        return candidate;
      }
    }
  }

  private systemQueryParam(): string | null {
    if (this.pageMode === PageMode.SYSTEM_LOGINS) {
      if (this.consoleServiceFilter === "all" || !this.consoleServiceFilter) {
        return null;
      } else {
        return this.queryIdentifier(this.consoleServiceFilter);
      }
    } else if (this.pageMode === PageMode.INVENTORY) {
      if (this.filterSystem === "all" || !this.filterSystem) {
        return null;
      } else {
        return this.queryIdentifier(this.filterSystem);
      }
    } else {
      return null;
    }
  }

  private writePageStateToUrl(): void {
    const queryParams = {
      [StoredValue.TAB]: this.pageMode,
      [StoredValue.ENVIRONMENT]: this.consoleScope,
      [StoredValue.LAYOUT_WIDTH]: this.layoutWidth,
      [StoredValue.SECTION]: this.auditSectionTab,
      [StoredValue.SORT]: this.queryIdentifier(this.auditSortKey),
      [StoredValue.SORT_ORDER]: this.sortDirectionParam(this.auditSortDirection),
      [StoredValue.CONSOLE_SORT]: this.queryIdentifier(this.consoleSortKey),
      [StoredValue.CONSOLE_SORT_ORDER]: this.sortDirectionParam(this.consoleSortDirection),
      [StoredValue.SYSTEM]: this.systemQueryParam(),
      [StoredValue.FILLED_ONLY]: this.consoleFilledOnly ? this.queryTrue : null,
      [StoredValue.FILTER]: this.filterEnvironment || null,
      [StoredValue.LAYER]: this.filterLayer || null,
      [StoredValue.CONFIGURED]: this.filterConfigured || null,
      [StoredValue.SEARCH]: this.filterSearch || null,
      [StoredValue.INCLUDE_SECRETS]: this.inventoryIncludeSecrets ? this.queryTrue : null
    } as const satisfies Partial<Record<StoredValue, string | null>>;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {...queryParams},
      queryParamsHandling: "merge",
      replaceUrl: true
    });
  }

  private servicesForScope(scope: string): ConsoleAccessServiceInfo[] {
    if (scope === PLATFORM_SCOPE) {
      return this.consoleServices.filter(service =>
        service.scope === "platform" || service.scope === "per-site-and-platform"
      );
    } else {
      return this.consoleServices.filter(service =>
        service.scope === "per-site" || service.scope === "per-site-and-platform"
      );
    }
  }

  private scopesToShow(): string[] {
    if (this.consoleScope === CONSOLE_SCOPE_ALL) {
      return [
        ...this.consoleEnvironments.map(env => env.environment),
        PLATFORM_SCOPE
      ];
    } else {
      return [this.consoleScope];
    }
  }

  consoleServiceFilterOptions(): ConsoleAccessServiceInfo[] {
    if (this.consoleScope === CONSOLE_SCOPE_ALL) {
      return this.consoleServices;
    } else {
      return this.servicesForScope(this.consoleScope);
    }
  }

  private refreshConsoleSystemFilterItems(): void {
    const services = this.consoleServiceFilterOptions().map(service => ({
      value: service.serviceId,
      label: this.serviceFilterLabel(service.name),
      brandKey: service.serviceId
    }));
    this.consoleSystemFilterItems = [{value: "all", label: "All systems"}, ...services];
    if (!this.consoleSystemFilterItems.some(item => item.value === this.consoleServiceFilter)) {
      this.consoleServiceFilter = "all";
    }
  }

  consoleSystemColumnVisible(): boolean {
    return this.consoleServiceFilter === "all" || !this.consoleServiceFilter;
  }

  serviceHasSharedCredentials(serviceId: string): boolean {
    return !!(this.consoleServices.find(service => service.serviceId === serviceId)?.sharedCredentials);
  }

  shouldHoistSharedValues(): boolean {
    return this.consoleScope === CONSOLE_SCOPE_ALL;
  }

  credentialsHoistedForRow(row: ConsoleAccessTableRow): boolean {
    return this.shouldHoistSharedValues() && this.serviceHasSharedCredentials(row.serviceId);
  }

  hideCredentialColumns(): boolean {
    return this.shouldHoistSharedValues()
      && !this.consoleSystemColumnVisible()
      && this.serviceHasSharedCredentials(this.consoleServiceFilter);
  }

  consoleTableColumns(): SortableTableColumn[] {
    const withoutSystem = this.consoleSystemColumnVisible()
      ? this.consoleColumnsAll
      : this.consoleColumnsAll.filter(column => column.key !== "system");
    if (this.hideCredentialColumns()) {
      return withoutSystem.filter(column =>
        column.key !== "login" && column.key !== "password" && column.key !== "notes"
      );
    } else {
      return withoutSystem;
    }
  }

  showSharedGroupHeading(): boolean {
    return this.consoleSystemColumnVisible();
  }

  private filteredConsoleServices(): ConsoleAccessServiceInfo[] {
    return this.consoleServiceFilterOptions().filter(service => {
      if (this.consoleServiceFilter === "all" || !this.consoleServiceFilter) {
        return true;
      } else {
        return service.serviceId === this.consoleServiceFilter;
      }
    });
  }

  hoistedSharedGroups(): ConsoleSharedIdentifierGroup[] {
    if (!this.shouldHoistSharedValues()) {
      return [];
    } else {
      return this.filteredConsoleServices()
        .map(service => ({
          serviceId: service.serviceId,
          serviceName: this.serviceFilterLabel(service.name),
          identifiers: (service.identifiers || []).filter(item => item.shared),
          sharedCredentials: !!service.sharedCredentials
        }))
        .filter(group => group.identifiers.length > 0 || group.sharedCredentials);
    }
  }

  rowSiteIdentifiers(row: ConsoleAccessTableRow): ConsoleAccessIdentifierInfo[] {
    const identifiers = row.identifiers || [];
    if (this.shouldHoistSharedValues()) {
      return identifiers.filter(item => !item.shared);
    } else {
      return identifiers;
    }
  }

  consoleTableRows(): ConsoleAccessTableRow[] {
    const rows = this.scopesToShow().reduce((acc: ConsoleAccessTableRow[], scope) => {
      const environmentLabel = scope === PLATFORM_SCOPE ? "Platform shared" : scope;
      const services = this.servicesForScope(scope).filter(service => {
        if (this.consoleServiceFilter === "all" || !this.consoleServiceFilter) {
          return true;
        } else {
          return service.serviceId === this.consoleServiceFilter;
        }
      });
      const scopeRows = services.map(service => ({
        rowId: `${scope}::${service.serviceId}`,
        scope,
        environmentLabel,
        serviceId: service.serviceId,
        serviceName: this.serviceFilterLabel(service.name),
        serviceScope: service.scope,
        function: service.function,
        identifiers: service.identifiers || [],
        urls: service.urls || []
      }));
      return acc.concat(scopeRows);
    }, []);
    if (!this.consoleFilledOnly) {
      return rows;
    } else {
      return rows.filter(row => this.rowHasContent(row));
    }
  }

  private rowHasContent(row: ConsoleAccessTableRow): boolean {
    const hasLogin = !!this.loginFieldValue(row.scope, row.serviceId, ConsoleAccessCredentialField.LOGIN);
    const hasPassword = !!this.loginFieldValue(row.scope, row.serviceId, ConsoleAccessCredentialField.PASSWORD);
    const hasNotes = !!this.loginFieldValue(row.scope, row.serviceId, ConsoleAccessCredentialField.NOTES);
    const hasIdentifiers = (row.identifiers || []).some(item =>
      !!(this.identifierValue(row.scope, row.serviceId, item.key) || "").trim()
    );
    return !!(hasLogin || hasPassword || hasNotes || hasIdentifiers);
  }

  setConsoleServiceFilter(serviceId: string): void {
    this.consoleServiceFilter = serviceId || "all";
    this.copiedServiceId = null;
    this.writePageStateToUrl();
  }

  serviceFilterLabel(name: string): string {
    if (name.startsWith("Meta")) {
      return "Meta";
    } else if (name.startsWith("Meetup")) {
      return "Meetup";
    } else if (name.startsWith("OS Data Hub")) {
      return "OS Data Hub";
    } else if (name.startsWith("Google Cloud")) {
      return "Google Cloud";
    } else if (name.startsWith("Docker Hub")) {
      return "Docker Hub";
    } else if (name.startsWith("MongoDB Atlas")) {
      return "MongoDB Atlas";
    } else if (name.startsWith("Fly.io")) {
      return "Fly.io";
    } else if (name.startsWith("AWS") || name.startsWith("S3")) {
      return "S3";
    } else {
      return name
        .replace(/\s+website$/i, "")
        .replace(/\s+console$/i, "")
        .replace(/\s+developer\s*\/\s*Business.*$/i, "")
        .replace(/\s+OAuth\s*\/\s*account.*$/i, "")
        .trim();
    }
  }

  loginFor(scope: string, serviceId: string): ConsoleAccessLoginView {
    if (!this.consoleAccessByScope[scope]) {
      this.consoleAccessByScope[scope] = {};
    }
    if (!this.consoleAccessByScope[scope][serviceId]) {
      this.consoleAccessByScope[scope][serviceId] = {};
    }
    return this.consoleAccessByScope[scope][serviceId];
  }

  private credentialTargetScope(scope: string, serviceId: string): string {
    if (this.serviceHasSharedCredentials(serviceId)) {
      return PLATFORM_SCOPE;
    } else {
      return scope;
    }
  }

  loginFieldValue(scope: string, serviceId: string, field: ConsoleAccessCredentialField): string {
    if (this.serviceHasSharedCredentials(serviceId)) {
      const platformValue = (this.loginFor(PLATFORM_SCOPE, serviceId)[field] || "").trim();
      if (platformValue) {
        return this.loginFor(PLATFORM_SCOPE, serviceId)[field] || "";
      } else {
        const siteValue = (this.loginFor(scope, serviceId)[field] || "").trim();
        if (siteValue) {
          return this.loginFor(scope, serviceId)[field] || "";
        } else {
          return this.firstSiteLoginField(serviceId, field);
        }
      }
    } else {
      return this.loginFor(scope, serviceId)[field] || "";
    }
  }

  setLoginField(scope: string, serviceId: string, field: ConsoleAccessCredentialField, value: string): void {
    const targetScope = this.credentialTargetScope(scope, serviceId);
    const current = this.loginFor(targetScope, serviceId);
    this.consoleAccessByScope = {
      ...this.consoleAccessByScope,
      [targetScope]: {
        ...this.consoleAccessByScope[targetScope],
        [serviceId]: {...current, [field]: value}
      }
    };
  }

  private firstSiteLoginField(serviceId: string, field: ConsoleAccessCredentialField): string {
    return this.consoleEnvironments
      .map(env => (this.loginFor(env.environment, serviceId)[field] || "").trim())
      .find(value => !!value) || "";
  }

  private firstSiteIdentifier(serviceId: string, key: string): string {
    return this.consoleEnvironments
      .map(env => (this.loginFor(env.environment, serviceId).identifiers?.[key] || "").trim())
      .find(value => !!value) || "";
  }

  private promoteSharedValuesFromSites(): void {
    this.consoleServices.forEach(service => {
      (service.identifiers || []).filter(item => item.shared).forEach(item => {
        if (!(this.platformIdentifierValue(service.serviceId, item.key) || "").trim()) {
          const fromSite = this.firstSiteIdentifier(service.serviceId, item.key);
          if (fromSite) {
            this.setIdentifier(PLATFORM_SCOPE, service.serviceId, item.key, fromSite);
          }
        }
      });
      if (service.sharedCredentials) {
        const credentialFields = [
          ConsoleAccessCredentialField.LOGIN,
          ConsoleAccessCredentialField.PASSWORD,
          ConsoleAccessCredentialField.NOTES
        ];
        credentialFields.forEach(field => {
          if (!(this.loginFor(PLATFORM_SCOPE, service.serviceId)[field] || "").trim()) {
            const fromSite = this.firstSiteLoginField(service.serviceId, field);
            if (fromSite) {
              this.setLoginField(PLATFORM_SCOPE, service.serviceId, field, fromSite);
            }
          }
        });
      }
    });
  }

  private identifierDefinition(serviceId: string, key: string): ConsoleAccessIdentifierInfo | null {
    const service = this.consoleServices.find(item => item.serviceId === serviceId);
    return (service?.identifiers || []).find(item => item.key === key) || null;
  }

  private localIdentifierValue(scope: string, serviceId: string, key: string): string {
    return this.loginFor(scope, serviceId).identifiers?.[key] || "";
  }

  private platformIdentifierValue(serviceId: string, key: string): string {
    return this.loginFor(PLATFORM_SCOPE, serviceId).identifiers?.[key] || "";
  }

  identifierValue(scope: string, serviceId: string, key: string): string {
    const local = this.localIdentifierValue(scope, serviceId, key);
    if (local) {
      return local;
    } else {
      const definition = this.identifierDefinition(serviceId, key);
      if (definition?.shared) {
        const platformValue = this.platformIdentifierValue(serviceId, key);
        if (platformValue) {
          return platformValue;
        } else {
          return this.firstSiteIdentifier(serviceId, key);
        }
      } else {
        return "";
      }
    }
  }

  identifierIsSharedEmpty(scope: string, serviceId: string, identifier: ConsoleAccessIdentifierInfo): boolean {
    return !!(identifier.shared && !this.identifierValue(scope, serviceId, identifier.key));
  }

  identifierPlaceholder(scope: string, serviceId: string, identifier: ConsoleAccessIdentifierInfo): string {
    if (this.identifierIsSharedEmpty(scope, serviceId, identifier)) {
      return identifier.placeholder || "Enter once for all sites";
    } else {
      return identifier.placeholder || "";
    }
  }

  identifierSharedHint(scope: string, serviceId: string, identifier: ConsoleAccessIdentifierInfo): string {
    const effective = this.identifierValue(scope, serviceId, identifier.key);
    const local = this.localIdentifierValue(scope, serviceId, identifier.key);
    const sharedDefault = identifier.sharedHint
      || "Same parent account for every site - not missing; stored once as platform shared";
    if (scope !== PLATFORM_SCOPE && local) {
      return "Site override of the shared parent value";
    } else if (!effective && scope === PLATFORM_SCOPE) {
      return `${sharedDefault}. Enter it once here.`;
    } else if (!effective) {
      return `${sharedDefault}. Enter it under Platform shared.`;
    } else {
      return sharedDefault;
    }
  }

  setIdentifier(scope: string, serviceId: string, key: string, value: string): void {
    const definition = this.identifierDefinition(serviceId, key);
    const targetScope = definition?.shared ? PLATFORM_SCOPE : scope;
    const current = this.loginFor(targetScope, serviceId);
    const identifiers = {...(current.identifiers || {}), [key]: value};
    this.consoleAccessByScope = {
      ...this.consoleAccessByScope,
      [targetScope]: {
        ...this.consoleAccessByScope[targetScope],
        [serviceId]: {...current, identifiers}
      }
    };
  }

  private effectiveIdentifiers(scope: string, serviceId: string, identifiers: ConsoleAccessIdentifierInfo[]): Record<string, string> {
    return (identifiers || []).reduce((acc, identifier) => {
      const value = this.identifierValue(scope, serviceId, identifier.key);
      if (value) {
        acc[identifier.key] = value;
      }
      return acc;
    }, {} as Record<string, string>);
  }

  resolvedUrlsFor(row: ConsoleAccessTableRow): ConsoleAccessResolvedUrlInfo[] {
    const identifiers = this.effectiveIdentifiers(row.scope, row.serviceId, row.identifiers || []);
    return (row.urls || []).reduce((acc: ConsoleAccessResolvedUrlInfo[], template) => {
      const placeholders: string[] = template.urlTemplate.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
      const missing = placeholders.some(token => {
        const key = token.slice(1, -1);
        return !identifiers[key];
      });
      if (!(missing && placeholders.length > 0)) {
        const url = placeholders.reduce((current: string, token: string) => {
          const key = token.slice(1, -1);
          return current.split(token).join(encodeURIComponent(identifiers[key]));
        }, template.urlTemplate);
        acc.push({
          label: template.label,
          url,
          iconKey: template.iconKey || null
        });
      }
      return acc;
    }, []);
  }

  linkIcon(link: ConsoleAccessResolvedUrlInfo): IconDefinition {
    if (link.iconKey && this.consoleLinkIcons[link.iconKey]) {
      return this.consoleLinkIcons[link.iconKey];
    } else {
      return faExternalLinkAlt;
    }
  }

  copyAllForRow(row: ConsoleAccessTableRow): void {
    const text = this.formatRowCredentials(row);
    this.clipboardService.copyToClipboard(text);
    this.copiedServiceId = row.rowId;
    this.copiedScopeKey = null;
    window.setTimeout(() => {
      if (this.copiedServiceId === row.rowId) {
        this.copiedServiceId = null;
      }
    }, 2000);
  }

  copyAllForScope(): void {
    const blocks = this.consoleTableRows()
      .map(row => {
        const block = this.formatRowCredentials(row);
        if (!block) {
          return "";
        } else {
          return `Environment: ${row.environmentLabel}\n${block}`;
        }
      })
      .filter(block => block.length > 0);
    const text = blocks.join("\n\n");
    this.clipboardService.copyToClipboard(text);
    this.copiedScopeKey = this.consoleScope;
    this.copiedServiceId = null;
    window.setTimeout(() => {
      if (this.copiedScopeKey === this.consoleScope) {
        this.copiedScopeKey = null;
      }
    }, 2000);
  }

  private formatRowCredentials(row: ConsoleAccessTableRow): string {
    const username = this.loginFieldValue(row.scope, row.serviceId, ConsoleAccessCredentialField.LOGIN);
    const password = this.loginFieldValue(row.scope, row.serviceId, ConsoleAccessCredentialField.PASSWORD);
    const notes = this.loginFieldValue(row.scope, row.serviceId, ConsoleAccessCredentialField.NOTES);
    const identifierLines = (row.identifiers || []).map(identifier =>
      `${identifier.label}: ${this.identifierValue(row.scope, row.serviceId, identifier.key)}`
    );
    const linkLines = this.resolvedUrlsFor(row).map(link => `${link.label}: ${link.url}`);
    if (!username && !password && !notes && identifierLines.every(line => line.endsWith(": "))) {
      return "";
    } else {
      return [
        row.serviceName,
        ...identifierLines,
        `Username: ${username}`,
        `Password: ${password}`,
        `Notes: ${notes}`,
        ...linkLines
      ].join("\n");
    }
  }

  async onConsoleScopeChange(scope: string): Promise<void> {
    this.copiedServiceId = null;
    this.copiedScopeKey = null;
    this.consoleServiceFilter = "all";
    this.consoleScope = scope;
    this.refreshConsoleSystemFilterItems();
    this.writePageStateToUrl();
    await this.loadConsoleAccess(scope);
  }

  async refreshSummary(): Promise<void> {
    this.busy = true;
    this.busyFormat = "summary";
    this.notify.hide();
    try {
      this.summary = await this.environmentSetupService.estateRebuildCaptureSummary();
    } catch (error) {
      this.logger.error("Failed to load platform configuration summary:", error);
      this.notify.error({
        title: "Could not probe environments",
        message: error instanceof Error ? error.message : "Generation failed - check that platform admin is enabled and Mongo is reachable.",
        continue: true
      });
    } finally {
      this.busy = false;
      this.busyFormat = null;
    }
  }

  async loadConsoleEnvironments(): Promise<void> {
    try {
      const response = await this.environmentSetupService.consoleAccessEnvironments();
      this.consoleEnvironments = response.environments || [];
    } catch (error) {
      this.logger.error("Failed to list console-access environments:", error);
    }
  }

  async loadConsoleAccess(scope: string): Promise<void> {
    this.consoleBusy = true;
    try {
      const scopes = scope === CONSOLE_SCOPE_ALL
        ? [...this.consoleEnvironments.map(env => env.environment), PLATFORM_SCOPE]
        : scope === PLATFORM_SCOPE
          ? [PLATFORM_SCOPE]
          : [scope, PLATFORM_SCOPE];
      const documents = await Promise.all(
        scopes.map(item => this.environmentSetupService.consoleAccess(item))
      );
      const byScope: Record<string, Record<string, ConsoleAccessLoginView>> = {
        ...this.consoleAccessByScope
      };
      documents.forEach(document => {
        byScope[document.scope] = {...(document.consoleAccess || {})};
        if ((document.services || []).length > 0) {
          this.consoleServices = document.services;
        }
      });
      this.consoleAccessByScope = byScope;
      this.consoleScope = scope;
      this.promoteSharedValuesFromSites();
      this.refreshConsoleSystemFilterItems();
    } catch (error) {
      this.logger.error("Failed to load system logins:", error);
      this.notify.error({
        title: "Could not load system logins",
        message: error instanceof Error ? error.message : "Load failed",
        continue: true
      });
    } finally {
      this.consoleBusy = false;
    }
  }

  private cleanedAccessForScope(scope: string): Record<string, ConsoleAccessLoginView> {
    const cleaned: Record<string, ConsoleAccessLoginView> = {};
    const services = scope === PLATFORM_SCOPE
      ? this.consoleServices
      : this.servicesForScope(scope);
    services.forEach(service => {
      const entry = this.loginFor(scope, service.serviceId);
      const identifiers = entry.identifiers || {};
      const allowedIdentifiers = scope === PLATFORM_SCOPE && service.scope === "per-site"
        ? (service.identifiers || []).filter(item => item.shared)
        : scope !== PLATFORM_SCOPE
          ? (service.identifiers || []).filter(item => !item.shared)
          : (service.identifiers || []);
      const cleanedIdentifiers: Record<string, string> = {};
      allowedIdentifiers.forEach(item => {
        const value = (identifiers[item.key] || "").trim();
        if (value) {
          cleanedIdentifiers[item.key] = value;
        }
      });
      const hasIdentifiers = keys(cleanedIdentifiers).length > 0;
      const sharedCredentials = !!service.sharedCredentials;
      const includeCredentials = scope === PLATFORM_SCOPE
        ? service.scope !== "per-site" || sharedCredentials
        : !sharedCredentials;
      if (includeCredentials && (entry.login || entry.password || entry.notes || hasIdentifiers)) {
        cleaned[service.serviceId] = {
          login: entry.login || "",
          password: entry.password || "",
          notes: entry.notes || "",
          identifiers: cleanedIdentifiers
        };
      } else if (!includeCredentials && hasIdentifiers) {
        cleaned[service.serviceId] = {
          identifiers: cleanedIdentifiers
        };
      }
    });
    return cleaned;
  }

  async saveConsoleAccess(): Promise<void> {
    this.consoleBusy = true;
    this.notify.hide();
    try {
      this.promoteSharedValuesFromSites();
      const scopes = [...new Set([...this.scopesToShow(), PLATFORM_SCOPE])];
      const documents = await Promise.all(
        scopes.map(scope =>
          this.environmentSetupService.saveConsoleAccess(scope, this.cleanedAccessForScope(scope))
        )
      );
      const byScope = {...this.consoleAccessByScope};
      documents.forEach(document => {
        byScope[document.scope] = {...(document.consoleAccess || {})};
      });
      this.consoleAccessByScope = byScope;
      await this.loadConsoleEnvironments();
      this.notify.success({
        title: "System logins saved",
        message: this.consoleScope === CONSOLE_SCOPE_ALL
          ? `System logins updated for ${scopes.length} scopes.`
          : this.consoleScope === PLATFORM_SCOPE
            ? "Platform system logins updated on staging config.environments."
            : `System logins updated for ${this.consoleScope}.`
      });
    } catch (error) {
      this.logger.error("Failed to save system logins:", error);
      this.notify.error({
        title: "Could not save system logins",
        message: error instanceof Error ? error.message : "Save failed",
        continue: true
      });
    } finally {
      this.consoleBusy = false;
    }
  }

  async downloadChoice(choice: EstateRebuildDownloadChoice): Promise<void> {
    if (choice === EstateRebuildDownloadChoice.ALL) {
      await this.downloadAll();
    } else if (choice === EstateRebuildDownloadChoice.XLSX) {
      await this.downloadOne(EstateRebuildCaptureFormat.XLSX);
    } else if (choice === EstateRebuildDownloadChoice.MARKDOWN) {
      await this.downloadOne(EstateRebuildCaptureFormat.MARKDOWN);
    } else {
      await this.downloadOne(EstateRebuildCaptureFormat.HTML);
    }
  }

  private async downloadAll(): Promise<void> {
    this.busy = true;
    this.busyFormat = "all";
    this.notify.hide();
    try {
      const formats = [
        EstateRebuildCaptureFormat.XLSX,
        EstateRebuildCaptureFormat.MARKDOWN,
        EstateRebuildCaptureFormat.HTML
      ];
      for (const format of formats) {
        const blob = await this.environmentSetupService.downloadEstateRebuildCapture(format, this.includeSecrets);
        this.triggerDownload(blob, this.fileNameFor(format));
      }
      this.notify.success({
        title: "Download ready",
        message: this.includeSecrets
          ? "Excel, Markdown and HTML with live secret values. Store only in a password manager."
          : "Excel, Markdown and HTML generated without secret values (SET or empty)."
      });
    } catch (error) {
      this.logger.error("Failed to download platform configuration pack:", error);
      this.notify.error({
        title: "Generation failed",
        message: error instanceof Error ? error.message : "Could not generate the pack.",
        continue: true
      });
    } finally {
      this.busy = false;
      this.busyFormat = null;
    }
  }

  private async downloadOne(format: EstateRebuildCaptureFormat): Promise<void> {
    this.busy = true;
    this.busyFormat = format;
    this.notify.hide();
    try {
      const blob = await this.environmentSetupService.downloadEstateRebuildCapture(format, this.includeSecrets);
      this.triggerDownload(blob, this.fileNameFor(format));
      this.notify.success({
        title: "Download ready",
        message: this.includeSecrets
          ? `${this.fileNameFor(format)} includes live secret values. Store only in a password manager.`
          : `${this.fileNameFor(format)} generated without secret values (SET or empty).`
      });
    } catch (error) {
      this.logger.error("Failed to download platform configuration values:", error);
      this.notify.error({
        title: "Generation failed",
        message: error instanceof Error ? error.message : "Could not generate the pack.",
        continue: true
      });
    } finally {
      this.busy = false;
      this.busyFormat = null;
    }
  }

  private fileNameFor(format: EstateRebuildCaptureFormat): string {
    const suffix = this.includeSecrets ? "-with-secrets" : "";
    if (format === EstateRebuildCaptureFormat.MARKDOWN) {
      return `platform-configuration-values${suffix}.md`;
    } else if (format === EstateRebuildCaptureFormat.HTML) {
      return `platform-configuration-values${suffix}.html`;
    } else {
      return `platform-configuration-values${suffix}.xlsx`;
    }
  }

  private triggerDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement("a");
    link.href = url;
    link.download = fileName;
    this.document.body.appendChild(link);
    link.click();
    this.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
