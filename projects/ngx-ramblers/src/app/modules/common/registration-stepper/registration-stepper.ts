import { Component, Input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheck, faSpinner, faXmark } from "@fortawesome/free-solid-svg-icons";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { StepperModule } from "primeng/stepper";
import { RegistrationStage, RegistrationStageStatus } from "../../../models/site-registration.model";

@Component({
  selector: "app-registration-stepper",
  imports: [FontAwesomeModule, TooltipModule, StepperModule],
  template: `
    @if (stages?.length) {
      <p-stepper class="stepper-mini" [value]="currentIndex()">
        <p-step-list>
          @for (stage of stages; track stage.key; let idx = $index) {
            <p-step [value]="idx">
              <span class="stepper-step-number" [class]="'stage-' + stage.status" [tooltip]="stage.label" placement="top" [adaptivePosition]="false" (click)="$event.stopPropagation()">
                @if (stage.status === StageStatus.DONE) {
                  <fa-icon [icon]="faCheck"/>
                } @else if (stage.status === StageStatus.RUNNING) {
                  <fa-icon [icon]="faSpinner" animation="spin"/>
                } @else if (stage.status === StageStatus.FAILED) {
                  <fa-icon [icon]="faXmark"/>
                } @else {
                  {{ idx + 1 }}
                }
              </span>
            </p-step>
          }
        </p-step-list>
      </p-stepper>
      <div class="small text-muted">{{ caption() }}</div>
    }
  `
})
export class RegistrationStepperComponent {
  @Input() stages: RegistrationStage[] = [];

  protected readonly StageStatus = RegistrationStageStatus;
  protected readonly faCheck = faCheck;
  protected readonly faSpinner = faSpinner;
  protected readonly faXmark = faXmark;

  currentIndex(): number {
    const index = (this.stages || []).findIndex(stage => stage.status !== RegistrationStageStatus.DONE);
    return index === -1 ? (this.stages || []).length - 1 : index;
  }

  caption(): string {
    const stage = (this.stages || [])[this.currentIndex()];
    if (!stage) {
      return "";
    } else if (stage.status === RegistrationStageStatus.DONE) {
      return "All steps done";
    } else if (stage.status === RegistrationStageStatus.FAILED) {
      return `Failed while ${stage.label.charAt(0).toLowerCase()}${stage.label.slice(1)}`;
    } else {
      return stage.label;
    }
  }
}
