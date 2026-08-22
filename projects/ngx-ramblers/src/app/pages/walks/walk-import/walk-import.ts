import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faCircleCheck, faCircleQuestion, faCircleXmark, faCompress, faExpand, faRemove } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalksImportService } from "../../../services/walks/walks-import.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { PageComponent } from "../../../page/page.component";
import { ContentTextEditor } from "../../../modules/common/tiptap-editor/content-text-editor";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FileUploadModule } from "ng2-file-upload";
import { Subscription } from "rxjs";
import { FormsModule } from "@angular/forms";
import { Location, NgClass, NgStyle, NgTemplateOutlet } from "@angular/common";
import { SystemConfig } from "../../../models/system.model";
import { WalkImportFromFile } from "./walk-import-from-file";
import { GroupEventField, ImportData, ImportStage, WalkImportMatchType, WalkMatchOutcome } from "../../../models/walk.model";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { MaximisablePanelComponent } from "../../../modules/common/maximisable-panel/maximisable-panel";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective, SortableTableHeaderCellDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { StoredValue } from "../../../models/ui-actions";
import { jointWalkLeaderNames, normaliseWalkLeaderNameForCompare } from "../../../functions/walks/joint-walk-leaders";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { FullNamePipe } from "../../../pipes/full-name.pipe";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { StepperModule } from "primeng/stepper";
import { BulkLoadMemberAndMatchToWalk, MemberAction, MemberWithLabel } from "../../../models/member.model";
import { MemberService } from "../../../services/member/member.service";
import { sortBy } from "../../../functions/arrays";
import { ASCENDING } from "../../../models/table-filtering.model";
import { ActivatedRoute, Router } from "@angular/router";
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
    <app-page autoTitle pageTitle="Walks Import" [showTitle]="false">
      <app-maximisable-panel #matchPanel="maximisablePanel" [showToggleButton]="false">
        <div panelControls class="d-flex justify-content-between align-items-center flex-wrap gap-2 w-100">
          <h1 class="mb-0">Walks Import</h1>
          <button type="button" class="btn btn-quiet d-none d-md-inline-block" (click)="matchPanel.toggle()"
                  [tooltip]="matchPanel.maximised ? matchPanel.restoreTooltip : matchPanel.maximiseTooltip">
            <fa-icon [icon]="matchPanel.maximised ? faCompress : faExpand" class="me-1"/>{{ matchPanel.maximised ? 'Restore' : 'Maximise' }}
          </button>
        </div>
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
                          <div class="row">
                            <div class="col-sm-12 mb-3 mx-2">
                              <app-content-text-editor standalone name="file-import-help-page" description="File import help page"/>
                            </div>
                          </div>
                          <app-walk-import-from-file [importData]="importData" [notify]="notify"
                                                     (postImportPreparation)="postImportPreparation($event)">
                            <ng-container *ngTemplateOutlet="backAndResetButtons"/>
                          </app-walk-import-from-file>
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
                                         [checked]="filterMatched === WalkImportFilterMatch.ALL"
                                         (change)="filterMatched = WalkImportFilterMatch.ALL">
                                  <label class="form-check-label" for="filter-all">All</label>
                                </div>
                                <div class="form-check form-check-inline">
                                  <input class="form-check-input"
                                         type="radio"
                                         id="filter-matched"
                                         name="filterMatched"
                                         [checked]="filterMatched === WalkImportFilterMatch.MATCHED"
                                         (change)="filterMatched = WalkImportFilterMatch.MATCHED">
                                  <label class="form-check-label" for="filter-matched">Matched to a member</label>
                                </div>
                                <div class="form-check form-check-inline">
                                  <input class="form-check-input"
                                         type="radio"
                                         id="filter-tentative"
                                         name="filterMatched"
                                         [checked]="filterMatched === WalkImportFilterMatch.TENTATIVE"
                                         (change)="filterMatched = WalkImportFilterMatch.TENTATIVE">
                                  <label class="form-check-label" for="filter-tentative">Tentative</label>
                                </div>
                                <div class="form-check form-check-inline">
                                  <input class="form-check-input"
                                         type="radio"
                                         id="filter-unmatched"
                                         name="filterMatched"
                                         [checked]="filterMatched === WalkImportFilterMatch.UNMATCHED"
                                         (change)="filterMatched = WalkImportFilterMatch.UNMATCHED">
                                  <label class="form-check-label" for="filter-unmatched">Not matched to a member</label>
                                </div>
                                <div class="form-check form-check-inline">
                                  <input class="form-check-input"
                                         type="radio"
                                         id="filter-excluded"
                                         name="filterMatched"
                                         [checked]="filterMatched === WalkImportFilterMatch.EXCLUDED"
                                         (change)="filterMatched = WalkImportFilterMatch.EXCLUDED">
                                  <label class="form-check-label" for="filter-excluded">Excluded (e.g. duplicates)</label>
                                </div>
                              </div>
                            </div>
                            <div class="row">
                              <div class="col-sm-12">
                                <h3>Matching of Walk Leaders to Members</h3>
                                <div class="alert alert-warning py-1">
                                  <fa-icon [icon]="alertTarget.alert.icon"/>
                                  <strong class="ms-2">Matching: </strong>{{ matchedWalks }} of {{ stringUtilsService.pluraliseWithCount(totalWalks, "walk") }} matched to members; {{ stringUtilsService.pluraliseWithCount(walksUpdatingExistingCount, "walk") }} will update an existing walk and {{ walksCreatingNewCount }} will be created as new{{ EM_DASH_WITH_SPACES }}showing {{ filterMatched }} {{ stringUtilsService.pluraliseWithCount(filteredMatchRows.length, "walk") }}.
                                  @if (isWidescreen && !matchPanel.maximised) {
                                    <span> Tip: click <strong>Maximise</strong> (top right) to make better use of your wide screen.</span>
                                  }
                                </div>
                                <app-sortable-table
                                  [columns]="matchColumns"
                                  [rows]="filteredMatchRows"
                                  [defaultSortKey]="matchSortKey"
                                  [defaultSortDirection]="matchSortDirection"
                                  (sortChange)="onMatchSortChange($event)"
                                  [maxHeight]="'60vh'"
                                  emptyMessage="No walks match the current filter.">
                                  <ng-template appSortableTableHeaderCell="include">
                                    <div class="form-check mb-0" (click)="$event.stopPropagation()">
                                      <input type="checkbox" class="form-check-input"
                                             [ngModel]="allIncluded"
                                             [ngModelOptions]="{standalone: true}"
                                             (ngModelChange)="toggleAllIncluded($event)"
                                             tooltip="Include or exclude all walks" container="body">
                                    </div>
                                  </ng-template>
                                  <ng-template appSortableTableCell="include" let-row>
                                    <div class="form-check">
                                      <input [(ngModel)]="row.include"
                                             [ngModelOptions]="{standalone: true}"
                                             (ngModelChange)="onIncludeChange(row)"
                                             type="checkbox" class="form-check-input">
                                    </div>
                                  </ng-template>
                                  <ng-template appSortableTableCell="date" let-row>
                                    <span class="nowrap">{{ row.event.groupEvent.start_date_time | displayDate }}</span>
                                  </ng-template>
                                  <ng-template appSortableTableCell="title" let-row>{{ row.event.groupEvent.title }}</ng-template>
                                  <ng-template appSortableTableCell="walkMatch" let-row>
                                    <div class="walk-match-state"
                                         [class.walk-match-new]="walkMatchIsNew(row)"
                                         [tooltip]="matchPanel.maximised ? null : walkMatchDetail(row)"
                                         container="body">{{ walkMatchLabel(row) }}</div>
                                    @if (matchPanel.maximised) {
                                      <div class="walk-match-detail">{{ walkMatchDetail(row) }}</div>
                                    }
                                  </ng-template>
                                  <ng-template appSortableTableCell="leader" let-row>{{ row.event.groupEvent.walk_leader.name || "Not supplied" }}</ng-template>
                                  <ng-template appSortableTableCell="memberAllocation" let-row>
                                    <div class="d-flex align-items-center gap-2">
                                      <span class="member-match-indicator flex-shrink-0"
                                            [class.member-match-clickable]="row.bulkLoadMemberAndMatch.tentative"
                                            [tooltip]="memberMatchTooltip(row)" container="body"
                                            (click)="confirmTentative(row)">
                                        <fa-icon [icon]="memberMatchIcon(row)" [style.color]="memberMatchColour(row)"/>
                                      </span>
                                      <ng-select class="flex-fill"
                                        [items]="membersWithLabel"
                                        bindLabel="ngSelectAttributes.label"
                                        bindValue="id"
                                        [multiple]="true"
                                        [closeOnSelect]="false"
                                        [searchable]="true"
                                        [clearable]="true"
                                        dropdownPosition="bottom"
                                        placeholder="Select one or more members - first is primary"
                                        [ngModel]="memberIdsFor(row)"
                                        [ngModelOptions]="{standalone: true}"
                                        (ngModelChange)="onMembersChange(row, $event)">
                                        <ng-template ng-label-tmp let-item="item">{{ item | fullName }}</ng-template>
                                        <ng-template ng-option-tmp let-item="item">{{ item | fullName }}</ng-template>
                                      </ng-select>
                                    </div>
                                    @if (shouldShowApplyButton(row)) {
                                      <button type="button" class="btn btn-sm btn-primary mt-2"
                                              (click)="applyMemberToOtherWalks(row)">
                                        {{ applyCaption(row) }}
                                      </button>
                                    }
                                  </ng-template>
                                </app-sortable-table>
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
      </app-maximisable-panel>
    </app-page>`,
  styleUrls: ["./walk-import.sass"],
  imports: [PageComponent, ContentTextEditor, FontAwesomeModule, FileUploadModule, FormsModule, NgTemplateOutlet, WalkImportFromFile, DisplayDatePipe, FullNamePipe, NgSelectComponent, NgLabelTemplateDirective, NgOptionTemplateDirective, NgClass, StepperModule, FileSizeSelectorComponent, NgStyle, TooltipDirective, MaximisablePanelComponent, SortableTableComponent, SortableTableCellDirective, SortableTableHeaderCellDirective]
})

export class WalkImport implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("WalkImport", NgxLoggerLevel.ERROR);
  public get totalWalks(): number {
    return this.importData.bulkLoadMembersAndMatchesToWalks?.length || 0;
  }

  public get matchedWalks(): number {
    return this.importData.bulkLoadMembersAndMatchesToWalks?.filter(row => !!row.bulkLoadMemberAndMatch.member)?.length || 0;
  }

  private cachedWalkMatchResolver: (incomingWalk: ExtendedGroupEvent) => WalkMatchOutcome;
  private cachedWalkMatchResolverSource: ExtendedGroupEvent[];

  public walkMatchOutcome(row: BulkLoadMemberAndMatchToWalk): WalkMatchOutcome {
    const existingWalks = this.importData.existingWalksWithinRange || [];
    if (this.cachedWalkMatchResolverSource !== existingWalks) {
      this.cachedWalkMatchResolver = this.walksImportService.existingWalkMatchResolver(existingWalks);
      this.cachedWalkMatchResolverSource = existingWalks;
    }
    return this.cachedWalkMatchResolver(row.event);
  }

  public walkMatchIsNew(row: BulkLoadMemberAndMatchToWalk): boolean {
    return this.walkMatchOutcome(row).matchType === WalkImportMatchType.NONE;
  }

  public walkMatchLabel(row: BulkLoadMemberAndMatchToWalk): string {
    return this.walkMatchIsNew(row) ? "New walk" : "Updates existing walk";
  }

  public walkMatchDetail(row: BulkLoadMemberAndMatchToWalk): string {
    const outcome = this.walkMatchOutcome(row);
    switch (outcome.matchType) {
      case WalkImportMatchType.WALK_ID:
        return `Matched an existing walk by Walk ID ${outcome.existingWalk?.groupEvent?.id}. Its details will be updated in place.`;
      case WalkImportMatchType.TITLE_AND_DATE:
        return "Matched an existing walk by title and date (no Walk ID in the row). Its details will be updated in place.";
      default:
        return "No existing walk matched by Walk ID, or by title and date, so a new walk will be created. If it should have matched, check the Walk ID, title and date against the existing walk.";
    }
  }

  public get walksUpdatingExistingCount(): number {
    return (this.importData.bulkLoadMembersAndMatchesToWalks || []).filter(row => !this.walkMatchIsNew(row)).length;
  }

  public get walksCreatingNewCount(): number {
    return (this.importData.bulkLoadMembersAndMatchesToWalks || []).filter(row => this.walkMatchIsNew(row)).length;
  }

  private notifierService = inject(NotifierService);
  private systemConfigService = inject(SystemConfigService);
  display = inject(WalkDisplayService);
  memberService = inject(MemberService);
  protected walksImportService = inject(WalksImportService);
  private location = inject(Location);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected stringUtilsService = inject(StringUtilsService);
  private fullNamePipe = inject(FullNamePipe);
  public matchSortKey: string = this.route.snapshot.queryParamMap.get(StoredValue.SORT) || "event.groupEvent.start_date_time";
  public matchSortDirection: string = this.route.snapshot.queryParamMap.get(StoredValue.SORT_ORDER) || ASCENDING;
  public matchColumns: SortableTableColumn[] = [
    {key: "include", label: ""},
    {key: "date", label: "Date", sortKey: "event.groupEvent.start_date_time"},
    {key: "title", label: "Title", sortKey: "event.groupEvent.title"},
    {key: "walkMatch", label: "Walk match"},
    {key: "leader", label: "Walk leader", sortKey: "event.groupEvent.walk_leader.name"},
    {key: "memberAllocation", label: "Member allocation", sortKey: "bulkLoadMemberAndMatch.memberMatch"}
  ];
  protected alertTarget: AlertTarget = {};
  protected notify: AlertInstance;
  faRemove = faRemove;
  protected readonly faCompress = faCompress;
  protected readonly faExpand = faExpand;

  public confirmTentative(row: BulkLoadMemberAndMatchToWalk): void {
    if (row.bulkLoadMemberAndMatch.tentative) {
      row.bulkLoadMemberAndMatch.tentative = false;
    }
  }

  public memberMatchIcon(row: BulkLoadMemberAndMatchToWalk) {
    const match = row.bulkLoadMemberAndMatch;
    return match.tentative ? faCircleQuestion : (match.member ? faCircleCheck : faCircleXmark);
  }

  public memberMatchColour(row: BulkLoadMemberAndMatchToWalk): string {
    const match = row.bulkLoadMemberAndMatch;
    return match.tentative ? "#c07b00" : (match.member ? "#2e7d32" : "#c62828");
  }

  public memberMatchTooltip(row: BulkLoadMemberAndMatchToWalk): string {
    const match = row.bulkLoadMemberAndMatch;
    const names = (match.selectedMemberIds ?? [])
      .map(id => this.membersWithLabel.find(member => member.id === id))
      .filter((member): member is MemberWithLabel => !!member)
      .map(member => this.fullNamePipe.transform(member));
    if (match.tentative) {
      return `Tentative surname match to ${names.length > 0 ? this.joinNames(names) : "a member"} - it will be imported; click to confirm as correct`;
    } else if (names.length > 0) {
      return `Matched to ${this.joinNames(names)}`;
    } else {
      return "No member matched - search and select one";
    }
  }

  private joinNames(names: string[]): string {
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  }
  private subscriptions: Subscription[] = [];
  protected hasFileOver: boolean;
  protected systemConfig: SystemConfig;
  protected importData: ImportData = this.walksImportService.importDataDefaults(InputSource.FILE_IMPORT);
  protected membersWithLabel: MemberWithLabel[] = [];
  protected stepperActiveIndex = 0;
  public lastUpdatedRow: BulkLoadMemberAndMatchToWalk = null;
  public filterMatched: WalkImportFilterMatch = WalkImportFilterMatch.ALL;
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
  protected isWidescreen = false;

  async ngOnInit() {
    this.logger.debug("ngOnInit");
    this.isWidescreen = window.innerWidth >= 1400;
    this.notify = this.notifierService.createAlertInstance(this.alertTarget);
    this.subscriptions.push(this.systemConfigService.events().subscribe(async systemConfig => {
      this.systemConfig = systemConfig;
    }));
    const members = await this.memberService.all();
    this.membersWithLabel = members.map(member => ({
      ...member,
      ngSelectAttributes: {label: this.fullNamePipe.transform(member)}
    })).sort(sortBy("ngSelectAttributes.label"));
    this.reseedSelectedMembers();
    this.syncStepperIndex();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  public onIncludeChange(bulkLoadMemberAndMatch: BulkLoadMemberAndMatchToWalk): void {
    this.logger.info("Include changed for walk to", bulkLoadMemberAndMatch.include, "bulkLoadMemberAndMatch:", bulkLoadMemberAndMatch);
  }

  public get allIncluded(): boolean {
    const rows = this.importData.bulkLoadMembersAndMatchesToWalks || [];
    return rows.length > 0 && rows.every(row => row.include);
  }

  public toggleAllIncluded(include: boolean): void {
    (this.importData.bulkLoadMembersAndMatchesToWalks || []).forEach(row => row.include = include);
  }

  public get filteredMatchRows(): BulkLoadMemberAndMatchToWalk[] {
    return (this.importData.bulkLoadMembersAndMatchesToWalks || []).filter(row => {
      if (row === this.lastUpdatedRow) {
        return true;
      } else if (this.filterMatched === WalkImportFilterMatch.MATCHED) {
        return !!row.bulkLoadMemberAndMatch.member;
      } else if (this.filterMatched === WalkImportFilterMatch.UNMATCHED) {
        return !row.bulkLoadMemberAndMatch.member;
      } else if (this.filterMatched === WalkImportFilterMatch.TENTATIVE) {
        return !!row.bulkLoadMemberAndMatch.tentative;
      } else if (this.filterMatched === WalkImportFilterMatch.EXCLUDED) {
        return !row.include;
      } else {
        return true;
      }
    });
  }

  public onMatchSortChange(state: SortableTableSortState): void {
    this.matchSortKey = state.key;
    this.matchSortDirection = state.direction;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {[StoredValue.SORT]: state.key, [StoredValue.SORT_ORDER]: state.direction},
      queryParamsHandling: "merge",
      replaceUrl: true
    });
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
        row.bulkLoadMemberAndMatch.tentative = false;
        row.bulkLoadMemberAndMatch.selectedMemberIds = selectedMember.id ? [selectedMember.id] : [];
      });
    }
    this.lastUpdatedRow = null;
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
        this.reseedSelectedMembers();
        this.syncStepperIndex();
      });
  }

  navigateBackToAdmin() {
    this.location.back();
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
            message: `Import completed with ${this.stringUtilsService.pluraliseWithCount(this.importData?.errorMessages?.length, "error")}: ${this.importData.errorMessages.join("; ")}`
          });
        } else {
          this.notify.success({
            title: "Walks Import Complete",
            message: "Import completed successfully"
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
      this.importData.imageImportRows = await this.walksImportService.csvRowsFromFile(csvFile) as any;
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

  public memberIdsFor(bulkLoadMemberAndMatch: BulkLoadMemberAndMatchToWalk): string[] {
    return bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.selectedMemberIds ?? [];
  }

  private memberIdMatchingName(name: string): string {
    const normalised = normaliseWalkLeaderNameForCompare(name);
    return this.membersWithLabel.find(member =>
      normaliseWalkLeaderNameForCompare(this.fullNamePipe.transform(member)) === normalised
      || normaliseWalkLeaderNameForCompare(member.displayName || "") === normalised)?.id || null;
  }

  private reseedSelectedMembers(): void {
    (this.importData.bulkLoadMembersAndMatchesToWalks || []).forEach(row => {
      const bulkLoadMemberAndMatch = row.bulkLoadMemberAndMatch;
      const primaryId = bulkLoadMemberAndMatch.member?.id;
      const leaderName = row.event.groupEvent?.walk_leader?.name || row.event.fields?.contactDetails?.displayName || "";
      const nameMatchedIds = jointWalkLeaderNames(leaderName).map(name => this.memberIdMatchingName(name)).filter((id): id is string => !!id);
      const combinedIds = primaryId ? [primaryId, ...nameMatchedIds.filter(id => id !== primaryId)] : nameMatchedIds;
      const uniqueIds = Array.from(new Set(combinedIds));
      const surnameSuggestionId = uniqueIds.length === 0 ? this.surnameSuggestionMemberId(row) : null;
      const selectedIds = uniqueIds.length > 0 ? uniqueIds : (surnameSuggestionId ? [surnameSuggestionId] : []);
      bulkLoadMemberAndMatch.selectedMemberIds = selectedIds;
      if (selectedIds.length > 0) {
        bulkLoadMemberAndMatch.member = this.membersWithLabel.find(member => member.id === selectedIds[0]) ?? bulkLoadMemberAndMatch.member;
        bulkLoadMemberAndMatch.memberMatch = MemberAction.found;
        bulkLoadMemberAndMatch.tentative = uniqueIds.length === 0 ? !!surnameSuggestionId : !!bulkLoadMemberAndMatch.tentative;
      }
    });
  }

  private surnameSuggestionMemberId(row: BulkLoadMemberAndMatchToWalk): string {
    const leaderName = row.event.groupEvent?.walk_leader?.name || row.event.fields?.contactDetails?.displayName || "";
    const names = jointWalkLeaderNames(leaderName);
    const surname = names.length === 1 ? normaliseWalkLeaderNameForCompare(leaderName.trim().split(/\s+/).slice(-1)[0] || "") : "";
    const matches = surname
      ? this.membersWithLabel.filter(member => normaliseWalkLeaderNameForCompare(member.lastName || "") === surname)
      : [];
    return matches.length === 1 ? matches[0].id : null;
  }

  public onMembersChange(bulkLoadMemberAndMatch: BulkLoadMemberAndMatchToWalk, memberIds: string[]): void {
    const selectedIds = (memberIds || []).filter(id => !!id);
    bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.selectedMemberIds = selectedIds;
    const primary = selectedIds.length > 0 ? (this.membersWithLabel.find(member => member.id === selectedIds[0]) ?? null) : null;
    bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.member = primary;
    bulkLoadMemberAndMatch.bulkLoadMemberAndMatch.tentative = false;
    this.memberChange(bulkLoadMemberAndMatch);
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
