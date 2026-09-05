import { AfterViewInit, Component, inject, Input, OnDestroy, OnInit, QueryList, ViewChildren } from "@angular/core";
import { Subscription } from "rxjs";
import { Router } from "@angular/router";
import { DetailsTab, DisplayedWalk, FEET_PER_METRE, GPX_CIRCULAR_ENDS_METRES, GpxFileListItem, INITIALISED_LOCATION, KM_PER_MILE, WalkGpxField, WalkGpxFieldProposal, WalkType } from "../../../models/walk.model";
import { FormsModule } from "@angular/forms";
import { WalkLocationEditComponent } from "./walk-location-edit";
import { EventAscentEdit } from "./event-ascent-edit.component";
import { Difficulty, LocationDetails } from "../../../models/ramblers-walks-manager";
import { WalkDisplayService } from "../walk-display.service";
import { AlertInstance } from "../../../services/notifier.service";
import { cloneDeep, isString } from "es-toolkit/compat";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { enumValueForKey } from "../../../functions/enums";
import { DatePipe, DecimalPipe, JsonPipe } from "@angular/common";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { WalkGpxService } from "../../../services/walks/walk-gpx.service";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Venue } from "../walk-venue/venue";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { TimePicker } from "../../../date-and-time/time-picker";
import { LocationType } from "../../../models/map.model";
import { StoredValue } from "../../../models/ui-actions";
import { AppPath, RouteFollowQueryParam, RouteFollowWaypoint, RouteTurnStepKind, RouteWaypointKind } from "../../../models/route-follow.model";
import { GpxParserService, GpxTrack, GpxTrackPoint } from "../../../services/maps/gpx-parser.service";
import { RouteTurnsService } from "../../../services/maps/route-turns.service";
import { UrlService } from "../../../services/url.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { LatLng } from "leaflet";
import { FileNameData } from "../../../models/aws-object.model";
import { GridReferenceLookupResponse } from "../../../models/address-model";
import { sortBy } from "../../../functions/arrays";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faCloudArrowUp, faDiamondTurnRight, faMap, faPencil, faRightLeft, faTableColumns, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-walk-edit-details",
  imports: [
    FormsModule,
    WalkLocationEditComponent,
    EventAscentEdit,
    JsonPipe,
    DatePipe,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    DecimalPipe,
    Venue,
    SectionToggle,
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
        @if (selectedTab === DetailsTab.ROUTE || selectedTab === DetailsTab.ROUTE_AND_VENUE) {
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
                      <select [compareWith]="difficultyComparer" [disabled]="syncDisabled"
                              [(ngModel)]="displayedWalk.walk.groupEvent.difficulty"
                              class="form-control input-sm" id="grade">
                        @for (difficulty of difficulties; track difficulty.code) {
                          <option
                            [ngValue]="difficulty">{{ difficulty.description }}
                          </option>
                        }
                      </select>
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
                    placeholder="Select existing GPX file..."
                    class="flex-grow-1">
                    <ng-template ng-option-tmp let-item="item">
                      <div>
                        <strong>{{ getDropdownTitle(item) }}</strong>
                        <div class="text-muted small">
                          {{ item.walkTitle || '' }}{{ item.walkTitle && (item.walkDate || item.distance !== undefined) ? EM_DASH_WITH_SPACES : '' }}{{ item.walkDate ? (item.walkDate | date:"mediumDate") : '' }}{{ item.walkDate && item.distance !== undefined ? EM_DASH_WITH_SPACES : '' }}{{ item.distance !== undefined ? (item.distance | number:"1.1-1") + ' miles from walk start' : '' }}
                        </div>
                      </div>
                    </ng-template>
                    <ng-template ng-label-tmp let-item="item">
                      <span>{{ item.displayLabel }}</span>
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
                    <button
                      type="button"
                      class="btn btn-quiet"
                      [disabled]="inputDisabled || turnsGenerating"
                      (click)="generateTurns()">
                      @if (turnsGenerating) {
                        <span class="spinner-border spinner-border-sm me-2"></span>
                      } @else {
                        <fa-icon class="me-2" [icon]="faDiamondTurnRight"/>
                      }
                      Generate turns
                    </button>
                  }
                </div>
                @if (uploadError) {
                  <small class="text-danger">{{ uploadError }}</small>
                }
                @if (gpxProposalsLoading) {
                  <small class="text-muted d-block mt-2"><span class="spinner-border spinner-border-sm me-2"></span>Reading the route and looking up its start and finish…</small>
                }
                @if (gpxProposals.length > 0) {
                  <div class="alert alert-warning d-flex align-items-start mt-2">
                    <fa-icon [icon]="faCircleExclamation" class="flex-shrink-0 mt-1"/>
                    <div class="ms-2 flex-grow-1 min-w-0">
                      <strong class="d-block">Details found in the route</strong>
                      <span class="d-block mb-2">Tick the details you want to take from the GPX file. Those that would replace something already entered are unticked.</span>
                      @for (proposal of gpxProposals; track proposal.field) {
                        <div class="form-check">
                          <input class="form-check-input" type="checkbox" [id]="'gpx-proposal-' + proposal.field"
                                 [(ngModel)]="proposal.apply">
                          <label class="form-check-label" [for]="'gpx-proposal-' + proposal.field">
                            <strong>{{ proposal.label }}:</strong> {{ proposal.proposedValue }}
                            @if (proposal.currentValue) {
                              <span class="text-muted">(currently {{ proposal.currentValue }})</span>
                            }
                          </label>
                        </div>
                      }
                      <div class="d-flex gap-2 mt-2">
                        <button type="button" class="btn btn-primary btn-sm" (click)="applyGpxProposals()">
                          <fa-icon class="me-2" [icon]="faWandMagicSparkles"/>Apply ticked details
                        </button>
                        <button type="button" class="btn btn-quiet btn-sm" (click)="gpxProposals = []">Not now</button>
                      </div>
                    </div>
                  </div>
                }
                @if (turnsMessage) {
                  <small class="text-muted d-block mt-2">{{ turnsMessage }}</small>
                }
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
                    <button type="button" class="btn btn-secondary"
                            [disabled]="syncDisabled"
                            (click)="swapStartAndEndLocations()">
                      <fa-icon class="me-2" [icon]="faRightLeft"/>Swap
                    </button>
                  </div>
                </div>
              }
              <div class="row">
                <div class="col">
                  <app-walk-location-edit [locationType]="LocationType.STARTING"
                                          [locationDetails]="displayedWalk?.walk?.groupEvent.start_location"
                                          [endLocationDetails]="showCombinedMap ? displayedWalk?.walk?.groupEvent.end_location : null"
                                          [showCombinedMap]="showCombinedMap"
                                          [gpxFile]="displayedWalk?.walk?.fields?.gpxFile"
                                          [routeColor]="displayedWalk?.walk?.fields?.routeColor"
                                          [routeWeight]="displayedWalk?.walk?.fields?.routeWeight"
                                          [routeOpacity]="displayedWalk?.walk?.fields?.routeOpacity"
                                          [disabled]="syncDisabled"
                                          [notify]="notify"/>
                </div>
                @if (enumValueForKey(WalkType, displayedWalk?.walk?.groupEvent?.shape) === WalkType.LINEAR && !showCombinedMap) {
                  <div class="col">
                    <app-walk-location-edit [locationType]="LocationType.FINISHING"
                                            [locationDetails]="displayedWalk?.walk?.groupEvent?.end_location"
                                            [gpxFile]="displayedWalk?.walk?.fields?.gpxFile"
                                            [routeColor]="displayedWalk?.walk?.fields?.routeColor"
                                            [routeWeight]="displayedWalk?.walk?.fields?.routeWeight"
                                            [routeOpacity]="displayedWalk?.walk?.fields?.routeOpacity"
                                            [disabled]="inputDisabled"
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
                                              [notify]="notify"/>
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
        @if ((selectedTab === DetailsTab.VENUE || selectedTab === DetailsTab.ROUTE_AND_VENUE) && displayedWalk?.walk?.fields?.venue) {
          <app-venue [event]="displayedWalk.walk" [inputDisabled]="inputDisabled"
                     [hasSeparateMeetingPoint]="hasSeparateMeetingPoint"
                     (venuePostcodeChange)="onVenuePostcodeChange($event)"
                     (useVenueAsMeetingPoint)="onUseVenueAsMeetingPoint($event)"/>
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
  private gpxParser = inject(GpxParserService);
  private routeTurns = inject(RouteTurnsService);
  private urlService = inject(UrlService);
  private numberUtils = inject(NumberUtilsService);
  private httpClient = inject(HttpClient);
  public gpxProposals: WalkGpxFieldProposal[] = [];
  public gpxProposalsLoading = false;
  public turnsGenerating = false;
  public turnsMessage: string | null = null;
  protected readonly faWandMagicSparkles = faWandMagicSparkles;
  protected readonly faDiamondTurnRight = faDiamondTurnRight;
  protected readonly faCircleExclamation = faCircleExclamation;

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
  difficulties = this.display.difficulties();
  tabs: DetailsTab[] = [DetailsTab.VENUE, DetailsTab.ROUTE, DetailsTab.ROUTE_AND_VENUE];
  selectedTab: DetailsTab = DetailsTab.ROUTE;
  protected readonly enumValueForKey = enumValueForKey;
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;

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
    this.initializeDisplayLabel();
    this.initializeMeetingPoint();
    this.subscriptions.push(this.broadcastService.on(NamedEventType.WALK_CHANGED, () => {
      this.initializeDisplayLabel();
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

  private initializeDisplayLabel() {
    const currentGpx = this.displayedWalk?.walk?.fields?.gpxFile;
    if (currentGpx?.awsFileName) {
      const displayItem: GpxFileListItem = {
        fileData: currentGpx,
        startLat: currentGpx.startLat || 0,
        startLng: currentGpx.startLng || 0,
        name: currentGpx.originalFileName || currentGpx.awsFileName,
        displayLabel: this.transformFilename(currentGpx.title || currentGpx.originalFileName || currentGpx.awsFileName)
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
    } else {
      if (this.displayedWalk.walk.fields) {
        this.displayedWalk.walk.fields.gpxFile = undefined;
      }
    }
    this.displayedWalk.walk.fields = { ...this.displayedWalk.walk.fields };
  }

  openFollowEditor(): void {
    const slug = this.display.walkSlug(this.displayedWalk?.walk);
    if (slug) {
      this.display.rememberFollowReturnUrl();
      void this.router.navigate(["/" + AppPath.ROOT + "/" + AppPath.FOLLOW], {
        queryParams: {[RouteFollowQueryParam.WALK_ID]: slug}
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
        const content = await firstValueFrom(this.httpClient.get(this.urlService.resourceRelativePathForAWSFileName(`gpx-routes/${gpxFile.awsFileName}`), {responseType: "text"}));
        await this.proposeFromGpxContent(content);
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
      const parsed = this.gpxParser.parseGpxFile(content);
      const track: GpxTrack = (parsed.tracks || []).reduce((longest, candidate) => (candidate.points?.length || 0) > (longest?.points?.length || 0) ? candidate : longest, null as GpxTrack | null);
      const points = track?.points || [];
      if (points.length < 2) {
        this.notify.warning({title: "No route found", message: "The GPX file does not contain a track to read details from"});
      } else {
        const groupEvent = this.displayedWalk.walk.groupEvent;
        const first = points[0];
        const last = points[points.length - 1];
        const circular = this.metresBetween(first, last) <= GPX_CIRCULAR_ENDS_METRES;
        const shape = circular ? WalkType.CIRCULAR : WalkType.LINEAR;
        const km = (track.totalDistance || 0) / 1000;
        const miles = km / KM_PER_MILE;
        const ascentMetres = Math.round(track.totalAscent || 0);
        const startLocation = await this.locationFor(first);
        const endLocation = circular ? null : await this.locationFor(last);
        const proposals: WalkGpxFieldProposal[] = [
          this.proposal(WalkGpxField.SHAPE, "Walk type", groupEvent.shape ? this.stringUtils.asTitle(groupEvent.shape) : "", shape),
          this.proposal(WalkGpxField.DISTANCE, "Distance", groupEvent.distance_miles ? `${groupEvent.distance_miles} miles` : "", `${miles.toFixed(1)} miles (${km.toFixed(1)} km)`),
          ascentMetres > 0 ? this.proposal(WalkGpxField.ASCENT, "Ascent", groupEvent.ascent_metres ? `${groupEvent.ascent_metres} m` : "", `${ascentMetres} m (${Math.round(ascentMetres * FEET_PER_METRE)} ft)`) : null,
          startLocation ? this.proposal(WalkGpxField.START_LOCATION, "Start", this.locationSummary(groupEvent.start_location), this.locationSummary(startLocation)) : null,
          endLocation ? this.proposal(WalkGpxField.END_LOCATION, "Finish", this.locationSummary(groupEvent.end_location), this.locationSummary(endLocation)) : null
        ].filter(item => !!item);
        this.pendingGpxValues = {shape, miles, km, ascentMetres, startLocation, endLocation};
        this.gpxProposals = proposals.filter(item => item.currentValue !== item.proposedValue);
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

  private pendingGpxValues: {shape: WalkType; miles: number; km: number; ascentMetres: number; startLocation: LocationDetails | null; endLocation: LocationDetails | null} | null = null;

  applyGpxProposals(): void {
    const groupEvent = this.displayedWalk.walk.groupEvent;
    const values = this.pendingGpxValues;
    const applied = this.gpxProposals.filter(item => item.apply);
    if (values) {
      applied.forEach(item => {
        if (item.field === WalkGpxField.SHAPE) {
          groupEvent.shape = values.shape.toLowerCase();
          this.walkTypeChange();
        } else if (item.field === WalkGpxField.DISTANCE) {
          groupEvent.distance_miles = Number(values.miles.toFixed(1));
          groupEvent.distance_km = Number(values.km.toFixed(1));
        } else if (item.field === WalkGpxField.ASCENT) {
          groupEvent.ascent_metres = values.ascentMetres;
          groupEvent.ascent_feet = Math.round(values.ascentMetres * FEET_PER_METRE);
        } else if (item.field === WalkGpxField.START_LOCATION && values.startLocation) {
          groupEvent.start_location = values.startLocation;
          this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_MEETING_LOCATION_CHANGED, values.startLocation.postcode));
        } else if (item.field === WalkGpxField.END_LOCATION && values.endLocation) {
          groupEvent.end_location = values.endLocation;
        }
      });
    }
    this.gpxProposals = [];
    this.notify.success({title: "Route details applied", message: applied.length > 0 ? `${this.stringUtils.pluraliseWithCount(applied.length, "detail")} taken from the GPX file` : "Nothing was changed"});
  }

  async generateTurns(): Promise<void> {
    const gpxFile: FileNameData = this.displayedWalk?.walk?.fields?.gpxFile;
    if (gpxFile?.awsFileName) {
      this.turnsGenerating = true;
      this.turnsMessage = "Reading the route and looking up the way names…";
      try {
        const response = await this.routeTurns.turnSteps({gpxFile: {awsFileName: gpxFile.awsFileName}});
        const kept = (this.displayedWalk.walk.fields.routeWaypoints || []).filter(waypoint => waypoint.kind !== RouteWaypointKind.TURN);
        const generated: RouteFollowWaypoint[] = response.steps.map((step, index) => ({
          id: this.numberUtils.generateUid(),
          latitude: step.latitude,
          longitude: step.longitude,
          label: String(index + 1),
          instruction: step.instruction,
          kind: RouteWaypointKind.TURN,
          ...(step.modifier ? {turn: step.modifier} : {})
        }));
        this.displayedWalk.walk.fields.routeWaypoints = [...kept, ...generated];
        const turns = response.steps.filter(step => step.kind === RouteTurnStepKind.TURN).length;
        this.turnsMessage = `Found ${this.stringUtils.pluraliseWithCount(turns, "turn")} on the route. Save the walk to keep them, then check them with Record or edit.`;
      } catch (error) {
        this.turnsMessage = `Could not generate turns: ${error?.error?.message || error?.message || "the server did not respond"}`;
      } finally {
        this.turnsGenerating = false;
      }
    }
  }

  private proposal(field: WalkGpxField, label: string, currentValue: string, proposedValue: string): WalkGpxFieldProposal {
    return {field, label, currentValue, proposedValue, apply: !currentValue};
  }

  private metresBetween(from: GpxTrackPoint, to: GpxTrackPoint): number {
    const earthRadius = 6371e3;
    const lat1 = from.latitude * Math.PI / 180;
    const lat2 = to.latitude * Math.PI / 180;
    const deltaLat = (to.latitude - from.latitude) * Math.PI / 180;
    const deltaLng = (to.longitude - from.longitude) * Math.PI / 180;
    const haversine = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  private async locationFor(point: GpxTrackPoint): Promise<LocationDetails | null> {
    try {
      const responses: GridReferenceLookupResponse[] = await this.addressQueryService.gridReferenceLookupFromLatLng(new LatLng(point.latitude, point.longitude));
      const closest = (responses || []).sort(sortBy("distance"))[0];
      return {
        ...cloneDeep(INITIALISED_LOCATION),
        latitude: point.latitude,
        longitude: point.longitude,
        postcode: closest?.postcode || "",
        description: closest?.description || "",
        grid_reference_6: closest?.gridReference6 || "",
        grid_reference_8: closest?.gridReference8 || "",
        grid_reference_10: closest?.gridReference10 || ""
      };
    } catch (error) {
      this.logger.warn("locationFor lookup failed", error);
      return {...cloneDeep(INITIALISED_LOCATION), latitude: point.latitude, longitude: point.longitude};
    }
  }

  private locationSummary(location: LocationDetails | null): string {
    return [location?.postcode, location?.grid_reference_8 || location?.grid_reference_6, location?.description].filter(Boolean).join(", ");
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

  difficultyComparer(item1: Difficulty, item2: Difficulty): boolean {
    return item1?.code === item2?.code;
  }

  shapeComparer(item1: string, item2: string): boolean {
    return item1?.toLowerCase() === item2?.toLowerCase();
  }

  getDropdownTitle(item: GpxFileListItem): string {
    const isUuid = item.name && item.name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);

    if (isUuid && item.uploadDate) {
      return `Uploaded ${this.dateUtils.displayDate(item.uploadDate)}`;
    }

    if (item.walkTitle) {
      return this.transformFilename(item.fileData.title || item.fileData.originalFileName);
    }

    if (item.fileData.originalFileName) {
      return this.transformFilename(item.fileData.originalFileName);
    }

    return "GPX Route";
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
    const startLocation = this.displayedWalk?.walk?.groupEvent?.start_location;
    if (!startLocation) {
      this.displayedWalk.walk.groupEvent.start_location = {
        latitude: null,
        longitude: null,
        grid_reference_6: null,
        grid_reference_8: null,
        grid_reference_10: null,
        postcode: postcode?.toUpperCase()?.trim(),
        description: null,
        w3w: null
      };
    } else {
      startLocation.postcode = postcode?.toUpperCase()?.trim();
      startLocation.latitude = null;
      startLocation.longitude = null;
      startLocation.grid_reference_6 = null;
      startLocation.grid_reference_8 = null;
      startLocation.grid_reference_10 = null;
    }

    if (postcode?.length >= 5) {
      const gridReferenceLookupResponse = await this.addressQueryService.gridReferenceLookup(postcode);
      const location = this.displayedWalk.walk.groupEvent.start_location;

      if (gridReferenceLookupResponse?.error) {
        this.notify?.warning({
          title: "Invalid postcode",
          message: gridReferenceLookupResponse.error
        });
      } else if (gridReferenceLookupResponse?.latlng) {
        location.grid_reference_6 = gridReferenceLookupResponse.gridReference6;
        location.grid_reference_8 = gridReferenceLookupResponse.gridReference8;
        location.grid_reference_10 = gridReferenceLookupResponse.gridReference10;
        location.latitude = gridReferenceLookupResponse.latlng.lat;
        location.longitude = gridReferenceLookupResponse.latlng.lng;
        this.notify?.success({
          title: "Starting point updated",
          message: `Starting point set to ${postcode} with coordinates`
        });
      } else {
        this.notify?.warning({
          title: "Postcode not found",
          message: `No location data found for postcode "${postcode}"`
        });
      }
    } else {
      this.notify?.success({
        title: "Starting point updated",
        message: `Starting point postcode set to ${postcode}`
      });
    }

    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_START_LOCATION_CHANGED, postcode));
  }
}
