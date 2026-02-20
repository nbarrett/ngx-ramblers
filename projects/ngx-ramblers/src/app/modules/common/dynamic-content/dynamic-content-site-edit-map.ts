import {
  ChangeDetectorRef,
  Component,
  DoCheck,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  OnInit,
  ViewChild
} from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import {
  EM_DASH_WITH_SPACES,
  MapData,
  MapRoute,
  PageContent,
  PageContentRow,
  PageContentType
} from "../../../models/content-text.model";
import { RootFolder } from "../../../models/system.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MapOverlayConfig, MapOverlayControls } from "../../../shared/components/map-overlay-controls";
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
import { isNumber, isUndefined } from "es-toolkit/compat";
import { RouteImportService } from "../../../services/maps/route-import.service";
import { DEFAULT_OS_STYLE, MapProvider } from "../../../models/map.model";

@Component({
  selector: "app-dynamic-content-site-edit-map",
  styleUrls: ["./dynamic-content.sass"],
  template: `
    @if (row?.map) {
      <div class="row mb-3 thumbnail-heading-frame">
        <div class="thumbnail-heading">Map Markers</div>
        <div class="col-12">
          <div class="mb-3">
            <div class="form-check">
              <input class="form-check-input"
                     type="checkbox"
                     id="use-location-{{id}}-{{row.type}}"
                     [disabled]="!hasLocationRow()"
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
                      <div class="d-flex align-items-center gap-2">
                        <input type="text"
                               class="form-control"
                               [(ngModel)]="route.name"
                               (ngModelChange)="broadcastChange()"
                               placeholder="Route name">
                        @if (routeFeatureCount(route)) {
                          <span class="badge badge-mintcake">{{ routeFeatureCount(route) }} paths</span>
                        }
                      </div>
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
                  <div class="row gy-3">
                    <div class="col-12">
                      <small class="text-muted d-block mb-2">Upload a GPX file or import a zipped shapefile/GeoJSON</small>
                      <div class="d-flex align-items-center gap-2 flex-wrap">
                        <button type="button"
                                class="btn btn-primary btn-sm"
                                (click)="routeFileInput.click()"
                                [disabled]="anyImportInProgress()">
                          Select file
                        </button>
                        <span class="text-muted small">{{ routeFileSummary(route) }}</span>
                      </div>
                      <input #routeFileInput
                             type="file"
                             class="d-none"
                             accept=".gpx,.zip,.geojson,.json"
                             (change)="onRouteFileSelected($event, route)"
                             [disabled]="anyImportInProgress()">
                    </div>
                  </div>
                </div>
              }
            </div>
          }
          @if (anyImportInProgress() || currentImportProgressMessage()) {
            <alert [type]="currentImportAlertType()" class="mb-3">
              <fa-icon [icon]="currentImportAlertIcon()"/>
              <strong class="ms-2">Route Import:</strong>
              <span class="ms-1">{{ currentImportProgressMessage() || 'Processing route file…' }}</span>
            </alert>
            @if (anyImportInProgress() && currentImportPercent() > 0) {
              <div class="progress mb-3" style="height: 8px;">
                <div class="progress-bar progress-bar-striped progress-bar-animated"
                     role="progressbar"
                     [style.width.%]="currentImportPercent()"
                     [attr.aria-valuenow]="currentImportPercent()"
                     aria-valuemin="0"
                     aria-valuemax="100">
                </div>
              </div>
            }
          }
          <app-badge-button
            [icon]="faAdd"
            caption="Add Route"
            [disabled]="anyImportInProgress()"
            (click)="triggerRouteUpload()"/>
          <input #globalRouteInput
                 type="file"
                 class="d-none"
                 accept=".gpx,.zip,.geojson,.json"
                 (change)="onRouteFileSelected($event, pendingRoute)">
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
          <div class="mt-3">
            <app-map-overlay-controls
              [config]="row.map"
              [id]="id"
              [showOpacityControls]="false"
              [defaults]="{
                provider: MapProvider.OSM,
                osStyle: DEFAULT_OS_STYLE,
                mapCenter: [51.25, 0.75],
                mapZoom: 10,
                mapHeight: 500,
                showControlsDefault: true,
                allowControlsToggle: true,
                showWaypointsDefault: true,
                allowWaypointsToggle: true,
                autoFitBounds: true
              }"
              (configChange)="onOverlayConfigChange($event)"/>
          </div>
        </div>
      </div>
    }
  `,
  imports: [CommonModule, FormsModule, MapOverlayControls, BadgeButtonComponent, AlertComponent, FontAwesomeModule, DynamicContentViewMap, MapRouteStylePaletteComponent]
})
export class DynamicContentSiteEditMap implements OnInit, OnDestroy, DoCheck {
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditMap", NgxLoggerLevel.ERROR);
  private broadcastService = inject(BroadcastService);
  private numberUtils = inject(NumberUtilsService);
  private fileUploadService = inject(FileUploadService);
  private routeImportService = inject(RouteImportService);
  private cdr = inject(ChangeDetectorRef);
  @ViewChild(DynamicContentViewMap) private mapPreview?: DynamicContentViewMap;
  @ViewChild("globalRouteInput") private globalRouteInput?: ElementRef<HTMLInputElement>;
  @Input() row!: PageContentRow;
  @Input() id!: string;
  @Input() pageContent?: PageContent;

