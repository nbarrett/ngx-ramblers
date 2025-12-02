import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { IndexRenderMode, PageContent, PageContentRow } from "../../../models/content-text.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { AlbumIndexService } from "../../../services/album-index.service";
import { ActionButtonsComponent } from "../action-buttons/action-buttons";
import { DynamicContentViewAlbumIndexMapComponent } from "./dynamic-content-view-album-index-map";

@Component({
    selector: "app-dynamic-content-view-album-index",
    template: `
    @if (actions.isAlbumIndex(row)) {
      @for (renderMode of getRenderModes(); track renderMode) {
        @if (renderMode === IndexRenderMode.ACTION_BUTTONS) {
          <app-action-buttons
            [pageContent]="albumIndexPageContent"
            [rowIndex]="0"/>
        }
        @if (renderMode === IndexRenderMode.MAP) {
          <app-dynamic-content-view-album-index-map
            [pageContent]="albumIndexPageContent"
            [mapHeight]="row.albumIndex.mapConfig?.height || 500"
            [clusteringEnabled]="row.albumIndex.mapConfig?.clusteringEnabled ?? true"
            [clusteringThreshold]="row.albumIndex.mapConfig?.clusteringThreshold || 10"/>
        }
      }
    }`,
    imports: [ActionButtonsComponent, DynamicContentViewAlbumIndexMapComponent]
})
export class DynamicContentViewAlbumIndexComponent implements OnInit {

  @Input()
  public row: PageContentRow;
  public albumIndexPageContent: PageContent;
  public actions: PageContentActionsService = inject(PageContentActionsService);
  public albumIndexService: AlbumIndexService = inject(AlbumIndexService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("DynamicContentViewAlbumIndexComponent", NgxLoggerLevel.ERROR);
  protected readonly IndexRenderMode = IndexRenderMode;

  async ngOnInit() {
    const albumIndex = this.row.albumIndex;
    this.albumIndexPageContent = await this.albumIndexService.albumIndexToPageContent(this.row, 0);
    this.logger.info("row", this.row, "albumIndex:", albumIndex, "albumIndexPageContent:", this.albumIndexPageContent);
  }

  getRenderModes(): IndexRenderMode[] {
    return this.row.albumIndex?.renderModes || [IndexRenderMode.ACTION_BUTTONS];
  }

}
