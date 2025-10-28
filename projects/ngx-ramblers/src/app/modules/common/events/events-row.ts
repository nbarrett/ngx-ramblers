import { Component, inject, Input, OnInit } from "@angular/core";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent, PageContentRow } from "../../../models/content-text.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentService } from "../../../services/page-content.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { Events } from "./events";

@Component({
    selector: "app-events-row",
    template: `
    <div [class]="actions.rowClasses(row)">
      <div class="col-sm-12">
        <app-events [eventsData]="row.events"/>
      </div>
    </div>`,
    imports: [Events]
})
export class EventsRow implements OnInit {

  public pageContentService: PageContentService = inject(PageContentService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public urlService: UrlService = inject(UrlService);
  public actions: PageContentActionsService = inject(PageContentActionsService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("EventsComponent", NgxLoggerLevel.ERROR);
  public instance = this;
  public faPencil = faPencil;
  public pageContent: PageContent;

  @Input()
  public row: PageContentRow;
  @Input() rowIndex: number;

  ngOnInit() {
    this.logger.debug("row:", this.row);
  }

}
