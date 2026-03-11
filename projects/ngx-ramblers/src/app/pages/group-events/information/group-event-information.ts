import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { ContentMetadataItem } from "../../../models/content-metadata.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { GroupEventDisplayService } from "../group-event-display.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";

@Component({
    selector: "app-group-event-information",
    styleUrls: ["./group-event-information.sass"],
    templateUrl: "./group-event-information.html",
    imports: [MarkdownEditorComponent]
})
export class GroupEventInformation implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventInformation", NgxLoggerLevel.ERROR);
  display = inject(GroupEventDisplayService);
  protected dateUtils = inject(DateUtilsService);

  @Input()
  public notifyTarget: AlertTarget;
  public slides: ContentMetadataItem[];
  public image: any;


  ngOnInit() {
    this.logger.info("created");
  }

}
