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

@Component({
  selector: "app-walk-import-from-walks-manager",
  template: `
    <div class="row">
      <div class="col-sm-12 form-inline">
        @if (importData.importStage === ImportStage.NONE) {
          <input type="submit"
                 value="Collect Walks From Walks Manager"
                 (click)="collectAvailableWalks()"
                 [disabled]="importData.importStage !== ImportStage.NONE"
                 class="btn btn-primary">
        }
        @if (importData.importStage === ImportStage.MATCHING_COMPLETE) {
          <input type="submit"
                 value="Import And Save Walks Locally"
                 (click)="saveImportedWalks()"
                 [disabled]="importData.importStage === ImportStage.MATCHING_COMPLETE" class="btn btn-primary">
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
    this.importData = this.walksImportService.importDataDefaults();
    this.notify.hide();
  }

  async saveImportedWalks() {
    this.importData.messages = [];
    this.importData.importStage = ImportStage.SAVING;
    this.notify.warning({
      title: "Walks Import Starting",
      message: `Importing ${this.stringUtilsService.pluraliseWithCount(this.importData?.bulkLoadMembersAndMatchesToWalks?.length, "walk")}`
    });

    this.walksImportService.saveImportedWalks(this.importData, this.notify)
      .then(() => {
        if (this.importData?.errorMessages?.length > 0) {
          this.notify.warning({
            title: "Walks Import Complete",
            message: `Imported completed with ${this.stringUtilsService.pluraliseWithCount(this.importData?.errorMessages?.length, "error")}. If you are happy with number of walks imported, Walk population should now be changed to Local in system settings.`
          });

        } else {
          this.notify.success({
            title: "Walks Import Complete",
            message: `Imported completed successfully. Walk population should now be changed to Local in system settings.`
          });
        }
      })
      .catch(error => this.notify.error({
        title: "Walks Import Failed",
        message: error
      }))
      .finally(() => this.importData.importStage = ImportStage.NONE);
  }
}
