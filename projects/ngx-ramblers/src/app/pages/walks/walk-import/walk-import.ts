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
import { NgClass, NgTemplateOutlet, TitleCasePipe } from "@angular/common";
import { SystemConfig } from "../../../models/system.model";
import { WalkImportFromFile } from "./walk-import-from-file";
import { GroupEventField, ImportData, ImportStage, WalkImportField } from "../../../models/walk.model";
import { WalkImportFromWalksManager } from "./walk-import-from-walks-manager";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { StatusIconComponent } from "../../admin/status-icon";
import { FullNamePipe } from "../../../pipes/full-name.pipe";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { BulkLoadMemberAndMatchToWalk, MemberAction, MemberWithLabel } from "../../../models/member.model";
import { MemberService } from "../../../services/member/member.service";
import { sortBy } from "../../../functions/arrays";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { HumanisePipe } from "../../../pipes/humanise.pipe";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { InputSource } from "../../../models/group-event.model";

@Component({
  selector: "app-walk-import",
  template: `
    <ng-template #backAndResetButtons>
      @if (importData.importStage === ImportStage.MATCHING) {
        <input type="submit"
               value="Save Imported Walks"
               (click)="saveImportedWalks()"
               [disabled]="saveWalksDisabled()" class="btn btn-primary mr-2">
      }
      <input type="submit"
             value="Reset"
             (click)="reset()"
             [disabled]="resetDisabled()"
             class="btn btn-primary">
      @if (importData.importStage === ImportStage.NONE) {
        <input type="submit" value="Back"
               (click)="navigateBackToAdmin()"
               title="Back to walks"
               class="ml-2 btn btn-primary">
      }</ng-template>
    <app-page pageTitle="Walks Import">
      <div class="row mb-3">
        <div class="col-md-12">
          <label class="mr-2">Import Type:</label>
          <div class="custom-control custom-radio custom-control-inline">
            <input class="custom-control-input"
                   id="import-source-walks-manager"
                   name="import-source"
                   type="radio"
                   [value]="ImportSource.WALKS_MANAGER_IMPORT"
                   (ngModelChange)="reset()"
                   [disabled]="importData.importStage !== ImportStage.NONE"
                   [(ngModel)]="importData.inputSource"/>
            <label class="custom-control-label" for="import-source-walks-manager">From Walks Manager (Group
              Code {{ systemConfig?.group?.groupCode }})</label>
          </div>
          <div class="custom-control custom-radio custom-control-inline">
            <input class="custom-control-input"
                   id="import-source-file"
                   name="import-source"
                   type="radio"
                   [value]="ImportSource.FILE_IMPORT"
                   (ngModelChange)="reset()"
                   [disabled]="importData.importStage !== ImportStage.NONE"
                   [(ngModel)]="importData.inputSource"/>
            <label class="custom-control-label" for="import-source-file">From CSV Import File</label>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-sm-12 mb-3 mx-2">
          @if (importData.inputSource === ImportSource.WALKS_MANAGER_IMPORT) {
            <app-markdown-editor name="ramblers-import-help-page" description="Ramblers import help page"/>
          } @else {
            <app-markdown-editor name="file-import-help-page" description="File import help page"/>
          }
        </div>
      </div>
      @if (importData.inputSource === ImportSource.WALKS_MANAGER_IMPORT) {
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
      @if (importData.importStage == ImportStage.MATCHING || importData.importStage == ImportStage.MATCHING_COMPLETE) {
        <div class="row mb-2 align-items-center">
          <div class="col-auto"><label class="mr-2">Filter To Show</label>
            <div class="custom-control custom-radio custom-control-inline">
              <input class="custom-control-input"
                     type="radio"
                     id="filter-all"
                     name="filterMatched"
                     value="all"
                     [(ngModel)]="filterMatched">
              <label class="custom-control-label" for="filter-all">All</label>
            </div>
            <div class="custom-control custom-radio custom-control-inline">
              <input class="custom-control-input"
                     type="radio"
                     id="filter-matched"
                     name="filterMatched"
                     value="matched"
                     [(ngModel)]="filterMatched">
              <label class="custom-control-label" for="filter-matched">Matched to a member</label>
            </div>
            <div class="custom-control custom-radio custom-control-inline">
              <input class="custom-control-input"
                     type="radio"
                     id="filter-unmatched"
                     name="filterMatched"
                     value="unmatched"
                     [(ngModel)]="filterMatched">
              <label class="custom-control-label" for="filter-unmatched">Not matched to a member</label>
            </div>
            <div class="custom-control custom-radio custom-control-inline">
              <input class="custom-control-input"
                     type="radio"
                     id="filter-excluded"
                     name="filterMatched"
                     value="excluded"
                     [(ngModel)]="filterMatched">
              <label class="custom-control-label" for="filter-excluded">Excluded (manually or due to duplicate
                detection)</label>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="col-sm-12">
            <h3>Matching of Walk Leaders to Members</h3>
            <div class="alert alert-warning py-1">
              <fa-icon [icon]="alertTarget.alert.icon"/>
              <strong class="ml-2">Walk Leader Matching: </strong>{{ matchedWalks }} out
              of {{ stringUtilsService.pluraliseWithCount(totalWalks, 'walk') }}
              have been matched to members{{ EM_DASH_WITH_SPACES }}
              showing {{ filterMatched }} {{ stringUtilsService.pluraliseWithCount(sortedAndFilteredRows.length, 'walk') }}
            </div>
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
                      <div class="custom-control custom-checkbox">
                        <input [(ngModel)]="bulkLoadMemberAndMatch.include"
                               [ngModelOptions]="{standalone: true}"
                               (ngModelChange)="onIncludeChange(bulkLoadMemberAndMatch)"
                               type="checkbox" class="custom-control-input"
                               id="toggle-exclude-{{index}}">
                        <label class="custom-control-label" for="toggle-exclude-{{index}}">
                        </label>
                      </div>
                    </td>
                    <td class="nowrap">{{ bulkLoadMemberAndMatch.event.groupEvent.start_date_time | displayDate }}
                    </td>
                    <td>{{ bulkLoadMemberAndMatch.event.groupEvent.title }}</td>
                    <td>{{ bulkLoadMemberAndMatch.event.groupEvent.walk_leader.name || 'Not supplied' }}</td>
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
        </div>
      }
    </app-page>`,
  imports: [PageComponent, MarkdownEditorComponent, FontAwesomeModule, FileUploadModule, FormsModule, NgTemplateOutlet, WalkImportFromFile, WalkImportFromWalksManager, DisplayDatePipe, StatusIconComponent, FullNamePipe, NgSelectComponent, NgLabelTemplateDirective, NgOptionTemplateDirective, HumanisePipe, TitleCasePipe, NgClass]
})

