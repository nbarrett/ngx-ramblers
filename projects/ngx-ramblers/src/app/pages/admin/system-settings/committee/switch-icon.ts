import { Component, Input } from "@angular/core";
import { faToggleOff, faToggleOn } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-switch-icon",
  styleUrls: ["./switch-icon.sass"],
  template: `
    <fa-icon class="switch" [icon]="on? faToggleOn:faToggleOff"></fa-icon>`,
  standalone: false
})
export class SwitchIconComponent {

  @Input() on: boolean;
  @Input() disabled: boolean;

  protected readonly faToggleOff = faToggleOff;
  protected readonly faToggleOn = faToggleOn;
}
