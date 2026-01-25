import { Component, inject, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { WalkDisplayService } from "../walk-display.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { LocationDetails } from "../../../models/ramblers-walks-manager";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { GridReferenceLookupResponse } from "../../../models/address-model";
import { FileNameData } from "../../../models/aws-object.model";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { FormsModule } from "@angular/forms";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { MapEditComponent } from "./map-edit";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { isNull, isNumber } from "es-toolkit/compat";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { LocationAutocompleteComponent } from "../../../shared/components/location-autocomplete";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEventType } from "../../../models/broadcast.model";

@Component({
    selector: "app-walk-location-edit",
    template: `
    @if (locationDetails) {
      @if (!hideLocationDropdown) {
        <div class="row">
          <div class="col-12">
            <div class="form-group" [class.mb-0]="showLocationOnly">
              <label for="nearest-town">{{ locationType }} Location</label>
              <app-location-autocomplete
                [disabled]="disabled"
                [value]="locationDetails?.description"
                placeholder="Enter a UK place name, landmark, or description"
                (locationChange)="onAutocompleteLocationChange($event)"/>
            </div>
          </div>
        </div>
      }
      @if (!showLocationOnly) {
      <div class="row" [class.mt-3]="!hideLocationDropdown">
        <div class="col-sm-6">
          <div class="form-group mb-0">
            <label for="post-code">{{ locationType }} Postcode</label>
            <div class="input-group">
              @if (showPostcodeSelect) {
                <ng-select id="post-code"
                  class="postcode-select"
                  [items]="postcodeSelectItems"
                  [clearable]="true"
                  [searchable]="true"
                  [addTag]="true"
                  [disabled]="disabled"
                  bindLabel="label"
                  bindValue="postcode"
                  [(ngModel)]="locationDetails.postcode"
                  (ngModelChange)="onPostcodeSelected()"
                  (clear)="showPostcodeSelect = false"
                  placeholder="Select postcode">
                  <ng-template ng-option-tmp let-item="item">
                    <div class="postcode-option">
                      <div class="postcode-value">{{ item.postcode }}</div>
                      <div class="postcode-distance">{{ item.distanceLabel }}</div>
                    </div>
                  </ng-template>
                  <ng-template ng-label-tmp let-item="item">
                    @if (item) {
                      <div class="postcode-option">
                        <div class="postcode-value">{{ item.postcode }}</div>
                        <div class="postcode-distance copy-exclude">{{ item.distanceLabel }}</div>
                      </div>
                    }
                  </ng-template>
                </ng-select>
              }
              @if (!showPostcodeSelect) {
                <input [disabled]="disabled" [(ngModel)]="locationDetails.postcode"
                  (ngModelChange)="postcodeChange()"
                  [class.is-invalid]="locationDetails.postcode && !postcodeValid()"
                  type="text" class="form-control input-sm" id="post-code"
                  placeholder="Enter Postcode here">
              }
              <button type="button" class="btn btn-outline-secondary"
                [disabled]="disabled || !locationDetails?.postcode?.trim()">
                <app-copy-icon
                  [disabled]="disabled || !locationDetails?.postcode?.trim()"
                  [value]="locationDetails?.postcode"
                  [elementName]="locationType + ' postcode'"/>
              </button>
            </div>
          </div>
        </div>
        <div class="col-sm-6 mt-3 mt-sm-0">
          <div class="form-group mb-0">
            <label for="grid-reference">{{ locationType }} Grid Reference</label>
            <div class="input-group">
              <input [disabled]="disabled"
                [(ngModel)]="locationDetails.grid_reference_10"
                (ngModelChange)="gridReferenceInput($event)"
                [class.is-invalid]="locationDetails.grid_reference_10 && !gridReferenceValid()"
                type="text" class="form-control input-sm" id="grid-reference"
                placeholder="Enter {{locationType}} Grid Reference here">
              <button type="button" class="btn btn-outline-secondary pointer"
                (click)="viewGridReference(display.gridReferenceFrom(locationDetails))"
                [disabled]="disabled"
                placement="top"
                tooltip="View {{locationType}} Grid Reference position in gridreferencefinder.com">
                <img src="/assets/images/local/grid-reference-finder.ico"/>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="row mt-3">
        <div class="col-sm-12">
          <div class="form-group mb-0 d-flex align-items-baseline gap-2">
            <label for="lat-long-{{locationType}}" class="mb-0">{{ locationType }} Lat/Long:</label>
            <div id="lat-long-{{locationType}}">{{ numberUtils.asNumber(locationDetails.latitude, 4) }} / {{ numberUtils.asNumber(locationDetails.longitude, 4) }}</div>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-sm-12">
          <div class="btn-group w-100 mb-2" role="group" aria-label="Toggle Google Maps View">
            <button type="button" class="btn btn-primary" [class.active]="!showGoogleMapsView"
              [disabled]="disabled"
              (click)="showGoogleMapsView = false">
              {{ locationType }} Pin Location
            </button>
            <button type="button" class="btn btn-primary" [class.active]="showGoogleMapsView"
              [disabled]="disabled"
              (click)="showGoogleMapsView = true">
              {{ locationType }} Location Google Map
            </button>
          </div>
          @if (showGoogleMapsView) {
            <p>The map below is a preview of where postcode
              <strong>{{ locationDetails.postcode }}</strong>
            will appear on Google Maps. This map will be displayed in the detail view of the walk.</p>
            @if (false) {
              <input type="number" min="1" max="20" (ngModelChange)="this.updateGoogleMapsUrl()"
                [(ngModel)]="display.googleMapsConfig.zoomLevel">
            }
            <iframe allowfullscreen class="map-walk-location-edit" style="border:0;border-radius: 10px;"
            [src]="googleMapsUrl"></iframe>
          }
          @if (!showGoogleMapsView && showLeafletView) {
            <p>Use the map below to drag the pin to accurately pinpoint the location.</p>
            <div app-map-edit class="map-walk-location-edit" [locationType]="locationType"
              [locationDetails]="locationDetails"
              [endLocationDetails]="endLocationDetails"
              [showCombinedMap]="showCombinedMap"
              [gpxFile]="gpxFile"
              [readonly]="disabled"
              [notify]="notify"
              (postcodeOptionsChange)="handlePostcodeOptions($event)"
              (showPostcodeSelectChange)="showPostcodeSelect = $event">
            </div>
          }
        </div>
      </div>
      }
    }`,
    styleUrls: ["./walk-edit.component.sass"],
    imports: [FormsModule, TooltipDirective, MapEditComponent, NgSelectComponent, NgOptionTemplateDirective, NgLabelTemplateDirective, CopyIconComponent, LocationAutocompleteComponent]
})
export class WalkLocationEditComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkLocationEditComponent", NgxLoggerLevel.ERROR);
  googleMapsService = inject(GoogleMapsService);
  private addressQueryService = inject(AddressQueryService);
  private broadcastService = inject<BroadcastService<string>>(BroadcastService);
  route = inject(ActivatedRoute);
  protected dateUtils = inject(DateUtilsService);
  display = inject(WalkDisplayService);
  stringUtils = inject(StringUtilsService);
  numberUtils = inject(NumberUtilsService);
  protected notifierService = inject(NotifierService);
  private notifyInstance: AlertInstance;
  private gridReferenceInput$ = new Subject<string>();
  private subscriptions: Subscription[] = [];
  @ViewChild(MapEditComponent) mapComponent: MapEditComponent;
  @Input() set notify(value: AlertInstance | undefined) {
    this.notifyInstance = value ?? this.notifierService.createGlobalAlert();
  }
  get notify(): AlertInstance {
    return this.notifyInstance;
  }
  @Input() public locationType!: string;
  @Input("disabled") set previewValue(disabled: boolean) {
    this.disabled = coerceBooleanProperty(disabled);
  }
  @Input("locationDetails") set initialiseWalk(locationDetails: LocationDetails) {
    this.logger.info("locationDetails:", locationDetails);
    this.locationDetails = locationDetails;
    this.showLeafletView = this.shouldShowLeafletView();
    this.updateGoogleMapsUrl();
  }
  @Input() endLocationDetails: LocationDetails | null = null;
  @Input() showCombinedMap = false;
  @Input() gpxFile: FileNameData;
  @Input() showLocationOnly = false;
  @Input() hideLocationDropdown = false;

  public showLeafletView = false;
  public disabled: boolean;
  public locationDetails: LocationDetails;
  public showPostcodeSelect = false;
  public postcodeOptions: {postcode: string, distance: number}[] = [];
  public postcodeSelectItems: {postcode: string, distance: number, label: string, distanceLabel: string}[] = [];
  public googleMapsUrl: SafeResourceUrl;
  public faPencil = faPencil;
  public showGoogleMapsView = false;
  public gridRefLookupBusy = false;

  gridReferenceValid(): boolean {
    const gridRef = this.locationDetails?.grid_reference_10?.trim();
    if (!gridRef) return true;
    return /^[A-Z]{2}\s?\d{6,10}$/.test(gridRef.toUpperCase().replace(/\s/g, ""));
  }

  async ngOnInit() {
    this.logger.info("locationType:", this.locationType, "locationDetails:", this.locationDetails);

    this.gridReferenceInput$
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(gridRef => {
        if (gridRef && gridRef.length >= 8) {
          this.gridReferenceChange();
        }
      });

    if (this.locationType === "Starting") {
      this.subscriptions.push(
        this.broadcastService.on(NamedEventType.WALK_START_LOCATION_CHANGED, (event) => {
          this.logger.info("WALK_START_LOCATION_CHANGED received:", event.data);
          if (event.data && this.locationDetails) {
            this.postcodeChange();
          }
        })
      );
    }
  }

  ngOnDestroy() {
    this.gridReferenceInput$.complete();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  toggleGoogleOrLeafletMapView() {
    this.showGoogleMapsView = !this.showGoogleMapsView;
    setTimeout(() => {
      this.showGoogleMapsView = !this.showGoogleMapsView;
    }, 0);
  }

  protected updateGoogleMapsUrl() {
    this.googleMapsUrl = this.display.googleMapsUrl(false, this.locationDetails.postcode, this.locationDetails.postcode);
  }

  postcodeValid(): boolean {
    const postcode = this.locationDetails?.postcode?.trim();
    if (!postcode) return true;
    return /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i.test(postcode);
  }

  async postcodeChange() {
    this.locationDetails.longitude = null;
    this.locationDetails.latitude = null;
    this.locationDetails.grid_reference_6 = null;
    this.locationDetails.grid_reference_8 = null;
    this.locationDetails.grid_reference_10 = null;

    if (!this.postcodeValid() && this.locationDetails.postcode?.length >= 5) {
      this.notify?.warning({
        title: "Invalid format",
        message: "UK postcode must be  1-2 letters, 1-2 digits, optional letter, space (optional), digit, 2 letters"
      });
      this.showLeafletView = false;
      this.updateGoogleMapsUrl();
      return Promise.resolve();
    }

    if (this.locationDetails.postcode.length >= 5) {
      const postcode = this.locationDetails.postcode;
      this.locationDetails.postcode = postcode?.toUpperCase()?.trim();
      const gridReferenceLookupResponse: GridReferenceLookupResponse = await this.addressQueryService.gridReferenceLookup(postcode);

      if (gridReferenceLookupResponse?.error) {
        this.notify?.warning({
          title: "Invalid postcode",
          message: gridReferenceLookupResponse.error
        });
        this.showLeafletView = false;
        this.updateGoogleMapsUrl();
        return Promise.resolve();
      }

      if (!gridReferenceLookupResponse?.latlng) {
        this.notify?.warning({
          title: "Postcode not found",
          message: `No location data found for postcode "${postcode}"`
        });
        this.showLeafletView = false;
        this.updateGoogleMapsUrl();
        return Promise.resolve();
      }

      this.notify?.clearBusy();
      this.locationDetails.grid_reference_6 = gridReferenceLookupResponse.gridReference6;
      this.locationDetails.grid_reference_8 = gridReferenceLookupResponse.gridReference8;
      this.locationDetails.grid_reference_10 = gridReferenceLookupResponse.gridReference10;
      this.locationDetails.latitude = gridReferenceLookupResponse.latlng.lat;
      this.locationDetails.longitude = gridReferenceLookupResponse.latlng.lng;
      this.showLeafletView = true;
      this.toggleGoogleOrLeafletMapView();
      return this.updateGoogleMapsUrl();
    } else {
      this.notify?.clearBusy();
      this.toggleGoogleOrLeafletMapView();
      this.showLeafletView = false;
      this.updateGoogleMapsUrl();
      return Promise.resolve();
    }
  }

  gridReferenceInput(value: string) {
    const trimmed = value?.trim();
    if (trimmed && !this.gridReferenceValid()) {
      this.notify?.warning({
        title: "Invalid format",
        message: "Grid reference must be 2 letters followed by 6-10 digits (e.g., TQ8441731443)"
      });
    } else if (trimmed && this.gridReferenceValid()) {
      this.notify?.clearBusy();
    }
    this.gridReferenceInput$.next(value);
  }

  async gridReferenceChange() {
    const gridRef = this.locationDetails?.grid_reference_10?.trim();
    if (!gridRef || gridRef.length < 8 || this.disabled) {
      return;
    }
    this.gridRefLookupBusy = true;
    this.notify?.progress(`Looking up grid reference "${gridRef}"`, true);
    try {
      const result = await this.addressQueryService.placeNameLookup(gridRef);
      if (!result) {
        throw new Error("Grid reference lookup failed");
      }
      if (result.error) {
        this.notify?.error({
          title: "Grid reference lookup failed",
          message: result.error
        });
        return;
      }
      this.applyPlaceLookupResult(result, gridRef);
      this.notify?.success({
        title: "Grid reference resolved",
        message: `Location found for "${gridRef}"`
      });
    } catch (error: any) {
      this.logger.error("gridReferenceChange:error", error);
      this.notify?.error({
        title: "Lookup failed",
        message: error?.message || "Unable to resolve grid reference"
      });
    } finally {
      this.gridRefLookupBusy = false;
      if (this.notify) {
        this.notify.clearBusy();
      }
    }
  }

  viewGridReference(gridReference: string) {
    return window.open(this.display.gridReferenceLink(gridReference));
  }

  private applyPlaceLookupResult(result: GridReferenceLookupResponse, fallbackDescription: string) {
    if (!this.locationDetails) {
      return;
    }
    if (result.latlng) {
      this.locationDetails.latitude = result.latlng.lat;
      this.locationDetails.longitude = result.latlng.lng;
    }
    this.locationDetails.grid_reference_6 = result.gridReference6 || null;
    this.locationDetails.grid_reference_8 = result.gridReference8 || null;
    this.locationDetails.grid_reference_10 = result.gridReference10 || null;
    if (result.postcode) {
      this.locationDetails.postcode = result.postcode;
    }
    this.locationDetails.description = result.description || fallbackDescription;
    this.showLeafletView = true;
    this.toggleGoogleOrLeafletMapView();
    this.updateGoogleMapsUrl();
  }

  onAutocompleteLocationChange(result: GridReferenceLookupResponse) {
    if (!result || !this.locationDetails) {
      return;
    }
    this.applyPlaceLookupResult(result, result.description || "");
    this.notify?.success(`Location resolved for "${result.description}"`);
  }

  private shouldShowLeafletView(): boolean {
    const hasLatLng = isNumber(this.locationDetails?.latitude) && isNumber(this.locationDetails?.longitude);
    const hasPostcode = !!this.locationDetails?.postcode?.trim();
    return hasLatLng || hasPostcode;
  }

  handlePostcodeOptions(options: {postcode: string, distance: number}[]) {
    this.postcodeOptions = options || [];
    this.postcodeSelectItems = this.postcodeOptions.map(option => ({
      ...option,
      label: this.postcodeLabel(option),
      distanceLabel: this.postcodeDistanceLabel(option)
    }));
  }

  async onPostcodeSelected() {
    this.updateGoogleMapsUrl();
    if (!this.locationDetails?.postcode) {
      return;
    }

    const isFromList = this.postcodeOptions.some(opt => opt.postcode === this.locationDetails.postcode);

    if (!isFromList) {
      this.showPostcodeSelect = false;
      return this.postcodeChange();
    }

    try {
      const result = await this.addressQueryService.gridReferenceLookup(this.locationDetails.postcode);
      if (result?.error) {
        this.notify?.warning({
          title: "Partial update",
          message: `Postcode ${this.locationDetails.postcode} selected but full details unavailable`
        });
        return;
      }
      if (result?.latlng) {
        this.locationDetails.latitude = result.latlng.lat;
        this.locationDetails.longitude = result.latlng.lng;
      }
      this.locationDetails.grid_reference_6 = result?.gridReference6 || null;
      this.locationDetails.grid_reference_8 = result?.gridReference8 || null;
      this.locationDetails.grid_reference_10 = result?.gridReference10 || null;
      this.showPostcodeSelect = false;
      this.toggleGoogleOrLeafletMapView();
      this.notify?.success({
        title: "Postcode updated",
        message: `${this.locationType} location updated to ${this.locationDetails.postcode}`
      });
    } catch (error: any) {
      this.logger.error("onPostcodeSelected:error", error);
      this.notify?.error({
        title: "Lookup failed",
        message: error?.message || "Unable to look up postcode details"
      });
    }
  }

  private postcodeLabel(option: {postcode: string, distance: number}): string {
    if (!option) {
      return "";
    }
    return option.postcode;
  }

  private postcodeDistanceLabel(option: {postcode: string, distance: number}): string {
    if (!option) {
      return "";
    }
    return isNull(option.distance) ? "keep existing" : `${this.numberUtils.asNumber(option.distance, 0)} m from pin`;
  }

  invalidateMapSize() {
    this.mapComponent?.invalidateSize();
  }
}
