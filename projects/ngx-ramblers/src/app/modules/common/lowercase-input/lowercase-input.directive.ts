import { Directive, HostListener, inject } from "@angular/core";
import { NgControl } from "@angular/forms";

@Directive({
  selector: "input[appLowercaseInput]",
  standalone: true
})
export class LowercaseInputDirective {

  private ngControl = inject(NgControl, {optional: true, self: true});

  @HostListener("input", ["$event.target"])
  onInput(input: HTMLInputElement): void {
    const lowercased = input.value.toLowerCase();
    if (lowercased !== input.value) {
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      input.value = lowercased;
      input.setSelectionRange(selectionStart, selectionEnd);
      this.ngControl?.control?.setValue(lowercased);
    }
  }
}
