import { AfterViewInit, Component, inject, Input, OnInit, QueryList, ViewChildren } from "@angular/core";
import { DetailsTab, DisplayedWalk, GpxFileListItem, INITIALISED_LOCATION, WalkType } from "../../../models/walk.model";
import { FormsModule } from "@angular/forms";
import { WalkLocationEditComponent } from "./walk-location-edit";
import { EventAscentEdit } from "./event-ascent-edit.component";
import { Difficulty } from "../../../models/ramblers-walks-manager";
import { WalkDisplayService } from "../walk-display.service";
import { AlertInstance } from "../../../services/notifier.service";
import { cloneDeep, isString } from "es-toolkit/compat";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { enumValueForKey, enumValues } from "../../../functions/enums";
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
    TimePicker
  ],
  template: `
    @if (displayedWalk?.walk?.groupEvent) {
      <div class="img-thumbnail thumbnail-admin-edit">
        <app-section-toggle
          [tabs]="tabs"
          [(selectedTab)]="selectedTab"
          [queryParamKey]="'sub-tab'"/>
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
                      <select [compareWith]="difficultyComparer" [disabled]="inputDisabled"
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
                      <select [disabled]="inputDisabled"
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
                         id="ascent" [disabled]="inputDisabled">
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-sm-12">
              <div class="form-group">
                <label for="gpx-route">GPX Route (Optional)</label>
                <div class="d-flex gap-2 align-items-start">
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
                    }
                    Upload New GPX
                  </button>
                </div>
                @if (uploadError) {
                  <small class="text-danger">{{ uploadError }}</small>
                }
              </div>
            </div>
            @if (renderMapEdit) {
              @if (enumValueForKey(WalkType, displayedWalk?.walk?.groupEvent?.shape) === WalkType.LINEAR) {
                <div class="row mb-3">
                  <div class="col d-flex justify-content-center gap-2">
                    <div class="btn-group" role="group">
                      <button type="button" class="btn btn-primary" [class.active]="!showCombinedMap"
                              [disabled]="inputDisabled"
                              (click)="showCombinedMap = false">
                        Separate Maps
                      </button>
                      <button type="button" class="btn btn-primary" [class.active]="showCombinedMap"
                              [disabled]="inputDisabled"
                              (click)="showCombinedMap = true">
                        Combined Map
                      </button>
                    </div>
                    <button type="button" class="btn btn-secondary"
                            [disabled]="inputDisabled"
                            (click)="swapStartAndEndLocations()">
                      Swap Start & End Locations
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
                                          [disabled]="inputDisabled"
                                          [notify]="notify"/>
                </div>
                @if (enumValueForKey(WalkType, displayedWalk?.walk?.groupEvent?.shape) === WalkType.LINEAR && !showCombinedMap) {
                  <div class="col">
                    <app-walk-location-edit [locationType]="LocationType.FINISHING"
                                            [locationDetails]="displayedWalk?.walk?.groupEvent?.end_location"
                                            [gpxFile]="displayedWalk?.walk?.fields?.gpxFile"
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
                         [disabled]="inputDisabled"
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
                           [disabled]="inputDisabled"
                           [value]="displayedWalk?.walk?.groupEvent?.meeting_date_time"
                           (change)="onMeetingTimeChange($event)">
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
          <app-venue [displayedWalk]="displayedWalk" [inputDisabled]="inputDisabled"
                     [hasSeparateMeetingPoint]="hasSeparateMeetingPoint"
                     (venuePostcodeChange)="onVenuePostcodeChange($event)"
                     (useVenueAsMeetingPoint)="onUseVenueAsMeetingPoint($event)"/>
        }
      </div>
    }
  `
})
export class WalkEditDetailsComponent implements OnInit, AfterViewInit {
  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditDetailsComponent", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private addressQueryService = inject(AddressQueryService);

  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }

  @Input() displayedWalk!: DisplayedWalk;
  public inputDisabled = false;
  @Input() renderMapEdit = false;
  @Input() allowDetailView = false;
  @Input() notify!: AlertInstance;
  public showCombinedMap = false;
  public hasSeparateMeetingPoint = false;
  public meetingTimeValidationMessage: string | null = null;

  @ViewChildren(WalkLocationEditComponent) walkLocationEditComponents!: QueryList<WalkLocationEditComponent>;

  protected readonly WalkType = WalkType;
  protected readonly DetailsTab = DetailsTab;
  protected readonly LocationType = LocationType;
  protected display = inject(WalkDisplayService);
  difficulties = this.display.difficulties();
  tabs: DetailsTab[] = enumValues(DetailsTab);
  selectedTab: DetailsTab = DetailsTab.ROUTE_AND_VENUE;
  protected readonly enumValueForKey = enumValueForKey;
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;

  private walkGpxService = inject(WalkGpxService);
  public gpxFiles: GpxFileListItem[] = [];
  public selectedGpxFile: GpxFileListItem | null = null;
  public uploadInProgress = false;
  public uploadError: string | null = null;
  public gpxFilesLoaded = false;
  public gpxFilesLoading = false;

  ngOnInit() {
    this.initializeDisplayLabel();
    this.initializeMeetingPoint();
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
      },
      error: (error) => {
        this.uploadInProgress = false;
        this.uploadError = error.error?.message || "Upload failed";
        this.notify.error({ title: "Upload Failed", message: this.uploadError });
      }
    });

    input.value = "";
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
