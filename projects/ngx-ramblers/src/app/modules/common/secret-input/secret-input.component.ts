import { Component, Input, forwardRef, inject } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEye, faEyeSlash, faCopy, faCheck } from "@fortawesome/free-solid-svg-icons";
import { ClipboardService } from "../../../services/clipboard.service";
import { TooltipModule } from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-secret-input",
    imports: [CommonModule, FormsModule, FontAwesomeModule, TooltipModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SecretInputComponent),
      multi: true
    }
  ],
  styles: [`
    .secret-input-wrapper
      position: relative
      display: flex
      align-items: stretch

    .secret-input
      flex: 1
      padding-right: 80px

    .secret-input-actions
      position: absolute
      right: 0
      top: 0
      bottom: 0
      display: flex
      align-items: center
      gap: 0.25rem
      padding-right: 0.5rem

    .secret-btn
      border: none
      background: transparent
      padding: 0.25rem 0.5rem
      cursor: pointer
      color: var(--ramblers-colour-mintcake)
      transition: color 0.15s ease-in-out

      &:hover
        color: var(--ramblers-colour-mintcake-hover-dark)

      &:focus
        outline: none
        box-shadow: none

      &.copied
        color: #28a745

    .secret-input:disabled ~ .secret-input-actions .secret-btn
      cursor: not-allowed
      opacity: 0.5
  `],
  template: `
    <div class="secret-input-wrapper">
      <input
        [type]="isVisible ? 'text' : 'password'"
        class="form-control secret-input"
        [class.input-sm]="size === 'sm'"
        [id]="id"
        [value]="value"
        (input)="onInputChange($event)"
        (blur)="onTouched()"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [attr.autocomplete]="autocomplete"
      />
      <div class="secret-input-actions">
        <button
          type="button"
          class="secret-btn"
          (click)="toggleVisibility()"
          [disabled]="disabled"
          [tooltip]="isVisible ? 'Hide' : 'Show'"
          delay="500"
          container="body">
          <fa-icon [icon]="isVisible ? faEyeSlash : faEye"></fa-icon>
        </button>
        <button
          type="button"
          class="secret-btn"
          [class.copied]="justCopied"
          (click)="copyToClipboard()"
          [disabled]="disabled || !value"
          [tooltip]="justCopied ? 'Copied!' : 'Copy to clipboard'"
          delay="500"
          container="body">
          <fa-icon [icon]="justCopied ? faCheck : faCopy"></fa-icon>
        </button>
      </div>
    </div>
  `
})
export class SecretInputComponent implements ControlValueAccessor {
  private clipboardService = inject(ClipboardService);

  @Input() id = "";
  @Input() placeholder = "";
  @Input() size: "sm" | "md" = "md";
  @Input() autocomplete = "new-password";

  faEye = faEye;
  faEyeSlash = faEyeSlash;
  faCopy = faCopy;
  faCheck = faCheck;

  value = "";
  disabled = false;
  isVisible = false;
  justCopied = false;

  private copyTimeout: any;

  onChange: any = () => {};
  onTouched: any = () => {};

  writeValue(value: any): void {
    this.value = value || "";
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value = input.value;
    this.onChange(this.value);
  }

  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
  }

  async copyToClipboard(): Promise<void> {
    if (!this.value) return;

    await this.clipboardService.copyToClipboard(this.value);
    this.justCopied = true;

    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }

    this.copyTimeout = setTimeout(() => {
      this.justCopied = false;
    }, 2000);
  }

  ngOnDestroy(): void {
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
  }
}
