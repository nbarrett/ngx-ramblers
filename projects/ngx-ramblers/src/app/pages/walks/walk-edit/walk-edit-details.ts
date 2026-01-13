import { Component, inject, Input, OnInit, ViewChildren, QueryList, AfterViewInit } from "@angular/core";
import { DisplayedWalk, INITIALISED_LOCATION, WalkType } from "../../../models/walk.model";
import { FormsModule } from "@angular/forms";
import { WalkLocationEditComponent } from "./walk-location-edit";
import { EventAscentEdit } from "./event-ascent-edit.component";
import { Difficulty } from "../../../models/ramblers-walks-manager";
import { WalkDisplayService } from "../walk-display.service";
import { AlertInstance } from "../../../services/notifier.service";
import { cloneDeep } from "es-toolkit/compat";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { enumValueForKey } from "../../../functions/enums";
import { DatePipe, DecimalPipe, JsonPipe } from "@angular/common";
import { NgSelectComponent, NgOptionTemplateDirective, NgLabelTemplateDirective } from "@ng-select/ng-select";
import { WalkGpxService } from "../../../services/walks/walk-gpx.service";
import { GpxFileListItem } from "../../../models/walk.model";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";

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
    DecimalPipe
  ],
  template: `
    @if (displayedWalk?.walk?.groupEvent) {
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row">
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
                [(ngModel)]="selectedGpxFile"
                (ngModelChange)="onGpxFileChange()"
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
            <app-walk-location-edit locationType="Starting"
                                    [locationDetails]="displayedWalk?.walk?.groupEvent.start_location"
                                    [endLocationDetails]="showCombinedMap ? displayedWalk?.walk?.groupEvent.end_location : null"
                                    [showCombinedMap]="showCombinedMap"
                                    [gpxFile]="displayedWalk?.walk?.fields?.gpxFile"
                                    [disabled]="inputDisabled"
                                    [notify]="notify"/>
          </div>
          @if (enumValueForKey(WalkType, displayedWalk?.walk?.groupEvent?.shape) === WalkType.LINEAR && !showCombinedMap) {
            <div class="col">
              <app-walk-location-edit locationType="Finishing"
                                      [locationDetails]="displayedWalk?.walk?.groupEvent?.end_location"
                                      [gpxFile]="displayedWalk?.walk?.fields?.gpxFile"
                                      [disabled]="inputDisabled"
                                      [notify]="notify"/>
            </div>
          }
        </div>
      }
    </div>
    }
  `
})
export class WalkEditDetailsComponent implements OnInit, AfterViewInit {
  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditDetailsComponent", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);

  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }

  @Input() displayedWalk!: DisplayedWalk;
  public inputDisabled = false;
  @Input() renderMapEdit = false;
  @Input() allowDetailView = false;
  @Input() notify!: AlertInstance;
  public showCombinedMap = false;

  @ViewChildren(WalkLocationEditComponent) walkLocationEditComponents!: QueryList<WalkLocationEditComponent>;

  protected readonly WalkType = WalkType;
  protected display = inject(WalkDisplayService);
  difficulties = this.display.difficulties();
  protected readonly enumValueForKey = enumValueForKey;
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;

  private walkGpxService = inject(WalkGpxService);
  public gpxFiles: GpxFileListItem[] = [];
  public selectedGpxFile: GpxFileListItem | null = null;
  public uploadInProgress = false;
  public uploadError: string | null = null;

  ngOnInit() {
    this.loadGpxFiles();
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

  private loadGpxFiles() {
    const walkStart = this.displayedWalk?.walk?.groupEvent?.start_location;
    if (!walkStart?.latitude || !walkStart?.longitude) {
      return;
    }

    this.walkGpxService.listGpxFiles().subscribe({
      next: (files: GpxFileListItem[]) => {
        this.logger.info("GpxFileList", files);
        this.gpxFiles = this.walkGpxService.calculateProximity(
          walkStart.latitude,
          walkStart.longitude,
          files
        );
        this.initializeSelectedGpxFile();
      },
      error: (error) => {
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
}
