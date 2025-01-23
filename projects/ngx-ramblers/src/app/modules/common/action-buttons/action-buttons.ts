import { Component, HostListener, inject, Input, OnInit } from "@angular/core";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import isEqual from "lodash-es/isEqual";
import max from "lodash-es/max";
import min from "lodash-es/min";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEventType } from "../../../models/broadcast.model";
import {
  PageContent,
  PageContentColumn,
  PageContentEditEvent,
  PageContentRow
} from "../../../models/content-text.model";
import { DeviceSize } from "../../../models/page.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { CARD_MARGIN_BOTTOM, cardClasses } from "../../../services/card-utils";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentService } from "../../../services/page-content.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { PageContentEditService } from "../../../services/page-content-edit.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { SvgComponent } from "../svg/svg";
import { CardEditorComponent } from "../card-editor/card-editor";

@Component({
    selector: "app-action-buttons",
    template: `
    @if (row) {
      <div class="row">
        @if (row.showSwiper && maxViewableSlideCount < pageContentColumns().length) {
          <div
            class="d-flex align-items-center mb-3 col">
            <div class="flex-shrink-0">
              <button aria-label="Previous slide" class="text-dark border-0 bg-transparent p-0 mr-1">
                <app-svg (click)="back()"
                         [disabled]="backDisabled()"
                         class="icon"
                         height="36"
                         width="36"
                         icon="i-back-round">
                </app-svg>
                <span class="sr-only">Previous slide</span></button>
              <button aria-label="Next slide" class="text-dark border-0 bg-transparent p-0">
                <app-svg (click)="forward()"
                         [disabled]="forwardDisabled()"
                         class="icon"
                         height="36"
                         width="36"
                         icon="i-forward-round">
                </app-svg>
                <span class="sr-only">Next slide</span></button>
            </div>
          </div>
        }
      </div>
      <div class="row">
        @for (column of viewableColumns(); track column; let columnIndex = $index) {
          <div [class]="slideClasses(column)"
               [id]="actions.columnIdentifierFor(columnIndex,pageContent.path + '-card')">
            <app-card-editor [presentationMode]="presentationMode"
                             [smallIconContainer]="smallIconContainer()"
                             [rowIndex]="rowIndex"
                             [column]="column"
                             [pageContent]="pageContent"
                             (pageContentEditEvents)="pageContentEditEvents = pageContentEditService.handleEvent($event, pageContentEditEvents)">
            </app-card-editor>
          </div>
        }
      </div>
    }`,
    imports: [SvgComponent, CardEditorComponent]
})
export class ActionButtonsComponent implements OnInit {

