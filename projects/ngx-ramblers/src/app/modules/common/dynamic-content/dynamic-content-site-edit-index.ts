import { Component, inject, Input, OnInit } from "@angular/core";
import { faAdd, faEraser, faPencil, faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { ContentPathMatch, IndexContentType, IndexRenderMode, PageContent, PageContentRow, StringMatch } from "../../../models/content-text.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentService } from "../../../services/page-content.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { UrlService } from "../../../services/url.service";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { FormsModule } from "@angular/forms";
import { TypeaheadDirective } from "ngx-bootstrap/typeahead";
import { ActionButtons } from "../action-buttons/action-buttons";
import { NgSelectComponent } from "@ng-select/ng-select";
import { MarginSelectComponent } from "./dynamic-content-margin-select";
import { MapOverlayControls } from "../../../shared/components/map-overlay-controls";
import { DynamicContentViewIndexMap } from "./dynamic-content-view-index-map";
import { IndexService } from "../../../services/index.service";

@Component({
    selector: "app-album-index-site-edit",
    styleUrls: ["./dynamic-content.sass"],
    template: `
      <div class="row mb-3">
        <div class="col-sm-6">
          <label for="content-types-{{id}}">
            Content Types</label>
          <ng-select
            [items]="contentTypeValues"
            bindLabel="title"
            bindValue="value"
            [multiple]="true"
            [closeOnSelect]="false"
            [searchable]="false"
            [clearable]="false"
            id="content-types-{{id}}"
            [(ngModel)]="row.albumIndex.contentTypes"
            (ngModelChange)="refreshContentPreview()"
            appearance="outline">
          </ng-select>
          <small class="text-muted">Selection order determines display order</small>
        </div>
        <div class="col-sm-6">
          <label for="render-modes-{{id}}">
            Render Modes</label>
          <ng-select
            [items]="renderModeValues"
            bindLabel="title"
            bindValue="value"
            [multiple]="true"
            [closeOnSelect]="false"
            [searchable]="false"
            [clearable]="false"
            id="render-modes-{{id}}"
            [(ngModel)]="row.albumIndex.renderModes"
            (ngModelChange)="onRenderModesChange()"
            appearance="outline">
          </ng-select>
          <small class="text-muted">Selection order determines display order</small>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-sm-6">
          <label for="min-cols-{{id}}">
            Minimum Columns</label>
          <input type="number"
                 class="form-control"
                 id="min-cols-{{id}}"
                 [(ngModel)]="row.albumIndex.minCols"
                 min="1"
                 max="12">
        </div>
        <div class="col-sm-6">
          <label for="max-cols-{{id}}">
            Maximum Columns</label>
          <input type="number"
                 class="form-control"
                 id="max-cols-{{id}}"
                 [(ngModel)]="row.albumIndex.maxCols"
                 min="1"
                 max="12">
        </div>
      </div>
      <div class="d-flex justify-content-start mb-2">
        <app-badge-button [icon]="faAdd" [caption]="'Add new Content Path Match'"
                          (click)="addNewAlbum()"/>
      </div>
      @for (contentPath of row.albumIndex.contentPaths; track trackByIndex(index, contentPath); let index = $index) {
        <div class="row align-items-end mb-2">
          <div class="col-sm-2">
            <label
              [for]="actions.rowColumnIdentifierFor(index, 0, contentPath + '-album-index-item')">
              Match {{ index + 1 }}</label>
            <select class="form-control input-sm"
                    [(ngModel)]="row.albumIndex.contentPaths[index].stringMatch"
                    (ngModelChange)="refreshContentPreview()"
                    [id]="actions.rowColumnIdentifierFor(index, 0, contentPath + '-album-index-item')">
              @for (type of stringMatchingValues; track type) {
                <option
                  [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                </option>
              }
            </select>
          </div>
          <div class="col-sm-10">
            <form>
              <label for="{{id}}-album-{{index}}">
                Content Path {{ index + 1 }}</label>
              <div class="d-flex">
                <input autocomplete="off" [typeahead]="pageContentService.siteLinks"
                       [typeaheadMinLength]="0"
                       id="{{id}}-album-{{index}}"
                       [(ngModel)]="row.albumIndex.contentPaths[index].contentPath"
                       (ngModelChange)="refreshContentPreview()"
                       [value]="contentPath"
                       name="new-password"
                       type="text" class="form-control flex-grow-1 me-2">
                <app-badge-button class="mt-1" [icon]="faEraser" [caption]="'Remove Content Path Match'"
                                  (click)="remove(contentPath)"/>
              </div>
            </form>
          </div>
        </div>
      }
      @if (indexPageContent?.rows) {
        <div class="row mb-3">
          <div class="col-sm-12">
            <h6>{{ stringUtils.pluraliseWithCount(indexPageContent?.rows?.[0]?.columns?.length, 'item') }} found
              from {{ stringUtils.pluraliseWithCount(row?.albumIndex?.contentPaths?.length, 'content path match', 'content path matches') }}</h6>
          </div>
        </div>
      }
      @if (showMapConfig()) {
        <app-map-overlay-controls
          [config]="row.albumIndex.mapConfig"
          [id]="id"
          [showOpacityControls]="false"
          [showClusteringControls]="true"
          [showWaypointControls]="false"
          [defaults]="{
          provider: 'osm',
          osStyle: 'Leisure_27700',
          mapCenter: [51.25, 0.75],
          mapZoom: 10,
          mapHeight: 500,
          clusteringEnabled: true,
          clusteringThreshold: 10
        }"
          (configChange)="onMapConfigChange()"/>
        <div class="row mb-3">
          <div class="col-sm-6">
            <app-margin-select label="Map Margin Top" [data]="row" field="marginTop"/>
          </div>
          <div class="col-sm-6">
            <app-margin-select label="Map Margin Bottom" [data]="row" field="marginBottom"/>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-12">
            <h6>Map Preview</h6>
            @if (indexPageContent?.rows?.[0]?.columns && showMapPreview) {
              <app-dynamic-content-view-index-map
                [pageContent]="indexPageContent"
                [mapHeight]="row.albumIndex.mapConfig.height || 500"
                [clusteringEnabled]="row.albumIndex.mapConfig.clusteringEnabled ?? true"
                [clusteringThreshold]="row.albumIndex.mapConfig.clusteringThreshold || 10"
                [provider]="row.albumIndex.mapConfig.provider || 'osm'"
                [osStyle]="row.albumIndex.mapConfig.osStyle || 'Leisure_27700'"
                [mapCenter]="row.albumIndex.mapConfig.mapCenter || [51.25, 0.75]"
                [mapZoom]="row.albumIndex.mapConfig.mapZoom || 10"
                [showControlsDefault]="row.albumIndex.mapConfig.showControlsDefault ?? true"
                [allowControlsToggle]="row.albumIndex.mapConfig.allowControlsToggle ?? true"/>
            } @else {
              <div class="card shadow d-flex align-items-center justify-content-center"
                   [style.height.px]="row.albumIndex.mapConfig.height || 500">
                <div class="spinner-border text-secondary" role="status">
                  <span class="visually-hidden">Loading…</span>
                </div>
              </div>
            }
          </div>
        </div>
      }
      <app-action-buttons [pageContent]="indexPageContent" [rowIndex]="0" presentationMode/>`,
    imports: [BadgeButtonComponent, FormsModule, TypeaheadDirective, ActionButtons, NgSelectComponent, MarginSelectComponent, MapOverlayControls, DynamicContentViewIndexMap]
})
export class AlbumIndexSiteEditComponent implements OnInit {
  public pageContentService: PageContentService = inject(PageContentService);
  public memberResourcesReferenceData: MemberResourcesReferenceDataService = inject(MemberResourcesReferenceDataService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public urlService: UrlService = inject(UrlService);
  private numberUtils: NumberUtilsService = inject(NumberUtilsService);
  public actions: PageContentActionsService = inject(PageContentActionsService);
  public indexService: IndexService = inject(IndexService);
  public indexPageContent: PageContent;
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("AlbumIndexSiteEditComponent", NgxLoggerLevel.ERROR);
  public instance = this;
  @Input()
  public row: PageContentRow;
  @Input() rowIndex: number;
  faPencil = faPencil;
  faAdd = faAdd;
  faEraser = faEraser;
  id: string;
  protected readonly faSearch = faSearch;
  stringMatchingValues: KeyValue<string>[] = enumKeyValues(StringMatch);
  contentTypeValues: (KeyValue<string> & {title: string})[] = enumKeyValues(IndexContentType)
    .map(item => ({...item, title: this.stringUtils.asTitle(item.value)}));
  renderModeValues: (KeyValue<string> & {title: string})[] = enumKeyValues(IndexRenderMode)
    .map(item => ({...item, title: this.stringUtils.asTitle(item.value)}));
  showMapPreview = false;

  async ngOnInit() {
    this.logger.info("ngOnInit:albumIndex:", this.row.albumIndex);
    this.id = this.numberUtils.generateUid();
    if (!this.row.albumIndex.contentTypes) {
      this.row.albumIndex.contentTypes = [IndexContentType.ALBUMS];
    }
    if (!this.row.albumIndex.renderModes) {
      this.row.albumIndex.renderModes = [IndexRenderMode.ACTION_BUTTONS];
    }
    this.ensureMapConfig();
    await this.refreshContentPreview();
    this.logger.info("albumIndex:", this.row?.albumIndex, "albumIndexPageContent:", this.indexPageContent);
  }

  protected async refreshContentPreview() {
    this.logger.info("refreshContentPreview called with contentPaths:", this.row.albumIndex.contentPaths);
    this.indexPageContent = await this.indexService.albumIndexToPageContent(this.row, this.rowIndex);
    this.logger.info("refreshContentPreview result:", this.indexPageContent?.rows?.[0]?.columns?.length, "items");
    if (this.showMapConfig() && this.indexPageContent?.rows?.[0]?.columns?.length > 0) {
      this.showMapPreview = true;
    }
  }

  trackByIndex(index: number, item: any): number {
    return index;
  }

  onChange($event: any) {
    this.logger.info("onChange:", $event);
  }

  addNewAlbum() {
    this.logger.info("addNewAlbum:albumIndex:", this.row.albumIndex);
    this.row.albumIndex.contentPaths.push({contentPath: "", stringMatch: StringMatch.CONTAINS});
    this.logger.info("addNewAlbum:albums:", this.row.albumIndex.contentPaths);
  }

  remove(contentPath: ContentPathMatch) {
    this.logger.info("delete:", contentPath);
    this.row.albumIndex.contentPaths = this.row.albumIndex.contentPaths.filter(item => item !== contentPath);
    this.refreshContentPreview();
  }

  showMapConfig(): boolean {
    return this.row.albumIndex?.renderModes?.includes(IndexRenderMode.MAP) || false;
  }

  onRenderModesChange() {
    this.ensureMapConfig();
  }

  private ensureMapConfig() {
    if (this.showMapConfig() && !this.row.albumIndex.mapConfig) {
      this.row.albumIndex.mapConfig = {
        height: 500,
        clusteringEnabled: true,
        clusteringThreshold: 10,
        provider: "osm",
        osStyle: "Leisure_27700",
        mapCenter: [51.25, 0.75],
        mapZoom: 10,
        showControlsDefault: true,
        allowControlsToggle: true
      };
    }
    if (this.showMapConfig()) {
      this.actions.ensureAlbumIndexMapConfigDefaults(this.row);
    }
  }

  onMapConfigChange() {
    this.logger.info("Map config changed:", this.row.albumIndex.mapConfig);
    this.showMapPreview = false;
    setTimeout(() => {
      this.showMapPreview = true;
    }, 100);
  }

}
