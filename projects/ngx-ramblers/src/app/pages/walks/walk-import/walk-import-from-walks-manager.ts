import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { faRemove } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance } from "../../../services/notifier.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalksImportService } from "../../../services/walks/walks-import.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { IconService } from "../../../services/icon-service/icon-service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FileUploadModule } from "ng2-file-upload";
import { Subscription } from "rxjs";
import { FormsModule } from "@angular/forms";
import { SystemConfig } from "../../../models/system.model";
import { ImportData, ImportStage } from "../../../models/walk.model";
import { InputSource } from "../../../models/group-event.model";

@Component({
  selector: "app-walk-import-from-walks-manager",
  template: `
    <div class="row">
      <div class="col-sm-12 d-inline-flex align-items-center flex-wrap">
        @if (importData.importStage === ImportStage.NONE) {
          <input type="submit"
                 value="Collect Walks From Walks Manager"
                 (click)="collectAvailableWalks()"
                 [disabled]="importData.importStage !== ImportStage.NONE"
                 class="btn btn-primary me-2">
        }
        <ng-content/>
      </div>
    </div>`,
  imports: [FontAwesomeModule, FileUploadModule, FormsModule]
})

export class WalkImportFromWalksManager implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkImportComponent", NgxLoggerLevel.ERROR);
  protected icons = inject(IconService);
  private systemConfigService = inject(SystemConfigService);
  display = inject(WalkDisplayService);
  private walksImportService = inject(WalksImportService);
  private stringUtilsService = inject(StringUtilsService);
  faRemove = faRemove;
  private subscriptions: Subscription[] = [];
  protected hasFileOver: boolean;
  protected systemConfig: SystemConfig;
  @Input() protected notify: AlertInstance;
  @Input() protected importData: ImportData;
  @Output() postImportPreparation: EventEmitter<ImportData> = new EventEmitter();

  protected readonly ImportStage = ImportStage;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.subscriptions.push(this.systemConfigService.events().subscribe(async systemConfig => {
      this.systemConfig = systemConfig;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async collectAvailableWalks() {
    this.importData.messages = [];
    this.importData.importStage = ImportStage.IMPORTING;

    this.notify.warning({
      title: "Walks Import Initialisation",
      message: `Gathering walks and member date for matching`
    });
    const importData: ImportData = await this.walksImportService.prepareImport(this.importData);
    this.postImportPreparation.emit(importData);
  }

  reset() {
    this.importData = this.walksImportService.importDataDefaults(InputSource.WALKS_MANAGER_CACHE);
    this.notify.hide();
  }

}
