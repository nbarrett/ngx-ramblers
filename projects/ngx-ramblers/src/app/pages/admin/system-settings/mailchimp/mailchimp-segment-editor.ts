import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import map from "lodash-es/map";
import { KeyValue } from "../../../../services/enums";
import { faEraser } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-mailchimp-segment-editor",
  templateUrl: "./mailchimp-segment-editor.html",
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