  protected readonly faAdd = faAdd;
  protected readonly faTrash = faTrash;
  protected readonly faEye = faEye;
  protected readonly faEyeSlash = faEyeSlash;
  private uploaders: Map<string, FileUploader> = new Map();
  private importingRoutes: Set<string> = new Set();
  private importProgressMessages: Map<string, string> = new Map();
  private importProgressPercent: Map<string, number> = new Map();
  protected pendingRoute: MapRoute | null = null;
  public previewVersion = 0;
  protected readonly MapProvider = MapProvider;
  protected readonly DEFAULT_OS_STYLE = DEFAULT_OS_STYLE;
  protected readonly ALERT_SUCCESS = ALERT_SUCCESS;
  protected readonly ALERT_WARNING = ALERT_WARNING;
  private mapTilesService = inject(MapTilesService);
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;
  private lastSyncedLocationSignature: string | undefined;

  ngOnInit() {
    this.ensureMapData();
    if (this.useLocationFromPage()) {
      this.syncMarkersFromLocation();
      this.lastSyncedLocationSignature = this.locationSignature();
    } else {
      this.lastSyncedLocationSignature = undefined;
    }
  }

  ngOnDestroy() {
    this.uploaders.forEach(uploader => {
      uploader.clearQueue();
    });
    this.uploaders.clear();
  }

  ngDoCheck() {
    if (!this.row.map?.useLocationFromPage) {
      return;
    }
    if (!this.hasLocationRow()) {
      this.lastSyncedLocationSignature = undefined;
      this.clearMarkers();
      return;
    }
    const signature = this.locationSignature();
    if (!signature) {
      this.lastSyncedLocationSignature = undefined;
      this.clearMarkers();
      return;
    }
    if (signature !== this.lastSyncedLocationSignature) {
      this.lastSyncedLocationSignature = signature;
      this.syncMarkersFromLocation();
    }
  }

