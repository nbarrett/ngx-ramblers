import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { UrlService } from "../../../services/url.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";

@Component({
  selector: "app-dynamic-content-view-text-row",
  templateUrl: "./dynamic-content-view-text-row.html",
  styleUrls: ["./dynamic-content.sass"],
})
export class DynamicContentViewTextRowComponent implements OnInit {
  @Input()
  public row: PageContentRow;
  @Input()
  public rowIndex: number;
  @Input()
  public contentPath: string;
  @Input()
  public contentDescription: string;
  @Input()
  public bordered: boolean;

  private logger: Logger;

  constructor(
    public siteEditService: SiteEditService,
    private memberResourcesReferenceData: MemberResourcesReferenceDataService,
    private urlService: UrlService,
    public actions: PageContentActionsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(DynamicContentViewTextRowComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
  }

}
