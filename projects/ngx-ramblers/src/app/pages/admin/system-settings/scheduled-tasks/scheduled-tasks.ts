import { Component, inject, OnDestroy, OnInit, Type } from "@angular/core";
import { Subscription } from "rxjs";
import { NgComponentOutlet } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faPencil, faPlay, faRefresh, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { TimePicker } from "../../../../date-and-time/time-picker";
import { UIDateFormat } from "../../../../models/date-format.model";
import {
  BACKUPS_TASK_ID,
  BREVO_CAMPAIGN_RELEASE_TASK_ID,
  SCHEDULED_TASK_SUB_TAB_GROUPS,
  ScheduledTaskScheduleEdit,
  ScheduledTaskScheduleFrequency,
  ScheduledTaskRun,
  ScheduledTaskSubTab,
  ScheduledTaskSummary
} from "../../../../models/scheduled-task.model";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { ScheduledTaskService } from "../../../../services/scheduled-task.service";
import { WebSocketClientService } from "../../../../services/websockets/websocket-client.service";
import { EventType, MessageType } from "../../../../models/websocket.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { SectionToggle, SectionToggleTab } from "../../../../shared/components/section-toggle";
import { MailCampaignQueueComponent } from "../mail/mail-campaign-queue";
import { BackupsTaskSettingsComponent } from "./backups-task-settings";

