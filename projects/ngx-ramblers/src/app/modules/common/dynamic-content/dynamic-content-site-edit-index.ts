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
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { isUndefined } from "es-toolkit/compat";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { FormsModule } from "@angular/forms";
import { TypeaheadDirective } from "ngx-bootstrap/typeahead";
import { ActionButtons } from "../action-buttons/action-buttons";
import { NgSelectComponent } from "@ng-select/ng-select";
import { MarginSelectComponent } from "./dynamic-content-margin-select";
import { MapOverlayControls } from "../../../shared/components/map-overlay-controls";
import { DynamicContentViewIndexMap } from "./dynamic-content-view-index-map";
import { IndexService } from "../../../services/index.service";
import { DEFAULT_OS_STYLE, MapProvider } from "../../../models/map.model";
import { PageService } from "../../../services/page.service";
import { ContentText } from "../../../models/content-text.model";

@Component({
    selector: "app-album-index-site-edit",
    styleUrls: ["./dynamic-content.sass"],
    template: `
      <div class="row mb-3">
        <div class="col-12">
          <app-markdown-editor
            [data]="indexMarkdownForEditor()"
            [rows]="6"
            [standalone]="true"
            [allowMaximise]="false"
            [allowHide]="false"
            [hideEditToggle]="row.albumIndex.autoTitle"
            [deleteEnabled]="false"
            [presentationMode]="row.albumIndex.autoTitle"
            [actionCaptionSuffix]="'index markdown'"
            [description]="row.albumIndex.autoTitle ? 'Auto title uses the page URL' : 'Markdown content shown above the index cards'"
            (changed)="onIndexMarkdownChanged($event)">
          </app-markdown-editor>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-12">
          <div class="form-check form-check-inline mb-0">
            <input
              [(ngModel)]="row.albumIndex.autoTitle"
              [checked]="row.albumIndex.autoTitle"
              (ngModelChange)="onAutoTitleChanged($event)"
              type="checkbox"
              class="form-check-input"
              [id]="id + '-auto-title'">
            <label class="form-check-label"
                   [for]="id + '-auto-title'">Auto Title - uncheck to Manually enter Index and Intro text (Markdown)
            </label>
          </div>
        </div>
      </div>
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
          provider: MapProvider.OSM,
          osStyle: DEFAULT_OS_STYLE,
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
                [provider]="row.albumIndex.mapConfig.provider || MapProvider.OSM"
                [osStyle]="row.albumIndex.mapConfig.osStyle || DEFAULT_OS_STYLE"
                [mapCenter]="row.albumIndex.mapConfig.mapCenter || [51.25, 0.75]"
                [mapZoom]="row.albumIndex.mapConfig.mapZoom || 10"
                [showControlsDefault]="row.albumIndex.mapConfig.showControlsDefault ?? true"
                [allowControlsToggle]="row.albumIndex.mapConfig.allowControlsToggle ?? true"
                (mapProviderChange)="previewMapProviderChanged($event)"
                (mapStyleChange)="previewMapStyleChanged($event)"
                (mapHeightChange)="previewMapHeightChanged($event)"/>
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
    imports: [BadgeButtonComponent, FormsModule, TypeaheadDirective, ActionButtons, NgSelectComponent, MarginSelectComponent, MapOverlayControls, DynamicContentViewIndexMap, MarkdownEditorComponent]
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
  protected readonly MapProvider = MapProvider;
  protected readonly DEFAULT_OS_STYLE = DEFAULT_OS_STYLE;
  private pageService: PageService = inject(PageService);

  async ngOnInit() {
    this.logger.info("ngOnInit:albumIndex:", this.row.albumIndex);
    this.id = this.numberUtils.generateUid();
    if (!this.row.albumIndex.contentTypes) {
      this.row.albumIndex.contentTypes = [IndexContentType.ALBUMS];
    }
    if (!this.row.albumIndex.renderModes) {
      this.row.albumIndex.renderModes = [IndexRenderMode.ACTION_BUTTONS];
    }
    if (this.row.albumIndex.autoTitle === null || isUndefined(this.row.albumIndex.autoTitle)) {
      this.row.albumIndex.autoTitle = true;
    }
    this.ensureMapConfig();
    await this.refreshContentPreview();
    this.logger.info("albumIndex:", this.row?.albumIndex, "albumIndexPageContent:", this.indexPageContent);
  }

  public async refreshContentPreview() {
    this.logger.info("refreshContentPreview called with contentPaths:", this.row.albumIndex.contentPaths);
    this.indexPageContent = await this.indexService.albumIndexToPageContent(this.row, this.rowIndex);
    this.logger.info("refreshContentPreview result:", this.indexPageContent?.rows?.[0]?.columns?.length, "items");
    if (this.showMapConfig() && this.indexPageContent?.rows?.[0]?.columns?.length > 0) {
      this.showMapPreview = true;
    }
  }

  indexMarkdownForEditor(): ContentText {
    if (this.row.albumIndex.autoTitle) {
      return {text: this.autoTitleMarkdown(), name: "index markdown"};
    }
    return {text: this.row.albumIndex.indexMarkdown, name: "index markdown"};
  }

  onIndexMarkdownChanged(contentText: ContentText) {
    if (!this.row.albumIndex.autoTitle) {
      this.row.albumIndex.indexMarkdown = contentText?.text;
    }
  }

  onAutoTitleChanged(autoTitle: boolean) {
    if (!autoTitle) {
      const existingMarkdown = this.row.albumIndex.indexMarkdown;
      if (this.isBlankMarkdown(existingMarkdown)) {
        this.row.albumIndex.indexMarkdown = this.autoTitleMarkdown();
      }
    }
  }

  private isBlankMarkdown(text: string | null | undefined): boolean {
    const normalised = this.stringUtils.stripLineBreaks(text || "", true);
    return !normalised || normalised.trim().length === 0;
  }

  private autoTitleMarkdown(): string {
    const title = this.pageService.pageSubtitle();
    return title ? `# ${title}` : "";
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
        provider: MapProvider.OSM,
        osStyle: DEFAULT_OS_STYLE,
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

  previewMapProviderChanged(provider: MapProvider) {
    if (this.row?.albumIndex?.mapConfig) {
      this.row.albumIndex.mapConfig.provider = provider;
      this.onMapConfigChange();
    }
  }

  previewMapStyleChanged(osStyle: string) {
    if (this.row?.albumIndex?.mapConfig) {
      this.row.albumIndex.mapConfig.osStyle = osStyle;
      this.onMapConfigChange();
    }
  }

  previewMapHeightChanged(height: number) {
    if (this.row?.albumIndex?.mapConfig) {
      this.row.albumIndex.mapConfig.height = height;
      this.onMapConfigChange();
    }
  }

}