export class WalkImport implements OnInit, OnDestroy {

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
      } else if (this.filterMatched === "matched") {
        return !!row.bulkLoadMemberAndMatch.member;
      } else if (this.filterMatched === "unmatched") {
        return !row.bulkLoadMemberAndMatch.member;
      } else if (this.filterMatched === "excluded") {
        return !row.include;
      } else {
        return true;
      }
    });
    const sortColumns = [this.sortedFieldCalled(this.sortField), this.sortedFieldCalled(WalkImportField.EVENT_WALK_LEADER)];
    this.logger.off("sortedAndFilteredRows: sorting by:", sortColumns, "rows:", rows);
    return rows.sort(sortBy(...sortColumns));
  }

  private logger: Logger = inject(LoggerFactory).createLogger("WalkImport", NgxLoggerLevel.ERROR);
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
  public lastUpdatedRow: BulkLoadMemberAndMatchToWalk = null;
  public sortField = "start_date_time";
  public sortDirection = ASCENDING;
  public filterMatched: "all" | "matched" | "unmatched" | "excluded" = "all";
  walkImportFields: KeyValue<string>[] = enumKeyValues(WalkImportField);
  protected readonly GroupEventField = GroupEventField;
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;
  protected readonly ImportStage = ImportStage;
  protected readonly ImportSource = InputSource;

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
      .finally(() => this.importData.importStage = ImportStage.MATCHING);
  }

  navigateBackToAdmin() {
    this.urlService.navigateTo(["walks", "admin"]);
  }

  reset() {
    this.importData = this.walksImportService.importDataDefaults(InputSource.FILE_IMPORT);
    this.logger.info("resetting importData to:", this.importData);
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
            title: "Walks Import Completed With Errors",
            message: `Imported completed with ${this.stringUtilsService.pluraliseWithCount(this.importData?.errorMessages?.length, "error")}. If you are happy with number of walks imported, Walk population should now be changed to Local in System Settings.`
          });
        } else {
          this.notify.success({
            title: "Walks Import Complete",
            message: `Imported completed successfully. Walk population should now be changed to Local in System Settings.`
          });
        }
      })
      .catch(error => this.notify.error({
        title: "Walks Import Failed",
        message: error
      }))
      .finally(() => this.importData.importStage = ImportStage.NONE);
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
    return [ImportStage.NONE].includes(this.importData.importStage);
  }

  resetDisabled() {
    return [ImportStage.SAVING].includes(this.importData.importStage);
  }
}
