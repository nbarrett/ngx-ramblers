import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import map from "lodash-es/map";
import { KeyValue } from "../../../../functions/enums";
import { faEraser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-mailchimp-segment-editor",
    template: `
    @if (showTitle) {
      <div class="mb-2 mt-2 font-weight-bold">Mailchimp Segments ({{ editableSegments.length }})</div>
    }
    @for (segment of editableSegments; track segment.key) {
      <div class="row">
        <div class="col-sm-6">
          {{ segment.key }}:
        </div>
        <div class="col-sm-3">
          {{ segment.value }}
        </div>
        <div class="col-sm-3">
          @if (segment.value) {
            <div class="badge-button" (click)="clearSegment(segment.key)">
              <fa-icon [icon]="faEraser"></fa-icon>
              <span>delete</span>
            </div>
          }
        </div>
      </div>
    }`,
    imports: [FontAwesomeModule]
})
export class MailchimpSegmentEditorComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("MailchimpSegmentEditorComponent", NgxLoggerLevel.ERROR);
  public editableSegments: KeyValue<number>[] = [];
  protected readonly faEraser = faEraser;
  @Input()
  showTitle: boolean;
  @Input()
  segments: any;


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
