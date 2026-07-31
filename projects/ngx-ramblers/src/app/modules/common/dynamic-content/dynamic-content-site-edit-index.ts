import { Component, inject, Input, OnInit } from "@angular/core";
import { faAdd, faArrowDown, faArrowUp, faEraser, faPencil, faSearch, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlbumIndexSortField, ContentPathMatch, IndexContentType, IndexRenderMode, PageContent, PageContentRow, StringMatch } from "../../../models/content-text.model";
import { SortDirection } from "../../../models/sort.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentService } from "../../../services/page-content.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { UrlService } from "../../../services/url.service";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { ContentTextEditor } from "../../../modules/common/tiptap-editor/content-text-editor";
import { isUndefined } from "es-toolkit/compat";
import { booleanOf } from "../../../functions/strings";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { FormsModule } from "@angular/forms";
import { ActionButtons } from "../action-buttons/action-buttons";
import { NgSelectComponent } from "@ng-select/ng-select";
import { MarginSelectComponent } from "./dynamic-content-margin-select";
import { MapOverlayControls } from "../../../shared/components/map-overlay-controls";
import { DynamicContentViewIndexMap } from "./dynamic-content-view-index-map";
import { IndexService } from "../../../services/index.service";
import { IndexEntryOverrideEditor } from "./index-entry-override-editor";
import { ResizerComponent } from "../resizer/resizer";
import { DEFAULT_OS_STYLE, MapProvider, MapViewChange } from "../../../models/map.model";
import { MapDefaultsService } from "../../../services/maps/map-defaults.service";
import { PageService } from "../../../services/page.service";
import { ContentText } from "../../../models/content-text.model";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-album-index-site-edit",
    styleUrls: ["./dynamic-content.sass"],
    template: `
      <div class="row mb-3">
        <div class="col-12">
          <app-content-text-editor
            [data]="indexMarkdownForEditor()"
            [standalone]="true"
            [allowHide]="false"
            [deleteEnabled]="false"
            [presentationMode]="row.albumIndex.autoTitle"
            [description]="row.albumIndex.autoTitle ? 'Auto title uses the page URL' : 'Text shown above the index cards'"
            (changed)="onIndexMarkdownChanged($event)">
          </app-content-text-editor>
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
                   [for]="id + '-auto-title'">Auto Title - uncheck to enter index and intro text yourself
            </label>
          </div>
          <div class="form-check form-check-inline mb-0 ms-3">
            <input
              [ngModel]="booleanOf(row.albumIndex.showInParentIndex, true)"
              (ngModelChange)="row.albumIndex.showInParentIndex = $event"
              type="checkbox"
              class="form-check-input"
              [id]="id + '-show-in-parent'">
            <label class="form-check-label"
                   [for]="id + '-show-in-parent'">Show in Parent Index
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
      <div class="row mb-3">
        <div class="col-sm-6">
          <label for="sort-field-{{id}}">Sort Field</label>
          <ng-select
            [items]="sortFieldValues"
            bindLabel="title"
            bindValue="value"
            [searchable]="false"
            [clearable]="false"
            id="sort-field-{{id}}"
            [(ngModel)]="row.albumIndex.sortConfig.field"
            (ngModelChange)="refreshContentPreview()"
            appearance="outline">
          </ng-select>
        </div>
        <div class="col-sm-6">
          <label for="sort-direction-{{id}}">Sort Direction</label>
          <ng-select
            [items]="sortDirectionValues"
            bindLabel="title"
            bindValue="value"
            [searchable]="false"
            [clearable]="false"
            id="sort-direction-{{id}}"
            [(ngModel)]="row.albumIndex.sortConfig.direction"
            (ngModelChange)="refreshContentPreview()"
            appearance="outline">
          </ng-select>
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
          <div class="col-sm-8">
            <label for="{{id}}-album-{{index}}">
              Content Path {{ index + 1 }}</label>
            <div class="d-flex">
              <input autocomplete="off"
                     list="{{id}}-album-{{index}}-options"
                     id="{{id}}-album-{{index}}"
                     [(ngModel)]="row.albumIndex.contentPaths[index].contentPath"
                     (ngModelChange)="refreshContentPreview()"
                     placeholder="Select or type a content path"
                     type="text" class="form-control flex-grow-1 me-2">
              <datalist id="{{id}}-album-{{index}}-options">
                @for (link of pageContentService.siteLinks; track link) {
                  <option [value]="link"></option>
                }
              </datalist>
              <app-badge-button class="mt-1" [icon]="faEraser" [caption]="'Remove Content Path Match'"
                                (click)="remove(contentPath)"/>
              <app-badge-button class="mt-1 ms-1" [icon]="faArrowDown" [caption]="'Move to Exclude'"
                                (click)="moveToExclude(contentPath)"/>
            </div>
          </div>
          <div class="col-sm-2">
            <label for="{{id}}-max-segments-{{index}}">Max Depth</label>
            <input type="number"
                   id="{{id}}-max-segments-{{index}}"
                   [(ngModel)]="row.albumIndex.contentPaths[index].maxPathSegments"
                   (ngModelChange)="refreshContentPreview()"
                   min="1"
                   placeholder="∞"
                   class="form-control">
          </div>
        </div>
      }
      <div class="d-flex justify-content-start mt-3 mb-2">
        <app-badge-button [icon]="faAdd" [caption]="'Add new Exclude Path Match'"
                          (click)="addNewExcludePath()"/>
      </div>
      @for (excludePath of row.albumIndex.excludePaths; track trackByIndex(index, excludePath); let index = $index) {
        <div class="row align-items-end mb-2">
          <div class="col-sm-2">
            <label
              [for]="actions.rowColumnIdentifierFor(index, 0, excludePath + '-exclude-path-item')">
              Exclude {{ index + 1 }}</label>
            <select class="form-control input-sm"
                    [(ngModel)]="row.albumIndex.excludePaths[index].stringMatch"
                    (ngModelChange)="refreshContentPreview()"
                    [id]="actions.rowColumnIdentifierFor(index, 0, excludePath + '-exclude-path-item')">
              @for (type of stringMatchingValues; track type) {
                <option
                  [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                </option>
              }
            </select>
          </div>
          <div class="col-sm-8">
            <label for="{{id}}-exclude-{{index}}">
              Exclude Path {{ index + 1 }}</label>
            <div class="d-flex">
              <input autocomplete="off"
                     list="{{id}}-exclude-{{index}}-options"
                     id="{{id}}-exclude-{{index}}"
                     [(ngModel)]="row.albumIndex.excludePaths[index].contentPath"
                     (ngModelChange)="refreshContentPreview()"
                     placeholder="Select or type an exclude path"
                     type="text" class="form-control flex-grow-1 me-2">
              <datalist id="{{id}}-exclude-{{index}}-options">
                @for (link of pageContentService.siteLinks; track link) {
                  <option [value]="link"></option>
                }
              </datalist>
              <app-badge-button class="mt-1" [icon]="faEraser" [caption]="'Remove Exclude Path Match'"
                                (click)="removeExcludePath(excludePath)"/>
              <app-badge-button class="mt-1 ms-1" [icon]="faArrowUp" [caption]="'Move to Include'"
                                (click)="moveToInclude(excludePath)"/>
            </div>
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
      @if (indexPageContent?.rows?.[0]?.columns?.length > 0) {
        <app-index-entry-override-editor
          [row]="row"
          [indexPageContent]="indexPageContent"
          (overridesChanged)="refreshContentPreview()"
          (expandedHrefChanged)="onOverrideExpandedHrefChanged($event)"/>
      }
      @if (showMapConfig()) {
        <app-map-overlay-controls
          [config]="row.albumIndex.mapConfig"
          [id]="id"
          [showOpacityControls]="false"
          [showClusteringControls]="true"
          [showWaypointControls]="false"
          autoFitCaption="Auto-fit map to all locations"
          [defaults]="{
          provider: MapProvider.OSM,
          osStyle: DEFAULT_OS_STYLE,
          mapCenter: mapDefaults.center(),
          mapZoom: mapDefaults.zoom(),
          mapHeight: 500,
          clusteringEnabled: true,
          clusteringThreshold: 10,
          autoFitBounds: true
        }"
          (configChange)="onMapConfigChange()"/>
        <div class="row mb-3">
          <div class="col-12">
            <div class="alert alert-warning">
              <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
              <strong>Choosing the map view:</strong> with <em>Auto-fit map to all locations</em> ticked, the map always
              zooms out far enough to show every location, so one far-flung entry can leave everything else in a huddle.
              Untick it to freeze the map where it is now, then pan and zoom the preview below to the area you want
              visitors to see - that view is saved with the page. Every index entry still appears in the action buttons
              whatever the map shows.
            </div>
          </div>
        </div>
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
                [mapHeight]="row.albumIndex.mapConfig.mapHeight || 500"
                [clusteringEnabled]="row.albumIndex.mapConfig.clusteringEnabled ?? true"
                [clusteringThreshold]="row.albumIndex.mapConfig.clusteringThreshold || 10"
                [provider]="row.albumIndex.mapConfig.provider || MapProvider.OSM"
                [osStyle]="row.albumIndex.mapConfig.osStyle || DEFAULT_OS_STYLE"
                [mapCenter]="row.albumIndex.mapConfig.mapCenter || mapDefaults.center()"
                [mapZoom]="row.albumIndex.mapConfig.mapZoom || mapDefaults.zoom()"
                [showControlsDefault]="row.albumIndex.mapConfig.showControlsDefault ?? true"
                [allowControlsToggle]="row.albumIndex.mapConfig.allowControlsToggle ?? true"
                [autoFitBounds]="row.albumIndex.mapConfig.autoFitBounds !== false"
                [editing]="true"
                (mapProviderChange)="previewMapProviderChanged($event)"
                (mapStyleChange)="previewMapStyleChanged($event)"
                (mapHeightChange)="previewMapHeightChanged($event)"
                (mapViewChange)="previewMapViewChanged($event)"/>
            } @else {
              <div class="card shadow d-flex align-items-center justify-content-center"
                   [style.height.px]="row.albumIndex.mapConfig.mapHeight || 500">
                <div class="spinner-border text-secondary" role="status">
                  <span class="visually-hidden">Loading…</span>
                </div>
              </div>
            }
            <app-resizer orientation="vertical" variant="tab" compact
                         [size]="row.albumIndex.mapConfig.mapHeight || 500"
                         [minSize]="300"
                         [maxSize]="2000"
                         (sizeChange)="previewMapHeightChanged($event)"/>
          </div>
        </div>
      }
      <app-action-buttons [pageContent]="previewPageContent()" [rowIndex]="0" presentationMode/>`,
    imports: [BadgeButtonComponent, FormsModule, ActionButtons, NgSelectComponent, MarginSelectComponent, MapOverlayControls, DynamicContentViewIndexMap, ContentTextEditor, IndexEntryOverrideEditor, FontAwesomeModule, ResizerComponent]
})
export class IndexSiteEdit implements OnInit {
  public booleanOf = booleanOf;
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
  public logger = this.loggerFactory.createLogger("IndexSiteEdit", NgxLoggerLevel.ERROR);
  public instance = this;
  @Input()
  public row: PageContentRow;
  @Input() rowIndex: number;
  faPencil = faPencil;
  faAdd = faAdd;
  faEraser = faEraser;
  faArrowDown = faArrowDown;
  faArrowUp = faArrowUp;
  id: string;
  protected readonly faSearch = faSearch;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  stringMatchingValues: KeyValue<string>[] = enumKeyValues(StringMatch);
  contentTypeValues: (KeyValue<string> & {title: string})[] = enumKeyValues(IndexContentType)
    .map(item => ({...item, title: this.stringUtils.asTitle(item.value)}));
  renderModeValues: (KeyValue<string> & {title: string})[] = enumKeyValues(IndexRenderMode)
    .map(item => ({...item, title: this.stringUtils.asTitle(item.value)}));
  sortFieldValues: {value: AlbumIndexSortField; title: string}[] = [
    {value: AlbumIndexSortField.TITLE, title: "Title"},
    {value: AlbumIndexSortField.HREF, title: "Path"},
    {value: AlbumIndexSortField.CREATED_AT, title: "Date Created"},
    {value: AlbumIndexSortField.EVENT_DATE, title: "Event Date"}
  ];
  sortDirectionValues: {value: SortDirection; title: string}[] = [
    {value: SortDirection.ASC, title: "Ascending"},
    {value: SortDirection.DESC, title: "Descending"}
  ];
  showMapPreview = false;
  previewMapView: MapViewChange = null;
  private autoFitBoundsWasOn = true;
  overrideExpandedHref: string = null;
  protected readonly MapProvider = MapProvider;
  protected readonly DEFAULT_OS_STYLE = DEFAULT_OS_STYLE;
  protected mapDefaults = inject(MapDefaultsService);
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
    if (!this.row.albumIndex.sortConfig) {
      this.row.albumIndex.sortConfig = {field: AlbumIndexSortField.TITLE, direction: SortDirection.ASC};
    }
    if (!this.row.albumIndex.excludePaths) {
      this.row.albumIndex.excludePaths = [];
    }
    if (!this.row.albumIndex.entryOverrides) {
      this.row.albumIndex.entryOverrides = {};
    }
    if (!this.row.albumIndex.columnOverrides) {
      this.row.albumIndex.columnOverrides = [];
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
    const text = this.row.albumIndex.autoTitle
      ? this.autoTitleMarkdown()
      : this.row.albumIndex.indexMarkdown;
    return {text, name: "index text"};
  }

