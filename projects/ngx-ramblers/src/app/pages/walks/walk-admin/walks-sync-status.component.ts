import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faSync,
  faCheckCircle,
  faExclamationTriangle,
  faCircle,
  faSpinner
} from "@fortawesome/free-solid-svg-icons";
import { ExtendedGroupEventQueryService } from "../../../services/walks-and-events/extended-group-event-query.service";
import { SyncStatusResponse } from "../../../models/search.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { interval, Subscription } from "rxjs";
import { switchMap } from "rxjs/operators";
import { NotifierService } from "../../../services/notifier.service";

@Component({
  selector: "app-walks-sync-status",
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <div class="sync-status-panel">
      <div class="card">
        <div class="card-header bg-light">
          <h6 class="mb-0">
            <fa-icon [icon]="faSync" class="me-2"/>
            Walks Manager Sync Status
          </h6>
        </div>
        <div class="card-body">
          @if (loading) {
            <div class="text-center py-3">
              <fa-icon [icon]="faSpinner" [spin]="true" size="2x"/>
              <p class="mt-2 mb-0 text-muted">Loading sync status...</p>
            </div>
          } @else if (syncStatus) {
            <div class="row">
              <div class="col-md-6 mb-3">
                <div class="d-flex align-items-center">
                  @if (syncStatus.status === 'never') {
                    <fa-icon [icon]="faCircle" class="text-secondary me-2"/>
                  } @else if (syncStatus.status === 'syncing') {
                    <fa-icon [icon]="faSpinner" [spin]="true" class="text-primary me-2"/>
                  } @else if (syncStatus.status === 'success') {
                    <fa-icon [icon]="faCheckCircle" class="text-success me-2"/>
                  } @else if (syncStatus.status === 'error') {
                    <fa-icon [icon]="faExclamationTriangle" class="text-danger me-2"/>
                  }
                  <div>
                    <strong>Status:</strong>
                    <span class="ms-2">{{ getStatusLabel(syncStatus.status) }}</span>
                  </div>
                </div>
              </div>

              @if (syncStatus.lastSyncedAt) {
                <div class="col-md-6 mb-3">
                  <div>
                    <strong>Last Synced:</strong>
                    <span class="ms-2">{{ syncStatus.lastSyncedAt | date:'medium' }}</span>
                  </div>
                </div>
              }

              @if (syncStatus.totalSynced !== undefined) {
                <div class="col-md-6 mb-3">
                  <div>
                    <strong>Total Events:</strong>
                    <span class="ms-2">{{ syncStatus.totalSynced }}</span>
                  </div>
                </div>
              }

              @if (syncStatus.errors && syncStatus.errors.length > 0) {
                <div class="col-12 mb-3">
                  <div class="alert alert-danger mb-0">
                    <strong>Errors:</strong>
                    <ul class="mb-0 mt-2">
                      @for (error of syncStatus.errors; track $index) {
                        <li>{{ error }}</li>
                      }
                    </ul>
                  </div>
                </div>
              }

              <div class="col-12">
                <div class="d-flex gap-2">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    (click)="triggerSync(false)"
                    [disabled]="syncing || syncStatus.status === 'syncing'">
                    @if (syncing) {
                      <fa-icon [icon]="faSpinner" [spin]="true" class="me-2"/>
                    } @else {
                      <fa-icon [icon]="faSync" class="me-2"/>
                    }
                    Sync Now (Incremental)
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-primary btn-sm"
                    (click)="triggerSync(true)"
                    [disabled]="syncing || syncStatus.status === 'syncing'">
                    @if (syncing) {
                      <fa-icon [icon]="faSpinner" [spin]="true" class="me-2"/>
                    } @else {
                      <fa-icon [icon]="faSync" class="me-2"/>
                    }
                    Full Sync
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    (click)="refreshStatus()"
                    [disabled]="loading">
                    <fa-icon [icon]="faSync" class="me-2"/>
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sync-status-panel
      margin-bottom: 1rem
  `]
})
export class WalksSyncStatusComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("WalksSyncStatusComponent", NgxLoggerLevel.OFF);
  private searchService = inject(ExtendedGroupEventQueryService);
  private notifierService = inject(NotifierService);
  private notify = this.notifierService.createGlobalAlert();

  faSync = faSync;
  faCheckCircle = faCheckCircle;
  faExclamationTriangle = faExclamationTriangle;
  faCircle = faCircle;
  faSpinner = faSpinner;

  syncStatus: SyncStatusResponse | null = null;
  loading = false;
  syncing = false;
  private statusSubscription?: Subscription;

  ngOnInit() {
    this.refreshStatus();
    this.startAutoRefresh();
  }

  ngOnDestroy() {
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
    }
  }

  private startAutoRefresh() {
    this.statusSubscription = interval(30000)
      .pipe(switchMap(() => this.searchService.getSyncStatus()))
      .subscribe({
        next: (status) => {
          this.syncStatus = status;
        },
        error: (error) => {
          this.logger.error("Failed to refresh sync status:", error);
        }
      });
  }

  refreshStatus() {
    this.loading = true;
    this.searchService.getSyncStatus().subscribe({
      next: (status) => {
        this.syncStatus = status;
        this.loading = false;
      },
      error: (error) => {
        this.logger.error("Failed to load sync status:", error);
        this.loading = false;
        this.notify.error({
          title: "Sync Status Error",
          message: "Failed to load sync status"
        });
      }
    });
  }

  triggerSync(fullSync: boolean) {
    this.syncing = true;
    const syncType = fullSync ? "Full" : "Incremental";

    this.searchService.triggerSync(fullSync).subscribe({
      next: (response) => {
        this.syncing = false;
        this.notify.success({
          title: `${syncType} Sync Triggered`,
          message: response.message
        });
        setTimeout(() => this.refreshStatus(), 2000);
      },
      error: (error) => {
        this.syncing = false;
        this.logger.error(`Failed to trigger ${syncType.toLowerCase()} sync:`, error);
        this.notify.error({
          title: `${syncType} Sync Failed`,
          message: error.error?.message || "Failed to trigger sync"
        });
      }
    });
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case "never":
        return "Never Synced";
      case "syncing":
        return "Syncing...";
      case "success":
        return "Successfully Synced";
      case "error":
        return "Sync Failed";
      default:
        return status;
    }
  }
}
