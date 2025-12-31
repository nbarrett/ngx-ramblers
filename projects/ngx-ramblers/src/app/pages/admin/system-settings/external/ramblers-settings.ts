import { Component, inject, Input, OnDestroy, OnInit, signal } from "@angular/core";
import { faAdd, faSync, faClock, faCheckCircle, faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfig, WalksManagerSyncStats, WalksManagerSyncStatusResponse } from "../../../../models/system.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { SecretInputComponent } from "../../../../modules/common/secret-input/secret-input.component";
import { HttpClient } from "@angular/common/http";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { WebSocketClientService } from "../../../../services/websockets/websocket-client.service";
import { EventType, MessageType } from "../../../../models/websocket.model";
import { Subscription } from "rxjs";

@Component({
  selector: "app-ramblers-settings",
  template: `
    @if (config?.national?.mainSite) {
      <div class="row thumbnail-heading-frame">
        <div class="thumbnail-heading">Ramblers</div>
        <div class="row">
          <div class="col-md-5">
            <div class="form-group">
              <label for="main-site-href">Main Site Web Url</label>
              <input [(ngModel)]="config.national.mainSite.href"
                     id="main-site-href"
                     type="text" class="form-control input-sm"
                     placeholder="Enter main site link">
            </div>
          </div>
          <div class="col-md-4">
            <div class="form-group">
              <label for="main-site-title">Main Site Name</label>
              <input [(ngModel)]="config.national.mainSite.title"
                     id="main-site-title"
                     type="text" class="form-control input-sm"
                     placeholder="Enter main site title">
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <label>Link Preview</label>
            </div>
            <div class="form-group">
              <a
                [href]="config.national.mainSite.href">{{ config.national.mainSite.title || config.national.mainSite.href }}</a>
            </div>
          </div>
          <div class="col-md-5">
            <div class="form-group">
              <label for="walks-manager-href">Walks Manager Web Url</label>
              <input [(ngModel)]="config.national.walksManager.href" id="walks-manager-href"
                     type="text" class="form-control input-sm"
                     placeholder="Enter Walks Manager site link">
            </div>
          </div>
          <div class="col-md-4">
            <div class="form-group">
              <label for="walks-manager-title">Walks Manager Name</label>
              <input [(ngModel)]="config.national.walksManager.title"
                     id="walks-manager-title"
                     type="text" class="form-control input-sm"
                     placeholder="Enter Walks Manager site title">
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <label>Link Preview</label>
            </div>
            <div class="form-group">
              <a
                [href]="config.national.walksManager.href">{{ config.national.walksManager.title || config.national.walksManager.href }}</a>
            </div>
          </div>
          <div class="col-md-5">
            <form class="form-group">
              <label for="walks-manager-user-name">Walks Manager User Name</label>
              <input [(ngModel)]="config.national.walksManager.userName"
                     id="walks-manager-user-name"
                     autocomplete="nope"
                     name="newPassword"
                     type="text" class="form-control input-sm"
                     placeholder="Enter Walks Manager userName">
            </form>
          </div>
          <div class="col-md-4">
            <form class="form-group">
              <label for="walks-manager-password">Walks Manager password</label>
              <app-secret-input
                [(ngModel)]="config.national.walksManager.password"
                id="walks-manager-password"
                name="password"
                size="sm"
                placeholder="Enter Walks Manager password">
              </app-secret-input>
            </form>
          </div>
          <div class="col-md-3">
            <form class="form-group">
              <label for="walks-manager-api-key">Walks Manager API Key</label>
              <app-secret-input
                [(ngModel)]="config.national.walksManager.apiKey"
                id="walks-manager-api-key"
                name="apiKey"
                size="sm"
                placeholder="Enter Walks Manager API key">
              </app-secret-input>
            </form>
          </div>
        </div>

        <div class="row mt-4">
          <div class="col-md-12">
            <h5>Walks Manager Data Sync</h5>
            <div class="alert alert-warning">
              <fa-icon [icon]="faClock" class="me-2"/>
              <strong>Automatic Sync:</strong> Runs every 6 hours to keep cached data fresh
            </div>
          </div>

          @if (lastSyncedAt) {
            <div class="col-md-12 mb-3">
              <strong>Last Synced:</strong> {{ dateUtils.displayDateAndTime(lastSyncedAt) }}
              ({{ dateUtils.asDateTime(lastSyncedAt).toRelative() }})
            </div>
          }

          <div class="col-md-12 mb-3">
            <button type="button"
                    class="btn btn-primary me-2"
                    [disabled]="!!syncingMode"
                    (click)="triggerSync(false)">
              <fa-icon [icon]="faSync" [spin]="syncingMode === 'incremental'" class="me-2"/>
              {{ syncingMode === "incremental" ? "Syncing..." : "Sync Now (Incremental)" }}
            </button>
            <button type="button"
                    class="btn btn-warning"
                    [disabled]="!!syncingMode"
                    (click)="triggerSync(true)">
              <fa-icon [icon]="faSync" [spin]="syncingMode === 'full'" class="me-2"/>
              {{ syncingMode === "full" ? "Syncing..." : "Full Sync (All Time)" }}
            </button>
          </div>

          @if (syncProgress() > 0 && syncProgress() < 100) {
            <div class="col-md-12 mb-3">
              <div class="alert alert-warning mb-2">
                <fa-icon [icon]="faSync" [spin]="true" class="me-2"/>
                <strong>Sync in progress:</strong> {{ syncMessage() }}
              </div>
              <div class="progress mt-3" style="height: 25px;">
                <div class="progress-bar"
                     role="progressbar"
                     [attr.aria-valuenow]="syncProgress()"
                     aria-valuemin="0"
                     aria-valuemax="100"
                     [style.width.%]="syncProgress()">
                  {{ syncProgress() }}%
                </div>
              </div>
            </div>
          }

          @if (syncStats) {
            <div class="col-md-12">
              <div class="card">
                <div class="card-header bg-success text-white">
                  <fa-icon [icon]="faCheckCircle" class="me-2"/>
                  Sync Complete
                </div>
                <div class="card-body">
                  <div class="row">
                    <div class="col-md-3">
                      <strong>Added:</strong> {{ syncStats.added }}
                    </div>
                    <div class="col-md-3">
                      <strong>Updated:</strong> {{ syncStats.updated }}
                    </div>
                    <div class="col-md-3">
                      <strong>Deleted:</strong> {{ syncStats.deleted }}
                    </div>
                    <div class="col-md-3">
                      <strong>Total Processed:</strong> {{ syncStats.totalProcessed }}
                    </div>
                  </div>
                  @if (syncStats.errors && syncStats.errors.length > 0) {
                    <div class="row mt-3">
                      <div class="col-md-12">
                        <div class="alert alert-warning">
                          <fa-icon [icon]="faTimesCircle" class="me-2"/>
                          <strong>Errors ({{ syncStats.errors.length }}):</strong>
                          <ul class="mb-0 mt-2">
                            @for (error of syncStats.errors; track error) {
                              <li>{{ error }}</li>
                            }
                          </ul>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          @if (syncError) {
            <div class="col-md-12">
              <div class="alert alert-danger">
                <fa-icon [icon]="faTimesCircle" class="me-2"/>
                <strong>Sync Failed:</strong> {{ syncError }}
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  imports: [ReactiveFormsModule, FormsModule, SecretInputComponent, FontAwesomeModule]
})
export class RamblersSettings implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("RamblersSettings", NgxLoggerLevel.ERROR);
  protected systemConfigService = inject(SystemConfigService);
  protected http = inject(HttpClient);
  protected dateUtils = inject(DateUtilsService);
  private wsClient = inject(WebSocketClientService);

  faAdd = faAdd;
  faSync = faSync;
  faClock = faClock;
  faCheckCircle = faCheckCircle;
  faTimesCircle = faTimesCircle;

  @Input() config: SystemConfig;

  protected readonly JSON = JSON;

  syncingMode: "incremental" | "full" | null = null;
  lastSyncedAt: number;
  syncStats: WalksManagerSyncStats | null = null;
  syncError: string | null = null;

  syncProgress = signal<number>(0);
  syncMessage = signal<string>("");

  private progressSubscription: Subscription;
  private completeSubscription: Subscription;
  private errorSubscription: Subscription;

  async ngOnInit() {
    this.logger.info("constructed:config:", this.config);
    await this.loadSyncStatus();
    await this.wsClient.connect();
    this.setupWebSocketSubscriptions();
  }

  ngOnDestroy() {
    this.progressSubscription?.unsubscribe();
    this.completeSubscription?.unsubscribe();
    this.errorSubscription?.unsubscribe();
  }

  private setupWebSocketSubscriptions() {
    this.progressSubscription = this.wsClient.receiveMessages<any>(MessageType.PROGRESS).subscribe(data => {
      this.logger.info("Progress received:", data);
      if (data.percent !== undefined) {
        this.syncProgress.set(Math.round(data.percent));
      }
      if (data.message) {
        this.syncMessage.set(data.message);
      }
    });

    this.completeSubscription = this.wsClient.receiveMessages<any>(MessageType.COMPLETE).subscribe(data => {
      this.logger.info("Sync complete:", data);
      this.syncProgress.set(100);
      this.syncMessage.set(data.message || "Sync complete");
      this.syncStats = {
        added: data.added || 0,
        updated: data.updated || 0,
        deleted: data.deleted || 0,
        errors: data.errors || [],
        lastSyncedAt: data.lastSyncedAt,
        totalProcessed: data.totalProcessed || 0
      };
      this.lastSyncedAt = data.lastSyncedAt;
      this.syncingMode = null;
      setTimeout(() => {
        this.syncProgress.set(0);
        this.syncMessage.set("");
      }, 3000);
    });

    this.errorSubscription = this.wsClient.receiveMessages<any>(MessageType.ERROR).subscribe(data => {
      this.logger.error("Sync error:", data);
      this.syncError = data.message || "Unknown error occurred";
      this.syncingMode = null;
      this.syncProgress.set(0);
      this.syncMessage.set("");
    });
  }

  async loadSyncStatus() {
    try {
      const response = await this.http.get<WalksManagerSyncStatusResponse>("/api/database/walks/sync/status").toPromise();
      this.lastSyncedAt = response.lastSyncedAt;
      this.logger.info("Last sync timestamp:", this.lastSyncedAt);
    } catch (error) {
      this.logger.error("Failed to load sync status:", error);
    }
  }

  triggerSync(fullSync: boolean) {
    this.syncingMode = fullSync ? "full" : "incremental";
    this.syncStats = null;
    this.syncError = null;
    this.syncProgress.set(0);
    this.syncMessage.set("");

    this.logger.info("Triggering sync via WebSocket, fullSync:", fullSync);
    this.wsClient.sendMessage(EventType.WALKS_MANAGER_SYNC, { fullSync });
  }
}
