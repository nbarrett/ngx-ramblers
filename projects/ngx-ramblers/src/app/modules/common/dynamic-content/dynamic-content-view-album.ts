import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-dynamic-content-view-album",
  template: `
      <ng-container *ngIf="actions.isAlbum(row)">
          <div [class]="actions.rowClasses(row)">
              <div *ngIf="row.carousel.showTitle && row.carousel.title" class="col-sm-12">
                  <h1>{{row.carousel.title}}</h1>
                  <h2>{{row.carousel.eventDate | displayDate}} - <a *ngIf="row.carousel.eventId" delay="500"
                         [href]="urlService.linkUrl({area: row.carousel.eventType, id: row.carousel.eventId })">
                        {{row.carousel.subtitle}}</a>
                  </h2>
              </div>
              <div class="col-sm-12">
                  <app-album [album]="row.carousel" [index]="index"></app-album>
              </div>
          </div>
      </ng-container>`,
})
export class DynamicContentViewAlbumComponent implements OnInit {

  @Input()
  public row: PageContentRow;

  @Input()
  public index: number;

  private logger: Logger;

  constructor(public actions: PageContentActionsService,
              public urlService: UrlService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("DynamicContentViewAlbumComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
  }

}
