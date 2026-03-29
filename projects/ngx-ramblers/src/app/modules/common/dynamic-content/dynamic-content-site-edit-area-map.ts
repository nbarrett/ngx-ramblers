import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LegendPosition, PageContent, PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";

import { DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgSelectComponent } from "@ng-select/ng-select";
import { KeyValue } from "../../../functions/enums";
import { AreaMap } from "../../../pages/area-map/area-map";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { GroupAreasService } from "../../../services/group-areas.service";
import { MapOverlayControls } from "../../../shared/components/map-overlay-controls";
import { MapProvider, OUTDOOR_OS_STYLE } from "../../../models/map.model";
import { SharedDistrictStyle } from "../../../models/system.model";
import { SharedDistrictStyleSelectorComponent } from "../../../shared/components/shared-district-style-selector";
import { LegendPositionSelectorComponent } from "../../../shared/components/legend-position-selector";

interface RegionOption extends KeyValue<string> {}

@Component({
  selector: "app-dynamic-content-site-edit-area-map",
  styleUrls: ["./dynamic-content.sass"],
  template: `
    @if (row?.areaMap) {
      <app-map-overlay-controls
        [config]="row.areaMap"
        [id]="id"
        [showOpacityControls]="true"
        [defaults]="{
          provider: MapProvider.OSM,
          osStyle: OUTDOOR_OS_STYLE,
          mapCenter: [51.25, 0.75],
          mapZoom: 10,
          mapHeight: 480,
          opacityNormal: 0.5,
          opacityHover: 0.8,
          textOpacity: 0.9
        }"
        (configChange)="onOverlayConfigChange()"/>

      <div class="row mb-2">
        <div class="col-md-6">
          <div class="form-check">
            <input type="checkbox" class="form-check-input" id="show-areas-{{id}}"
                   [ngModel]="row.areaMap.showAreas !== false"
                   (ngModelChange)="row.areaMap.showAreas = $event; onParishSettingChange()">
            <label class="form-check-label" for="show-areas-{{id}}">
              Show group area overlays
            </label>
          </div>
        </div>
      </div>
      @if (row.areaMap.showAreas !== false) {
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
        <div class="row mb-2">
          <div class="col-md-6">
            <div class="form-group">
              <label>Shared District Display Style</label>
              <app-shared-district-style-selector
                [(value)]="row.areaMap.sharedDistrictStyle"
                (valueChange)="onStyleChange()">
              </app-shared-district-style-selector>
              <small class="form-text text-muted">How to display districts shared between groups</small>
            </div>
          </div>
          <div class="col-md-6">
            <div class="form-group">
              <label>Legend Position</label>
              <app-legend-position-selector
                [(value)]="row.areaMap.legendPosition"
                [disabled]="!row.areaMap.showLegend"
                (valueChange)="onLegendChange()">
              </app-legend-position-selector>
            </div>
          </div>
        </div>
        <div class="row mb-2">
          <div class="col-12">
            <div class="form-check">
              <input type="checkbox" class="form-check-input" id="show-legend-{{id}}"
                     [(ngModel)]="row.areaMap.showLegend"
                     (ngModelChange)="onLegendChange()">
              <label class="form-check-label" for="show-legend-{{id}}">
                Show legend with group names and colors
              </label>
            </div>
          </div>
        </div>
      }
      <div class="row mb-2">
        <div class="col-md-6">
          <div class="form-check">
            <input type="checkbox" class="form-check-input" id="show-parishes-{{id}}"
                   [(ngModel)]="row.areaMap.showParishes"
                   (ngModelChange)="onParishSettingChange()">
            <label class="form-check-label" for="show-parishes-{{id}}">
              Show civil parish boundaries (from ONS)
            </label>
          </div>
        </div>
      </div>
      @if (row.areaMap.showParishes) {
        <div class="row mb-2">
          <div class="col-md-3">
            <div class="form-group">
              <label for="parish-allocated-{{id}}">Allocated Colour</label>
              <input type="color" class="form-control form-control-sm" id="parish-allocated-{{id}}"
                     [ngModel]="row.areaMap.parishAllocatedColor || '#4a8c3f'"
                     (ngModelChange)="row.areaMap.parishAllocatedColor = $event; onParishSettingChange()">
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <label for="parish-vacant-{{id}}">Vacant Colour</label>
              <input type="color" class="form-control form-control-sm" id="parish-vacant-{{id}}"
                     [ngModel]="row.areaMap.parishVacantColor || '#cc0000'"
                     (ngModelChange)="row.areaMap.parishVacantColor = $event; onParishSettingChange()">
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <label for="parish-border-{{id}}">Border Colour</label>
              <input type="color" class="form-control form-control-sm" id="parish-border-{{id}}"
                     [ngModel]="row.areaMap.parishBorderColor || '#333333'"
                     (ngModelChange)="row.areaMap.parishBorderColor = $event; onParishSettingChange()">
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-group">
              <label for="parish-opacity-{{id}}">Fill Opacity</label>
              <input type="range" class="form-range" id="parish-opacity-{{id}}" min="0" max="1" step="0.05"
                     [ngModel]="row.areaMap.parishFillOpacity ?? 0.7"
                     (ngModelChange)="row.areaMap.parishFillOpacity = $event; onParishSettingChange()">
              <small class="form-text text-muted">{{ (row.areaMap.parishFillOpacity ?? 0.7) | number:'1.2-2' }}</small>
            </div>
          </div>
        </div>
      }

      <div class="row mb-3">
        <div class="col-12">
          <h6>Live Preview</h6>
          @if (showAreaMap) {
            <app-area-map [row]="row" [pageContent]="pageContent"/>
          }
        </div>
      </div>
    }
  `,
  imports: [DecimalPipe, FormsModule, NgSelectComponent, AreaMap, MapOverlayControls, SharedDistrictStyleSelectorComponent, LegendPositionSelectorComponent]
})
export class DynamicContentSiteEditAreaMapComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditAreaMapComponent", NgxLoggerLevel.OFF);
  private broadcastService = inject(BroadcastService);
  private systemConfigService = inject(SystemConfigService);
  private groupAreasService = inject(GroupAreasService);
  @Input() row!: PageContentRow;
  @Input() id!: string;
  @Input() pageContent?: PageContent;

  public regionOptions: RegionOption[] = [];
  public availableGroups: string[] = [];
  public showAreaMap = true;
  protected readonly MapProvider = MapProvider;
  protected readonly OUTDOOR_OS_STYLE = OUTDOOR_OS_STYLE;
  ngOnInit() {
    const systemConfig = this.systemConfigService.systemConfig();
    const regionName = systemConfig?.area?.shortName;
    if (regionName) {
      this.regionOptions = [{ key: regionName, value: regionName }];
    }
    this.ensureAreaMapData();
    this.loadAvailableGroups();
  }

  private ensureAreaMapData() {
    const systemConfig = this.systemConfigService.systemConfig();
    const regionName = systemConfig?.area?.shortName;
    if (!this.row.areaMap) {
      this.row.areaMap = {
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
        provider: MapProvider.OSM,
        osStyle: OUTDOOR_OS_STYLE,
        areaColors: {},
        showLegend: false,
        legendPosition: LegendPosition.TOP_RIGHT,
        sharedDistrictStyle: systemConfig?.area?.sharedDistrictStyle || SharedDistrictStyle.FIRST_GROUP
      };
      this.broadcastChange();
    } else if (regionName && this.row.areaMap.region !== regionName) {
      this.logger.info("Syncing region from system config:", this.row.areaMap.region, "->", regionName);
      this.row.areaMap.region = regionName;
      this.broadcastChange();
    }
  }

  updateRegion(region: string) {
    if (this.row.areaMap) {
      this.row.areaMap.region = region;
      this.broadcastChange();
    }
  }

  onOverlayConfigChange() {
    this.broadcastChange();
    this.recreateAreaMap();
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

  onLegendChange() {
    this.broadcastChange();
    this.recreateAreaMap();
  }

  onStyleChange() {
    this.broadcastChange();
    this.recreateAreaMap();
  }

  onParishSettingChange() {
    this.broadcastChange();
    this.recreateAreaMap();
  }

  private recreateAreaMap() {
    this.showAreaMap = false;
    setTimeout(() => {
      this.showAreaMap = true;
    }, 50);
  }

}
