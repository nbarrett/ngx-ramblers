import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent, PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgSelectComponent } from "@ng-select/ng-select";
import { KeyValue } from "../../../functions/enums";
import { AreaMap } from "../../../pages/area-map/area-map";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { GroupAreasService } from "../../../services/group-areas.service";
import { MapOverlayControls } from "../../../shared/components/map-overlay-controls";

interface RegionOption extends KeyValue<string> {}

@Component({
  selector: "app-dynamic-content-site-edit-area-map",
  styleUrls: ["./dynamic-content.sass"],
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

      <app-map-overlay-controls
        [config]="row.areaMap"
        [id]="id"
        [showOpacityControls]="true"
        [defaults]="{
          provider: 'osm',
          osStyle: 'Outdoor_27700',
          mapCenter: [51.25, 0.75],
          mapZoom: 10,
          mapHeight: 480,
          opacityNormal: 0.5,
          opacityHover: 0.8,
          textOpacity: 0.9
        }"
        (configChange)="onOverlayConfigChange()"/>

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
  imports: [CommonModule, FormsModule, NgSelectComponent, AreaMap, MapOverlayControls]
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
    if (!this.row.areaMap) {
      const systemConfig = this.systemConfigService.systemConfig();
      const regionName = systemConfig?.area?.shortName;
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
        provider: "osm",
        osStyle: "Outdoor_27700",
        areaColors: {}
      };
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

  private recreateAreaMap() {
    this.showAreaMap = false;
    setTimeout(() => {
      this.showAreaMap = true;
    }, 50);
  }

}
