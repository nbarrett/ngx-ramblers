import { Component, Input } from "@angular/core";

@Component({
  selector: "app-labelled-field",
  host: {"[class.labelled-field-grow]": "grow"},
  styleUrls: ["./labelled-field.sass"],
  template: `
    @if (label) {
      <label [attr.for]="controlId">{{ label }}</label>
    }
    <div class="labelled-field-control">
      <ng-content/>
    </div>`
})
export class LabelledFieldComponent {
  @Input() label: string;
  @Input() controlId: string;
  @Input() grow = false;
}
