import { Component, inject, Input } from "@angular/core";
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
import { JsonPipe } from "@angular/common";

@Component({
  selector: "app-walk-edit-details",
    imports: [
    FormsModule,
    WalkLocationEditComponent,
    EventAscentEdit,
    JsonPipe
  ],
  template: `
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
      </div>
      @if (renderMapEdit) {
        <div class="row">
          <div class="col">
            <app-walk-location-edit locationType="Starting"
                                    [locationDetails]="displayedWalk?.walk?.groupEvent.start_location"
                                    [notify]="notify"/>
          </div>
          @if (enumValueForKey(WalkType, displayedWalk?.walk?.groupEvent?.shape) === WalkType.LINEAR) {
            <div class="col">
              <app-walk-location-edit locationType="Finishing"
                                      [locationDetails]="displayedWalk?.walk?.groupEvent?.end_location"
                                      [notify]="notify"/>
            </div>
          }
        </div>
        @if (enumValueForKey(WalkType, displayedWalk?.walk?.groupEvent?.shape) === WalkType.LINEAR) {
          <div class="row mt-2">
            <div class="col d-flex justify-content-center">
              <button type="button" class="btn btn-primary"
                      (click)="swapStartAndEndLocations()">
                Swap Start & End Locations
              </button>
            </div>
          </div>
        }
      }
    </div>
  `
})
export class WalkEditDetailsComponent {

  @Input("inputDisabled") set inputDisabledValue(inputDisabled: boolean) {
    this.inputDisabled = coerceBooleanProperty(inputDisabled);
  }

  @Input() displayedWalk!: DisplayedWalk;
  public inputDisabled = false;
  @Input() renderMapEdit = false;
  @Input() allowDetailView = false;
  @Input() notify!: AlertInstance;

  protected readonly WalkType = WalkType;
  protected display = inject(WalkDisplayService);
  difficulties = this.display.difficulties();
  protected readonly enumValueForKey = enumValueForKey;

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
}
