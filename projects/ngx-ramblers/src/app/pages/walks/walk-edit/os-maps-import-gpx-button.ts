import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FileNameData } from "../../../models/aws-object.model";
import { isOsMapsRouteUrl, OsMapsExportJobStatus } from "../../../models/os-maps-export.model";
import { DisplayedWalk, LinkSource } from "../../../models/walk.model";
import { AlertInstance } from "../../../services/notifier.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { LinksService } from "../../../services/links.service";
import { OsMapsExportService } from "../../../services/maps/os-maps-export.service";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { OsMapsLoginRequiredAlertComponent } from "./os-maps-login-required-alert";
import { SerenityJobAuditPanelComponent } from "../walk-admin/serenity-job-audit-panel";

@Component({
  selector: "app-os-maps-import-gpx-button",
  imports: [OsMapsLoginRequiredAlertComponent, SerenityJobAuditPanelComponent],
  host: {
    style: "display: contents"
  },
  template: `
    @if (canImport()) {
      @if (loginConfigured) {
        <button type="button"
                class="btn btn-primary"
                [disabled]="inputDisabled || busy"
                (click)="importFromOsMaps()">
          @if (busy) {
            <span class="spinner-border spinner-border-sm me-2"></span>
          }
          {{ busy ? "Importing from OS Maps…" : "Import from OS Maps" }}
        </button>
      } @else {
        <app-os-maps-login-required-alert class="w-100"/>
      }
    }
    @if (busy || jobFileName) {
      <div class="w-100 mt-2">
        <app-serenity-job-audit-panel [fileName]="jobFileName"/>
      </div>
    }
  `
})
export class OsMapsImportGpxButtonComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("OsMapsImportGpxButtonComponent", NgxLoggerLevel.ERROR);
  private linksService = inject(LinksService);
  private osMapsExportService = inject(OsMapsExportService);
  private broadcastService = inject<BroadcastService<unknown>>(BroadcastService);
  private systemConfigService = inject(SystemConfigService);
  private subscriptions: Subscription[] = [];
  private active = {value: true};
  public busy = false;
  public inputDisabled = false;
  public loginConfigured = false;
  public jobFileName: string | null = null;

  @Input() displayedWalk!: DisplayedWalk;
  @Input() notify!: AlertInstance;
  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }
  @Output() imported = new EventEmitter<FileNameData>();

  ngOnInit(): void {
    this.loginConfigured = this.systemConfigService.osMapsLoginConfigured();
    this.subscriptions.push(this.systemConfigService.events().subscribe(() => {
      this.loginConfigured = this.systemConfigService.osMapsLoginConfigured();
    }));
  }

  ngOnDestroy(): void {
    this.active.value = false;
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  canImport(): boolean {
    return isOsMapsRouteUrl(this.osMapsHref()) && !this.displayedWalk?.walk?.fields?.gpxFile?.awsFileName;
  }

  async importFromOsMaps(): Promise<void> {
    const href = this.osMapsHref();
    if (href && !this.busy && !this.inputDisabled && this.loginConfigured) {
      this.busy = true;
      this.notify.progress({
        title: "OS Maps import",
        message: "Starting import…"
      });
      try {
        const started = await this.osMapsExportService.exportRoutes([href], this.displayedWalk?.walk?.id);
        this.jobFileName = started.fileName || this.jobFileName;
        const result = await this.osMapsExportService.waitForExport(started.jobId, () => this.active.value);
        const gpxFile = result.gpxFiles?.[0];
        if (!this.active.value) {
          this.logger.info("import abandoned after navigate away");
        } else if (result.status === OsMapsExportJobStatus.COMPLETED && gpxFile) {
          if (!this.displayedWalk.walk.fields) {
            this.displayedWalk.walk.fields = {} as typeof this.displayedWalk.walk.fields;
          }
          this.displayedWalk.walk.fields.gpxFile = gpxFile;
          this.displayedWalk.walk.fields = {...this.displayedWalk.walk.fields};
          this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_CHANGED, this.displayedWalk.walk));
          this.imported.emit(gpxFile);
          this.notify.success({
            title: "GPX imported",
            message: this.displayedWalk?.walk?.id
              ? "The OS Maps route has been imported and attached to this walk."
              : "The OS Maps route has been imported. Save the walk to keep it."
          });
        } else if (result.status === OsMapsExportJobStatus.FAILED) {
          this.notify.error({
            title: "OS Maps import failed",
            message: result.error || "Could not export this OS Maps route"
          });
        } else {
          this.notify.warning({
            title: "OS Maps import still running",
            message: "The import is taking longer than expected. Check back shortly, or try again."
          });
        }
      } catch (error) {
        this.logger.error("importFromOsMaps failed:", error);
        this.notify.error({
          title: "OS Maps import failed",
          message: this.failureMessage(error)
        });
      }
      this.busy = false;
    }
  }

  private osMapsHref(): string {
    const link = this.linksService.linkWithSourceFrom(this.displayedWalk?.walk?.fields, LinkSource.OS_MAPS);
    return link?.href || "";
  }

  private failureMessage(error: unknown): string {
    const asHttp = error as {error?: {error?: string}; message?: string};
    if (asHttp.error?.error) {
      return asHttp.error.error;
    } else {
      return asHttp.message || "Failed to import the OS Maps route";
    }
  }
}
