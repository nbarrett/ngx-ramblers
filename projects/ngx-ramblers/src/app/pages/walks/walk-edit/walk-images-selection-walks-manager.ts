import { Component, inject, Input, OnInit } from "@angular/core";
import { RamblersWalksAndEventsService } from "../../../services/walks/ramblers-walks-and-events.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalksQueryService } from "../../../services/walks/walks-query.service";
import { DisplayedWalk, ImageSource, WalkForSelect } from "../../../models/walk.model";
import { RamblersGroupsApiResponse, RamblersGroupWithLabel } from "../../../models/ramblers-walks-manager";
import { sortBy } from "../../../functions/arrays";
import { DateUtilsService } from "../../../services/date-utils.service";
import { DateCriteria } from "../../../models/api-request.model";
import { NgSelectComponent } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { HasBasicEventSelection } from "../../../models/search.model";

@Component({
  selector: "app-walk-images-selection-walks-manager",
  imports: [
    NgSelectComponent,
    FormsModule
  ],
  template: `
    <div>
      <div class="form-group">
        <label for="group-select">Import images from walk in another Ramblers Group</label>
        <ng-select id="group-select"
                   [items]="availableGroups"
                   bindLabel="ngSelectAttributes.label"
                   bindValue="group_code"
                   [searchable]="true"
                   [clearable]="true"
                   [loading]="loadingGroups"
                   placeholder="Select one or more groups..."
                   [ngModel]="displayedWalk.walk.imageConfig.importFrom.groupCode"
                   (ngModelChange)="groupChange($event)">
        </ng-select>
      </div>
      <div class="form-group">
        <label for="walk-filter">Walk Selection</label>
        <select id="walk-filter"
                [(ngModel)]="displayedWalk.walk.imageConfig.importFrom.filterParameters.selectType"
                (ngModelChange)="refreshWalks()"
                name="selectType"
                class="form-control rounded">
          @for (filter of walksFilter(); track filter.value) {
            <option [ngValue]="filter.value" [selected]="filter.selected">
              {{ filter.description }}
            </option>
          }
        </select>
      </div>
      <div class="form-group">
        <label for="linked-walk">Import from walk ({{ walks?.length }} found)</label>
        <ng-select id="linked-walk"
                   [items]="walks"
                   bindLabel="ngSelectAttributes.label"
                   bindValue="id"
                   [placeholder]="'Select a walk - type part of title to filter items'"
                   [dropdownPosition]="'bottom'"
                   [clearAllText]="'clear current selection'"
                   [closeOnSelect]="true"
                   [(ngModel)]="displayedWalk.walk.imageConfig.importFrom.walkId"
                   (ngModelChange)="walkChange($event)">
        </ng-select>
      </div>
    </div>
  `
})
export class WalkImageSelectionWalksManagerComponent implements OnInit {
  private walksReferenceService = inject(WalksReferenceService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private walksQueryService = inject(WalksQueryService);
  private dateUtils = inject(DateUtilsService);
  private logger: Logger = inject(LoggerFactory).createLogger("WalkImageSelectionWalksManagerComponent", NgxLoggerLevel.ERROR);
  loadingGroups = false;
  availableGroups: RamblersGroupWithLabel[] = [];
  groups: RamblersGroupsApiResponse[] = [];
  selectedGroup: RamblersGroupsApiResponse;
  areaGroup: RamblersGroupsApiResponse;
  public walks: WalkForSelect[] = [];
  public walk: WalkForSelect;
  @Input() displayedWalk: DisplayedWalk;
  protected readonly ImageSource = ImageSource;

  async ngOnInit() {
    await this.refreshGroupsAndWalksIfApplicable();
  }

  private async refreshGroupsAndWalksIfApplicable() {
    if (this.displayedWalk?.walk?.imageConfig.source === ImageSource.WALKS_MANAGER && this.displayedWalk?.walk?.imageConfig?.importFrom?.areaCode) {
      await this.queryGroups(this.displayedWalk.walk.imageConfig.importFrom.areaCode);
      this.updateSelectedGroupCodes();
    } else {
      this.logger.info("Not querying groups and walks - areaCode:", this.displayedWalk?.walk?.imageConfig?.importFrom?.areaCode, "imageConfig.source:", this.displayedWalk?.walk?.imageConfig.source);
    }
  }

  walksFilter() {
    return this.walksReferenceService.walksFilter.filter(item => item.value < 4);
  }

  private updateSelectedGroupCodes() {
    this.selectedGroup = this.availableGroups.find(group => group.group_code === this.displayedWalk?.walk?.imageConfig?.importFrom?.groupCode);
  }

  public async queryGroups(group: string): Promise<void> {
    if (group) {
      try {
        this.loadingGroups = true;
        this.groups = await this.ramblersWalksAndEventsService.listRamblersGroups([group]);
        this.availableGroups = this.groups.filter(group => group.scope === "G").map(group => ({
          ...group, ngSelectAttributes: {label: `${group.name} (${group.group_code})`}
        }));
        this.areaGroup = this.groups.find(group => group.scope === "A");
        this.logger.info("Searched for group:", group, "returned:", this.groups, "areaGroup:", this.areaGroup);
        if (this.areaGroup) {
          this.refreshWalks();
        }
      } catch (error) {
        this.logger.error("Error querying groups:", error);
      } finally {
        this.loadingGroups = false;
      }
    } else {
      this.logger.info("no group found in config group:", group, "found:", this.groups, "areaGroup:", this.areaGroup);
    }
  }

  refreshWalks() {
    const {groupCode, filterParameters} = this.displayedWalk.walk.imageConfig.importFrom;
    const parameters = {
      groupCode,
      dataQueryOptions: this.walksQueryService.dataQueryOptions(filterParameters)
    };
    this.ramblersWalksAndEventsService.all(parameters).then(walks => {
      this.walks = walks
        .filter(walk => walk.media?.length > 0)
        .sort(sortBy(this.sortColumn(filterParameters)))
        .map(walk => ({
          ...walk,
          ngSelectAttributes: {label: `${this.dateUtils.displayDate(walk.walkDate)} - ${walk.briefDescriptionAndStartPoint} - ${walk.contactName || "no walk leader found"}`}
        }));
    });
  }

  private sortColumn(filterParameters: HasBasicEventSelection) {
    return `${filterParameters.selectType === DateCriteria.CURRENT_OR_FUTURE_DATES ? "" : "-"}walkDate`;
  }

  walkChange(walkId: string) {
    this.logger.info("onChange of walkId:", walkId, "imageConfig:", this.displayedWalk.walk.imageConfig);
    const ramblersWalk = this.walks.find(walk => walk.id === walkId);
    this.ramblersWalksAndEventsService.copyMediaIfApplicable(this.displayedWalk.walk, ramblersWalk, true);
  }

  groupChange(groupCode: string) {
    this.displayedWalk.walk.imageConfig.importFrom.groupCode = groupCode;
    this.refreshWalks();
  }
}
