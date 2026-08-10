import {
  Component,
  forwardRef,
  Input
} from "@angular/core";
import { CdkTextareaAutosize } from "@angular/cdk/text-field";
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from "@angular/forms";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { EmojiShortcodesDirective } from "./emoji-shortcodes.directive";

@Component({
  selector: "app-emoji-textarea",
  styles: [`
    :host
      display: flex

    .caption-input
      border-radius: var(--radius-2, 6px)
      box-sizing: content-box
      flex: 1 1 auto
      min-width: 0
      max-height: none
      resize: none
      overflow: hidden
      line-height: 1.45
      width: 0
  `],
  template: `
    <textarea appEmojiShortcodes
              cdkTextareaAutosize
              class="form-control caption-input"
              [attr.id]="inputId || null"
              [rows]="rows"
              [cdkAutosizeMinRows]="rows"
              [placeholder]="placeholder"
              [disabled]="disabled"
              [ngModel]="value"
              (ngModelChange)="onModelChange($event)"
              (input)="onInput()"></textarea>
  `,
  imports: [FormsModule, EmojiShortcodesDirective, CdkTextareaAutosize],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => EmojiTextareaComponent),
    multi: true
  }]
})
export class EmojiTextareaComponent implements ControlValueAccessor {

  @Input() rows = 3;
  @Input() placeholder = "";
  @Input() inputId = "";

  protected value = "";
  protected disabled = false;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  writeValue(value: string): void {
    this.value = value || "";
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
  }

  onInput(): void {
    this.onTouched();
  }
}
