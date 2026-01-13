import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faRemove } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalksImportService } from "../../../services/walks/walks-import.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { IconService } from "../../../services/icon-service/icon-service";
import { PageComponent } from "../../../page/page.component";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FileUploadModule } from "ng2-file-upload";
import { Subscription } from "rxjs";
import { FormsModule } from "@angular/forms";
import { NgClass, NgStyle, NgTemplateOutlet, TitleCasePipe } from "@angular/common";
import { SystemConfig } from "../../../models/system.model";
import { WalkImportFromFile } from "./walk-import-from-file";
import { GroupEventField, ImportData, ImportStage, WalkImportField } from "../../../models/walk.model";
import { WalkImportFromWalksManager } from "./walk-import-from-walks-manager";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { StatusIconComponent } from "../../admin/status-icon";
import { FullNamePipe } from "../../../pipes/full-name.pipe";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { StepperModule } from "primeng/stepper";
import { BulkLoadMemberAndMatchToWalk, MemberAction, MemberWithLabel } from "../../../models/member.model";
import { MemberService } from "../../../services/member/member.service";
import { sortBy } from "../../../functions/arrays";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { HumanisePipe } from "../../../pipes/humanise.pipe";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { InputSource } from "../../../models/group-event.model";
import { ImportStepperKey, ImportStepperStep } from "../../../models/import-stepper.model";
import { WalkImportFilterMatch, WalkImportStepStatus } from "../../../models/walk-import.model";
import { FileSizeSelectorComponent } from "../../../carousel/edit/file-size-selector/file-size-selector";
import { first } from "es-toolkit/compat";

