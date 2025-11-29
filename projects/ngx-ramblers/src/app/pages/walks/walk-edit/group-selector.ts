import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { GroupEventField } from "../../../models/walk.model";
import { RamblersGroupsApiResponse, RamblersGroupWithLabel } from "../../../models/ramblers-walks-manager";
import { NgSelectComponent } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { NgTemplateOutlet } from "@angular/common";

@Component({
  selector: "app-group-selector",
  imports: [
    NgSelectComponent,
    FormsModule,
    NgTemplateOutlet
  ],
  template: `
    <ng-template #select>
      <ng-select id="group-select"
                 [appendTo]="'body'"
                 [items]="availableGroups"
                 bindLabel="ngSelectAttributes.label"
                 bindValue="group_code"
                 [searchable]="true"
                 [clearable]="true"
                 [disabled]="disabled"
                 [loading]="loadingGroups"
                 placeholder="Select one or more groups..."
                 [ngModel]="groupCode"
                 (ngModelChange)="groupChange($event)">
      </ng-select>
    </ng-template>
    @if (label) {
      <div class="form-group">
        <label for="group-select">{{ label }}</label>
        <ng-container *ngTemplateOutlet="select"/>
      </div>
    } @else {
      <ng-container *ngTemplateOutlet="select"/>
    }
  `
})
export class GroupSelector implements OnInit {
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private logger: Logger = inject(LoggerFactory).createLogger("GroupSelector", NgxLoggerLevel.ERROR);
  loadingGroups = false;
  availableGroups: RamblersGroupWithLabel[] = [];
  groups: RamblersGroupsApiResponse[] = [];
  areaGroup: RamblersGroupsApiResponse;
  protected readonly GroupEventField = GroupEventField;
  @Input() label!: string;
  @Input() groupCode!: string;
  @Input() areaCode!: string;
  @Output() groupChanged: EventEmitter<RamblersGroupsApiResponse> = new EventEmitter();
  @Output() areaChanged: EventEmitter<RamblersGroupsApiResponse> = new EventEmitter();
  @Input() disabled!: boolean;

  async ngOnInit() {
    this.logger.info("ngOnInit:areaCode:", this.areaCode, "groupCode(s):", this.groupCode, "firstGroupCode:", this.firstGroupCode());
    if (this.areaCode) {
      await this.queryGroups(this.areaCode);
      this.updateSelectedGroupCodes();
    } else {
      this.logger.info("Not querying groups and walks - areaCode:", this.areaCode);
    }
  }

  private updateSelectedGroupCodes() {
    const selectedGroup: RamblersGroupWithLabel = this.availableGroups.find(group => group.group_code === this.firstGroupCode());
    this.groupChange(selectedGroup?.group_code);
  }

  private firstGroupCode() {
    return this?.groupCode?.split(",")?.[0];
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
          this.logger.info("onChange of areaGroup:", this.areaGroup);
          this.areaChanged.emit(this.areaGroup);
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


  groupChange(groupCode: string) {
    const group = this.groups.find(group => group.group_code === groupCode);
    if (group) {
      this.logger.info("onChange of groupCode:", groupCode, "emitting group:", group);
      this.groupChanged.emit(group);
    } else {
      this.logger.info("onChange of groupCode:", groupCode, "no group found");
    }
  }
}
