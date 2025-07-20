import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { WalkDisplayService } from "../walk-display.service";
import { WalksImportService } from "../../../services/walks/walks-import.service";
import { BulkLoadMemberAndMatchToWalk } from "../../../models/member.model";
import { IconService } from "../../../services/icon-service/icon-service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ServerFileNameData } from "../../../models/aws-object.model";
import { FileUploadModule } from "ng2-file-upload";
import { Subscription } from "rxjs";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import first from "lodash-es/first";
import { ExtendedGroupEvent, HasGroupCodeAndName } from "../../../models/group-event.model";
import { GroupSelector } from "../walk-edit/group-selector";
import { RamblersGroupsApiResponse } from "../../../models/ramblers-walks-manager";
import { ImportData, ImportStage, ImportType, ImportTypeOptions } from "../../../models/walk.model";
import { SystemConfig } from "../../../models/system.model";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { AlertInstance } from "../../../services/notifier.service";

@Component({
  selector: "app-walk-import-from-file",
  template: `
    <div class="row mb-2">
      <div class="col-sm-12">
        <div (click)="selectGroupSelection(ImportType.EXISTING_GROUP)"
             class="custom-control custom-radio custom-control-inline d-flex align-items-center">
          <input class="custom-control-input"
                 id="area-selection-mode"
                 name="group-selection"
                 type="radio"
                 [value]="ImportType.EXISTING_GROUP"
                 [disabled]="importData.importStage !== ImportStage.NONE"
                 [(ngModel)]="importTypeOptions.importType"/>
          <label class="custom-control-label mr-3  text-nowrap"
                 for="area-selection-mode">Import to Existing Group</label>
          <app-group-selector class="flex-grow-1" [disabled]="importTypeOptions.importType===ImportType.UNLISTED_GROUP"
                              [areaCode]="systemConfig.area.groupCode"
                              [groupCode]="importTypeOptions.existingGroupCodeAndName.group_code"
                              (groupChanged)="groupChange($event)"/>
        </div>
      </div>
    </div>
    <div class="row mb-2">
      <div class="col-sm-12">
        <div (click)="selectGroupSelection(ImportType.UNLISTED_GROUP)"
             class="custom-control custom-radio custom-control-inline d-flex flex-grow-1 align-items-center">
          <input class="custom-control-input"
                 id="group-selection-mode"
                 name="group-selection"
                 type="radio"
                 [value]="ImportType.UNLISTED_GROUP"
                 [disabled]="importData.importStage !== ImportStage.NONE"
                 [(ngModel)]="importTypeOptions.importType"/>
          <label class="custom-control-label mr-3 text-nowrap" for="unlisted-group-name">
            Import to Unlisted Group Name</label>
          <input [disabled]="importData.importStage !== ImportStage.NONE ||importTypeOptions.importType === ImportType.EXISTING_GROUP"
                 type="text"
                 [(ngModel)]="importTypeOptions.unlistedGroupCodeAndName.group_name"
                 id="unlisted-group-name"
                 class="form-control ml-2">
          <label class="mx-3 text-nowrap " for="unlisted-group-code">Group Code</label>
          <input [disabled]="importData.importStage !== ImportStage.NONE||importTypeOptions.importType === ImportType.EXISTING_GROUP"
                 type="text"
                 [(ngModel)]="importTypeOptions.unlistedGroupCodeAndName.group_code"
                 (ngModelChange)="onGroupCodeChange($event)"
                 maxlength="4"
                 id="unlisted-group-code"
                 class="form-control">
        </div>
      </div>
    </div>
    <div class="row mb-2">
      <div class="col-sm-12 form-inline">
        <input #fileElement class="d-none" type="file" ng2FileSelect (onFileSelected)="onFileDropped($event)">
        <input type="submit" [disabled]="!importReady()" value="Choose File"
               class="btn btn-primary mr-2"
               (click)="browseToFile(fileElement)">
        <ng-content/>
      </div>
      @if (importReady()) {
        <div class="col-sm-12">
          <div ng2FileDrop [ngClass]="{'file-over': hasFileOver}"
               (fileOver)="fileOver($event)"
               (onFileDrop)="onFileDropped($event)"
               class="badge-drop-zone mt-2">Or drop file here
          </div>
        </div>
      }
    </div>`,
  styles: `
  `,
  imports: [FontAwesomeModule, FileUploadModule, FormsModule, NgClass, GroupSelector]
})

