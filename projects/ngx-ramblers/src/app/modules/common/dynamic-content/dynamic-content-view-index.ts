import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { IndexRenderMode, PageContent, PageContentRow } from "../../../models/content-text.model";
import { DEFAULT_OS_STYLE, MapProvider } from "../../../models/map.model";
import { MapDefaultsService } from "../../../services/maps/map-defaults.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { ActionButtons } from "../action-buttons/action-buttons";
import { DynamicContentViewIndexMap } from "./dynamic-content-view-index-map";
import { IndexService } from "../../../services/index.service";
import { MarkdownComponent } from "ngx-markdown";
import { PageService } from "../../../services/page.service";
import {
  DynamicContentSearchInputComponent,
  filterColumnsBySearchText
} from "./dynamic-content-search-input";

@Component({
    selector: "app-dynamic-content-view-index",
    template: `
      @if (actions.isIndex(row)) {
        @if (indexMarkdown()) {
          <div class="mb-3" markdown [data]="indexMarkdown()"></div>
        }
        @if (shouldShowSearch()) {
          <app-dynamic-content-search-input (searchTextChange)="searchText = $event"/>
        }
        @for (renderMode of getRenderModes(); track renderMode) {
          @if (renderMode === IndexRenderMode.ACTION_BUTTONS) {
            <app-action-buttons
              [pageContent]="filteredPageContent()"
              [rowIndex]="0"/>
          }
          @if (renderMode === IndexRenderMode.MAP) {
            <div class="mt-3 mb-3">
              <app-dynamic-content-view-index-map
                [pageContent]="filteredPageContent()"
                [mapHeight]="row.albumIndex.mapConfig?.mapHeight || 500"
                [clusteringEnabled]="row.albumIndex.mapConfig?.clusteringEnabled ?? true"
                [clusteringThreshold]="row.albumIndex.mapConfig?.clusteringThreshold || 10"
                [provider]="row.albumIndex.mapConfig?.provider || MapProvider.OS"
                [osStyle]="row.albumIndex.mapConfig?.osStyle || DEFAULT_OS_STYLE"
                [mapCenter]="row.albumIndex.mapConfig?.mapCenter || mapDefaults.center()"
                [mapZoom]="row.albumIndex.mapConfig?.mapZoom || mapDefaults.zoom()"
                [showControlsDefault]="false"
                [allowControlsToggle]="false"
                [autoFitBounds]="row.albumIndex.mapConfig?.autoFitBounds !== false"/>
            </div>
          }
        }
      }`,
    imports: [ActionButtons, DynamicContentViewIndexMap, MarkdownComponent, DynamicContentSearchInputComponent]
})
export class DynamicContentViewIndex implements OnInit {

  @Input()
  public row: PageContentRow;
  public albumIndexPageContent: PageContent;
  public actions: PageContentActionsService = inject(PageContentActionsService);
  public albumIndexService: IndexService = inject(IndexService);
  private pageService: PageService = inject(PageService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("DynamicContentViewIndex", NgxLoggerLevel.ERROR);
  protected readonly IndexRenderMode = IndexRenderMode;
  protected readonly MapProvider = MapProvider;
  protected readonly DEFAULT_OS_STYLE = DEFAULT_OS_STYLE;
  protected mapDefaults = inject(MapDefaultsService);
  public searchText = "";
  private memoizedSource: PageContent;
  private memoizedSearchText: string;
  private memoizedFilteredPageContent: PageContent;

  async ngOnInit() {
    this.actions.ensureAlbumIndexMapConfigDefaults(this.row);
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

  filteredPageContent(): PageContent {
    if (!this.albumIndexPageContent) {
      return this.albumIndexPageContent;
    }
    if (this.memoizedFilteredPageContent
      && this.memoizedSource === this.albumIndexPageContent
      && this.memoizedSearchText === this.searchText) {
      return this.memoizedFilteredPageContent;
    }
    const filteredColumns = filterColumnsBySearchText(
      this.albumIndexPageContent.rows[0].columns,
      this.searchText
    );
    this.memoizedSource = this.albumIndexPageContent;
    this.memoizedSearchText = this.searchText;
    this.memoizedFilteredPageContent = {
      ...this.albumIndexPageContent,
      rows: [{
        ...this.albumIndexPageContent.rows[0],
        columns: filteredColumns
      }]
    };
    return this.memoizedFilteredPageContent;
  }

  indexMarkdown(): string | null {
    const autoTitle = this.row?.albumIndex?.autoTitle !== false;
    if (autoTitle) {
      const title = this.pageService.pageSubtitle();
      return title ? `# ${title}` : null;
    }
    return this.row?.albumIndex?.indexMarkdown || null;
  }

}
