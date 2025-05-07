import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent, PageContentColumn, PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { AlertInstance } from "../../../services/notifier.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { UrlService } from "../../../services/url.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { Subscription } from "rxjs";
import { ActionButtonsComponent } from "../action-buttons/action-buttons";
import { DynamicContentViewTextRowComponent } from "./dynamic-content-view-text-row";
import { DynamicContentViewCarouselComponent } from "./dynamic-content-view-carousel";
import { DynamicContentViewAlbumIndexComponent } from "./dynamic-content-view-album-index";
import { DynamicContentViewAlbumComponent } from "./dynamic-content-view-album";
import { EventsComponent } from "../events/events";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { JsonPipe } from "@angular/common";

@Component({
    selector: "app-dynamic-content-view",
    template: `
      @if (!siteEditService.active()) {
        @for (row of viewablePageContent.rows; let rowIndex = $index; track rowIndex) {
          @if (false) {
            {{ 'row ' + (rowIndex + 1) + ' ' + row.type + ' of ' + viewablePageContent.rows.length }}
          }
          @if (actions.isActionButtons(row)) {
            <app-action-buttons
              [pageContent]="viewablePageContent"
              [rowIndex]="rowIndex"/>
          }
          @if (actions.isTextRow(row)) {
            <app-dynamic-content-view-text-row
              [row]="row"
              [rowIndex]="rowIndex"
              [contentPath]="contentPath"
              [contentDescription]="contentDescription"/>
          }
          @if (actions.isCarousel(row)) {
            <app-dynamic-content-view-carousel
              [row]="row"
              [index]="actions.carouselOrAlbumIndex(row, viewablePageContent)"/>
          }
          @if (actions.isAlbumIndex(row)) {
            <app-dynamic-content-view-album-index [row]="row"/>
          }
          @if (actions.isAlbum(row)) {
            <app-dynamic-content-view-album
              [row]="row"
              [index]="actions.carouselOrAlbumIndex(row, viewablePageContent)"/>
          }
          @if (actions.isEvents(row)) {
            <app-events [row]="row" [rowIndex]="rowIndex"/>
          }
        }
        @if (!actions.pageContentFound(viewablePageContent, !!viewablePageContent?.id)) {
          @if (notify.alertTarget.showAlert) {
            <div class="col-12 alert {{notify.alertTarget.alertClass}} mt-3">
              <fa-icon [icon]="notify.alertTarget.alert.icon"></fa-icon>
              <strong class="ml-2">{{ notify.alertTarget.alertTitle }}</strong>
              <span class="p-2">{{ notify.alertTarget.alertMessage }}. <a [href]="area"
                                                                          class="rams-text-decoration-pink"
                                                                          type="button"> Go Back to {{ area }}
                page</a></span>
            </div>
          }
        }
      }`,
    styleUrls: ["./dynamic-content.sass"],
  imports: [ActionButtonsComponent, DynamicContentViewTextRowComponent, DynamicContentViewCarouselComponent, DynamicContentViewAlbumIndexComponent, DynamicContentViewAlbumComponent, EventsComponent, FontAwesomeModule, JsonPipe]
})
export class DynamicContentViewComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentViewComponent", NgxLoggerLevel.ERROR);
  private memberResourcesReferenceData = inject(MemberResourcesReferenceDataService);
  private urlService = inject(UrlService);
  actions = inject(PageContentActionsService);
  siteEditService = inject(SiteEditService);
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
  public area: string;
  public viewablePageContent: PageContent;
  private subscriptions: Subscription[] = [];

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
    return row.columns.length === 0 || this.columnsFilteredForAccessLevel(row.columns).length > 0;
  }

}
