import { Component, HostListener, inject, Input, OnInit } from "@angular/core";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { isEqual, max, min } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import {
  PageContent,
  PageContentColumn,
  PageContentEditEvent,
  PageContentRow
} from "../../../models/content-text.model";
import { DeviceSize } from "../../../models/page.model";
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
          @if (row.showSwiper && viewableColumnCount() < pageContentColumns().length) {
            <div class="d-flex align-items-center mb-3 col">
              <div class="flex-shrink-0">
                <button aria-label="Previous slide" class="text-dark border-0 bg-transparent p-0 me-1">
                  <app-svg (click)="back()"
                           [disabled]="backDisabled()"
                           class="icon"
                           height="36"
                           width="36"
                           icon="i-back-round">
                  </app-svg>
                  <span class="visually-hidden">Previous slide</span></button>
                <button aria-label="Next slide" class="text-dark border-0 bg-transparent p-0">
                  <app-svg (click)="forward()"
                           [disabled]="forwardDisabled()"
                           class="icon"
                           height="36"
                           width="36"
                           icon="i-forward-round">
                  </app-svg>
                  <span class="visually-hidden">Next slide</span></button>
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
                               [columnIndex]="columnIndex"
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
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("ActionButtonsComponent", NgxLoggerLevel.ERROR);
  public instance = this;
  public slideIndex = 0;
  public maxViewableSlideCount: number;
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
  }

  @Input("rowIndex") set rowIndexValue(rowIndex: number) {
    this.rowIndex = rowIndex;
  }

  @HostListener("window:resize", ["event"])
  onResize() {
    this.applyMaxViewableSlideCount();
  }

  ngOnInit() {
    this.applyMaxViewableSlideCount();
  }

  pageContentColumns(): PageContentColumn[] {
    return this.row?.columns || [];
  }

  private determineMaxViewableSlideCount(): number {
    if (window.innerWidth <= DeviceSize.MEDIUM) {
      return 1;
    } else if (window.innerWidth <= DeviceSize.LARGE) {
      return 2;
    } else if (window.innerWidth <= DeviceSize.EXTRA_LARGE) {
      return 3;
    } else {
      return 4;
    }
  }

  private applyMaxViewableSlideCount() {
    this.maxViewableSlideCount = this.determineMaxViewableSlideCount();
  }

  slideClasses(column: PageContentColumn) {
    const row = this.row;
    const maxColumns = row?.maxColumns || this.viewableColumnCount();
    return this.columnInEditMode(column) ? "col-md-6" : cardClasses(maxColumns, CARD_MARGIN_BOTTOM);
  }

  columnInEditMode(column: PageContentColumn) {
    const row = this.row;
    const columnIndex = row?.columns?.indexOf(column);
    return this.pageContentEditEvents.find(item => isEqual(item,
      {columnIndex, rowIndex: this.rowIndex, path: this.pageContent?.path, editActive: true}));
  }

  viewableColumns(): PageContentColumn[] {
    const columns = this.pageContentColumns();
    if (!this.row?.showSwiper) {
      return columns;
    }
    const maxSlides = this.maxViewableSlideCount || columns.length;
    const total = columns.length;
    const clampedMaxSlides = min([maxSlides, total]);
    const maxStart = Math.max(0, total - clampedMaxSlides);
    this.slideIndex = max([0, Math.min(this.slideIndex, maxStart)]);
    const endIndex = Math.min(this.slideIndex + clampedMaxSlides, total);
    return columns.slice(this.slideIndex, endIndex);
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
    const columns = this.pageContentColumns().length;
    const maxSlides = min([this.maxViewableSlideCount || columns, columns]);
    return this.slideIndex + maxSlides < columns;
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

  get row(): PageContentRow | undefined {
    return this.pageContent?.rows?.[this.rowIndex];
  }

  viewableColumnCount(): number {
    const columns = this.pageContentColumns().length;
    return min([columns, this.maxViewableSlideCount || columns]);
  }

  smallIconContainer(): boolean {
    const columns = this.pageContentColumns();
    const smallIcons = columns.filter(item => item.imageSource).length === 0;
    this.logger.debug("smallIconContainer:", columns, "->", smallIcons);
    return smallIcons;
  }
}
