import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent, PageContentColumn, PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { AlertInstance } from "../../../services/notifier.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { UrlService } from "../../../services/url.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";

@Component({
  selector: "app-dynamic-content-view",
  templateUrl: "./dynamic-content-view.html",
  styleUrls: ["./dynamic-content.sass"],
})
export class DynamicContentViewComponent implements OnInit {

  @Input("pageContent") set acceptChangesFrom(pageContent: PageContent) {
    this.filterAndSet(pageContent);
  }

  @Input()
  public contentPath: string;
  @Input()
  public contentDescription: string;
  @Input()
  public notify: AlertInstance;
  private logger: Logger;
  public area: string;
  public viewablePageContent: PageContent;

  constructor(
    public siteEditService: SiteEditService,
    private memberResourcesReferenceData: MemberResourcesReferenceDataService,
    private urlService: UrlService,
    public actions: PageContentActionsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(DynamicContentViewComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.area = this.urlService.area();
  }

  private filterAndSet(pageContent: PageContent) {
    this.viewablePageContent = this.pageContentFilteredForAccessLevel(pageContent);
    this.logger.info("pageContent:", pageContent, "filteredPageContent:", this.viewablePageContent);
  }

  pageContentFilteredForAccessLevel(pageContent: PageContent): PageContent {
    const filteredPageContent: PageContent = {
      ...pageContent, rows: this.visibleRows(pageContent)?.map(row => {
        const columns = this.columnsFilteredForAccessLevel(row.columns);
        return {...row, columns};
      }) || []
    };
    this.logger.info("pageContentFilteredForAccessLevel:filteredPageContent:", filteredPageContent);
    return filteredPageContent;
  }

  columnsFilteredForAccessLevel(columns: PageContentColumn[]): PageContentColumn[] {
    return columns.filter(item => {
      const accessLevelData = this.memberResourcesReferenceData.accessLevelFor(item.accessLevel);
      return accessLevelData ? accessLevelData.filter() : true;
    });
  }

  visibleRows(pageContent: PageContent): PageContentRow[] {
    return pageContent?.rows?.filter(row => this.rowIsVisible(row));
  }

  private rowIsVisible(row: PageContentRow): boolean {
    return this.columnsFilteredForAccessLevel(row.columns).length > 0;
  }

}
