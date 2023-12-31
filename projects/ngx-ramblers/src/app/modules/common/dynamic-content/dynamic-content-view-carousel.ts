import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";

@Component({
  selector: "app-dynamic-content-view-carousel",
  template: `
      <ng-container *ngIf="actions.isCarousel(row)">
          <div [class]="actions.rowClasses(row)">
              <div class="col-sm-12">
                  <app-carousel [album]="row.carousel" [index]="index"></app-carousel>
              </div>
          </div>
      </ng-container>`,
})
export class DynamicContentViewCarouselComponent implements OnInit {

  @Input()
  public row: PageContentRow;

  @Input()
  public index: number;

  private logger: Logger;

  constructor(
    public actions: PageContentActionsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("DynamicContentViewCarouselComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
  }

}