  public pageContentService: PageContentService = inject(PageContentService);
  public pageContentEditService: PageContentEditService = inject(PageContentEditService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public urlService: UrlService = inject(UrlService);
  public actions: PageContentActionsService = inject(PageContentActionsService);
  private broadcastService: BroadcastService<PageContent> = inject(BroadcastService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("ActionButtonsComponent", NgxLoggerLevel.ERROR);
  public instance = this;
  public slideIndex = 0;
  public maxViewableSlideCount: number;
  public actualViewableSlideCount: number;
  public row: PageContentRow;
  public faPencil = faPencil;
  public pageContentEditEvents: PageContentEditEvent[] = [];
  public pageContent: PageContent;
  public rowIndex: number;
  public presentationMode: boolean;

  @Input("presentationMode") set presentationModeValue(presentationMode: boolean) {
    this.presentationMode = coerceBooleanProperty(presentationMode);
  }

  @Input("pageContent") set pageContentValue(pageContent: PageContent) {
    this.pageContent = pageContent;
    this.initialiseViewableRow();
  }

  @Input("rowIndex") set rowIndexValue(rowIndex: number) {
    this.rowIndex = rowIndex;
    this.initialiseViewableRow();
  }

  @HostListener("window:resize", ["event"])
  onResize() {
    this.determineViewableSlideCount();
  }

  ngOnInit() {
    this.initialiseViewableRow();
    this.broadcastService.on(NamedEventType.PAGE_CONTENT_CHANGED, () => {
      this.logger.debug("event received:", NamedEventType.PAGE_CONTENT_CHANGED);
      this.pageColumnsChanged();
    });
  }

  private initialiseViewableRow() {
    if (this.rowIndex >= 0 && this.pageContent?.rows) {
      this.row = this.pageContent?.rows?.[this.rowIndex];
      this.logger.info("initialised with contentPath:", this.pageContent?.path);
      this.determineViewableSlideCount();
      this.pageColumnsChanged();
    } else {
      this.logger.info("not initialised with rowIndex:", this.rowIndex, "rows:", this.pageContent?.rows);
    }
  }

  private pageColumnsChanged() {
    this.actualViewableSlideCount = min([this.pageContentColumns()?.length, this.maxViewableSlideCount]);
  }

  pageContentColumns(): PageContentColumn[] {
    return this.pageContent?.rows?.[this.rowIndex]?.columns;
  }

  private determineViewableSlideCount() {
    if (window.innerWidth <= DeviceSize.MEDIUM) {
      this.maxViewableSlideCount = 1;
    } else if (window.innerWidth <= DeviceSize.LARGE) {
      this.maxViewableSlideCount = 2;
    } else if (window.innerWidth <= DeviceSize.EXTRA_LARGE) {
      this.maxViewableSlideCount = 3;
    } else {
      this.maxViewableSlideCount = 4;
    }
    this.logger.debug("determineViewableSlideCount:", window.innerWidth, "maxViewableSlideCount", this.maxViewableSlideCount);
  }

  slideClasses(column: PageContentColumn) {
    return this.columnInEditMode(column) ? "col-md-6" : cardClasses(this.row.maxColumns || this.actualViewableSlideCount, CARD_MARGIN_BOTTOM);
  }

  columnInEditMode(column: PageContentColumn) {
    const columnIndex = this.row.columns.indexOf(column);
    return this.pageContentEditEvents.find(item => isEqual(item,
      {columnIndex, rowIndex: this.rowIndex, path: this.pageContent?.path, editActive: true}));
  }

  viewableColumns(): PageContentColumn[] {
    const columns = this.pageContentColumns();
    if (this.row.showSwiper) {
      const endIndex = this.slideIndex + this.maxViewableSlideCount;
      const viewableSlides: PageContentColumn[] = columns?.slice(this.slideIndex, endIndex);
      this.logger.debug("viewableSlides:slideIndex", this.slideIndex, "end index:", endIndex, "all slides:", columns, "viewableSlideCount:", this.maxViewableSlideCount, "viewableSlides:", viewableSlides);
      return viewableSlides;
    } else {
      return columns;
    }
  }

  back() {
    this.slideIndex = max([0, this.slideIndex - 1]);
    this.logger.debug("back:slideIndex", this.slideIndex);
  }

  forward() {
    const columnCount = this.pageContentColumns().length;
    if (this.forwardPossible()) {
      this.slideIndex = min([this.slideIndex + 1, columnCount - 1]);
      this.logger.debug("forward:slideIndex", this.slideIndex);
    } else {
      this.logger.debug("forward:cant go further - slideIndex", this.slideIndex);
    }
  }

  private forwardPossible() {
    return this.maxViewableSlideCount + this.slideIndex < this.pageContentColumns().length;
  }

  backDisabled(): boolean {
    const disabled = this.slideIndex === 0;
    this.logger.debug("backDisabled:", disabled);
    return disabled;
  }

  forwardDisabled(): boolean {
    const disabled = !this.forwardPossible();
    this.logger.debug("forwardDisabled:", disabled);
    return disabled;
  }


  smallIconContainer(): boolean {
    const smallIcons = this.row.columns.filter(item => item.imageSource).length === 0;
    this.logger.debug("smallIconContainer:", this.row, "->", smallIcons);
    return smallIcons;
  }
}