export class WalkImportFromFile implements OnInit, OnDestroy {
  @Input("importData") set importDataValue(importData: ImportData) {
    this.importData = importData;
    this.logger.info("importData received:", importData);
    this.initialiseImportData();
  }

  private logger: Logger = inject(LoggerFactory).createLogger("WalkImportFromFile", NgxLoggerLevel.ERROR);
  protected icons = inject(IconService);
  private systemConfigService = inject(SystemConfigService);
  protected display = inject(WalkDisplayService);
  private walksImportService = inject(WalksImportService);
  public fileName: string;
  public messages: string[] = [];
  private subscriptions: Subscription[] = [];
  private fileNameData: ServerFileNameData;
  protected hasFileOver: boolean;
  protected systemConfig: SystemConfig;
  protected importTypeOptions: ImportTypeOptions;
  protected importData: ImportData;
  @Input() protected notify: AlertInstance;

  @Output() postImportPreparation: EventEmitter<ImportData> = new EventEmitter();

  protected readonly ImportType = ImportType;

  protected readonly ImportStage = ImportStage;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.subscriptions.push(this.systemConfigService.events().subscribe(async systemConfig => {
      this.systemConfig = systemConfig;
      this.initialiseImportData();
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onGroupCodeChange(value: string) {
    const groupCode = value.toUpperCase().slice(0, 4);
    this.logger.info("onGroupCodeChange: value:", value, "groupCode:", groupCode);
    this.importTypeOptions.unlistedGroupCodeAndName.group_code = groupCode;
  }

  public fileOver(e: any): void {
    this.hasFileOver = e;
  }

  browseToFile(fileElement: HTMLInputElement) {
    fileElement.click();
  }

  async onFileDropped(fileList: File[]) {
    const firstFile: File = first(fileList);
    this.importData.importStage = ImportStage.IMPORTING;
    this.logger.info("filesDropped:", fileList, "firstFile:", firstFile);
    this.notify.setBusy();
    this.notify.progress({title: "Walks Import Initialisation", message: `importing file ${firstFile.name}...`});
    this.messages = [];
    this.importData.fileImportRows = await this.walksImportService.importWalksFromFile(firstFile, this.fileNameData);
    this.logger.info("importData.importData:", this.importData);
    const extendedGroupEvents: ExtendedGroupEvent[] = this.importData.fileImportRows.map(row => this.walksImportService.csvRowToExtendedGroupEvent(row, this.importData.groupCodeAndName));
    const importData: ImportData = await this.walksImportService.prepareImportOfEvents(this.importData, extendedGroupEvents);
    if (this.readyToImport(importData)) {
      this.postImportPreparation.emit(importData);
    }
  }

  initialiseImportData() {
    this.importTypeOptions = {
      existingGroupCodeAndName: this.importData.groupCodeAndName,
      unlistedGroupCodeAndName: {group_code: null, group_name: null},
      importType: ImportType.EXISTING_GROUP
    };
  }

  summary(bulkLoadMemberAndMatchToWalks: BulkLoadMemberAndMatchToWalk[]): number {
    return bulkLoadMemberAndMatchToWalks?.length;
  }

  private readyToImport(importData: ImportData) {
    this.logger.info("importData:", importData);
    return true;
  }

  groupChange($event: RamblersGroupsApiResponse) {
    this.importTypeOptions.existingGroupCodeAndName.group_code = $event.group_code;
    this.logger.info("groupChange:", $event);
  }

  selectGroupSelection(importType: ImportType) {
    this.importTypeOptions.importType = importType;
    const groupCodeAndName: HasGroupCodeAndName = this.importTypeOptions.importType === ImportType.UNLISTED_GROUP ? this.importTypeOptions.unlistedGroupCodeAndName : this.importTypeOptions.existingGroupCodeAndName;
    this.importData.groupCodeAndName = groupCodeAndName;
    this.logger.info("importType:", importType, "this.importData:", this.importData, "groupCodeAndName:", groupCodeAndName);
  }

  importReady() {
    return this?.importData?.importStage === ImportStage.NONE && !this.notify.alertTarget.busy && this.importData.groupCodeAndName?.group_name && this.importData.groupCodeAndName?.group_code;
  }
}
