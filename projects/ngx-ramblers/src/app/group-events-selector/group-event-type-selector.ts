import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import map from "lodash-es/map";
import { GroupEventType, GroupEventTypes, uploadGroupEventType } from "../models/committee.model";
import { NgxLoggerLevel } from "ngx-logger";
import { ContentMetadata, ContentMetadataItem } from "../models/content-metadata.model";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { CommitteeQueryService } from "../services/committee/committee-query.service";
import { DateUtilsService } from "../services/date-utils.service";
import { NumberUtilsService } from "../services/number-utils.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-group-event-type-selector",
    template: `
    <div class="form-group">
      <label [for]="id">{{label}}</label>
      <select [(ngModel)]="selectedDataSource" [id]="id" class="form-control"
        (ngModelChange)="eventChange.emit($event)">
        @for (dateSource of dataSources; track dateSource) {
          <option
          [ngValue]="dateSource">{{dateSource.description}}</option>
        }
      </select>
    </div>`,
    imports: [FormsModule]
})
export class GroupEventTypeSelectorComponent implements OnInit {
  private includeUpload: boolean;

  @Input("includeUpload") set includeUploadValue(value: boolean) {
    this.includeUpload = coerceBooleanProperty(value);
  }

  @Input() label: string;
  @Input() dataSource: string;
  @Output() imagedSavedOrReverted: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() eventChange: EventEmitter<GroupEventType> = new EventEmitter();
  @Output() initialValue: EventEmitter<GroupEventType> = new EventEmitter();

  private logger: Logger;
  public eventId: string;
  public contentMetadata: ContentMetadata;
  public editActive: boolean;
  private search: string;
  public selectedDataSource: GroupEventType;
  public dataSources: GroupEventType[];
  public id: string;

  constructor(private numberUtilsService: NumberUtilsService,
              private committeeQueryService: CommitteeQueryService,
              public dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("GroupEventTypeSelectorComponent", NgxLoggerLevel.OFF);
  }


  ngOnInit() {
    this.logger.info("ngOnInit:label:", this.label, "dataSource:", this.dataSource, "search", this.search,);
    this.id = this.numberUtilsService.generateUid();
    const items = map(GroupEventTypes, (item) => item);
    this.dataSources = this.includeUpload ? [uploadGroupEventType].concat(items) : items;
    this.selectedDataSource = this.dataSources.find(item => item.area === this.dataSource);
    if (this.selectedDataSource) {
      this.initialValue.emit(this.selectedDataSource);
    }
  }

}