  private ensureMapData() {
    this.logger.info("ensureMapData:row:", this.row, "pageContent:", this.pageContent);
    if (!this.row.map) {
      this.row.map = {
        text: "",
        mapCenter: [51.25, 0.75],
        mapZoom: 10,
        mapHeight: 500,
        useLocationFromPage: this.hasLocationRow(),
        provider: MapProvider.OSM,
        osStyle: DEFAULT_OS_STYLE,
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
      if (isUndefined(this.row.map.useLocationFromPage)) {
        this.row.map.useLocationFromPage = this.hasLocationRow();
      }
    }
  }

  onOverlayConfigChange(config: MapOverlayConfig) {
    this.broadcastChange(true);
    void this.mapPreview?.applyOverlayConfigFromEditor(config as MapData);
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

  private addRoute(): MapRoute | undefined {
    if (!this.row.map) {
      return undefined;
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
    return newRoute;
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

  onRouteFileSelected(event: Event, route?: MapRoute | null) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.pendingRoute = null;
      return;
    }
    const targetRoute = route ?? this.pendingRoute;
    this.pendingRoute = null;
    if (!targetRoute) {
      this.logger.error("No route available for selected file");
      input.value = "";
      return;
    }

    const name = file.name.toLowerCase();
    if (name.endsWith(".gpx")) {
      this.uploadGpxFile(file, targetRoute);
    } else if (name.endsWith(".zip") || name.endsWith(".geojson") || name.endsWith(".json")) {
      void this.importEsriFile(file, targetRoute);
    } else {
      this.logger.error("Unsupported route file type:", file.name);
    }
    input.value = "";
  }

  private uploadGpxFile(file: File, route: MapRoute) {
    const uploader = this.fileUploadService.createUploaderFor(RootFolder.gpxRoutes, false);
    this.uploaders.set(route.id, uploader);
    const inheritedErrorHandler = uploader.onErrorItem;
    uploader.onSuccessItem = (item, response) => {
      this.logger.info("Upload successful for:", file.name);
      try {
        const uploadData: AwsFileUploadResponse = JSON.parse(response);
        if (uploadData.responses && uploadData.responses.length > 0) {
          route.gpxFile = uploadData.responses[0].fileNameData;
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
      inheritedErrorHandler?.call(uploader, item, response, status);
      this.logger.error("Upload failed:", response, status);
      this.uploaders.delete(route.id);
    };

    uploader.addToQueue([file]);
    uploader.uploadAll();
  }

  private async importEsriFile(file: File, route: MapRoute) {
    this.importingRoutes.add(route.id);
    this.importProgressMessages.set(route.id, "Starting import...");
    try {
      const response = await this.routeImportService.importEsri(file, (progress) => {
        this.importProgressMessages.set(route.id, progress.message);
        if (isNumber(progress.percent)) {
          this.importProgressPercent.set(route.id, progress.percent);
        }
        this.logger.info(`Import progress for ${route.id}:`, progress.message, progress.percent ? `${progress.percent}%` : "");
      });

      if (response.gpxFiles && response.gpxFiles.length > 1) {
        const firstGroup = response.gpxFiles[0];
        route.gpxFile = firstGroup.file;
        route.esriFile = response.esriFile;
        route.name = `${response.routeName}-${firstGroup.type}`;
        route.visible = false;
        route.featureCount = firstGroup.count;
        route.gpxFileSizeBytes = firstGroup.fileSizeBytes;
        route.spatialRouteId = firstGroup.routeId;

        response.gpxFiles.slice(1).forEach(group => {
          const newRoute = this.addRoute();
          if (newRoute) {
            newRoute.gpxFile = group.file;
            newRoute.esriFile = response.esriFile;
            newRoute.name = `${response.routeName}-${group.type}`;
            newRoute.visible = false;
            newRoute.featureCount = group.count;
            newRoute.gpxFileSizeBytes = group.fileSizeBytes;
            newRoute.spatialRouteId = group.routeId;
          }
        });
        this.importProgressMessages.set(route.id, `✓ Created ${response.gpxFiles.length} routes - toggle visibility to view (large files!)`);
      } else {
        route.gpxFile = response.gpxFile;
        route.esriFile = response.esriFile;
        route.name = response.routeName;
        this.importProgressMessages.set(route.id, `✓ Imported 1 route`);
      }

      this.broadcastChange();
      setTimeout(() => {
        this.importProgressMessages.delete(route.id);
        this.importProgressPercent.delete(route.id);
      }, 3000);
    } catch (error) {
      this.logger.error("ESRI import failed", error);
      this.importProgressMessages.set(route.id, `✗ Import failed: ${(error as Error).message}`);
      setTimeout(() => {
        this.importProgressMessages.delete(route.id);
        this.importProgressPercent.delete(route.id);
      }, 5000);
    } finally {
      this.importingRoutes.delete(route.id);
    }
  }

  triggerRouteUpload() {
    const newRoute = this.addRoute();
    if (!newRoute) {
      return;
    }
    this.pendingRoute = newRoute;
    this.globalRouteInput?.nativeElement?.click();
  }

  routeImportInProgress(routeId: string): boolean {
    return this.importingRoutes.has(routeId);
  }

  routeImportProgressMessage(routeId: string): string {
    return this.importProgressMessages.get(routeId) || "";
  }

  routeAlertType(routeId: string): string {
    const message = this.routeImportProgressMessage(routeId);
    if (message.startsWith("✓")) {
      return "success";
    }
    if (message.startsWith("✗")) {
      return "danger";
    }
    return "warning";
  }

  routeAlertIcon(routeId: string): any {
    const message = this.routeImportProgressMessage(routeId);
    if (message.startsWith("✓")) {
      return ALERT_SUCCESS.icon;
    }
    if (message.startsWith("✗")) {
      return ALERT_WARNING.icon;
    }
    return ALERT_WARNING.icon;
  }

  routeImportPercent(routeId: string): number {
    return this.importProgressPercent.get(routeId) || 0;
  }

  anyImportInProgress(): boolean {
    return this.importingRoutes.size > 0;
  }

  private findCurrentImportRouteId(): string | undefined {
    return Array.from(this.importingRoutes)[0];
  }

  currentImportProgressMessage(): string {
    const routeId = this.findCurrentImportRouteId();
    return routeId ? this.routeImportProgressMessage(routeId) : "";
  }

  currentImportAlertType(): string {
    const routeId = this.findCurrentImportRouteId();
    return routeId ? this.routeAlertType(routeId) : "warning";
  }

  currentImportAlertIcon(): any {
    const routeId = this.findCurrentImportRouteId();
    return routeId ? this.routeAlertIcon(routeId) : ALERT_WARNING.icon;
  }

  currentImportPercent(): number {
    const routeId = this.findCurrentImportRouteId();
    return routeId ? this.routeImportPercent(routeId) : 0;
  }

  routeFileSummary(route: MapRoute): string {
    const parts: string[] = [];
    if (route.gpxFile?.originalFileName) {
      let gpxPart = `GPX: ${route.gpxFile.originalFileName}`;
      if (route.gpxFileSizeBytes) {
        const sizeMB = (route.gpxFileSizeBytes / (1024 * 1024)).toFixed(1);
        gpxPart += ` (${sizeMB} MB)`;
        if (route.gpxFileSizeBytes > 5 * 1024 * 1024) {
          gpxPart += " ⚠️";
        }
      }
      parts.push(gpxPart);
    }
    if (route.esriFile?.originalFileName) {
      parts.push(`ESRI: ${route.esriFile.originalFileName}`);
    }
    return parts.join(" | ") || "No file selected";
  }

  routeFeatureCount(route: MapRoute): string | null {
    if (route.featureCount && route.featureCount > 0) {
      return route.featureCount.toLocaleString();
    }
    return null;
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
    if (!this.row.map || !this.pageContent) {
      return;
    }
    const before = this.mapLocationSnapshot();
    this.mapTilesService.syncMarkersFromLocation(this.pageContent, this.row);
    const after = this.mapLocationSnapshot();
    if (before !== after) {
      this.broadcastChange();
    }
  }

  useLocationFromPage(): boolean {
    return !!(this.row.map?.useLocationFromPage && this.hasLocationRow());
  }

  hasLocationRow(): boolean {
    return !!this.locationRow();
  }

  private locationRow(): PageContentRow | undefined {
    return this.pageContent?.rows?.find(candidate => candidate.type === PageContentType.LOCATION && candidate.location);
  }

  private locationSignature(): string | undefined {
    const locationRow = this.locationRow();
    if (!locationRow?.location) {
      return undefined;
    }
    const start = locationRow.location.start;
    const end = locationRow.location.end;
    const hasStart = start?.latitude != null && start?.longitude != null;
    const hasEnd = end?.latitude != null && end?.longitude != null;
    if (!hasStart && !hasEnd) {
      return undefined;
    }
    const startSig = hasStart ? `${start?.latitude ?? ""}|${start?.longitude ?? ""}|${start?.description ?? ""}` : "";
    const endSig = hasEnd ? `${end?.latitude ?? ""}|${end?.longitude ?? ""}|${end?.description ?? ""}` : "";
    return `${startSig}::${endSig}`;
  }

  private mapLocationSnapshot(): string {
    if (!this.row.map) {
      return "";
    }
    const markers = (this.row.map.markers || []).map(marker => ({
      latitude: marker.latitude,
      longitude: marker.longitude,
      label: marker.label
    }));
    return JSON.stringify({
      center: this.row.map.mapCenter || [],
      zoom: this.row.map.mapZoom,
      markers
    });
  }

  private clearMarkers() {
    if (this.row.map?.markers?.length) {
      this.row.map.markers = [];
      this.broadcastChange();
    }
  }

  toggleUseLocationFromPage(enabled: boolean) {
    if (!this.row.map) {
      return;
    }

    const previous = this.row.map.useLocationFromPage;
    this.row.map.useLocationFromPage = enabled;

    if (previous !== enabled) {
      this.broadcastChange(true);
    }

    if (!enabled) {
      this.lastSyncedLocationSignature = undefined;
      this.clearMarkers();
      return;
    }

    if (!this.hasLocationRow()) {
      return;
    }

    const signature = this.locationSignature();
    this.lastSyncedLocationSignature = signature;
    if (!signature) {
      return;
    }
    this.syncMarkersFromLocation();
  }

  removeMarker(index: number) {
    if (!this.row.map?.markers) {
      return;
    }
    this.row.map.markers.splice(index, 1);
    this.broadcastChange();
  }
}
