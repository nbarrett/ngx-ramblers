import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import map from "lodash-es/map";
import { KeyValue } from "../../../../services/enums";
import { faEraser } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-mailchimp-segment-editor",
  template: `
    <div *ngIf="showTitle" class="mb-2 mt-2 font-weight-bold">Mailchimp Segments ({{ editableSegments.length }})</div>
    <div class="row" *ngFor="let segment of editableSegments">
      <div class="col-sm-6">
        {{ segment.key }}:
      </div>
      <div class="col-sm-3">
        {{ segment.value }}
      </div>
      <div class="col-sm-3">
        <div *ngIf="segment.value" class="badge-button" (click)="clearSegment(segment.key)">
          <fa-icon [icon]="faEraser"></fa-icon>
          <span>delete</span>
        </div>
      </div>
    </div>`,
})
export class MailchimpSegmentEditorComponent implements OnInit {
  @Input()
  showTitle: boolean;
  @Input()
  segments: any;

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailchimpSegmentEditorComponent", NgxLoggerLevel.OFF);
  }


  private logger: Logger;
  public editableSegments: KeyValue<number>[] = [];
  protected readonly faEraser = faEraser;

  ngOnInit() {
    this.logger.info("constructed", "renderEditableSegments:", this.segments);
    this.renderEditableSegments();
  }

  private renderEditableSegments() {
    this.logger.info("renderEditableSegments:segments:", this.segments);
    if (this.editableSegments) {
      this.editableSegments = map(this.segments, (value, key) => {
        this.logger.info("key:", key, "value:", value);
        return {key, value};
      });
    } else {
      this.logger.info("No editable segments to render");
    }
  }

  clearSegment(key: string) {
    this.logger.info("clearing segment:", key, "before:", this.segments);
    this.segments[key] = null;
    this.logger.info("clearing segment:", key, "after:", this.segments);
    this.renderEditableSegments();
  }
}
