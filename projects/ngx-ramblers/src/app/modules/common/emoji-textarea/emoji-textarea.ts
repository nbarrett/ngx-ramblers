import {
  AfterViewChecked,
  Component,
  ElementRef,
  forwardRef,
  Input,
  ViewChild
} from "@angular/core";
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from "@angular/forms";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { EmojiShortcodesDirective } from "./emoji-shortcodes.directive";

@Component({
  selector: "app-emoji-textarea",
  styles: [`
    :host
      display: block

    .caption-input
      border-radius: var(--radius-2, 6px)
      min-height: 110px
      max-height: none
      resize: none
      overflow: hidden
      field-sizing: content
      line-height: 1.45
      width: 100%
  `],
  template: `
    <textarea #field
              appEmojiShortcodes
              class="form-control caption-input"
              [attr.id]="inputId || null"
              [rows]="rows"
              [placeholder]="placeholder"
              [disabled]="disabled"
              [ngModel]="value"
              (ngModelChange)="onModelChange($event)"
              (input)="onInput()"></textarea>
  `,
  imports: [FormsModule, EmojiShortcodesDirective],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => EmojiTextareaComponent),
    multi: true
  }]
})
export class EmojiTextareaComponent implements ControlValueAccessor, AfterViewChecked {

  @ViewChild("field") private fieldRef: ElementRef<HTMLTextAreaElement>;
  @Input() rows = 3;
  @Input() placeholder = "";
  @Input() inputId = "";

  protected value = "";
  protected disabled = false;
  private autosizePending = true;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  ngAfterViewChecked(): void {
    if (this.autosizePending) {
      this.autosizePending = false;
      this.resizeField();
    }
  }

  writeValue(value: string): void {
    this.value = value || "";
    this.autosizePending = true;
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onModelChange(value: string): void {
    this.value = value || "";
    this.onChange(this.value);
    this.autosizePending = true;
  }

  onInput(): void {
    this.resizeField();
    this.onTouched();
  }

  private resizeField(): void {
    const field = this.fieldRef?.nativeElement;
    if (field) {
      field.style.height = "auto";
      field.style.height = `${Math.max(field.scrollHeight, 110)}px`;
    }
  }
}