@Component({
  selector: "app-walk-import",
  template: `
    <ng-template #backAndResetButtons>
      @if (importData.importStage === ImportStage.MATCHING) {
        <input type="submit"
               value="Save Imported Walks"
               (click)="saveImportedWalks()"
               [disabled]="saveWalksDisabled()" class="btn btn-primary me-2">
      }
      <input type="submit"
             value="Reset"
             (click)="reset()"
             [disabled]="resetDisabled()"
             class="btn btn-secondary">
      @if (importData.importStage === ImportStage.NONE) {
        <input type="submit" value="Back"
               (click)="navigateBackToAdmin()"
               title="Back to walks"
               class="ms-2 btn btn-secondary">
      }</ng-template>
    <app-page pageTitle="Walks Import">
      <div class="row mb-3">
        <div class="col-sm-12">
          <p-stepper [(value)]="stepperActiveIndex" [linear]="false">
            @for (step of stepperStepsList; let idx = $index; track step.key) {
              <p-step-item [value]="idx">
                <p-step [disabled]="navigationLocked() || !canAccessStep(step.key)">
                  <div class="walk-step-header">
                    <span class="walk-step-number">{{ idx + 1 }}</span>
                    <div class="walk-step-text">
                      <div class="walk-step-label">{{ step.label }}</div>
                      <div class="walk-step-hint">{{ stepHint(step.key) }}</div>
                      @if (step.key === ImportStepperKey.IMAGES && hasImagesData()) {
                        <span class="walk-step-chip">{{ imagesSummary() }}</span>
                      }
                    </div>
                  </div>
                </p-step>
                <p-step-panel>
                  <ng-template pTemplate="content">
                    @if (step.key === ImportStepperKey.UPLOAD) {
                      <div>
                          <div class="row mb-3">
                            <div class="col-md-12">
                              <label class="me-2">Import Type:</label>
                              <div class="form-check form-check-inline">
                                <input class="form-check-input"
                                       id="import-source-walks-manager"
                                       name="import-source"
                                       type="radio"
                                       [value]="ImportSource.WALKS_MANAGER_CACHE"
                                       (ngModelChange)="reset()"
                                       [disabled]="importData.importStage !== ImportStage.NONE"
                                       [(ngModel)]="importData.inputSource"/>
                                <label class="form-check-label" for="import-source-walks-manager">From Walks Manager (Group
                                  Code {{ systemConfig?.group?.groupCode }})</label>
                              </div>
                              <div class="form-check form-check-inline">
                                <input class="form-check-input"
                                       id="import-source-file"
                                       name="import-source"
                                       type="radio"
                                       [value]="ImportSource.FILE_IMPORT"
                                       (ngModelChange)="reset()"
                                       [disabled]="importData.importStage !== ImportStage.NONE"
                                       [(ngModel)]="importData.inputSource"/>
                                <label class="form-check-label" for="import-source-file">From CSV Import File</label>
                              </div>
                            </div>
                          </div>
                          <div class="row">
                            <div class="col-sm-12 mb-3 mx-2">
                              @if (importData.inputSource === ImportSource.WALKS_MANAGER_CACHE) {
                                <app-markdown-editor standalone name="ramblers-import-help-page" description="Ramblers import help page"/>
                              } @else {
                                <app-markdown-editor standalone name="file-import-help-page" description="File import help page"/>
                              }
                            </div>
                          </div>
                          @if (importData.inputSource === ImportSource.WALKS_MANAGER_CACHE) {
                            <app-walk-import-from-walks-manager [importData]="importData" [notify]="notify"
                                                                (postImportPreparation)="postImportPreparation($event)">
                              <ng-container *ngTemplateOutlet="backAndResetButtons"/>
                            </app-walk-import-from-walks-manager>
                          } @else if (importData.inputSource === ImportSource.FILE_IMPORT) {
                            <app-walk-import-from-file [importData]="importData" [notify]="notify"
                                                       (postImportPreparation)="postImportPreparation($event)">
                              <ng-container *ngTemplateOutlet="backAndResetButtons"/>
                            </app-walk-import-from-file>
                          }
                          <div class="stepper-nav">
                            <button type="button" class="btn btn-secondary" (click)="navigateBackToAdmin()" [disabled]="navigationLocked()">Back</button>
                            <button type="button" class="btn btn-primary" (click)="goToStep(1)" [disabled]="navigationLocked() || !canAccessStep(ImportStepperKey.MATCH)">Next</button>
                          </div>
                      </div>
                    } @else if (step.key === ImportStepperKey.MATCH) {
                      @if (importData.importStage == ImportStage.MATCHING || importData.importStage == ImportStage.MATCHING_COMPLETE) {
                        <div>
                            <div class="row mb-2 align-items-center">
                              <div class="col-auto"><label class="me-2">Filter To Show</label>
                                <div class="form-check form-check-inline">
                                  <input class="form-check-input"
                                         type="radio"
                                         id="filter-all"
                                         name="filterMatched"
                                         [ngValue]="WalkImportFilterMatch.ALL"
                                         [(ngModel)]="filterMatched">
                                  <label class="form-check-label" for="filter-all">All</label>
                                </div>
                                <div class="form-check form-check-inline">
                                  <input class="form-check-input"
                                         type="radio"
                                         id="filter-matched"
                                         name="filterMatched"
                                         [ngValue]="WalkImportFilterMatch.MATCHED"
                                         [(ngModel)]="filterMatched">
                                  <label class="form-check-label" for="filter-matched">Matched to a member</label>
                                </div>
                                <div class="form-check form-check-inline">
                                  <input class="form-check-input"
                                         type="radio"
                                         id="filter-unmatched"
                                         name="filterMatched"
                                         [ngValue]="WalkImportFilterMatch.UNMATCHED"
                                         [(ngModel)]="filterMatched">
                                  <label class="form-check-label" for="filter-unmatched">Not matched to a member</label>
                                </div>
                                <div class="form-check form-check-inline">
                                  <input class="form-check-input"
                                         type="radio"
                                         id="filter-excluded"
                                         name="filterMatched"
                                         [ngValue]="WalkImportFilterMatch.EXCLUDED"
                                         [(ngModel)]="filterMatched">
                                  <label class="form-check-label" for="filter-excluded">Excluded (e.g. duplicates)</label>
                                </div>
                              </div>
                            </div>
                            <div class="row">
                              <div class="col-sm-12">
                                <h3>Matching of Walk Leaders to Members</h3>
                                <div class="alert alert-warning py-1">
                                  <fa-icon [icon]="alertTarget.alert.icon"/>
                                  <strong class="ms-2">Walk Leader Matching: </strong>{{ matchedWalks }} out
                                  of {{ stringUtilsService.pluraliseWithCount(totalWalks, "walk") }}
                                  have been matched to members{{ EM_DASH_WITH_SPACES }}
                                  showing {{ filterMatched }} {{ stringUtilsService.pluraliseWithCount(sortedAndFilteredRows.length, "walk") }}
                                </div>
                                <div class="audit-table-scroll">
                                  <table class="styled-table table-striped table-hover table-sm table-pointer">
                                    <thead>
                                    <tr>
                                      @for (walkImportField of walkImportFields; track walkImportField.value) {
                                        <th (click)="sortBy(walkImportField.value)">
                                          {{ walkImportField.key | humanise | titlecase }}
                                          @if (sortField === walkImportField.value) {
                                            <span class="sorting-header">{{ sortDirection }}</span>
                                          }
                                        </th>
                                      }
                                    </tr>
                                    </thead>
                                    <tbody>
                                      @for (bulkLoadMemberAndMatch of sortedAndFilteredRows; let index = $index; track index) {
                                        <tr>
                                          <td>
                                            <div class="form-check">
                                              <input [(ngModel)]="bulkLoadMemberAndMatch.include"
                                                     [ngModelOptions]="{standalone: true}"
                                                     (ngModelChange)="onIncludeChange(bulkLoadMemberAndMatch)"
                                                     type="checkbox" class="form-check-input"
                                                     id="toggle-exclude-{{index}}">
                                              <label class="form-check-label" for="toggle-exclude-{{index}}">
                                              </label>
                                            </div>
                                          </td>
                                          <td class="nowrap">{{ bulkLoadMemberAndMatch.event.groupEvent.start_date_time | displayDate }}
                                          </td>
                                          <td>{{ bulkLoadMemberAndMatch.event.groupEvent.title }}</td>
                                          <td>{{ bulkLoadMemberAndMatch.event.groupEvent.walk_leader.name || "Not supplied" }}</td>
                                          <td>
                                            <app-status-icon noLabel
                                                             [status]="bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.memberMatch"/>
                                          </td>
                                          <td>
                                            <ng-select
                                              [items]="membersWithLabel"
                                              bindLabel="ngSelectAttributes.label"
                                              [searchable]="true"
                                              [clearable]="true"
                                              dropdownPosition="bottom"
                                              placeholder="Select member"
                                              [(ngModel)]="bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.member"
                                              [ngModelOptions]="{standalone: true}"
                                              (ngModelChange)="memberChange(bulkLoadMemberAndMatch)">
                                              <ng-template ng-label-tmp let-item="item">
                                                {{ item | fullName }}
                                              </ng-template>
                                              <ng-template ng-option-tmp let-item="item">
                                                {{ item | fullName }}
                                              </ng-template>
                                            </ng-select>
                                            @if (shouldShowApplyButton(bulkLoadMemberAndMatch)) {
                                              <button type="button" class="btn btn-sm btn-primary mt-2"
                                                      (click)="applyMemberToOtherWalks(bulkLoadMemberAndMatch)">
                                                {{ applyCaption(bulkLoadMemberAndMatch) }}
                                              </button>
                                            }
                                          </td>
                                        </tr>
                                      }
                                    </tbody>
                                  </table>
                                </div>
                              <div class="stepper-nav">
                                  <button type="button" class="btn btn-secondary" (click)="goToStep(0)" [disabled]="navigationLocked()">Back</button>
                                  <button type="button" class="btn btn-primary" (click)="goToStep(2)" [disabled]="navigationLocked() || !canAccessStep(ImportStepperKey.IMAGES)">Next</button>
                                </div>
                              </div>
                            </div>
                        </div>
                      }
                    } @else if (step.key === ImportStepperKey.IMAGES) {
                      <div>
                        @if (importData.inputSource === ImportSource.FILE_IMPORT) {
                          <div class="row mb-3">
                            <div class="col-sm-12">
                              <app-file-size-selector label="Auto-resize Images To Maximum Size"
                                                      [fileSize]="importData.maxImageSize"
                                                      (fileSizeChanged)="importData.maxImageSize=$event"/>
                            </div>
                          </div>
                          <div class="row mb-2">
                            <div class="col-sm-12 d-inline-flex align-items-center flex-wrap">
                              <input #imagesCsvElement class="d-none" type="file" accept=".csv"
                                     ng2FileSelect (onFileSelected)="onImagesCsvSelected($event)">
                              <input type="submit" value="Choose Images CSV"
                                     class="btn btn-primary me-2"
                                     (click)="browseToFile(imagesCsvElement)">
                              <input #imagesFilesElement class="d-none" type="file" accept="image/*" multiple
                                     ng2FileSelect (onFileSelected)="onImageFilesSelected($event)">
                              <input type="submit" value="Choose Image Files"
                                     class="btn btn-primary me-2"
                                     (click)="browseToFile(imagesFilesElement)">
                            </div>
                            <div class="col-sm-12">
                              <div ng2FileDrop [ngClass]="{'file-over': hasImageFileOver}"
                                   (fileOver)="imageFileOver($event)"
                                   (onFileDrop)="onImageFilesDropped($event)"
                                   class="badge-drop-zone mt-2">Or drop image files here
                              </div>
                            </div>
                          </div>
                          <div class="stepper-nav">
                            <button type="button" class="btn btn-secondary" (click)="goToStep(1)" [disabled]="navigationLocked()">Back</button>
                            <button type="button" class="btn btn-primary" (click)="goToStep(3)"
                                    [disabled]="navigationLocked() || !canAccessStep(ImportStepperKey.IMPORT)">Next
                            </button>
                          </div>
                        } @else {
                          <div class="text-muted">Image upload is available for CSV imports.</div>
                        }
                      </div>
                    } @else if (step.key === ImportStepperKey.IMPORT) {
                      <div>
                        @if (importData.importStage === ImportStage.MATCHING) {
                          <div class="stepper-nav justify-content-start">
                            <input type="submit"
                                   value="Save Imported Walks"
                                   (click)="saveImportedWalks()"
                                   [disabled]="saveWalksDisabled() || navigationLocked()" class="btn btn-primary">
                            <input type="submit"
                                   value="Reset"
                                   (click)="reset()"
                                   [disabled]="resetDisabled()"
                                   class="btn btn-secondary">
                          </div>
                        }
                        @if (importData.imageUploadProgress > 0) {
                          <div class="row mb-2">
                            <div class="col-sm-12">
                              <div class="progress">
                                <div class="progress-bar" role="progressbar"
                                     [ngStyle]="{ 'width': importData.imageUploadProgress + '%' }">
                                  {{ importData.imageUploadProgress }}%
                                </div>
                              </div>
                            </div>
                          </div>
                        }
                        <div class="form-group"
                             [ngClass]="{'mt-2': importData.importStage !== ImportStage.NONE|| importData?.bulkLoadMembersAndMatchesToWalks?.length > 0}">
                          @if (alertTarget.showAlert) {
                            <div class="alert {{alertTarget.alertClass}}">
                              <fa-icon [icon]="alertTarget.alert.icon"></fa-icon>
                              @if (alertTarget.alertTitle) {
                                <strong>
                                  {{ alertTarget.alertTitle }}: </strong>
                              } {{ alertTarget.alertMessage }}
                            </div>
                          }
                        </div>
                        @if (importData.messages.length > 0) {
                          <div class="row">
                            @if (!importData.importStage) {
                              <div class="col-sm-12 mb-2">
                                <h3>Summary Import Information</h3>
                              </div>
                            }
                            @for (message of importData.messages; track message) {
                              <div class="col-sm-4">
                                <ul class="list-arrow">
                                  <li>{{ message }}</li>
                                </ul>
                              </div>
                            }
                          </div>
                        }
                        <div class="stepper-nav">
                          @if (importData.importStage !== ImportStage.MATCHING) {
                            <button type="button" class="btn btn-secondary" (click)="goToStep(2)" [disabled]="navigationLocked()">Back</button>
                          }
                          <button type="button" class="btn btn-secondary" (click)="navigateBackToAdmin()" [disabled]="navigationLocked()">Back to walks</button>
                        </div>
                      </div>
                    }
                  </ng-template>
                </p-step-panel>
              </p-step-item>
            }
          </p-stepper>
        </div>
      </div>
    </app-page>`,
  styleUrls: ["./walk-import.sass"],
  imports: [PageComponent, MarkdownEditorComponent, FontAwesomeModule, FileUploadModule, FormsModule, NgTemplateOutlet, WalkImportFromFile, WalkImportFromWalksManager, DisplayDatePipe, StatusIconComponent, FullNamePipe, NgSelectComponent, NgLabelTemplateDirective, NgOptionTemplateDirective, HumanisePipe, TitleCasePipe, NgClass, StepperModule, FileSizeSelectorComponent, NgStyle]
})

