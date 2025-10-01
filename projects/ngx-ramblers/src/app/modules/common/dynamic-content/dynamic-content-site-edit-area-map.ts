import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow, AreaMapData, PageContent } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgSelectComponent } from "@ng-select/ng-select";
import { KeyValue } from "../../../functions/enums";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { faUndo } from "@fortawesome/free-solid-svg-icons";
import { isNumber, isArray } from "es-toolkit/compat";
import { AreaMapComponent } from "../../../pages/area-map/area-map";
import { MapProvider, MapStyleInfo, OS_MAP_STYLE_LIST } from "../../../models/map.model";
import { AreaMapCmsService } from "../../../services/area-map-cms.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { GroupAreasService } from "../../../services/group-areas.service";

interface RegionOption extends KeyValue<string> {}

@Component({
  selector: "app-dynamic-content-site-edit-area-map",
  styleUrls: ["./dynamic-content.sass"],
  styles: [
    `
      .editor-slider-group
        display: flex
        align-items: center
        gap: 0.5rem

      .editor-slider
        accent-color: var(--ramblers-colour-sunrise)
        width: 100%

      :host ::ng-deep input.editor-slider::-webkit-slider-thumb
        background-color: var(--ramblers-colour-sunrise)
        border: 2px solid var(--ramblers-colour-sunrise)
        box-shadow: none

      :host ::ng-deep input.editor-slider::-moz-range-thumb
        background-color: var(--ramblers-colour-sunrise)
        border: 2px solid var(--ramblers-colour-sunrise)
        box-shadow: none

      .editor-slider-value
        min-width: 45px
        font-size: 0.8rem
    `
  ],
  template: `
    @if (row?.areaMap) {
      <div class="row mb-2">
        <div class="col-12">
          <div class="form-group">
            <label for="groups-select-{{id}}">Groups to Display</label>
            <ng-select id="groups-select-{{id}}"
                       [items]="availableGroups"
                       [multiple]="true"
                       [closeOnSelect]="false"
                       [searchable]="true"
                       [clearable]="true"
                       placeholder="All groups"
                       [(ngModel)]="row.areaMap.selectedGroups"
                       (ngModelChange)="onGroupSelectionChange()">
            </ng-select>
            <small class="form-text text-muted">Leave empty to show all groups</small>
          </div>
        </div>
      </div>

      <div class="row align-items-end mb-2 g-2">
        <div class="col-md-3">
          <label class="form-label" for="provider-select-{{id}}">Map Provider</label>
          <select class="form-select form-select-sm"
                  id="provider-select-{{id}}"
                  [ngModel]="row.areaMap.provider || 'osm'"
                  (ngModelChange)="updateProvider($event)">
            @for (option of providerOptions; track option.key) {
              <option [ngValue]="option.key">{{ option.value }}</option>
            }
          </select>
        </div>
        @if ((row.areaMap?.provider || 'osm') === 'os') {
          <div class="col-md-3">
            <label class="form-label" for="style-select-{{id}}">OS Map Style</label>
            <select class="form-select form-select-sm"
                    id="style-select-{{id}}"
                    [ngModel]="row.areaMap.osStyle || osStyles[0].key"
                    (ngModelChange)="updateOsStyle($event)">
              @for (style of osStyles; track style.key) {
                <option [ngValue]="style.key">{{ style.name }}</option>
              }
            </select>
          </div>
        }
        <div class="col-md-2 me-3">
          <label class="form-label" for="zoom-input-{{id}}">Zoom Level</label>
          <div class="editor-slider-group">
            <input type="range"
                   id="zoom-input-{{id}}"
                   class="form-range editor-slider"
                   min="5"
                   max="18"
                   step="0.25"
                   [(ngModel)]="row.areaMap.mapZoom"
                   (input)="onZoomChange()"
                   (ngModelChange)="onZoomChange()">
            <span class="text-muted editor-slider-value">{{ row.areaMap.mapZoom | number:"1.1-1" }}</span>
          </div>
        </div>
        <div class="col-md-2">
          <label class="form-label" for="height-input-{{id}}">Map Height (px)</label>
          <div class="editor-slider-group">
            <input type="range"
                   id="height-input-{{id}}"
                   class="form-range editor-slider"
                   min="300"
                   max="900"
                   step="10"
                   [(ngModel)]="row.areaMap.mapHeight"
                   (input)="broadcastChange()"
                   (ngModelChange)="broadcastChange()">
            <span class="text-muted editor-slider-value">{{ row.areaMap.mapHeight }}</span>
          </div>
        </div>
        <div class="col-md-2">
          <label class="form-label" for="center-lat-{{id}}">Vertical</label>
          <div class="editor-slider-group">
            <input type="range"
                   id="center-lat-{{id}}"
                   class="form-range editor-slider"
                   min="49"
                   max="61"
                   step="0.01"
                   [(ngModel)]="centerLat"
                   (input)="updateMapCenter()"
                   (ngModelChange)="updateMapCenter()">
            <span class="text-muted editor-slider-value">{{ centerLat | number:"1.2-2" }}</span>
          </div>
        </div>
      </div>

      <div class="row align-items-end mb-2 g-2">
        <div class="col-md-2">
          <label class="form-label" for="center-lng-{{id}}">Horizontal</label>
          <div class="editor-slider-group">
            <input type="range"
                   id="center-lng-{{id}}"
                   class="form-range editor-slider"
                   min="-8"
                   max="2"
                   step="0.01"
                   [(ngModel)]="centerLng"
                   (input)="updateMapCenter()"
                   (ngModelChange)="updateMapCenter()">
            <span class="text-muted editor-slider-value">{{ centerLng | number:"1.2-2" }}</span>
          </div>
        </div>
        <div class="col-md-2">
          <label class="form-label" for="opacity-normal-{{id}}">Normal Opacity</label>
          <div class="editor-slider-group">
            <input type="range"
                   id="opacity-normal-{{id}}"
                   class="form-range editor-slider"
                   min="0.1"
                   max="1"
                   step="0.1"
                   [(ngModel)]="row.areaMap.opacityNormal"
                   (input)="broadcastChange()"
                   (ngModelChange)="broadcastChange()">
            <span class="text-muted editor-slider-value">{{ row.areaMap.opacityNormal | number:"1.1-1" }}</span>
          </div>
        </div>
        <div class="col-md-2">
          <label class="form-label" for="opacity-hover-{{id}}">Hover Opacity</label>
          <div class="editor-slider-group">
            <input type="range"
                   id="opacity-hover-{{id}}"
                   class="form-range editor-slider"
                   min="0.1"
                   max="1"
                   step="0.1"
                   [(ngModel)]="row.areaMap.opacityHover"
                   (input)="broadcastChange()"
                   (ngModelChange)="broadcastChange()">
            <span class="text-muted editor-slider-value">{{ row.areaMap.opacityHover | number:"1.1-1" }}</span>
          </div>
        </div>
        <div class="col-md-2">
          <label class="form-label" for="opacity-text-{{id}}">Text Opacity</label>
          <div class="editor-slider-group">
            <input type="range"
                   id="opacity-text-{{id}}"
                   class="form-range editor-slider"
                   min="0.1"
                   max="1"
                   step="0.1"
                   [(ngModel)]="row.areaMap.textOpacity"
                   (input)="broadcastChange()"
                   (ngModelChange)="broadcastChange()">
            <span class="text-muted editor-slider-value">{{ row.areaMap.textOpacity | number:"1.1-1" }}</span>
          </div>
        </div>
        <div class="col-md-4">
          <app-badge-button [icon]="faUndo"
                            caption="Reset to Defaults"
                            (click)="resetToDefaults()"/>
        </div>
      </div>

      <div class="row mb-3">
        <div class="col-12">
          <h6>Live Preview</h6>
          <app-area-map [row]="row" [pageContent]="pageContent"/>
        </div>
      </div>
    }
  `,
  imports: [CommonModule, FormsModule, NgSelectComponent, BadgeButtonComponent, AreaMapComponent]
})
export class DynamicContentSiteEditAreaMapComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditAreaMapComponent", NgxLoggerLevel.OFF);
  private broadcastService = inject(BroadcastService);
  private pageContentActionsService = inject(PageContentActionsService);
  private cmsService = inject(AreaMapCmsService);
  private systemConfigService = inject(SystemConfigService);
  private groupAreasService = inject(GroupAreasService);
  @Input() row!: PageContentRow;
  @Input() id!: string;
  @Input() pageContent?: PageContent;

  public regionOptions: RegionOption[] = [];
  public providerOptions: KeyValue<string>[] = [
    { key: "osm", value: "OpenStreetMap" },
    { key: "os", value: "OS Maps" }
  ];
  public osStyles: MapStyleInfo[] = OS_MAP_STYLE_LIST;

  public centerLat = 51.25;
  public centerLng = 0.75;
  public availableGroups: string[] = [];

  protected readonly faUndo = faUndo;
  ngOnInit() {
    const systemConfig = this.systemConfigService.systemConfig();
    const regionName = systemConfig?.area?.shortName;
    if (regionName) {
      this.regionOptions = [{ key: regionName, value: regionName }];
    }
    this.ensureAreaMapData();
    this.updateCenterInputs();
    this.subscribeToCmsChanges();
    this.loadAvailableGroups();
  }

  private subscribeToCmsChanges() {
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_CHANGED, (event: NamedEvent<any>) => {
      if (event.data !== this.row || !this.row?.areaMap) {
        return;
      }

      if (isNumber(this.row.areaMap.mapZoom)) {
        this.logger.info("Zoom updated from map:", this.row.areaMap.mapZoom);
      }

      if (this.row.areaMap.mapCenter && isArray(this.row.areaMap.mapCenter)) {
        this.centerLat = this.row.areaMap.mapCenter[0];
        this.centerLng = this.row.areaMap.mapCenter[1];
        this.logger.info("Center updated from map:", this.centerLat, this.centerLng);
      }
    });
  }

  private ensureAreaMapData() {
    if (!this.row.areaMap) {
      this.row.areaMap = this.defaultAreaMapData();
      this.broadcastChange();
    }
  }

  private defaultAreaMapData(): AreaMapData {
    const systemConfig = this.systemConfigService.systemConfig();
    const regionName = systemConfig?.area?.shortName;
    return {
      region: regionName,
      title: "Areas",
      mapCenter: [51.25, 0.75],
      mapZoom: 10,
      mapHeight: 480,
      showControls: true,
      selectedGroups: [],
      clickAction: "group-website" as any,
      opacityNormal: 0.5,
      opacityHover: 0.8,
      textOpacity: 0.9,
      provider: "osm",
      osStyle: "Outdoor_27700",
      areaColors: {}
    };
  }

  private updateCenterInputs() {
    if (this.row.areaMap?.mapCenter) {
      this.centerLat = this.row.areaMap.mapCenter[0];
      this.centerLng = this.row.areaMap.mapCenter[1];
    }
  }

  updateRegion(region: string) {
    if (this.row.areaMap) {
      this.row.areaMap.region = region;
      this.broadcastChange();
    }
  }

  updateProvider(provider: string) {
    if (!this.row.areaMap) {
      return;
    }
    this.row.areaMap.provider = provider as MapProvider;
    if (provider === "os" && !this.row.areaMap.osStyle && this.osStyles.length > 0) {
      this.row.areaMap.osStyle = this.osStyles[0].key;
    }
    this.broadcastChange();
  }

  updateOsStyle(style: string) {
    if (!this.row.areaMap) {
      return;
    }
    this.row.areaMap.osStyle = style;
    this.broadcastChange();
  }

  updateMapCenter() {
    if (this.row.areaMap && Number.isFinite(this.centerLat) && Number.isFinite(this.centerLng)) {
      this.row.areaMap.mapCenter = [this.centerLat, this.centerLng];
      this.broadcastChange();
    }
  }

  resetToDefaults() {
    if (this.row.areaMap) {
      const defaults = this.defaultAreaMapData();
      Object.assign(this.row.areaMap, defaults);
      this.updateCenterInputs();
      this.broadcastChange();
    }
  }

  onZoomChange() {
    this.broadcastChange();
  }

  protected broadcastChange() {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_CHANGED, this.row));
  }

  private loadAvailableGroups() {
    const region = this.row.areaMap?.region;
    if (!region) {
      this.logger.warn("No region specified, cannot load groups");
      return;
    }

    this.groupAreasService.queryAllAreas(region).subscribe({
      next: (areas) => {
        this.availableGroups = areas.map(area => area.name).sort();
        this.logger.info("Loaded available groups:", this.availableGroups);
      },
      error: (error) => {
        this.logger.error("Failed to load available groups:", error);
        this.availableGroups = [];
      }
    });
  }

  onGroupSelectionChange() {
    this.broadcastChange();
  }

}
