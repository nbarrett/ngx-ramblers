import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent, PageContentRow } from "../../../models/content-text.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { AlbumIndexService } from "../../../services/album-index.service";

@Component({
  selector: "app-dynamic-content-view-album-index",
  template: `
    @if (actions.isAlbumIndex(row)) {
      <app-action-buttons
        [pageContent]="albumIndexPageContent"
        [rowIndex]="0"/>
    }`,
  standalone: false
})
export class DynamicContentViewAlbumIndexComponent implements OnInit {

  @Input()
  public row: PageContentRow;
  public albumIndexPageContent: PageContent;
  public actions: PageContentActionsService = inject(PageContentActionsService);
  public albumIndexService: AlbumIndexService = inject(AlbumIndexService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("DynamicContentViewAlbumIndexComponent", NgxLoggerLevel.ERROR);

  async ngOnInit() {
    const albumIndex = this.row.albumIndex;
    this.albumIndexPageContent = await this.albumIndexService.albumIndexToPageContent(this.row, 0);
    this.logger.info("row", this.row, "albumIndex:", albumIndex, "albumIndexPageContent:", this.albumIndexPageContent);
  }

}
