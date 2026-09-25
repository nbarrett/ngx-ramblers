import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck, faCircleXmark, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { SetupProgress, SetupStepStatus } from "../../../models/environment-setup.model";
import { UIDateFormat } from "../../../models/date-format.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { registrationElapsedLabel, registrationProgressLines, registrationProgressStatus, sanitiseRegistrationMessage } from "../../../functions/registration-progress";
import { MarkdownComponent } from "ngx-markdown";

@Component({
  selector: "app-registration-progress-log",
  standalone: true,
  imports: [FontAwesomeModule, MarkdownComponent],
  styles: [`
    .registration-progress-log
      background-color: #1e293b
      color: #e2e8f0
      padding: 1rem
      border-radius: 0.375rem
      font-family: monospace
      font-size: 0.875rem
      max-height: 400px
      overflow-y: auto

    .registration-progress-log .text-muted
      color: #94a3b8 !important

    .registration-progress-row
      display: grid
      grid-template-columns: 1.25rem 7.5rem minmax(0, 1fr)
      column-gap: 0.5rem
      align-items: start
      margin-bottom: 0.35rem

    .registration-progress-time
      white-space: nowrap

    .registration-progress-message
      overflow-wrap: anywhere
      min-width: 0

    .registration-progress-message ::ng-deep p
      margin-bottom: 0

    .registration-progress-message ::ng-deep a
      color: #fbbf24
  `],
  template: `
    <div class="registration-progress-log">
      @if (error) {
        <div class="registration-progress-row">
          <fa-icon [icon]="failed" class="text-danger"/>
          <span class="text-muted registration-progress-time"></span>
          <div class="registration-progress-message" markdown [data]="sanitise(error)"></div>
        </div>
      }
      @for (item of lines(); track $index) {
        <div class="registration-progress-row">
          <fa-icon [icon]="icon(item, $index)" [class.text-success]="status(item, $index) === StepStatus.Completed" [class.text-danger]="status(item, $index) === StepStatus.Failed" [animation]="status(item, $index) === StepStatus.Running ? 'spin' : undefined"/>
          <span class="text-muted registration-progress-time">{{time(item, $index)}}</span>
          <div class="registration-progress-message" markdown [data]="sanitise(item.message || item.step)"></div>
        </div>
      }
      @if (!error && !lines().length) {
        <div class="d-flex align-items-start gap-2">
          @if (inFlight) {
            <fa-icon [icon]="running" animation="spin"/>
            <span>Waiting for the first build step. This can take a minute while the review site is created.</span>
          } @else {
            <span class="text-muted">No build steps recorded.</span>
          }
        </div>
      }
    </div>
  `
})
export class RegistrationProgressLogComponent implements OnInit, OnDestroy {
  private dateUtils = inject(DateUtilsService);
  @Input() progress: SetupProgress[] = [];
  @Input() error = "";
  @Input() inFlight = false;
  StepStatus = SetupStepStatus;
  success = faCircleCheck;
  failed = faCircleXmark;
  running = faSpinner;
  now = 0;
  private elapsedTimer = {id: null as ReturnType<typeof setInterval> | null};

  ngOnInit(): void {
    this.now = this.dateUtils.dateTimeNowAsValue();
    this.elapsedTimer.id = setInterval(() => {
      this.now = this.dateUtils.dateTimeNowAsValue();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.elapsedTimer.id) {
      clearInterval(this.elapsedTimer.id);
    }
  }

  lines(): SetupProgress[] {
    return registrationProgressLines(this.progress);
  }

  status(item: SetupProgress, index: number): SetupStepStatus {
    return registrationProgressStatus(item, this.inFlight, index === 0);
  }

  icon(item: SetupProgress, index: number) {
    const status = this.status(item, index);
    if (status === SetupStepStatus.Failed) {
      return this.failed;
    } else if (status === SetupStepStatus.Completed) {
      return this.success;
    } else {
      return this.running;
    }
  }

  time(item: SetupProgress, index = 0): string {
    const clock = item.timestamp ? this.dateUtils.asString(item.timestamp, undefined, UIDateFormat.RAMBLERS_TIME) : "";
    if (this.status(item, index) === SetupStepStatus.Running && item.timestamp) {
      return `${clock} · ${registrationElapsedLabel(item.timestamp, this.now)}`;
    } else {
      return clock;
    }
  }

  sanitise(message: string): string {
    return sanitiseRegistrationMessage(message);
  }
}
