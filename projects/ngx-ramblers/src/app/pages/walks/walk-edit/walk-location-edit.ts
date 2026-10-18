import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output, ViewChild } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp, faDiamondTurnRight, faMap, faMapLocationDot, faMapPin, faPencil } from "@fortawesome/free-solid-svg-icons";
import { googleDrivingDirectionsUrl, withoutTrailingPostcode } from "../../../functions/locate";
import { formatGridReference } from "../../../functions/grid-reference";
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
import { LowerCasePipe } from "@angular/common";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { MapEditComponent } from "./map-edit";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { cloneDeep, isNull, isNumber } from "es-toolkit/compat";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { LocationType } from "../../../models/map.model";
import { VenueAutocompleteComponent } from "../walk-venue/venue-autocomplete";
import { VenueWithUsageStats } from "../../../models/event-venue.model";
import { resultPlaceName } from "../../../functions/venue";
import { PostcodeNavigationCheckComponent } from "../../../shared/components/postcode-navigation-check";
import { PostcodeMapPreview, PostcodeNavigationCheck } from "../../../models/postcode-navigation.model";
import { GridReferenceService } from "../../../services/maps/grid-reference.service";

@Component({
    selector: "app-walk-location-edit",
    styles: [`
      .walk-location-map-toggle
        flex-wrap: nowrap
      .walk-location-map-toggle .btn
        white-space: nowrap
        min-width: min-content
    `],
    template: `
    @if (locationDetails) {
      @if (!hideLocationDropdown) {
        <div class="row">
          <div class="col-12">
            <div class="form-group" [class.mb-0]="showLocationOnly">
              <label for="nearest-town">{{ locationType }} Location</label>
              <app-venue-autocomplete
                [disabled]="disabled"
                [placeholder]="locationSearchPlaceholder()"
                [startingPoint]="searchStartingPoint"
                [initialVenue]="searchInitialVenue"
                [showSelectionHint]="false"
                (venueSelected)="onVenueSelected($event)"/>
              @if (!disabled) {
                <small class="form-text text-muted">{{ locationSearchHint() }}</small>
              }
            </div>
          </div>
        </div>
        @if (showLocationPinHelp()) {
          <div class="row thumbnail-heading-frame mt-3">
            <div class="thumbnail-heading">How to set an exact {{ locationType | lowercase }} point</div>
            <div class="col-12">
              <button type="button" class="btn btn-quiet mb-2" (click)="toggleLocationHelp()">
                <fa-icon class="me-2" [icon]="locationHelpOpen ? faChevronUp : faChevronDown"/>
                {{ locationHelpOpen ? "Hide this help" : "Show this help" }}
              </button>
              @if (locationHelpOpen) {
                <ol class="mb-0 ps-3">
                  <li>In the search box, type the place (for example Junction of Hillside Lane and Station Approach, Hillside Park) and pick the first Google suggestion. That is only a first placement; the postcode it shows is the one Google has for that road, not necessarily the exact corner. If the postcode is already right, you can stop here.</li>
                  <li>Stay on Pin (the OS map), not Google Map. Zoom in until you can see the roads.</li>
                  <li>Drag the pin onto the exact spot people should meet. The form then looks up the nearest postcode and grid for that pin.</li>
                  <li>If a yellow notice says the postcode has changed, that is expected. You can keep the new one or pick another from the {{ locationType }} Postcode list.</li>
                  <li>If the result name differs from what you typed, you can keep your wording or use the result. The pin, postcode and grid still come from the result.</li>
                </ol>
              }
            </div>
          </div>
        }
      }
      @if (!showLocationOnly) {
      <div class="row" [class.mt-3]="!hideLocationDropdown">
        <div class="col-sm-6">
          <div class="form-group mb-0">
            <label [attr.for]="'location-postcode-' + locationType">{{ locationType }} Postcode</label>
            <div class="input-group">
              @if (showPostcodeSelect) {
                <ng-select [id]="'location-postcode-' + locationType"
                  class="postcode-select"
                  [items]="postcodeSelectItems"
                  [clearable]="true"
                  [searchable]="true"
                  [addTag]="true"
                  [disabled]="disabled"
                  bindLabel="label"
                  bindValue="postcode"
                  [(ngModel)]="locationDetails.postcode"
                  [ngModelOptions]="{standalone: true}"
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
                  [ngModelOptions]="{standalone: true}"
                  (ngModelChange)="postcodeChange()"
                  [class.is-invalid]="locationDetails.postcode && !postcodeValid()"
                  type="text" class="form-control input-sm"
                  [id]="'location-postcode-' + locationType"
                  [attr.name]="'location-postcode-' + locationType"
                  autocomplete="one-time-code"
                  autocapitalize="characters"
                  autocorrect="off"
                  spellcheck="false"
                  data-lpignore="true"
                  data-form-type="other"
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
                [ngModel]="gridReferenceText"
                (ngModelChange)="gridReferenceInput($event)"
                (blur)="formatGridReferenceText()"
                [class.is-invalid]="locationDetails.grid_reference_10 && !gridReferenceValid()"
                type="text" class="form-control input-sm" id="grid-reference"
                placeholder="Enter {{locationType}} Grid Reference here">
              <button type="button" class="btn btn-outline-secondary pointer"
                (click)="viewGridReference(display.gridReferenceFrom(locationDetails))"
                [disabled]="disabled || !locationDetails?.grid_reference_10"
                placement="top"
                tooltip="Show the {{locationType | lowercase}} grid reference on the map">
                <fa-icon [icon]="faMapLocationDot"/>
              </button>
            </div>
          </div>
        </div>
      </div>
      <app-postcode-navigation-check [latitude]="locationDetails.latitude" [longitude]="locationDetails.longitude"
        [postcode]="locationDetails.postcode" [compareInPlace]="true"
        [comparisonActive]="!!comparisonPreview" (compare)="showPostcodeComparison($event)"
        (clearComparison)="hidePostcodeComparison()"/>
      @if (!hideMap) {
      <div class="row mt-3">
        <div class="col-sm-12">
          <div class="btn-group walk-location-map-toggle w-100 mb-2" role="group" aria-label="Toggle Google Maps View">
            <button type="button" class="btn btn-primary text-nowrap" [class.active]="!showGoogleMapsView"
              [disabled]="disabled"
              (click)="selectPinView()">
              <fa-icon class="me-2" [icon]="faMapPin"/>Pin
            </button>
            <button type="button" class="btn btn-primary text-nowrap" [class.active]="showGoogleMapsView"
              [disabled]="disabled"
              (click)="selectGoogleMapView()">
              <fa-icon class="me-2" [icon]="faMap"/>Google Map
            </button>
          </div>
          @if (showGoogleMapsView) {
            <p>Google Map shows the pin you set ({{ numberUtils.asNumber(locationDetails.latitude, 4) }}, {{ numberUtils.asNumber(locationDetails.longitude, 4) }}). Directions use these coordinates, not the postcode.</p>
            @if (googleDirectionsHref) {
              <a class="btn btn-primary mb-2" [href]="googleDirectionsHref" target="_blank" rel="noopener">
                <fa-icon class="me-2" [icon]="faDiamondTurnRight"/>Get directions
              </a>
            }
            @if (googleMapsUrl) {
              <iframe allowfullscreen class="map-walk-location-edit" style="border:0;border-radius: 10px;"
              [src]="googleMapsUrl"></iframe>
            } @else {
              <div class="alert alert-warning d-flex align-items-start mb-0">
                <fa-icon [icon]="faMap" class="flex-shrink-0 mt-1"/>
                <div class="ms-2">
                  <strong class="d-block">No pin yet</strong>
                  Choose a starting location or place the pin, then open Google Map again.
                </div>
              </div>
            }
          }
          @if (showLeafletView) {
            <div [class.d-none]="showGoogleMapsView">
              <p class="mb-2" id="lat-long-{{locationType}}">
                @if (!disabled) {
                  Drag the pin to pinpoint the location.
                }
                {{ locationType }} lat/long: {{ numberUtils.asNumber(locationDetails.latitude, 4) }} / {{ numberUtils.asNumber(locationDetails.longitude, 4) }}
              </p>
              <div app-map-edit class="map-walk-location-edit" [locationType]="locationType"
                [locationDetails]="locationDetails"
                [endLocationDetails]="endLocationDetails"
                [showCombinedMap]="showCombinedMap"
                [comparisonPreview]="comparisonPreview"
                [gpxFile]="gpxFile"
                [routeColor]="routeColor"
                [routeWeight]="routeWeight"
                [routeOpacity]="routeOpacity"
                [readonly]="disabled"
                [notify]="notify"
                (postcodeOptionsChange)="handlePostcodeOptions($event)"
                (showPostcodeSelectChange)="showPostcodeSelect = $event"
                (locationChange)="onMapLocationChange()">
              </div>
            </div>
          }
        </div>
      </div>
      }
      }
    }`,
    styleUrls: ["./walk-edit.component.sass"],
    imports: [PostcodeNavigationCheckComponent, FormsModule, LowerCasePipe, TooltipDirective, MapEditComponent, NgSelectComponent, NgOptionTemplateDirective, NgLabelTemplateDirective, CopyIconComponent, VenueAutocompleteComponent, FontAwesomeModule]
})
export class WalkLocationEditComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkLocationEditComponent", NgxLoggerLevel.ERROR);
  googleMapsService = inject(GoogleMapsService);
  private addressQueryService = inject(AddressQueryService);
  private gridReferences = inject(GridReferenceService);
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
  @Input() public locationType!: LocationType;
  @Input("disabled") set previewValue(disabled: boolean) {
    this.disabled = coerceBooleanProperty(disabled);
  }
  @Input("locationDetails") set initialiseWalk(locationDetails: LocationDetails) {
    this.logger.info("locationDetails:", locationDetails);
    this.locationDetails = locationDetails;
    this.formatGridReferenceText();
    this.showLeafletView = this.shouldShowLeafletView();
    this.updateGoogleMapsUrl();
    this.syncSearchInputs();
  }
  @Input() endLocationDetails: LocationDetails | null = null;
  @Input() showCombinedMap = false;
  @Input() gpxFile: FileNameData;
  @Input() routeColor: string;
  @Input() routeWeight: number;
  @Input() routeOpacity: number;
  @Input() showLocationOnly = false;
  @Input() hideLocationDropdown = false;
  @Input() hideMap = false;
  @Output() locationDetailsChange = new EventEmitter<LocationDetails>();
  @Output() placeChosen = new EventEmitter<VenueWithUsageStats>();

  public showLeafletView = false;
  public disabled: boolean;
  public locationDetails: LocationDetails;
  public showPostcodeSelect = false;
  public postcodeOptions: {postcode: string, distance: number}[] = [];
  public postcodeSelectItems: {postcode: string, distance: number, label: string, distanceLabel: string}[] = [];
  public googleMapsUrl: SafeResourceUrl | null = null;
  public googleDirectionsHref: string | null = null;
  public faPencil = faPencil;
  public faDiamondTurnRight = faDiamondTurnRight;
  public faMapPin = faMapPin;
  public faMap = faMap;
  public faMapLocationDot = faMapLocationDot;
  public faChevronUp = faChevronUp;
  public faChevronDown = faChevronDown;
  public locationHelpOpen = true;
  public gridReferenceText = "";
  public showGoogleMapsView = false;
  public gridRefLookupBusy = false;
  public searchStartingPoint: { latitude: number; longitude: number } | null = null;
  public searchInitialVenue: Partial<VenueWithUsageStats> | null = null;
  public comparisonPreview: PostcodeMapPreview | null = null;

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

    if (this.locationType === LocationType.STARTING && this.hideLocationDropdown) {
      this.subscriptions.push(
        this.broadcastService.on(NamedEventType.WALK_START_LOCATION_CHANGED, (event) => {
          this.logger.info("WALK_START_LOCATION_CHANGED received:", event.data);
          if (event.data && this.locationDetails) {
            this.formatGridReferenceText();
            this.showLeafletView = this.shouldShowLeafletView();
            this.updateGoogleMapsUrl();
            setTimeout(() => this.mapComponent?.invalidateSize(), 0);
          }
        })
      );
    }
  }

  ngOnDestroy() {
    this.gridReferenceInput$.complete();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  selectPinView() {
    this.showGoogleMapsView = false;
    setTimeout(() => this.mapComponent?.invalidateSize(), 0);
  }

  selectGoogleMapView() {
    this.updateGoogleMapsUrl();
    this.showGoogleMapsView = true;
  }

  protected updateGoogleMapsUrl() {
    const postcode = this.locationDetails?.postcode?.trim();
    if (isNumber(this.locationDetails?.latitude) && isNumber(this.locationDetails?.longitude)) {
      this.googleMapsUrl = this.display.googleMapsUrl(false, postcode, postcode, this.locationDetails);
      this.googleDirectionsHref = googleDrivingDirectionsUrl(this.locationDetails.latitude, this.locationDetails.longitude);
    } else {
      this.googleMapsUrl = null;
      this.googleDirectionsHref = null;
    }
  }

  postcodeValid(): boolean {
    const postcode = this.locationDetails?.postcode?.trim();
    if (!postcode) return true;
    return /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i.test(postcode);
  }

  async postcodeChange(): Promise<void> {
    const postcode = this.locationDetails.postcode?.toUpperCase()?.trim() || null;
    this.locationDetails.postcode = postcode;
    const hasCoordinates = isNumber(this.locationDetails.latitude) && isNumber(this.locationDetails.longitude);
    if (postcode && !this.postcodeValid()) {
      this.notify?.warning({title: "Invalid postcode", message: "Enter a complete UK postcode. The pin and grid reference have been kept."});
    } else if (!hasCoordinates && postcode) {
      try {
        const result = await this.addressQueryService.gridReferenceLookup(postcode);
        if (this.locationDetails.postcode === postcode && !isNumber(this.locationDetails.latitude) && !isNumber(this.locationDetails.longitude)) {
          if (result?.error || !result?.latlng) {
            this.notify?.warning({title: "Postcode not found", message: result?.error || "No location data found for that postcode."});
          } else {
            this.applyPlaceLookupResult(result, postcode);
          }
        }
      } catch (error) {
        this.logger.error("Postcode lookup failed:", error);
        this.notify?.warning({title: "Postcode lookup unavailable", message: "Choose a place or set the pin on the map."});
      }
    }
    this.showLeafletView = this.shouldShowLeafletView();
    this.formatGridReferenceText();
    this.updateGoogleMapsUrl();
    this.syncSearchInputs();
    if (this.locationType === LocationType.STARTING && postcode && this.postcodeValid()) {
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_STARTING_POSTCODE_UPDATED, postcode));
    }
    this.locationDetailsChange.emit(cloneDeep(this.locationDetails));
  }

  showPostcodeComparison(check: PostcodeNavigationCheck): void {
    if (check.postcodePoint) {
      this.comparisonPreview = {
        latitude: check.postcodePoint.lat,
        longitude: check.postcodePoint.lng,
        postcode: check.postcode
      };
      this.showLeafletView = true;
      this.selectPinView();
    }
  }

  hidePostcodeComparison(): void {
    this.comparisonPreview = null;
  }

  gridReferenceInput(value: string) {
    this.gridReferenceText = value;
    const compact = (value || "").toUpperCase().replace(/\s/g, "");
    if (this.locationDetails) {
      this.locationDetails.grid_reference_10 = compact;
    }
    if (compact && !this.gridReferenceValid()) {
      this.notify?.warning({
        title: "Invalid format",
        message: `Grid reference must be 2 letters followed by 6 to 10 digits, such as ${formatGridReference("TQ8441731443")}`
      });
    } else if (compact && this.gridReferenceValid()) {
      this.notify?.clearBusy();
    }
    this.gridReferenceInput$.next(compact);
  }

  onMapLocationChange(): void {
    this.formatGridReferenceText();
    this.updateGoogleMapsUrl();
    this.locationDetailsChange.emit(this.locationDetails);
    const postcode = this.locationDetails?.postcode;
    if (this.locationType === LocationType.STARTING && postcode && this.postcodeValid()) {
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_STARTING_POSTCODE_UPDATED, postcode));
    }
  }

  formatGridReferenceText(): void {
    this.gridReferenceText = this.locationDetails?.grid_reference_10 ? this.display.gridReferenceFrom(this.locationDetails) : "";
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
    this.locationDetails.description = fallbackDescription || result.description;
    this.showLeafletView = true;
    this.formatGridReferenceText();
    this.updateGoogleMapsUrl();
    this.locationDetailsChange.emit(cloneDeep(this.locationDetails));
    setTimeout(() => this.mapComponent?.invalidateSize(), 0);
  }

  onAutocompleteLocationChange(result: GridReferenceLookupResponse) {
    if (result && this.locationDetails) {
      this.applyPlaceLookupResult(result, result.description || "");
      this.notify?.success(`Location resolved for "${result.description || result.postcode || "the selected place"}"`);
    }
  }

  locationSearchPlaceholder(): string {
    return "Name, postcode or place";
  }

  locationSearchHint(): string {
    if (this.locationType === LocationType.STARTING) {
      return "Pin, postcode and grid for the start. If you set a venue first, the start is filled from that. You can also search here.";
    } else if (this.locationType === LocationType.FINISHING || this.locationType === LocationType.END) {
      return "Where the walk finishes. Search by name, postcode or place.";
    } else {
      return "Where people meet before the start. Search by name, postcode or place.";
    }
  }

  showLocationPinHelp(): boolean {
    return !this.hideLocationDropdown && !this.showLocationOnly && !this.hideMap;
  }

  toggleLocationHelp() {
    this.locationHelpOpen = !this.locationHelpOpen;
  }

  private syncSearchInputs() {
    if (isNumber(this.locationDetails?.latitude) && isNumber(this.locationDetails?.longitude)) {
      this.searchStartingPoint = {latitude: this.locationDetails.latitude, longitude: this.locationDetails.longitude};
    } else {
      this.searchStartingPoint = null;
    }
    const postcode = this.locationDetails?.postcode || "";
    const description = withoutTrailingPostcode(this.locationDetails?.description);
    const name = description && description.toUpperCase() !== postcode.toUpperCase() ? description : postcode;
    if (name) {
      if (this.searchInitialVenue?.ngSelectLabel !== name && this.searchInitialVenue?.name !== name) {
        this.searchInitialVenue = {
          name,
          enteredName: name,
          ngSelectLabel: name,
          lat: this.locationDetails.latitude,
          lon: this.locationDetails.longitude
        };
      }
    } else {
      this.searchInitialVenue = null;
    }
  }

  async onVenueSelected(venue: VenueWithUsageStats) {
    if (venue && this.locationDetails) {
      await this.applyVenueToLocation(venue);
      if (this.locationType === LocationType.STARTING) {
        this.placeChosen.emit(venue);
      }
    }
  }

  private locationDescriptionFromVenue(venue: VenueWithUsageStats): string {
    const entered = withoutTrailingPostcode(venue.enteredName);
    const fromResult = resultPlaceName(venue);
    if (entered) {
      return entered;
    } else {
      return fromResult;
    }
  }

  private async applyVenueToLocation(venue: VenueWithUsageStats) {
    const description = this.locationDescriptionFromVenue(venue);
    const hasCoords = isNumber(venue.lat) && isNumber(venue.lon);
    if (hasCoords) {
      this.locationDetails.latitude = venue.lat;
      this.locationDetails.longitude = venue.lon;
      this.locationDetails.postcode = venue.postcode || null;
      this.locationDetails.description = description || this.locationDetails.description;
      const grid = this.gridReferences.fromLatLng(venue.lat, venue.lon);
      this.locationDetails.grid_reference_6 = grid?.gridReference6 || null;
      this.locationDetails.grid_reference_8 = grid?.gridReference8 || null;
      this.locationDetails.grid_reference_10 = grid?.gridReference10 || null;
      this.showLeafletView = true;
      this.formatGridReferenceText();
      this.updateGoogleMapsUrl();
      this.syncSearchInputs();
      this.locationDetailsChange.emit(cloneDeep(this.locationDetails));
      setTimeout(() => this.mapComponent?.invalidateSize(), 0);
      this.notify?.success(`${this.locationType} location set to "${description || venue.postcode}"`);
    } else if (venue.postcode) {
      const result = await this.addressQueryService.gridReferenceLookup(venue.postcode);
      this.applyPlaceLookupResult(result, description || venue.postcode);
      this.notify?.success(`Location set to "${description || venue.postcode}"`);
    } else {
      this.notify?.warning({
        title: "Place not complete",
        message: "That search result had no postcode or map position."
      });
    }
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

  async onPostcodeSelected(): Promise<void> {
    this.showPostcodeSelect = false;
    await this.postcodeChange();
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
