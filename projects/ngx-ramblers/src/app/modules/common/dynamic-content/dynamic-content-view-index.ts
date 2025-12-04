import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { IndexRenderMode, PageContent, PageContentRow } from "../../../models/content-text.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { ActionButtons } from "../action-buttons/action-buttons";
import { FormsModule } from "@angular/forms";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { DynamicContentViewIndexMap } from "./dynamic-content-view-index-map";
import { IndexService } from "../../../services/index.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { Location } from "@angular/common";
import { ActivatedRoute } from "@angular/router";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
    selector: "app-dynamic-content-view-index",
    template: `
      @if (actions.isIndex(row)) {
        @if (shouldShowSearch()) {
          <div class="row mb-3">
            <div class="col-12">
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
            <div [class.mt-1]="row.marginTop === 1"
                 [class.mt-2]="row.marginTop === 2"
                 [class.mt-3]="row.marginTop === 3"
                 [class.mt-4]="row.marginTop === 4"
                 [class.mt-5]="row.marginTop === 5"
                 [class.mb-1]="row.marginBottom === 1"
                 [class.mb-2]="row.marginBottom === 2"
                 [class.mb-3]="row.marginBottom === 3"
                 [class.mb-4]="row.marginBottom === 4"
                 [class.mb-5]="row.marginBottom === 5">
              <app-dynamic-content-view-index-map
                [pageContent]="filteredPageContent()"
                [mapHeight]="row.albumIndex.mapConfig?.height || 500"
                [clusteringEnabled]="row.albumIndex.mapConfig?.clusteringEnabled ?? true"
                [clusteringThreshold]="row.albumIndex.mapConfig?.clusteringThreshold || 10"
                [provider]="row.albumIndex.mapConfig?.provider || 'osm'"
                [osStyle]="row.albumIndex.mapConfig?.osStyle || 'Leisure_27700'"
                [mapCenter]="row.albumIndex.mapConfig?.mapCenter || [51.25, 0.75]"
                [mapZoom]="row.albumIndex.mapConfig?.mapZoom || 10"
                [showControlsDefault]="row.albumIndex.mapConfig?.showControlsDefault ?? true"
                [allowControlsToggle]="row.albumIndex.mapConfig?.allowControlsToggle ?? true"/>
            </div>
          }
        }
      }`,
    imports: [ActionButtons, DynamicContentViewIndexMap, FormsModule, FontAwesomeModule]
})
export class DynamicContentViewIndex implements OnInit {

  @Input()
  public row: PageContentRow;
  public albumIndexPageContent: PageContent;
  public actions: PageContentActionsService = inject(PageContentActionsService);
  public albumIndexService: IndexService = inject(IndexService);
  public ui: UiActionsService = inject(UiActionsService);
  private location: Location = inject(Location);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private stringUtils: StringUtilsService = inject(StringUtilsService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("DynamicContentViewAlbumIndexComponent", NgxLoggerLevel.ERROR);
  protected readonly IndexRenderMode = IndexRenderMode;
  protected readonly faSearch = faSearch;
  public searchText = "";
  private searchDebounce: any;

  async ngOnInit() {
    const albumIndex = this.row.albumIndex;
    const searchParam = this.stringUtils.kebabCase(StoredValue.SEARCH);
    const urlSearchValue = this.route.snapshot.queryParamMap.get(searchParam);

    if (urlSearchValue !== null) {
      this.searchText = urlSearchValue;
      this.ui.saveValueFor(StoredValue.SEARCH, urlSearchValue);
    } else {
      this.searchText = "";
      this.ui.saveValueFor(StoredValue.SEARCH, "");
    }

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
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }
    this.searchDebounce = setTimeout(() => {
      this.ui.saveValueFor(StoredValue.SEARCH, this.searchText || "");
      this.updateUrlParams();
    }, 300);
  }

  private updateUrlParams() {
    const searchParam = this.stringUtils.kebabCase(StoredValue.SEARCH);
    const params = new URLSearchParams(window.location.search);

    if (this.searchText) {
      params.set(searchParam, this.searchText);
    } else {
      params.delete(searchParam);
    }

    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    this.location.replaceState(newUrl);
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
