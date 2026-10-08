import { Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faExternalLinkAlt, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import {
  AtlasAwsRegion,
  AtlasClusterCreateRequest,
  AtlasClusterEnvironmentRow,
  AtlasClusterRow,
  AtlasClusterState,
  AtlasClusterTier,
  AtlasClusterView
} from "../../../models/atlas-cluster.model";
import { AdminPlatformPath } from "../../../models/admin-route-paths.model";
import { EnvironmentSetupTab } from "../../../models/environment-setup.model";
import { EnvironmentSettingsSubTab } from "../../../models/system.model";
import { StoredValue } from "../../../models/ui-actions";
import { toKebabCase } from "../../../functions/strings";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { SortableTableAlignment, SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { SortableTableCellDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { VendorBrandMarkComponent } from "../../../modules/common/vendor-brand-mark/vendor-brand-mark.component";
import { PageComponent } from "../../../page/page.component";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";

enum AtlasClusterSortField {
  NAME = "name",
  HOST = "host",
  SIZE = "instanceSize",
  ENVIRONMENTS = "environmentCount",
  COLLECTIONS = "collectionCount"
}

enum AtlasEnvironmentSortField {
  ENVIRONMENT = "environment",
  CLUSTER = "cluster",
  DATABASE = "database",
  COLLECTIONS = "collections"
}

@Component({
  selector: "app-environment-atlas",
  imports: [
    FormsModule,
    FontAwesomeModule,
    RouterLink,
    PageComponent,
    SortableTableComponent,
    SortableTableCellDirective,
    VendorBrandMarkComponent
  ],
  template: `
    <app-page autoTitle pageTitle="MongoDB Atlas">
      @if (notifyTarget.showAlert && notifyTarget.alert) {
        <div class="alert {{ notifyTarget.alert.class }} d-flex align-items-start">
          <fa-icon [icon]="notifyTarget.alert.icon" class="me-2 mt-1"/>
          <div>
            @if (notifyTarget.alertTitle) {
              <strong>{{ notifyTarget.alertTitle }}</strong>
              <div>{{ notifyTarget.alertMessage }}</div>
            } @else {
              {{ notifyTarget.alertMessage }}
            }
          </div>
        </div>
      }
      @if (loading) {
        <div class="alert alert-warning d-flex align-items-start">
          <fa-icon [icon]="faSpinner" class="me-2 mt-1" animation="spin"/>
          <div>
            <strong>Loading clusters</strong>
            <div>Counting collections on each environment so we can see which clusters are full.</div>
          </div>
        </div>
      }
      @if (errorMessage) {
        <div class="alert alert-danger d-flex align-items-start">
          <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
          <div>
            <strong>Could not load Atlas</strong>
            <div>{{ errorMessage }}</div>
          </div>
        </div>
      }
      @if (view?.registrationBlocked) {
        <div class="alert alert-warning d-flex align-items-start">
          <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
          <div>
            <strong>New group registration will fail</strong>
            <div>{{ view.registrationBlockReason }} New sites currently go to <code>{{ view.registrationCluster }}</code>. Create a cluster below and set it as the default.</div>
          </div>
        </div>
      }
      <div class="row thumbnail-heading-frame mb-4">
        <div class="thumbnail-heading with-vendor-logo d-flex align-items-center gap-2">
          <app-vendor-brand-mark serviceId="mongodbAtlas" [sizePx]="26"/>
          <span>Provisioning home</span>
        </div>
        <p class="mb-3">This is the Atlas project new sites are born in. It is separate from the content template. Existing group rows stay on their current clusters until you move them with Environment Migration.</p>
        <div class="row">
          <div class="col-md-6 mb-2">
            <label class="form-label" for="atlas-project-id">Project ID</label>
            <input id="atlas-project-id" class="form-control" name="atlasProjectId" [(ngModel)]="projectId" autocomplete="off"
                   placeholder="24-character id from Atlas Project Settings">
          </div>
          <div class="col-md-6 mb-2">
            <label class="form-label" for="atlas-default-cluster">Default cluster for new sites</label>
            <input id="atlas-default-cluster" class="form-control" name="atlasDefaultCluster" [(ngModel)]="defaultCluster" autocomplete="off"
                   placeholder="host prefix without .mongodb.net">
          </div>
        </div>
        <div class="d-flex flex-wrap gap-2 mt-2">
          <button type="button" class="btn btn-primary" [disabled]="saving" (click)="saveProvisioning()">Save project and default cluster</button>
          <a class="btn btn-quiet" [routerLink]="'/' + AdminPlatformPath.ENVIRONMENT_MANAGEMENT_SETUP"
             [queryParams]="environmentSetupGlobalQueryParams">API keys</a>
          @if (projectId) {
            <a class="btn btn-quiet" [href]="'https://cloud.mongodb.com/v2/' + projectId + '#/overview'" target="_blank" rel="noopener">
              <fa-icon [icon]="faExternalLinkAlt" class="me-1"/>Atlas project
            </a>
          }
        </div>
        @if (!view?.keysConfigured) {
          <div class="alert alert-warning d-flex align-items-start mt-3 mb-0">
            <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
            <div>
              <strong>API keys needed</strong>
              <div>Add the Atlas API public and private key under Global settings before this page can create clusters. The key needs Project Owner, or Project Cluster Manager plus Project Database Access Admin.</div>
            </div>
          </div>
        }
        @if (view?.atlasError) {
          <div class="alert alert-warning d-flex align-items-start mt-3 mb-0">
            <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
            <div>
              <strong>Atlas API</strong>
              <div>{{ view.atlasError }}</div>
            </div>
          </div>
        }
      </div>
      <div class="row thumbnail-heading-frame mb-4">
        <div class="thumbnail-heading">Create cluster</div>
        <p class="mb-3">London (<code>eu-west-2</code>) only. A free M0 is one cluster per project and stops at 500 collections across every database, which is why registration is failing on the current shared cluster. For live groups use M20. Nothing is created in Atlas until you press Create cluster.</p>
        <div class="row">
          <div class="col-md-4 mb-2">
            <label class="form-label" for="new-cluster-name">Name</label>
            <input id="new-cluster-name" class="form-control" name="newClusterName" [(ngModel)]="createRequest.name" autocomplete="off"
                   placeholder="ngx-ramblers-nonprod">
          </div>
          <div class="col-md-4 mb-2">
            <label class="form-label" for="new-cluster-tier">Tier</label>
            <select id="new-cluster-tier" class="form-control" name="newClusterTier" [(ngModel)]="createRequest.tier">
              <option [value]="AtlasClusterTier.M0">M0 free (proof only, 500 collections)</option>
              <option [value]="AtlasClusterTier.M10">M10 dedicated</option>
              <option [value]="AtlasClusterTier.M20">M20 dedicated (live groups)</option>
              <option [value]="AtlasClusterTier.M30">M30 dedicated</option>
            </select>
          </div>
          <div class="col-md-4 mb-2">
            <label class="form-label">Region</label>
            <input class="form-control" [value]="'AWS London (' + AtlasAwsRegion.EU_WEST_2 + ')'" disabled>
          </div>
        </div>
        <div class="form-check mt-2">
          <input class="form-check-input" type="checkbox" id="set-as-default" name="setAsDefault" [(ngModel)]="createRequest.setAsDefault">
          <label class="form-check-label" for="set-as-default">Set as the default cluster for new sites once Atlas gives us a hostname</label>
        </div>
        <div class="form-check mt-2">
          <input class="form-check-input" type="checkbox" id="allow-network" name="allowAllNetworkAccess" [(ngModel)]="createRequest.allowAllNetworkAccess">
          <label class="form-check-label" for="allow-network">Allow connections from anywhere (needed for Fly)</label>
        </div>
        <div class="mt-3">
          <button type="button" class="btn btn-primary" [disabled]="creating || !view?.keysConfigured || !projectId" (click)="createCluster()">
            @if (creating) {
              <fa-icon [icon]="faSpinner" animation="spin" class="me-1"/>
            }
            Create cluster
          </button>
        </div>
      </div>
      <div class="row thumbnail-heading-frame mb-4">
        <div class="thumbnail-heading">Clusters</div>
        <app-sortable-table
          [columns]="clusterColumns"
          [rows]="view?.clusters || []"
          [defaultSortKey]="clusterSortKey"
          [defaultSortDirection]="clusterSortDirection"
          [trackBy]="trackCluster"
          emptyMessage="No clusters yet. Create one above, or existing group clusters will appear here from environment configuration."
          (sortChange)="clusterSortChanged($event)">
          <ng-template [appSortableTableCell]="AtlasClusterSortField.NAME" let-row>
            {{ row.name }}
            @if (row.isDefault) {
              <span class="badge bg-success ms-1">Default for new sites</span>
            }
            @if (!row.inProvisioningProject) {
              <span class="badge bg-secondary ms-1">Not in this project</span>
            }
          </ng-template>
          <ng-template [appSortableTableCell]="AtlasClusterSortField.HOST" let-row>
            <code>{{ row.host }}</code>
          </ng-template>
          <ng-template [appSortableTableCell]="AtlasClusterSortField.SIZE" let-row>
            {{ row.instanceSize }}
            @if (row.region) {
              <span class="text-muted"> {{ row.region }}</span>
            }
            @if (row.stateName !== AtlasClusterState.UNKNOWN && row.stateName !== AtlasClusterState.IDLE) {
              <span class="text-muted"> ({{ row.stateName }})</span>
            }
          </ng-template>
          <ng-template [appSortableTableCell]="AtlasClusterSortField.ENVIRONMENTS" let-row>
            {{ row.environmentCount }}
          </ng-template>
          <ng-template [appSortableTableCell]="AtlasClusterSortField.COLLECTIONS" let-row>
            {{ row.collectionCount }}
            <div class="small" [class.text-danger]="!row.canAddEnvironment">{{ row.limitHeadline }}</div>
          </ng-template>
          <ng-template [appSortableTableCell]="'actions'" let-row>
            @if (row.host && !row.isDefault) {
              <button type="button" class="btn btn-primary btn-sm" [disabled]="saving" (click)="setDefaultCluster(row.host)">Use for new sites</button>
            }
          </ng-template>
        </app-sortable-table>
        <div class="mt-3">
          <button type="button" class="btn btn-quiet" [disabled]="!view?.keysConfigured || !projectId" (click)="allowNetwork()">Allow Fly connections</button>
          @if (view?.networkAccess?.length) {
            <div class="small text-muted mt-2">Network access: {{ networkAccessSummary() }}</div>
          }
        </div>
      </div>
      <div class="row thumbnail-heading-frame mb-4">
        <div class="thumbnail-heading">Environments</div>
        <app-sortable-table
          [columns]="environmentColumns"
          [rows]="view?.environments || []"
          [defaultSortKey]="environmentSortKey"
          [defaultSortDirection]="environmentSortDirection"
          [trackBy]="trackEnvironment"
          emptyMessage="No environments in platform configuration."
          (sortChange)="environmentSortChanged($event)">
          <ng-template [appSortableTableCell]="AtlasEnvironmentSortField.ENVIRONMENT" let-row>
            {{ row.environment }}
          </ng-template>
          <ng-template [appSortableTableCell]="AtlasEnvironmentSortField.CLUSTER" let-row>
            <code>{{ row.cluster }}</code>
          </ng-template>
          <ng-template [appSortableTableCell]="AtlasEnvironmentSortField.DATABASE" let-row>
            {{ row.database }}
          </ng-template>
          <ng-template [appSortableTableCell]="AtlasEnvironmentSortField.COLLECTIONS" let-row>
            @if (row.error) {
              <span class="text-danger">{{ row.error }}</span>
            } @else {
              {{ row.collections }} collections, {{ row.indexes }} indexes
            }
          </ng-template>
        </app-sortable-table>
      </div>
    </app-page>
  `
})
export class EnvironmentAtlasComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("EnvironmentAtlasComponent", NgxLoggerLevel.ERROR);
  private environmentSetupService = inject(EnvironmentSetupService);
  private notifierService = inject(NotifierService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};

  protected readonly faSpinner = faSpinner;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faExternalLinkAlt = faExternalLinkAlt;
  protected readonly AdminPlatformPath = AdminPlatformPath;
  protected readonly environmentSetupGlobalQueryParams = {[StoredValue.TAB]: toKebabCase(EnvironmentSetupTab.SETTINGS), [StoredValue.SUB_TAB]: EnvironmentSettingsSubTab.GLOBAL};
  protected readonly AtlasClusterTier = AtlasClusterTier;
  protected readonly AtlasAwsRegion = AtlasAwsRegion;
  protected readonly AtlasClusterState = AtlasClusterState;
  protected readonly AtlasClusterSortField = AtlasClusterSortField;
  protected readonly AtlasEnvironmentSortField = AtlasEnvironmentSortField;

  view: AtlasClusterView | null = null;
  loading = true;
  saving = false;
  creating = false;
  errorMessage: string | null = null;
  projectId = "";
  defaultCluster = "";
  clusterSortKey = AtlasClusterSortField.HOST;
  clusterSortDirection = ASCENDING;
  environmentSortKey = AtlasEnvironmentSortField.ENVIRONMENT;
  environmentSortDirection = ASCENDING;
  createRequest: AtlasClusterCreateRequest = {
    name: "ngx-ramblers-nonprod",
    tier: AtlasClusterTier.M0,
    region: AtlasAwsRegion.EU_WEST_2,
    setAsDefault: true,
    allowAllNetworkAccess: true
  };

  clusterColumns: SortableTableColumn<AtlasClusterRow>[] = [
    {key: AtlasClusterSortField.NAME, label: "Cluster", sortKey: AtlasClusterSortField.NAME},
    {key: AtlasClusterSortField.HOST, label: "Host", sortKey: AtlasClusterSortField.HOST},
    {key: AtlasClusterSortField.SIZE, label: "Size", sortKey: AtlasClusterSortField.SIZE},
    {key: AtlasClusterSortField.ENVIRONMENTS, label: "Sites", sortKey: AtlasClusterSortField.ENVIRONMENTS, align: SortableTableAlignment.RIGHT},
    {key: AtlasClusterSortField.COLLECTIONS, label: "Collections", sortKey: AtlasClusterSortField.COLLECTIONS},
    {key: "actions", label: ""}
  ];

  environmentColumns: SortableTableColumn<AtlasClusterEnvironmentRow>[] = [
    {key: AtlasEnvironmentSortField.ENVIRONMENT, label: "Environment", sortKey: AtlasEnvironmentSortField.ENVIRONMENT},
    {key: AtlasEnvironmentSortField.CLUSTER, label: "Cluster", sortKey: AtlasEnvironmentSortField.CLUSTER},
    {key: AtlasEnvironmentSortField.DATABASE, label: "Database", sortKey: AtlasEnvironmentSortField.DATABASE},
    {key: AtlasEnvironmentSortField.COLLECTIONS, label: "Usage", sortKey: AtlasEnvironmentSortField.COLLECTIONS, align: SortableTableAlignment.RIGHT}
  ];

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    const params = this.activatedRoute.snapshot.queryParams;
    this.clusterSortKey = params[StoredValue.ATLAS_CLUSTER_SORT] || AtlasClusterSortField.HOST;
    this.clusterSortDirection = params[StoredValue.ATLAS_CLUSTER_SORT_ORDER] === DESCENDING ? DESCENDING : ASCENDING;
    this.environmentSortKey = params[StoredValue.ATLAS_ENVIRONMENT_SORT] || AtlasEnvironmentSortField.ENVIRONMENT;
    this.environmentSortDirection = params[StoredValue.ATLAS_ENVIRONMENT_SORT_ORDER] === DESCENDING ? DESCENDING : ASCENDING;
    this.load();
  }

  trackCluster = (_index: number, row: AtlasClusterRow) => row.host || row.name;
  trackEnvironment = (_index: number, row: AtlasClusterEnvironmentRow) => row.environment;

  async load() {
    this.loading = true;
    this.errorMessage = null;
    try {
      this.view = await this.environmentSetupService.atlasClusters();
      this.projectId = this.view.projectId || "";
      this.defaultCluster = this.view.defaultCluster || "";
    } catch (error) {
      this.errorMessage = error?.error?.error || error?.message || "Could not load Atlas clusters";
      this.logger.error("load", error);
    } finally {
      this.loading = false;
    }
  }

  async saveProvisioning() {
    this.saving = true;
    try {
      const saved = await this.environmentSetupService.saveAtlasProvisioning({
        projectId: this.projectId.trim(),
        defaultCluster: this.defaultCluster.trim()
      });
      this.projectId = saved.atlas.projectId || "";
      this.defaultCluster = saved.atlas.defaultCluster || "";
      this.notify.success({title: "Saved", message: "Atlas project and default cluster have been saved."});
      await this.load();
    } catch (error) {
      this.notify.error({title: "Could not save", message: error?.error?.error || error?.message || "Save failed"});
    } finally {
      this.saving = false;
    }
  }

  async setDefaultCluster(host: string) {
    this.defaultCluster = host;
    await this.saveProvisioning();
  }

  async createCluster() {
    this.creating = true;
    try {
      const result = await this.environmentSetupService.createAtlasCluster({
        ...this.createRequest,
        name: this.createRequest.name.trim(),
        region: AtlasAwsRegion.EU_WEST_2
      });
      this.notify.success({title: "Cluster requested", message: result.message});
      await this.load();
    } catch (error) {
      this.notify.error({title: "Could not create cluster", message: error?.error?.error || error?.message || "Create failed"});
    } finally {
      this.creating = false;
    }
  }

  async allowNetwork() {
    try {
      const result = await this.environmentSetupService.allowAtlasNetworkAccess();
      this.notify.success({title: "Network access", message: result.message});
      await this.load();
    } catch (error) {
      this.notify.error({title: "Could not update network access", message: error?.error?.error || error?.message || "Update failed"});
    }
  }

  networkAccessSummary(): string {
    return (this.view?.networkAccess || []).map(entry => entry.cidr + (entry.comment ? ` (${entry.comment})` : "")).join(", ");
  }

  clusterSortChanged(state: SortableTableSortState) {
    this.clusterSortKey = (state.key as AtlasClusterSortField) || AtlasClusterSortField.HOST;
    this.clusterSortDirection = state.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.updateQueryParams();
  }

  environmentSortChanged(state: SortableTableSortState) {
    this.environmentSortKey = (state.key as AtlasEnvironmentSortField) || AtlasEnvironmentSortField.ENVIRONMENT;
    this.environmentSortDirection = state.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.updateQueryParams();
  }

  private updateQueryParams() {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        [StoredValue.ATLAS_CLUSTER_SORT]: this.clusterSortKey,
        [StoredValue.ATLAS_CLUSTER_SORT_ORDER]: this.clusterSortDirection,
        [StoredValue.ATLAS_ENVIRONMENT_SORT]: this.environmentSortKey,
        [StoredValue.ATLAS_ENVIRONMENT_SORT_ORDER]: this.environmentSortDirection
      },
      queryParamsHandling: "merge"
    });
  }
}
