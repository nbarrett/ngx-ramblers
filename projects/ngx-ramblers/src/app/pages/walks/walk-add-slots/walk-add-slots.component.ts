import { Component, OnInit } from "@angular/core";
import difference from "lodash-es/difference";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertMessage, AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { DateValue } from "../../../models/date.model";
import { Walk } from "../../../models/walk.model";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { BroadcastService } from "../../../services/broadcast-service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { WalkEventService } from "../../../services/walks/walk-event.service";
import { WalksQueryService } from "../../../services/walks/walks-query.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalksService } from "../../../services/walks/walks.service";
import { DisplayDatesAndTimesPipe } from "../../../pipes/display-dates-and-times.pipe";
import uniq from "lodash-es/uniq";
import { DisplayDatesPipe } from "../../../pipes/display-dates.pipe";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalkDisplayService } from "../walk-display.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { PageComponent } from "../../../page/page.component";
import { FormsModule } from "@angular/forms";
import { DatePickerComponent } from "../../../date-picker/date-picker.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgClass } from "@angular/common";

@Component({
    selector: "app-walk-add-slots",
    template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          <div class="mb-2">
            <p>This facility allows you to add any number of walk slots to the programme that
              will then entice walk leaders to come forward and lead. Please choose how you would like to create the
            slots.</p>
            <div class="custom-control custom-radio custom-control-inline">
              <input id="create-in-bulk"
                type="radio"
                class="custom-control-input"
                [disabled]="display.walkPopulationWalksManager()"
                (click)="selectBulk(true)"
                [(ngModel)]="selectionMade"
                value="true"/>
              <label class="custom-control-label" for="create-in-bulk">Create Sunday slots in bulk</label>
            </div>
            <div class="custom-control custom-radio custom-control-inline">
              <input id="create-non-standard"
                type="radio"
                class="custom-control-input"
                [disabled]="display.walkPopulationWalksManager()"
                (click)="selectBulk(false)"
                [(ngModel)]="selectionMade"
                value="false"/>
              <label class="custom-control-label" for="create-non-standard">Create non-standard slot</label>
            </div>
            @if (!selectionMade) {
              <input type="submit" value="Back To Walks Admin" (click)="backToWalksAdmin()"
                title="Back to walks"
                class="button-form">
            }
          </div>
          <div class="main-body">
            @if (selectionMade && bulk) {
              <div>
                <ul class="list-arrow">
                  <li>You can choose the date up until you want slots created using the calendar below.</li>
                  <li>An email can optionally be sent to the group informing them of the new slots that can now be
                    filled.
                  </li>
                </ul>
                <div class="form-inline">
                  <label for="add-slots-until">Add available slots until:</label>
                  <app-date-picker startOfDay id="add-slots-until"
                    [size]="'md'"
                    (dateChange)="onUntilDateChange($event)"
                    [value]="untilDate">
                  </app-date-picker>
                </div>
              </div>
            }
            @if (selectionMade && !bulk) {
              <div>
                <ul class="list-arrow">
                  <li>Use this option to create a slot on any day rather than just on a Sunday.</li>
                </ul>
                <div class="form-inline">
                  <label for="add-single-slot">Add a slot on:</label>
                  <app-date-picker startOfDay id="add-single-slot"
                    [size]="'md'"
                    (dateChange)="onSingleDateChange($event)"
                    [value]="singleDate">
                  </app-date-picker>
                </div>
              </div>
            }
          </div>
          @if (notifyTarget.showAlert) {
            <div class="alert {{notifyTarget.alertClass}} mb-2 mt-2">
              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
              <strong> {{ notifyTarget.alertTitle }}</strong> {{ notifyTarget.alertMessage }}
            </div>
          }
          <div class="mt-3">
            @if (selectionMade && bulk) {
              <span>
                @if (allowAddSlots()) {
                  <input [disabled]="!validDate(this.untilDate) || display.walkPopulationWalksManager()" type="submit" value="Add slots"
                    (click)="addWalkSlots()" title="Add more available slots on the walks programme"
                    [ngClass]="validDate(untilDate) ? 'button-form green-confirm' : 'disabled-button-form button-form-left'">
                }
                @if (confirmAction) {
                  <input type="submit" value="Confirm add slots" (click)="confirmAddWalkSlots()"
                    title="Confirm to add more available slots on the walks programme"
                    [disabled]="notifyTarget.busy"
                    [ngClass]="notifyTarget.busy ? 'button-form disabled-button-form': 'button-form green-confirm'">
                }
                @if (confirmAction) {
                  <input type="submit" value="Cancel" (click)="cancelConfirmableAction()"
                    title="Cancel this action" class="button-form amber-confirm">
                }
              </span>
            }
            @if (selectionMade && !bulk) {
              <span>
                @if (allowAddSlot()) {
                  <input [disabled]="!validDate(singleDate) || display.walkPopulationWalksManager()" type="submit" value="Add slot"
                    (click)="addWalkSlot()" title="Add new slot on the walks programme"
                    [ngClass]="validDate(singleDate) ? 'button-form green-confirm' : 'disabled-button-form button-form-left'">
                }
                @if (confirmAction) {
                  <input type="submit" value="Confirm add slot" (click)="confirmAddWalkSlots()"
                    title="Confirm to add new slot on the walks programme"
                    [disabled]="notifyTarget.busy"
                    [ngClass]="notifyTarget.busy ? 'button-form disabled-button-form': 'button-form green-confirm'">
                }
                @if (confirmAction) {
                  <input type="submit" value="Cancel" (click)="cancelConfirmableAction()"
                    title="Cancel this action" class="button-form amber-confirm">
                }
              </span>
            }
            @if (selectionMade) {
              <input type="submit" value="Back To Walks Admin" (click)="backToWalksAdmin()"
                title="Back to walks"
                class="button-form">
            }
            @if (false) {
              <input type="submit" value="Fix Walk Dates" (click)="fixWalkDates()"
                class="button-form">
            }
          </div>
        </div>
      </div>
    </app-page>
    `,
    styleUrls: ["./walk-add-slots.component.sass"],
    imports: [PageComponent, FormsModule, DatePickerComponent, FontAwesomeModule, NgClass]
})
export class WalkAddSlotsComponent implements OnInit {
  public confirmAction = false;
  private logger: Logger;
  private notify: AlertInstance;
  private requiredWalkSlots: Walk[] = [];
  public singleDate: DateValue;
  public untilDate: DateValue;
  private todayValue: number;
  public bulk: true;
  public notifyTarget: AlertTarget = {};
  public selectionMade: string;
  private displaySlotTimes = false;

  constructor(
    private walksService: WalksService,
    private memberLoginService: MemberLoginService,
    private displayDate: DisplayDatePipe,
    private displayDates: DisplayDatesPipe,
    private displayDatesAndTimes: DisplayDatesAndTimesPipe,
    private walksQueryService: WalksQueryService,
    private dateUtils: DateUtilsService,
    private stringUtils: StringUtilsService,
    private notifierService: NotifierService,
    protected display: WalkDisplayService,
    private systemConfigService: SystemConfigService,
    private broadcastService: BroadcastService<Walk[]>,
    private urlService: UrlService,
    private walkEventService: WalkEventService,
    private walksReferenceService: WalksReferenceService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkAddSlotsComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.systemConfigService.events().subscribe(async item => {
      if (this.display.walkPopulationWalksManager()) {
        this.notify.warning({
          title: "Create Walk Slots",
          message: `This function is not available when the walk population is set to ${this.stringUtils.asTitle(this.display?.group?.walkPopulation)}`
        });
      } else {
      }
    });
    this.todayValue = this.dateUtils.momentNowNoTime().valueOf();
    const momentUntil = this.dateUtils.momentNowNoTime().day(7 * 12);
    this.untilDate = this.dateUtils.asDateValue(momentUntil.valueOf());
    this.singleDate = this.dateUtils.asDateValue(this.todayValue);
    this.bulk = true;
  }

  validDate(date: DateValue) {
    return this.dateUtils.isDate(date?.value);
  }

  createSlots(requiredSlots: number[], message: AlertMessage) {
    this.requiredWalkSlots = requiredSlots.map(date => {
      const walk: Walk = {
        eventType: RamblersEventType.GROUP_WALK,
        walkDate: date,
        ramblersPublish: true,
        events: []
      };
      walk.events = [this.walkEventService.createEventIfRequired(walk,
        this.walksReferenceService.walkEventTypeMappings.awaitingLeader.eventType, "Walk slot created")];
      return walk;
    });
    this.logger.debug("requiredWalkSlots", this.requiredWalkSlots);
    this.notify.clearBusy();
    if (this.requiredWalkSlots.length > 0) {
      this.confirmAction = true;
      this.notify.warning(message);
    } else {
      this.notify.warning({
        title: "Nothing to do!",
        message: "All slots are already created between today and " + this.displayDate.transform(this.untilDate)
      });
      delete this.confirmAction;
    }

  }

  addWalkSlots() {
    this.notify.setBusy();
    this.notify.hide();
    this.walksService.all({criteria: {walkDate: {$gte: this.todayValue}}, select: {events: 1, walkDate: 1}, sort: {walkDate: 1}})
      .then((walks: Walk[]) => this.walksQueryService.activeWalks(walks))
      .then((walks: Walk[]) => {
        this.notify.clearBusy();
        const sunday = this.dateUtils.momentNowNoTime().day(7);
        const until = this.dateUtils.asMoment(this.untilDate).startOf("day");
        const allGeneratedSlots = this.dateUtils.inclusiveDayRange(sunday.valueOf(), until.valueOf())
          .filter(item => this.dateUtils.asMoment(item).day() === 0).filter((date) => {
            return this.dateUtils.asString(date, undefined, "DD-MMM") !== "25-Dec";
          });
        const existingDates: number[] = this.walksQueryService.activeWalks(walks).map(walk => walk.walkDate);
        this.logger.debug("sunday", sunday, "until", until);
        this.logger.debug("existingDatesAsStrings", existingDates.map(date => this.displayDate.transform(date)));
        this.logger.debug("allGeneratedSlotsAsStrings", allGeneratedSlots.map(date => this.displayDate.transform(date)));
        const requiredSlots = uniq(difference(allGeneratedSlots, existingDates));
        const requiredDates: string = this.displaySlotTimes ? this.displayDatesAndTimes.transform(requiredSlots) : this.displayDates.transform(requiredSlots);
        this.createSlots(requiredSlots, {
          title: "Add walk slots",
          message: " - You are about to add " + requiredSlots.length + " walk slots up to "
            + this.displayDate.transform(this.untilDate) + ". Slots are: " + requiredDates
        });
      });
  }

  addWalkSlot() {
    this.notify.setBusy();
    this.notify.hide();
    this.walksService.all({
      criteria: {walkDate: {$eq: this.dateUtils.asValueNoTime(this.singleDate.value)}},
      select: {events: 1, walkDate: 1},
      sort: {walkDate: 1}
    })
      .then(walks => this.walksQueryService.activeWalks(walks))
      .then(walks => {
        this.notify.clearBusy();
        if (walks.length === 0) {
          this.createSlots([this.dateUtils.asValueNoTime(this.singleDate.value)], {
            title: "Add walk slots",
            message: " - You are about to add a walk slot for " + this.displayDate.transform(this.singleDate)
          });
        } else {
          this.notify.warning({
            title: "Nothing to do!",
            message: walks.length + " slot(s) are already created for " + this.displayDate.transform(this.singleDate)
          });
        }
      });

  }

  selectBulk(bulk) {
    this.bulk = bulk;
    this.selectionMade = bulk.toString();
    delete this.confirmAction;
    this.notify.hide();
  }

  allowAddSlot() {
    return !this.confirmAction && !this.bulk && this.memberLoginService.allowWalkAdminEdits();
  }

  allowAddSlots() {
    return !this.confirmAction && this.bulk && this.memberLoginService.allowWalkAdminEdits();
  }

  allowClose() {
    return !this.confirmAction;
  }

  cancelConfirmableAction() {
    delete this.confirmAction;
    this.notify.hide();
  }

  confirmAddWalkSlots() {
    this.notify.success({
      title: "Add walk slots - ", message: "now creating " + this.requiredWalkSlots.length
        + " empty walk slots up to " + this.displayDate.transform(this.untilDate)
    });
    Promise.all(this.requiredWalkSlots.map((walk: Walk) => {
      return this.walksService.createOrUpdate(walk);
    })).then((walkSlots) => {
      this.notify.success({title: "Done!", message: "Choose Back to walks to see your newly created slots"});
      delete this.confirmAction;
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_SLOTS_CREATED, walkSlots));
    });
  }

  backToWalksAdmin() {
    this.urlService.navigateTo(["walks", "admin"]);
  }

  fixWalkDates() {
    this.walksService.fixIncorrectWalkDates();
  }

  onUntilDateChange(date: DateValue) {
    this.logger.info("onUntilDateChange:date", date);
    this.untilDate = date;
  }

  onSingleDateChange(date: DateValue) {
    this.logger.info("onSingleDateChange:date", date);
    this.singleDate = date;
  }

}
