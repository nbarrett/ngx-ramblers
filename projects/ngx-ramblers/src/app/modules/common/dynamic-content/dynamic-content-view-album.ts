import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";

@Component({
  selector: "app-dynamic-content-view-album",
  template: `
    <ng-container *ngIf="actions.isAlbum(row)">
      <div [class]="actions.rowClasses(row)">
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
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("DynamicContentViewAlbumComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
  }

}
