import { Component, EventEmitter, Input, Output } from "@angular/core";
import { faCircleExclamation } from "@fortawesome/free-solid-svg-icons";
import { PlaceNameChoice } from "../../models/event-venue.model";
import { AlertPanelVariant } from "../../models/alert-panel.model";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";

@Component({
  selector: "app-place-name-choice",
  imports: [AlertPanelComponent],
  template: `
    @if (choice) {
      <app-alert-panel class="mt-2" title="Keep your wording or use the search result?"
        [icon]="faCircleExclamation" [variant]="AlertPanelVariant.WARNING">
        <div>You typed "{{ choice.typed }}". The result is "{{ choice.fromResult }}". The pin uses the result either way.</div>
        <div alertActions class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary text-nowrap" (click)="keep.emit()">
            Keep what you typed
          </button>
          <button type="button" class="btn btn-quiet text-nowrap" (click)="useResult.emit()">
            Use search result
          </button>
        </div>
      </app-alert-panel>
    }
  `
})
export class PlaceNameChoiceComponent {
  @Input() choice: PlaceNameChoice | null = null;
  @Output() keep = new EventEmitter<void>();
  @Output() useResult = new EventEmitter<void>();
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly AlertPanelVariant = AlertPanelVariant;
}
