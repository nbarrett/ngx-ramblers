import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent, PageContentColumn, PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { AlertInstance } from "../../../services/notifier.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { UrlService } from "../../../services/url.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { Subscription } from "rxjs";

@Component({
  selector: "app-dynamic-content-view",
  template: `
    <ng-container *ngIf="!siteEditService.active()">
      <ng-container *ngFor="let row of viewablePageContent.rows; let rowIndex = index;">
        <ng-container *ngIf="false">{{ 'row ' + (rowIndex + 1) + ' ' + row.type }}</ng-container>
        <app-action-buttons *ngIf="actions.isActionButtons(row)"
                            [pageContent]="viewablePageContent"
                            [rowIndex]="rowIndex"/>
        <app-dynamic-content-view-text-row *ngIf="actions.isTextRow(row)"
                                           [row]="row"
                                           [rowIndex]="rowIndex"
                                           [contentPath]="contentPath"
                                           [contentDescription]="contentDescription"/>
        <app-dynamic-content-view-carousel *ngIf="actions.isCarousel(row)"
                                           [row]="row"
                                           [index]="actions.carouselOrAlbumIndex(row, viewablePageContent)"/>
        <app-dynamic-content-view-album-index *ngIf="actions.isAlbumIndex(row)" [row]="row"/>
        <app-dynamic-content-view-album *ngIf="actions.isAlbum(row)"
                                        [row]="row"
                                        [index]="actions.carouselOrAlbumIndex(row, viewablePageContent)"/>
        <app-events *ngIf="actions.isEvents(row)" [row]="row" [rowIndex]="rowIndex"/>
      </ng-container>
      <ng-container *ngIf="!actions.pageContentFound(viewablePageContent, !!viewablePageContent?.id)">
        <div *ngIf="notify.alertTarget.showAlert" class="col-12 alert {{notify.alertTarget.alertClass}} mt-3">
          <fa-icon [icon]="notify.alertTarget.alert.icon"></fa-icon>
          <strong class="ml-2">{{ notify.alertTarget.alertTitle }}</strong>
          <span class="p-2">{{ notify.alertTarget.alertMessage }}. <a [href]="area" class="rams-text-decoration-pink"
                                                                      type="button"> Go Back to {{ area }}
            page</a></span>
        </div>
      </ng-container>
    </ng-container>`,
  styleUrls: ["./dynamic-content.sass"],
  standalone: false
})
export class DynamicContentViewComponent implements OnInit, OnDestroy {
  private pageContentRawData: PageContent;

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
  private subscriptions: Subscription[] = [];
  constructor(
    private memberResourcesReferenceData: MemberResourcesReferenceDataService,
    private urlService: UrlService,
    public actions: PageContentActionsService,
    public siteEditService: SiteEditService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("DynamicContentViewComponent", NgxLoggerLevel.ERROR);
  }

  ngOnInit() {
    this.area = this.urlService.area();
    this.logger.info("ngOnInit called for", this.area);
    this.subscriptions.push(this.siteEditService.events.subscribe(event => {
      this.logger.info("site edit toggled to", event.data);
      if (!event.data) {
        this.filterAndSet(this.pageContentRawData);
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private filterAndSet(pageContent: PageContent) {
    this.pageContentRawData = pageContent;
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
