import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import {
  EM_DASH_WITH_SPACES,
  MapRoute,
  PageContent,
  PageContentRow,
  PageContentType
} from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MapOverlayControls } from "../../../shared/components/map-overlay-controls";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { faAdd, faEye, faEyeSlash, faTrash } from "@fortawesome/free-solid-svg-icons";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { FileUploader } from "ng2-file-upload";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { AlertComponent } from "ngx-bootstrap/alert";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ALERT_SUCCESS, ALERT_WARNING } from "../../../models/alert-target.model";
import { AwsFileUploadResponse } from "../../../models/aws-object.model";
import { DynamicContentViewMap } from "./dynamic-content-view-map";
import { MapRouteStylePaletteComponent } from "./map-route-style-palette.component";
import { isUndefined } from "es-toolkit/compat";

@Component({
  selector: "app-dynamic-content-site-edit-map",
  styleUrls: ["./dynamic-content.sass"],
  template: `
    @if (row?.map) {
      <app-map-overlay-controls
        [config]="row.map"
        [id]="id"
        [showOpacityControls]="false"
        [defaults]="{
          provider: 'osm',
          osStyle: 'Leisure_27700',
          mapCenter: [51.25, 0.75],
          mapZoom: 10,
          mapHeight: 500,
          showControlsDefault: true,
          allowControlsToggle: true,
          showWaypointsDefault: true,
          allowWaypointsToggle: true,
          autoFitBounds: true
        }"
        (configChange)="onOverlayConfigChange()"/>

      <div class="row mb-3 thumbnail-heading-frame">
        <div class="thumbnail-heading">Map Markers</div>
        <div class="col-12">
          <div class="mb-3">
            <div class="form-check">
              <input class="form-check-input"
                     type="checkbox"
                     id="use-location-{{id}}-{{row.type}}"
                     [ngModel]="useLocationFromPage()"
                     (ngModelChange)="toggleUseLocationFromPage($event)">
              <label class="form-check-label" for="use-location-{{id}}-{{row.type}}">
                Use location from page
              </label>
            </div>
            <small class="form-text text-muted">Automatically add markers from Location row on this page</small>
          </div>
          @if (row.map.markers && row.map.markers.length > 0) {
            <div class="list-group mb-2">
              @for (marker of row.map.markers; let i = $index; track i) {
                <div class="list-group-item">
                  <div class="row align-items-center gy-2">
                    <div class="col-md-8">
                      <input type="text"
                             class="form-control"
                             [(ngModel)]="marker.label"
                             (ngModelChange)="broadcastChange()"
                             placeholder="Marker label">
                      <small class="text-muted">{{ marker.latitude }}, {{ marker.longitude }}</small>
                    </div>
                    <div class="col-md-4 text-end">
                      <app-badge-button
                        [icon]="faTrash"
                        caption="Remove"
                        (click)="removeMarker(i)"/>
                    </div>
                  </div>
                </div>
              }
            </div>
          } @else {
            <alert type="warning" class="flex-grow-1">
              <fa-icon [icon]="ALERT_WARNING.icon"/>
              <strong class="ms-2">No markers added yet{{ EM_DASH_WITH_SPACES }}</strong>
              <span class="ms-1">Enable "Use location from page</span>
            </alert>
          }
        </div>
      </div>

      <div class="row mb-3 thumbnail-heading-frame">
        <div class="thumbnail-heading">GPX Routes</div>
        <div class="col-12">
          @if (row.map.routes.length === 0) {
            <alert type="warning" class="flex-grow-1">
              <fa-icon [icon]="ALERT_WARNING.icon"/>
              <strong class="ms-2">No routes added yet{{ EM_DASH_WITH_SPACES }}</strong>
              <span class="ms-2">Upload a GPX file to add a route</span>
            </alert>
          } @else {
            <div class="list-group mb-2">
              @for (route of row.map.routes; track route.id) {
                <div class="list-group-item">
                  <div class="row align-items-center mb-2 gy-2">
                    <div class="col-md-4">
                      <input type="text"
                             class="form-control"
                             [(ngModel)]="route.name"
                             (ngModelChange)="broadcastChange()"
                             placeholder="Route name">
                    </div>
                    <div class="col-md-3">
                      <app-map-route-style-palette
                        [route]="route"
                        (styleChange)="broadcastChange()"/>
                    </div>
                    <div class="col-md-2">
                      <div class="form-check">
                        <input class="form-check-input"
                               type="checkbox"
                               [(ngModel)]="route.visible"
                               (ngModelChange)="broadcastChange()"
                               id="visible-{{route.id}}">
                        <label class="form-check-label" for="visible-{{route.id}}">
                          Visible
                        </label>
                      </div>
                    </div>
                    <div class="col-md-3 text-end d-flex justify-content-end flex-wrap gap-2">
                      <app-badge-button
                        [icon]="route.visible ? faEye : faEyeSlash"
                        [caption]="route.visible ? 'Hide' : 'Show'"
                        (click)="toggleRouteVisibility(route)"/>
                      <app-badge-button
                        [icon]="faTrash"
                        caption="Remove"
                        (click)="removeRoute(route)"/>
                    </div>
                  </div>
                  @if (route.gpxFile) {
                    <div class="row">
                      <div class="col-12">
                        <small class="text-muted">{{ route.gpxFile.originalFileName }}</small>
                      </div>
                    </div>
                  } @else {
                    <div class="row">
                      <div class="col-12">
                        <input type="file" class="form-control"
                               accept=".gpx"
                               (change)="onFileSelected($event, route)"
                               [id]="'file-input-' + route.id">
                        <small class="text-muted mt-1">Select a GPX file to upload</small>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
          <app-badge-button
            [icon]="faAdd"
            caption="Add Route"
            (click)="addRoute()"/>
        </div>
      </div>

      <div class="row mb-3">
        <div class="col-12">
          <label for="map-title-{{id}}">Map Text</label>
          <textarea type="text" rows="2"
                    class="form-control"
                    id="map-title-{{id}}"
                    [(ngModel)]="row.map.text"
                    (ngModelChange)="broadcastChange()"
                    placeholder="Enter map title"></textarea>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-12">
          @if (previewReady()) {
            <app-dynamic-content-view-map
              [row]="row"
              [refreshKey]="previewVersion"
              [editing]="true"
              (mapConfigChange)="onMapViewConfigChange()"/>
          } @else {
            <alert type="warning" class="flex-grow-1">
              <fa-icon [icon]="ALERT_WARNING.icon"/>
              <strong class="ms-2">Map preview unavailable</strong>
              <span>{{ EM_DASH_WITH_SPACES }}Add at least one visible route with a GPX upload or a marker to see the map preview</span>
            </alert>
          }
        </div>
      </div>
    }
  `,
  imports: [CommonModule, FormsModule, MapOverlayControls, BadgeButtonComponent, AlertComponent, FontAwesomeModule, DynamicContentViewMap, MapRouteStylePaletteComponent]
})
export class DynamicContentSiteEditMap implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditMap", NgxLoggerLevel.INFO);
  private broadcastService = inject(BroadcastService);
  private numberUtils = inject(NumberUtilsService);
  private fileUploadService = inject(FileUploadService);

  @Input() row!: PageContentRow;
  @Input() id!: string;
  @Input() pageContent?: PageContent;

  protected readonly faAdd = faAdd;
  protected readonly faTrash = faTrash;
  protected readonly faEye = faEye;
  protected readonly faEyeSlash = faEyeSlash;
  private uploaders: Map<string, FileUploader> = new Map();
  public previewVersion = 0;
  protected readonly ALERT_SUCCESS = ALERT_SUCCESS;
  protected readonly ALERT_WARNING = ALERT_WARNING;
  private mapTilesService = inject(MapTilesService);
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;

  ngOnInit() {
    this.ensureMapData();
    this.syncMarkersFromLocation();
  }

  ngOnDestroy() {
    this.uploaders.forEach(uploader => {
      uploader.clearQueue();
    });
    this.uploaders.clear();
  }

  private ensureMapData() {
    this.logger.info("ensureMapData:row:", this.row, "pageContent:", this.pageContent);
    if (!this.row.map) {
      this.row.map = {
        text: "",
        mapCenter: [51.25, 0.75],
        mapZoom: 10,
        mapHeight: 500,
        provider: "osm",
        osStyle: "Leisure_27700",
        showControlsDefault: true,
        allowControlsToggle: true,
        showWaypointsDefault: true,
        allowWaypointsToggle: true,
        autoFitBounds: true,
        routes: []
      };
      this.broadcastChange();
    } else {
      if (isUndefined(this.row.map.showControlsDefault)) {
        this.row.map.showControlsDefault = true;
      }
      if (isUndefined(this.row.map.allowControlsToggle)) {
        this.row.map.allowControlsToggle = true;
      }
      if (isUndefined(this.row.map.showWaypointsDefault)) {
        this.row.map.showWaypointsDefault = true;
      }
      if (isUndefined(this.row.map.allowWaypointsToggle)) {
        this.row.map.allowWaypointsToggle = true;
      }
      if (isUndefined(this.row.map.autoFitBounds)) {
        this.row.map.autoFitBounds = true;
      }
    }
  }

  onOverlayConfigChange() {
    this.broadcastChange();
  }

  protected broadcastChange(skipPreviewIncrement: boolean = false) {
    if (!skipPreviewIncrement) {
      this.previewVersion++;
    }
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_CHANGED, this.row));
  }

  previewReady(): boolean {
    const routes = this.row?.map?.routes || [];
    const markers = this.row?.map?.markers || [];
    const hasVisibleRoutes = routes.some(route => route.visible !== false && !!route?.gpxFile?.awsFileName);
    const hasMarkers = markers.length > 0;
    return hasVisibleRoutes || hasMarkers;
  }

  onMapViewConfigChange() {
    this.broadcastChange(true);
  }

  addRoute() {
    if (!this.row.map) {
      return;
    }

    const newRoute:MapRoute= {
      id: this.numberUtils.generateUid(),
      name: `Route ${this.row.map.routes.length + 1}`,
      gpxFile: null,
      color: this.nextColor(),
      visible: true,
      weight: 8,
      opacity: 1.0
    };

    this.row.map.routes.push(newRoute);
    this.broadcastChange();
  }

  removeRoute(route: MapRoute) {
    if (!this.row.map) {
      return;
    }

    this.row.map.routes = this.row.map.routes.filter(r => r.id !== route.id);
    this.broadcastChange();
  }

  toggleRouteVisibility(route: MapRoute) {
    route.visible = !route.visible;
    this.broadcastChange();
  }

  onFileSelected(event: Event, route: MapRoute) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    if (!file.name.toLowerCase().endsWith(".gpx")) {
      this.logger.error("Invalid file type: expected GPX file, got:", file.name);
      return;
    }

    const uploader = this.fileUploadService.createUploaderFor("gpx-routes", false);
    this.uploaders.set(route.id, uploader);

    uploader.onSuccessItem = (item, response) => {
      this.logger.info("Upload successful for:", file.name);
      try {
        const uploadData:AwsFileUploadResponse = JSON.parse(response);
        this.logger.info("uploadData:", uploadData);
        if (uploadData.responses && uploadData.responses.length > 0) {
          route.gpxFile = uploadData.responses[0].fileNameData;
          this.logger.info("route.gpxFile:", route.gpxFile, "row.map:", this.row.map);
          if (!route.name || route.name.startsWith("Route ")) {
            route.name = file.name.replace(/\.gpx$/i, "");
          }
          this.broadcastChange();
        }
      } catch (error) {
        this.logger.error("Failed to parse upload response:", error);
      }
      this.uploaders.delete(route.id);
    };

    uploader.onErrorItem = (item, response, status) => {
      this.logger.error("Upload failed:", response, status);
      this.uploaders.delete(route.id);
    };

    uploader.addToQueue([file]);
    uploader.uploadAll();
  }

  private nextColor(): string {
    const colors = [
      "#FF0000",
      "#0000FF",
      "#00FF00",
      "#FF00FF",
      "#FFFF00",
      "#00FFFF",
      "#FFA500",
      "#800080",
      "#008000",
      "#000080"
    ];
    const usedColors = this.row.map?.routes.map(r => r.color) || [];
    const availableColors = colors.filter(c => !usedColors.includes(c));
    return availableColors.length > 0 ? availableColors[0] : colors[0];
  }

  private syncMarkersFromLocation() {
    this.mapTilesService.syncMarkersFromLocation(this.pageContent, this.row);
    this.broadcastChange();
  }

  useLocationFromPage(): boolean {
    return !!this.pageContent?.rows?.some(r => r.type === PageContentType.LOCATION && r.location);
  }

  toggleUseLocationFromPage(enabled: boolean) {
    if (!this.row.map) {
      return;
    }

    if (enabled) {
      const locationRow = this.pageContent?.rows?.find(r => r.type === PageContentType.LOCATION && r.location);
      if (locationRow?.location) {
        this.row.map.markers = [];

        if (locationRow.location.start?.latitude != null && locationRow.location.start?.longitude != null) {
          this.row.map.markers.push({
            latitude: locationRow.location.start.latitude,
            longitude: locationRow.location.start.longitude,
            label: locationRow.location.start.description || "Start"
          });
        }

        if (locationRow.location.end?.latitude != null && locationRow.location.end?.longitude != null) {
          this.row.map.markers.push({
            latitude: locationRow.location.end.latitude,
            longitude: locationRow.location.end.longitude,
            label: locationRow.location.end.description || "End"
          });
        }

        if (locationRow.location.start?.latitude != null && locationRow.location.start?.longitude != null) {
          this.row.map.mapCenter = [locationRow.location.start.latitude, locationRow.location.start.longitude];
          if (!this.row.map.mapZoom || this.row.map.mapZoom < 10) {
            this.row.map.mapZoom = 14;
          }
        }

        this.logger.info("toggleUseLocationFromPage: Added markers:", this.row.map.markers, "centered at:", this.row.map.mapCenter);
      }
    } else {
      this.row.map.markers = [];
      this.logger.info("toggleUseLocationFromPage: Cleared all markers");
    }
    this.broadcastChange();
  }

  removeMarker(index: number) {
    if (!this.row.map?.markers) {
      return;
    }
    this.row.map.markers.splice(index, 1);
    this.broadcastChange();
  }
}
