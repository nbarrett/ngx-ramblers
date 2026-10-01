import {afterEveryRender, Directive, ElementRef, EventEmitter, inject, Input, Output} from "@angular/core";
import {coerceBooleanProperty} from "@angular/cdk/coercion";

@Directive({selector: "[appFocusInput]"})
export class FocusInputDirective {
  private element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private requested = false;
  @Output() focusCompleted = new EventEmitter<void>();

  @Input() set appFocusInput(value: boolean) {
    this.requested = coerceBooleanProperty(value);
  }

  constructor() {
    afterEveryRender(() => {
      const input = this.element.nativeElement;
      if (this.requested && input.isConnected && input.getClientRects().length > 0) {
        this.requested = false;
        input.focus();
        this.focusCompleted.emit();
      }
    });
  }
}