  onIndexMarkdownChanged(contentText: ContentText) {
    if (!this.row.albumIndex.autoTitle) {
      this.row.albumIndex.indexMarkdown = contentText?.text;
    }
  }

  onAutoTitleChanged(autoTitle: boolean) {
    const existingMarkdown = this.row.albumIndex.indexMarkdown;
    const shouldSeedIntro = !autoTitle && this.isBlankMarkdown(existingMarkdown);
    if (shouldSeedIntro) {
      this.row.albumIndex.indexMarkdown = this.autoTitleMarkdown();
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

  addNewExcludePath() {
    this.row.albumIndex.excludePaths.push({contentPath: "", stringMatch: StringMatch.CONTAINS});
  }

  removeExcludePath(excludePath: ContentPathMatch) {
    this.row.albumIndex.excludePaths = this.row.albumIndex.excludePaths.filter(item => item !== excludePath);
    this.refreshContentPreview();
  }

  moveToExclude(contentPath: ContentPathMatch) {
    this.row.albumIndex.contentPaths = this.row.albumIndex.contentPaths.filter(item => item !== contentPath);
    this.row.albumIndex.excludePaths.push(contentPath);
    this.refreshContentPreview();
  }

  moveToInclude(excludePath: ContentPathMatch) {
    this.row.albumIndex.excludePaths = this.row.albumIndex.excludePaths.filter(item => item !== excludePath);
    this.row.albumIndex.contentPaths.push(excludePath);
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
        mapHeight: 500,
        clusteringEnabled: true,
        clusteringThreshold: 10,
        provider: MapProvider.OSM,
        osStyle: DEFAULT_OS_STYLE,
        mapCenter: this.mapDefaults.center(),
        mapZoom: this.mapDefaults.zoom(),
        showControlsDefault: true,
        allowControlsToggle: true,
        autoFitBounds: true
      };
    }
    if (this.showMapConfig()) {
      this.actions.ensureAlbumIndexMapConfigDefaults(this.row);
    }
  }

