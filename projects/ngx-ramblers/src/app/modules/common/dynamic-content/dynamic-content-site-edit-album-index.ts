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
import { AlbumIndexService } from "../../../services/album-index.service";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { FormsModule } from "@angular/forms";
import { TypeaheadDirective } from "ngx-bootstrap/typeahead";
import { ActionButtonsComponent } from "../action-buttons/action-buttons";
import { NgSelectComponent } from "@ng-select/ng-select";

@Component({
    selector: "app-album-index-site-edit",
    styleUrls: ["./dynamic-content.sass"],
    template: `
    <div class="row align-items-end mb-3 d-flex">
      <div class="col-sm-12">
        <app-badge-button [icon]="faAdd" [caption]="'Add new Content Path Match'"
                          (click)="addNewAlbum()"/>
      </div>
    </div>
    <div class="row mb-3">
      <div class="col-sm-6">
        <label for="content-types-{{id}}">Content Types</label>
        <ng-select
          [items]="contentTypeValues"
          bindLabel="value"
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
        <label for="render-modes-{{id}}">Render Modes</label>
        <ng-select
          [items]="renderModeValues"
          bindLabel="value"
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
    @if (showMapConfig()) {
      <div class="row mb-3">
        <div class="col-sm-4">
          <label for="map-height-{{id}}">Map Height (px)</label>
          <input type="number"
                 class="form-control"
                 id="map-height-{{id}}"
                 [(ngModel)]="row.albumIndex.mapConfig.height"
                 min="300"
                 max="900"
                 step="10">
        </div>
        <div class="col-sm-4">
          <div class="form-check mt-4">
            <input class="form-check-input"
                   type="checkbox"
                   id="clustering-enabled-{{id}}"
                   [(ngModel)]="row.albumIndex.mapConfig.clusteringEnabled">
            <label class="form-check-label" for="clustering-enabled-{{id}}">
              Enable Clustering
            </label>
          </div>
        </div>
        <div class="col-sm-4">
          <label for="clustering-threshold-{{id}}">Clustering Threshold</label>
          <input type="number"
                 class="form-control"
                 id="clustering-threshold-{{id}}"
                 [(ngModel)]="row.albumIndex.mapConfig.clusteringThreshold"
                 min="2"
                 max="100"
                 [disabled]="!row.albumIndex.mapConfig.clusteringEnabled">
        </div>
      </div>
    }
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
            <label for="{{id}}-album-{{index}}">Content Path {{ index + 1 }}</label>
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
    @if (albumIndexPageContent?.rows) {
      <div class="row">
        <div class="col-sm-12 mt-2">
          <h6>{{ stringUtils.pluraliseWithCount(albumIndexPageContent?.rows?.[0]?.columns?.length, 'item') }} found
          from {{ stringUtils.pluraliseWithCount(row?.albumIndex?.contentPaths?.length, 'content path match', 'content path matches') }}</h6>
        </div>
      </div>
    }
    <app-action-buttons [pageContent]="albumIndexPageContent" [rowIndex]="0" presentationMode/>`,
    imports: [BadgeButtonComponent, FormsModule, TypeaheadDirective, ActionButtonsComponent, NgSelectComponent]
})
export class AlbumIndexSiteEditComponent implements OnInit {
  public pageContentService: PageContentService = inject(PageContentService);
  public memberResourcesReferenceData: MemberResourcesReferenceDataService = inject(MemberResourcesReferenceDataService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public urlService: UrlService = inject(UrlService);
  private numberUtils: NumberUtilsService = inject(NumberUtilsService);
  public actions: PageContentActionsService = inject(PageContentActionsService);
  public albumIndexService: AlbumIndexService = inject(AlbumIndexService);
  public albumIndexPageContent: PageContent;
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
  contentTypeValues: KeyValue<string>[] = enumKeyValues(IndexContentType);
  renderModeValues: KeyValue<string>[] = enumKeyValues(IndexRenderMode);


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
    this.logger.info("albumIndex:", this.row?.albumIndex, "albumIndexPageContent:", this.albumIndexPageContent);
  }

  protected async refreshContentPreview() {
    this.albumIndexPageContent = await this.albumIndexService.albumIndexToPageContent(this.row, this.rowIndex);
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
        clusteringThreshold: 10
      };
    }
  }


}
