import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { CarouselComponent } from "../../../carousel/view/carousel";

@Component({
    selector: "app-dynamic-content-view-carousel",
    template: `
      @if (actions.isCarousel(row)) {
        <div [class]="actions.rowClasses(row)">
          <div class="col-sm-12">
            <app-carousel [album]="row.carousel" [index]="index"></app-carousel>
          </div>
        </div>
      }`,
    imports: [CarouselComponent]
})
export class DynamicContentViewCarousel implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentViewCarouselComponent", NgxLoggerLevel.ERROR);
  actions = inject(PageContentActionsService);


  @Input()
  public row: PageContentRow;

  @Input()
  public index: number;

  ngOnInit() {
    this.logger.info("created for index", this.index, "row:", this.row);
  }

}
