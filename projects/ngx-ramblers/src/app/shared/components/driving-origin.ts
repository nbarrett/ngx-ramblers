import { Component, ElementRef, EventEmitter, inject, Input, Output, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { DrivingOriginMode } from "../../models/current-location.model";
import { CurrentLocationService } from "../../services/maps/current-location.service";

@Component({
  selector: "app-driving-origin",
  imports: [FormsModule, TooltipDirective],
  styles: [`
    :host
      display: contents
    .postcode-input
      flex: 0 0 auto
      width: 120px
  `],
  template: `
    <div class="form-check form-check-inline d-flex align-items-center">
      <input [id]="name + '-driving-from-postcode'" type="radio" class="form-check-input" [name]="name" [disabled]="disabled"
             [checked]="mode === DrivingOriginMode.POSTCODE" (change)="modeChange.emit(DrivingOriginMode.POSTCODE)"/>
      <label class="form-check-label text-nowrap" [for]="name + '-driving-from-postcode'">Driving from</label>
      <input #postcodeInput class="form-control form-control-sm text-uppercase ms-2 postcode-input" type="text" [disabled]="disabled"
             [ngModel]="postcode" [ngModelOptions]="{standalone: true}" (ngModelChange)="postcodeChange.emit($event)"
             placeholder="Postcode">
    </div>
    @if (currentLocation.available()) {
      <div class="form-check form-check-inline">
        <input [id]="name + '-driving-from-here'" type="radio" class="form-check-input" [name]="name" [disabled]="disabled"
               [checked]="mode === DrivingOriginMode.MY_LOCATION" (change)="modeChange.emit(DrivingOriginMode.MY_LOCATION)"/>
        <label class="form-check-label text-nowrap" [for]="name + '-driving-from-here'"
               tooltip="Driving directions from where you are now" placement="top">
          Driving from my location
          @if (locating) {
            <span class="text-muted ms-2">Finding you…</span>
          }
        </label>
      </div>
    }`
})
export class DrivingOrigin {
  @Input() name = "driving-origin";
  @Input() mode: DrivingOriginMode | null = null;
  @Input() postcode = "";
  @Input() locating = false;
  @Input() disabled = false;
  @Output() modeChange = new EventEmitter<DrivingOriginMode>();
  @Output() postcodeChange = new EventEmitter<string>();
  @ViewChild("postcodeInput") postcodeInput: ElementRef<HTMLInputElement>;
  protected currentLocation = inject(CurrentLocationService);
  protected readonly DrivingOriginMode = DrivingOriginMode;

  focusPostcode(): void {
    setTimeout(() => this.postcodeInput?.nativeElement?.focus(), 0);
  }
}
