import { Component, inject, Input, OnInit } from "@angular/core";
import { DisplayedWalk } from "../../../models/walk.model";
import { DatePicker } from "../../../date-and-time/date-picker";
import { FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faMagnifyingGlass, faPencil } from "@fortawesome/free-solid-svg-icons";
import { MarkdownComponent } from "ngx-markdown";
import { TimePicker } from "../../../date-and-time/time-picker";
import { EventDistanceEdit } from "./event-distance-edit";
import { DateValue } from "../../../models/date.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { WalkDisplayService } from "../walk-display.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { NgxLoggerLevel } from "ngx-logger";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { isString } from "es-toolkit/compat";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";

@Component({
  selector: "app-walk-edit-main-details",
  standalone: true,
  imports: [
    DatePicker,
    FormsModule,
    FontAwesomeModule,
    MarkdownComponent,
    TimePicker,
    EventDistanceEdit,
    ReactiveFormsModule
  ],
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <form>
        <div class="row align-items-center">
          <div class="col-auto">
            <label for="walk-date">Walk Date</label>
            <div class="form-group">
              <app-date-picker id="walk-date" size="md"
                               placeholder="enter date of walk"
                               [disabled]="!display.allowAdminEdits() || inputDisabled"
                               class="w-100"
                               (change)="onDateChange($event)"
                               [value]="displayedWalk?.walk?.groupEvent.start_date_time"/>
            </div>
          </div>
          <div class="col-auto">
            <div class="form-group" app-time-picker id="start-time" label="Start Time" [disabled]="inputDisabled"
                 [value]="displayedWalk?.walk?.groupEvent.start_date_time"
                 (change)="onStartDateTimeChange($event)">
            </div>
          </div>
          <div class="col-auto">
            <div class="form-group" app-event-distance-edit label="Distance"
                 [groupEvent]="displayedWalk?.walk?.groupEvent"
                 (change)="calculateAndSetFinishTime()" [disabled]="inputDisabled"></div>
          </div>
          <div class="col">
            <div class="form-group">
              <label for="miles-per-hour">Avg mph</label>
              <input [(ngModel)]="displayedWalk.walk.fields.milesPerHour"
                     (change)="calculateAndSetFinishTime()"
                     (ngModelChange)="walkChanged($event)" name="milesPerHour"
                     type="number" step="0.25"
                     class="form-control input-sm"
                     id="miles-per-hour"
                     placeholder="Enter Estimated MPH of walk">
            </div>
          </div>
          <div class="col-auto">
            <div class="form-group" app-time-picker id="end-time" label="Estimated Finish Time"
                 [disabled]="inputDisabled"
                 [value]="displayedWalk?.walk?.groupEvent.end_date_time"
                 (change)="onEndDateTimeChange($event)"></div>
          </div>
          <div class="col-auto">
            <div class="form-group">
              <label for="duration">Estimated Duration</label>
              <input disabled
                     [value]="durationCalculated()"
                     type="text"
                     class="form-control input-sm duration"
                     id="duration">
            </div>
          </div>
        </div>
        <div class="row">
          <div class="col-sm-12">
            <div class="form-group">
              <label for="brief-description-and-start-point">Walk Title</label>
              <textarea [(ngModel)]="displayedWalk.walk.groupEvent.title" type="text"
                        (ngModelChange)="walkChanged($event)" name="title"
                        class="form-control input-sm" rows="3"
                        id="brief-description-and-start-point"
                        (change)="afterTitleChange()" placeholder="Enter walk title here"></textarea>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="col-sm-12">
            <div class="form-group">
              <label for="longer-description">Walk Description <a
                [hidden]="longerDescriptionPreview"
                (click)="previewLongerDescription()" [href]="">
                <fa-icon [icon]="faMagnifyingGlass" class="markdown-preview-icon"></fa-icon>
                preview</a>
                @if (longerDescriptionPreview) {
                  <a
                    (click)="editLongerDescription()" [href]="">
                    <fa-icon [icon]="faPencil" class="markdown-preview-icon"/>
                    edit</a>
                } </label>
              @if (longerDescriptionPreview) {
                <p
                  (click)="editLongerDescription()"
                  class="list-arrow" markdown [data]="displayedWalk?.walk?.groupEvent.description"
                  type="text"
                  id="longer-description-formatted"></p>
              }
              @if (!longerDescriptionPreview) {
                <textarea
                  [disabled]="inputDisabled"
                  [(ngModel)]="displayedWalk.walk.groupEvent.description" type="text"
                  (ngModelChange)="walkChanged($event)" name="description"
                  class="form-control input-sm" rows="5" id="longer-description"
                  placeholder="Enter Walk Description here"></textarea>
              }
            </div>
          </div>
        </div>
        @if (displayedWalk?.walk?.groupEvent?.id) {
          <div class="row">
            <div class="col-sm-3">
              <div class="form-group">
                <label for="ramblers-id">Ramblers Id</label>
                <input [(ngModel)]="displayedWalk.walk.groupEvent.id" type="text"
                       name="ramblers-id"
                       class="form-control input-sm"
                       id="ramblers-id"
                       disabled/>
              </div>
            </div>
            <div class="col-sm-9">
              <div class="form-group">
                <label for="ramblers-url">Ramblers Url</label>
                <a [href]="displayedWalk.walk.groupEvent.url"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="form-control input-sm d-block text-truncate"
                   id="ramblers-url"
                   [title]="displayedWalk.walk.groupEvent.url">
                  {{ displayedWalk.walk.groupEvent.url }}
                </a>
              </div>
            </div>
          </div>
        }

      </form>
    </div>
  `,
  styles: [`
    .duration
      width: 146px
  `],
})
export class WalkEditMainDetailsComponent implements OnInit {
  public inputDisabled = false;

  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.logger.info("inputDisabledValue:", inputDisabled);
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }
  @Input() displayedWalk!: DisplayedWalk;
  protected readonly faMagnifyingGlass = faMagnifyingGlass;
  protected readonly faPencil = faPencil;
  protected display = inject(WalkDisplayService);
  private dateUtils = inject(DateUtilsService);
  protected ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  protected walksAndEventsService = inject(WalksAndEventsService);
  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditMainDetailsComponent", NgxLoggerLevel.ERROR);
  protected longerDescriptionPreview = false;
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  protected fb: FormBuilder = inject(FormBuilder);
  protected walkDate: Date;

  ngOnInit() {
  }

  walkChanged($event ) {
    this.logger.info("walkChanged:", $event);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_CHANGED, $event));
  }

  onDateChange(date: DateValue) {
    if (date) {
      const startDateTime = this.dateUtils.isoDateTime(date.value);
      this.logger.info("onDateChange:date", date, "of type", typeof date, "setting start_date_time:", startDateTime);
      this.displayedWalk.walk.groupEvent.start_date_time = startDateTime;
      this.calculateAndSetFinishTime();
    }
  }

  onStartDateTimeChange(startTime: string) {
    if (isString(startTime)) {
      if (this.displayedWalk.walk.groupEvent.start_date_time !== startTime) {
        this.logger.info("onStartDateTimeChange:updated start_date_time from:", this.displayedWalk.walk.groupEvent.start_date_time, "to:", startTime, "of type", typeof startTime);
        this.displayedWalk.walk.groupEvent.start_date_time = startTime;
        this.calculateAndSetFinishTime();
      } else {
        this.logger.info("onStartDateTimeChange: no change to start_date_time, still:", startTime, "of type", typeof startTime);
      }
    } else {
      this.logger.warn("onStartDateTimeChange:invalid input received:", startTime, "of type", typeof startTime);
    }
  }

  onEndDateTimeChange(endTime: string) {
    if (isString(endTime)) {
      if (this.displayedWalk.walk.groupEvent.end_date_time !== endTime) {
        this.displayedWalk.walk.groupEvent.end_date_time = endTime;
        this.logger.info("onEndDateTimeChange:updated end_date_time to", endTime);
      } else {
        this.logger.info("onEndDateTimeChange: no change to end_date_time, still:", endTime, "of type", typeof endTime);
      }
    } else {
      this.logger.warn("onEndDateTimeChange:invalid input received:", endTime, "of type", typeof endTime);
    }
  }

  calculateAndSetFinishTime() {
    if (this.displayedWalk.walk.fields.milesPerHour) {
      const endDateTime: string = this.ramblersWalksAndEventsService.walkFinishTime(this.displayedWalk.walk, this.displayedWalk.walk.fields.milesPerHour);
      this.logger.info("calculateAndSetFinishTime:endDateTime", endDateTime, "from:", this.displayedWalk.walk.groupEvent.end_date_time);
      this.displayedWalk.walk.groupEvent.end_date_time = endDateTime;
    } else {
      this.logger.info("calculateAndSetFinishTime:walk.fields.milesPerHour not set, not calculating finish time");
    }
  }

  previewLongerDescription() {
    this.longerDescriptionPreview = true;
  }

  editLongerDescription() {
    this.longerDescriptionPreview = false;
  }

  durationCalculated() {
    return this.dateUtils.formatDuration(this.dateUtils.asDateValue(this.displayedWalk.walk.groupEvent.start_date_time)?.value, this.dateUtils.asDateValue(this.displayedWalk.walk.groupEvent.end_date_time)?.value);
  }

  async afterTitleChange() {
    const url = await this.walksAndEventsService.urlFromTitle(this.displayedWalk.walk.groupEvent.title, this.displayedWalk.walk.id);
    this.logger.info("afterTitleChange:generated URL from title:", url);
    this.displayedWalk.walk.groupEvent.url = url;
  }
}
