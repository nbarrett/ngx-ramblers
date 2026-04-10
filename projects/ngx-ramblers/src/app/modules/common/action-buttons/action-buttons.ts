import { AfterViewInit, Component, ElementRef, HostListener, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { faMeetup } from "@fortawesome/free-brands-svg-icons";
import { isEqual, isUndefined, max, min } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import {
  PageContent,
  PageContentColumn,
  PageContentEditEvent,
  PageContentRow
} from "../../../models/content-text.model";
import { CropperDebugOffsets } from "../../../models/image-cropper.model";
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
import {
  DynamicContentSearchInputComponent,
  filterColumnsBySearchText
} from "../dynamic-content/dynamic-content-search-input";

@Component({
    selector: "app-action-buttons",
    template: `
      @if (row) {
        @if (row.allowSearch) {
          <app-dynamic-content-search-input (searchTextChange)="searchText = $event"/>
        }
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
        @if (row.showSwiper && viewableColumnCount() < pageContentColumns().length) {
          <div class="swiper-viewport"
               (dragstart)="$event.preventDefault()"
               (touchstart)="onDragStart($event)"
               (touchmove)="onDragMove($event)"
               (touchend)="onDragEnd($event)"
               (mousedown)="onDragStart($event)"
               (mousemove)="onDragMove($event)"
               (mouseup)="onDragEnd($event)"
               (mouseleave)="onDragEnd($event)">
            <div class="swiper-strip"
                 [class.dragging]="dragging"
                 [style.transform]="stripTransform"
                 [style.transition]="dragTransition">
              @for (column of pageContentColumns(); track column; let columnIndex = $index) {
                <div [style.flex]="slideFlexBasis"
                     [id]="actions.columnIdentifierFor(columnIndex,pageContent.path + '-card')">
                  <app-card-editor [presentationMode]="presentationMode"
                                   [smallIconContainer]="smallIconContainer()"
                                   [rowIndex]="rowIndex"
                                   [columnIndex]="columnIndex"
                                   [column]="column"
                                   [pageContent]="pageContent"
                                   [cropperDebugOffsets]="cropperDebugOffsets"
                                   (pageContentEditEvents)="pageContentEditEvents = pageContentEditService.handleEvent($event, pageContentEditEvents)">
                  </app-card-editor>
                </div>
              }
            </div>
          </div>
        } @else {
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
                                 [cropperDebugOffsets]="cropperDebugOffsets"
                                 (pageContentEditEvents)="pageContentEditEvents = pageContentEditService.handleEvent($event, pageContentEditEvents)">
                </app-card-editor>
              </div>
            }
          </div>
        }
      }`,
    styles: [`
.swiper-viewport
  overflow: hidden
  padding: 12px
  margin: -12px
  -webkit-user-select: none
  user-select: none

  img
    pointer-events: none
    -webkit-user-drag: none

.swiper-strip
  display: flex
  gap: 24px
  cursor: grab
  &.dragging
    cursor: grabbing
`],
    imports: [SvgComponent, CardEditorComponent, DynamicContentSearchInputComponent]
})
export class ActionButtons implements OnInit, AfterViewInit, OnDestroy {

  private elementRef = inject(ElementRef);
  public pageContentService: PageContentService = inject(PageContentService);
  public pageContentEditService: PageContentEditService = inject(PageContentEditService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public urlService: UrlService = inject(UrlService);
  public actions: PageContentActionsService = inject(PageContentActionsService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("ActionButtons", NgxLoggerLevel.ERROR);
  public instance = this;
  public slideIndex = 0;
  public maxViewableSlideCount: number;
  public faPencil = faPencil;
  public faMeetup = faMeetup;
  public pageContentEditEvents: PageContentEditEvent[] = [];
  public pageContent: PageContent;
  public rowIndex: number;
  public presentationMode: boolean;
  public searchText = "";

  @Input("presentationMode") set presentationModeValue(presentationMode: boolean) {
    this.presentationMode = coerceBooleanProperty(presentationMode);
  }

  @Input("pageContent") set pageContentValue(pageContent: PageContent) {
    this.pageContent = pageContent;
    const columns = this.pageContent?.rows?.[this.rowIndex]?.columns || [];
    const sample = columns.slice(0, 3).map(column => ({
      title: column.title,
      imageSource: column.imageSource,
      href: column.href
    }));
    if (this.pageContent && !isUndefined(this.rowIndex)) {
      this.logger.info("ActionButtons: pageContent set", this.pageContent?.path, "rowIndex", this.rowIndex, "presentationMode", this.presentationMode, "columns", columns.length, "sample", sample);
    } else if (this.pageContent) {
      this.logger.info("ActionButtons: pageContent set without rowIndex", this.pageContent?.path, "presentationMode", this.presentationMode);
    } else {
      this.logger.info("ActionButtons: pageContent set without content", "presentationMode", this.presentationMode);
    }
  }

  @Input("rowIndex") set rowIndexValue(rowIndex: number) {
    this.rowIndex = rowIndex;
    const columns = this.pageContent?.rows?.[this.rowIndex]?.columns || [];
    const sample = columns.slice(0, 3).map(column => ({
      title: column.title,
      imageSource: column.imageSource,
      href: column.href
    }));
    if (this.pageContent && !isUndefined(this.rowIndex)) {
      this.logger.info("ActionButtons: rowIndex set", this.pageContent?.path, "rowIndex", this.rowIndex, "presentationMode", this.presentationMode, "columns", columns.length, "sample", sample);
    } else if (this.pageContent) {
      this.logger.info("ActionButtons: rowIndex set without rowIndex", this.pageContent?.path, "presentationMode", this.presentationMode);
    } else {
      this.logger.info("ActionButtons: rowIndex set without content", "presentationMode", this.presentationMode);
    }
  }

  @Input() public cropperDebugOffsets: CropperDebugOffsets = null;

  @HostListener("window:resize")
  onResize() {
    this.applyMaxViewableSlideCount();
  }

  private captureClickHandler = (event: Event) => {
    if (this.dragOccurred) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.dragOccurred = false;
    }
  };

  ngOnInit() {
    this.applyMaxViewableSlideCount();
  }

  ngAfterViewInit() {
    this.elementRef.nativeElement.addEventListener("click", this.captureClickHandler, true);
  }

  ngOnDestroy() {
    this.elementRef.nativeElement.removeEventListener("click", this.captureClickHandler, true);
  }

  pageContentColumns(): PageContentColumn[] {
    return filterColumnsBySearchText(this.row?.columns || [], this.searchText);
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
    const configuredMax = this.row?.maxColumns || columns.length;
    const maxSlides = min([this.maxViewableSlideCount || columns.length, configuredMax]);
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
    const configuredMax = this.row?.maxColumns || columns;
    const maxSlides = min([this.maxViewableSlideCount || columns, configuredMax, columns]);
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
    const configuredMax = this.row?.maxColumns || columns;
    return min([columns, this.maxViewableSlideCount || columns, configuredMax]);
  }

  smallIconContainer(): boolean {
    const columns = this.pageContentColumns();
    const smallIcons = columns.filter(item => item.imageSource).length === 0;
    this.logger.debug("smallIconContainer:", columns, "->", smallIcons);
    return smallIcons;
  }

  private dragStartX: number = null;
  dragging = false;
  dragOffsetX = 0;
  private dragOccurred = false;
  private readonly SWIPE_THRESHOLD = 30;

  private readonly GAP_PX = 24;
  private readonly VIEWPORT_PAD = 12;

  get slideFlexBasis(): string {
    const n = this.viewableColumnCount();
    return `0 0 calc((100% - ${this.GAP_PX * (n - 1)}px) / ${n})`;
  }

  private get slideWidthPx(): number {
    const viewport = this.elementRef.nativeElement.querySelector(".swiper-viewport");
    if (!viewport) {
      return 300;
    }
    const n = this.viewableColumnCount();
    const availableWidth = viewport.clientWidth - 2 * this.VIEWPORT_PAD;
    return (availableWidth - this.GAP_PX * (n - 1)) / n;
  }

  get stripTransform(): string {
    const slideAndGap = this.slideWidthPx + this.GAP_PX;
    const baseOffset = -(this.slideIndex * slideAndGap);
    return `translateX(${baseOffset + this.dragOffsetX}px)`;
  }

  get dragTransition(): string {
    return this.dragging ? "none" : "transform 0.3s ease-out";
  }

  onDragStart(event: TouchEvent | MouseEvent): void {
    if (!this.row?.showSwiper) {
      return;
    }
    this.dragging = true;
    this.dragOccurred = false;
    this.dragStartX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX;
    this.dragOffsetX = 0;
  }

  onDragMove(event: TouchEvent | MouseEvent): void {
    if (!this.dragging || this.dragStartX === null) {
      return;
    }
    const currentX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX;
    this.dragOffsetX = currentX - this.dragStartX;
    if (Math.abs(this.dragOffsetX) > 5) {
      this.dragOccurred = true;
    }
    if (event instanceof TouchEvent && Math.abs(this.dragOffsetX) > 10) {
      event.preventDefault();
    }
  }

  onDragEnd(event?: TouchEvent | MouseEvent): void {
    if (!this.dragging || this.dragStartX === null) {
      this.dragging = false;
      this.dragOffsetX = 0;
      return;
    }
    let endX = this.dragStartX;
    if (event instanceof TouchEvent) {
      endX = event.changedTouches?.[0]?.clientX ?? this.dragStartX;
    } else if (event instanceof MouseEvent) {
      endX = event.clientX;
    }
    const deltaX = endX - this.dragStartX;
    const absDelta = Math.abs(deltaX);
    if (absDelta >= this.SWIPE_THRESHOLD) {
      const slidesToMove = max([1, Math.round(absDelta / this.slideWidthPx)]);
      const totalColumns = this.pageContentColumns().length;
      const maxSlideIndex = totalColumns - this.viewableColumnCount();
      if (deltaX < 0) {
        this.slideIndex = min([this.slideIndex + slidesToMove, maxSlideIndex]);
      } else {
        this.slideIndex = max([0, this.slideIndex - slidesToMove]);
      }
    }
    this.dragging = false;
    this.dragStartX = null;
    this.dragOffsetX = 0;
  }
}
