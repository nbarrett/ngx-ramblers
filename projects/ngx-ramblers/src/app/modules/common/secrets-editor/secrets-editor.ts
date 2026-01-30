import { Component, EventEmitter, Input, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { keys, toPairs } from "es-toolkit/compat";
import { SecretInputComponent } from "../secret-input/secret-input.component";
import { InputSize } from "../../../models/ui-size.model";
import { SecretEntry } from "../../../models/backup-session.model";

@Component({
  selector: "app-secrets-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, SecretInputComponent],
  styles: [`
    :host
      display: block
  `],
  template: `
    @for (secret of secretEntries(); let i = $index; track i) {
      <div class="row mb-2">
        <div class="col-md-5">
          <input type="text"
                 class="form-control"
                 [ngModel]="secret.key"
                 (ngModelChange)="updateSecretKey(i, $event)"
                 [name]="namePrefix + 'SecretKey' + i"
                 [placeholder]="keyPlaceholder">
        </div>
        <div class="col-md-5">
          <app-secret-input
            [ngModel]="secret.value"
            (ngModelChange)="updateSecretValue(i, $event)"
            [name]="namePrefix + 'SecretValue' + i"
            [size]="InputSize.SM">
          </app-secret-input>
        </div>
        <div class="col-md-2">
          <button type="button"
                  class="btn btn-danger btn-sm"
                  (click)="removeSecret(i)">
            <fa-icon [icon]="faTrash"></fa-icon>
          </button>
        </div>
      </div>
    }
    <div class="mt-2">
      <button type="button"
              class="btn btn-outline-success btn-sm"
              (click)="addSecret()">
        <fa-icon [icon]="faPlus"></fa-icon>
        {{ addButtonLabel }}
      </button>
    </div>
  `
})
export class SecretsEditor {
  protected readonly InputSize = InputSize;
  protected readonly faPlus = faPlus;
  protected readonly faTrash = faTrash;

  @Input() secrets: Record<string, string> = {};
  @Input() namePrefix = "secret";
  @Input() keyPlaceholder = "ENV_VAR_NAME";
  @Input() addButtonLabel = "Add Secret";

  @Output() secretsChange = new EventEmitter<Record<string, string>>();

  secretEntries(): SecretEntry[] {
    return toPairs(this.secrets || {}).map(([key, value]) => ({ key, value }));
  }

  updateSecretKey(index: number, newKey: string) {
    const secretList = this.secretEntries();
    if (index >= 0 && index < secretList.length) {
      const oldKey = secretList[index].key;
      const value = this.secrets?.[oldKey] || "";
      const updated = { ...this.secrets };
      delete updated[oldKey];
      updated[newKey] = value;
      this.secrets = updated;
      this.secretsChange.emit(this.secrets);
    }
  }

  updateSecretValue(index: number, newValue: string) {
    const secretList = this.secretEntries();
    if (index >= 0 && index < secretList.length) {
      const key = secretList[index].key;
      const updated = { ...this.secrets };
      updated[key] = newValue;
      this.secrets = updated;
      this.secretsChange.emit(this.secrets);
    }
  }

  addSecret() {
    const count = keys(this.secrets || {}).length;
    const updated = { ...this.secrets };
    updated[`NEW_SECRET_${count + 1}`] = "";
    this.secrets = updated;
    this.secretsChange.emit(this.secrets);
  }

  removeSecret(index: number) {
    const secretList = this.secretEntries();
    if (index >= 0 && index < secretList.length) {
      const key = secretList[index].key;
      const updated = { ...this.secrets };
      delete updated[key];
      this.secrets = updated;
      this.secretsChange.emit(this.secrets);
    }
  }
}
