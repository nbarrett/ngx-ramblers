import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { IndexRenderMode, PageContent, PageContentRow } from "../../../models/content-text.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { AlbumIndexService } from "../../../services/album-index.service";
import { ActionButtonsComponent } from "../action-buttons/action-buttons";
import { DynamicContentViewAlbumIndexMapComponent } from "./dynamic-content-view-album-index-map";
import { FormsModule } from "@angular/forms";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-dynamic-content-view-album-index",
    template: `
    @if (actions.isAlbumIndex(row)) {
      @if (shouldShowSearch()) {
        <div class="row mb-3">
          <div class="col-md-6">
            <div class="input-group">
              <span class="input-group-text">
                <fa-icon [icon]="faSearch"></fa-icon>
              </span>
              <input type="text"
                     class="form-control"
                     placeholder="Search..."
                     [(ngModel)]="searchText"
                     (ngModelChange)="onSearchChange()">
            </div>
          </div>
        </div>
      }
      @for (renderMode of getRenderModes(); track renderMode) {
        @if (renderMode === IndexRenderMode.ACTION_BUTTONS) {
          <app-action-buttons
            [pageContent]="filteredPageContent()"
            [rowIndex]="0"/>
        }
        @if (renderMode === IndexRenderMode.MAP) {
          <app-dynamic-content-view-album-index-map
            [pageContent]="filteredPageContent()"
            [mapHeight]="row.albumIndex.mapConfig?.height || 500"
            [clusteringEnabled]="row.albumIndex.mapConfig?.clusteringEnabled ?? true"
            [clusteringThreshold]="row.albumIndex.mapConfig?.clusteringThreshold || 10"/>
        }
      }
    }`,
    imports: [ActionButtonsComponent, DynamicContentViewAlbumIndexMapComponent, FormsModule, FontAwesomeModule]
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
  protected readonly faSearch = faSearch;
  public searchText = "";

  async ngOnInit() {
    const albumIndex = this.row.albumIndex;
    this.albumIndexPageContent = await this.albumIndexService.albumIndexToPageContent(this.row, 0);
    this.logger.info("row", this.row, "albumIndex:", albumIndex, "albumIndexPageContent:", this.albumIndexPageContent);
  }

  getRenderModes(): IndexRenderMode[] {
    return this.row.albumIndex?.renderModes || [IndexRenderMode.ACTION_BUTTONS];
  }

  shouldShowSearch(): boolean {
    return (this.albumIndexPageContent?.rows?.[0]?.columns?.length || 0) > 5;
  }

  onSearchChange() {
    this.logger.info("Search text changed:", this.searchText);
  }

  filteredPageContent(): PageContent {
    if (!this.searchText || !this.albumIndexPageContent) {
      return this.albumIndexPageContent;
    }

    const searchLower = this.searchText.toLowerCase();
    const filteredColumns = this.albumIndexPageContent.rows[0].columns.filter(column => {
      const titleMatch = column.title?.toLowerCase().includes(searchLower);
      const contentMatch = column.contentText?.toLowerCase().includes(searchLower);
      return titleMatch || contentMatch;
    });

    return {
      ...this.albumIndexPageContent,
      rows: [{
        ...this.albumIndexPageContent.rows[0],
        columns: filteredColumns
      }]
    };
  }

}
