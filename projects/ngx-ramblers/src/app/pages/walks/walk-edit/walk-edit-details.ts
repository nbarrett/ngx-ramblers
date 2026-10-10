import { AfterViewInit, Component, inject, Input, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from "@angular/core";
import { firstValueFrom, Subscription } from "rxjs";
import { Router } from "@angular/router";
import { DetailsTab, DisplayedWalk, GpxFileListItem, INITIALISED_LOCATION, WalkGpxField, WalkGpxFieldProposal, WalkType } from "../../../models/walk.model";
import { GpxDerivedValues } from "../../../models/gpx-proposals.model";
import { GpxProposalsService } from "../../../services/maps/gpx-proposals.service";
import { GpxProposalsComponent } from "../../../shared/components/gpx-proposals";
import { FormsModule } from "@angular/forms";
import { WalkLocationEditComponent } from "./walk-location-edit";
import { EventAscentEdit } from "./event-ascent-edit.component";
import { LocationDetails } from "../../../models/ramblers-walks-manager";
import { WalkDisplayService } from "../walk-display.service";
import { AlertInstance } from "../../../services/notifier.service";
import { cloneDeep, isEmpty, isNumber, isString, values } from "es-toolkit/compat";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { enumValueForKey } from "../../../functions/enums";
import { JsonPipe } from "@angular/common";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { WalkGpxService } from "../../../services/walks/walk-gpx.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Venue } from "../walk-venue/venue";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { VenueService } from "../../../services/venue/venue.service";
import { VenueWithUsageStats } from "../../../models/event-venue.model";
import { TimePicker } from "../../../date-and-time/time-picker";
import { LocationType, MapProvider } from "../../../models/map.model";
import { StoredValue } from "../../../models/ui-actions";
import { AppPath, RouteFollowPoint, RouteFollowWaypoint } from "../../../models/route-follow.model";
import { MapEditComponent } from "./map-edit";
import { RouteDirectionsEditor } from "../../../shared/components/route-directions-editor";
import { WalkGradeSelect } from "../../../shared/components/walk-grade-select";
import { MaximisableMapComponent, MaximisableMapState } from "../../../modules/common/maximisable-map/maximisable-map";
import { MapMarkerStyleService } from "../../../services/maps/map-marker-style.service";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { RootFolder } from "../../../models/system.model";
import { UrlService } from "../../../services/url.service";
import { HttpClient } from "@angular/common/http";
import { FileNameData } from "../../../models/aws-object.model";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCloudArrowUp, faMap, faPencil, faRightLeft, faTableColumns, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { LatLng } from "leaflet";

@Component({
  selector: "app-walk-edit-details",
  imports: [
    GpxProposalsComponent,
    FormsModule,
    WalkLocationEditComponent,
    EventAscentEdit,
    JsonPipe,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    Venue,
    SectionToggle,
    MapEditComponent,
    RouteDirectionsEditor,
    WalkGradeSelect,
    MaximisableMapComponent,
    TimePicker,
    FontAwesomeModule
  ],
  template: `
    @if (displayedWalk?.walk?.groupEvent) {
      <div class="img-thumbnail thumbnail-admin-edit">
        <app-section-toggle
          [tabs]="tabs"
          [(selectedTab)]="selectedTab"
          [queryParamKey]="StoredValue.SUB_TAB"/>
        @if ((selectedTab === DetailsTab.VENUE || selectedTab === DetailsTab.VENUE_ROUTE_AND_DIRECTIONS) && displayedWalk?.walk?.fields?.venue) {
          <app-venue [event]="displayedWalk.walk" [inputDisabled]="inputDisabled"
                     [hasSeparateMeetingPoint]="hasSeparateMeetingPoint"
                     (venuePostcodeChange)="onVenuePostcodeChange($event)"
                     (useVenueAsMeetingPoint)="onUseVenueAsMeetingPoint($event)"/>
        }
        @if (selectedTab === DetailsTab.ROUTE || selectedTab === DetailsTab.VENUE_ROUTE_AND_DIRECTIONS) {
          <div class="row thumbnail-heading-frame">
            <div class="thumbnail-heading">Route</div>
            @if (false) {
              <div class="col-sm-6">
                <pre>shape:{{ displayedWalk.walk.groupEvent.shape|json }}</pre>
              </div>
              <div class="col-sm-6">
                <pre>walkTypes:{{ display.walkTypes|json }}</pre>
              </div>
            }
            <div class="col-sm-12">
              <div class="row">
                <div class="col-sm-4">
                  <div class="form-group">
                    <label for="grade">Grade</label>
                    @if (allowDetailView) {
                      <app-walk-grade-select inputId="grade"
                                             [value]="displayedWalk.walk.groupEvent.difficulty"
                                             [disabled]="syncDisabled"
                                             (valueChange)="displayedWalk.walk.groupEvent.difficulty = $event"/>
                    }
                  </div>
                </div>
                <div class="col-sm-4">
                  <div class="form-group">
                    <label for="walkType">Walk Type</label>
                    @if (allowDetailView) {
                      <select [compareWith]="shapeComparer" [disabled]="syncDisabled"
                              [(ngModel)]="displayedWalk.walk.groupEvent.shape"
                              (ngModelChange)="walkTypeChange()"
                              class="form-control input-sm" id="walkType">
                        @for (shape of display.walkTypes; track shape) {
                          <option [ngValue]="shape.toLowerCase()">{{ shape }}</option>
                        }
                      </select>
                    }
                  </div>
                </div>
                <div class="col-sm-4">
                  <div class="form-group">
                    <label for="ascent">Ascent</label>
                    <div app-event-ascent-edit [groupEvent]="displayedWalk?.walk?.groupEvent"
                         id="ascent" [disabled]="syncDisabled">
                    </div>
                  </div>
                </div>
              </div>
            </div>
            @if (renderMapEdit && !syncDisabled) {
              @if (enumValueForKey(WalkType, displayedWalk?.walk?.groupEvent?.shape) === WalkType.LINEAR) {
                <div class="col-sm-6 mb-4">
                  <app-walk-location-edit [locationType]="LocationType.STARTING"
                                          [locationDetails]="displayedWalk?.walk?.groupEvent.start_location"
                                          [disabled]="syncDisabled"
                                          [showLocationOnly]="true"
                                          [notify]="notify"
                                          (locationDetailsChange)="onLocationDetailsChange(LocationType.STARTING, $event)"
                                          (placeChosen)="onStartPlaceChosen($event)"/>
                </div>
                <div class="col-sm-6 mb-4">
                  <app-walk-location-edit [locationType]="LocationType.FINISHING"
                                          [locationDetails]="displayedWalk?.walk?.groupEvent.end_location"
                                          [disabled]="syncDisabled"
                                          [showLocationOnly]="true"
                                          [notify]="notify"
                                          (locationDetailsChange)="onLocationDetailsChange(LocationType.FINISHING, $event)"/>
                </div>
              } @else {
                <div class="col-sm-12 mb-4">
                  <app-walk-location-edit [locationType]="LocationType.STARTING"
                                          [locationDetails]="displayedWalk?.walk?.groupEvent.start_location"
                                          [disabled]="syncDisabled"
                                          [showLocationOnly]="true"
                                          [notify]="notify"
                                          (locationDetailsChange)="onLocationDetailsChange(LocationType.STARTING, $event)"
                                          (placeChosen)="onStartPlaceChosen($event)"/>
                </div>
              }
            }
            <div class="col-sm-12">
              <div class="form-group">
                <label for="gpx-route">GPX Route (Optional)</label>
                <div class="d-flex flex-wrap gap-2 align-items-start">
                  <ng-select
                    id="gpx-route"
                    [items]="gpxFiles"
                    [disabled]="inputDisabled"
                    [loading]="gpxFilesLoading"
                    [(ngModel)]="selectedGpxFile"
                    (ngModelChange)="onGpxFileChange()"
                    (open)="onDropdownOpen()"
                    [clearable]="true"
                    dropdownPosition="bottom"
                    placeholder="Select existing GPX file..."
                    class="flex-grow-1">
                    <ng-template ng-option-tmp let-item="item">
                      <div>
                        <strong>{{ getDropdownTitle(item) }}</strong>
                        @if (gpxOptionDetail(item)) {
                          <div class="text-muted small">{{gpxOptionDetail(item)}}</div>
                        }
                      </div>
                    </ng-template>
                    <ng-template ng-label-tmp let-item="item">
                      <div>
                        <strong>{{ getDropdownTitle(item) }}</strong>
                        @if (gpxOptionDetail(item)) {
                          <span class="text-muted small"> {{gpxOptionDetail(item)}}</span>
                        }
                      </div>
                    </ng-template>
                  </ng-select>
                  <input
                    type="file"
                    #fileInput
                    [disabled]="inputDisabled"
                    accept=".gpx"
                    style="display: none"
                    (change)="onFileSelected($event)">
                  <button
                    type="button"
                    class="btn btn-primary"
                    [disabled]="inputDisabled || uploadInProgress"
                    (click)="fileInput.click()">
                    @if (uploadInProgress) {
                      <span class="spinner-border spinner-border-sm me-2"></span>
                    } @else {
                      <fa-icon class="me-2" [icon]="faCloudArrowUp"/>
                    }
                    Upload New GPX
                  </button>
                  <button
                    type="button"
                    class="btn btn-quiet"
                    [disabled]="inputDisabled"
                    (click)="openFollowEditor()">
                    <fa-icon class="me-2" [icon]="faPencil"/>Record or edit
                  </button>
                  @if (displayedWalk?.walk?.fields?.gpxFile?.awsFileName) {
                    <button
                      type="button"
                      class="btn btn-quiet"
                      [disabled]="inputDisabled || gpxProposalsLoading"
                      (click)="proposeFromSelectedGpx()">
                      <fa-icon class="me-2" [icon]="faWandMagicSparkles"/>Fill details from route
                    </button>
                  }
                </div>
                @if (uploadError) {
                  <small class="text-danger">{{ uploadError }}</small>
                }
                <app-gpx-proposals id="walk" [proposals]="gpxProposals" [loading]="gpxProposalsLoading" (applied)="applyGpxProposals()" (dismissed)="gpxProposals = []"/>
              </div>
            </div>
            @if (renderMapEdit) {
              @if (enumValueForKey(WalkType, displayedWalk?.walk?.groupEvent?.shape) === WalkType.LINEAR) {
                <div class="row mb-3">
                  <div class="col d-flex justify-content-center gap-2">
                    <div class="btn-group" role="group">
                      <button type="button" class="btn btn-primary" [class.active]="!showCombinedMap"
                              (click)="showCombinedMap = false">
                        <fa-icon class="me-2" [icon]="faTableColumns"/>Separate Maps
                      </button>
                      <button type="button" class="btn btn-primary" [class.active]="showCombinedMap"
                              (click)="showCombinedMap = true">
                        <fa-icon class="me-2" [icon]="faMap"/>Combined Map
                      </button>
                    </div>
                    @if (!syncDisabled) {
                      <button type="button" class="btn btn-secondary"
                              (click)="swapStartAndEndLocations()">
                        <fa-icon class="me-2" [icon]="faRightLeft"/>Swap
                      </button>
                    }
                  </div>
                </div>
              }
              <div class="row">
                <div class="col">
                  <app-walk-location-edit [locationType]="LocationType.STARTING"
                                          [locationDetails]="displayedWalk?.walk?.groupEvent.start_location"
                                          [endLocationDetails]="showCombinedMap ? displayedWalk?.walk?.groupEvent.end_location : null"
                                          [showCombinedMap]="showCombinedMap"
                                          [hideLocationDropdown]="true"
                                          [gpxFile]="displayedWalk?.walk?.fields?.gpxFile"
                                          [routeColor]="displayedWalk?.walk?.fields?.routeColor"
                                          [routeWeight]="displayedWalk?.walk?.fields?.routeWeight"
                                          [routeOpacity]="displayedWalk?.walk?.fields?.routeOpacity"
                                          [disabled]="syncDisabled"
                                          [notify]="notify"/>
                </div>
                @if (enumValueForKey(WalkType, displayedWalk?.walk?.groupEvent?.shape) === WalkType.LINEAR) {
                  <div class="col">
                    <app-walk-location-edit [locationType]="LocationType.FINISHING"
                                            [locationDetails]="displayedWalk?.walk?.groupEvent?.end_location"
                                            [hideLocationDropdown]="true"
                                            [hideMap]="showCombinedMap"
                                            [gpxFile]="displayedWalk?.walk?.fields?.gpxFile"
                                            [routeColor]="displayedWalk?.walk?.fields?.routeColor"
                                            [routeWeight]="displayedWalk?.walk?.fields?.routeWeight"
                                            [routeOpacity]="displayedWalk?.walk?.fields?.routeOpacity"
                                            [disabled]="syncDisabled"
                                            [notify]="notify"/>
                  </div>
                }
              </div>
            }
            <div class="row mt-3">
              <div class="col-sm-12">
                <div class="form-check">
                  <input [(ngModel)]="hasSeparateMeetingPoint"
                         [disabled]="syncDisabled"
                         (ngModelChange)="onMeetingPointToggle($event)"
                         name="hasSeparateMeetingPoint" class="form-check-input" type="checkbox"
                         id="has-separate-meeting-point">
                  <label class="form-check-label" for="has-separate-meeting-point">
                    My walk has a separate meeting point or I want to specify a meeting time
                  </label>
                </div>
              </div>
            </div>
            @if (hasSeparateMeetingPoint) {
              <div class="row thumbnail-heading-frame mt-3">
                <div class="thumbnail-heading">Meeting Point</div>
                <div class="col-sm-12">
                  <div class="row align-items-center">
                    <div class="col-auto">
                      <div class="form-group mb-0" app-time-picker id="meeting-time" label="Meeting Time"
                           [disabled]="syncDisabled"
                           [value]="displayedWalk?.walk?.groupEvent?.meeting_date_time"
                           (timeChange)="onMeetingTimeChange($event)">
                      </div>
                      @if (meetingTimeValidationMessage) {
                        <div class="text-danger mt-1">{{ meetingTimeValidationMessage }}</div>
                      }
                    </div>
                    <div class="col pt-3">
                      <app-walk-location-edit [locationType]="LocationType.MEETING"
                                              [locationDetails]="displayedWalk?.walk?.groupEvent?.meeting_location"
                                              [disabled]="inputDisabled"
                                              [showLocationOnly]="true"
                                              [notify]="notify"
                                              (locationDetailsChange)="onLocationDetailsChange(LocationType.MEETING, $event)"/>
                    </div>
                  </div>
                </div>
                <div class="col-sm-12 mt-3">
                  <app-walk-location-edit [locationType]="LocationType.MEETING"
                                          [locationDetails]="displayedWalk?.walk?.groupEvent?.meeting_location"
                                          [disabled]="inputDisabled"
                                          [hideLocationDropdown]="true"
                                          [notify]="notify"/>
                </div>
              </div>
            }
          </div>
        }
        @if (selectedTab === DetailsTab.DIRECTIONS || selectedTab === DetailsTab.VENUE_ROUTE_AND_DIRECTIONS) {
          <div class="row thumbnail-heading-frame">
            <div class="thumbnail-heading">Directions</div>
            <div class="col-sm-12">
              <app-maximisable-map #directionsMap="maximisableMap" [title]="'Directions'" [allowExpanded]="false" [syncToUrl]="true"
                                   (sizeChange)="onDirectionsMapSizeChange($event)">
                <app-route-directions-editor #directionsEditor
                                             [framed]="false" [fullScreenAvailable]="true" [fullscreen]="directionsFullScreen"
                                             [saveLabel]="'the walk'"
                                             [missingTitle]="'No route yet'"
                                             [missingBody]="'Choose or upload a GPX file on the Route tab first, then come back here to generate the directions.'"
                                             [waypoints]="directionWaypoints" [points]="routePoints"
                                             [gpxFile]="displayedWalk?.walk?.fields?.gpxFile"
                                             [disabled]="inputDisabled" [listId]="turnListId" [markerColour]="turnMarkerColour"
                                             [panelHeight]="directionsHeight"
                                             (waypointsChange)="onDirectionWaypoints($event)"
                                             (fullScreen)="openDirectionsFullScreen()">
                  <div routeDirectionsMap class="map-section">
                    <div app-map-edit readonly
                         [style.height.px]="directionsFullScreen ? null : directionsHeight"
                         [locationDetails]="displayedWalk?.walk?.groupEvent?.start_location"
                         [locationType]="LocationType.STARTING"
                         [walkStatus]="displayedWalk?.walk?.groupEvent?.status"
                         [gpxFile]="displayedWalk?.walk?.fields?.gpxFile"
                         [routeColor]="displayedWalk?.walk?.fields?.routeColor"
                         [routeWeight]="displayedWalk?.walk?.fields?.routeWeight"
                         [routeOpacity]="displayedWalk?.walk?.fields?.routeOpacity"
                         [routeWaypoints]="directionsEditor.turnWaypoints"
                         [routeGuideEntries]="directionsEditor.entries"
                         [activeWaypointId]="directionsEditor.activeId"
                         [waypointsDraggable]="directionsEditor.editing"
                         (waypointMove)="directionsEditor.moveWaypoint($event)"
                         (waypointSelect)="directionsEditor.selectById($event.id)"
                         (routePointsChange)="routePoints = $event"
                         [notify]="notify"></div>
                  </div>
                </app-route-directions-editor>
              </app-maximisable-map>
            </div>
          </div>
        }
      </div>
    }
  `
})
export class WalkEditDetailsComponent implements OnInit, AfterViewInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditDetailsComponent", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private addressQueryService = inject(AddressQueryService);
  private venueService = inject(VenueService);
  private gpxProposalsService = inject(GpxProposalsService);
  private urlService = inject(UrlService);
  private httpClient = inject(HttpClient);
  public gpxProposals: WalkGpxFieldProposal[] = [];
  public gpxProposalsLoading = false;
  public routePoints: RouteFollowPoint[] = [];
  public readonly directionsHeight = 420;
  public directionsFullScreen = false;
  @ViewChild("directionsMap") directionsMap: MaximisableMapComponent;
  @ViewChild("directionsEditor") directionsEditor: RouteDirectionsEditor;
  private markerStyle = inject(MapMarkerStyleService);
  private mapTiles = inject(MapTilesService);
  protected readonly faWandMagicSparkles = faWandMagicSparkles;

  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }

  @Input() displayedWalk!: DisplayedWalk;
  public inputDisabled = false;
  protected readonly faCloudArrowUp = faCloudArrowUp;
  protected readonly faPencil = faPencil;
  protected readonly faTableColumns = faTableColumns;
  protected readonly faMap = faMap;
  protected readonly faRightLeft = faRightLeft;

  get syncDisabled(): boolean {
    return this.inputDisabled || this.display.walkPopulationWalksManager();
  }

  @Input() renderMapEdit = false;
  @Input() allowDetailView = false;
  @Input() notify!: AlertInstance;
  public showCombinedMap = false;
  public hasSeparateMeetingPoint = false;
  public meetingTimeValidationMessage: string | null = null;

  @ViewChildren(WalkLocationEditComponent) walkLocationEditComponents!: QueryList<WalkLocationEditComponent>;

  protected readonly StoredValue = StoredValue;
  protected readonly WalkType = WalkType;
  protected readonly DetailsTab = DetailsTab;
  protected readonly LocationType = LocationType;
  protected display = inject(WalkDisplayService);

  tabs: DetailsTab[] = [DetailsTab.VENUE, DetailsTab.ROUTE, DetailsTab.DIRECTIONS, DetailsTab.VENUE_ROUTE_AND_DIRECTIONS];
  selectedTab: DetailsTab = DetailsTab.VENUE;
  protected readonly enumValueForKey = enumValueForKey;


  private walkGpxService = inject(WalkGpxService);
  private router = inject(Router);
  public gpxFiles: GpxFileListItem[] = [];
  public selectedGpxFile: GpxFileListItem | null = null;
  public uploadInProgress = false;
  public uploadError: string | null = null;
  public gpxFilesLoaded = false;
  public gpxFilesLoading = false;
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    this.initialiseSelectedGpxFile();
    this.initializeMeetingPoint();
    this.subscriptions.push(this.broadcastService.on(NamedEventType.WALK_CHANGED, () => {
      this.initialiseSelectedGpxFile();
    }));
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private initializeMeetingPoint() {
    const meetingLocation = this.displayedWalk?.walk?.groupEvent?.meeting_location;
    const meetingDateTime = this.displayedWalk?.walk?.groupEvent?.meeting_date_time;
    this.hasSeparateMeetingPoint = !!(meetingLocation?.postcode || meetingDateTime);
  }

  onMeetingPointToggle(enabled: boolean) {
    if (enabled) {
      if (!this.displayedWalk.walk.groupEvent.meeting_location) {
        this.displayedWalk.walk.groupEvent.meeting_location = cloneDeep(INITIALISED_LOCATION);
      }
      if (!this.displayedWalk.walk.groupEvent.meeting_date_time) {
        this.setDefaultMeetingTime();
      }
    } else {
      this.displayedWalk.walk.groupEvent.meeting_location = null;
      this.displayedWalk.walk.groupEvent.meeting_date_time = null;
      this.meetingTimeValidationMessage = null;
    }
  }

  private setDefaultMeetingTime() {
    const startTime = this.displayedWalk?.walk?.groupEvent?.start_date_time;
    if (startTime) {
      const startDateTime = this.dateUtils.asDateTime(startTime);
      const meetingDateTime = startDateTime.minus({minutes: 15});
      this.displayedWalk.walk.groupEvent.meeting_date_time = meetingDateTime.toISO();
      this.logger.info("setDefaultMeetingTime: set to 15 minutes before start:", this.displayedWalk.walk.groupEvent.meeting_date_time);
    }
  }

  onMeetingTimeChange(meetingTime: string) {
    if (isString(meetingTime)) {
      this.displayedWalk.walk.groupEvent.meeting_date_time = meetingTime;
      this.validateMeetingTime();
      this.logger.info("onMeetingTimeChange:updated meeting_date_time to:", meetingTime);
    }
  }

  private validateMeetingTime() {
    const meetingTime = this.displayedWalk?.walk?.groupEvent?.meeting_date_time;
    const startTime = this.displayedWalk?.walk?.groupEvent?.start_date_time;

    if (!meetingTime || !startTime) {
      this.meetingTimeValidationMessage = null;
      return;
    }

    const meetingDateTime = this.dateUtils.asDateTime(meetingTime);
    const startDateTime = this.dateUtils.asDateTime(startTime);

    if (meetingDateTime >= startDateTime) {
      this.meetingTimeValidationMessage = "Meeting time must be before start time";
    } else {
      this.meetingTimeValidationMessage = null;
    }
  }

  async onUseVenueAsMeetingPoint(postcode: string) {
    this.logger.info("onUseVenueAsMeetingPoint: applying venue postcode to meeting point:", postcode);

    if (!this.hasSeparateMeetingPoint) {
      this.hasSeparateMeetingPoint = true;
      this.onMeetingPointToggle(true);
    }

    const meetingLocation = this.displayedWalk.walk.groupEvent.meeting_location;
    meetingLocation.postcode = postcode?.toUpperCase()?.trim();
    meetingLocation.latitude = null;
    meetingLocation.longitude = null;
    meetingLocation.grid_reference_6 = null;
    meetingLocation.grid_reference_8 = null;
    meetingLocation.grid_reference_10 = null;

    if (postcode?.length >= 5) {
      const gridReferenceLookupResponse = await this.addressQueryService.gridReferenceLookup(postcode);

      if (gridReferenceLookupResponse?.error) {
        this.notify?.warning({
          title: "Invalid postcode",
          message: gridReferenceLookupResponse.error
        });
      } else if (gridReferenceLookupResponse?.latlng) {
        meetingLocation.grid_reference_6 = gridReferenceLookupResponse.gridReference6;
        meetingLocation.grid_reference_8 = gridReferenceLookupResponse.gridReference8;
        meetingLocation.grid_reference_10 = gridReferenceLookupResponse.gridReference10;
        meetingLocation.latitude = gridReferenceLookupResponse.latlng.lat;
        meetingLocation.longitude = gridReferenceLookupResponse.latlng.lng;
        this.notify?.success({
          title: "Meeting point updated",
          message: `Meeting point set to ${postcode} with coordinates`
        });
      }
    }

    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_MEETING_LOCATION_CHANGED, postcode));
  }

  ngAfterViewInit() {
    if (this.renderMapEdit) {
      setTimeout(() => this.invalidateMaps(), 100);
    }
  }

  invalidateMaps() {
    this.walkLocationEditComponents?.forEach(component => {
      component.invalidateMapSize();
    });
  }

  onLocationDetailsChange(locationType: LocationType, details: LocationDetails) {
    if (locationType === LocationType.FINISHING || locationType === LocationType.END) {
      this.displayedWalk.walk.groupEvent.end_location = details;
    } else if (locationType === LocationType.MEETING) {
      this.displayedWalk.walk.groupEvent.meeting_location = details;
    } else {
      this.displayedWalk.walk.groupEvent.start_location = details;
      this.reloadGpxFilesForStartLocation();
    }
  }

  onStartPlaceChosen(place: VenueWithUsageStats) {
    this.venueService.ensureVenue(this.displayedWalk.walk);
    const venue = this.displayedWalk.walk.fields.venue;
    if (isEmpty(venue?.name) && place) {
      venue.name = place.name;
      venue.address1 = place.address1;
      venue.address2 = place.address2;
      venue.postcode = place.postcode;
      venue.url = place.url;
      venue.lat = place.lat;
      venue.lon = place.lon;
      venue.type = place.type;
      venue.storedVenueId = place.storedVenueId;
      venue.venuePublish = true;
      this.notify?.success({
        title: "Venue set from the start",
        message: `${place.name || place.postcode} is now the venue as well as the walk start`
      });
    }
  }

  private initialiseSelectedGpxFile() {
    const currentGpx = this.displayedWalk?.walk?.fields?.gpxFile;
    if (currentGpx?.awsFileName) {
      const displayItem: GpxFileListItem = {
        fileData: currentGpx,
        startLat: currentGpx.startLat || 0,
        startLng: currentGpx.startLng || 0,
        name: currentGpx.originalFileName || currentGpx.awsFileName
      };
      this.gpxFiles = [displayItem];
      this.selectedGpxFile = displayItem;
    }
  }

  onDropdownOpen() {
    if (!this.gpxFilesLoaded && !this.gpxFilesLoading) {
      this.loadGpxFiles();
    }
  }

  private loadGpxFiles() {
    const walkStart = this.displayedWalk?.walk?.groupEvent?.start_location;
    if (!walkStart?.latitude || !walkStart?.longitude) {
      return;
    }

    this.gpxFilesLoading = true;
    this.walkGpxService.listGpxFiles().subscribe({
      next: (files: GpxFileListItem[]) => {
        this.logger.info("GpxFileList", files);
        this.gpxFiles = this.walkGpxService.calculateProximity(
          walkStart.latitude,
          walkStart.longitude,
          files
        );
        this.gpxFilesLoaded = true;
        this.gpxFilesLoading = false;
        this.initializeSelectedGpxFile();
      },
      error: (error) => {
        this.gpxFilesLoading = false;
        this.notify.error({ title: "Error loading GPX files", message: error });
      }
    });
  }

  private   initializeSelectedGpxFile() {
    const currentGpx = this.displayedWalk?.walk?.fields?.gpxFile;
    if (currentGpx?.awsFileName) {
      this.selectedGpxFile = this.gpxFiles.find(
        file => file.fileData.awsFileName === currentGpx.awsFileName
      ) || null;
    }
  }

  onGpxFileChange() {
    if (this.selectedGpxFile) {
      if (!this.displayedWalk.walk.fields) {
        this.displayedWalk.walk.fields = {} as any;
      }
      this.displayedWalk.walk.fields.gpxFile = this.selectedGpxFile.fileData;
    } else if (this.displayedWalk.walk.fields) {
      this.clearRoute();
    }
    this.displayedWalk.walk.fields = { ...this.displayedWalk.walk.fields };
  }

  private clearRoute(): void {
    const fields = this.displayedWalk.walk.fields;
    fields.gpxFile = null;
    fields.routeWaypoints = [];
    fields.routeColor = null;
    fields.routeWeight = null;
    fields.routeOpacity = null;
    this.routePoints = [];
    this.gpxProposals = [];
  }

  openFollowEditor(): void {
    const slug = this.display.walkSlug(this.displayedWalk?.walk);
    if (slug) {
      this.display.rememberFollowReturnUrl();
      void this.router.navigate(["/" + AppPath.ROOT + "/" + AppPath.ROUTE], {
        queryParams: {[StoredValue.WALK_ID]: slug}
      });
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (!file.name.toLowerCase().endsWith(".gpx")) {
      this.uploadError = "Please select a GPX file";
      return;
    }

    this.uploadInProgress = true;
    this.uploadError = null;

    const gpxContent = file.text();
    this.walkGpxService.uploadGpxFile(file).subscribe({
      next: (response) => {
        if (!this.displayedWalk.walk.fields) {
          this.displayedWalk.walk.fields = {} as any;
        }
        this.displayedWalk.walk.fields.gpxFile = response.gpxFile;
        this.displayedWalk.walk.fields = { ...this.displayedWalk.walk.fields };
        this.uploadInProgress = false;
        this.notify.success({
          title: "GPX Uploaded",
          message: `File ${file.name} uploaded successfully`
        });
        this.loadGpxFiles();
        gpxContent.then(content => this.proposeFromGpxContent(content));
      },
      error: (error) => {
        this.uploadInProgress = false;
        this.uploadError = error.error?.message || "Upload failed";
        this.notify.error({ title: "Upload Failed", message: this.uploadError });
      }
    });

    input.value = "";
  }

  async proposeFromSelectedGpx(): Promise<void> {
    const gpxFile: FileNameData = this.displayedWalk?.walk?.fields?.gpxFile;
    if (gpxFile?.awsFileName) {
      this.gpxProposalsLoading = true;
      try {
        await this.proposeFromGpxContent(await this.gpxProposalsService.gpxContent({rootFolder: RootFolder.gpxRoutes, awsFileName: gpxFile.awsFileName}));
      } catch (error) {
        this.gpxProposalsLoading = false;
        this.notify.error({title: "Could not read the GPX file", message: error?.message || error});
      }
    }
  }

  private async proposeFromGpxContent(content: string): Promise<void> {
    this.gpxProposalsLoading = true;
    this.gpxProposals = [];
    try {
      const derived = await this.gpxProposalsService.derive(content);
      this.pendingGpxValues = derived;
      if (!derived) {
        this.notify.warning({title: "No route found", message: "The GPX file does not contain a track to read details from"});
      } else {
        this.gpxProposals = this.gpxProposalsService.proposals(derived, this.displayedWalk.walk.groupEvent, values(WalkGpxField));
        if (this.gpxProposals.length === 0) {
          this.notify.success({title: "Route checked", message: "The walk details already match the GPX file"});
        }
      }
    } catch (error) {
      this.logger.error("proposeFromGpxContent failed", error);
      this.notify.error({title: "Could not read the GPX file", message: error?.message || error});
    } finally {
      this.gpxProposalsLoading = false;
    }
  }

  private pendingGpxValues: GpxDerivedValues | null = null;

  applyGpxProposals(): void {
    const groupEvent = this.displayedWalk.walk.groupEvent;
    const applied = this.pendingGpxValues ? this.gpxProposalsService.apply(this.gpxProposals, this.pendingGpxValues, groupEvent) : [];
    if (applied.some(item => item.field === WalkGpxField.SHAPE)) {
      this.walkTypeChange();
    }
    if (applied.some(item => item.field === WalkGpxField.START_LOCATION)) {
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_MEETING_LOCATION_CHANGED, groupEvent.start_location?.postcode));
    }
    this.gpxProposals = [];
    this.notify.success({title: "Route details applied", message: applied.length > 0 ? `${this.stringUtils.pluraliseWithCount(applied.length, "detail")} taken from the GPX file` : "Nothing was changed"});
  }

  get turnListId(): string {
    return `walk-turns-${this.displayedWalk?.walk?.id || "new"}`;
  }

  get turnMarkerColour(): string {
    return this.markerStyle.numberedMarkerColour(this.mapTiles.hasOsApiKey() ? MapProvider.OS : MapProvider.OSM);
  }

  get directionWaypoints(): RouteFollowWaypoint[] {
    const fields = this.displayedWalk?.walk?.fields;
    if (fields && !fields.routeWaypoints) {
      fields.routeWaypoints = [];
    }
    return fields?.routeWaypoints || [];
  }

  onDirectionWaypoints(waypoints: RouteFollowWaypoint[]): void {
    this.displayedWalk.walk.fields.routeWaypoints = waypoints;
  }

  openDirectionsFullScreen(): void {
    if (!this.directionsFullScreen) {
      this.directionsMap?.cycle();
    }
    if (this.directionsEditor && this.directionsEditor.activeIndex < 0) {
      this.directionsEditor.first();
    }
  }

  onDirectionsMapSizeChange(state: MaximisableMapState): void {
    this.directionsFullScreen = state.fullScreen;
    if (state.fullScreen && this.directionsEditor && this.directionsEditor.activeIndex < 0) {
      this.directionsEditor.first();
    }
  }

  walkTypeChange() {
    if (enumValueForKey(WalkType, this.displayedWalk?.walk?.groupEvent?.shape) === WalkType.LINEAR && !this.displayedWalk?.walk?.groupEvent.end_location) {
      this.displayedWalk.walk.groupEvent.end_location = cloneDeep(INITIALISED_LOCATION);
    }
  }

  swapStartAndEndLocations() {
    const startLocation = cloneDeep(this.displayedWalk?.walk?.groupEvent.start_location);
    this.displayedWalk.walk.groupEvent.start_location = this.displayedWalk?.walk?.groupEvent.end_location;
    this.displayedWalk.walk.groupEvent.end_location = startLocation;
  }

  shapeComparer(item1: string, item2: string): boolean {
    return item1?.toLowerCase() === item2?.toLowerCase();
  }

  gpxOptionDetail(item: GpxFileListItem): string {
    const parts = [
      item.walkTitle,
      item.walkDate ? this.dateUtils.displayDate(item.walkDate) : "",
      item.distance !== undefined && item.distance !== null ? `${item.distance.toFixed(1)} miles from walk start` : ""
    ].filter(Boolean);
    return parts.join(" - ");
  }

  getDropdownTitle(item: GpxFileListItem): string {
    const isUuid = item.name && item.name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
    if (item.fileData?.title) {
      return this.transformFilename(item.fileData.title);
    } else if (isUuid && item.uploadDate) {
      return `Uploaded ${this.dateUtils.displayDate(item.uploadDate)}`;
    } else if (item.fileData?.originalFileName) {
      return this.transformFilename(item.fileData.originalFileName);
    } else {
      return "GPX Route";
    }
  }

  private transformFilename(filename: string): string {
    const decoded = this.decodeHtmlEntities(filename);
    const withoutExtension = decoded.replace(/\.gpx$/i, "");
    const withSpaces = withoutExtension
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_,&]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return this.stringUtils.asTitle(withSpaces);
  }

  private decodeHtmlEntities(text: string): string {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  }

  async onVenuePostcodeChange(postcode: string) {
    this.logger.info("onVenuePostcodeChange: applying venue postcode to starting point:", postcode);
    const venue = this.displayedWalk?.walk?.fields?.venue;
    const venueName = venue?.name?.trim() || "";
    const trimmedPostcode = postcode?.toUpperCase()?.trim();
    const hasVenueCoords = isNumber(venue?.lat) && isNumber(venue?.lon);
    if (!this.displayedWalk.walk.groupEvent.start_location) {
      this.displayedWalk.walk.groupEvent.start_location = {
        latitude: hasVenueCoords ? venue.lat : null,
        longitude: hasVenueCoords ? venue.lon : null,
        grid_reference_6: null,
        grid_reference_8: null,
        grid_reference_10: null,
        postcode: trimmedPostcode,
        description: venueName || null,
        w3w: null
      };
    } else {
      const startLocation = this.displayedWalk.walk.groupEvent.start_location;
      startLocation.postcode = trimmedPostcode;
      startLocation.grid_reference_6 = null;
      startLocation.grid_reference_8 = null;
      startLocation.grid_reference_10 = null;
      startLocation.description = venueName || startLocation.description;
      startLocation.latitude = hasVenueCoords ? venue.lat : null;
      startLocation.longitude = hasVenueCoords ? venue.lon : null;
    }

    const location = this.displayedWalk.walk.groupEvent.start_location;
    if (trimmedPostcode?.length >= 5) {
      const gridReferenceLookupResponse = hasVenueCoords
        ? (await this.addressQueryService.gridReferenceLookupFromLatLng(new LatLng(venue.lat, venue.lon)))?.[0]
        : await this.addressQueryService.gridReferenceLookup(trimmedPostcode);

      if (gridReferenceLookupResponse?.error) {
        this.notify?.warning({
          title: "Invalid postcode",
          message: gridReferenceLookupResponse.error
        });
      } else if (gridReferenceLookupResponse?.latlng || hasVenueCoords) {
        location.grid_reference_6 = gridReferenceLookupResponse?.gridReference6 || location.grid_reference_6;
        location.grid_reference_8 = gridReferenceLookupResponse?.gridReference8 || location.grid_reference_8;
        location.grid_reference_10 = gridReferenceLookupResponse?.gridReference10 || location.grid_reference_10;
        if (gridReferenceLookupResponse?.latlng && !hasVenueCoords) {
          location.latitude = gridReferenceLookupResponse.latlng.lat;
          location.longitude = gridReferenceLookupResponse.latlng.lng;
        }
        location.description = venueName || gridReferenceLookupResponse?.description || location.description;
        this.displayedWalk.walk.groupEvent.start_location = cloneDeep(location);
        this.reloadGpxFilesForStartLocation();
        this.notify?.success({
          title: "Walk start set from the venue",
          message: `Starting location set to ${location.description || trimmedPostcode} (${trimmedPostcode})`
        });
      } else {
        this.notify?.warning({
          title: "Postcode not found",
          message: `No location data found for postcode "${trimmedPostcode}"`
        });
      }
    } else {
      this.notify?.success({
        title: "Walk start set from the venue",
        message: `Starting location postcode set to ${trimmedPostcode}`
      });
    }

    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_START_LOCATION_CHANGED, trimmedPostcode));
  }

  private reloadGpxFilesForStartLocation(): void {
    this.gpxFilesLoaded = false;
    this.loadGpxFiles();
  }
}
