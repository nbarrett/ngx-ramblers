import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { DisplayedWalk } from "../../../models/walk.model";
import { DatePicker } from "../../../date-and-time/date-picker";
import { FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { TimePicker } from "../../../date-and-time/time-picker";
import { EventDistanceEdit } from "./event-distance-edit";
import { DateValue } from "../../../models/date.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { WalkDisplayService } from "../walk-display.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { NgxLoggerLevel } from "ngx-logger";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { isNumber, isString } from "es-toolkit/compat";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { TiptapMarkdownEditor } from "../../../modules/common/tiptap-editor/tiptap-markdown-editor";
import { WalkTextTidyComponent } from "../../../shared/components/walk-text-tidy";
import { WalkTextTidyService } from "../../../services/ai/walk-text-tidy.service";
import { Subscription } from "rxjs";
import { textFingerprint } from "../../../functions/text-diff";
import { TidyTextApplied, TidyTextItem, TidyTextKind } from "../../../models/ai.model";
import { WalksConfigService } from "../../../services/system/walks-config.service";

@Component({
    providers: [WalkTextTidyService],
  selector: "app-walk-edit-main-details",
    imports: [
    DatePicker,
    FormsModule,
    TimePicker,
    EventDistanceEdit,
    ReactiveFormsModule,
    TiptapMarkdownEditor, WalkTextTidyComponent],
  template: `
    @if (displayedWalk?.walk?.fields) {
    <div class="img-thumbnail thumbnail-admin-edit">
      <form>
        <div class="row align-items-center">
          <div class="col-auto">
            <div class="form-group">
              <label for="walk-date">Walk Date</label>
              <app-date-picker id="walk-date" size="sm"
                               placeholder="enter date of walk"
                               [disabled]="!display.walkLeaderOrAdmin(displayedWalk?.walk) || syncDisabled"
                               class="w-100"
                               (change)="onDateChange($event)"
                               [value]="displayedWalk?.walk?.groupEvent.start_date_time"/>
            </div>
          </div>
          <div class="col-auto">
            <div class="form-group" app-time-picker id="start-time" label="Start Time" [disabled]="syncDisabled"
                 [value]="displayedWalk?.walk?.groupEvent.start_date_time"
                 (timeChange)="onStartDateTimeChange($event)">
            </div>
          </div>
          <div class="col-auto">
            <div class="form-group" app-event-distance-edit label="Distance"
                 [groupEvent]="displayedWalk?.walk?.groupEvent"
                 (change)="calculateAndSetFinishTime()" [disabled]="syncDisabled"></div>
          </div>
          <div class="col">
            <div class="form-group">
              <label for="miles-per-hour">Avg mph</label>
              <input [(ngModel)]="displayedWalk.walk.fields.milesPerHour"
                     (change)="calculateAndSetFinishTime()"
                     (ngModelChange)="walkChanged($event)" name="milesPerHour"
                     type="number" step="0.25"
                     [disabled]="syncDisabled"
                     class="form-control input-sm"
                     id="miles-per-hour"
                     placeholder="Enter Estimated MPH of walk">
            </div>
          </div>
          <div class="col-auto">
            <div class="form-group" app-time-picker id="end-time" label="Estimated Finish Time"
                 [disabled]="syncDisabled"
                 [value]="displayedWalk?.walk?.groupEvent.end_date_time"
                 (timeChange)="onEndDateTimeChange($event)"></div>
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
              <label for="brief-description-and-start-point">Walk Title ({{100 - (displayedWalk.walk.groupEvent.title?.length || 0)}} characters left)</label>
              <app-walk-text-tidy [item]="tidyItem(TidyTextKind.TITLE)" [disabled]="syncDisabled" (applied)="tidiedTextApplied($event)" (kept)="tidiedTextKept($event)">
                <textarea [(ngModel)]="displayedWalk.walk.groupEvent.title" type="text"
                          (ngModelChange)="walkChanged($event)" name="title"
                          [disabled]="syncDisabled"
                          class="form-control input-sm" rows="3"
                          id="brief-description-and-start-point"
                          maxlength="100"
                          (blur)="walkTextTidy.requestCheck(TidyTextKind.TITLE)"
                          (change)="afterTitleChange()" placeholder="Enter walk title here"></textarea>
              </app-walk-text-tidy>
              @if (displayedWalk.walk.groupEvent.title?.length > 100) {
                <div class="text-danger">Title must not exceed 100 characters.</div>
              }
            </div>
          </div>
        </div>
        <div class="row">
          <div class="col-sm-12">
            <div class="form-group">
              <label for="longer-description">Walk Description</label>
              <app-walk-text-tidy [item]="tidyItem(TidyTextKind.DESCRIPTION)" [disabled]="syncDisabled" (applied)="tidiedTextApplied($event)" (kept)="tidiedTextKept($event)">
                <div (focusout)="walkTextTidy.requestCheck(TidyTextKind.DESCRIPTION)">
                  <app-tiptap-markdown-editor
                    id="longer-description"
                    [value]="displayedWalk.walk.groupEvent.description || ''"
                    [editable]="!syncDisabled"
                    placeholder="Enter walk description here"
                    (valueChange)="descriptionChanged($event)"/>
                </div>
              </app-walk-text-tidy>
            </div>
          </div>
        </div>


        <div class="row mt-2 align-items-end">
          <div class="col-auto">
            <div class="form-check mb-2">
              <input [(ngModel)]="displayedWalk.walk.fields.bookingsEnabled"
                     (ngModelChange)="walkChanged($event)" name="bookingsEnabled"
                     type="checkbox"
                     [disabled]="inputDisabled"
                     class="form-check-input"
                     id="walk-bookings-enabled">
              <label class="form-check-label" for="walk-bookings-enabled">Bookings enabled for this event</label>
            </div>
          </div>
          <div class="col-auto">
            <div class="form-group">
              <label for="max-capacity">Max Capacity</label>
              <input [(ngModel)]="displayedWalk.walk.fields.maxCapacity"
                     (ngModelChange)="walkChanged($event)" name="maxCapacity"
                     type="number" min="1"
                     [disabled]="inputDisabled"
                     class="form-control input-sm"
                     id="max-capacity"
                     placeholder="e.g. 20">
            </div>
          </div>
          <div class="col-auto">
            <div class="form-group">
              <label for="max-group-size">Max Per Booking</label>
              <input [(ngModel)]="displayedWalk.walk.fields.maxGroupSize"
                     (ngModelChange)="walkChanged($event)" name="maxGroupSize"
                     type="number" min="1" max="20"
                     [disabled]="inputDisabled"
                     class="form-control input-sm"
                     id="max-group-size"
                     placeholder="default 3">
            </div>
          </div>
        </div>
      </form>
    </div>
    }
  `,
  styles: [`
    .duration
      width: 146px
  `],
})
export class WalkEditMainDetailsComponent implements OnInit, OnDestroy {
  public inputDisabled = false;

  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.logger.info("inputDisabledValue:", inputDisabled);
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }
  @Input() displayedWalk!: DisplayedWalk;
  protected display = inject(WalkDisplayService);
  private dateUtils = inject(DateUtilsService);
  protected ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  protected walksAndEventsService = inject(WalksAndEventsService);
  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditMainDetailsComponent", NgxLoggerLevel.ERROR);

  get syncDisabled(): boolean {
    return this.inputDisabled || this.display.walkPopulationWalksManager();
  }
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  protected fb: FormBuilder = inject(FormBuilder);
  protected walkDate: Date;

  ngOnInit() {
    this.walkTextTidy.enabled = this.walksConfigService.walksConfig()?.suggestTextTidyUps !== false
      && this.display.walkPopulationLocal()
      && !this.display.eventHasStarted(this.displayedWalk?.walk);
    this.tidySubscription = this.walkTextTidy.showingChanges().subscribe(showing => this.tidyShowing = showing);
  }

  ngOnDestroy() {
    this.tidySubscription?.unsubscribe();
    this.walkTextTidy.destroy();
  }

  walkChanged($event ) {
    this.logger.info("walkChanged:", $event);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_CHANGED, $event));
  }

  descriptionChanged(markdown: string) {
    this.displayedWalk.walk.groupEvent.description = markdown;
    this.walkChanged(markdown);
  }

  tidyShowing: TidyTextKind[] = [];
  private walksConfigService = inject(WalksConfigService);
  protected walkTextTidy = inject(WalkTextTidyService);
  private tidySubscription: Subscription | null = null;
  protected readonly TidyTextKind = TidyTextKind;

  tidyItem(kind: TidyTextKind): TidyTextItem {
    return kind === TidyTextKind.TITLE
      ? {kind, label: "Walk Title", text: this.displayedWalk.walk.groupEvent.title || "", acceptedFingerprint: this.displayedWalk.walk.fields?.titleTidyFingerprint}
      : {kind, label: "Walk Description", text: this.displayedWalk.walk.groupEvent.description || "", acceptedFingerprint: this.displayedWalk.walk.fields?.descriptionTidyFingerprint};
  }

  tidiedTextApplied(applied: TidyTextApplied) {
    this.tidiedTextKept(applied);
    if (applied.kind === TidyTextKind.TITLE) {
      this.displayedWalk.walk.groupEvent.title = applied.text;
      this.walkChanged(applied.text);
      void this.afterTitleChange();
    } else {
      this.descriptionChanged(applied.text);
    }
  }

  tidiedTextKept(kept: TidyTextApplied) {
    if (kept.kind === TidyTextKind.TITLE) {
      this.displayedWalk.walk.fields.titleTidyFingerprint = textFingerprint(kept.text);
    } else {
      this.displayedWalk.walk.fields.descriptionTidyFingerprint = textFingerprint(kept.text);
    }
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

  durationCalculated() {
    const startDateTime = this.displayedWalk.walk.groupEvent.start_date_time;
    const endDateTime = this.displayedWalk.walk.groupEvent.end_date_time;
    const startValue = this.dateUtils.asDateValue(startDateTime)?.value;
    const endValue = this.dateUtils.asDateValue(endDateTime)?.value;
    if (startDateTime && endDateTime && isNumber(startValue) && isNumber(endValue) && endValue >= startValue) {
      return this.dateUtils.formatDuration(startValue, endValue);
    } else {
      return "";
    }
  }

  async afterTitleChange() {
    if (this.displayedWalk.walk.groupEvent.id) {
      this.logger.info("afterTitleChange:walk already published to Ramblers (id:", this.displayedWalk.walk.groupEvent.id, "), URL will not be changed");
      return;
    }
    const url = await this.walksAndEventsService.urlFor(this.displayedWalk.walk);
    this.logger.info("afterTitleChange:generated URL:", url);
    this.displayedWalk.walk.groupEvent.url = url;
  }
}
