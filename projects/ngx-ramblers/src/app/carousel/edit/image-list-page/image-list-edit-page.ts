import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { UrlService } from "../../../services/url.service";
import { Subscription } from "rxjs";
import { StoredValue } from "../../../models/ui-actions";
import { ActivatedRoute } from "@angular/router";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Component({
  selector: "app-list-edit-page",
  templateUrl: "./image-list-edit-page.html"
})
export class ImageListEditPageComponent implements OnInit, OnDestroy {
  public editing = this.urlService.lastPathSegment() !== "carousel-editor";
  private subscriptions: Subscription[] = [];
  private logger: Logger;

  constructor(private activatedRoute: ActivatedRoute,
              private urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("ImageListEditPageComponent", NgxLoggerLevel.OFF);
  }

  @Input()
  name: string;

  ngOnInit() {
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const carousel = params[StoredValue.CAROUSEL];
      if (carousel) {
        this.name = carousel;
      }
      this.editing = !!carousel;
      this.logger.info("carousel:", carousel, "editing:", this.editing);
    }));

  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  backToEditorHome() {
    this.urlService.navigateUnconditionallyTo(["admin", "carousel-editor"], {[StoredValue.CAROUSEL]: null});
  }
}
