import { Component, inject, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronRight, faCircleCheck, faCircleExclamation, faMagnifyingGlass, faRotate, faSpinner, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { groupBy, values } from "es-toolkit/compat";
import { ATLAS_M0_MAX_COLLECTIONS, ATLAS_RECOMMENDED_COLLECTION_AND_INDEX_LIMIT, AtlasClusterRow, AtlasClusterTier, EmptyCollectionCleanupSortField } from "../../../models/atlas-cluster.model";
import { EmptyCollectionCandidate, EmptyCollectionCleanupPreview, EmptyCollectionEnvironmentGroup } from "../../../models/environment-collection-cleanup.model";
import { ConsoleAccessUrlIconKey, MONGODB_ATLAS_CONSOLE_URLS, MongoClusterInfo } from "../../../models/environment-setup.model";
import { resolveConsoleUrls } from "../../../functions/console-access-urls";
import { StoredValue } from "../../../models/ui-actions";
import { PageComponent } from "../../../page/page.component";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { SortableTableAlignment, SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { SortableTableCellDirective, SortableTableExpandedRowDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { MongoClusterSelectComponent } from "../../../modules/common/selectors/mongo-cluster-select";
import { ConsoleAccessLinksComponent } from "../../../modules/common/console-access-links/console-access-links";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
  selector: "app-environment-collection-cleanup",
  imports: [ConsoleAccessLinksComponent, FontAwesomeModule, MongoClusterSelectComponent, PageComponent, SortableTableComponent, SortableTableCellDirective, SortableTableExpandedRowDirective],
  template: `
    <app-page autoTitle pageTitle="MongoDB Collection Cleanup">
      <div class="thumbnail-heading-frame thumbnail-heading-frame-compact mb-4">
        <div class="thumbnail-heading">Empty collection cleanup</div>
        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
          <label class="form-label mb-0" for="cleanup-cluster">Cluster</label>
          <app-mongo-cluster-select id="cleanup-cluster" class="flex-fill" [clusters]="clusters" [selected]="selectedCluster" [clearable]="false" [disabled]="loading || cleaning" (selectedChange)="clusterChanged($event)"/>
        </div>
        @if (selectedAtlasCluster) {
          <div class="thumbnail-heading-frame thumbnail-heading-frame-compact mb-3">
            <div class="thumbnail-heading">Selected cluster</div>
            <div class="d-flex flex-wrap align-items-center gap-3">
              <div class="flex-grow-1">
                <div class="d-flex flex-wrap align-items-baseline gap-2">
                  <strong>{{ selectedAtlasCluster.name }}</strong>
                  <span class="badge bg-secondary">{{ selectedAtlasCluster.instanceSize === AtlasClusterTier.UNKNOWN ? "Type unavailable" : selectedAtlasCluster.instanceSize }}</span>
                  @if (selectedAtlasCluster.region) { <span class="text-muted small">{{ selectedAtlasCluster.region }}</span> }
                  <span class="badge-cloudy">{{ selectedAtlasCluster.stateName }}</span>
                </div>
                <div class="text-muted small mt-1">
                  @if (selectedAtlasCluster.instanceSize === AtlasClusterTier.M0 || selectedAtlasCluster.instanceSize === AtlasClusterTier.FLEX) {
                    {{ selectedAtlasCluster.collectionCount }} of {{ ATLAS_M0_MAX_COLLECTIONS }} collections used
                  } @else if (recommendedCollectionIndexLimit()) {
                    {{ selectedAtlasCluster.collectionCount }} collections and {{ selectedAtlasCluster.indexCount }} indexes; {{ selectedAtlasCluster.collectionCount + selectedAtlasCluster.indexCount }} of about {{ recommendedCollectionIndexLimit() }} recommended
                  } @else {
                    {{ selectedAtlasCluster.collectionCount }} collections and {{ selectedAtlasCluster.indexCount }} indexes
                  }
                  <span class="ms-1">across {{ stringUtils.pluraliseWithCount(selectedAtlasCluster.environmentCount, "configured site") }}</span>
                </div>
                @if (selectedAtlasCluster.environmentNames) {
                  <div class="text-muted small mt-1">Sites: {{ selectedAtlasCluster.environmentNames }}</div>
                }
              </div>
              <app-console-access-links [links]="selectedClusterConsoleLinks()" [showEmpty]="false"/>
            </div>
          </div>
        }
        <div class="d-flex flex-wrap flex-lg-nowrap align-items-center gap-2 mb-1">
          <strong class="text-nowrap">{{ stringUtils.pluraliseWithCount(selectedCandidates.length, "empty collection") }} selected across {{ stringUtils.pluraliseWithCount(selectedSiteCount(), "site") }}</strong>
          <div class="ms-lg-auto d-flex gap-2 flex-shrink-0">
            <button type="button" class="btn btn-quiet" [disabled]="loading || cleaning" (click)="loadPreview()">
              @if (loading) { <fa-icon [icon]="faSpinner" animation="spin" class="me-1"/> }
              <fa-icon [icon]="faRotate" class="me-1"/>Refresh inventory
            </button>
            <button type="button" class="btn btn-primary" [disabled]="loading || cleaning || !selectedCandidates.length" (click)="reviewSelection()">
              <fa-icon [icon]="faMagnifyingGlass" class="me-1"/>Review selected collections
            </button>
          </div>
        </div>
        <div class="text-muted small mb-3">Only empty collections whose complete index definitions match the current model are included. Collections with different indexes or custom collection settings are excluded.</div>
        @if (preview) {
          <div class="text-muted small mb-3">Sites without eligible empty collections are hidden.</div>
        }
        @if (errorMessage) {
          <div class="alert alert-danger d-flex align-items-start">
            <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
            <div><strong>Could not inspect collections</strong><div>{{ errorMessage }}</div></div>
          </div>
        }
        @if (resultMessage) {
          <div class="alert alert-success d-flex align-items-start">
            <fa-icon [icon]="faCircleCheck" class="me-2 mt-1"/>
            <div><strong>Cleanup complete</strong><div>{{ resultMessage }}</div></div>
          </div>
        }
        @if (confirming) {
          <div class="alert alert-warning p-2">
            <div class="d-flex align-items-center gap-2 mb-1">
              <fa-icon [icon]="faCircleExclamation"/>
              <strong>Confirm removal</strong>
            </div>
            <div>{{ stringUtils.pluraliseWithCount(selectedCandidates.length, "empty collection") }} across {{ stringUtils.pluraliseWithCount(selectedSiteCount(), "site") }}. Each is rechecked before removal.</div>
            <details class="mt-2">
              <summary>View collections</summary>
              <ul class="mb-2 mt-1">
                @for (group of selectedGroups(); track group.environment) {
                  <li>{{ group.environment }} — <code>{{ group.database }}: {{ group.candidates.map(candidate => candidate.collection).join(", ") }}</code></li>
                }
              </ul>
            </details>
            <div class="d-flex gap-2 mt-2">
              <button type="button" class="btn btn-danger" [disabled]="cleaning" (click)="removeSelected()">
                @if (cleaning) { <fa-icon [icon]="faSpinner" animation="spin" class="me-1"/> }
                <fa-icon [icon]="faTrash" class="me-1"/>Remove {{ stringUtils.pluraliseWithCount(selectedCandidates.length, "collection") }}
              </button>
              <button type="button" class="btn btn-quiet" [disabled]="cleaning" (click)="cancelReview()"><fa-icon [icon]="faXmark" class="me-1"/>Cancel</button>
            </div>
          </div>
        }
        <app-sortable-table
          [columns]="columns"
          [rows]="siteGroupRows"
          [fixedLayout]="true"
          [defaultSortKey]="sortKey"
          [defaultSortDirection]="sortDirection"
          [expandedWhen]="isExpanded"
          emptyMessage="No eligible empty collections found across configured environments."
          [trackBy]="trackSite"
          (sortChange)="sortChanged($event)">
          <ng-template [appSortableTableCell]="'selection'" let-row>
            <input type="checkbox" [checked]="isGroupSelected(row)" [indeterminate]="isGroupPartiallySelected(row)" [disabled]="confirming || cleaning" [attr.aria-label]="'Select empty collections for ' + row.environment" (change)="toggleGroupSelection(row)">
          </ng-template>
          <ng-template [appSortableTableCell]="'environment'" let-row><strong>{{ row.environment }}</strong></ng-template>
          <ng-template [appSortableTableCell]="'cluster'" let-row><code class="d-block text-truncate" [attr.title]="row.cluster">{{ row.cluster }}</code></ng-template>
          <ng-template [appSortableTableCell]="'database'" let-row><code class="d-block text-truncate" [attr.title]="row.database">{{ row.database }}</code></ng-template>
          <ng-template [appSortableTableCell]="'contentCollectionCount'" let-row>{{ row.contentCollectionCount }}</ng-template>
          <ng-template [appSortableTableCell]="'collectionCount'" let-row>{{ row.candidates.length }}</ng-template>
          <ng-template [appSortableTableCell]="'actions'" let-row>
            <button type="button" class="btn btn-quiet btn-icon" [tooltip]="isExpanded(row) ? 'Hide collection names' : 'Show collection names'" (click)="toggleExpanded(row)">
              <fa-icon [icon]="isExpanded(row) ? faChevronDown : faChevronRight"/>
            </button>
          </ng-template>
          <ng-template appSortableTableExpandedRow let-row>
            <div class="d-flex flex-wrap gap-2 py-1">
              @for (candidate of row.candidates; track candidateKey(candidate)) { <code>{{ candidate.collection }}</code> }
            </div>
          </ng-template>
        </app-sortable-table>
      </div>
    </app-page>
  `
})
export class EnvironmentCollectionCleanupComponent implements OnInit {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private logger: Logger = inject(LoggerFactory).createLogger(EnvironmentCollectionCleanupComponent, NgxLoggerLevel.ERROR);
  private environmentSetupService = inject(EnvironmentSetupService);
  protected stringUtils = inject(StringUtilsService);
  protected readonly AtlasClusterTier = AtlasClusterTier;
  protected readonly ATLAS_M0_MAX_COLLECTIONS = ATLAS_M0_MAX_COLLECTIONS;

  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faSpinner = faSpinner;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faMagnifyingGlass = faMagnifyingGlass;
  protected readonly faRotate = faRotate;
  protected readonly faTrash = faTrash;
  protected readonly faXmark = faXmark;

  columns: SortableTableColumn<EmptyCollectionEnvironmentGroup>[] = [
    {key: "selection", label: "", cellClass: "text-center", width: "4%"},
    {key: EmptyCollectionCleanupSortField.ENVIRONMENT, label: "Site", sortKey: EmptyCollectionCleanupSortField.ENVIRONMENT, cellClass: "text-nowrap", width: "17%"},
    {key: EmptyCollectionCleanupSortField.CLUSTER, label: "Cluster", sortKey: EmptyCollectionCleanupSortField.CLUSTER, cellClass: "text-nowrap", width: "17%"},
    {key: EmptyCollectionCleanupSortField.DATABASE, label: "Database", sortKey: EmptyCollectionCleanupSortField.DATABASE, cellClass: "text-nowrap", width: "28%"},
    {key: EmptyCollectionCleanupSortField.CONTENT_COLLECTION_COUNT, label: "Collections with content", sortKey: EmptyCollectionCleanupSortField.CONTENT_COLLECTION_COUNT, align: SortableTableAlignment.RIGHT, width: "17%"},
    {key: EmptyCollectionCleanupSortField.COLLECTION_COUNT, label: "Cleanup available", sortKey: EmptyCollectionCleanupSortField.COLLECTION_COUNT, align: SortableTableAlignment.RIGHT, width: "13%"},
    {key: "actions", label: "", cellClass: "text-center", width: "4%"}
  ];

  sortKey = EmptyCollectionCleanupSortField.ENVIRONMENT;
  sortDirection = ASCENDING;
  preview: EmptyCollectionCleanupPreview | null = null;
  clusters: MongoClusterInfo[] = [];
  selectedCluster: MongoClusterInfo | null = null;
  selectedAtlasCluster: AtlasClusterRow | null = null;
  atlasClusters: AtlasClusterRow[] = [];
  selectedCandidates: EmptyCollectionCandidate[] = [];
  expandedEnvironments: string[] = [];
  hasCustomSelection = false;
  loading = false;
  cleaning = false;
  confirming = false;
  errorMessage: string | null = null;
  resultMessage: string | null = null;

  ngOnInit(): void {
    const params = this.activatedRoute.snapshot.queryParams;
    this.sortKey = values(EmptyCollectionCleanupSortField).includes(params[StoredValue.COLLECTION_CLEANUP_SORT])
      ? params[StoredValue.COLLECTION_CLEANUP_SORT]
      : EmptyCollectionCleanupSortField.ENVIRONMENT;
    this.sortDirection = params[StoredValue.COLLECTION_CLEANUP_SORT_ORDER] === DESCENDING ? DESCENDING : ASCENDING;
    void this.loadClusters();
  }

  async loadClusters(): Promise<void> {
    this.loading = true;
    try {
      const response = await this.environmentSetupService.mongoClusters();
      this.clusters = response.clusters || [];
      const requestedCluster = this.activatedRoute.snapshot.queryParams[StoredValue.COLLECTION_CLEANUP_CLUSTER];
      const defaultCluster = requestedCluster || response.defaultCluster;
      this.selectedCluster = this.clusters.find(cluster => cluster.cluster === defaultCluster) || this.clusters[0] || null;
      if (this.selectedCluster) {
        await this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {
          [StoredValue.COLLECTION_CLEANUP_CLUSTER]: this.selectedCluster.cluster
        }, queryParamsHandling: "merge", replaceUrl: true});
        await this.loadPreview();
      } else {
        this.errorMessage = "No configured MongoDB clusters are available.";
      }
      await this.loadAtlasClusterInventory();
    } catch (error) {
      this.logger.error("Could not load configured MongoDB clusters", error);
      this.errorMessage = error instanceof Error ? error.message : "Could not load configured MongoDB clusters.";
    }
    this.loading = false;
  }

  private async loadAtlasClusterInventory(): Promise<void> {
    try {
      const view = await this.environmentSetupService.atlasClusters();
      this.atlasClusters = view.clusters || [];
      this.updateSelectedAtlasCluster();
    } catch (error) {
      this.logger.error("Could not load Atlas cluster inventory", error);
      this.atlasClusters = [];
      this.selectedAtlasCluster = null;
    }
  }

  clusterChanged(cluster: MongoClusterInfo | null): void {
    this.selectedCluster = cluster;
    this.selectedCandidates = [];
    this.hasCustomSelection = false;
    this.expandedEnvironments = [];
    this.confirming = false;
    if (cluster) {
      this.updateSelectedAtlasCluster();
      void this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {
        [StoredValue.COLLECTION_CLEANUP_CLUSTER]: cluster.cluster
      }, queryParamsHandling: "merge"});
      void this.loadPreview();
    } else {
      this.selectedAtlasCluster = null;
      this.preview = {cluster: "", candidates: [], contentCollectionCounts: []};
      this.siteGroupRows = [];
    }
  }

  private updateSelectedAtlasCluster(): void {
    this.selectedAtlasCluster = this.atlasClusters.find(cluster => cluster.host === this.selectedCluster?.cluster) || null;
  }

  recommendedCollectionIndexLimit(): number | null {
    return this.selectedAtlasCluster ? ATLAS_RECOMMENDED_COLLECTION_AND_INDEX_LIMIT[this.selectedAtlasCluster.instanceSize] : null;
  }

  selectedClusterConsoleLinks() {
    const cluster = this.selectedAtlasCluster;
    const links = resolveConsoleUrls(MONGODB_ATLAS_CONSOLE_URLS, {
      projectId: cluster?.projectId || "",
      clusterName: cluster?.inProvisioningProject ? cluster.name : "",
      database: ""
    });
    return links.filter(link => link.iconKey === ConsoleAccessUrlIconKey.DASHBOARD);
  }

  sortChanged(state: SortableTableSortState): void {
    this.sortKey = values(EmptyCollectionCleanupSortField).includes(state.key as EmptyCollectionCleanupSortField)
      ? state.key as EmptyCollectionCleanupSortField
      : EmptyCollectionCleanupSortField.ENVIRONMENT;
    this.sortDirection = state.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {
      [StoredValue.COLLECTION_CLEANUP_SORT]: this.sortKey,
      [StoredValue.COLLECTION_CLEANUP_SORT_ORDER]: this.sortDirection
    }, queryParamsHandling: "merge"});
  }

  trackSite = (_index: number, group: EmptyCollectionEnvironmentGroup) => `${group.cluster}/${group.environment}`;
  trackCandidate = (_index: number, candidate: EmptyCollectionCandidate) => this.candidateKey(candidate);

  candidateKey(candidate: EmptyCollectionCandidate): string {
    return `${candidate.cluster}/${candidate.environment}/${candidate.database}/${candidate.collection}`;
  }

  siteGroupRows: EmptyCollectionEnvironmentGroup[] = [];

  siteGroups(): EmptyCollectionEnvironmentGroup[] {
    const grouped = groupBy(this.preview?.candidates || [], candidate => candidate.environment);
    return values(grouped).map(candidates => ({
      environment: candidates[0].environment,
      cluster: candidates[0].cluster,
      database: candidates[0].database,
      collectionCount: candidates.length,
      contentCollectionCount: this.preview?.contentCollectionCounts.find(count => count.environment === candidates[0].environment)?.count || 0,
      candidates
    }))
      .sort((left, right) => left.environment.localeCompare(right.environment));
  }

  selectedGroups(): EmptyCollectionEnvironmentGroup[] {
    const grouped = groupBy(this.selectedCandidates, candidate => candidate.environment);
    return values(grouped).map(candidates => ({environment: candidates[0].environment, cluster: candidates[0].cluster, database: candidates[0].database, collectionCount: candidates.length, contentCollectionCount: 0, candidates}))
      .sort((left, right) => left.environment.localeCompare(right.environment));
  }

  selectedSiteCount(): number {
    return this.selectedGroups().length;
  }

  isSelected(candidate: EmptyCollectionCandidate): boolean {
    return this.selectedCandidates.some(selected => this.candidateKey(selected) === this.candidateKey(candidate));
  }

  isGroupSelected(group: EmptyCollectionEnvironmentGroup): boolean {
    return group.candidates.every(candidate => this.isSelected(candidate));
  }

  isGroupPartiallySelected(group: EmptyCollectionEnvironmentGroup): boolean {
    return !this.isGroupSelected(group) && group.candidates.some(candidate => this.isSelected(candidate));
  }

  toggleGroupSelection(group: EmptyCollectionEnvironmentGroup): void {
    const groupKeys = new Set(group.candidates.map(candidate => this.candidateKey(candidate)));
    this.selectedCandidates = this.isGroupSelected(group)
      ? this.selectedCandidates.filter(candidate => !groupKeys.has(this.candidateKey(candidate)))
      : [...this.selectedCandidates.filter(candidate => !groupKeys.has(this.candidateKey(candidate))), ...group.candidates];
    this.hasCustomSelection = true;
    this.confirming = false;
  }

  isExpanded = (group: EmptyCollectionEnvironmentGroup): boolean => this.expandedEnvironments.includes(group.environment);

  toggleExpanded(group: EmptyCollectionEnvironmentGroup): void {
    this.expandedEnvironments = this.isExpanded(group)
      ? this.expandedEnvironments.filter(environment => environment !== group.environment)
      : [...this.expandedEnvironments, group.environment];
  }

  async loadPreview(): Promise<void> {
    this.loading = true;
    this.errorMessage = null;
    this.resultMessage = null;
    this.confirming = false;
    try {
      this.preview = this.selectedCluster
        ? await this.environmentSetupService.emptyCollectionCleanupPreview(this.selectedCluster.cluster)
        : {cluster: "", candidates: [], contentCollectionCounts: []};
      this.siteGroupRows = this.siteGroups();
      const current = new Set(this.preview.candidates.map(candidate => this.candidateKey(candidate)));
      this.selectedCandidates = this.hasCustomSelection
        ? this.selectedCandidates.filter(candidate => current.has(this.candidateKey(candidate)))
        : [...this.preview.candidates];
    } catch (error) {
      this.logger.error("Could not load collection cleanup preview", error);
      this.errorMessage = error instanceof Error ? error.message : "Could not inspect this cluster.";
    }
    this.loading = false;
  }

  reviewSelection(): void {
    this.confirming = this.selectedCandidates.length > 0;
    this.resultMessage = null;
  }

  cancelReview(): void {
    this.confirming = false;
  }

  async removeSelected(): Promise<void> {
    this.cleaning = true;
    this.errorMessage = null;
    try {
      const result = await this.environmentSetupService.removeEmptyCollections(this.selectedCluster?.cluster || "", this.selectedCandidates);
      this.selectedCandidates = [];
      this.hasCustomSelection = true;
      this.confirming = false;
      await this.loadPreview();
      await this.loadAtlasClusterInventory();
      this.resultMessage = `${this.stringUtils.pluraliseWithCount(result.removed.length, "collection")} removed; ${this.stringUtils.pluraliseWithCount(result.skipped.length, "collection")} skipped because they were no longer eligible.`;
    } catch (error) {
      this.logger.error("Could not remove empty collections", error);
      this.errorMessage = error instanceof Error ? error.message : "Could not remove the selected collections.";
    }
    this.cleaning = false;
  }
}