  onMapConfigChange() {
    this.logger.info("Map config changed:", this.row.albumIndex.mapConfig);
    const autoFitBounds = this.row.albumIndex.mapConfig?.autoFitBounds !== false;
    if (this.autoFitBoundsWasOn && !autoFitBounds && this.previewMapView) {
      this.logger.info("auto-fit turned off: keeping the view the map is showing:", this.previewMapView);
      this.saveMapView(this.previewMapView);
    }
    this.autoFitBoundsWasOn = autoFitBounds;
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
      this.row.albumIndex.mapConfig.mapHeight = height;
    }
  }

  previewMapViewChanged(view: MapViewChange) {
    this.previewMapView = view;
    if (this.row?.albumIndex?.mapConfig?.autoFitBounds === false) {
      this.logger.info("previewMapViewChanged:saving chosen view:", view);
      this.saveMapView(view);
    }
  }

  private saveMapView(view: MapViewChange) {
    this.row.albumIndex.mapConfig.mapCenter = view.center;
    this.row.albumIndex.mapConfig.mapZoom = view.zoom;
  }

  onOverrideExpandedHrefChanged(href: string) {
    this.overrideExpandedHref = href;
  }

  previewPageContent(): PageContent {
    if (!this.overrideExpandedHref || !this.indexPageContent?.rows?.[0]?.columns) {
      return this.indexPageContent;
    }
    const filteredColumns = this.indexPageContent.rows[0].columns.filter(c => c.href === this.overrideExpandedHref);
    return {
      ...this.indexPageContent,
      rows: [{...this.indexPageContent.rows[0], columns: filteredColumns}]
    };
  }

}
