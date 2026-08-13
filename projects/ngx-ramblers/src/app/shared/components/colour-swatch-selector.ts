import { Component, EventEmitter, Input, Output } from "@angular/core";
import { enumValues } from "../../functions/enums";
import { PaletteColor } from "../../models/content-text.model";

@Component({
  selector: "app-colour-swatch-selector",
  template: `
    <div class="colour-options">
      @for (colour of colours; track colour) {
        <button type="button"
                class="colour-swatch"
                [style.backgroundColor]="colour"
                [class.selected]="value === colour"
                [attr.aria-label]="colour"
                [title]="colour"
                (click)="select(colour)">
        </button>
      }
    </div>`,
  styles: [`
    .colour-options
      display: flex
      flex-wrap: wrap
      gap: 0.4rem
    .colour-swatch
      width: 28px
      height: 28px
      border-radius: 50%
      border: 2px solid transparent
      padding: 0
      cursor: pointer
    .colour-swatch.selected
      border-color: var(--bs-primary)
      box-shadow: 0 0 0 2px rgba(19, 132, 227, 0.25)
  `]
})
export class ColourSwatchSelectorComponent {
  @Input() value: string | null = null;
  @Input() colours: string[] = enumValues(PaletteColor);
  @Output() valueChange = new EventEmitter<string>();

  select(colour: string): void {
    this.value = colour;
    this.valueChange.emit(colour);
  }
}
