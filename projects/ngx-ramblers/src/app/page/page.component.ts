import { AfterViewInit, booleanAttribute, Component, effect, ElementRef, HostListener, inject, Input, OnDestroy, OnInit, signal, TemplateRef, ViewChild } from "@angular/core";
import { DOCUMENT, NgTemplateOutlet } from "@angular/common";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { HeadingAnchorService } from "../services/heading-anchors.service";
import { PageService } from "../services/page.service";
import { isEmpty } from "es-toolkit/compat";
import { RouterLink } from "@angular/router";
import { MarkdownComponent } from "ngx-markdown";

@Component({
    selector: "app-page",
    template: `
    <main>
      <div>
        @if (pageService.nested() && showBreadcrumb) {
          <div class="d-flex align-items-center gap-2 mb-1">
          <ul class="breadcrumb bg-transparent mb-0 ms-0 p-1 flex-grow-1">
            <span class="d-md-none">...</span>
            @for (page of pageService.relativePages(includeLastSegment); track page.href) {
              <li class="breadcrumb-item d-none d-md-inline">
                <a [routerLink]="'/' + page?.href" target="_self">{{ page?.title }}</a>
              </li>
            }
            <li class="breadcrumb-item d-none d-md-inline active">{{ suppliedOrDefaultPageTitle() }}</li>
          </ul>
          <ng-container [ngTemplateOutlet]="breadcrumbActions()"/>
          </div>
        }
        @if (displayedTitle() && showTitle) {
          <div class="page-heading" #pageHeading>
            @if (pageTitle) {
              <h1>{{ pageTitle }}</h1>
            } @else {
              <h1 class="content-page-title" markdown [data]="pageService.contentPageTitle()" [inline]="true"></h1>
            }
          </div>
        }
        <div class="page-content">
          <ng-content></ng-content>
        </div>
      </div>
    </main>
  `,
    styleUrls: ["./page.component.sass"],
    imports: [RouterLink, NgTemplateOutlet, MarkdownComponent]
})
export class PageComponent implements OnInit, AfterViewInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("PageComponent", NgxLoggerLevel.ERROR);
  pageService = inject(PageService);
  private headingAnchors = inject(HeadingAnchorService);
  private document = inject(DOCUMENT);
  private host = inject(ElementRef<HTMLElement>);
  readonly breadcrumbActions = signal<TemplateRef<unknown> | null>(null);
  readonly headingActions = signal<TemplateRef<unknown> | null>(null);
  @ViewChild("pageHeading") private pageHeading: ElementRef<HTMLElement> | null = null;
  private headingObserver: ResizeObserver | null = null;
  private titleHeightEffect = effect(() => {
    this.pageService.contentPageTitle();
    queueMicrotask(() => this.publishHeadingHeight());
  });

  public pageTitle: string;

  @Input({ transform: booleanAttribute }) autoTitle = false;

  @Input({ transform: booleanAttribute }) showTitle = true;

  @Input({ transform: booleanAttribute }) showBreadcrumb = true;

  @Input({ transform: booleanAttribute }) includeLastSegment = false;

  @Input("pageTitle") set acceptPageTitleChange(pageTitle: string) {
    this.logger.info("Input:pageTitle:", pageTitle);
    this.pageTitle = pageTitle;
    this.pageService.setTitle(pageTitle);
    this.publishHeadingHeight();
  }

  ngOnInit() {
    this.logger.info("ngOnInit:pageTitle:", this.pageTitle, "this.relativePages", this.pageService.relativePages(), "suppliedOrDefaultPageTitle:", this.suppliedOrDefaultPageTitle());
    this.pageService.setTitle(...this.pageService.relativePages().filter(item => !isEmpty(item?.href)).map(item => item?.title).concat(this.suppliedOrDefaultPageTitle()));
    if (this.autoTitle) {
      this.pageTitle = this.suppliedOrDefaultPageTitle();
    }
  }

  @HostListener("window:resize")
  onWindowResize() {
    this.publishHeadingHeight();
  }

  ngAfterViewInit() {
    this.headingAnchors.schedule();
    this.publishHeadingHeight();
    const ResizeObserverType = this.document.defaultView?.ResizeObserver;
    if (ResizeObserverType) {
      this.headingObserver = new ResizeObserverType(() => this.publishHeadingHeight());
      this.headingObserver.observe(this.host.nativeElement);
    }
  }

  ngOnDestroy() {
    this.headingObserver?.disconnect();
    this.document.documentElement.style.removeProperty("--page-heading-height");
  }

  private publishHeadingHeight(): void {
    const heading = this.pageHeading?.nativeElement
      || this.host.nativeElement.querySelector(".page-heading");
    const mobile = this.document.defaultView?.matchMedia("(max-width: 991.98px)").matches;
    const height = heading && mobile ? heading.getBoundingClientRect().height : 0;
    this.document.documentElement.style.setProperty("--page-heading-height", `${height}px`);
  }

  displayedTitle() {
    return this.pageTitle || this.pageService.contentPageTitle();
  }

  suppliedOrDefaultPageTitle() {
    this.logger.debug("suppliedOrDefaultPageTitle:pageTitle:", this.pageTitle, "pageSubtitle:", this.pageService.pageSubtitle());
    return this.pageTitle || this.pageService.pageSubtitle();
  }
}
