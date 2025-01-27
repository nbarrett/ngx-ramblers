import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { ContentMetadataItem } from "../../../models/content-metadata.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SocialDisplayService } from "../social-display.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";

@Component({
    selector: "app-social-information",
    styleUrls: ["./social-information.component.sass"],
    templateUrl: "./social-information.component.html",
    imports: [MarkdownEditorComponent]
})
export class SocialInformationComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialInformationComponent", NgxLoggerLevel.ERROR);
  display = inject(SocialDisplayService);
  protected dateUtils = inject(DateUtilsService);

  @Input()
  public notifyTarget: AlertTarget;
  public slides: ContentMetadataItem[];
  public image: any;


  ngOnInit() {
    this.logger.info("created");
  }

}