@Component({
  selector: "app-scheduled-tasks",
  imports: [FontAwesomeModule, FormsModule, TimePicker, SectionToggle, NgComponentOutlet],
  template: `
    <app-section-toggle
      [tabs]="scheduledTaskSubTabs"
      [(selectedTab)]="scheduledTaskSubTab"
      [queryParamKey]="'task-sub-tab'"/>
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Scheduled Tasks</div>
      <div class="col-sm-12">
        <p>Recurring background work registered by this server instance. Manual runs are recorded in the same history as scheduled executions.</p>
        <button type="button" class="btn btn-primary mb-3" [disabled]="busy" (click)="refresh()">
          <fa-icon [icon]="busy ? faSpinner : faRefresh" [animation]="busy ? 'spin' : null"/> Refresh
        </button>
      </div>
    </div>
    <div>
      @if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      }
      @if (tasks.length === 0 && !busy) {
        <div class="alert alert-warning">No scheduled tasks are registered.</div>
      }
      @for (task of tasks; track task.id) {
        @if (showTask(task)) {
          <div class="row thumbnail-heading-frame">
            <div class="thumbnail-heading">{{ task.name }}</div>
            <div class="col-sm-12">
              <div>
                <p class="mb-3">{{ task.description }}</p>
                <span class="badge text-bg-secondary">Current schedule: {{ task.scheduleDescription }}</span>
                <div class="d-flex align-items-center gap-2 mt-3">
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch"
                           [id]="'task-enabled-' + task.id" [checked]="task.enabled"
                           [disabled]="busy" (change)="toggleEnabled(task, $event)">
                    <label class="form-check-label" [for]="'task-enabled-' + task.id">{{ task.enabled ? "Enabled" : "Disabled" }}</label>
                  </div>
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="busy" (click)="trigger(task)">
                    <fa-icon [icon]="faPlay"/> Run now
                  </button>
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="busy" (click)="editSchedule(task)">
                    <fa-icon [icon]="faPencil"/> {{ editingTaskId === task.id ? "Close schedule" : "Change schedule" }}
                  </button>
                </div>
            </div>
            @if (editingTaskId === task.id && scheduleEdits[task.id]; as schedule) {
              <div class="row align-items-end mt-3">
                <div class="col-auto">
                  <label class="form-label" [for]="'task-frequency-' + task.id">Repeat</label>
                    <select class="form-control schedule-select" [id]="'task-frequency-' + task.id"
                            [(ngModel)]="schedule.frequency" [disabled]="busy">
                      @for (option of scheduleFrequencyOptions; track option.value) {
                        <option [ngValue]="option.value">{{ option.label }}</option>
                      }
                    </select>
                  </div>
                  @if (schedule.frequency === ScheduledTaskScheduleFrequency.EVERY_MINUTES) {
                    <div class="col-auto">
                      <label class="form-label" [for]="'task-minutes-' + task.id">Every</label>
                      <select class="form-control schedule-select" [id]="'task-minutes-' + task.id"
                              [(ngModel)]="schedule.minuteInterval" [disabled]="busy">
                        @for (interval of minuteIntervals; track interval) {
                          <option [ngValue]="interval">{{ interval }} minutes</option>
                        }
                      </select>
                    </div>
                  }
                  @if (schedule.frequency === ScheduledTaskScheduleFrequency.EVERY_HOURS) {
                    <div class="col-auto">
                      <label class="form-label" [for]="'task-hours-' + task.id">Every</label>
                      <select class="form-control schedule-select" [id]="'task-hours-' + task.id"
                              [(ngModel)]="schedule.hourInterval" [disabled]="busy">
                        @for (interval of hourIntervals; track interval) {
                          <option [ngValue]="interval">{{ interval }} hours</option>
                        }
                    </select>
                  </div>
                }
                @if (schedule.frequency === ScheduledTaskScheduleFrequency.WEEKLY) {
                  <div class="col-auto">
                      <label class="form-label" [for]="'task-day-' + task.id">On</label>
                      <select class="form-control schedule-select" [id]="'task-day-' + task.id"
                              [(ngModel)]="schedule.dayOfWeek" [disabled]="busy">
                        @for (option of weekdayOptions; track option.value) {
                          <option [ngValue]="option.value">{{ option.label }}</option>
                        }
                      </select>
                    </div>
                  }
                  @if (schedule.frequency === ScheduledTaskScheduleFrequency.MONTHLY) {
                    <div class="col-auto">
                      <label class="form-label" [for]="'task-month-day-' + task.id">Day of month</label>
                      <select class="form-control schedule-select" [id]="'task-month-day-' + task.id"
                              [(ngModel)]="schedule.dayOfMonth" [disabled]="busy">
                        @for (day of monthDays; track day) {
                          <option [ngValue]="day">{{ day }}</option>
                        }
                      </select>
                    </div>
                  }
                  <div class="col-auto d-flex gap-2">
                    <button type="button" class="btn btn-primary" [disabled]="busy || !scheduleChanged(task)" (click)="saveSchedule(task)">
                      Save schedule
                    </button>
                    <button type="button" class="btn btn-primary" [disabled]="busy" (click)="cancelScheduleEdit(task)">
                      Cancel
                    </button>
                  </div>
                </div>
                @if (usesTime(schedule)) {
                  <div class="row mt-3">
                    <div class="col-auto form-group mb-0" app-time-picker
                         [id]="'task-time-' + task.id" label="At time"
                         [value]="schedule.time" [disabled]="busy"
                         (change)="schedule.time = $event">
                    </div>
                  </div>
                }
                <div class="row">
                  <div class="col-12 mt-2">
                    @if (schedule.frequency === ScheduledTaskScheduleFrequency.CUSTOM) {
                      <div class="alert alert-warning mb-0">This task currently has an advanced schedule. Select a repeat option to replace it.</div>
                    } @else {
                      <small class="form-text text-muted">Selected schedule: {{ scheduleDescription(schedule) }}.</small>
                    }
                  </div>
                </div>
              }
              <div class="row mt-3 small">
                <div class="col-md-6"><strong>Next run:</strong> {{ formattedRunTime(task.nextRunAt, "Disabled") }}</div>
                <div class="col-md-6"><strong>Last run:</strong> {{ task.lastRun ? formattedRunTime(task.lastRun.startedAt, "Never") + " (" + task.lastRun.status + ")" : "Never" }}</div>
              </div>
              @if (task.history.length > 0) {
                <details class="mt-3">
                  <summary>Execution history ({{ task.history.length }})</summary>
                  <table class="table table-sm mt-2 mb-0">
                    <thead><tr><th>Started</th><th>Completed</th><th>Duration</th><th>Status</th><th>Message</th></tr></thead>
                    <tbody>
                      @for (run of task.history; track run.startedAt) {
                        <tr>
                          <td>{{ formattedRunTime(run.startedAt, "-") }}</td>
                          <td>{{ formattedRunTime(run.completedAt, "-") }}</td>
                          <td>{{ formattedRunDuration(run) }}</td>
                          <td>{{ run.status }}</td>
                          <td>{{ run.message || "" }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </details>
              }
              @if (taskChildComponent(task); as childComponent) {
                <div class="mt-3">
                  <ng-container *ngComponentOutlet="childComponent; inputs: taskChildInputs(task)"></ng-container>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .schedule-select
      min-width: 220px
  `]
})
export class ScheduledTasksComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("ScheduledTasksComponent", NgxLoggerLevel.ERROR);
  private service = inject(ScheduledTaskService);
  private dateUtils = inject(DateUtilsService);
  private websocketService = inject(WebSocketClientService);
  private subscriptions: Subscription[] = [];
  protected tasks: ScheduledTaskSummary[] = [];
  protected scheduleEdits: Record<string, ScheduledTaskScheduleEdit> = {};
  protected busy = false;
  protected error: string | null = null;
  protected editingTaskId: string | null = null;
  protected readonly faPlay = faPlay;
  protected readonly faPencil = faPencil;
  protected readonly faRefresh = faRefresh;
  protected readonly faSpinner = faSpinner;
  protected readonly ScheduledTaskScheduleFrequency = ScheduledTaskScheduleFrequency;
  protected scheduledTaskSubTab = ScheduledTaskSubTab.ALL;
  protected readonly scheduledTaskSubTabs: SectionToggleTab[] = [
    {value: ScheduledTaskSubTab.BOOKING_REMINDERS, label: "Booking reminders"},
    {value: ScheduledTaskSubTab.WALKS_MANAGER_SYNC, label: "Walks Manager sync"},
    {value: ScheduledTaskSubTab.GMAIL, label: "Gmail"},
    {value: ScheduledTaskSubTab.BREVO, label: "Brevo"},
    {value: ScheduledTaskSubTab.BACKUPS, label: "Backups"},
    {value: ScheduledTaskSubTab.ALL, label: "All"}
  ];
  protected readonly scheduleFrequencyOptions = [
    {value: ScheduledTaskScheduleFrequency.CUSTOM, label: "Choose a schedule"},
    {value: ScheduledTaskScheduleFrequency.EVERY_MINUTES, label: "Every few minutes"},
    {value: ScheduledTaskScheduleFrequency.HOURLY, label: "Hourly"},
    {value: ScheduledTaskScheduleFrequency.EVERY_HOURS, label: "Every few hours"},
    {value: ScheduledTaskScheduleFrequency.DAILY, label: "Daily"},
    {value: ScheduledTaskScheduleFrequency.WEEKLY, label: "Weekly"},
    {value: ScheduledTaskScheduleFrequency.MONTHLY, label: "Monthly"}
  ];
  protected readonly minuteIntervals = [5, 10, 15, 20, 30];
  protected readonly hourIntervals = [2, 3, 4, 6, 8, 12];
  protected readonly weekdayOptions = [
    {value: "1", label: "Monday"},
    {value: "2", label: "Tuesday"},
    {value: "3", label: "Wednesday"},
    {value: "4", label: "Thursday"},
    {value: "5", label: "Friday"},
    {value: "6", label: "Saturday"},
    {value: "0", label: "Sunday"},
    {value: "1-5", label: "Monday to Friday"}
  ];
  protected readonly monthDays = [...new Array(31)].map((_value, index) => index + 1);

  ngOnInit(): void {
    void this.refresh();
    void this.subscribeToTaskUpdates();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private async subscribeToTaskUpdates(): Promise<void> {
    try {
      await this.websocketService.connect();
      this.subscriptions.push(
        this.websocketService.receiveMessages<{ task: ScheduledTaskSummary }>(MessageType.SCHEDULED_TASK_UPDATED)
          .subscribe(data => this.applyTaskUpdate(data.task))
      );
      this.websocketService.sendMessage(EventType.SCHEDULED_TASK_EVENTS, {});
    } catch (error) {
      this.logger.warn("live task updates unavailable:", error);
    }
  }

  private applyTaskUpdate(task: ScheduledTaskSummary): void {
    this.tasks = this.tasks.map(existing => existing.id === task.id ? task : existing);
  }

  protected async refresh(): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      this.tasks = await this.service.tasks();
      this.captureScheduleEdits();
    } catch (error: any) {
      this.error = error?.message || "Unable to load scheduled tasks";
    }
    this.busy = false;
  }

  protected async trigger(task: ScheduledTaskSummary): Promise<void> {
    this.busy = true;
    try {
      await this.service.trigger(task.id);
      this.tasks = await this.service.tasks();
      this.captureScheduleEdits();
      this.error = null;
    } catch (error: any) {
      this.error = error?.message || "Unable to run scheduled task";
    }
    this.busy = false;
  }

  protected async toggleEnabled(task: ScheduledTaskSummary, event: Event): Promise<void> {
    const enabled = (event.target as HTMLInputElement).checked;
    this.busy = true;
    try {
      await this.service.setEnabled(task.id, enabled);
      this.tasks = await this.service.tasks();
      this.captureScheduleEdits();
      this.error = null;
    } catch (error: any) {
      this.error = error?.message || "Unable to update scheduled task";
    }
    this.busy = false;
  }

  protected showTask(task: ScheduledTaskSummary): boolean {
    if (this.scheduledTaskSubTab === ScheduledTaskSubTab.ALL) {
      return true;
    }
    const group = SCHEDULED_TASK_SUB_TAB_GROUPS[this.scheduledTaskSubTab];
    return group ? (group as string[]).includes(task.id) : task.id === this.scheduledTaskSubTab;
  }

  protected editSchedule(task: ScheduledTaskSummary): void {
    if (this.editingTaskId === task.id) {
      this.editingTaskId = null;
    } else {
      this.scheduleEdits[task.id] = this.scheduleEdit(task.cronExpression);
      this.editingTaskId = task.id;
    }
  }

  protected cancelScheduleEdit(task: ScheduledTaskSummary): void {
    this.scheduleEdits[task.id] = this.scheduleEdit(task.cronExpression);
    this.editingTaskId = null;
  }

  protected scheduleChanged(task: ScheduledTaskSummary): boolean {
    const expression = this.cronExpression(this.scheduleEdits[task.id]);
    return expression !== null && expression !== task.cronExpression;
  }

  protected async saveSchedule(task: ScheduledTaskSummary): Promise<void> {
    this.busy = true;
    try {
      const expression = this.cronExpression(this.scheduleEdits[task.id]);
      if (expression) {
        await this.service.setSchedule(task.id, expression);
        this.tasks = await this.service.tasks();
        this.captureScheduleEdits();
        this.editingTaskId = null;
        this.error = null;
      } else {
        this.error = "Select a schedule before saving";
      }
    } catch (error: any) {
      this.error = error?.message || "Unable to update scheduled task schedule";
    }
    this.busy = false;
  }

  protected usesTime(schedule: ScheduledTaskScheduleEdit): boolean {
    return [
      ScheduledTaskScheduleFrequency.HOURLY,
      ScheduledTaskScheduleFrequency.EVERY_HOURS,
      ScheduledTaskScheduleFrequency.DAILY,
      ScheduledTaskScheduleFrequency.WEEKLY,
      ScheduledTaskScheduleFrequency.MONTHLY
    ].includes(schedule.frequency);
  }

  protected scheduleDescription(schedule: ScheduledTaskScheduleEdit): string {
    const expression = this.cronExpression(schedule);
    const [hour, minute] = this.timeParts(schedule.time);
    const time = `${hour}:${minute}`;
    let description = "";
    if (schedule.frequency === ScheduledTaskScheduleFrequency.EVERY_MINUTES) {
      description = `every ${schedule.minuteInterval} minutes`;
    } else if (schedule.frequency === ScheduledTaskScheduleFrequency.HOURLY) {
      description = `hourly at ${minute} minutes past`;
    } else if (schedule.frequency === ScheduledTaskScheduleFrequency.EVERY_HOURS) {
      description = `every ${schedule.hourInterval} hours at ${minute} minutes past`;
    } else if (schedule.frequency === ScheduledTaskScheduleFrequency.DAILY) {
      description = `daily at ${time}`;
    } else if (schedule.frequency === ScheduledTaskScheduleFrequency.WEEKLY) {
      description = `weekly on ${this.weekdayLabel(schedule.dayOfWeek)} at ${time}`;
    } else if (schedule.frequency === ScheduledTaskScheduleFrequency.MONTHLY) {
      description = `monthly on day ${schedule.dayOfMonth} at ${time}`;
    } else if (expression === null) {
      description = "select a schedule";
    }
    return description;
  }

  private captureScheduleEdits(): void {
    this.scheduleEdits = this.tasks.reduce((values, task) => ({
      ...values,
      [task.id]: this.scheduleEdit(task.cronExpression)
    }), {});
  }

  private scheduleEdit(cronExpression: string): ScheduledTaskScheduleEdit {
    const fields = cronExpression.trim().split(/\s+/);
    const schedule: ScheduledTaskScheduleEdit = {
      frequency: ScheduledTaskScheduleFrequency.CUSTOM,
      minuteInterval: 15,
      hourInterval: 6,
      time: this.timeValue("09", "00"),
      dayOfWeek: "1",
      dayOfMonth: 1
    };
    if (fields.length === 5) {
      const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
      const everyMinutes = minute.match(/^\*\/(\d+)$/)?.[1];
      const everyHours = hour.match(/^\*\/(\d+)$/)?.[1];
      const numericMinute = /^\d+$/.test(minute);
      const numericHour = /^\d+$/.test(hour);
      if (everyMinutes && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
        schedule.frequency = ScheduledTaskScheduleFrequency.EVERY_MINUTES;
        schedule.minuteInterval = Number.parseInt(everyMinutes, 10);
      } else if (numericMinute && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
        schedule.frequency = ScheduledTaskScheduleFrequency.HOURLY;
        schedule.time = this.timeValue("00", minute);
      } else if (numericMinute && everyHours && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
        schedule.frequency = ScheduledTaskScheduleFrequency.EVERY_HOURS;
        schedule.hourInterval = Number.parseInt(everyHours, 10);
        schedule.time = this.timeValue("00", minute);
      } else if (numericMinute && numericHour && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
        schedule.frequency = ScheduledTaskScheduleFrequency.DAILY;
        schedule.time = this.timeValue(hour, minute);
      } else if (numericMinute && numericHour && dayOfMonth === "*" && month === "*" && this.weekdayLabel(dayOfWeek)) {
        schedule.frequency = ScheduledTaskScheduleFrequency.WEEKLY;
        schedule.time = this.timeValue(hour, minute);
        schedule.dayOfWeek = dayOfWeek;
      } else if (numericMinute && numericHour && /^\d+$/.test(dayOfMonth) && month === "*" && dayOfWeek === "*") {
        schedule.frequency = ScheduledTaskScheduleFrequency.MONTHLY;
        schedule.time = this.timeValue(hour, minute);
        schedule.dayOfMonth = Number.parseInt(dayOfMonth, 10);
      }
    }
    return schedule;
  }

  private cronExpression(schedule: ScheduledTaskScheduleEdit | null): string | null {
    let expression: string | null = null;
    if (schedule) {
      const [hour, minute] = this.timeParts(schedule.time);
      if (schedule.frequency === ScheduledTaskScheduleFrequency.EVERY_MINUTES) {
        expression = `*/${schedule.minuteInterval} * * * *`;
      } else if (schedule.frequency === ScheduledTaskScheduleFrequency.HOURLY) {
        expression = `${minute} * * * *`;
      } else if (schedule.frequency === ScheduledTaskScheduleFrequency.EVERY_HOURS) {
        expression = `${minute} */${schedule.hourInterval} * * *`;
      } else if (schedule.frequency === ScheduledTaskScheduleFrequency.DAILY) {
        expression = `${minute} ${hour} * * *`;
      } else if (schedule.frequency === ScheduledTaskScheduleFrequency.WEEKLY) {
        expression = `${minute} ${hour} * * ${schedule.dayOfWeek}`;
      } else if (schedule.frequency === ScheduledTaskScheduleFrequency.MONTHLY) {
        expression = `${minute} ${hour} ${schedule.dayOfMonth} * *`;
      }
    }
    return expression;
  }

  private weekdayLabel(value: string): string | null {
    return this.weekdayOptions.find(option => option.value === value)?.label ?? null;
  }

  protected formattedRunTime(value: string | null, emptyValue: string): string {
    return value ? this.dateUtils.asString(value, null, UIDateFormat.DISPLAY_DATE_AT_TIME) : emptyValue;
  }

  protected formattedRunDuration(run: ScheduledTaskRun): string {
    return run.completedAt
      ? this.dateUtils.formatDuration(this.dateUtils.asValue(run.startedAt), this.dateUtils.asValue(run.completedAt))
      : "In progress";
  }

  protected taskChildComponent(task: ScheduledTaskSummary): Type<unknown> | null {
    if (task.id === BREVO_CAMPAIGN_RELEASE_TASK_ID) {
      return MailCampaignQueueComponent;
    } else if (task.id === BACKUPS_TASK_ID) {
      return BackupsTaskSettingsComponent;
    } else {
      return null;
    }
  }

  protected taskChildInputs(task: ScheduledTaskSummary): Record<string, unknown> {
    if (task.id === BREVO_CAMPAIGN_RELEASE_TASK_ID) {
      return {embedded: true};
    } else if (task.id === BACKUPS_TASK_ID) {
      return {taskValue: task};
    } else {
      return {};
    }
  }

  private timeParts(value: string): string[] {
    const time = this.dateUtils.asDateTime(value);
    return [time.hour.toString().padStart(2, "0"), time.minute.toString().padStart(2, "0")];
  }

  private timeValue(hour: string, minute: string): string {
    return this.dateUtils.isoDateTime(this.dateUtils.dateTimeNowNoTime().set({
      hour: Number.parseInt(hour, 10),
      minute: Number.parseInt(minute, 10)
    }).valueOf());
  }
}
