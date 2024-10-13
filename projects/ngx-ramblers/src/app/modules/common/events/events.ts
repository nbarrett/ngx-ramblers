import { Component, inject, Input, OnInit } from "@angular/core";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEventType } from "../../../models/broadcast.model";
import { PageContent, PageContentRow } from "../../../models/content-text.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentService } from "../../../services/page-content.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-events",
  template: `
    <div [class]="actions.rowClasses(row)">
      <div class="col-sm-12">
        <app-social-events/>
      </div>
    </div>`
})
export class EventsComponent implements OnInit {

  public pageContentService: PageContentService = inject(PageContentService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public urlService: UrlService = inject(UrlService);
  public actions: PageContentActionsService = inject(PageContentActionsService);
  private broadcastService: BroadcastService<PageContent> = inject(BroadcastService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("EventsComponent", NgxLoggerLevel.ERROR);
  public instance = this;
  public faPencil = faPencil;
  public pageContent: PageContent;

  @Input()
  public row: PageContentRow;
  @Input() rowIndex: number;

  ngOnInit() {
    this.broadcastService.on(NamedEventType.PAGE_CONTENT_CHANGED, () => {
      this.logger.debug("event received:", NamedEventType.PAGE_CONTENT_CHANGED);
    });
  }

}
