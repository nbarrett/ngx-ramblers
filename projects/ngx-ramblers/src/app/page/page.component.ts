import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { PageService } from "../services/page.service";
import isEmpty from "lodash-es/isEmpty";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { RouterLink } from "@angular/router";

@Component({
    selector: "app-page",
    template: `
    <main>
      <div class="container">
        @if (pageService.nested()) {
          <ul class="breadcrumb bg-transparent mb-1 ml-0 p-1">
            <span class="d-md-none">...</span>
            @for (page of pageService.relativePages(); track page.href) {
              <li class="breadcrumb-item d-none d-md-inline">
                <a [routerLink]="'/' + page?.href" target="_self">{{ page?.title }}</a>
              </li>
            }
            <li class="breadcrumb-item d-none d-md-inline active">{{ suppliedOrDefaultPageTitle() }}</li>
          </ul>
        }
        @if (pageTitle) {
          <h1>{{ pageTitle }}</h1>
        }
        <ng-content></ng-content>
      </div>
    </main>
  `,
    styleUrls: ["./page.component.sass"],
    imports: [RouterLink]
})
export class PageComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("PageComponent", NgxLoggerLevel.ERROR);
  pageService = inject(PageService);


  public pageTitle: string;

  public autoTitle: boolean;

  @Input("autoTitle") set autoTitleValue(value: boolean) {
    this.autoTitle = coerceBooleanProperty(value);
  }

  @Input("pageTitle") set acceptPageTitleChange(pageTitle: string) {
    this.logger.info("Input:pageTitle:", pageTitle);
    this.pageTitle = pageTitle;
    this.pageService.setTitle(pageTitle);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:pageTitle:", this.pageTitle, "this.relativePages", this.pageService.relativePages(), "suppliedOrDefaultPageTitle:", this.suppliedOrDefaultPageTitle());
    this.pageService.setTitle(...this.pageService.relativePages().filter(item => !isEmpty(item?.href)).map(item => item?.title).concat(this.suppliedOrDefaultPageTitle()));
    if (this.autoTitle) {
      this.pageTitle = this.suppliedOrDefaultPageTitle();
    }
  }


  suppliedOrDefaultPageTitle() {
    this.logger.debug("suppliedOrDefaultPageTitle:pageTitle:", this.pageTitle, "pageSubtitle:", this.pageService.pageSubtitle());
    return this.pageTitle || this.pageService.pageSubtitle();
  }
}