export class WalkImport implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("WalkImport", NgxLoggerLevel.ERROR);
  public get totalWalks(): number {
    return this.importData.bulkLoadMembersAndMatchesToWalks?.length || 0;
  }

  public get matchedWalks(): number {
    return this.importData.bulkLoadMembersAndMatchesToWalks?.filter(row => !!row.bulkLoadMemberAndMatch.member)?.length || 0;
  }

  public get sortedAndFilteredRows(): BulkLoadMemberAndMatchToWalk[] {
    const rows = this.importData.bulkLoadMembersAndMatchesToWalks.filter(row => {
      if (row === this.lastUpdatedRow) {
        return true;
      } else if (this.filterMatched === WalkImportFilterMatch.MATCHED) {
        return !!row.bulkLoadMemberAndMatch.member;
      } else if (this.filterMatched === WalkImportFilterMatch.UNMATCHED) {
        return !row.bulkLoadMemberAndMatch.member;
      } else if (this.filterMatched === WalkImportFilterMatch.EXCLUDED) {
        return !row.include;
      } else {
        return true;
      }
    });
    const sortColumns = [this.sortedFieldCalled(this.sortField), this.sortedFieldCalled(WalkImportField.EVENT_WALK_LEADER)];
    this.logger.off("sortedAndFilteredRows: sorting by:", sortColumns, "rows:", rows);
    return rows.sort(sortBy(...sortColumns));
  }

  private notifierService = inject(NotifierService);
  protected icons = inject(IconService);
  private systemConfigService = inject(SystemConfigService);
  display = inject(WalkDisplayService);
  memberService = inject(MemberService);
  protected walksImportService = inject(WalksImportService);
  private urlService = inject(UrlService);
  protected stringUtilsService = inject(StringUtilsService);
  private fullNamePipe = inject(FullNamePipe);
  protected alertTarget: AlertTarget = {};
  protected notify: AlertInstance;
  faRemove = faRemove;
  private subscriptions: Subscription[] = [];
  protected hasFileOver: boolean;
  protected systemConfig: SystemConfig;
  protected importData: ImportData = this.walksImportService.importDataDefaults(InputSource.FILE_IMPORT);
  protected membersWithLabel: MemberWithLabel[] = [];
  protected stepperActiveIndex = 0;
  public lastUpdatedRow: BulkLoadMemberAndMatchToWalk = null;
  public sortField = "start_date_time";
  public sortDirection = ASCENDING;
  public filterMatched: WalkImportFilterMatch = WalkImportFilterMatch.ALL;
  walkImportFields: KeyValue<string>[] = enumKeyValues(WalkImportField);
  protected readonly GroupEventField = GroupEventField;
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;
  protected readonly ImportStage = ImportStage;
  protected readonly ImportSource = InputSource;
  protected stepperStepsList: ImportStepperStep[] = [
    {key: ImportStepperKey.UPLOAD, label: "Upload walks CSV"},
    {key: ImportStepperKey.MATCH, label: "Match Walk Leaders to Members"},
    {key: ImportStepperKey.IMAGES, label: "Add images (CSV + files)"},
    {key: ImportStepperKey.IMPORT, label: "Import & finish"}
  ];

  protected readonly ImportStepperKey = ImportStepperKey;
  protected readonly WalkImportFilterMatch = WalkImportFilterMatch;
  protected hasImageFileOver: boolean;
  protected imageFiles: File[] = [];

  async ngOnInit() {
    this.logger.debug("ngOnInit");
    this.sortBy(WalkImportField.DATE);
    this.notify = this.notifierService.createAlertInstance(this.alertTarget);
    this.subscriptions.push(this.systemConfigService.events().subscribe(async systemConfig => {
      this.systemConfig = systemConfig;
    }));
    const members = await this.memberService.all();
    this.membersWithLabel = members.map(member => ({
      ...member,
      ngSelectAttributes: {label: this.fullNamePipe.transform(member)}
    })).sort(sortBy("ngSelectAttributes.label"));
    this.syncStepperIndex();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  public onIncludeChange(bulkLoadMemberAndMatch: BulkLoadMemberAndMatchToWalk): void {
    this.logger.info("Include changed for walk to", bulkLoadMemberAndMatch.include, "bulkLoadMemberAndMatch:", bulkLoadMemberAndMatch);
  }

  private sortedFieldCalled(sortField: string) {
    return `${this.sortDirection === ASCENDING ? "" : "-"}${sortField}`;
  }

  public shouldShowApplyButton(bulkLoadMemberAndMatch: BulkLoadMemberAndMatchToWalk): boolean {
    if (this.lastUpdatedRow !== bulkLoadMemberAndMatch) {
      return false;
    } else {
      return this.otherMatchingWalkLeaderRows(bulkLoadMemberAndMatch).length > 0;
    }
  }

  applyCaption(bulkLoadMemberAndMatch: BulkLoadMemberAndMatchToWalk) {
    return `Apply to ${this.stringUtilsService.pluraliseWithCount(this.otherMatchingWalkLeaderRows(bulkLoadMemberAndMatch).length, "other walk")} with leader ${bulkLoadMemberAndMatch.event.groupEvent.walk_leader.name || "Not supplied"}`;
  }

  public otherMatchingWalkLeaderRows(bulkLoadMemberAndMatch: BulkLoadMemberAndMatchToWalk): BulkLoadMemberAndMatchToWalk[] {
    const walkLeaderName = bulkLoadMemberAndMatch.event.groupEvent.walk_leader.name.trim().toLowerCase();
    return this.importData.bulkLoadMembersAndMatchesToWalks.filter(row =>
      row.event.groupEvent.walk_leader.name.trim().toLowerCase() === walkLeaderName &&
      !row.bulkLoadMemberAndMatch.member &&
      row !== bulkLoadMemberAndMatch);
  }

  public applyMemberToOtherWalks(bulkLoadMemberAndMatch: BulkLoadMemberAndMatchToWalk): void {
    const selectedMember = bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.member;
    if (!selectedMember) {
      this.logger.info("applyMemberToOtherWalks: No member provided, skipping apply");
    } else {
      const walkLeaderName = bulkLoadMemberAndMatch.event.groupEvent.walk_leader.name;
      this.logger.info("applyMemberToOtherWalks: selectedMember:", selectedMember, "walkLeaderName:", walkLeaderName);
      this.otherMatchingWalkLeaderRows(bulkLoadMemberAndMatch).forEach(row => {
        row.bulkLoadMemberAndMatch.member = selectedMember;
        row.bulkLoadMemberAndMatch.memberMatch = MemberAction.matched;
      });
    }
    this.lastUpdatedRow = null;
  }

  public sortBy(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === DESCENDING ? ASCENDING : DESCENDING;
    }
    this.logger.info("existing sortField:", this.sortField, "new sortBy: field:", field, "sortDirection:", this.sortDirection);
    this.sortField = field;
  }

  postImportPreparation(importData: ImportData) {
    return Promise.resolve(importData).then(data => {
      this.notify.success({
        title: "Walks Import Preparation Complete",
        message: `See the table below to match the imported walk leaders to members in the database`
      });
    })
      .catch(error => this.notify.error({
        title: "Walks Import Initialisation Failed",
        message: error
      }))
      .finally(() => {
        this.importData.importStage = ImportStage.MATCHING;
        this.syncStepperIndex();
      });
  }

  navigateBackToAdmin() {
    this.urlService.navigateTo(["walks", "admin"]);
  }

  reset() {
    this.importData = this.walksImportService.importDataDefaults(InputSource.FILE_IMPORT);
    this.logger.info("resetting importData to:", this.importData);
    this.notify.hide();
    this.syncStepperIndex();
  }

  async saveImportedWalks() {
    this.importData.messages = [];
    this.importData.importStage = ImportStage.SAVING;
    this.syncStepperIndex();
    this.notify.warning({
      title: "Walks Import Starting",
      message: `Importing ${this.stringUtilsService.pluraliseWithCount(this.importData?.bulkLoadMembersAndMatchesToWalks?.length, "walk")}`
    });

    await this.walksImportService.saveImportedWalks(this.importData, this.notify)
      .then(async () => {
        await this.processImagesIfPresent();
        if (this.importData?.errorMessages?.length > 0) {
          this.notify.warning({
            title: "Walks Import Completed With Errors",
            message: `Imported completed with ${this.stringUtilsService.pluraliseWithCount(this.importData?.errorMessages?.length, "error")}`
          });
        } else {
          this.notify.success({
            title: "Walks Import Complete",
            message: "Imported completed successfully"
          });
        }
      })
      .catch(error => this.notify.error({
        title: "Walks Import Failed",
        message: error
      }))
      .finally(() => {
        this.importData.importStage = ImportStage.NONE;
      });
  }

  private async processImagesIfPresent(): Promise<void> {
    if (this.importData.inputSource !== InputSource.FILE_IMPORT) {
      this.logger.info("inputSource", this.importData.inputSource, "not", InputSource.FILE_IMPORT, "skipping image upload");
    } else {
      const imageFiles = this.imageFilesForUpload() || [];
      if (!this.importData.imageImportRows || this.importData.imageImportRows.length === 0) {
        this.logger.info("Images CSV not loaded, skipping image upload");
        this.notify.warning({title: "Image Import", message: "Images CSV not loaded, skipping image upload"});
      } else if (imageFiles.length === 0) {
        this.notify.warning({title: "Image Import", message: "No image files selected, skipping image upload"});
        this.logger.info("No image files selected, skipping image upload");
        return;
      } else {
        await this.walksImportService.processWalkImages(
          this.importData,
          imageFiles,
          this.notify
        );
      }
    }
  }

  browseToFile(fileElement: HTMLInputElement) {
    fileElement.click();
  }

  async onImagesCsvSelected(fileList: File[]) {
    const csvFile: File = first(fileList);
    if (!csvFile) return;

    this.logger.info("Images CSV selected:", csvFile.name);
    this.notify.progress({title: "Images Import", message: `Loading ${csvFile.name}...`});

    try {
      this.importData.imageImportRows = await this.walksImportService.importImagesFromFile(csvFile) as any;
      this.logger.info("Loaded", this.importData.imageImportRows.length, "image records");
      this.notify.success({
        title: "Images Import",
        message: `Loaded ${this.importData.imageImportRows.length} image records`
      });
    } catch (error) {
      this.logger.error("Error loading images CSV:", error);
      this.notify.error({title: "Images Import", message: "Failed to load images CSV"});
    }
  }

  async onImageFilesSelected(fileList: File[]) {
    this.onImageFilesDropped(fileList);
  }

  async onImageFilesDropped(fileList: File[]) {
    if (!fileList || fileList.length === 0) return;

    this.logger.info("Image files selected:", fileList.length);
    this.imageFiles = Array.from(fileList);
    this.notify.success({title: "Images Import", message: `Selected ${fileList.length} image files`});
  }

  imageFilesForUpload(): File[] {
    return this.imageFiles;
  }

  imageFileOver(e: any): void {
    this.hasImageFileOver = e;
  }

  hasImagesData(): boolean {
    return (this.importData?.imageImportRows?.length > 0) || (this.imageFiles?.length > 0);
  }

  imagesSummary(): string {
    const parts: string[] = [];
    if (this.importData?.imageImportRows?.length > 0) {
      parts.push(`${this.importData.imageImportRows.length} CSV rows`);
    }
    if (this.imageFiles?.length > 0) {
      parts.push(`${this.imageFiles.length} files`);
    }
    return parts.join(", ");
  }

  memberChange(bulkLoadMemberAndMatch: BulkLoadMemberAndMatchToWalk) {
    this.lastUpdatedRow = bulkLoadMemberAndMatch;
    this.logger.info("memberChange: member:", bulkLoadMemberAndMatch?.bulkLoadMemberAndMatch?.member);
    if (bulkLoadMemberAndMatch?.bulkLoadMemberAndMatch?.member?.id) {
      this.logger.info("memberChange: setting member match to", MemberAction.matched, "for", this.fullNamePipe.transform(bulkLoadMemberAndMatch?.bulkLoadMemberAndMatch?.member));
      bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.memberMatch = MemberAction.matched;
    } else {
      this.logger.info("memberChange: setting member match to", MemberAction.notFound, "as no member present");
      bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.memberMatch = MemberAction.notFound;
    }
  }

  saveWalksDisabled() {
    return [ImportStage.NONE, ImportStage.SAVING].includes(this.importData.importStage);
  }

  resetDisabled() {
    return [ImportStage.SAVING].includes(this.importData.importStage);
  }

  stepStatus(key: ImportStepperKey): WalkImportStepStatus {
    const hasWalks = this.importData.fileImportRows?.length > 0 || this.importData.bulkLoadMembersAndMatchesToWalks?.length > 0;
    const hasMatches = this.importData.bulkLoadMembersAndMatchesToWalks?.length > 0;
    const hasImages = !!(this.importData.imageImportRows?.length && this.imageFilesForUpload()?.length);
    const isSaving = this.importData.importStage === ImportStage.SAVING;
    const isMatching = [ImportStage.MATCHING, ImportStage.MATCHING_COMPLETE].includes(this.importData.importStage);
    const isImporting = this.importData.importStage === ImportStage.IMPORTING;

    switch (key) {
      case ImportStepperKey.UPLOAD:
        return isImporting || isMatching || isSaving || hasWalks ? WalkImportStepStatus.DONE : WalkImportStepStatus.ACTIVE;
      case ImportStepperKey.MATCH:
        if (isSaving) return WalkImportStepStatus.DONE;
        if (isMatching || hasMatches) return WalkImportStepStatus.ACTIVE;
        return WalkImportStepStatus.PENDING;
      case ImportStepperKey.IMAGES:
        if (isSaving && hasImages) return WalkImportStepStatus.DONE;
        if (hasImages) return WalkImportStepStatus.DONE;
        if (isSaving) return WalkImportStepStatus.PENDING;
        return WalkImportStepStatus.ACTIVE;
      case ImportStepperKey.IMPORT:
        if (isSaving) return WalkImportStepStatus.ACTIVE;
        if (hasWalks && !isMatching && !isImporting) return WalkImportStepStatus.DONE;
        return WalkImportStepStatus.PENDING;
      default:
        return WalkImportStepStatus.PENDING;
    }
  }

  stepHint(key: ImportStepperKey): string {
    if (key === ImportStepperKey.UPLOAD) {
      return this.importData.fileImportRows?.length ? `${this.importData.fileImportRows.length} rows loaded` : "Select or drop the walks CSV";
    }
    if (key === ImportStepperKey.MATCH) {
      const total = this.importData.bulkLoadMembersAndMatchesToWalks?.length || 0;
      return total > 0 ? `${total} walks ready to review` : "Review walk leaders and match to members (Optional)";
    }
    if (key === ImportStepperKey.IMAGES) {
      const csvRows = this.importData.imageImportRows?.length || 0;
      const files = this.imageFilesForUpload()?.length || 0;
      if (csvRows && files) return "";
      if (csvRows && !files) return "Files not selected yet";
      if (!csvRows && files) return "Images CSV not loaded";
      return "Load Images CSV and files";
    }
    if (key === ImportStepperKey.IMPORT) {
      if (this.importData.importStage === ImportStage.SAVING) return "Importing...";
      return "Save to finish";
    }
    return "";
  }

  activeStepIndex(): number {
    const index = this.stepperStepsList.findIndex(step => this.stepStatus(step.key) === WalkImportStepStatus.ACTIVE);
    if (index >= 0) {
      return index;
    }
    return 0;
  }

  private syncStepperIndex(): void {
    const maxIndex = this.highestAccessibleIndex();
    this.stepperActiveIndex = Math.min(this.activeStepIndex(), maxIndex);
  }

  private hasWalksLoaded(): boolean {
    return !!(this.importData.fileImportRows?.length || this.importData.bulkLoadMembersAndMatchesToWalks?.length);
  }

  canAccessStep(stepKey: ImportStepperKey): boolean {
    const walksLoaded = this.hasWalksLoaded();
    switch (stepKey) {
      case ImportStepperKey.UPLOAD:
        return true;
      case ImportStepperKey.MATCH:
        return walksLoaded;
      case ImportStepperKey.IMAGES:
        return walksLoaded && this.importData.inputSource === InputSource.FILE_IMPORT;
      case ImportStepperKey.IMPORT:
        return walksLoaded;
      default:
        return false;
    }
  }

  private highestAccessibleIndex(): number {
    let max = 0;
    this.stepperStepsList.forEach((step, idx) => {
      if (this.canAccessStep(step.key)) {
        max = idx;
      }
    });
    return max;
  }

  goToStep(index: number): void {
    if (this.navigationLocked()) {
      return;
    }
    const step = this.stepperStepsList[index];
    if (step && this.canAccessStep(step.key)) {
      this.stepperActiveIndex = index;
    }
  }

  navigationLocked(): boolean {
    return this.importData.importStage === ImportStage.SAVING;
  }
}
