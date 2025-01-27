import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { UrlService } from "../../../services/url.service";
import { Subscription } from "rxjs";
import { StoredValue } from "../../../models/ui-actions";
import { ActivatedRoute } from "@angular/router";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { PageComponent } from "../../../page/page.component";
import { LoginRequiredComponent } from "../../../modules/common/login-required/login-required";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { CarouselSelectorComponent } from "../carousel-selector/carousel-selector";
import { ImageListEditComponent } from "../image-list-edit/image-list-edit";

@Component({
    selector: "app-list-edit-page",
    templateUrl: "./image-list-edit-page.html",
    imports: [PageComponent, LoginRequiredComponent, MarkdownEditorComponent, CarouselSelectorComponent, ImageListEditComponent]
})
export class ImageListEditPageComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("ImageListEditPageComponent", NgxLoggerLevel.ERROR);
  private activatedRoute = inject(ActivatedRoute);
  private urlService = inject(UrlService);
  public editing = this.urlService.lastPathSegment() !== "carousel-editor";
  private subscriptions: Subscription[] = [];
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
